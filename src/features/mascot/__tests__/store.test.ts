/**
 * TDD: store.test.ts — тест стора маскота до реализации.
 *
 * Перед каждым тестом:
 *  - состояние стора сбрасывается к дефолтам (фиксированный rngState=42)
 *  - KEYS.mascot очищается из MMKV
 */
import type { PlacementEvent } from '@/core/engine';
import { KEYS, getJSON } from '@/core/storage';
import { todayISO } from '@/features/streak';

import { useMascot } from '../store';

// xpToNext(1) = 40  → переход 1→2 при totalXp >= 40
// Level 2 reward: { kind: 'cosmetic', id: 'face-glasses' }
// Level 5 reward: { kind: 'helper', id: 'hint' }

const FIXED_RNG = 42;

/** Минимальный PlacementEvent, который читает rules.ts */
function makeEvent(
  overrides: Partial<
    Pick<PlacementEvent, 'clearedRows' | 'clearedCols' | 'combo' | 'boardCleared'>
  >,
): PlacementEvent {
  return {
    clearedRows: [],
    clearedCols: [],
    combo: 0,
    boardCleared: false,
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

const DEFAULTS = {
  totalXp: 0,
  level: 1,
  unlocked: ['hat-casquette'],
  equipped: {},
  lastFedDay: null,
  helpersUsedDay: {},
  lost: false,
  introDone: false,
  rngState: FIXED_RNG,
};

beforeEach(() => {
  // Сбросить стор к дефолтам с фиксированным rng (без replace=true, чтобы сохранить action-функции)
  useMascot.setState({ ...DEFAULTS, reveal: null });
  // Убедиться, что KEYS.mascot не содержит загрязнённых данных
  const { removeKey } = require('@/core/storage');
  removeKey(KEYS.mascot);
});

// ---------------------------------------------------------------------------
// Дефолтные значения
// ---------------------------------------------------------------------------
describe('defaults', () => {
  it('totalXp=0, level=1, lost=false, introDone=false, unlocked=level 1 reward', () => {
    const s = useMascot.getState();
    expect(s.totalXp).toBe(0);
    expect(s.level).toBe(1);
    expect(s.lost).toBe(false);
    expect(s.introDone).toBe(false);
    expect(s.unlocked).toEqual(['hat-casquette']);
    expect(s.lastFedDay).toBeNull();
    expect(s.helpersUsedDay).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// applyEvent
// ---------------------------------------------------------------------------
describe('applyEvent', () => {
  it('event с isRecord=true и 1 линией → 53 XP, уровень > 1, rewards содержит косметику', () => {
    // xpFromEvent: 1 линия * 3 + 50 (record) = 53
    // xpToNext(1) = 40 → новый level = 2
    // rewardForLevel(2) = { kind: 'cosmetic', id: 'face-glasses' }
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    const result = useMascot.getState().applyEvent(e, true);

    expect(result.leveledTo).toBe(2);
    expect(result.rewards).toHaveLength(1);
    expect(result.rewards[0]).toEqual({ kind: 'cosmetic', id: 'face-glasses' });

    const s = useMascot.getState();
    expect(s.totalXp).toBe(53);
    expect(s.level).toBe(2);
    expect(s.unlocked).toContain('face-glasses');
  });

  it('повторный applyEvent не дублирует id косметики в unlocked', () => {
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    useMascot.getState().applyEvent(e, true); // +53 XP → level 2
    useMascot.getState().applyEvent(e, true); // +53 XP → 106 XP → но level 2 reward уже в unlocked

    const s = useMascot.getState();
    const count = s.unlocked.filter((id) => id === 'face-glasses').length;
    expect(count).toBe(1);
  });

  it('событие без линий и без record → 0 XP, уровень не меняется', () => {
    const e = makeEvent({});
    const result = useMascot.getState().applyEvent(e, false);

    expect(result.leveledTo).toBe(1);
    expect(result.rewards).toEqual([]);
    expect(useMascot.getState().totalXp).toBe(0);
  });

  it('applyEvent персистит новое состояние', () => {
    const e = makeEvent({ clearedRows: [0], combo: 1 });
    useMascot.getState().applyEvent(e, true);

    const saved = getJSON<{ totalXp: number }>(KEYS.mascot);
    expect(saved).not.toBeNull();
    expect(saved!.totalXp).toBe(53);
  });
});

// ---------------------------------------------------------------------------
// feed
// ---------------------------------------------------------------------------
describe('feed', () => {
  it('первый вызов добавляет dailyFeed XP и устанавливает lastFedDay', () => {
    // dailyFeed = 40 XP → level 1→2 (xpToNext(1)=40 → достигает 40 → level 2)
    const result = useMascot.getState().feed();

    expect(result).not.toBeNull();
    const s = useMascot.getState();
    expect(s.totalXp).toBe(40);
    expect(s.lastFedDay).toBe(todayISO());
  });

  it('второй feed() в тот же день возвращает null', () => {
    useMascot.getState().feed();
    const result2 = useMascot.getState().feed();
    expect(result2).toBeNull();
  });

  it('после установки lastFedDay на прошлый день feed() снова успешен', () => {
    useMascot.setState({ lastFedDay: '2000-01-01' });
    const result = useMascot.getState().feed();

    expect(result).not.toBeNull();
    expect(useMascot.getState().lastFedDay).toBe(todayISO());
  });

  it('feed() персистит состояние', () => {
    useMascot.getState().feed();

    const saved = getJSON<{ lastFedDay: string; totalXp: number }>(KEYS.mascot);
    expect(saved).not.toBeNull();
    expect(saved!.lastFedDay).toBe(todayISO());
    expect(saved!.totalXp).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// useHelper
// ---------------------------------------------------------------------------
describe('useHelper', () => {
  it("hint: возвращает false при level < 5", () => {
    useMascot.setState({ level: 4 });
    expect(useMascot.getState().useHelper('hint')).toBe(false);
  });

  it('hint: возвращает true при level=5 и ещё не использовался сегодня', () => {
    useMascot.setState({ level: 5 });
    expect(useMascot.getState().useHelper('hint')).toBe(true);
  });

  it('hint: второй вызов в тот же день возвращает false', () => {
    useMascot.setState({ level: 5 });
    useMascot.getState().useHelper('hint');
    expect(useMascot.getState().useHelper('hint')).toBe(false);
  });

  it('swap: false при level=11', () => {
    useMascot.setState({ level: 11 });
    expect(useMascot.getState().useHelper('swap')).toBe(false);
  });

  it('swap: true при level=12', () => {
    useMascot.setState({ level: 12 });
    expect(useMascot.getState().useHelper('swap')).toBe(true);
  });

  it('useHelper персистит helpersUsedDay', () => {
    useMascot.setState({ level: 5 });
    useMascot.getState().useHelper('hint');

    const saved = getJSON<{ helpersUsedDay: Record<string, string> }>(KEYS.mascot);
    expect(saved!.helpersUsedDay['hint']).toBe(todayISO());
  });
});

// ---------------------------------------------------------------------------
// drop / recover
// ---------------------------------------------------------------------------
describe('drop / recover', () => {
  it('drop() устанавливает lost=true', () => {
    useMascot.getState().drop();
    expect(useMascot.getState().lost).toBe(true);
  });

  it('recover() устанавливает lost=false после drop()', () => {
    useMascot.getState().drop();
    useMascot.getState().recover();
    expect(useMascot.getState().lost).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// equip
// ---------------------------------------------------------------------------
describe('equip', () => {
  it('equip игнорируется если id не в unlocked', () => {
    useMascot.getState().equip('hat', 'hat-panama');
    expect(useMascot.getState().equipped['hat']).toBeUndefined();
  });

  it('equip работает если id в unlocked', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');
    expect(useMascot.getState().equipped['hat']).toBe('hat-casquette');
  });

  it('equip персистит equipped', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');

    const saved = getJSON<{ equipped: Record<string, string> }>(KEYS.mascot);
    expect(saved!.equipped['hat']).toBe('hat-casquette');
  });
});

// ---------------------------------------------------------------------------
// unequip
// ---------------------------------------------------------------------------
describe('unequip', () => {
  it('unequip очищает слот после equip', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');
    expect(useMascot.getState().equipped['hat']).toBe('hat-casquette');

    useMascot.getState().unequip('hat');
    expect(useMascot.getState().equipped['hat']).toBeUndefined();
  });

  it('unequip персистит изменение', () => {
    useMascot.setState({ unlocked: ['hat-casquette'] });
    useMascot.getState().equip('hat', 'hat-casquette');
    useMascot.getState().unequip('hat');

    const saved = getJSON<{ equipped: Record<string, string> }>(KEYS.mascot);
    expect(saved!.equipped['hat']).toBeUndefined();
  });

  it('unequip незанятого слота безопасен', () => {
    expect(() => useMascot.getState().unequip('hat')).not.toThrow();
    expect(useMascot.getState().equipped['hat']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// markIntroDone
// ---------------------------------------------------------------------------
describe('markIntroDone', () => {
  it('устанавливает introDone=true и персистит', () => {
    useMascot.getState().markIntroDone();
    expect(useMascot.getState().introDone).toBe(true);

    const saved = getJSON<{ introDone: boolean }>(KEYS.mascot);
    expect(saved!.introDone).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// bumpRng
// ---------------------------------------------------------------------------
describe('bumpRng', () => {
  it('обновляет rngState и персистит', () => {
    useMascot.getState().bumpRng(99999);
    expect(useMascot.getState().rngState).toBe(99999);

    const saved = getJSON<{ rngState: number }>(KEYS.mascot);
    expect(saved!.rngState).toBe(99999);
  });
});

// ---------------------------------------------------------------------------
// Общий тест персиста: после любой мутации getJSON отражает новое значение
// ---------------------------------------------------------------------------
describe('persistence', () => {
  it('после drop() getJSON(KEYS.mascot).lost===true', () => {
    useMascot.getState().drop();
    const saved = getJSON<{ lost: boolean }>(KEYS.mascot);
    expect(saved!.lost).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// reveal: transient level-up payload (NOT persisted)
// ---------------------------------------------------------------------------
describe('reveal', () => {
  it('applyEvent с левел-апом устанавливает reveal с правильным level и rewards', () => {
    // +53 XP (1 линия + record bonus) → level 1→2, reward: { kind:'cosmetic', id:'face-glasses' }
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    useMascot.getState().applyEvent(e, true);

    const s = useMascot.getState();
    expect(s.reveal).not.toBeNull();
    expect(s.reveal!.level).toBe(2);
    expect(s.reveal!.rewards).toHaveLength(1);
    expect(s.reveal!.rewards[0]).toEqual({ kind: 'cosmetic', id: 'face-glasses' });
  });

  it('applyEvent без левел-апа НЕ устанавливает reveal', () => {
    // Событие без линий и без record → 0 XP, уровень не меняется
    const e = makeEvent({});
    useMascot.getState().applyEvent(e, false);

    expect(useMascot.getState().reveal).toBeNull();
  });

  it('feed() с левел-апом устанавливает reveal', () => {
    // dailyFeed = 40 XP → level 1→2
    const result = useMascot.getState().feed();
    expect(result).not.toBeNull();

    const s = useMascot.getState();
    expect(s.reveal).not.toBeNull();
    expect(s.reveal!.level).toBe(2);
  });

  it('clearReveal() устанавливает reveal в null', () => {
    // Сначала вызовем левел-ап, чтобы reveal был не null
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    useMascot.getState().applyEvent(e, true);
    expect(useMascot.getState().reveal).not.toBeNull();

    useMascot.getState().clearReveal();
    expect(useMascot.getState().reveal).toBeNull();
  });

  it('reveal НЕ записывается в MMKV (не персистится)', () => {
    const e = makeEvent({ clearedRows: [0], clearedCols: [], combo: 1 });
    useMascot.getState().applyEvent(e, true);

    const saved = getJSON<{ reveal?: unknown }>(KEYS.mascot);
    expect(saved).not.toBeNull();
    expect(saved!.reveal).toBeUndefined();
  });
});
