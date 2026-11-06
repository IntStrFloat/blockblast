import { create } from 'zustand';

import type { HelperSpendIntent } from '@/core/engine';
import { seedFromTime } from '@/core/engine';
import { KEYS, getJSON, setJSON, setJSONOrThrow } from '@/core/storage';
import { recordNextGoalCompletion, useAnalyticsStore } from '@/features/analytics';
import { PROGRESSION_CONFIG, stageForLevel, useProgression } from '@/features/progression';
import { todayISO } from '@/features/streak';

import { COSMETICS } from './logic/cosmetics';
import { canUseHelper } from './logic/rules';
import { serializeShowcase } from './logic/showcase';
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
  merged.wornCosmetics = [
    ...new Set([...(merged.wornCosmetics ?? []), ...Object.values(merged.equipped)]),
  ];
  return merged;
}

function persist(state: MascotState, critical = false): void {
  const write = critical ? setJSONOrThrow : setJSON;
  write(KEYS.mascot, {
    unlocked: state.unlocked,
    equipped: state.equipped,
    wornCosmetics: state.wornCosmetics,
    helpersUsedDay: state.helpersUsedDay,
    helperCharges: state.helperCharges,
    rewardedHelperReceipts: state.rewardedHelperReceipts,
    helperSpendReceipts: state.helperSpendReceipts,
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
  grantRewardedHelperCharge: (
    id: HelperId,
    sessionId: string,
    pendingSessionIds?: readonly string[],
  ) => void;
  useHelper: (id: HelperId, receipt?: HelperSpendIntent) => boolean;
  drop: () => void;
  recover: () => void;
  equip: (slot: Slot, id: string, source?: 'wardrobe' | 'map') => void;
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

  grantRewardedHelperCharge(id, sessionId, pendingSessionIds = []) {
    const prev = get();
    if (prev.rewardedHelperReceipts?.[sessionId]) return;
    const helperCharges = { ...prev.helperCharges, [id]: (prev.helperCharges[id] ?? 0) + 1 };
    const rewardedHelperReceipts = { ...prev.rewardedHelperReceipts, [sessionId]: true as const };
    // Native callbacks cannot replay across processes. Keep recent receipts and
    // every outstanding journal entry, including a torn cleanup after payout.
    const protectedIds = new Set([...pendingSessionIds, sessionId]);
    const recentIds = new Set(Object.keys(rewardedHelperReceipts).slice(-256));
    for (const receiptId of Object.keys(rewardedHelperReceipts)) {
      if (!protectedIds.has(receiptId) && !recentIds.has(receiptId))
        delete rewardedHelperReceipts[receiptId];
    }
    persist({ ...prev, helperCharges, rewardedHelperReceipts }, true);
    set({ helperCharges, rewardedHelperReceipts });
  },

  useHelper(id, receipt) {
    const prev = get();
    if (receipt && prev.helperSpendReceipts?.[receipt.id]) return true;
    const today = receipt?.day ?? todayISO();
    const gameLevel = useProgression.getState().level;
    const charges = prev.helperCharges[id] ?? 0;
    if (!receipt && !canUseHelper(prev.helpersUsedDay[id], today, gameLevel, id, charges))
      return false;
    const source = receipt?.source ?? (prev.helpersUsedDay[id] !== today ? 'daily' : 'charge');
    if (source === 'charge' && charges <= 0) return false;
    const helpersUsedDay =
      source === 'daily'
        ? {
            ...prev.helpersUsedDay,
            [id]: (prev.helpersUsedDay[id] ?? '') > today ? prev.helpersUsedDay[id]! : today,
          }
        : prev.helpersUsedDay;
    const helperCharges =
      source === 'charge' ? { ...prev.helperCharges, [id]: charges - 1 } : prev.helperCharges;
    const helperSpendReceipts = receipt
      ? { ...prev.helperSpendReceipts, [receipt.id]: true as const }
      : prev.helperSpendReceipts;
    const next: MascotState = { ...prev, helpersUsedDay, helperCharges, helperSpendReceipts };
    // The debit and receipt share one critical MMKV write. A pending run can
    // retry after process death without spending its charge twice.
    persist(next, !!receipt);
    set({ helpersUsedDay, helperCharges, helperSpendReceipts });
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

  equip(slot, id, source = 'wardrobe') {
    const prev = get();
    if (!prev.unlocked.includes(id)) return;
    if (COSMETIC_SLOT[id] !== slot) return;

    const equipped = { ...prev.equipped, [slot]: id };
    const wornCosmetics = [...new Set([...(prev.wornCosmetics ?? []), id])];
    const next: MascotState = { ...prev, equipped, wornCosmetics };
    set({ equipped, wornCosmetics });
    persist(next);
    useAnalyticsStore.getState().track('reward_equipped', {
      item_id: id,
      source,
      first_equip: Object.keys(prev.equipped).length === 0,
    });
    const rewardLevel = Object.entries(PROGRESSION_CONFIG.levelRewards).find(
      ([, reward]) => reward?.kind === 'cosmetic' && reward.id === id,
    )?.[0];
    if (rewardLevel) recordNextGoalCompletion('reward', `reward:${rewardLevel}:${id}`);
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

/**
 * Текущий витринный образ игрока (retention фаза 3): стадия — из Уровня Игры
 * (спека 15), экипировка — из гардероба. Отправляется с сабмитом рекорда.
 */
export function getShowcaseAvatar(): string {
  const level = useProgression.getState().level;
  const equipped = useMascot.getState().equipped;
  return serializeShowcase(stageForLevel(level), equipped);
}
