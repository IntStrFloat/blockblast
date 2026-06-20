import { useProgression } from '@/features/progression';
import { todayISO } from '@/features/streak';

import { useMascot } from '../store';

describe('mascot.unlock', () => {
  it('идемпотентно добавляет косметику', () => {
    useMascot.setState({ unlocked: [] });
    useMascot.getState().unlock('hat-tophat');
    useMascot.getState().unlock('hat-tophat');
    expect(useMascot.getState().unlocked.filter((x) => x === 'hat-tophat')).toHaveLength(1);
  });
});

describe('mascot.addHelperCharge / useHelper charge', () => {
  it('заряд добавляется и тратится сверх дневного лимита', () => {
    const today = todayISO();
    // hint разлочен на Уровне Игры 5.
    useProgression.setState({ level: 5 });
    useMascot.setState({ helpersUsedDay: { hint: today }, helperCharges: {} });
    // дневной лимит исчерпан, заряда нет → false
    expect(useMascot.getState().useHelper('hint')).toBe(false);
    useMascot.getState().addHelperCharge('hint');
    expect(useMascot.getState().helperCharges.hint).toBe(1);
    // теперь тратит заряд
    expect(useMascot.getState().useHelper('hint')).toBe(true);
    expect(useMascot.getState().helperCharges.hint).toBe(0);
    // заряд исчерпан → снова false
    expect(useMascot.getState().useHelper('hint')).toBe(false);
  });

  it('заряд не обходит блокировку по уровню', () => {
    const today = todayISO();
    // swap разлочен только на уровне 9 — на уровне 1 заряд не помогает.
    useProgression.setState({ level: 1 });
    useMascot.setState({ helpersUsedDay: { swap: today }, helperCharges: { swap: 3 } });
    expect(useMascot.getState().useHelper('swap')).toBe(false);
    expect(useMascot.getState().helperCharges.swap).toBe(3);
  });
});
