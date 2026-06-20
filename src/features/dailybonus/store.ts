import { create } from 'zustand';

import { seedFromTime } from '@/core/engine';
import { KEYS, getJSON, setJSON } from '@/core/storage';
import { useMascot } from '@/features/mascot/store';
import { useProgression } from '@/features/progression';
import type { AddPointsResult } from '@/features/progression';
import { todayISO, useStreak } from '@/features/streak';

import { DAILY_CONFIG } from './logic/config';
import { computeDaily, type DailyDrop } from './logic/reward';

interface DailyState {
  lastClaimDay: string | null;
  rngState: number;
}

export interface DailyClaimPayload {
  points: number;
  multiplier: number;
  drop: DailyDrop;
  progress: AddPointsResult;
}

interface DailyStore extends DailyState {
  canClaim: () => boolean;
  claim: () => DailyClaimPayload | null;
}

const saved = getJSON<DailyState>(KEYS.daily);
// Миграция (спека 15 §6): покормивший Капи сегодня (старый mascot.lastFedDay) не должен
// забрать дейли повторно — переносим день забора, если своего ещё нет.
const savedMascot = getJSON<{ lastFedDay?: string | null }>(KEYS.mascot);

export const useDailyBonus = create<DailyStore>((set, get) => ({
  lastClaimDay: saved?.lastClaimDay ?? savedMascot?.lastFedDay ?? null,
  rngState: saved?.rngState ?? seedFromTime(),

  canClaim() {
    return get().lastClaimDay !== todayISO();
  },

  claim() {
    const today = todayISO();
    if (get().lastClaimDay === today) return null;

    // Живой стрик; если потерян/0 — день 1 (×1). Множитель растёт только реальной игрой.
    const streak = Math.max(useStreak.getState().visibleCount(), 1);
    const result = computeDaily(streak, get().rngState, DAILY_CONFIG);

    const progress = useProgression.getState().addPoints(result.points);

    const drop = result.drop;
    if (drop !== null) {
      if (drop.type === 'cosmetic' || drop.type === 'rare') {
        useMascot.getState().unlock(drop.id);
      } else if (drop.type === 'helperCharge') {
        useMascot.getState().addHelperCharge(drop.helper);
      }
    }

    const next: DailyState = { lastClaimDay: today, rngState: result.rngState };
    set(next);
    setJSON(KEYS.daily, next);

    return { points: result.points, multiplier: result.multiplier, drop, progress };
  },
}));
