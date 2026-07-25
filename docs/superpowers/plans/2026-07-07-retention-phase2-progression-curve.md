# Кривая прогрессии (retention фаза 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Уровень 1 берётся в первой сессии, мир 2 — за 2–3 дня игры; награды уровней спереди; события `level_up`/`world_unlocked`/`streak_lost` для когорт.

**Architecture:** Уровень/мир — производные от `lifetimePoints` (пересчёт в `buildInitial` при загрузке), гардероб сверяется в `useProgressionSync` → миграция и догоняющие награды происходят сами; меняется только конфиг + события + тесты. Спека: `docs/superpowers/specs/2026-07-07-retention-rework-design.md` §2.

**Tech Stack:** TypeScript strict, zustand, Jest.

---

### Task 1: Конфиг кривой

**Files:** Modify `src/features/progression/logic/config.ts`

- [ ] Новые значения (важно: `tierGaps` из 6 гэпов → 7 миров = 7 тем, world starts = [1,4,8,13,19,27,37]; `levelRewards` не ставить на старты миров — там их шэдоуит world-награда):

```ts
levelCost: { base: 2500, growth: 1.12 },
tierGaps: [3, 4, 5, 6, 8, 10],
maxAuthoredLevel: 64,
evolutionAtWorld: { 1: 1, 2: 2, 4: 3, 6: 4 },
worldThemeId: { 1: 'classic', 2: 'neon', 3: 'sunset', 4: 'mono', 5: 'aqua', 6: 'galaxy', 7: 'gold' },
levelRewards: {
  1: { kind: 'cosmetic', id: 'hat-casquette' },
  2: { kind: 'helper', id: 'hint' },
  3: { kind: 'cosmetic', id: 'face-glasses' },
  5: { kind: 'cosmetic', id: 'acc-headphones' },
  6: { kind: 'helper', id: 'swap' },
  7: { kind: 'cosmetic', id: 'skin-mint' },
  9: { kind: 'cosmetic', id: 'hat-panama' },
  11: { kind: 'cosmetic', id: 'face-sunglasses' },
  14: { kind: 'cosmetic', id: 'acc-scarf' },
  16: { kind: 'cosmetic', id: 'skin-coral' },
  18: { kind: 'cosmetic', id: 'hat-beanie' },
  21: { kind: 'cosmetic', id: 'face-star-eyes' },
  24: { kind: 'cosmetic', id: 'acc-backpack' },
},
```

Пейсинг (медианная партия ≈1000, ~3 партии/день + дейли-бонус): уровень 1 = 2500 ≈ первая сессия; мир 2 (уровень 4) = 8436 ≈ 2–3 дня; мир 3 (уровень 8) ≈ 25k ≈ неделя.

### Task 2: События аналитики

**Files:** Modify `src/features/analytics/types.ts`, `src/features/progression/store.ts`, `src/features/streak/store.ts`; tests `src/features/progression/__tests__/store.test.ts`, `src/features/streak/__tests__/store.test.ts` (или создать).

- [ ] types: `level_up: { level: number; world: number }`, `world_unlocked: { world: number }`, `streak_lost: { count: number }`.
- [ ] `progression.addPoints`: при `toLevel > fromLevel` → `level_up`; при `enteredWorld !== null` → `world_unlocked` (импорт `useAnalyticsStore` — паттерн как в dailybonus/store).
- [ ] `streak.markPlayedToday`: если `prev.count > 1 && next.count === 1 && prev.lastDay !== today` → `streak_lost { count: prev.count }`.
- [ ] Тесты на все три события (TDD: сначала красные).

### Task 3: Обновить тесты под новую кривую

**Files:** `src/features/progression/__tests__/{levels,worlds,rewards,sync,store,map}.test.ts`, `src/features/mascot/__tests__/{decouplingContract,store}.test.ts`

- [ ] Заменить старые числа (14000, старты [1,6,13,22,33,47,65,87], уровни наград 4/5/8/9…) на новые ([1,4,8,13,19,27,37], hint=2, swap=6 и т.д.), сохранив смысл кейсов. Прогнать `npx jest src/features/progression src/features/mascot src/features/streak`.

### Task 4: Спеки и коммит

- [ ] `docs/specs/11-progression-core.md`: новые числа конфига, заметка о миграции «подскок уровня + догоняющие награды одним пересчётом».
- [ ] `docs/specs/12-game-themes.md`: темп разлока миров (мир 2 за 2–3 дня, все 7 миров ≈ 2–3 месяца активной игры).
- [ ] `npx tsc --noEmit && npx jest` зелёные → коммит `feat(progression): перекрой кривой — уровень в первой сессии, миры за дни, события level_up/world_unlocked/streak_lost`.

## Self-review

- Миграция без кода: `buildInitial` пересчитывает level/world из lifetimePoints; `useProgressionSync` доначисляет косметику; helpers — производные (`isHelperUnlocked`). Проверено чтением store.ts/sync.ts/hooks.
- `levelRewards` не пересекаются со стартами миров [4,8,13,19,27,37] — проверить в тесте rewards.
- Один суммарный reveal при подскоке: reveal владеет координатор — поведение не меняем (пересчёт при загрузке не создаёт reveal вовсе, награды тихо доначисляются гардеробом — приемлемо, отметить в спеке 11).
