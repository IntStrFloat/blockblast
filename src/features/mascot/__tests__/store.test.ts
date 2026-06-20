/**
 * store.test.ts — стор маскота после декаплинга (спека 15).
 *
 * Капи не владеет XP/уровнем/кормлением: остаётся гардероб, помощники, потеря, интро, rng.
 * Гейт помощника читается из Уровня Игры (progression).
 */
import { KEYS, getJSON, removeKey } from '@/core/storage';
import { useProgression } from '@/features/progression';
import { todayISO } from '@/features/streak';

import { useMascot } from '../store';

const FIXED_RNG = 42;

const DEFAULTS = {
  unlocked: ['hat-casquette'],
  equipped: {},
  helpersUsedDay: {},
  helperCharges: {},
  lost: false,
  introDone: false,
  rngState: FIXED_RNG,
};

beforeEach(() => {
  // Сброс стора к дефолтам (без replace, чтобы сохранить action-функции).
  useMascot.setState({ ...DEFAULTS });
  removeKey(KEYS.mascot);
  // Уровень Игры по умолчанию 1 (гейт помощников читается отсюда).
  useProgression.setState({ level: 1 });
});

// ---------------------------------------------------------------------------
// Дефолтные значения
// ---------------------------------------------------------------------------
describe('defaults', () => {
  it('lost=false, introDone=false, unlocked carries the wardrobe', () => {
    const s = useMascot.getState();
    expect(s.lost).toBe(false);
    expect(s.introDone).toBe(false);
    expect(s.unlocked).toEqual(['hat-casquette']);
    expect(s.helpersUsedDay).toEqual({});
    expect(s.helperCharges).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// useHelper — гейт от Уровня Игры
// ---------------------------------------------------------------------------
describe('useHelper', () => {
  it('hint: false below unlock level (game level 4)', () => {
    useProgression.setState({ level: 4 });
    expect(useMascot.getState().useHelper('hint')).toBe(false);
  });

  it('hint: true at game level 5 when not used today', () => {
    useProgression.setState({ level: 5 });
    expect(useMascot.getState().useHelper('hint')).toBe(true);
  });

  it('hint: second use the same day returns false', () => {
    useProgression.setState({ level: 5 });
    useMascot.getState().useHelper('hint');
    expect(useMascot.getState().useHelper('hint')).toBe(false);
  });

  it('swap: false at game level 8', () => {
    useProgression.setState({ level: 8 });
    expect(useMascot.getState().useHelper('swap')).toBe(false);
  });

  it('swap: true at game level 9', () => {
    useProgression.setState({ level: 9 });
    expect(useMascot.getState().useHelper('swap')).toBe(true);
  });

  it('persists helpersUsedDay', () => {
    useProgression.setState({ level: 5 });
    useMascot.getState().useHelper('hint');

    const saved = getJSON<{ helpersUsedDay: Record<string, string> }>(KEYS.mascot);
    expect(saved!.helpersUsedDay['hint']).toBe(todayISO());
  });
});

// ---------------------------------------------------------------------------
// drop / recover
// ---------------------------------------------------------------------------
describe('drop / recover', () => {
  it('drop() sets lost=true', () => {
    useMascot.getState().drop();
    expect(useMascot.getState().lost).toBe(true);
  });

  it('recover() clears lost after drop()', () => {
    useMascot.getState().drop();
    useMascot.getState().recover();
    expect(useMascot.getState().lost).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// equip / unequip
// ---------------------------------------------------------------------------
describe('equip', () => {
  it('equip is ignored when id is not unlocked', () => {
    useMascot.setState({ unlocked: [] });
    useMascot.getState().equip('hat', 'hat-panama');
    expect(useMascot.getState().equipped['hat']).toBeUndefined();
  });

  it('equip works when id is unlocked', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');
    expect(useMascot.getState().equipped['hat']).toBe('hat-casquette');
  });

  it('equip is ignored when id does not belong to the slot', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('face', 'hat-casquette');
    expect(useMascot.getState().equipped['face']).toBeUndefined();
  });

  it('equip persists equipped', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');

    const saved = getJSON<{ equipped: Record<string, string> }>(KEYS.mascot);
    expect(saved!.equipped['hat']).toBe('hat-casquette');
  });
});

describe('unequip', () => {
  it('unequip clears the slot after equip', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');
    expect(useMascot.getState().equipped['hat']).toBe('hat-casquette');

    useMascot.getState().unequip('hat');
    expect(useMascot.getState().equipped['hat']).toBeUndefined();
  });

  it('unequip persists the change', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');
    useMascot.getState().unequip('hat');

    const saved = getJSON<{ equipped: Record<string, string> }>(KEYS.mascot);
    expect(saved!.equipped['hat']).toBeUndefined();
  });

  it('unequip of an empty slot is safe', () => {
    expect(() => useMascot.getState().unequip('hat')).not.toThrow();
    expect(useMascot.getState().equipped['hat']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// markIntroDone / bumpRng / persistence
// ---------------------------------------------------------------------------
describe('markIntroDone', () => {
  it('sets introDone=true and persists', () => {
    useMascot.getState().markIntroDone();
    expect(useMascot.getState().introDone).toBe(true);

    const saved = getJSON<{ introDone: boolean }>(KEYS.mascot);
    expect(saved!.introDone).toBe(true);
  });
});

describe('bumpRng', () => {
  it('updates rngState and persists', () => {
    useMascot.getState().bumpRng(99999);
    expect(useMascot.getState().rngState).toBe(99999);

    const saved = getJSON<{ rngState: number }>(KEYS.mascot);
    expect(saved!.rngState).toBe(99999);
  });
});

describe('persistence', () => {
  it('after drop() getJSON(KEYS.mascot).lost === true', () => {
    useMascot.getState().drop();
    const saved = getJSON<{ lost: boolean }>(KEYS.mascot);
    expect(saved!.lost).toBe(true);
  });
});
