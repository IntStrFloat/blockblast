import { useMascot } from '@/features/mascot/store';
import { useProgression } from '@/features/progression';
import { todayISO, useStreak } from '@/features/streak';

import { useDailyBonus } from '../store';

function reset() {
  useProgression.setState({
    lifetimePoints: 0,
    level: 1,
    world: 1,
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    claimedRewards: [],
  });
  useStreak.setState({ lastDay: todayISO(), count: 3, protectorLastUsedDay: null });
  useMascot.setState({ unlocked: [], helperCharges: {} });
  useDailyBonus.setState({ lastClaimDay: null, rngState: 777 });
}

describe('useDailyBonus.claim', () => {
  beforeEach(reset);

  it('начисляет очки × множитель стрика и фиксирует день', () => {
    const payload = useDailyBonus.getState().claim();
    expect(payload).not.toBeNull();
    expect(payload!.multiplier).toBe(1.5); // день 3
    expect(payload!.points).toBe(750); // round(500 × 1.5)
    expect(useProgression.getState().lifetimePoints).toBe(750);
    expect(useDailyBonus.getState().lastClaimDay).toBe(todayISO());
  });

  it('забор раз в день идемпотентен', () => {
    expect(useDailyBonus.getState().claim()).not.toBeNull();
    expect(useDailyBonus.getState().canClaim()).toBe(false);
    expect(useDailyBonus.getState().claim()).toBeNull();
  });

  it('дроп применяется к маскоту', () => {
    const payload = useDailyBonus.getState().claim();
    const drop = payload!.drop;
    if (drop === null) return; // в этот день дропа нет — допустимо
    if (drop.type === 'cosmetic' || drop.type === 'rare') {
      expect(useMascot.getState().unlocked).toContain(drop.id);
    } else {
      expect(useMascot.getState().helperCharges?.[drop.helper] ?? 0).toBeGreaterThan(0);
    }
  });

  it('потерянный стрик → день 1 (×1), но забор работает', () => {
    useStreak.setState({ lastDay: '2000-01-01', count: 9, protectorLastUsedDay: null });
    const payload = useDailyBonus.getState().claim();
    expect(payload!.multiplier).toBe(1);
    expect(payload!.points).toBe(500);
  });
});
