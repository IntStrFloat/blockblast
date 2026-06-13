import type { PlacementEvent } from '@/core/engine';
import type { HelperId } from '../logic/types';
import { xpFromEvent, canFeed, canUseHelper } from '../logic/rules';

/** Строим минимальный PlacementEvent для тестов — только поля, читаемые rules.ts */
function makeEvent(
  overrides: Partial<Pick<PlacementEvent, 'clearedRows' | 'clearedCols' | 'combo' | 'boardCleared'>>,
): PlacementEvent {
  return {
    clearedRows: [],
    clearedCols: [],
    combo: 0,
    boardCleared: false,
    // остальные поля PlacementEvent — заглушки, rules.ts их не читает
    placed: [],
    colorId: 0,
    clearedCells: [],
    clearedColors: [],
    scoreDelta: 0,
    score: 0,
    praise: 'none',
    onFire: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  } as PlacementEvent;
}

// ---------------------------------------------------------------------------
// xpFromEvent
// ---------------------------------------------------------------------------
describe('xpFromEvent', () => {
  it('1 cleared line, combo 1, not record → 3', () => {
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    expect(xpFromEvent(e, false)).toBe(3);
  });

  it('2 cleared lines (1 row + 1 col), combo 2, not record → 8', () => {
    // 2*3 + 2*1 = 8 (combo>1 → add combo*comboTierBonus)
    const e = makeEvent({ clearedRows: [0], clearedCols: [3], combo: 2 });
    expect(xpFromEvent(e, false)).toBe(8);
  });

  it('boardCleared:true adds 20', () => {
    // 1 line * 3 + 20 boardClear = 23
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1, boardCleared: true });
    expect(xpFromEvent(e, false)).toBe(23);
  });

  it('isRecord:true adds 50', () => {
    // 1 line * 3 + 50 = 53
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    expect(xpFromEvent(e, true)).toBe(53);
  });

  it('boardCleared and isRecord both apply', () => {
    // 1 line * 3 + 20 + 50 = 73
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1, boardCleared: true });
    expect(xpFromEvent(e, true)).toBe(73);
  });

  it('0 lines, combo 0 → 0', () => {
    const e = makeEvent({});
    expect(xpFromEvent(e, false)).toBe(0);
  });

  it('combo === 1 does NOT add comboTierBonus (only combo > 1)', () => {
    // pure line xp only: 1*3 = 3
    const e = makeEvent({ clearedRows: [1], combo: 1 });
    expect(xpFromEvent(e, false)).toBe(3);
  });

  it('combo 3, 0 lines, not record → 3 (only combo bonus)', () => {
    // 0*3 + 3*1 = 3
    const e = makeEvent({ combo: 3 });
    expect(xpFromEvent(e, false)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// canFeed
// ---------------------------------------------------------------------------
describe('canFeed', () => {
  it('null lastFedDay → true', () => {
    expect(canFeed(null, '2026-06-13')).toBe(true);
  });

  it('lastFedDay === today → false', () => {
    expect(canFeed('2026-06-13', '2026-06-13')).toBe(false);
  });

  it('lastFedDay is yesterday → true', () => {
    expect(canFeed('2026-06-12', '2026-06-13')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canUseHelper
// ---------------------------------------------------------------------------
describe('canUseHelper', () => {
  const today = '2026-06-13';

  // hint: unlockLevel 5
  it('hint: usedDay undefined, level 5 → true', () => {
    expect(canUseHelper(undefined, today, 5, 'hint')).toBe(true);
  });

  it('hint: usedDay undefined, level 4 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 4, 'hint')).toBe(false);
  });

  it('hint: usedDay === today, level 9 → false (already used today)', () => {
    expect(canUseHelper(today, today, 9, 'hint')).toBe(false);
  });

  it('hint: usedDay is yesterday, level 5 → true', () => {
    expect(canUseHelper('2026-06-12', today, 5, 'hint')).toBe(true);
  });

  // swap: unlockLevel 12
  it('swap: usedDay undefined, level 12 → true', () => {
    expect(canUseHelper(undefined, today, 12, 'swap')).toBe(true);
  });

  it('swap: usedDay undefined, level 11 → false (below unlock)', () => {
    expect(canUseHelper(undefined, today, 11, 'swap')).toBe(false);
  });
});
