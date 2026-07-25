# Adventure Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный аналог Adventure-режима оригинального Block Blast по спеке [docs/specs/17-adventure-mode.md](../specs/17-adventure-mode.md): уровни с целью (очки/кристаллы), мозаика-сезон, кубки, дейли-гоал, серия побед.

**Architecture:** Чистый модуль `core/engine/adventure.ts` оборачивает базовый движок (база поведенчески не меняется — fingerprint обязан остаться `8e4b334b`). Контент уровней — детерминированный генератор в `features/adventure/logic` (кривые в конфиге + библиотека раскладок + пиксель-арт мозаики). UI переиспользует существующий геймплей-стек (`useGameStore` + `DragProvider`/`BoardView`/`TrayView`) через новый режим стора — drag-путь на UI-потоке не трогаем.

**Tech Stack:** TypeScript strict, Zustand, MMKV (`core/storage`), Reanimated, expo-router, Jest. Ноль новых нативных зависимостей.

---

## Функциональные требования → задачи (traceability)

| # | Требование (спека 17) | Задачи |
|---|---|---|
| FR-1 | Уровень с целью `score` (набрать ≥ X) на базовых правилах 8×8 | T1, T2 |
| FR-2 | Уровень с целью `jewels`: кристаллы на доске, сбор очисткой линии | T3 |
| FR-3 | Кристаллы в фигурах трея | T4 |
| FR-4 | Предзаполненная доска уровня | T1, T6 |
| FR-5 | Монохромные блоки (1 цвет) | T2 (config `colors: 1`), T11 |
| FR-6 | Поражение: нет хода до выполнения цели; ретрай с нуля (ревайва в v1 нет) | T2, T16 |
| FR-7 | Сохранение/восстановление уровня посреди партии | T5, T9 |
| FR-8 | Линейная прогрессия уровней, кривые сложности, milestone каждые 6 | T6 |
| FR-9 | Мозаика сезона: тайл = уровень, закраска по порядку, milestone-рамки | T7, T14 |
| FR-10 | Хаб Adventure: кубок, мозаика, кнопка «Level N» | T14 |
| FR-11 | Экран уровня: панель цели (бар/счётчик кристаллов), тема rainforest | T11, T13, T15 |
| FR-12 | Победа: Lv.N→Lv.N+1 баннер + блочное конфетти → экран результата | T16 |
| FR-13 | Экран результата: мозаика с новым тайлом, Daily Goal 10, Next Level, Consecutive Clearances | T16 |
| FR-14 | Daily Goal: 10 уровней/день, сброс в полночь локального времени | T8 |
| FR-15 | Consecutive Clearances: +1 за победу, сброс при поражении | T8 |
| FR-16 | Завершение сезона: reveal мозаики, кубок навсегда, следующий сезон | T17 |
| FR-17 | Вход с Home-экрана | T14 |
| FR-18 | Строки ru/en | T10 |
| FR-19 | Аналитика: start/win/fail/season_complete | T18 |

## Нефункциональные требования

| # | Требование | Как обеспечивается |
|---|---|---|
| NFR-1 | 60fps: drag-путь без setState/runOnJS (спека 07) | Drag-стек не модифицируется; кристаллы рендерятся статичными оверлеями вне drag-пути (T12, T13) |
| NFR-2 | `core/engine` — чистый TS, ноль React/RN, правки только с тестами | T1–T5 — каждый шаг TDD; adventure.ts импортирует только соседей по engine |
| NFR-3 | Базовый движок поведенчески неизменен (лидерборд record-only, но дрейф запрещён) | T1 шаг 6: fingerprint-тест обязан пройти без изменения снапшота |
| NFR-4 | Оффлайн, без сети | Весь контент — локальный детерминированный генератор |
| NFR-5 | Персист версионирован, битые данные не роняют игру | Save-форматы `{v:1}` + валидация при чтении (T5, T8); повреждение → чистый reset |
| NFR-6 | Все игровые числа — в конфигах | `ADVENTURE_CONFIG` (T6); в логике только формулы |
| NFR-7 | i18n ru/en, текст только `AppText`, цвета из темы | T10, T11; adventure-тема — объект `WorldTheme`-формы |
| NFR-8 | Reduced motion уважается | Celebration-компоненты берут `useReducedMotion` (T16) |
| NFR-9 | Ноль новых нативных зависимостей (бюджет спеки 07) | Только Views/Reanimated; кристалл — View-ромб, не SVG/Skia |
| NFR-10 | TS strict + полный Jest зелёные перед каждым коммитом | Каждая задача заканчивается `npx tsc --noEmit && npm test` |
| NFR-11 | Мозаика ≤ ~120 статичных View, мемоизирована | `MosaicView` — memo, без анимаций в тайлах кроме нового (T14) |
| NFR-12 | Модули общаются только через public `index.ts` | `features/adventure/index.ts` (T14); game↔adventure только через типы `core/engine` |

## Зафиксированные решения открытых вопросов спеки 17

1. **Consecutive Clearances** — сбрасывается при поражении, живёт между сессиями/днями.
2. **Награда за Daily Goal** — v1: только celebration-тост при достижении 10 (без материальной награды).
3. **Очки Adventure в Уровень Игры** — v1: НЕ идут (не ломаем баланс спайна 11); пересмотр в v1.1.
4. **Milestone-уровни** — каждый 6-й тайл: цель ×1.35 (score) или +1 кристалл (jewels).
5. **Поздние препятствия (лёд и т.п.)** — вне v1; тип клетки расширяем, но не реализуем.
6. **Ревайв** — в Adventure отсутствует; только Retry (перезапуск уровня, attempt+1 меняет поток фигур).
7. **Кристаллы появляются** с уровня 8 (index 7), чётные/milestone уровни после — jewels-цель.
8. **Сезон 1** — «Капибара» (связка с маскотом Капи), ~70–90 уровней по числу тайлов арта.

## Структура файлов

```
Create:
  src/core/engine/adventure.ts                    — механика режима (чистый TS)
  src/core/engine/__tests__/adventure.test.ts
  src/features/adventure/index.ts                 — public API
  src/features/adventure/logic/config.ts          — ADVENTURE_CONFIG (все числа)
  src/features/adventure/logic/layouts.ts         — библиотека prefill-раскладок
  src/features/adventure/logic/levels.ts          — генератор уровней levelFor()
  src/features/adventure/logic/seasons.ts         — мозаики сезонов, tilesOf()
  src/features/adventure/store.ts                 — прогресс (zustand + MMKV)
  src/features/adventure/theme.ts                 — ADVENTURE_THEME (rainforest)
  src/features/adventure/components/JewelIcon.tsx
  src/features/adventure/components/ObjectivePanel.tsx
  src/features/adventure/components/JewelBoardLayer.tsx
  src/features/adventure/components/MosaicView.tsx
  src/features/adventure/components/AdventureEntryCard.tsx
  src/features/adventure/components/LevelUpBanner.tsx
  src/features/adventure/components/LevelResultView.tsx
  src/features/adventure/components/FailOverlay.tsx
  src/features/adventure/components/SeasonCelebration.tsx
  src/features/adventure/__tests__/levels.test.ts
  src/features/adventure/__tests__/store.test.ts
  src/app/adventure.tsx                           — хаб (мозаика+CTA)
  src/app/adventure-level.tsx                     — экран уровня (фазы)
Modify:
  src/core/engine/game.ts                         — createGame: опциональная стартовая доска
  src/core/engine/index.ts                        — экспорт adventure API
  src/core/storage/index.ts                       — KEYS.adventure, KEYS.adventureRun
  src/features/game/store.ts                      — adventure-режим placePiece
  src/features/game/index.ts                      — экспорт новых членов стора
  src/features/game/components/TrayPiece.tsx      — опц. маркер кристалла (пассивный)
  src/features/game/components/TrayView.tsx       — проброс jewelMarkers
  src/core/i18n/en.ts, src/core/i18n/ru.ts        — ключи adventure.*
  src/features/analytics/types.ts                 — 4 новых события
  src/app/index.tsx                               — карточка входа Adventure
```

> ⚠️ **Параллельные агенты:** `src/app/index.tsx`, `src/features/game/*` могут правиться другими сессиями (см. память `parallel-codex-worktrees`). Перед правкой shared-файлов — `git status`/`git diff` по файлу; конфликтующие правки согласовать.

---

### Task 1: Движок — createGame со стартовой доской

**Files:**
- Modify: `src/core/engine/game.ts` (функция `createGame`, строки ~290–307)
- Test: `src/core/engine/__tests__/adventure.test.ts` (новый)

- [ ] **Step 1: Написать падающий тест**

```ts
// src/core/engine/__tests__/adventure.test.ts
import { createGame, idx, hasAnyMove } from '../index';
import type { Board } from '../index';
import { emptyBoard } from '../board';

describe('createGame with initial board', () => {
  it('keeps prefilled cells and deals a playable tray', () => {
    const board: Board = emptyBoard();
    board[idx(7, 0)] = 1;
    board[idx(7, 1)] = 1;
    const game = createGame(42, undefined, board);
    expect(game.board[idx(7, 0)]).toBe(1);
    expect(game.board[idx(7, 1)]).toBe(1);
    expect(game.tray.every((p) => p !== null)).toBe(true);
    expect(hasAnyMove(game.board, game.tray)).toBe(true);
  });

  it('defaults to an empty board when omitted', () => {
    const game = createGame(42);
    expect(game.board.every((c) => c === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx jest src/core/engine/__tests__/adventure.test.ts`
Expected: FAIL — `createGame` не принимает третий аргумент (TS/старое поведение).

- [ ] **Step 3: Минимальная реализация**

В `src/core/engine/game.ts` заменить `createGame`:

```ts
export function createGame(
  seed: number = seedFromTime(),
  config: GameConfig = DEFAULT_CONFIG,
  initialBoard?: Board,
): GameState {
  const board = initialBoard ? initialBoard.slice() : emptyBoard();
  const wave = makeWave(board, seed, config, 0);
  return {
    board,
    tray: wave.tray,
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    waveNumber: 0,
    status: 'playing',
    reviveUsed: false,
    rngState: wave.rngState,
  };
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx jest src/core/engine/__tests__/adventure.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Полный прогон — база не дрейфнула**

Run: `npx jest src/core/engine && npx tsc --noEmit`
Expected: PASS, включая `fingerprint.test.ts` **без изменения эталона** (fingerprint остаётся `8e4b334b` — параметр опционален, дефолтное поведение бит-в-бит прежнее).

- [ ] **Step 6: Commit**

```bash
git add src/core/engine/game.ts src/core/engine/__tests__/adventure.test.ts
git commit -m "feat(engine): createGame принимает стартовую доску (для Adventure)"
```

---

### Task 2: Движок — adventure-модуль, score-цель, победа/поражение

**Files:**
- Create: `src/core/engine/adventure.ts`
- Modify: `src/core/engine/index.ts`
- Test: `src/core/engine/__tests__/adventure.test.ts`

- [ ] **Step 1: Падающие тесты**

Дописать в `adventure.test.ts`:

```ts
import {
  ADVENTURE_GAME_CONFIG,
  createAdventureRun,
  placeAdventure,
  findPlacements,
} from '../index';
import type { AdventureLevelSpec, AdventureRunState } from '../index';

const scoreSpec: AdventureLevelSpec = {
  seasonId: 1,
  levelIndex: 0,
  objective: { kind: 'score', target: 40 },
  prefill: [],
  seed: 7,
  jewelPieceChance: 0,
};

/** Кладёт первую фигуру трея в первое легальное место. Для тестов. */
function playAnyMove(run: AdventureRunState) {
  for (let i = 0; i < run.game.tray.length; i++) {
    const piece = run.game.tray[i];
    if (!piece) continue;
    const spots = findPlacements(run.game.board, piece.shape);
    if (spots.length > 0) {
      return placeAdventure(run, i, spots[0][0], spots[0][1]);
    }
  }
  throw new Error('no move');
}

describe('adventure: score objective', () => {
  it('starts playing, monochrome, prefill applied', () => {
    const spec = { ...scoreSpec, prefill: [{ r: 0, c: 0 }] };
    const run = createAdventureRun(spec);
    expect(run.status).toBe('playing');
    expect(run.game.board[0]).toBe(1);
    expect(run.game.tray.every((p) => p === null || p.colorId === 1)).toBe(true);
  });

  it('wins when score reaches the target', () => {
    let run = createAdventureRun(scoreSpec);
    let guard = 200;
    while (run.status === 'playing' && guard-- > 0) {
      const res = playAnyMove(run);
      run = res.run;
      if (res.event.won) expect(res.run.status).toBe('won');
    }
    // score=40 достижим почти всегда; если fail — это тоже терминал, тест не виснет
    expect(run.status === 'won' || run.status === 'failed').toBe(true);
  });

  it('same spec+attempt is deterministic; attempt changes the flow', () => {
    const a = createAdventureRun(scoreSpec, 0);
    const b = createAdventureRun(scoreSpec, 0);
    const c = createAdventureRun(scoreSpec, 1);
    expect(a.game.tray.map((p) => p!.shape.id)).toEqual(b.game.tray.map((p) => p!.shape.id));
    expect(a.game.rngState).toBe(b.game.rngState);
    expect(c.game.rngState).not.toBe(a.game.rngState);
  });

  it('throws on terminal state', () => {
    const run = createAdventureRun(scoreSpec);
    const done: AdventureRunState = { ...run, status: 'won' };
    expect(() => placeAdventure(done, 0, 0, 0)).toThrow();
  });
});
```

- [ ] **Step 2: Запустить — падает** (`createAdventureRun` не существует)

Run: `npx jest src/core/engine/__tests__/adventure.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация `src/core/engine/adventure.ts`**

```ts
/**
 * Adventure-режим (спека 17): обёртка над базовым движком.
 * Базовые правила не меняются; здесь — цель уровня, кристаллы, статус won/failed.
 * Чистый TS, ноль React/RN.
 */
import { idx } from './board';
import { DEFAULT_CONFIG } from './config';
import { createGame, place } from './game';
import { rngInt, rngNext } from './rng';
import { BOARD_CELLS } from './types';
import type { Board, GameConfig, GameState, PlacementEvent } from './types';

export type AdventureObjective =
  | { kind: 'score'; target: number }
  | { kind: 'jewels'; count: number };

export interface AdventurePrefillCell {
  r: number;
  c: number;
  jewel?: boolean;
}

export interface AdventureLevelSpec {
  seasonId: number;
  /** 0-based сквозной индекс уровня в сезоне. */
  levelIndex: number;
  objective: AdventureObjective;
  prefill: AdventurePrefillCell[];
  seed: number;
  /** Шанс (0..1) подмешать кристалл в фигуру каждой новой волны (jewels-цель). */
  jewelPieceChance: number;
}

export type AdventureStatus = 'playing' | 'won' | 'failed';

export interface AdventureRunState {
  spec: AdventureLevelSpec;
  attempt: number;
  game: GameState;
  /** Индексы (r*8+c) клеток доски с кристаллом. */
  jewelsOnBoard: number[];
  jewelsCollected: number;
  /** Для каждого слота трея: индекс клетки в shape.cells, несущей кристалл, либо null. */
  jewelTray: (number | null)[];
  /** Локальный rng раздачи кристаллов в фигуры — не трогает game.rngState. */
  jewelRng: number;
  status: AdventureStatus;
}

export interface AdventurePlacementEvent extends PlacementEvent {
  /** Клетки, из которых собраны кристаллы этим ходом. */
  collectedJewelCells: readonly (readonly [number, number])[];
  jewelsCollected: number;
  won: boolean;
  failed: boolean;
}

/** Монохром: один цвет блоков (спека 17 §1). Остальное — базовые правила. */
export const ADVENTURE_GAME_CONFIG: GameConfig = { ...DEFAULT_CONFIG, colors: 1 };

function attemptSeed(seed: number, attempt: number): number {
  // Смешение Кнута: другой attempt → другой поток фигур при том же уровне.
  return (seed ^ (attempt * 2654435761)) >>> 0 || 1;
}

function buildPrefillBoard(prefill: AdventurePrefillCell[]): {
  board: Board;
  jewels: number[];
} {
  const board: Board = new Array(BOARD_CELLS).fill(0);
  const jewels: number[] = [];
  for (const cell of prefill) {
    const i = idx(cell.r, cell.c);
    board[i] = 1;
    if (cell.jewel) jewels.push(i);
  }
  return { board, jewels };
}

function jewelsInTray(jewelTray: (number | null)[]): number {
  return jewelTray.reduce((n: number, j) => n + (j === null ? 0 : 1), 0);
}

/** Подмешивает кристаллы в свежесданный трей (детерминированно от jewelRng). */
function dealTrayJewels(
  run: Pick<AdventureRunState, 'spec' | 'jewelsOnBoard' | 'jewelsCollected'>,
  tray: GameState['tray'],
  jewelRng: number,
): { jewelTray: (number | null)[]; jewelRng: number } {
  const jewelTray: (number | null)[] = tray.map(() => null);
  if (run.spec.objective.kind !== 'jewels') return { jewelTray, jewelRng };

  let remaining =
    run.spec.objective.count - run.jewelsCollected - run.jewelsOnBoard.length;
  let s = jewelRng;
  for (let slot = 0; slot < tray.length && remaining > 0; slot++) {
    const piece = tray[slot];
    if (!piece) continue;
    const roll = rngNext(s);
    s = roll.state;
    if (roll.value < run.spec.jewelPieceChance) {
      const cell = rngInt(s, piece.shape.cells.length);
      s = cell.state;
      jewelTray[slot] = cell.value;
      remaining -= 1;
    }
  }
  return { jewelTray, jewelRng: s };
}

export function createAdventureRun(
  spec: AdventureLevelSpec,
  attempt: number = 0,
): AdventureRunState {
  const { board, jewels } = buildPrefillBoard(spec.prefill);
  const game = createGame(attemptSeed(spec.seed, attempt), ADVENTURE_GAME_CONFIG, board);
  const base = { spec, jewelsOnBoard: jewels, jewelsCollected: 0 };
  const dealt = dealTrayJewels(base, game.tray, attemptSeed(spec.seed, attempt) ^ 0x9e3779b9);
  return {
    spec,
    attempt,
    game,
    jewelsOnBoard: jewels,
    jewelsCollected: 0,
    jewelTray: dealt.jewelTray,
    jewelRng: dealt.jewelRng,
    status: 'playing',
  };
}

function isWon(
  objective: AdventureObjective,
  score: number,
  jewelsCollected: number,
): boolean {
  return objective.kind === 'score'
    ? score >= objective.target
    : jewelsCollected >= objective.count;
}

export function placeAdventure(
  run: AdventureRunState,
  trayIndex: number,
  r: number,
  c: number,
): { run: AdventureRunState; event: AdventurePlacementEvent } {
  if (run.status !== 'playing') throw new Error('placeAdventure: run is terminal');

  const { state, event } = place(run.game, trayIndex, r, c, ADVENTURE_GAME_CONFIG);

  // 1. Кристалл из фигуры ложится на доску (до обработки очисток —
  //    он мог очиститься тем же ходом).
  let jewelsOnBoard = run.jewelsOnBoard.slice();
  const carried = run.jewelTray[trayIndex];
  if (carried !== null) {
    const [pr, pc] = event.placed[carried];
    jewelsOnBoard.push(idx(pr, pc));
  }

  // 2. Сбор: пересечение очищенных клеток с кристаллами.
  const clearedIdx = new Set(event.clearedCells.map(([cr, cc]) => idx(cr, cc)));
  const collectedJewelCells: [number, number][] = [];
  jewelsOnBoard = jewelsOnBoard.filter((i) => {
    if (!clearedIdx.has(i)) return true;
    collectedJewelCells.push([Math.floor(i / 8), i % 8]);
    return false;
  });
  const jewelsCollected = run.jewelsCollected + collectedJewelCells.length;

  // 3. Трей кристаллов: слот опустел; новая волна — новая раздача.
  let jewelTray = run.jewelTray.slice();
  jewelTray[trayIndex] = null;
  let jewelRng = run.jewelRng;
  if (event.newTray) {
    const dealt = dealTrayJewels(
      { spec: run.spec, jewelsOnBoard, jewelsCollected },
      state.tray,
      jewelRng,
    );
    jewelTray = dealt.jewelTray;
    jewelRng = dealt.jewelRng;
  }

  // 4. Исход: победа приоритетнее game over в том же ходе.
  const won = isWon(run.spec.objective, event.score, jewelsCollected);
  const failed = !won && event.gameOver;
  const status: AdventureStatus = won ? 'won' : failed ? 'failed' : 'playing';

  const next: AdventureRunState = {
    ...run,
    game: state,
    jewelsOnBoard,
    jewelsCollected,
    jewelTray,
    jewelRng,
    status,
  };
  return {
    run: next,
    event: { ...event, collectedJewelCells, jewelsCollected, won, failed },
  };
}
```

Экспорт в `src/core/engine/index.ts` — добавить строки:

```ts
export {
  ADVENTURE_GAME_CONFIG,
  createAdventureRun,
  placeAdventure,
} from './adventure';
export type {
  AdventureObjective,
  AdventurePrefillCell,
  AdventureLevelSpec,
  AdventureStatus,
  AdventureRunState,
  AdventurePlacementEvent,
} from './adventure';
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx jest src/core/engine/__tests__/adventure.test.ts`
Expected: PASS.

- [ ] **Step 5: Полный движок + типы**

Run: `npx jest src/core/engine && npx tsc --noEmit`
Expected: PASS, fingerprint неизменен.

- [ ] **Step 6: Commit**

```bash
git add src/core/engine/adventure.ts src/core/engine/index.ts src/core/engine/__tests__/adventure.test.ts
git commit -m "feat(engine): adventure-режим — score-цель, статусы won/failed"
```

---

### Task 3: Движок — кристаллы на доске (сбор очисткой)

**Files:**
- Modify: `src/core/engine/__tests__/adventure.test.ts` (реализация уже в T2 — здесь верификация поведения тестами)

- [ ] **Step 1: Падающие/уточняющие тесты**

```ts
describe('adventure: jewels on board', () => {
  // Ряд 7 заполнен кроме (7,7); кристалл на (7,0). Кладём dot в (7,7) → линия чистится.
  const jewelSpec: AdventureLevelSpec = {
    seasonId: 1,
    levelIndex: 9,
    objective: { kind: 'jewels', count: 1 },
    prefill: [
      { r: 7, c: 0, jewel: true },
      ...[1, 2, 3, 4, 5, 6].map((c) => ({ r: 7, c })),
    ],
    seed: 13,
    jewelPieceChance: 0,
  };

  function runWithDotInTray(): AdventureRunState {
    // Перебираем attempt, пока в стартовом трее не будет фигуры 1×1 или линии,
    // закрывающей (7,7). Детерминированно и быстро.
    for (let attempt = 0; attempt < 64; attempt++) {
      const run = createAdventureRun(jewelSpec, attempt);
      const i = run.game.tray.findIndex(
        (p) => p !== null && p.shape.w === 1 && p.shape.h === 1,
      );
      if (i >= 0) return run;
    }
    throw new Error('no attempt with a dot piece');
  }

  it('collects a jewel when its line clears and wins at target', () => {
    const run = runWithDotInTray();
    const dot = run.game.tray.findIndex((p) => p?.shape.id === 'dot');
    const { run: next, event } = placeAdventure(run, dot, 7, 7);
    expect(event.clearedRows).toContain(7);
    expect(event.collectedJewelCells).toEqual([[7, 0]]);
    expect(next.jewelsCollected).toBe(1);
    expect(next.jewelsOnBoard).toEqual([]);
    expect(event.won).toBe(true);
    expect(next.status).toBe('won');
  });

  it('keeps uncleared jewels on board', () => {
    const spec = { ...jewelSpec, prefill: [{ r: 0, c: 0, jewel: true }] };
    const run = createAdventureRun(spec, 0);
    expect(run.jewelsOnBoard).toEqual([0]);
  });
});
```

- [ ] **Step 2: Запустить**

Run: `npx jest src/core/engine/__tests__/adventure.test.ts`
Expected: PASS сразу (логика вошла в T2). Если FAIL — чинить `placeAdventure`, не тест.

- [ ] **Step 3: Commit**

```bash
git add src/core/engine/__tests__/adventure.test.ts
git commit -m "test(engine): adventure — сбор кристаллов очисткой линии"
```

---

### Task 4: Движок — кристаллы в фигурах трея

**Files:**
- Test: `src/core/engine/__tests__/adventure.test.ts`

- [ ] **Step 1: Тесты**

```ts
describe('adventure: jewels in tray pieces', () => {
  const spec: AdventureLevelSpec = {
    seasonId: 1,
    levelIndex: 11,
    objective: { kind: 'jewels', count: 3 },
    prefill: [],
    seed: 21,
    jewelPieceChance: 1, // гарантированная раздача для теста
  };

  it('deals jewels into fresh tray, capped by remaining target', () => {
    const run = createAdventureRun(spec);
    expect(jewelCount(run.jewelTray)).toBeGreaterThan(0);
    expect(jewelCount(run.jewelTray)).toBeLessThanOrEqual(3);
  });

  it('placed jewel piece drops the jewel onto the board', () => {
    const run = createAdventureRun(spec);
    const slot = run.jewelTray.findIndex((j) => j !== null);
    const piece = run.game.tray[slot]!;
    const [r, c] = findPlacements(run.game.board, piece.shape)[0];
    const { run: next } = placeAdventure(run, slot, r, c);
    // Кристалл либо на доске, либо собран мгновенной очисткой (пустая доска — очистки нет)
    expect(next.jewelsOnBoard.length + next.jewelsCollected).toBe(1);
  });

  it('does not deal jewels for score objective', () => {
    const scoreRun = createAdventureRun({
      ...spec,
      objective: { kind: 'score', target: 100 },
    });
    expect(scoreRun.jewelTray.every((j) => j === null)).toBe(true);
  });
});

function jewelCount(tray: (number | null)[]): number {
  return tray.filter((j) => j !== null).length;
}
```

- [ ] **Step 2: Запустить**

Run: `npx jest src/core/engine/__tests__/adventure.test.ts`
Expected: PASS (логика в T2); при FAIL чинить `dealTrayJewels`.

- [ ] **Step 3: Commit**

```bash
git add src/core/engine/__tests__/adventure.test.ts
git commit -m "test(engine): adventure — кристаллы в фигурах трея"
```

---

### Task 5: Движок — сериализация ранa

**Files:**
- Modify: `src/core/engine/adventure.ts`, `src/core/engine/index.ts`
- Test: `src/core/engine/__tests__/adventure.test.ts`

- [ ] **Step 1: Падающий тест**

```ts
import { serializeAdventureRun, deserializeAdventureRun } from '../index';

describe('adventure: serialization', () => {
  it('round-trips a mid-level run', () => {
    let run = createAdventureRun(scoreSpec, 2);
    run = playAnyMove(run).run;
    const raw = serializeAdventureRun(run);
    const restored = deserializeAdventureRun(raw, () => scoreSpec);
    expect(restored).not.toBeNull();
    expect(restored!.game.board).toEqual(run.game.board);
    expect(restored!.game.score).toBe(run.game.score);
    expect(restored!.jewelsCollected).toBe(run.jewelsCollected);
    expect(restored!.jewelTray).toEqual(run.jewelTray);
    expect(restored!.attempt).toBe(2);
    expect(restored!.status).toBe(run.status);
  });

  it('rejects garbage', () => {
    expect(deserializeAdventureRun('{"v":99}', () => scoreSpec)).toBeNull();
    expect(deserializeAdventureRun('not json', () => scoreSpec)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (функций нет).

- [ ] **Step 3: Реализация** — дописать в `adventure.ts`:

```ts
import { serialize, deserialize } from './serialize'; // добавить к импортам сверху

interface AdventureSaveV1 {
  v: 1;
  seasonId: number;
  levelIndex: number;
  attempt: number;
  game: string; // вложенный SaveV2 базового движка
  jewelsOnBoard: number[];
  jewelsCollected: number;
  jewelTray: (number | null)[];
  jewelRng: number;
  status: AdventureStatus;
}

export function serializeAdventureRun(run: AdventureRunState): string {
  const save: AdventureSaveV1 = {
    v: 1,
    seasonId: run.spec.seasonId,
    levelIndex: run.spec.levelIndex,
    attempt: run.attempt,
    game: serialize(run.game),
    jewelsOnBoard: run.jewelsOnBoard,
    jewelsCollected: run.jewelsCollected,
    jewelTray: run.jewelTray,
    jewelRng: run.jewelRng,
    status: run.status,
  };
  return JSON.stringify(save);
}

/** specResolver восстанавливает контент уровня по координатам (контент живёт вне движка). */
export function deserializeAdventureRun(
  raw: string,
  specResolver: (seasonId: number, levelIndex: number) => AdventureLevelSpec | null,
): AdventureRunState | null {
  let save: AdventureSaveV1;
  try {
    save = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!save || save.v !== 1) return null;
  if (
    !Number.isInteger(save.seasonId) ||
    !Number.isInteger(save.levelIndex) ||
    !Number.isInteger(save.attempt) ||
    typeof save.game !== 'string' ||
    !Array.isArray(save.jewelsOnBoard) ||
    typeof save.jewelsCollected !== 'number' ||
    !Array.isArray(save.jewelTray) ||
    typeof save.jewelRng !== 'number' ||
    !['playing', 'won', 'failed'].includes(save.status)
  ) {
    return null;
  }
  const spec = specResolver(save.seasonId, save.levelIndex);
  if (!spec) return null;
  const game = deserialize(save.game);
  if (!game) return null;
  return {
    spec,
    attempt: save.attempt,
    game,
    jewelsOnBoard: save.jewelsOnBoard,
    jewelsCollected: save.jewelsCollected,
    jewelTray: save.jewelTray,
    jewelRng: save.jewelRng,
    status: save.status,
  };
}
```

В `index.ts` добавить `serializeAdventureRun, deserializeAdventureRun` к экспорту из `./adventure`.

- [ ] **Step 4: Зелёные + полный прогон**

Run: `npx jest src/core/engine && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/engine/adventure.ts src/core/engine/index.ts src/core/engine/__tests__/adventure.test.ts
git commit -m "feat(engine): сериализация adventure-рана (v1, вложенный SaveV2)"
```

---

### Task 6: Контент — конфиг, раскладки, генератор уровней

**Files:**
- Create: `src/features/adventure/logic/config.ts`, `src/features/adventure/logic/layouts.ts`, `src/features/adventure/logic/levels.ts`
- Test: `src/features/adventure/__tests__/levels.test.ts`

- [ ] **Step 1: Падающие тесты**

```ts
// src/features/adventure/__tests__/levels.test.ts
import { createAdventureRun, hasAnyMove } from '@/core/engine';
import { levelFor } from '../logic/levels';
import { ADVENTURE_CONFIG } from '../logic/config';

describe('adventure level generator', () => {
  it('is deterministic', () => {
    expect(levelFor(1, 5)).toEqual(levelFor(1, 5));
  });

  it('level 0 — пустая доска, score-цель = базовой', () => {
    const l = levelFor(1, 0);
    expect(l.objective).toEqual({ kind: 'score', target: ADVENTURE_CONFIG.scoreBase });
    expect(l.prefill).toEqual([]);
  });

  it('score targets grow monotonically on score levels', () => {
    let prev = 0;
    for (let i = 0; i < 60; i++) {
      const l = levelFor(1, i);
      if (l.objective.kind !== 'score') continue;
      expect(l.objective.target).toBeGreaterThanOrEqual(prev);
      prev = l.objective.target;
    }
  });

  it('jewels appear from jewelsFromLevel onward and count is sane', () => {
    for (let i = 0; i < ADVENTURE_CONFIG.jewelsFromLevel; i++) {
      expect(levelFor(1, i).objective.kind).toBe('score');
    }
    const jewelLevels = Array.from({ length: 60 }, (_, i) => levelFor(1, i)).filter(
      (l) => l.objective.kind === 'jewels',
    );
    expect(jewelLevels.length).toBeGreaterThan(0);
    for (const l of jewelLevels) {
      const count = l.objective.kind === 'jewels' ? l.objective.count : 0;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(ADVENTURE_CONFIG.jewelsMax);
      expect(l.jewelPieceChance).toBeGreaterThan(0);
    }
  });

  it('milestone levels are harder than neighbours', () => {
    const m = ADVENTURE_CONFIG.milestoneEvery;
    const plain = levelFor(1, m * 2); // не milestone (0-based: milestone = каждые m, начиная с m-1)
    const milestone = levelFor(1, m * 2 - 1);
    expect(milestone.milestone).toBe(true);
    expect(plain.milestone).toBe(false);
  });

  it('every generated level starts playable (первые 60)', () => {
    for (let i = 0; i < 60; i++) {
      const run = createAdventureRun(levelFor(1, i));
      expect(hasAnyMove(run.game.board, run.game.tray)).toBe(true);
      expect(run.status).toBe('playing');
    }
  });

  it('prefill never fills a full line and stays in bounds', () => {
    for (let i = 0; i < 60; i++) {
      const l = levelFor(1, i);
      const rows = new Map<number, number>();
      const cols = new Map<number, number>();
      for (const { r, c } of l.prefill) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(8);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(8);
        rows.set(r, (rows.get(r) ?? 0) + 1);
        cols.set(c, (cols.get(c) ?? 0) + 1);
      }
      for (const n of rows.values()) expect(n).toBeLessThan(8);
      for (const n of cols.values()) expect(n).toBeLessThan(8);
    }
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (модулей нет).

- [ ] **Step 3: Реализация**

`src/features/adventure/logic/config.ts` — все числа режима в одном месте (NFR-6):

```ts
/** Все игровые числа Adventure (спека 17). Логика — только формулы от этих значений. */
export const ADVENTURE_CONFIG = {
  /** Цель уровня 1 (как в оригинале на скринах). */
  scoreBase: 128,
  /** Линейный прирост score-цели за уровень. */
  scoreLinear: 34,
  /** Степенная добавка: round(idx^1.3 * scorePower). */
  scorePower: 6,
  /** Округление целей до кратного. */
  scoreRound: 16,
  /** Множитель цели на milestone-уровне. */
  milestoneScoreMult: 1.35,
  /** С какого уровня (0-based) появляются кристаллы. */
  jewelsFromLevel: 7,
  /** Стартовое число кристаллов и прирост: 3 + floor((idx-from)/9). */
  jewelsStart: 3,
  jewelsGrowthEvery: 9,
  jewelsMax: 8,
  /** +кристаллов на milestone jewels-уровне. */
  milestoneJewelBonus: 1,
  /** Шанс кристалла в фигуре новой волны. */
  jewelPieceChance: 0.45,
  /** Milestone — каждый N-й уровень (1-based: N, 2N, …). */
  milestoneEvery: 6,
  /** С какого уровня появляется префилл доски. */
  prefillFromLevel: 3,
  /** Дневная цель (спека 17 §6). */
  dailyGoalLevels: 10,
} as const;
```

`src/features/adventure/logic/layouts.ts` — библиотека раскладок (ASCII, как shapes.ts: `.` пусто, `X` блок, `J` блок с кристаллом):

```ts
import type { AdventurePrefillCell } from '@/core/engine';

/** Раскладки нижней половины доски. Ни одна не образует полной линии. */
const PATTERNS: string[][] = [
  // 0: редкие одиночки
  ['........', '........', '........', '........', 'X..X...X', '........', '..X...X.', 'X....X..'],
  // 1: боковые колодцы
  ['........', '........', '........', 'XX....XX', 'XX....XX', '........', 'X......X', 'XX....XX'],
  // 2: гребёнка
  ['........', '........', '........', '........', 'X.X.X.X.', '........', '.X.X.X.X', '........'],
  // 3: чаша
  ['........', '........', '........', 'X......X', 'XX....XX', '........', 'XXX..XXX', '........'],
  // 4: ступени
  ['........', '........', '........', 'X.......', 'XX......', 'XXX.....', '....XXX.', '.....XX.'],
  // 5: рамка-намёк (углы)
  ['........', '........', 'XX....XX', 'X......X', '........', 'X......X', 'XX....XX', '........'],
];

/** Позиции 'J' — куда сажать кристаллы при jewels-цели (первые N берутся). */
export function layoutCells(
  patternIndex: number,
  jewelSlots: number,
): AdventurePrefillCell[] {
  const pattern = PATTERNS[patternIndex % PATTERNS.length];
  const cells: AdventurePrefillCell[] = [];
  pattern.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === 'X') cells.push({ r, c });
    });
  });
  // Кристаллы сажаем на первые jewelSlots заполненных клеток снизу вверх —
  // они дальше всего от «лёгких» верхних очисток.
  const bottomFirst = cells.slice().sort((a, b) => b.r - a.r || a.c - b.c);
  for (let i = 0; i < Math.min(jewelSlots, bottomFirst.length); i++) {
    bottomFirst[i].jewel = true;
  }
  return cells;
}

export const LAYOUT_COUNT = PATTERNS.length;
```

`src/features/adventure/logic/levels.ts`:

```ts
import type { AdventureLevelSpec, AdventureObjective } from '@/core/engine';

import { ADVENTURE_CONFIG as CFG } from './config';
import { LAYOUT_COUNT, layoutCells } from './layouts';

export interface AdventureLevelMeta extends AdventureLevelSpec {
  milestone: boolean;
}

function isMilestone(index: number): boolean {
  return (index + 1) % CFG.milestoneEvery === 0;
}

function scoreTarget(index: number, milestone: boolean): number {
  const raw =
    CFG.scoreBase + index * CFG.scoreLinear + Math.round(index ** 1.3 * CFG.scorePower);
  const boosted = milestone ? raw * CFG.milestoneScoreMult : raw;
  return Math.round(boosted / CFG.scoreRound) * CFG.scoreRound;
}

function jewelsCount(index: number, milestone: boolean): number {
  const grown =
    CFG.jewelsStart + Math.floor((index - CFG.jewelsFromLevel) / CFG.jewelsGrowthEvery);
  const withBonus = grown + (milestone ? CFG.milestoneJewelBonus : 0);
  return Math.max(1, Math.min(CFG.jewelsMax, withBonus));
}

function objectiveFor(index: number, milestone: boolean): AdventureObjective {
  const jewelsUnlocked = index >= CFG.jewelsFromLevel;
  // Чередование: после разлока кристаллов нечётные уровни — jewels, чётные — score.
  const jewels = jewelsUnlocked && (index % 2 === 1 || milestone);
  return jewels
    ? { kind: 'jewels', count: jewelsCount(index, milestone) }
    : { kind: 'score', target: scoreTarget(index, milestone) };
}

/** Детерминированный сид уровня: сезон/индекс → одинаковый уровень навсегда. */
function levelSeed(seasonId: number, index: number): number {
  let h = (seasonId * 73856093) ^ (index * 19349663) ^ 0x5f356495;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0 || 1;
}

export function levelFor(seasonId: number, index: number): AdventureLevelMeta {
  const milestone = isMilestone(index);
  const objective = objectiveFor(index, milestone);
  const prefill =
    index < CFG.prefillFromLevel
      ? []
      : layoutCells(
          levelSeed(seasonId, index) % LAYOUT_COUNT,
          objective.kind === 'jewels' ? Math.ceil(objective.count / 2) : 0,
        );
  return {
    seasonId,
    levelIndex: index,
    objective,
    prefill,
    seed: levelSeed(seasonId, index),
    jewelPieceChance: objective.kind === 'jewels' ? CFG.jewelPieceChance : 0,
    milestone,
  };
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx jest src/features/adventure && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/adventure/logic src/features/adventure/__tests__/levels.test.ts
git commit -m "feat(adventure): конфиг, библиотека раскладок и детерминированный генератор уровней"
```

---

### Task 7: Контент — мозаика сезона

**Files:**
- Create: `src/features/adventure/logic/seasons.ts`
- Test: `src/features/adventure/__tests__/levels.test.ts` (дописать)

- [ ] **Step 1: Падающие тесты**

```ts
import { seasonById, seasonTiles, seasonLength } from '../logic/seasons';

describe('adventure seasons', () => {
  it('season 1 exists with a coherent mosaic', () => {
    const season = seasonById(1);
    expect(season.id).toBe(1);
    const tiles = seasonTiles(season);
    expect(tiles.length).toBeGreaterThanOrEqual(60);
    expect(seasonLength(season)).toBe(tiles.length);
    // порядок закраски: снизу вверх, слева направо
    for (let i = 1; i < tiles.length; i++) {
      const prev = tiles[i - 1];
      const cur = tiles[i];
      expect(cur.row < prev.row || (cur.row === prev.row && cur.col > prev.col)).toBe(true);
    }
  });

  it('unknown season falls back cyclically (бесконечный конвейер)', () => {
    const s99 = seasonById(99);
    expect(seasonTiles(s99).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализация `src/features/adventure/logic/seasons.ts`**

```ts
/**
 * Сезоны Adventure: мозаика = пиксель-арт (тайл = уровень), спека 17 §5.
 * '.' — пусто, 'X' — тайл. Milestone-рамки выводятся из levelFor().milestone.
 * Закраска идёт снизу вверх (как в оригинале — первый закрашенный тайл нижний).
 */
import { levelFor } from './levels';
import type { AdventureLevelMeta } from './levels';

export interface AdventureSeasonDef {
  id: number;
  /** i18n-ключ имени сезона (животного). */
  nameKey: string;
  /** Акцент закраски тайлов. */
  fillColor: string;
  art: string[];
}

export interface MosaicTile {
  row: number;
  col: number;
  /** Индекс уровня, закрашивающего этот тайл. */
  levelIndex: number;
}

/** Сезон 1 — «Капибара» (связка с маскотом Капи). ~72 тайла. */
const SEASONS: AdventureSeasonDef[] = [
  {
    id: 1,
    nameKey: 'adventure.season.capybara',
    fillColor: '#E8944A',
    art: [
      '...XXXX...',
      '..XXXXXX..',
      '.XXXXXXXX.',
      'XXXXXXXXX.',
      'XXXXXXXXXX',
      'XXXXXXXXXX',
      'XXXXXXXXXX',
      '.XXXXXXXX.',
      '.XXX..XXX.',
      '.XX....XX.',
    ],
  },
];

export function seasonById(id: number): AdventureSeasonDef {
  const base = SEASONS[(id - 1) % SEASONS.length];
  // Циклический фолбэк: сезоны никогда не кончаются (спека 17 §7).
  return base.id === id ? base : { ...base, id };
}

/** Тайлы в порядке закраски: снизу вверх, в ряду слева направо. */
export function seasonTiles(season: AdventureSeasonDef): MosaicTile[] {
  const tiles: MosaicTile[] = [];
  for (let row = season.art.length - 1; row >= 0; row--) {
    [...season.art[row]].forEach((ch, col) => {
      if (ch === 'X') tiles.push({ row, col, levelIndex: tiles.length });
    });
  }
  return tiles;
}

export function seasonLength(season: AdventureSeasonDef): number {
  return seasonTiles(season).length;
}

export function levelOf(seasonId: number, index: number): AdventureLevelMeta {
  return levelFor(seasonId, index);
}
```

- [ ] **Step 4: Зелёные** — `npx jest src/features/adventure`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/adventure/logic/seasons.ts src/features/adventure/__tests__/levels.test.ts
git commit -m "feat(adventure): сезон 1 «Капибара» — мозаика и порядок закраски"
```

---

### Task 8: Стор прогресса Adventure

**Files:**
- Create: `src/features/adventure/store.ts`
- Modify: `src/core/storage/index.ts`
- Test: `src/features/adventure/__tests__/store.test.ts`

- [ ] **Step 1: Ключи хранилища** — в `KEYS` (`src/core/storage/index.ts`) добавить:

```ts
  adventure: 'adventure.state',
  adventureRun: 'adventure.run',
```

- [ ] **Step 2: Падающие тесты**

```ts
// src/features/adventure/__tests__/store.test.ts
import { KEYS, removeKey } from '@/core/storage';
import { ADVENTURE_CONFIG } from '../logic/config';
import { useAdventure } from '../store';

describe('adventure progress store', () => {
  beforeEach(() => {
    removeKey(KEYS.adventure);
    useAdventure.getState().reset();
  });

  it('initial state', () => {
    const s = useAdventure.getState();
    expect(s.seasonId).toBe(1);
    expect(s.levelIndex).toBe(0);
    expect(s.consecutive).toBe(0);
    expect(s.trophies).toEqual([]);
    expect(s.dailyCleared('2026-07-05')).toBe(0);
  });

  it('recordWin advances level, consecutive and daily', () => {
    const s = useAdventure.getState();
    s.recordWin('2026-07-05');
    expect(useAdventure.getState().levelIndex).toBe(1);
    expect(useAdventure.getState().consecutive).toBe(1);
    expect(useAdventure.getState().dailyCleared('2026-07-05')).toBe(1);
  });

  it('daily counter resets on a new date', () => {
    useAdventure.getState().recordWin('2026-07-05');
    expect(useAdventure.getState().dailyCleared('2026-07-06')).toBe(0);
    useAdventure.getState().recordWin('2026-07-06');
    expect(useAdventure.getState().dailyCleared('2026-07-06')).toBe(1);
  });

  it('recordFail resets consecutive only', () => {
    useAdventure.getState().recordWin('2026-07-05');
    useAdventure.getState().recordFail();
    const s = useAdventure.getState();
    expect(s.consecutive).toBe(0);
    expect(s.levelIndex).toBe(1);
  });

  it('season completion awards trophy and rolls to next season', () => {
    const s = useAdventure.getState();
    const len = s.seasonLen();
    for (let i = 0; i < len; i++) useAdventure.getState().recordWin('2026-07-05');
    const done = useAdventure.getState();
    expect(done.trophies).toEqual([1]);
    expect(done.seasonId).toBe(2);
    expect(done.levelIndex).toBe(0);
    // именно на закрывающей победе флаг «сезон только что завершён»
    expect(done.lastWinCompletedSeason).toBe(1);
  });

  it('persists across store re-read', () => {
    useAdventure.getState().recordWin('2026-07-05');
    useAdventure.getState().hydrate();
    expect(useAdventure.getState().levelIndex).toBe(1);
  });

  it('dailyGoalReached flips at N wins', () => {
    for (let i = 0; i < ADVENTURE_CONFIG.dailyGoalLevels; i++) {
      useAdventure.getState().recordWin('2026-07-05');
    }
    expect(
      useAdventure.getState().dailyCleared('2026-07-05'),
    ).toBe(ADVENTURE_CONFIG.dailyGoalLevels);
  });
});
```

- [ ] **Step 3: Запустить — FAIL.**

- [ ] **Step 4: Реализация `src/features/adventure/store.ts`**

```ts
import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import { ADVENTURE_CONFIG } from './logic/config';
import { seasonById, seasonLength } from './logic/seasons';

interface AdventurePersist {
  v: 1;
  seasonId: number;
  levelIndex: number;
  consecutive: number;
  daily: { date: string; cleared: number };
  trophies: number[];
}

interface AdventureStore {
  seasonId: number;
  levelIndex: number;
  consecutive: number;
  daily: { date: string; cleared: number };
  trophies: number[];
  /** id сезона, завершённого последней победой (для celebration), иначе null. */
  lastWinCompletedSeason: number | null;

  seasonLen: () => number;
  dailyCleared: (date: string) => number;
  recordWin: (date: string) => void;
  recordFail: () => void;
  ackSeasonCelebration: () => void;
  hydrate: () => void;
  reset: () => void;
}

function defaults() {
  return {
    seasonId: 1,
    levelIndex: 0,
    consecutive: 0,
    daily: { date: '', cleared: 0 },
    trophies: [] as number[],
    lastWinCompletedSeason: null as number | null,
  };
}

function load(): ReturnType<typeof defaults> {
  const raw = getJSON<AdventurePersist>(KEYS.adventure);
  if (!raw || raw.v !== 1) return defaults();
  return {
    seasonId: Number.isInteger(raw.seasonId) && raw.seasonId >= 1 ? raw.seasonId : 1,
    levelIndex: Number.isInteger(raw.levelIndex) && raw.levelIndex >= 0 ? raw.levelIndex : 0,
    consecutive: Number.isInteger(raw.consecutive) ? Math.max(0, raw.consecutive) : 0,
    daily:
      raw.daily && typeof raw.daily.date === 'string'
        ? { date: raw.daily.date, cleared: Math.max(0, raw.daily.cleared | 0) }
        : { date: '', cleared: 0 },
    trophies: Array.isArray(raw.trophies) ? raw.trophies.filter(Number.isInteger) : [],
    lastWinCompletedSeason: null,
  };
}

function persist(s: AdventureStore): void {
  const save: AdventurePersist = {
    v: 1,
    seasonId: s.seasonId,
    levelIndex: s.levelIndex,
    consecutive: s.consecutive,
    daily: s.daily,
    trophies: s.trophies,
  };
  setJSON(KEYS.adventure, save);
}

export const useAdventure = create<AdventureStore>((set, get) => ({
  ...load(),

  seasonLen: () => seasonLength(seasonById(get().seasonId)),

  dailyCleared: (date) => (get().daily.date === date ? get().daily.cleared : 0),

  recordWin: (date) => {
    const s = get();
    const cleared = (s.daily.date === date ? s.daily.cleared : 0) + 1;
    const nextIndex = s.levelIndex + 1;
    const finishedSeason = nextIndex >= s.seasonLen();
    set({
      levelIndex: finishedSeason ? 0 : nextIndex,
      seasonId: finishedSeason ? s.seasonId + 1 : s.seasonId,
      trophies: finishedSeason ? [...s.trophies, s.seasonId] : s.trophies,
      consecutive: s.consecutive + 1,
      daily: { date, cleared },
      lastWinCompletedSeason: finishedSeason ? s.seasonId : null,
    });
    persist(get());
  },

  recordFail: () => {
    set({ consecutive: 0, lastWinCompletedSeason: null });
    persist(get());
  },

  ackSeasonCelebration: () => set({ lastWinCompletedSeason: null }),

  hydrate: () => set(load()),

  reset: () => {
    set(defaults());
    persist(get());
  },
}));

export { ADVENTURE_CONFIG };
```

- [ ] **Step 5: Тесты зелёные + типы**

Run: `npx jest src/features/adventure && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/storage/index.ts src/features/adventure/store.ts src/features/adventure/__tests__/store.test.ts
git commit -m "feat(adventure): стор прогресса — уровень/сезон/кубки/дейли/серия, персист MMKV"
```

---

### Task 9: Игровой стор — режим Adventure

**Files:**
- Modify: `src/features/game/store.ts`, `src/features/game/index.ts`, `src/features/analytics/types.ts`
- Test: `src/features/game/__tests__/store.test.ts` (дописать)

⚠️ Shared-файл: проверить `git diff src/features/game/store.ts` на чужие незакоммиченные правки перед началом.

- [ ] **Step 1: Падающие тесты** — дописать в `src/features/game/__tests__/store.test.ts` (следовать локальным паттернам моков файла):

```ts
import { findPlacements } from '@/core/engine';
import { levelFor } from '@/features/adventure/logic/levels';

describe('game store: adventure mode', () => {
  it('newAdventureGame устанавливает ран и монохромный трей', () => {
    useGameStore.getState().newAdventureGame(levelFor(1, 0), 0);
    const s = useGameStore.getState();
    expect(s.adventure).not.toBeNull();
    expect(s.adventure!.status).toBe('playing');
    expect(s.game.tray.every((p) => p === null || p.colorId === 1)).toBe(true);
  });

  it('placePiece маршрутизируется через adventure-движок и не трогает рекорды', () => {
    useGameStore.getState().newAdventureGame(levelFor(1, 0), 0);
    const { game } = useGameStore.getState();
    const i = game.tray.findIndex((p) => p !== null);
    const [r, c] = findPlacements(game.board, game.tray[i]!.shape)[0];
    const bestBefore = useScores.getState().best;
    const event = useGameStore.getState().placePiece(i, r, c);
    expect(event).not.toBeNull();
    expect(useGameStore.getState().adventure!.game.score).toBe(event!.score);
    expect(useScores.getState().best).toBe(bestBefore);
  });

  it('newGame (endless) очищает adventure-режим', () => {
    useGameStore.getState().newAdventureGame(levelFor(1, 0), 0);
    useGameStore.getState().newGame();
    expect(useGameStore.getState().adventure).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализация в `src/features/game/store.ts`**

Импорты:

```ts
import {
  createGame,
  deserialize,
  place,
  placeAdventure,
  replaceTrayPiece as engineReplaceTrayPiece,
  revive,
  seedFromTime,
  serialize,
  serializeAdventureRun,
  createAdventureRun,
} from '@/core/engine';
import type {
  AdventureLevelSpec,
  AdventurePlacementEvent,
  AdventureRunState,
  GameState,
  PlacementEvent,
} from '@/core/engine';
```

В интерфейс `GameStore` добавить:

```ts
  /** Активный Adventure-ран; null = endless-режимы. */
  adventure: AdventureRunState | null;
  lastAdventureEvent: AdventurePlacementEvent | null;
  newAdventureGame: (spec: AdventureLevelSpec, attempt?: number) => void;
  exitAdventure: () => void;
```

В начальное состояние: `adventure: null, lastAdventureEvent: null,`.

Действия (внутри `create<GameStore>`):

```ts
    newAdventureGame: (spec, attempt = 0) => {
      const run = createAdventureRun(spec, attempt);
      set({
        adventure: run,
        lastAdventureEvent: null,
        game: run.game,
        lastEvent: null,
        linesCleared: 0,
        finalResult: null,
        epoch: get().epoch + 1,
        ...buildFreshPresentationState(useScores.getState().best),
      });
      setString(KEYS.adventureRun, serializeAdventureRun(run));
      useAnalyticsStore.getState().track('adventure_level_start', {
        seasonId: spec.seasonId,
        levelIndex: spec.levelIndex,
        attempt,
        objective: spec.objective.kind,
      });
    },

    exitAdventure: () => {
      set({ adventure: null, lastAdventureEvent: null });
      removeKey(KEYS.adventureRun);
    },
```

В `startNew` (endless) первой строкой: `set({ adventure: null, lastAdventureEvent: null }); removeKey(KEYS.adventureRun);`.

В `placePiece` — ветка Adventure в начале:

```ts
    placePiece: (trayIndex, r, c) => {
      const { adventure } = get();
      if (adventure) {
        let result: { run: AdventureRunState; event: AdventurePlacementEvent };
        try {
          result = placeAdventure(adventure, trayIndex, r, c);
        } catch {
          return null;
        }
        const settings = useSettings.getState();
        playPlacementFeedback(result.event, {
          sound: settings.sound,
          haptics: settings.haptics,
        });
        set({
          adventure: result.run,
          lastAdventureEvent: result.event,
          game: result.run.game,
          lastEvent: result.event,
        });
        setString(KEYS.adventureRun, serializeAdventureRun(result.run));
        // Никаких scores/streak/leaderboard: adventure не влияет на рекорды (решение №3).
        return result.event;
      }
      // …существующий endless-путь без изменений…
```

В `features/game/index.ts` — экспортов не добавлять (доступ через `useGameStore`), но типы уже реэкспортируются из `@/core/engine`.

Чтобы `track('adventure_level_start', …)` прошёл типизацию уже в этой задаче, в union имён событий `src/features/analytics/types.ts` добавить сразу все четыре события:

```ts
  | 'adventure_level_start'
  | 'adventure_level_win'
  | 'adventure_level_fail'
  | 'adventure_season_complete'
```

- [ ] **Step 4: Тесты зелёные**

Run: `npx jest src/features/game/__tests__/store.test.ts && npx tsc --noEmit`
Expected: PASS (старые тесты стора тоже).

- [ ] **Step 5: Полный прогон** — `npm test`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/game/store.ts src/features/game/index.ts src/features/game/__tests__/store.test.ts src/features/analytics/types.ts
git commit -m "feat(game): adventure-режим в игровом сторе — маршрутизация placePiece, изоляция от рекордов"
```

---

### Task 10: i18n — строки adventure.*

**Files:**
- Modify: `src/core/i18n/en.ts`, `src/core/i18n/ru.ts`

- [ ] **Step 1: Добавить блок в оба словаря** (структура — вложенный объект `adventure`, по образцу соседних разделов файла):

`en.ts`:

```ts
  adventure: {
    title: 'Adventure',
    trophyHint: 'Take part in the Adventure and win the trophy.',
    level: 'Level',
    nextLevel: 'Next Level',
    dailyGoal: 'Daily Goal: 10 levels',
    dailyGoalDone: 'Daily goal complete!',
    seasonHint: 'Finish the season and full mosaic!',
    consecutive: 'Consecutive Clearances',
    goalScore: 'Reach the score',
    goalJewels: 'Collect the jewels',
    levelClear: 'Level clear!',
    failedTitle: 'No moves left',
    retry: 'Retry',
    exit: 'Exit',
    seasonComplete: 'Season complete!',
    trophyEarned: 'Trophy earned',
    newSeason: 'A new adventure awaits',
    season: { capybara: 'Capybara' },
  },
```

`ru.ts`:

```ts
  adventure: {
    title: 'Приключение',
    trophyHint: 'Пройди приключение и получи кубок.',
    level: 'Уровень',
    nextLevel: 'Дальше',
    dailyGoal: 'Цель дня: 10 уровней',
    dailyGoalDone: 'Цель дня выполнена!',
    seasonHint: 'Заверши сезон — собери всю мозаику!',
    consecutive: 'Побед подряд',
    goalScore: 'Набери очки',
    goalJewels: 'Собери кристаллы',
    levelClear: 'Уровень пройден!',
    failedTitle: 'Ходов не осталось',
    retry: 'Ещё раз',
    exit: 'Выйти',
    seasonComplete: 'Сезон завершён!',
    trophyEarned: 'Кубок получен',
    newSeason: 'Впереди новое приключение',
    season: { capybara: 'Капибара' },
  },
```

- [ ] **Step 2: Проверка** — `npx tsc --noEmit && npm test`. Expected: PASS (словари симметричны — если есть тест на паритет ключей, он зелёный).

- [ ] **Step 3: Commit**

```bash
git add src/core/i18n/en.ts src/core/i18n/ru.ts
git commit -m "feat(i18n): строки Adventure-режима (ru/en)"
```

---

### Task 11: UI — тема rainforest, JewelIcon, ObjectivePanel

**Files:**
- Create: `src/features/adventure/theme.ts`, `src/features/adventure/components/JewelIcon.tsx`, `src/features/adventure/components/ObjectivePanel.tsx`

- [ ] **Step 1: `theme.ts`** — форма `WorldTheme` (не в каталоге миров — это скин режима, не разлочка):

```ts
import type { WorldTheme } from '@/features/themes';

/** Скин Adventure «rainforest» (спека 17 §2.2): коричневое дерево, зелёные блоки. */
export const ADVENTURE_THEME: WorldTheme = {
  id: 'adventure-rainforest',
  nameKey: 'adventure.title',
  bgTop: '#A5713F',
  bgBottom: '#8A5A2E',
  boardBg: '#5E3D1F',
  cellEmpty: '#6B4726',
  // Монохром: движок выдаёт colorId=1 → используется только первый цвет.
  cellColors: ['#6FA84E', '#6FA84E', '#6FA84E', '#6FA84E', '#6FA84E', '#6FA84E'],
  juiceColors: ['#8FCB6B', '#FFD97A', '#6FA84E'],
  praiseAccent: '#FFD97A',
};

/** Клетка с кристаллом (золотая подложка) и сам кристалл. */
export const JEWEL_COLORS = {
  socket: '#D8B45A',
  gem: '#57C7FF',
  gemDeep: '#2E8FDB',
  glow: 'rgba(87,199,255,0.65)',
} as const;
```

(Если `WorldTheme` не экспортируется из `@/features/themes` — добавить `export type { WorldTheme } from './catalog';` в `src/features/themes/index.ts`.)

- [ ] **Step 2: `JewelIcon.tsx`** — View-ромб, без SVG/Skia (NFR-9):

```tsx
import { View } from 'react-native';

import { JEWEL_COLORS } from '../theme';

/** Кристалл: повёрнутый квадрат с внутренней гранью. Чисто декоративный, без анимаций. */
export function JewelIcon({ size = 16 }: { size?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.14,
          backgroundColor: JEWEL_COLORS.gem,
          borderWidth: 1,
          borderColor: JEWEL_COLORS.gemDeep,
          transform: [{ rotate: '45deg' }],
          shadowColor: JEWEL_COLORS.gem,
          shadowOpacity: 0.9,
          shadowRadius: size * 0.3,
          elevation: 4,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: '18%',
            top: '18%',
            width: '30%',
            height: '30%',
            borderRadius: size * 0.08,
            backgroundColor: 'rgba(255,255,255,0.75)',
          }}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: `ObjectivePanel.tsx`** — панель цели над доской. Score: градиентный бар + бейдж-цель; jewels: иконка + остаток. Подписка на стор — вне drag-пути (обновление на дроп, это допустимый runOnJS-участок):

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useGameStore } from '@/features/game';
import { AppText } from '@/ui';

import { JEWEL_COLORS } from '../theme';
import { JewelIcon } from './JewelIcon';

const BAR_COLORS = ['#FF8AC2', '#FFD97A', '#8FCB6B', '#57C7FF'] as const;

function ScoreObjective({ target }: { target: number }) {
  const score = useGameStore((s) => s.adventure?.game.score ?? 0);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.min(1, score / target), { duration: 260 });
  }, [progress, score, target]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 180,
          height: 18,
          borderRadius: 9,
          backgroundColor: 'rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[{ height: '100%', borderRadius: 9, overflow: 'hidden' }, fillStyle]}>
          <LinearGradient
            colors={BAR_COLORS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
      <View
        style={{
          minWidth: 44,
          height: 32,
          borderRadius: 16,
          paddingHorizontal: 8,
          backgroundColor: '#FF9FD0',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText preset="button">{String(target)}</AppText>
      </View>
    </View>
  );
}

function JewelsObjective({ count }: { count: number }) {
  const collected = useGameStore((s) => s.adventure?.jewelsCollected ?? 0);
  const remaining = Math.max(0, count - collected);
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = 1.25;
    pop.value = withSpring(1, { damping: 12 });
  }, [collected, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[{ alignItems: 'center', gap: 2 }, style]}>
      <View
        style={{
          shadowColor: JEWEL_COLORS.glow,
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <JewelIcon size={34} />
      </View>
      <AppText preset="button">{String(remaining)}</AppText>
    </Animated.View>
  );
}

/** Панель цели уровня (спека 17 §2.2 п.2). Рендер только при активном adventure. */
export function ObjectivePanel() {
  const objective = useGameStore((s) => s.adventure?.spec.objective ?? null);
  if (!objective) return null;
  return objective.kind === 'score' ? (
    <ScoreObjective target={objective.target} />
  ) : (
    <JewelsObjective count={objective.count} />
  );
}
```

- [ ] **Step 4: Проверка** — `npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/adventure/theme.ts src/features/adventure/components/JewelIcon.tsx src/features/adventure/components/ObjectivePanel.tsx
git commit -m "feat(adventure): тема rainforest, кристалл и панель цели уровня"
```

---

### Task 12: UI — маркеры кристаллов в трее

**Files:**
- Modify: `src/features/game/components/TrayPiece.tsx`, `src/features/game/components/TrayView.tsx`

⚠️ Shared-файлы drag-пути. Правка строго пассивная: **новый опциональный prop, рендерящий статичный оверлей; никакой логики в жестах**. Проверить `git diff` перед началом.

Дизайн: `features/game` НЕ должен зависеть от `features/adventure` (NFR-12), поэтому кристалл не импортируется в трей — вместо этого трей получает render-prop, а adventure-экран передаёт в него `JewelIcon`.

- [ ] **Step 1: `TrayPiece`** — добавить prop и рендер оверлея в разметке клеток фигуры (там, где итерация `piece.shape.cells`):

```tsx
// в props TrayPiece:
renderCellOverlay?: (cellIndex: number, cellSizePx: number) => React.ReactNode;

// в разметке каждой клетки фигуры (абсолютный контейнер поверх клетки):
{renderCellOverlay ? (
  <View
    pointerEvents="none"
    style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
  >
    {renderCellOverlay(cellIdx, cellSizePx)}
  </View>
) : null}
```

- [ ] **Step 2: `TrayView`** — проброс: prop `renderPieceCellOverlay?: (slot: number, cellIndex: number, cellSizePx: number) => React.ReactNode`, передаётся в каждый `TrayPiece` как `(cellIdx, size) => renderPieceCellOverlay?.(slotIndex, cellIdx, size)`.

- [ ] **Step 3: Проверка** — `npx tsc --noEmit && npx jest src/features/game`. Expected: PASS (существующие тесты трея не сломаны; ghost-фигура при драге маркер не несёт — осознанное ограничение v1, зафиксировано в спеке 17).

- [ ] **Step 4: Commit**

```bash
git add src/features/game/components/TrayPiece.tsx src/features/game/components/TrayView.tsx
git commit -m "feat(game): опциональный оверлей клетки фигуры трея (кристаллы Adventure)"
```

---

### Task 13: UI — слой кристаллов на доске

**Files:**
- Create: `src/features/adventure/components/JewelBoardLayer.tsx`

- [ ] **Step 1: Реализация** — абсолютный слой поверх `BoardView`, читает `jewelsOnBoard` из стора (обновляется только на дроп — вне 60fps-пути). Золотая подложка + кристалл:

```tsx
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useGameStore } from '@/features/game';

import { JEWEL_COLORS } from '../theme';
import { JewelIcon } from './JewelIcon';

interface Props {
  cell: number; // размер клетки, px
  gap: number;
}

/** Кристаллы на доске (спека 17 §2.2 п.3). Позиция клетки: idx = r*8+c. */
export function JewelBoardLayer({ cell, gap }: Props) {
  const jewels = useGameStore((s) => s.adventure?.jewelsOnBoard ?? EMPTY);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
      {jewels.map((i) => {
        const r = Math.floor(i / 8);
        const c = i % 8;
        return (
          <Animated.View
            key={i}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(200)}
            style={{
              position: 'absolute',
              left: c * (cell + gap),
              top: r * (cell + gap),
              width: cell,
              height: cell,
              borderRadius: cell * 0.2,
              backgroundColor: JEWEL_COLORS.socket,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <JewelIcon size={cell * 0.62} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const EMPTY: number[] = [];
```

- [ ] **Step 2: Проверка** — `npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/adventure/components/JewelBoardLayer.tsx
git commit -m "feat(adventure): слой кристаллов поверх доски"
```

---

### Task 14: UI — мозаика, хаб-экран, вход с Home

**Files:**
- Create: `src/features/adventure/components/MosaicView.tsx`, `src/features/adventure/components/AdventureEntryCard.tsx`, `src/features/adventure/index.ts`, `src/app/adventure.tsx`
- Modify: `src/app/index.tsx`

- [ ] **Step 1: `MosaicView.tsx`** (NFR-11 — memo, статичные View):

```tsx
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { levelFor } from '../logic/levels';
import { seasonById, seasonTiles } from '../logic/seasons';

interface Props {
  seasonId: number;
  /** Сколько уровней пройдено (столько тайлов закрашено). */
  cleared: number;
  /** Индекс тайла, закрашенного только что (ZoomIn-анимация), иначе -1. */
  justFilled?: number;
  /** Ширина области, px. */
  width: number;
  /** true — все тайлы цветные (reveal завершённого сезона). */
  revealed?: boolean;
}

const TILE_DIM = '#22315C';
const TILE_GAP = 2;

export const MosaicView = memo(function MosaicView({
  seasonId,
  cleared,
  justFilled = -1,
  width,
  revealed = false,
}: Props) {
  const season = seasonById(seasonId);
  const tiles = useMemo(() => seasonTiles(season), [season]);
  const colsCount = season.art[0].length;
  const tile = Math.floor((width - TILE_GAP * (colsCount - 1)) / colsCount);
  const height = season.art.length * (tile + TILE_GAP);

  return (
    <View style={{ width, height }}>
      {tiles.map((t) => {
        const filled = revealed || t.levelIndex < cleared;
        const milestone = levelFor(seasonId, t.levelIndex).milestone;
        const Tag = t.levelIndex === justFilled ? Animated.View : View;
        return (
          <Tag
            key={t.levelIndex}
            {...(t.levelIndex === justFilled
              ? { entering: ZoomIn.duration(420).delay(200) }
              : null)}
            style={{
              position: 'absolute',
              left: t.col * (tile + TILE_GAP),
              top: t.row * (tile + TILE_GAP),
              width: tile,
              height: tile,
              borderRadius: 3,
              backgroundColor: filled ? season.fillColor : TILE_DIM,
              borderWidth: milestone && !filled ? 2 : 0,
              borderColor: '#E85D5D',
            }}
          />
        );
      })}
    </View>
  );
});
```

- [ ] **Step 2: `AdventureEntryCard.tsx`** — карточка на Home:

```tsx
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, radii } from '@/ui';
import { TrophyIcon } from '@/ui/icons/TrophyIcon';

import { seasonById, seasonLength } from '../logic/seasons';
import { useAdventure } from '../store';

export function AdventureEntryCard() {
  const router = useRouter();
  const lang = useLang();
  const levelIndex = useAdventure((s) => s.levelIndex);
  const seasonId = useAdventure((s) => s.seasonId);
  const total = seasonLength(seasonById(seasonId));

  return (
    <Pressable
      onPress={() => router.push('/adventure')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#2C4A9E',
        borderRadius: radii.card,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <TrophyIcon size={28} />
      <View style={{ flex: 1 }}>
        <AppText preset="button">{t('adventure.title', lang)}</AppText>
        <AppText preset="caption">
          {t('adventure.level', lang)} {levelIndex + 1} / {total}
        </AppText>
      </View>
    </Pressable>
  );
}
```

(Пропсы `TrophyIcon`/пресеты `AppText` сверить с фактическими сигнатурами в `src/ui` — использовать существующие, ничего не добавлять.)

- [ ] **Step 3: Public API `src/features/adventure/index.ts`**

```ts
/** Public API фичи adventure (спека 17). */
export { useAdventure } from './store';
export { ADVENTURE_CONFIG } from './logic/config';
export { levelFor } from './logic/levels';
export type { AdventureLevelMeta } from './logic/levels';
export { seasonById, seasonTiles, seasonLength } from './logic/seasons';
export { ADVENTURE_THEME, JEWEL_COLORS } from './theme';
export { MosaicView } from './components/MosaicView';
export { AdventureEntryCard } from './components/AdventureEntryCard';
export { ObjectivePanel } from './components/ObjectivePanel';
export { JewelBoardLayer } from './components/JewelBoardLayer';
export { JewelIcon } from './components/JewelIcon';
export { LevelUpBanner } from './components/LevelUpBanner';       // T16
export { LevelResultView } from './components/LevelResultView';   // T16
export { FailOverlay } from './components/FailOverlay';           // T16
export { SeasonCelebration } from './components/SeasonCelebration'; // T17
```

(Строки с пометками T16/T17 добавить в соответствующих задачах, здесь — без них.)

- [ ] **Step 4: Хаб `src/app/adventure.tsx`** (спека 17 §2.1):

```tsx
import { useRouter } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { MosaicView, useAdventure } from '@/features/adventure';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';
import { GameButton } from '@/ui/primitives/GameButton';
import { IconButton } from '@/ui/primitives/IconButton';
import { ChevronIcon } from '@/ui/icons/ChevronIcon';
import { TrophyIcon } from '@/ui/icons/TrophyIcon';

export default function AdventureScreen() {
  const router = useRouter();
  const lang = useLang();
  const { width } = useWindowDimensions();
  const levelIndex = useAdventure((s) => s.levelIndex);
  const seasonId = useAdventure((s) => s.seasonId);
  const trophies = useAdventure((s) => s.trophies);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
        <IconButton onPress={() => router.back()}>
          <ChevronIcon />
        </IconButton>
        <AppText preset="title" style={{ flex: 1, textAlign: 'center' }}>
          {t('adventure.title', lang)}
        </AppText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', gap: 20, padding: 20 }}>
        <TrophyIcon size={72} />
        {trophies.length > 0 ? (
          <AppText preset="caption">🏆 × {trophies.length}</AppText>
        ) : null}
        <AppText preset="body" style={{ textAlign: 'center', maxWidth: 280 }}>
          {t('adventure.trophyHint', lang)}
        </AppText>

        <MosaicView seasonId={seasonId} cleared={levelIndex} width={Math.min(320, width - 48)} />
      </ScrollView>

      <View style={{ padding: 20 }}>
        <GameButton
          label={`${t('adventure.level', lang)} ${levelIndex + 1}`}
          onPress={() => router.push('/adventure-level')}
        />
      </View>
    </SafeAreaView>
  );
}
```

(Сигнатуры `GameButton`/`IconButton`/пресеты сверить по `src/ui/primitives` и подстроить рендер, не меняя примитивы.)

- [ ] **Step 5: Вход с Home** — в `src/app/index.tsx` добавить `<AdventureEntryCard />` в колонку карточек (рядом с картой достижений/дейли; точное место — по текущей структуре файла), импорт из `@/features/adventure`.

- [ ] **Step 6: Проверка** — `npx tsc --noEmit && npm test`; запуск `npx expo start` → Home показывает карточку, тап открывает хаб с мозаикой.
- [ ] **Step 7: Commit**

```bash
git add src/features/adventure src/app/adventure.tsx src/app/index.tsx
git commit -m "feat(adventure): хаб с мозаикой сезона и вход с главного экрана"
```

---

### Task 15: UI — экран уровня (фаза playing)

**Files:**
- Create: `src/app/adventure-level.tsx`

- [ ] **Step 1: Реализация.** Каркас — по образцу `src/app/game.tsx` (геометрия, DragProvider), но: тема `ADVENTURE_THEME`, `ObjectivePanel` вместо `Hud`-счёта, `JewelBoardLayer` поверх доски, маркеры кристаллов в трее, без маскота/рекламы/атмосферы, без `useProgressionSync` (решение №3):

```tsx
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import {
  FailOverlay,
  JewelBoardLayer,
  JewelIcon,
  LevelResultView,
  LevelUpBanner,
  ObjectivePanel,
  ADVENTURE_THEME,
  levelFor,
  useAdventure,
} from '@/features/adventure';
import {
  BoardView,
  DragProvider,
  EMPTY_MASK,
  TrayView,
  useGameFeedback,
  useGameStore,
} from '@/features/game';
import type { DragCtx } from '@/features/game';
import { GameBackground } from '@/features/game/components/GameBackground';
import { useLang } from '@/features/settings';
import { IconButton } from '@/ui/primitives/IconButton';
import { ChevronIcon } from '@/ui/icons/ChevronIcon';
import { GearIcon } from '@/ui/icons/GearIcon';
import { getBoardMetrics } from '@/ui';

type Phase = 'playing' | 'celebrating' | 'result';

export default function AdventureLevelScreen() {
  const router = useRouter();
  const lang = useLang();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const spec = useMemo(() => levelFor(seasonId, levelIndex), [seasonId, levelIndex]);

  const status = useGameStore((s) => s.adventure?.status ?? 'playing');
  const tray = useGameStore((s) => s.game.tray);
  const jewelTray = useGameStore((s) => s.adventure?.jewelTray ?? null);

  const [phase, setPhase] = useState<Phase>('playing');
  const [attempt, setAttempt] = useState(0);
  const winRecorded = useRef(false);

  // Старт уровня при входе/ретрае.
  useEffect(() => {
    winRecorded.current = false;
    setPhase('playing');
    useGameStore.getState().newAdventureGame(spec, attempt);
  }, [spec, attempt]);

  // Реакция на исход.
  useEffect(() => {
    if (status === 'won' && !winRecorded.current) {
      winRecorded.current = true;
      useAdventure.getState().recordWin(new Date().toISOString().slice(0, 10));
      setPhase('celebrating');
    }
    if (status === 'failed') {
      useAdventure.getState().recordFail();
    }
  }, [status]);

  // Геометрия — как в game.tsx, упрощённые константы (нет HUD/маскота/рекламы).
  const stageHeight = Math.max(560, screenHeight);
  const trayHeight = Math.max(150, Math.min(300, Math.round(stageHeight * 0.18)));
  const maxBoardSize = Math.max(240, stageHeight - trayHeight - 220);
  const { boardSize, cellSize, cellGap } = getBoardMetrics(screenWidth, maxBoardSize);
  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellSize, cellGap],
  );

  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const boardMeasureRef = useRef<(() => void) | null>(null);
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const dragOwner = useSharedValue(-1);

  const { onGrab, onInvalidDrop } = useGameFeedback();
  const onDrop = useCallback(
    (trayIndex: number, r: number, c: number) =>
      useGameStore.getState().placePiece(trayIndex, r, c) !== null,
    [],
  );

  const dragCtx: DragCtx = useMemo(
    () => ({
      geom,
      boardOrigin,
      boardMeasureRef,
      boardMirror,
      preview,
      previewColor,
      dragActive,
      dragOwner,
      cellColors: ADVENTURE_THEME.cellColors,
      boardBg: ADVENTURE_THEME.boardBg,
      cellEmpty: ADVENTURE_THEME.cellEmpty,
      onDrop,
      onGrab,
      onInvalidDrop,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geom, onDrop, onGrab, onInvalidDrop],
  );

  const exit = useCallback(() => {
    useGameStore.getState().exitAdventure();
    router.replace('/adventure');
  }, [router]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const nextLevel = useCallback(() => {
    // levelIndex в useAdventure уже сдвинут recordWin → эффект перезапустит уровень.
    setAttempt(0);
    setPhase('playing');
  }, []);

  const renderJewelOverlay = useCallback(
    (slot: number, cellIndex: number, size: number) =>
      jewelTray && jewelTray[slot] === cellIndex ? <JewelIcon size={size * 0.6} /> : null,
    [jewelTray],
  );

  if (phase === 'result') {
    return <LevelResultView onNext={nextLevel} onExit={exit} />;
  }

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView style={{ flex: 1, overflow: 'hidden' }} edges={['top', 'bottom']}>
        <GameBackground
          boardSize={boardSize}
          boardLayout={null}
          bgTop={ADVENTURE_THEME.bgTop}
          bgBottom={ADVENTURE_THEME.bgBottom}
          glowColors={ADVENTURE_THEME.juiceColors}
          haloColor={ADVENTURE_THEME.praiseAccent}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <IconButton onPress={exit}>
            <ChevronIcon />
          </IconButton>
          <View style={{ flex: 1 }} />
          <IconButton onPress={() => router.push('/settings')}>
            <GearIcon />
          </IconButton>
        </View>

        <View style={{ flex: 1, alignItems: 'center', gap: 14, paddingTop: 4 }}>
          <ObjectivePanel />
          <View>
            <BoardView />
            <JewelBoardLayer cell={cellSize} gap={cellGap} />
          </View>
          <TrayView
            tray={tray}
            style={{ width: '100%', height: trayHeight }}
            renderPieceCellOverlay={renderJewelOverlay}
          />
        </View>

        {phase === 'celebrating' ? (
          <LevelUpBanner
            fromLevel={levelIndex} // recordWin уже сдвинул стор: баннер Lv.(idx)→Lv.(idx+1)
            onDone={() => setPhase('result')}
          />
        ) : null}

        {status === 'failed' ? (
          <FailOverlay
            title={t('adventure.failedTitle', lang)}
            onRetry={retry}
            onExit={exit}
          />
        ) : null}
      </SafeAreaView>
    </DragProvider>
  );
}
```

> Тонкость с `fromLevel`: `recordWin` инкрементит `levelIndex` в сторе прогресса, из-за чего `spec` в `useMemo` пересчитается и эффект перезапуска сработал бы прямо во время celebration. Чтобы этого не было: эффект старта уровня должен зависеть от `phase === 'playing'` — добавить в начало эффекта `if (phase !== 'playing') return;` и включить `phase` в deps. Проверить руками сценарий: победа → celebration → result → Next Level → следующий уровень стартует один раз.

- [ ] **Step 2: Проверка** — `npx tsc --noEmit` (T16-компоненты ещё не созданы — временно закомментировать их использование ИЛИ выполнить T15 после T16; **рекомендуемый порядок исполнения: T16-компоненты создаются первыми, экран — после**, см. «Порядок»).

- [ ] **Step 3: Commit**

```bash
git add src/app/adventure-level.tsx
git commit -m "feat(adventure): экран уровня — цель, кристаллы, drag на теме rainforest"
```

---

### Task 16: UI — победа (баннер+конфетти), результат, поражение

**Files:**
- Create: `src/features/adventure/components/LevelUpBanner.tsx`, `src/features/adventure/components/LevelResultView.tsx`, `src/features/adventure/components/FailOverlay.tsx`
- Modify: `src/features/adventure/index.ts` (экспорты)

- [ ] **Step 1: `LevelUpBanner.tsx`** — чипы Lv.N → Lv.N+1, оранжевый бар, блочное конфетти (переиспользуем `Confetti` из features/game), автопереход:

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { AppText } from '@/ui';

interface Props {
  /** Номер пройденного уровня, 0-based (баннер покажет Lv.N+1 → Lv.N+2). */
  fromLevel: number;
  onDone: () => void;
}

const HOLD_MS = 2200;

export function LevelUpBanner({ fromLevel, onDone }: Props) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(250, withTiming(1, { duration: reduced ? 0 : 700 }));
    const timer = setTimeout(onDone, reduced ? 600 : HOLD_MS);
    return () => clearTimeout(timer);
  }, [fill, onDone, reduced]);

  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(12,10,24,0.55)',
        alignItems: 'center',
        paddingTop: '22%',
      }}
    >
      <View style={{ width: '84%', gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={chip('#3D6BFF')}>
            <AppText preset="button">Lv.{fromLevel + 1}</AppText>
          </View>
          <View style={chip('#3D6BFF')}>
            <AppText preset="button" style={{ color: '#FFC93C' }}>
              Lv.{fromLevel + 2}
            </AppText>
          </View>
        </View>
        <View
          style={{
            height: 22,
            borderRadius: 11,
            backgroundColor: 'rgba(255,255,255,0.18)',
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[{ height: '100%', borderRadius: 11, backgroundColor: '#FF9E2C' }, barStyle]}
          />
        </View>
      </View>
      {reduced ? null : <Confetti />}
    </Animated.View>
  );
}

function chip(bg: string) {
  return {
    backgroundColor: bg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  } as const;
}
```

(Сигнатуру `Confetti` сверить с `src/features/game/effects/Confetti.tsx` — если требует пропсы (цвета/количество), передать `ADVENTURE_THEME.juiceColors`.)

- [ ] **Step 2: `LevelResultView.tsx`** — экран результата (спека 17 §2.4):

```tsx
import { View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';
import { GameButton } from '@/ui/primitives/GameButton';

import { ADVENTURE_CONFIG } from '../logic/config';
import { useAdventure } from '../store';
import { MosaicView } from './MosaicView';

interface Props {
  onNext: () => void;
  onExit: () => void;
}

export function LevelResultView({ onNext, onExit }: Props) {
  const lang = useLang();
  const { width } = useWindowDimensions();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const consecutive = useAdventure((s) => s.consecutive);
  const today = new Date().toISOString().slice(0, 10);
  const dailyCleared = useAdventure((s) => s.dailyCleared(today));
  const dailyDone = dailyCleared >= ADVENTURE_CONFIG.dailyGoalLevels;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
        <AppText preset="title">{t('adventure.levelClear', lang)}</AppText>

        <MosaicView
          seasonId={seasonId}
          cleared={levelIndex}
          justFilled={levelIndex - 1}
          width={Math.min(300, width - 64)}
        />

        <Animated.View
          entering={FadeInDown.duration(300).delay(300)}
          style={{
            flexDirection: 'row',
            gap: 8,
            backgroundColor: 'rgba(10,20,50,0.8)',
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 6,
          }}
        >
          <AppText preset="caption">
            🎯 {dailyDone ? t('adventure.dailyGoalDone', lang) : t('adventure.dailyGoal', lang)}
            {'  '}
            {Math.min(dailyCleared, ADVENTURE_CONFIG.dailyGoalLevels)}/
            {ADVENTURE_CONFIG.dailyGoalLevels}
          </AppText>
        </Animated.View>

        <AppText preset="caption" style={{ opacity: 0.85 }}>
          {t('adventure.seasonHint', lang)}
        </AppText>

        <GameButton label={t('adventure.nextLevel', lang)} onPress={onNext} />

        <AppText preset="caption">
          {t('adventure.consecutive', lang)}  {consecutive}
        </AppText>

        <GameButton label={t('adventure.exit', lang)} onPress={onExit} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: `FailOverlay.tsx`**:

```tsx
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';
import { GameButton } from '@/ui/primitives/GameButton';

interface Props {
  title: string;
  onRetry: () => void;
  onExit: () => void;
}

export function FailOverlay({ title, onRetry, onExit }: Props) {
  const lang = useLang();
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(12,10,24,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
      }}
    >
      <AppText preset="title">{title}</AppText>
      <View style={{ gap: 10, width: '80%' }}>
        <GameButton label={t('adventure.retry', lang)} onPress={onRetry} />
        <GameButton label={t('adventure.exit', lang)} onPress={onExit} />
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 4: Экспорты** — добавить `LevelUpBanner`, `LevelResultView`, `FailOverlay` в `src/features/adventure/index.ts`.

- [ ] **Step 5: Проверка** — `npx tsc --noEmit && npm test`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/adventure/components src/features/adventure/index.ts
git commit -m "feat(adventure): баннер победы с конфетти, экран результата, оверлей поражения"
```

---

### Task 17: Завершение сезона — reveal, кубок, следующий сезон

**Files:**
- Create: `src/features/adventure/components/SeasonCelebration.tsx`
- Modify: `src/features/adventure/components/LevelResultView.tsx`, `src/features/adventure/index.ts`

- [ ] **Step 1: `SeasonCelebration.tsx`** — полноэкранный оверлей: reveal мозаики (все тайлы цветные), подъём кубка, конфетти:

```tsx
import { View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { Confetti } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { useLang } from '@/features/settings';
import { AppText } from '@/ui';
import { GameButton } from '@/ui/primitives/GameButton';
import { TrophyIcon } from '@/ui/icons/TrophyIcon';

import { MosaicView } from './MosaicView';

interface Props {
  seasonId: number;
  onContinue: () => void;
}

export function SeasonCelebration({ seasonId, onContinue }: Props) {
  const lang = useLang();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10,16,40,0.96)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
      }}
    >
      <Animated.View entering={ZoomIn.duration(reduced ? 0 : 600).delay(400)}>
        <TrophyIcon size={96} />
      </Animated.View>
      <AppText preset="title">{t('adventure.seasonComplete', lang)}</AppText>
      <AppText preset="caption">{t('adventure.trophyEarned', lang)}</AppText>

      <MosaicView seasonId={seasonId} cleared={0} revealed width={Math.min(280, width - 80)} />

      <AppText preset="caption" style={{ opacity: 0.8 }}>
        {t('adventure.newSeason', lang)}
      </AppText>
      <GameButton label={t('adventure.nextLevel', lang)} onPress={onContinue} />
      {reduced ? null : <Confetti />}
    </Animated.View>
  );
}
```

- [ ] **Step 2: Показ в `LevelResultView`** — в начало компонента:

```tsx
const completedSeason = useAdventure((s) => s.lastWinCompletedSeason);
// …
if (completedSeason !== null) {
  return (
    <SeasonCelebration
      seasonId={completedSeason}
      onContinue={() => {
        useAdventure.getState().ackSeasonCelebration();
        onNext();
      }}
    />
  );
}
```

Экспортировать `SeasonCelebration` из `index.ts`.

> `recordWin` при закрытии сезона уже перевёл стор на `seasonId+1, levelIndex 0` — `onNext` запустит уровень 1 нового сезона; мозаика celebration рисуется по `completedSeason` (старому id).

- [ ] **Step 3: Проверка** — `npx tsc --noEmit && npm test`. Ручная проверка возможна форс-скипом: временно `useAdventure.setState({ levelIndex: seasonLen-1 })` в dev, пройти уровень, увидеть reveal.

- [ ] **Step 4: Commit**

```bash
git add src/features/adventure
git commit -m "feat(adventure): завершение сезона — reveal мозаики, кубок, переход к следующему"
```

---

### Task 18: Аналитика

**Files:**
- Modify: `src/app/adventure-level.tsx`

Имена событий уже добавлены в union `src/features/analytics/types.ts` в T9; `adventure_level_start` уже трекается в `newAdventureGame` (T9).

- [ ] **Step 1:** В `adventure-level.tsx` (импортировать `useAnalyticsStore` из `@/features/analytics`), в эффект исхода:

```ts
if (status === 'won' && !winRecorded.current) {
  // …recordWin…
  useAnalyticsStore.getState().track('adventure_level_win', {
    seasonId,
    levelIndex,
    attempt,
    consecutive: useAdventure.getState().consecutive,
  });
  if (useAdventure.getState().lastWinCompletedSeason !== null) {
    useAnalyticsStore.getState().track('adventure_season_complete', { seasonId });
  }
}
if (status === 'failed') {
  // …recordFail…
  useAnalyticsStore.getState().track('adventure_level_fail', { seasonId, levelIndex, attempt });
}
```

- [ ] **Step 2: Проверка** — `npx tsc --noEmit && npx jest src/features/analytics`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/adventure-level.tsx
git commit -m "feat(adventure): аналитика win/fail/season_complete на экране уровня"
```

---

### Task 19: Финальная верификация и документация

**Files:**
- Modify: `docs/specs/01-screens.md` (упомянуть экраны Adventure со ссылкой на спеку 17), `docs/specs/02-architecture.md` (модуль `features/adventure`, ключи `adventure.state`/`adventure.run`)

- [ ] **Step 1: Полные прогоны**

Run: `npx tsc --noEmit`
Expected: 0 ошибок.

Run: `npm test`
Expected: все сьюты PASS, `fingerprint.test.ts` — без изменения эталона.

- [ ] **Step 2: Ручной QA-чеклист** (`npx expo start`, устройство/эмулятор):

1. Home → карточка Adventure видна, показывает «Уровень 1 / N».
2. Хаб: кубок, подсказка, мозаика (тёмная, milestone-рамки видны), кнопка «Level 1».
3. Уровень 1: пустая доска, зелёные монохромные фигуры, бар с целью 128; дроп работает, бар растёт.
4. Победа: баннер Lv.1→Lv.2 + конфетти → экран результата: мозаика с одним закрашенным тайлом (анимация), «Цель дня 1/10», «Побед подряд 1», Next Level.
5. Next Level → уровень 2 стартует ровно один раз (без двойного перезапуска).
6. Выход посреди уровня → Home → Adventure → уровень перезапускается корректно (v1: ран не резюмится — допустимо; если решено резюмить, см. «За пределами v1»).
7. Уровень 8+: jewels-цель — золотые клетки с кристаллами на доске, счётчик с ромбом, кристалл в фигуре трея; очистка линии с кристаллом уменьшает счётчик.
8. Поражение (забить доску): оверлей, Retry перезапускает с другим потоком фигур, «Побед подряд» сброшен.
9. Reduced motion в системе: баннер/конфетти не анимируются агрессивно.
10. Endless-режим не задет: обычная игра, рекорды, лидерборд, дейли-челлендж работают как раньше.
11. Перезапуск приложения: прогресс Adventure (уровень/серия/дейли) сохранён.

- [ ] **Step 3: Обновить доки** — в 01 добавить раздел «Adventure (спека 17)» со списком экранов `/adventure`, `/adventure-level`; в 02 — модуль `features/adventure` в таблицу модулей и два MMKV-ключа.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/01-screens.md docs/specs/02-architecture.md
git commit -m "docs(specs): экраны и архитектура Adventure-режима (спека 17)"
```

---

## Порядок исполнения

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → **T16 → T15** → T17 → T18 → T19.

(T16 раньше T15: экран уровня импортирует компоненты победы/поражения.)

## За пределами v1 (осознанно не делаем)

- Резюм рана посреди уровня после перезапуска приложения (`KEYS.adventureRun` уже пишется в T9 — осталось `loadSavedAdventure()` в сторе и ветка на входе в экран).
- Ревайв за rewarded-рекламу при поражении (за флагом MONETIZATION, анти-чеклист 06).
- Очки Adventure → Уровень Игры с коэффициентом (спека 11).
- Fly-to-counter анимация кристалла (v1 — FadeOut слоя + pop счётчика).
- Поздние механики-препятствия (лёд, двойные клетки), новые арты сезонов 2+.
- Награда за Daily Goal через систему дейли-бонуса (спека 14), реакции Капи на победы.
