import { create } from 'zustand';

import { seedFromTime, type PlacementEvent } from '@/core/engine';
import { KEYS, getJSON, setJSON } from '@/core/storage';
import { todayISO } from '@/features/streak';

import { MASCOT_CONFIG } from './logic/config';
import { progressFor, rewardForLevel } from './logic/progression';
import { canFeed, canUseHelper, xpFromEvent } from './logic/rules';
import type { HelperId, LevelReward, MascotState, Slot } from './logic/types';

// ---------------------------------------------------------------------------
// Дефолты и инициализация
// ---------------------------------------------------------------------------

const DEFAULTS: MascotState = {
  totalXp: 0,
  level: 1,
  unlocked: [],
  equipped: {},
  lastFedDay: null,
  helpersUsedDay: {},
  lost: false,
  introDone: false,
  rngState: seedFromTime(),
};

const saved = getJSON<Partial<MascotState>>(KEYS.mascot);

/** Начальное состояние: дефолты + сохранённые поверх; level пересчитывается защитно */
function buildInitial(): MascotState {
  const merged: MascotState = { ...DEFAULTS, ...saved };
  // Привести кеш level в соответствие с totalXp (защита от рассинхрона)
  merged.level = progressFor(merged.totalXp).level;
  return merged;
}

// ---------------------------------------------------------------------------
// Персист
// ---------------------------------------------------------------------------

/** Ключи, которые НЕ надо сохранять (transient поля стора). */
const TRANSIENT_KEYS: readonly string[] = ['reveal'];

function persist(state: MascotState): void {
  // Отфильтровать transient поля перед записью в MMKV.
  const payload = Object.fromEntries(
    Object.entries(state).filter(([k]) => !TRANSIENT_KEYS.includes(k)),
  );
  setJSON(KEYS.mascot, payload);
}

// ---------------------------------------------------------------------------
// Общий хелпер: начисление XP с уровень-апом и разблокировкой косметики
// ---------------------------------------------------------------------------

interface GainResult {
  patch: Pick<MascotState, 'totalXp' | 'level' | 'unlocked'>;
  leveledTo: number;
  rewards: LevelReward[];
}

function gainXp(prev: MascotState, amount: number): GainResult {
  const newTotal = prev.totalXp + amount;
  const oldLevel = prev.level;
  const newLevel = progressFor(newTotal).level;

  const rewards: LevelReward[] = [];
  const unlocked = [...prev.unlocked];

  for (let L = oldLevel + 1; L <= newLevel; L++) {
    const r = rewardForLevel(L);
    if (r !== null) {
      if (r.kind === 'cosmetic' && !unlocked.includes(r.id)) {
        unlocked.push(r.id);
      }
      rewards.push(r);
    }
  }

  return {
    patch: { totalXp: newTotal, level: newLevel, unlocked },
    leveledTo: newLevel,
    rewards,
  };
}

// ---------------------------------------------------------------------------
// Интерфейс стора
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Transient reveal (NOT persisted to MMKV)
// ---------------------------------------------------------------------------

interface RevealPayload {
  level: number;
  rewards: LevelReward[];
}

interface MascotActions {
  applyEvent: (event: PlacementEvent, isRecord: boolean) => { leveledTo: number; rewards: LevelReward[] };
  feed: () => { leveledTo: number; rewards: LevelReward[] } | null;
  useHelper: (id: HelperId) => boolean;
  drop: () => void;
  recover: () => void;
  equip: (slot: Slot, id: string) => void;
  markIntroDone: () => void;
  bumpRng: (rngState: number) => void;
  clearReveal: () => void;
}

type MascotStore = MascotState & MascotActions & { reveal: RevealPayload | null };

// ---------------------------------------------------------------------------
// Стор
// ---------------------------------------------------------------------------

export const useMascot = create<MascotStore>((set, get) => ({
  ...buildInitial(),

  reveal: null,

  applyEvent(event, isRecord) {
    const prev = get();
    const gained = xpFromEvent(event, isRecord);
    const { patch, leveledTo, rewards } = gainXp(prev, gained);
    const next: MascotState = { ...prev, ...patch };
    const revealPatch = leveledTo > prev.level ? { reveal: { level: leveledTo, rewards } } : {};
    set({ ...patch, ...revealPatch });
    persist(next);
    return { leveledTo, rewards };
  },

  feed() {
    const prev = get();
    const today = todayISO();
    if (!canFeed(prev.lastFedDay, today)) return null;

    const { patch, leveledTo, rewards } = gainXp(prev, MASCOT_CONFIG.xp.dailyFeed);
    const next: MascotState = { ...prev, ...patch, lastFedDay: today };
    const revealPatch = leveledTo > prev.level ? { reveal: { level: leveledTo, rewards } } : {};
    set({ ...patch, lastFedDay: today, ...revealPatch });
    persist(next);
    return { leveledTo, rewards };
  },

  useHelper(id) {
    const prev = get();
    const today = todayISO();
    if (!canUseHelper(prev.helpersUsedDay[id], today, prev.level, id)) return false;

    const helpersUsedDay = { ...prev.helpersUsedDay, [id]: today };
    const next: MascotState = { ...prev, helpersUsedDay };
    set({ helpersUsedDay });
    persist(next);
    return true;
  },

  drop() {
    const prev = get();
    const next: MascotState = { ...prev, lost: true };
    set({ lost: true });
    persist(next);
  },

  recover() {
    const prev = get();
    const next: MascotState = { ...prev, lost: false };
    set({ lost: false });
    persist(next);
  },

  equip(slot, id) {
    const prev = get();
    if (!prev.unlocked.includes(id)) return;

    const equipped = { ...prev.equipped, [slot]: id };
    const next: MascotState = { ...prev, equipped };
    set({ equipped });
    persist(next);
  },

  markIntroDone() {
    const prev = get();
    const next: MascotState = { ...prev, introDone: true };
    set({ introDone: true });
    persist(next);
  },

  bumpRng(rngState) {
    const prev = get();
    const next: MascotState = { ...prev, rngState };
    set({ rngState });
    persist(next);
  },

  clearReveal() {
    set({ reveal: null });
  },
}));
