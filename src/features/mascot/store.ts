import { create } from 'zustand';

import { seedFromTime } from '@/core/engine';
import { KEYS, getJSON, setJSON } from '@/core/storage';
import { useProgression } from '@/features/progression';
import { todayISO } from '@/features/streak';

import { COSMETICS } from './logic/cosmetics';
import { canUseHelper } from './logic/rules';
import type { HelperId, MascotState, Slot } from './logic/types';

// ---------------------------------------------------------------------------
// Дефолты и инициализация
// ---------------------------------------------------------------------------

const DEFAULTS: MascotState = {
  unlocked: [],
  equipped: {},
  helpersUsedDay: {},
  helperCharges: {},
  lost: false,
  introDone: false,
  rngState: seedFromTime(),
};

const saved = getJSON<Partial<MascotState>>(KEYS.mascot);
const COSMETIC_SLOT: Record<string, Slot> = Object.fromEntries(
  COSMETICS.map((item) => [item.id, item.slot]),
);

function normalizeEquipped(
  equipped: Partial<Record<Slot, string>>,
  unlocked: readonly string[],
): Partial<Record<Slot, string>> {
  const normalized: Partial<Record<Slot, string>> = {};
  for (const [slot, id] of Object.entries(equipped) as [Slot, string][]) {
    if (unlocked.includes(id) && COSMETIC_SLOT[id] === slot) {
      normalized[slot] = id;
    }
  }
  return normalized;
}

/**
 * Начальное состояние: дефолты + сохранённые поверх; equipped нормализуется по unlocked.
 * Своего уровня маскот больше не пересчитывает (спека 15): стадия выводится из Уровня Игры,
 * сверку unlocked с достигнутым уровнем делает координатор useProgressionSync на маунте (§5).
 */
function buildInitial(): MascotState {
  const merged: MascotState = { ...DEFAULTS, ...saved };
  merged.equipped = normalizeEquipped(merged.equipped, merged.unlocked);
  return merged;
}

function persist(state: MascotState): void {
  setJSON(KEYS.mascot, {
    unlocked: state.unlocked,
    equipped: state.equipped,
    helpersUsedDay: state.helpersUsedDay,
    helperCharges: state.helperCharges,
    lost: state.lost,
    introDone: state.introDone,
    rngState: state.rngState,
  });
}

// ---------------------------------------------------------------------------
// Интерфейс стора
// ---------------------------------------------------------------------------

interface MascotActions {
  /** Идемпотентно разблокировать косметику (вызывают координатор 11 и дейли 14). */
  unlock: (id: string) => void;
  /** Добавить заряд помощника (дроп дейли), тратится сверх дневного лимита. */
  addHelperCharge: (id: HelperId) => void;
  useHelper: (id: HelperId) => boolean;
  drop: () => void;
  recover: () => void;
  equip: (slot: Slot, id: string) => void;
  unequip: (slot: Slot) => void;
  markIntroDone: () => void;
  bumpRng: (rngState: number) => void;
}

type MascotStore = MascotState & MascotActions;

// ---------------------------------------------------------------------------
// Стор
// ---------------------------------------------------------------------------

export const useMascot = create<MascotStore>((set, get) => ({
  ...buildInitial(),

  unlock(id) {
    const prev = get();
    if (prev.unlocked.includes(id)) return;
    const unlocked = [...prev.unlocked, id];
    const next: MascotState = { ...prev, unlocked };
    set({ unlocked });
    persist(next);
  },

  addHelperCharge(id) {
    const prev = get();
    const current = prev.helperCharges[id] ?? 0;
    const helperCharges = { ...prev.helperCharges, [id]: current + 1 };
    const next: MascotState = { ...prev, helperCharges };
    set({ helperCharges });
    persist(next);
  },

  useHelper(id) {
    const prev = get();
    const today = todayISO();
    // Гейт разлока — из Уровня Игры (спека 15 §3).
    const gameLevel = useProgression.getState().level;
    const charges = prev.helperCharges[id] ?? 0;
    if (!canUseHelper(prev.helpersUsedDay[id], today, gameLevel, id, charges)) return false;

    if (prev.helpersUsedDay[id] !== today) {
      // Дневной слот свободен — пометить день.
      const helpersUsedDay = { ...prev.helpersUsedDay, [id]: today };
      const next: MascotState = { ...prev, helpersUsedDay };
      set({ helpersUsedDay });
      persist(next);
    } else {
      // Дневной лимит исчерпан — потратить заряд из дейли-дропа.
      const helperCharges = { ...prev.helperCharges, [id]: charges - 1 };
      const next: MascotState = { ...prev, helperCharges };
      set({ helperCharges });
      persist(next);
    }
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
    if (COSMETIC_SLOT[id] !== slot) return;

    const equipped = { ...prev.equipped, [slot]: id };
    const next: MascotState = { ...prev, equipped };
    set({ equipped });
    persist(next);
  },

  unequip(slot) {
    const prev = get();
    const equipped = { ...prev.equipped };
    delete equipped[slot];
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
}));
