# Косметика-витрина (retention фаза 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Косметика Капи видна другим (аватар-бейдж в лидерборде, витрина в профиле), сезоны Adventure дают эксклюзивную косметику, дневной пул не пересекается с призами турнира, момент «тебя обогнали».

**Architecture:** Витринный образ сериализуется в компактную строку `stage|skin|hat|face|accessory|aura` (чистые serialize/parse в `mascot/logic/showcase.ts`, каталог — валидатор); клиент шлёт её с сабмитом рекорда, record-only сервер хранит на юзере и отдаёт в списке. Рендер — `MascotBadge` на базе существующего `MascotFigure`. Спека: `docs/superpowers/specs/2026-07-07-retention-rework-design.md` §3.

**Tech Stack:** TypeScript strict, zustand, Node http (backend/server.cjs, node:test), Jest.

---

### Task 1: Showcase-сериализация (mascot/logic/showcase.ts) — TDD

- Create `src/features/mascot/logic/showcase.ts`, `src/features/mascot/__tests__/showcase.test.ts`.
- `serializeShowcase(stage, equipped)` → `"2|skin-mint||face-glasses||"`; `parseShowcase(raw)` → `{stage, equipped} | null`, невалидные id/слоты отбрасываются послотно, мусор целиком → null; `getShowcaseAvatar()` — читает `useMascot`/`useProgression` (stage из `stageForLevel(level)`).
- Экспорт из `mascot/index.ts`.

### Task 2: Бэкенд — avatar в сабмите и списке (node:test)

- `backend/server.cjs`: `validateRunPayload` += optional `avatar` (string, trim, ≤96, `/^[1-4]\|[a-z0-9|-]*$/`; невалидный → null, не 4xx); POST /api/runs: `user.avatar = avatar ?? user.avatar`; `publicEntry`/fallback currentPlayer += `avatar: user.avatar ?? null`.
- Тесты в `backend/__tests__/server.test.cjs`: сабмит с avatar → список содержит его; невалидный avatar игнорируется, сабмит проходит; старый клиент без avatar — поле null.

### Task 3: Клиент-протокол

- `leaderboard/types.ts`: `LeaderboardEntry.avatar?: string | null`.
- `remoteClient.submitRun` += `avatar?: string | null` в body.
- `leaderboard/store.ts`: оба вызова `client.submitRun` шлют `avatar: getShowcaseAvatar()`; собственная строка в локальном снапшоте получает avatar (presentation).

### Task 4: UI-бейджи

- `mascot/components/MascotBadge.tsx`: `{ avatar: string | null | undefined; size?: number }` → parse + `MascotFigure`, null-safe. Экспорт из индекса.
- `LeaderboardRow`: бейдж (size 26) перед ником; совместим с чемпионской рамкой.
- `ProfileOverlay`: витрина своего Капи (MascotFigure, size 56, own equipped+stage) рядом с ником.

### Task 5: Сезонные награды + пулы

- `adventure/logic/config.ts`: `seasonRewards: { 1:'acc-jetpack', 2:'aura-sparkles', 3:'aura-stars', 4:'aura-rainbow', 5:'aura-fire' }` (+ helper `seasonRewardCosmetic(id): string | null`); за пределами — null.
- `app/adventure-level.tsx`: при завершении сезона → `useMascot.unlock(cosmetic)` + `season_reward_granted`.
- `SeasonCelebration`: строка «Новый предмет Капи» + `CosmeticIcon`, если награда есть.
- `DAILY_CONFIG.dailyCosmeticPool` → `['skin-chrome','hat-tophat','face-vr-visor','skin-obsidian']` (призы турнира hat-block-crown/face-monocle/acc-cape снова эксклюзив; комментарий в weeklyPrize.ts станет правдой).

### Task 6: «Тебя обогнали»

- Pure `detectOvertake(prev, next)` в `leaderboard/presentation.ts` (+ тест): same weekKey, rank ухудшился → `{ by: nickname|null, from, to }`.
- Store: `overtaken` transient + `ackOvertaken()`; детект в `refresh()` при замене снапшота; аналитика `overtaken_shown` при показе.
- Баннер в `WeeklyCard` («Тебя обогнал X — отыграйся!») и на экране лидерборда; гасится при открытии лидерборда.

### Task 7: Сквозное

- analytics/types: `season_reward_granted { seasonId, cosmeticId }`, `overtaken_shown { from, to }`.
- Спеки: 13?/17 (сезонная награда), 14 (пул), 05? — минимум: 17 + weeklyPrize комментарий; 02 при новых ключах (нет новых).
- `npx tsc --noEmit && npx jest && npm run backend:test` зелёные → коммит.

## Self-review
- Направления импортов: leaderboard→mascot (index) ново, mascot не импортирует leaderboard — цикла нет; adventure-level.tsx (app) → mascot — ок.
- Совместимость: старый сервер не отдаёт avatar → поле undefined → бейдж не рендерится; старый клиент к новому серверу — avatar просто не обновляется.
- Деплой сервера — отдельный шаг после мержа (не в этом плане).
