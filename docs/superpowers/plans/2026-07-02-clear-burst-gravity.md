# Единая система разрушения «тяжёлая гравитация» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Осколки-ячейки `ClearBurstLayer` становятся единственным телом разрушения линий: подскок → тяжёлое падение за нижний край доски, интенсивность растёт с числом линий; дублирующие системы (`fragments`, `fallingFragments`, `BlockCrushLayer`) удаляются, крошка урезается до акцента.

**Architecture:** Все параметры траектории предвычисляются детерминированно в `buildBurstCells` (seeded random + `intensity`) и складываются в расширенный `ClearBurstCell`; частица пула остаётся «тупой» (только shared values, UI-поток). Конфиг чисел — `BURST_MOTION` в `motion.ts`. Спека: `docs/superpowers/specs/2026-07-02-clear-burst-gravity-design.md`.

**Tech Stack:** TypeScript strict, React Native + Reanimated (withTiming/withSequence/withDelay), Jest (моки reanimated per-file). Прогон тестов: `npx jest <файлы> --testPathIgnorePatterns .worktrees` (в `.worktrees/` лежит копия репо параллельного агента — не трогать).

**Контекст-предупреждения:**
- Контракт бесшовности уже реализован и покрыт `src/features/game/__tests__/clearBurstSeamless.test.tsx` — он должен оставаться зелёным (фикстуру компонент-теста обновляем под новые поля, семантика та же).
- `SPECTACLE_MOTION.debrisStartMs` используется `useShake.ts` и пиннится `useShake.test.ts` — **не удалять и не менять**.
- `core/engine` не затрагивается вообще.
- Коммитить только файлы задачи (`git commit -m "..." -- <пути>`): в индексе репо есть чужие изменения параллельных агентов.

---

### Task 1: Конфиг BURST_MOTION и burstIntensityFor

**Files:**
- Modify: `src/features/game/animation/motion.ts` (после блока `SPECTACLE_MOTION`)
- Test: `src/features/game/__tests__/motion.test.ts`

- [ ] **Step 1: Написать падающий тест**

Добавить в `src/features/game/__tests__/motion.test.ts` (импортировать `BURST_MOTION`, `burstIntensityFor` из `../animation/motion` в существующий import-блок):

```ts
describe('burst motion (тяжёлая гравитация)', () => {
  it('масштабирует интенсивность по числу линий и капит сверху', () => {
    expect(burstIntensityFor(1, false)).toBe(1);
    expect(burstIntensityFor(2, false)).toBe(1.25);
    expect(burstIntensityFor(3, false)).toBe(1.5);
    expect(burstIntensityFor(4, false)).toBe(1.8);
    expect(burstIntensityFor(8, false)).toBe(1.8);
    expect(burstIntensityFor(1, true)).toBe(1.8); // фулл-клир — всегда максимум
    expect(burstIntensityFor(0, false)).toBe(1); // защита от вырожденного входа
  });

  it('держит суммарную длительность полёта осколка в пределах бюджета', () => {
    const worstCase =
      BURST_MOTION.jumpDurationMs +
      BURST_MOTION.fallDurationMinMs +
      BURST_MOTION.fallDurationJitterMs;
    expect(worstCase).toBeLessThanOrEqual(650);
    expect(BURST_MOTION.fadeDurationMs).toBeLessThan(BURST_MOTION.fallDurationMinMs);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest src/features/game/__tests__/motion.test.ts --testPathIgnorePatterns .worktrees`
Expected: FAIL — `BURST_MOTION`/`burstIntensityFor` не экспортируются.

- [ ] **Step 3: Реализовать конфиг**

В `src/features/game/animation/motion.ts` после `SPECTACLE_MOTION` добавить:

```ts
/**
 * Единая система разрушения «тяжёлая гравитация»
 * (docs/superpowers/specs/2026-07-02-clear-burst-gravity-design.md):
 * осколок-ячейка подскакивает и тяжело падает за нижний край доски.
 */
export const BURST_MOTION = {
  popScale: 1.1,
  popDurationMs: 80,
  jumpDurationMs: 140,
  /** Высота подскока в клетках: base + random * jitter, умножается на intensity. */
  jumpCells: 0.55,
  jumpJitterCells: 0.25,
  /** Горизонтальный дрейф за подскок (в клетках, от центроида). */
  driftCells: 0.4,
  fallDurationMinMs: 300,
  fallDurationJitterMs: 130,
  /** Насколько ниже края доски финиширует осколок (в клетках). */
  fallOvershootCells: 1.5,
  /** Дополнительный горизонтальный снос за падение (в клетках). */
  spreadCells: 0.6,
  rotateBaseDeg: 40,
  rotateJitterDeg: 30,
  /** Масштаб осколка к концу падения («улетает от камеры»). */
  fallScale: 0.9,
  /** Затухание у нижней границы — осколки не ложатся поверх трея. */
  fadeDurationMs: 110,
  /** Время жизни осколка в reduced motion (fade на месте). */
  reducedFadeMs: 240,
  /** Интенсивность по числу линий: 1, 2, 3, 4+. */
  intensityByLines: [1, 1.25, 1.5, 1.8],
  /** Крошка-акцент: 1 частица на debrisPerCells ячеек, не больше debrisCap. */
  debrisCap: 16,
  debrisPerCells: 2,
} as const;

/** Множитель силы разрушения: растёт с числом линий, фулл-клир — максимум. */
export function burstIntensityFor(lineCount: number, boardCleared: boolean): number {
  const table = BURST_MOTION.intensityByLines;
  if (boardCleared) return table[table.length - 1]!;
  const index = Math.min(Math.max(lineCount, 1), table.length) - 1;
  return table[index]!;
}
```

- [ ] **Step 4: Убедиться, что тест зелёный**

Run: `npx jest src/features/game/__tests__/motion.test.ts --testPathIgnorePatterns .worktrees`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/game/animation/motion.ts src/features/game/__tests__/motion.test.ts
git commit -m "feat(game): конфиг BURST_MOTION и множитель интенсивности разрушения" -- src/features/game/animation/motion.ts src/features/game/__tests__/motion.test.ts
```

---

### Task 2: Траектория тяжёлой гравитации в buildBurstCells

**Files:**
- Modify: `src/features/game/animation/clearPresentation.ts` (интерфейс `ClearBurstCell` ~строка 109, функция `buildBurstCells` ~строка 666, слагаемое `latestBurst` в `clearPresentationLifetimeMs` ~строка 804)
- Test: `src/features/game/__tests__/clearPresentation.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Добавить в `src/features/game/__tests__/clearPresentation.test.ts` новый describe (фикстуры `rowEvent`/`crossEvent`/`boardClearEvent` уже есть в файле; `GEOM = { boardSize: 94, cell: 10, gap: 2 }`):

```ts
describe('burst cells: тяжёлая гравитация', () => {
  it('каждый осколок подскакивает вверх и финиширует за нижним краем доски', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);

    expect(presentation.cells.length).toBeGreaterThan(0);
    for (const cell of presentation.cells) {
      expect(cell.jumpY).toBeLessThan(0); // подскок — вверх
      expect(cell.y + cell.dy).toBeGreaterThan(GEOM.boardSize); // финиш ниже доски
      expect(cell.fallDuration).toBeGreaterThanOrEqual(300);
      expect(cell.fallDuration).toBeLessThanOrEqual(430);
    }
  });

  it('интенсивность растёт с размером комбинации', () => {
    const oneLine = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    const boardClear = buildClearPresentation(boardClearEvent(), GEOM, CELL_COLORS, false);

    const maxJump = (cells: readonly { jumpY: number }[]) =>
      Math.max(...cells.map((cell) => Math.abs(cell.jumpY)));
    // 1 линия: cell * (0.55..0.8) * 1.0; фулл-клир: * 1.8 — диапазоны не пересекаются.
    expect(maxJump(boardClear.cells)).toBeGreaterThan(maxJump(oneLine.cells));
  });

  it('волна: задержка осколка растёт с удалением от места хода', () => {
    const presentation = buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false);
    // rowEvent: placed вокруг (3,3); ячейка (3,0) дальше от хода, чем (3,3).
    const near = presentation.cells.find((cell) => cell.x === 36 && cell.y === 36);
    const far = presentation.cells.find((cell) => cell.x === 0 && cell.y === 36);
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    expect(far!.delay).toBeGreaterThan(near!.delay);
  });

  it('reduced motion не двигает осколки', () => {
    const presentation = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, true);

    for (const cell of presentation.cells) {
      expect(cell.jumpY).toBe(0);
      expect(cell.driftX).toBe(0);
      expect(cell.dx).toBe(0);
      expect(cell.dy).toBe(0);
      expect(cell.rotate).toBe(0);
      expect(cell.delay).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest src/features/game/__tests__/clearPresentation.test.ts --testPathIgnorePatterns .worktrees`
Expected: FAIL — у `ClearBurstCell` нет `jumpY`/`driftX`/`fallDuration`; текущие dy малы; delay случайный.

- [ ] **Step 3: Реализовать**

В `src/features/game/animation/clearPresentation.ts`:

1. Импорт: строка 4 — добавить `BURST_MOTION`, `burstIntensityFor`:

```ts
import { BURST_MOTION, burstIntensityFor, GAME_FEEL_MOTION, SPECTACLE_MOTION, clearCellDelay } from './motion';
```

2. Заменить интерфейс `ClearBurstCell`:

```ts
/**
 * Частица пула разрушения (ClearBurstLayer): стартует как сама ячейка,
 * подскакивает на jumpY/driftX и тяжело падает на dx/dy за нижний край доски.
 */
export interface ClearBurstCell {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  /** Подскок: смещение вверх (отрицательное, px) и дрейф в сторону. */
  jumpY: number;
  driftX: number;
  /** Падение: финальное смещение (px); y + dy > boardSize. */
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
  fallDuration: number;
}
```

3. Заменить тело `buildBurstCells` (сигнатура не меняется):

```ts
function buildBurstCells(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  center: { x: number; y: number },
  reducedMotion: boolean,
): ClearBurstCell[] {
  if (event.clearedCells.length === 0) return [];
  const step = geom.cell + geom.gap;
  const maxCells = Math.min(event.clearedCells.length, 24);
  const sampled = sampleEffectCells(event.clearedCells, maxCells);
  const lineCount = event.clearedRows.length + event.clearedCols.length;
  const intensity = burstIntensityFor(lineCount, event.boardCleared);

  return sampled.map(([row, col], index) => {
    const x = col * step;
    const y = row * step;
    const base = {
      id: `burst-${index}`,
      x,
      y,
      size: geom.cell,
      color: getColor(row, col),
    };
    if (reducedMotion) {
      return {
        ...base,
        jumpY: 0,
        driftX: 0,
        dx: 0,
        dy: 0,
        rotate: 0,
        delay: 0,
        fallDuration: BURST_MOTION.reducedFadeMs,
      };
    }
    // Дрейф — от центроида комбо: левые осколки уходят влево, правые вправо.
    const awaySign = x + geom.cell / 2 >= center.x ? 1 : -1;
    const jump =
      geom.cell * (BURST_MOTION.jumpCells + random() * BURST_MOTION.jumpJitterCells) * intensity;
    const drift =
      awaySign * geom.cell * BURST_MOTION.driftCells * (0.4 + random() * 0.6) * intensity;
    return {
      ...base,
      jumpY: -jump,
      driftX: drift,
      dx: drift + awaySign * geom.cell * BURST_MOTION.spreadCells * random() * intensity,
      dy: geom.boardSize - y + geom.cell * BURST_MOTION.fallOvershootCells,
      rotate:
        (random() < 0.5 ? -1 : 1) *
        (BURST_MOTION.rotateBaseDeg + random() * BURST_MOTION.rotateJitterDeg) *
        intensity,
      delay: clearCellDelay([row, col], event.placed as readonly Cell[]),
      fallDuration: Math.round(
        BURST_MOTION.fallDurationMinMs + random() * BURST_MOTION.fallDurationJitterMs,
      ),
    };
  });
}
```

4. В `clearPresentationLifetimeMs` заменить слагаемое `latestBurst`:

```ts
  const latestBurst = presentation.cells.reduce(
    (max, cell) => Math.max(max, cell.delay + BURST_MOTION.jumpDurationMs + cell.fallDuration),
    0,
  );
```

- [ ] **Step 4: Прогнать тесты (новые зелёные; старые на fragments ещё живы и зелёные — их выпилит Task 4)**

Run: `npx jest src/features/game/__tests__/clearPresentation.test.ts src/features/game/__tests__/clearBurstSeamless.test.tsx --testPathIgnorePatterns .worktrees`
Expected: PASS (coverage-тест из clearBurstSeamless проверяет только x/y — не задет).

- [ ] **Step 5: Проверить типы и закоммитить**

Run: `npx tsc --noEmit` — Expected: чисто (старый `ClearBurstLayer.play` читает только старые поля).

```bash
git add src/features/game/animation/clearPresentation.ts src/features/game/__tests__/clearPresentation.test.ts
git commit -m "feat(game): траектория тяжёлой гравитации для осколков клира" -- src/features/game/animation/clearPresentation.ts src/features/game/__tests__/clearPresentation.test.ts
```

---

### Task 3: Подскок и падение в ClearBurstLayer

**Files:**
- Modify: `src/features/game/effects/ClearBurstLayer.tsx` (метод `play`)
- Test: `src/features/game/__tests__/clearBurstSeamless.test.tsx` (фикстура + новый тест)

- [ ] **Step 1: Обновить фикстуру и написать падающий тест**

В `clearBurstSeamless.test.tsx` заменить объект `burstCell` (тест `осколок виден сразу…`) на:

```ts
    const burstCell = {
      id: 'burst-0',
      x: 12,
      y: 24,
      size: 10,
      color: '#ff4d67',
      jumpY: -14,
      driftX: 6,
      dx: 18,
      dy: 85, // boardSize 94 − y 24 + 1.5 клетки
      rotate: 46,
      delay: 30,
      fallDuration: 360,
    };
```

И добавить в тот же describe `burst particle visibility` новый тест (использует уже определённые в файле хелперы `isDelay`, `isSequence`, `isTiming` и фикстуру через рендер, аналогично существующему тесту — вынести создание presentation/рендер в локальную функцию, если удобнее; ниже — полный тест с собственным рендером):

```ts
  it('вертикаль: подскок вверх, затем падение за нижний край доски', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClearBurstLayer } = require('../effects/ClearBurstLayer') as typeof import('../effects/ClearBurstLayer');

    const burstCell = {
      id: 'burst-0',
      x: 12,
      y: 24,
      size: 10,
      color: '#ff4d67',
      jumpY: -14,
      driftX: 6,
      dx: 18,
      dy: 85,
      rotate: 46,
      delay: 30,
      fallDuration: 360,
    };
    const presentation = {
      key: 'clear-burst-gravity-test',
      lines: [],
      intersections: [],
      debris: [],
      sparks: [],
      cells: [burstCell],
      centroid: { x: 0, y: 0 },
      shake: { amplitude: 0, scale: 1, durationMs: 0 },
      praiseFontSize: 0,
      reducedMotion: false,
    };

    act(() => {
      create(<ClearBurstLayer presentations={[{ id: 'instance-2', presentation }] as never} />);
    });

    // Ищем shared value вертикали: отложенная последовательность
    // «вверх (jumpY), затем вниз за доску (dy)».
    const verticalLike = mockSharedValues.filter((shared) =>
      shared.__history.some((entry) => {
        if (!isDelay(entry) || entry.delayMs !== burstCell.delay) return false;
        if (!isSequence(entry.target)) return false;
        const [up, down] = entry.target.steps;
        return (
          isTiming(up) && up.to === burstCell.jumpY &&
          isTiming(down) && down.to === burstCell.dy
        );
      }),
    );
    expect(verticalLike.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Убедиться, что новый тест падает**

Run: `npx jest src/features/game/__tests__/clearBurstSeamless.test.tsx --testPathIgnorePatterns .worktrees`
Expected: FAIL — текущий `play` анимирует `ty` одним `withTiming(cell.dy, …)` без подскока. Существующие тесты (`opacity`-контракт, покрытие) остаются зелёными.

- [ ] **Step 3: Реализовать play()**

В `src/features/game/effects/ClearBurstLayer.tsx`:

1. Импортировать конфиг: `import { BURST_MOTION } from '../animation/motion';`
2. Заменить весь блок анимаций внутри `play(cell: ClearBurstCell)` после сброса поз (сброс — `x/y/size/color/tx/ty/rotate/scale/opacity` — оставить как есть, включая мгновенный `opacity.value = 1` с комментарием о бесшовности):

```ts
        const jumpMs = BURST_MOTION.jumpDurationMs;
        const fallMs = cell.fallDuration;

        // Подскок от удара (ease-out) → тяжёлое ускоряющееся падение за
        // нижний край доски (ease-in). Вращение добирает амплитуду весь полёт.
        ty.value = withDelay(
          cell.delay,
          withSequence(
            withTiming(cell.jumpY, { duration: jumpMs, easing: Easing.out(Easing.quad) }),
            withTiming(cell.dy, { duration: fallMs, easing: Easing.in(Easing.quad) }),
          ),
        );
        tx.value = withDelay(
          cell.delay,
          withSequence(
            withTiming(cell.driftX, { duration: jumpMs, easing: Easing.out(Easing.quad) }),
            withTiming(cell.dx, { duration: fallMs, easing: Easing.out(Easing.quad) }),
          ),
        );
        rotate.value = withDelay(
          cell.delay,
          withTiming(cell.rotate, { duration: jumpMs + fallMs, easing: Easing.out(Easing.quad) }),
        );
        scale.value = withDelay(
          cell.delay,
          withSequence(
            withTiming(BURST_MOTION.popScale, {
              duration: BURST_MOTION.popDurationMs,
              easing: Easing.out(Easing.quad),
            }),
            withTiming(BURST_MOTION.fallScale, {
              duration: jumpMs + fallMs - BURST_MOTION.popDurationMs,
            }),
          ),
        );
        // Затухание — только у нижней границы, чтобы осколки не ложились на трей.
        opacity.value = withDelay(
          cell.delay + jumpMs + fallMs - BURST_MOTION.fadeDurationMs,
          withTiming(0, { duration: BURST_MOTION.fadeDurationMs, easing: Easing.in(Easing.quad) }),
        );
```

- [ ] **Step 4: Прогнать тесты**

Run: `npx jest src/features/game/__tests__/clearBurstSeamless.test.tsx src/features/game/__tests__/clearEffectsLayers.test.tsx --testPathIgnorePatterns .worktrees`
Expected: PASS (opacity-контракт: мгновенная 1 + отложенное затухание ≥ delay — выполняется: `delay + 140 + 300 − 110 > delay`; никакого отложенного timing-to-1: scale финиширует на 0.9).

- [ ] **Step 5: Commit**

```bash
git add src/features/game/effects/ClearBurstLayer.tsx src/features/game/__tests__/clearBurstSeamless.test.tsx
git commit -m "feat(game): подскок и тяжёлое падение осколков в ClearBurstLayer" -- src/features/game/effects/ClearBurstLayer.tsx src/features/game/__tests__/clearBurstSeamless.test.tsx
```

---

### Task 4: Выпилить fragments/fallingFragments/BlockCrushLayer, урезать debris

**Files:**
- Modify: `src/features/game/animation/clearPresentation.ts`
- Modify: `src/features/game/effects/GameEffectsLayer.tsx`
- Delete: `src/features/game/effects/BlockCrushLayer.tsx`
- Test: `src/features/game/__tests__/clearPresentation.test.ts`, `src/features/game/__tests__/clearEffectsLayers.test.tsx`, фикстуры в `src/features/game/__tests__/clearBurstSeamless.test.tsx` и `src/features/game/__tests__/boardViewClearQueue.test.tsx`

- [ ] **Step 1: Обновить тесты под новую модель (падающие)**

В `clearPresentation.test.ts`:

1. Тест `is deterministic and keeps fragments close to their source cells` заменить целиком на:

```ts
  it('is deterministic and keeps debris a light accent', () => {
    const first = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);
    const second = buildClearPresentation(crossEvent(), GEOM, CELL_COLORS, false);

    expect(second).toEqual(first);
    expect(countAnimatedClearNodes(first)).toBeLessThanOrEqual(
      GAME_FEEL_MOTION.oneLineExternalEffectTargetCap,
    );
    // Крошка — акцент: 1 частица на 2 ячейки (cross = 15 ячеек → 7), падает за доску.
    expect(first.debris).toHaveLength(7);
    expect(first.debris.some(({ dy }) => dy > GEOM.boardSize)).toBe(true);
    expect(first.sparks).toHaveLength(6);
  });
```

2. В тесте `produces a restrained reduced-motion presentation` удалить строки про `fragments` (обе) и про `fallingFragments`; остальное оставить.

3. Тест `keeps one-line external effects inside the shared target cap` заменить на (фикстура 4-рядного клира — внутри теста; для фулл-клира крошку намеренно съедает бюджет нод в пользу контуров линий, поэтому cap проверяем на 4 рядах = 32 ячейки):

```ts
  it('caps debris chips regardless of clear size', () => {
    const fourRowCells = [2, 3, 4, 5].flatMap((row) =>
      Array.from({ length: 8 }, (_, col) => [row, col] as const),
    );
    const fourRowEvent: PlacementEvent = {
      ...rowEvent(),
      clearedRows: [2, 3, 4, 5],
      clearedCells: fourRowCells,
      clearedColors: fourRowCells.map((_, index) => (index % 3) + 1),
    };

    expect(buildClearPresentation(rowEvent(), GEOM, CELL_COLORS, false).debris).toHaveLength(4);
    expect(buildClearPresentation(fourRowEvent, GEOM, CELL_COLORS, false).debris).toHaveLength(16);
  });
```

В `clearEffectsLayers.test.tsx`:

4. Удалить `jest.mock('../effects/BlockCrushLayer', …)` (строки 44–50).
5. В source-contract тесте: добавить `expect(gameEffectsSource).not.toContain('BlockCrushLayer');` и удалить строку `expect(clearLayerSource).not.toContain('BlockCrushLayer');` вместе с комментарием над ней (файла больше нет — контракт против его использования в GameEffectsLayer).
6. В `hotLayerPaths` удалить строку с `BlockCrushLayer.tsx`.
7. В рендер-тесте: удалить обе проверки `findAllByProps({ testID: 'block-crush-layer' })` (в clearRenderer и effectsRenderer) и удалить ключи `fragments: []`, `fallingFragments: []` из `firstPresentation` (добавить `cells: []`, `debris: []` уже есть).

В `clearBurstSeamless.test.tsx` и `boardViewClearQueue.test.tsx`: удалить ключи `fragments: []` и `fallingFragments: []` из фикстур презентаций (в boardViewClearQueue — из мока `buildClearPresentation`).

- [ ] **Step 2: Убедиться, что новые ассерты падают**

Run: `npx jest src/features/game/__tests__/clearPresentation.test.ts src/features/game/__tests__/clearEffectsLayers.test.tsx --testPathIgnorePatterns .worktrees`
Expected: FAIL — debris сейчас 2-на-ячейку (не 7/4/16), `gameEffectsSource` содержит BlockCrushLayer.

- [ ] **Step 3: Реализовать чистку**

В `src/features/game/animation/clearPresentation.ts`:

1. Удалить интерфейсы `CrushFragment` и `FallingFragment`; из `ClearPresentation` удалить поля `fragments` и `fallingFragments`.
2. Удалить функции: `fragmentTravel`, `buildFragments`, `fallingTravel`, `buildFallingFragments`, `externalEffectCap`, `allocateSharedBudget`, `interleaveItems` и интерфейс `TaggedEffect`.
3. `countAnimatedClearNodes` — удалить слагаемые `presentation.fragments.length` и `presentation.fallingFragments.length`.
4. `applyPresentationNodeBudget` заменить целиком:

```ts
function applyPresentationNodeBudget(presentation: ClearPresentation): ClearPresentation {
  const lineShellNodes = presentation.lines.length * 2;
  if (lineShellNodes >= CLEAR_PRESENTATION_TOTAL_NODE_CAP) {
    const lineBudget = budgetLineDetail(presentation.lines, presentation.intersections, 0);
    return {
      ...presentation,
      lines: lineBudget.lines,
      intersections: lineBudget.intersections,
      debris: [],
      sparks: [],
    };
  }

  let remainingBudget = CLEAR_PRESENTATION_TOTAL_NODE_CAP - lineShellNodes;
  const totalLineDetailNodes =
    presentation.lines.reduce((sum, line) => sum + line.segments.length, 0) +
    presentation.intersections.length;
  const targetLineDetailBudget = Math.min(
    totalLineDetailNodes,
    totalLineDetailNodes <= 24
      ? totalLineDetailNodes
      : Math.max(
          presentation.lines.length + 4,
          Math.floor(CLEAR_PRESENTATION_TOTAL_NODE_CAP / 3),
        ),
  );
  const lineDetailBudget = Math.min(remainingBudget, targetLineDetailBudget);
  remainingBudget -= lineDetailBudget;

  const sparkBudget = Math.min(remainingBudget, presentation.sparks.length);
  remainingBudget -= sparkBudget;

  const lineBudget = budgetLineDetail(
    presentation.lines,
    presentation.intersections,
    lineDetailBudget,
  );

  return {
    ...presentation,
    lines: lineBudget.lines,
    intersections: lineBudget.intersections,
    debris: sampleItems(presentation.debris, remainingBudget),
    sparks: sampleItems(presentation.sparks, sparkBudget),
  };
}
```

5. `buildDebris` заменить целиком (та же траектория падения, счёт — акцентный):

```ts
function buildDebris(
  event: PlacementEvent,
  geom: ClearGeometry,
  getColor: (row: number, col: number) => string,
  random: () => number,
  reducedMotion: boolean,
): ClearDebris[] {
  if (event.clearedCells.length === 0) return [];
  const step = geom.cell + geom.gap;
  const chipCount = reducedMotion
    ? Math.min(SPECTACLE_MOTION.reducedDebris, event.clearedCells.length)
    : Math.min(
        BURST_MOTION.debrisCap,
        Math.max(2, Math.floor(event.clearedCells.length / BURST_MOTION.debrisPerCells)),
      );
  const sampledCells = sampleEffectCells(event.clearedCells, chipCount);

  return sampledCells.map(([row, col], index) => {
    const size = Math.max(2, geom.cell * (0.09 + random() * 0.1));
    const outwardX = (random() - 0.5) * geom.cell * 1.1;
    const impulseY = -geom.cell * (0.12 + random() * 0.12);
    return {
      id: `debris-${index}`,
      x: col * step + geom.cell * (0.18 + random() * 0.64),
      y: row * step + geom.cell * (0.18 + random() * 0.64),
      size,
      color: getColor(row, col),
      dx: reducedMotion ? 0 : outwardX,
      dy: reducedMotion ? 0 : geom.boardSize + impulseY + geom.cell * (0.55 + random() * 1.2),
      rotateDeg: reducedMotion ? 0 : (random() - 0.5) * 360,
      delay: SPECTACLE_MOTION.debrisStartMs + Math.round(random() * 60),
      duration: reducedMotion ? 180 : 340 + Math.round(random() * 160),
    };
  });
}
```

6. В `buildClearPresentation` удалить строки `fragments: buildFragments(…)` и `fallingFragments: buildFallingFragments(…)`.
7. В `clearPresentationLifetimeMs` удалить `latestFragment` и `latestFallingFragment` (и из финального `Math.max`).
8. В `SPECTACLE_MOTION` (motion.ts) удалить `maxDebris: 56` (нигде больше не используется; `debrisStartMs`/`reducedDebris` оставить — их использует `useShake`/reduced-ветка).

В `src/features/game/effects/GameEffectsLayer.tsx`: удалить `import { BlockCrushLayer } …` и строку `<BlockCrushLayer fragments={presentation.fallingFragments} />`.

Удалить файл: `git rm src/features/game/effects/BlockCrushLayer.tsx`.

- [ ] **Step 4: Прогнать тесты и типы**

Run: `npx tsc --noEmit` — Expected: чисто.
Run: `npx jest src/features/game --testPathIgnorePatterns .worktrees` — Expected: PASS все сюиты фичи.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/game/animation/clearPresentation.ts src/features/game/animation/motion.ts src/features/game/effects/GameEffectsLayer.tsx src/features/game/effects/BlockCrushLayer.tsx src/features/game/__tests__/clearPresentation.test.ts src/features/game/__tests__/clearEffectsLayers.test.tsx src/features/game/__tests__/clearBurstSeamless.test.tsx src/features/game/__tests__/boardViewClearQueue.test.tsx
git commit -m "refactor(game): единая система разрушения — без fragments/BlockCrushLayer, крошка-акцент" -- src/features/game/animation/clearPresentation.ts src/features/game/animation/motion.ts src/features/game/effects/GameEffectsLayer.tsx src/features/game/effects/BlockCrushLayer.tsx src/features/game/__tests__/clearPresentation.test.ts src/features/game/__tests__/clearEffectsLayers.test.tsx src/features/game/__tests__/clearBurstSeamless.test.tsx src/features/game/__tests__/boardViewClearQueue.test.tsx
```

---

### Task 5: Обновить спеку 04 и финальная верификация

**Files:**
- Modify: `docs/specs/04-design-system.md` (секция «Spectacle clear choreography (2026-06-13)», строки ~104–116)

- [ ] **Step 1: Переписать секцию хореографии**

Заменить в `docs/specs/04-design-system.md` заголовок и буллеты секции на:

```markdown
## Spectacle clear choreography (2026-07-02, «тяжёлая гравитация»)

- Every completed row or column is rendered from exactly eight cell-derived contour segments.
- Row/column intersections are deduplicated and receive one white chromatic flare.
- Destruction body: one pooled full-cell shard per cleared cell (up to 24, pool 48) — visible
  at full opacity in the exact cell pose on the same commit the board empties, hops up
  (ease-out, ~140 ms) and falls heavily past the bottom board edge (ease-in, 300–430 ms)
  with rotation; fades only near the bottom edge. Wave stagger from the placement point
  (`clearCellDelay`). Config: `BURST_MOTION` in `features/game/animation/motion.ts`.
- Intensity scales with cleared lines (1 → 1.0, 2 → 1.25, 3 → 1.5, 4+/full clear → 1.8):
  jump height, horizontal spread, rotation amplitude.
- Debris is a light accent: one deterministic chip per two cleared cells, capped at 16,
  plus six centroid sparks. The old quadrant crush/falling-fragment layers are removed.
- The phase order is line lock (35-165 ms), flare (90-205 ms), shard jump+fall (0-~650 ms
  by wave), debris (175-475 ms), praise (255-820 ms).
- Shake severity scales from a one-line nudge to 5 px plus 1.015 scale for four lines/full clear.
- Praise uses layered extrusion, bloom, a combo chip, and a score burst. Long labels remain on
  one line and shrink within a 3.5% board inset.
- Reduced motion disables shake and shard travel (short in-place fade), limits debris to 12,
  and keeps a short readable contour/praise pulse.
- Web roots (`html`, `body`, `#root`, navigation content) are always dark before hydration.
- Player-facing leaderboard states use only saved/offline language; current remote data has no
  technical "live backend" badge.
```

- [ ] **Step 2: Полная верификация**

Run: `npx tsc --noEmit` — Expected: чисто.
Run: `npm test` — Expected: все сюиты PASS (включая копию в `.worktrees` — она не тронута).

- [ ] **Step 3: Commit**

```bash
git add docs/specs/04-design-system.md
git commit -m "docs(specs): хореография разрушения «тяжёлая гравитация» в 04" -- docs/specs/04-design-system.md
```

- [ ] **Step 4: Проверка на устройстве (ручная)**

`npx expo start` → партия с клирами 1/2/3 линий: осколки видимы с кадра клира, подскакивают и падают за доску, не мигают на трее; шейк/звук как раньше. Числа при необходимости крутить только в `BURST_MOTION`.
