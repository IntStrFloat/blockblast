# Weekly Leaderboards & Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить безопасный анонимный профиль, недельный соревновательный рейтинг и измеримые retention-механики, не ломая быстрый старт и offline-first core loop.

**Architecture:** Клиент остаётся полностью играбельным без сети. При первом доступном подключении создаётся анонимный серверный пользователь и профиль; сервер выдаёт одноразовые ranked-run tickets, а завершённые партии отправляются с журналом ходов и проверяются повторным проигрыванием чистого TS-движка. Leaderboard ранжирует игроков по их лучшему проверенному результату за глобальную неделю.

**Tech Stack:** Expo SDK 56 / React Native 0.85 / expo-router / Zustand / MMKV / pure TypeScript engine / Supabase Auth + Postgres + RLS + Edge Functions / Jest / Deno tests.

---

## 1. Зафиксированные продуктовые решения

### 1.1 Профиль и никнейм

- При первом запуске локально генерируется безопасный никнейм вида `NeonFox`, `PixelNova`, `LimeComet`.
- Игра запускается сразу: никаких обязательных регистраций, онбординг-попапов или блокирующих запросов.
- На Home в правом верхнем углу отображается compact glass-chip с никнеймом. Тап открывает лёгкий profile overlay.
- Никнейм можно изменить:
  - быстрый безопасный reroll из curated RU/EN-совместимых частей;
  - custom nickname длиной 3–16 символов после клиентской и обязательной серверной валидации;
  - запрещены ссылки, контакты, оскорбления, impersonation и невидимые Unicode-символы.
- Никнейм не обязан быть уникальным. Для идентификации сервер хранит короткий неизменяемый tag, например `PixelNova · 7K2`, но в обычном UI показывает только ник.
- Профиль не содержит фото, возраста, пола, чата, друзей и других PII.

### 1.2 Недельный рейтинг

- Неделя едина глобально: понедельник 00:00 UTC — следующий понедельник 00:00 UTC.
- `weeklyBest` = лучший проверенный результат одной завершённой партии игрока за неделю.
- Рейтинг награждает мастерство и личный рекорд, а не количество свободного времени и бесконечный гринд.
- Leaderboard показывает:
  - Top 3;
  - Top 100;
  - отдельный блок «рядом со мной»;
  - позицию, weekly best и число завершённых ranked-партий;
  - дельту позиции после нового результата.
- Ranked score фиксируется на первом Game Over. Rewarded revive не увеличивает ranked score.
- Незавершённые, повреждённые и непроверенные партии не попадают в рейтинг.
- При отсутствии сети игра работает как раньше; результат синхронизируется позже, если партия использовала заранее выданный ticket.

### 1.3 Offline-first и честность

- Сервер заранее выдаёт пул из 10 одноразовых ranked-run tickets `{ticketId, seed, expiresAt}`.
- Новая игра потребляет один ticket, если он есть; без ticket игра остаётся обычной локальной партией.
- Клиент пишет компактный журнал ходов `{trayIndex, row, col}`.
- На submit Edge Function заново создаёт игру по seed и проигрывает все ходы через существующий pure TS engine.
- Сервер принимает только совпадающий финальный score, одноразовый ticket, допустимую длительность и корректный порядок событий.
- Клиент никогда не пишет напрямую в таблицы `runs` и агрегаты leaderboard.

### 1.4 Retention-принципы

- Retention строится на мастерстве, самовыражении, общей активности и коротких достижимых целях.
- Нет P2W, loot boxes, fake players, fake urgency, публичного чата, guilt-попапов и наказания за пропуск.
- Leaderboard остаётся добровольной вторичной поверхностью: он не блокирует Home, не открывается автоматически и не превращает расслабляющую игру в обязательную социальную оценку.
- Любая новая механика запускается только после добавления событий аналитики и заранее заданного success/guardrail-критерия.
- Уведомления не входят в первый этап. Они допустимы только как отдельный opt-in эксперимент после доказанной ценности daily/weekly loop.

### 1.5 Child-safety и privacy gate

- Поскольку Gen Alpha включает пользователей младше 13 лет, до production-enable профилей и аналитики требуется отдельная юридическая оценка целевых рынков и child-directed статуса продукта.
- До этой оценки применяем data-minimization по умолчанию: нет контактов, геолокации, свободного bio, аватаров, публичного social graph и рекламных идентификаторов в first-party analytics.
- Если продукт признаётся child-directed, custom nickname и analytics включаются только в подтверждённой compliant-конфигурации; безопасный generated nickname и локальная игра остаются доступны.

---

## 2. UX в стиле текущего приложения

### Home

- Верхняя панель:
  - слева: settings icon;
  - справа: nickname chip с маленьким цветным block-dot и chevron;
  - chip использует `colors.surface`, `radii.button`, `AppText preset="caption"`, min touch target 44pt.
- Под текущим блоком Best/Streak добавить weekly-card:
  - строка `🏆 Эта неделя`;
  - крупно место `#42` или `—`;
  - `Рекорд недели: 12 480`;
  - тонкий progress bar до ближайшего игрока;
  - тап открывает `/leaderboard`.
- При offline/error карточка не исчезает: показывает последний snapshot и ненавязчивый статус `обновится при подключении`.

### Profile overlay

- Glass overlay, аналогичный текущим Pause/GameOver.
- Показывает nickname, короткий tag, кнопку reroll, поле custom nickname и Save.
- Ошибки отображаются inline; Alert не используется для обычной валидации.
- После успешной смены — короткая scale/fade-анимация, без конфетти и блокировки.

### Leaderboard (`/leaderboard`)

- Header: back, title, countdown до конца недели.
- Podium Top 3 из цветных block-карточек.
- Ниже виртуализированный список Top 100.
- Строка текущего пользователя закреплена снизу, если он вне видимой области.
- Состояния: loading skeleton, cached/offline, empty first week, error with retry.
- Никаких аватаров и пользовательских описаний.

### Game Over

- После первого Game Over показывать небольшой результат weekly impact:
  - `Новый рекорд недели: 1 240` или `Рекорд недели не улучшен`;
  - `↑ 6 мест`, если позиция обновилась после sync;
  - при offline — `результат сохранён, отправим позже`.
- Этот блок не задерживает кнопки Play Again/Home и не блокирует следующий запуск.

---

## 3. Целевая структура файлов

### Клиент

- Create: `src/features/profile/nickname.ts` — генерация, нормализация и локальная валидация никнейма.
- Create: `src/features/profile/store.ts` — локальный профиль, sync state, rename/reroll actions.
- Create: `src/features/profile/components/ProfileChip.tsx` — никнейм в верхнем правом углу Home.
- Create: `src/features/profile/components/ProfileOverlay.tsx` — изменение никнейма.
- Create: `src/features/profile/index.ts` — public API.
- Create: `src/features/profile/__tests__/nickname.test.ts`
- Create: `src/features/profile/__tests__/store.test.ts`

- Create: `src/features/leaderboard/types.ts` — DTO и client-only state.
- Create: `src/features/leaderboard/config.ts` — UTC week, top count, ticket pool size.
- Create: `src/features/leaderboard/week.ts` — чистые функции границ недели и countdown.
- Create: `src/features/leaderboard/runProof.ts` — журнал ranked-ходов и submit payload.
- Create: `src/features/leaderboard/client.ts` — интерфейс backend client + Noop/offline implementation.
- Create: `src/features/leaderboard/supabaseClient.ts` — реальный adapter.
- Create: `src/features/leaderboard/store.ts` — tickets, pending submissions, cached snapshot, sync.
- Create: `src/features/leaderboard/components/WeeklyCard.tsx`
- Create: `src/features/leaderboard/components/LeaderboardRow.tsx`
- Create: `src/features/leaderboard/components/Podium.tsx`
- Create: `src/features/leaderboard/index.ts`
- Create: `src/features/leaderboard/__tests__/week.test.ts`
- Create: `src/features/leaderboard/__tests__/runProof.test.ts`
- Create: `src/features/leaderboard/__tests__/store.test.ts`

- Create: `src/features/analytics/types.ts` — типизированный каталог событий без PII.
- Create: `src/features/analytics/noop.ts` — default provider.
- Create: `src/features/analytics/supabase.ts` — first-party batch upload.
- Create: `src/features/analytics/store.ts` — offline queue и batching.
- Create: `src/features/analytics/index.ts`
- Create: `src/features/analytics/__tests__/store.test.ts`

- Create: `src/app/leaderboard.tsx`
- Modify: `src/app/index.tsx` — top bar, ProfileChip, WeeklyCard, sync on focus.
- Modify: `src/app/game.tsx` — начать/продолжить ranked proof вместе с партией.
- Modify: `src/app/settings.tsx` — privacy/analytics controls и перенос settings icon из Home top-right.
- Modify: `src/features/game/store.ts` — lifecycle hooks для ranked run; не импортировать внутренности leaderboard, только его public API.
- Modify: `src/features/game/components/GameOverOverlay.tsx` — weekly impact state.
- Modify: `src/core/storage/index.ts` — новые централизованные MMKV keys.
- Modify: `src/core/i18n/ru.ts`
- Modify: `src/core/i18n/en.ts`
- Modify: `src/ui/theme.ts` — только недостающие semantic tokens для rank/progress states.

### Backend

- Create: `supabase/config.toml`
- Create: `supabase/migrations/202606130001_competition.sql`
- Create: `supabase/migrations/202606130002_rls.sql`
- Create: `supabase/migrations/202606130003_analytics.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/nickname.ts`
- Create: `supabase/functions/_shared/replay.ts`
- Create: `supabase/functions/profile/index.ts`
- Create: `supabase/functions/ranked-runs/index.ts`
- Create: `supabase/functions/leaderboard/index.ts`
- Create: `supabase/functions/events/index.ts`
- Create: `supabase/functions/ranked-runs-test/index.test.ts`
- Create: `supabase/functions/profile-test/index.test.ts`

### Документация

- Modify: `docs/specs/01-screens.md`
- Modify: `docs/specs/02-architecture.md`
- Modify: `docs/specs/06-audience.md`
- Modify: `docs/privacy.html`
- Modify: `store/privacy.html`
- Create: `docs/specs/09-competition-retention.md`
- Create: `docs/runbooks/leaderboard-operations.md`

---

## 4. Backend data model

### `profiles`

| Column | Type | Rule |
|---|---|---|
| `user_id` | `uuid primary key` | equals Auth user id |
| `nickname` | `text` | display value, 3–16 chars |
| `nickname_normalized` | `text` | moderation/search only |
| `tag` | `text unique` | immutable short discriminator |
| `created_at` | `timestamptz` | server time |
| `updated_at` | `timestamptz` | server time |

### `ranked_tickets`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid primary key` | single use |
| `user_id` | `uuid` | ticket owner |
| `seed` | `integer` | server-generated game seed |
| `issued_at` | `timestamptz` | server time |
| `expires_at` | `timestamptz` | 14 days |
| `consumed_at` | `timestamptz null` | set atomically on accepted submit |

### `verified_runs`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid primary key` | server-generated |
| `ticket_id` | `uuid unique` | prevents replay |
| `user_id` | `uuid` | owner |
| `week_start` | `date` | derived by server in UTC |
| `score` | `integer` | result of server replay |
| `moves_count` | `integer` | abuse analysis |
| `duration_ms` | `integer` | abuse analysis |
| `created_at` | `timestamptz` | accepted time |

### `weekly_leaderboard`

Database view/materialized projection:

- group by `user_id, week_start`;
- `weekly_best = max(verified_runs.score)`;
- expose rank, nickname, tag, weekly best и число завершённых ranked-партий;
- refresh/update after accepted submit;
- public read returns only safe profile fields and aggregate score.

### `product_events`

- Minimal first-party events tied to anonymous `user_id`.
- No free-form values, advertising id, contacts, precise location or device fingerprint.
- Raw retention events expire after 90 days; weekly aggregates may be kept longer.

---

## 5. Execution plan

### Task 1: Architecture spike and dependency gate

- [ ] Confirm hosted vs self-hosted Supabase deployment target and latency from target RuStore region.
- [ ] Verify anonymous Auth, token persistence in React Native/MMKV adapter, RLS and Edge Function invocation in Expo SDK 56.
- [ ] Verify that the Edge Function can reuse/replay the existing pure TS engine without maintaining a hand-copied scoring implementation.
- [ ] Preferred approach: import canonical engine modules into `supabase/functions/_shared/replay.ts`.
- [ ] Fallback if bundling outside `supabase/functions` is unsupported: add a deterministic build script that copies only pure engine modules into `_shared/generated-engine`, then compare hashes in CI.
- [ ] Add only the approved runtime dependency `@supabase/supabase-js`; Supabase CLI remains a dev tool.
- [ ] Record the selected deployment and engine-sharing decision in `docs/specs/09-competition-retention.md`.
- [ ] Verification: anonymous session survives app restart; local Supabase stack starts; sample Edge Function requires a valid JWT.
- [ ] Commit using Lore protocol with `Scope-risk: moderate` and explicit deployment constraint.

### Task 2: Pure nickname domain and local profile

- [ ] Write failing tests for deterministic nickname generation, reroll, normalization, length limits, whitespace collapsing, forbidden invisible characters and fallback behavior.
- [ ] Add `profile.local` and `profile.sync` to `KEYS` in `src/core/storage/index.ts`.
- [ ] Implement `src/features/profile/nickname.ts` with curated adjective/noun lists and locale-neutral ASCII output.
- [ ] Implement profile Zustand store that creates a local nickname immediately and never blocks Home rendering.
- [ ] Persist `nickname`, `tag`, `serverUserId`, `syncStatus`, `lastError`.
- [ ] Add public exports through `src/features/profile/index.ts`.
- [ ] Verification: `npm test -- profile`, `npm run typecheck`.
- [ ] Commit: why the app needs an identity without registration.

### Task 3: Profile backend, moderation and anonymous sync

- [ ] Add `profiles` migration and RLS:
  - public authenticated read only of `nickname` and `tag`;
  - no direct client insert/update;
  - writes only through authenticated Edge Function.
- [ ] Implement profile Edge Function actions: `get-or-create`, `rename`, `reroll`.
- [ ] Normalize on server and reject reserved names, links, contacts, slurs, invisible/control characters and excessive rename frequency.
- [ ] Rate limit rename to 5 successful changes per 24 hours.
- [ ] Return stable machine-readable error codes for i18n mapping.
- [ ] Add Deno tests for accepted/rejected RU/EN nicknames, auth ownership and rate limit.
- [ ] Connect client profile store; failures preserve local profile and retry later.
- [ ] Verification: two anonymous users can share a nickname but have different tags; one user cannot modify another profile.
- [ ] Commit using Lore protocol with nickname safety directive.

### Task 4: Profile UI and Home top bar

- [ ] Add i18n strings for profile, validation, offline and sync states.
- [ ] Implement `ProfileChip` in the current dark/glass visual language.
- [ ] Implement `ProfileOverlay` with reroll and custom nickname editing.
- [ ] Move settings entry to the left side of a Home top bar; keep both controls at least 44pt.
- [ ] Add accessibility labels, focus order and reduced-motion-safe transitions.
- [ ] Add component-level logic tests where practical; avoid snapshot carpets.
- [ ] Manual verification on narrow Android screen, RU long strings and offline mode.
- [ ] Commit after `npm test`, `npm run typecheck`, `npm run lint`.

### Task 5: Ranked run proof on the client

- [ ] Write failing tests for proof creation, move append, save/restore, first-Game-Over freeze and retry idempotency.
- [ ] Add storage keys for ticket pool, active proof, pending submissions and leaderboard cache.
- [ ] Implement ticket consumption when `newGame()` starts; continuing a saved game continues the same proof.
- [ ] Append only successful placements to the proof.
- [ ] Freeze ranked score at first Game Over; later revive gameplay remains local and does not mutate the proof.
- [ ] Keep pending submissions bounded: max 20, drop oldest expired/unranked payloads first.
- [ ] Wire through `features/leaderboard` public API instead of coupling game store to Supabase.
- [ ] Verification: existing game/store tests remain green; new tests cover offline restart and revive.
- [ ] Commit with directive that ranked proof must not affect core scoring.

### Task 6: Ranked backend and replay verification

- [ ] Add migrations for `ranked_tickets`, `verified_runs`, indexes and RLS.
- [ ] Implement authenticated `ranked-runs` Edge Function actions:
  - `issue-tickets`;
  - `submit`;
  - `submission-status`.
- [ ] On submit, atomically lock ticket, replay seed + moves, confirm first Game Over score, validate duration/move bounds, insert verified run and consume ticket.
- [ ] Reject reused tickets, impossible moves, mismatched scores, expired tickets and oversized payloads.
- [ ] Never trust client `week_start`, rank or weekly best.
- [ ] Add abuse limits per user/IP without storing a durable device fingerprint.
- [ ] Add Deno tests for valid replay, invalid move, score tampering, ticket replay and concurrency.
- [ ] Verification: 100 identical proof replays return identical scores; concurrent double-submit produces one run.
- [ ] Commit using Lore protocol with anti-cheat limitations and residual risks.

### Task 7: Leaderboard query and aggregation

- [ ] Add SQL view/function that calculates each player’s best verified run per UTC week.
- [ ] Implement query returning Top 100, current player and ±3 neighbors in one response.
- [ ] Add stable tie-breakers: weekly best desc, fewer ranked attempts asc, earliest achievement asc.
- [ ] Add `leaderboard` Edge Function with server time and next reset timestamp.
- [ ] Ensure profiles marked/moderated later can be hidden without deleting run history.
- [ ] Add SQL integration tests for week boundary, fewer than 5 runs, more than 5 runs, ties and empty week.
- [ ] Verification: query plan uses indexes and stays below agreed latency with 100k synthetic runs.
- [ ] Commit with tested query plan summary.

### Task 8: Leaderboard client store and screen

- [ ] Write store tests for cache-first load, refresh, offline fallback, pending sync, stale snapshot and rank delta.
- [ ] Implement typed backend adapter and Noop/offline adapter.
- [ ] Implement `/leaderboard` with podium, Top 100, around-me row, countdown and states.
- [ ] Implement `WeeklyCard` on Home and weekly impact block on Game Over.
- [ ] Refresh on Home/Leaderboard focus with a minimum interval; never poll during gameplay.
- [ ] Preserve last good snapshot in MMKV.
- [ ] Manual visual check against current Home/Game screenshots and both block themes.
- [ ] Verification: airplane-mode launch, reconnect-and-sync, week rollover and user outside Top 100.
- [ ] Commit after full client checks.

### Task 9: Privacy-minimal analytics foundation

- [ ] Define typed events and allowed properties before implementing retention features.
- [ ] Implement Noop provider as default and first-party Supabase event batching behind a config flag.
- [ ] Queue offline events with max size and 90-day server retention.
- [ ] Add opt-out in Settings; opt-out clears queued unsent events and stops future collection.
- [ ] Update both privacy documents before enabling production upload.
- [ ] Add backend validation so arbitrary event names/properties cannot be stored.
- [ ] Verification: no nickname, move log, free-form text, advertising id or precise device data enters analytics events.
- [ ] Commit with explicit privacy constraint and retention period.

### Task 10: Retention MVP — weekly personal goal

- [ ] Add a personal weekly target derived from the player’s recent personal-best baseline, not a global impossible threshold.
- [ ] Show progress only on Home/Leaderboard/Game Over; no interrupting popup.
- [ ] Reward completion with a cosmetic profile accent/title valid for the following week.
- [ ] Do not reduce progress or shame missed weeks.
- [ ] Instrument exposure, progress, completion and next-week return.
- [ ] Run as 50/50 experiment after leaderboard reliability is proven.
- [ ] Success: D7 and weekly returning players improve without lower average session satisfaction proxy or increased uninstall/error guardrails.

### Task 11: Retention MVP — daily shared-seed challenge

- [ ] Add a separate Daily Challenge entry on Home only after the user has completed at least 3 normal games.
- [ ] Use a date-derived or server-issued shared seed and one highlighted result per day.
- [ ] Reuse the same replay verification path; keep normal play available offline.
- [ ] Add share text/card with score, percentile and short challenge code, without forced CTA.
- [ ] Allow a friend to paste/open the challenge code and play the same seed without contacts access, friend graph or social login.
- [ ] No streak punishment for missing a day.
- [ ] Measure challenge exposure/start/completion, share sent, challenge-code use and D1/D7 uplift.
- [ ] Ship only if it does not reduce normal-game completion materially.

### Task 12: Retention MVP — rank movement and near-me motivation

- [ ] Show rank delta only after a verified submission.
- [ ] Prefer `до следующего места: 320` over pressure-heavy countdown text.
- [ ] Celebrate meaningful milestones: first ranked result, first Top 50%, Top 25%, Top 10%, Top 3.
- [ ] Do not fire celebration for every small movement.
- [ ] Add a post-week recap card shown once, dismissible immediately.
- [ ] Measure leaderboard revisit and next-week participation; guard against session-length inflation without retention gain.

### Task 13: Later experiments, one at a time

- [ ] Weekly mission ladder with 3–4 small mastery goals and cosmetic-only rewards; no energy, timers or paid progress.
- [ ] Cosmetic collection earned by participation/milestones, never score multipliers.
- [ ] Gentle comeback goal after 7+ inactive days, with no “you lost X” copy.
- [ ] One weekly streak shield earned through normal play, not purchase.
- [ ] Night-session calmer feedback mode after 22:00 local time.
- [ ] Opt-in local notification only after a player explicitly engages with daily/weekly goals.
- [ ] Seasonal themed leaderboard with cosmetic-only rewards.
- [ ] Each experiment requires a written hypothesis, exposure event, success metric, guardrails and kill switch.

### Task 14: Operations, moderation and rollout

- [ ] Create `docs/runbooks/leaderboard-operations.md` with disable flag, nickname moderation, suspicious run review, week reset and incident steps.
- [ ] Add remote/config flags: profile sync, ranked submit, leaderboard read, analytics upload, each retention experiment.
- [ ] Stage rollout:
  - internal/dev with synthetic users;
  - 5% read-only leaderboard;
  - 5% ranked submissions;
  - 25%;
  - 100% after one clean week boundary.
- [ ] Alert on submit rejection spike, Edge Function errors, leaderboard latency, duplicate tickets and anomalous score distribution.
- [ ] Provide a kill switch that hides competition UI while preserving local game and pending data.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npx expo-doctor`, Deno tests and manual offline/reconnect smoke.
- [ ] Update specs and release notes.

---

## 6. Retention backlog: impact / effort / risk

| Feature | Impact | Effort | Risk | Priority |
|---|---:|---:|---:|---:|
| Weekly personal-best leaderboard + around-me | High | High | Medium | P0 |
| Weekly personal goal | High | Medium | Low | P0 after analytics |
| Rank delta + milestone celebration | Medium/High | Low | Low | P0 |
| Daily shared-seed challenge | High | Medium/High | Medium | P1 |
| Shareable result card + manual friend challenge | High | Medium | Low | P1 |
| Weekly mission ladder, cosmetic-only | High | Medium | Medium | P1 |
| Cosmetic profile accents/titles | Medium | Medium | Low | P1 |
| Post-week recap | Medium | Low | Low | P1 |
| Better share card with percentile/rank | Medium | Medium | Low | P1 |
| Gentle comeback goal | Medium | Low | Medium | P2 |
| Earned streak shield | Medium | Medium | Medium | P2 |
| Night calm mode | Low/Medium | Low | Low | P2 |
| Opt-in notifications | Medium | Medium | High | P3, only after proof |
| Seasonal cosmetic leaderboard | Medium | High | Medium | P3 |

---

## 7. Analytics events and metrics

### Required events

- `profile_created`
- `app_open`
- `home_view`
- `game_start`
- `game_resume`
- `game_over`
- `new_record`
- `streak_bumped`
- `streak_lost`
- `profile_chip_opened`
- `nickname_rerolled`
- `nickname_change_submitted`
- `nickname_change_result`
- `ranked_ticket_consumed`
- `ranked_run_finished`
- `ranked_run_queued`
- `ranked_run_submit_result`
- `leaderboard_card_viewed`
- `leaderboard_opened`
- `leaderboard_loaded`
- `rank_milestone_reached`
- `weekly_goal_exposed`
- `weekly_goal_completed`
- `daily_challenge_started`
- `daily_challenge_completed`
- `challenge_code_copied`
- `challenge_code_used`
- `share_started`
- `share_completed`
- `weekly_mission_started`
- `weekly_mission_completed`
- `cosmetic_unlocked`
- `cosmetic_equipped`

Allowed properties are enums/numbers/booleans only. Never send nickname, tag, move list or arbitrary error text as analytics properties.

### Primary metrics

- D1, D3, D7, D14, D30 retention.
- Weekly returning players.
- Sessions per user per day and games per session.
- Saved-game resume rate.
- Streak activation, day-2/day-7 survival and recovery after a miss.
- Ranked participation rate.
- Percentage of players who set a weekly record and later improve it.
- Leaderboard revisit rate.
- Daily Challenge start/completion rate.
- Challenge-code copy-to-use conversion.
- Share completion rate.
- Cosmetic unlock/equip rate.
- Week-over-week return after recap/goal completion.

### Guardrails

- Time to first game and first-game completion rate.
- Offline game start success.
- Crash-free sessions and Edge Function error rate.
- Median/p95 leaderboard load latency.
- Nickname rejection rate.
- Ranked submit rejection rate.
- Average session length: growth without retention uplift is not automatically success.
- Ad/revive engagement must not influence ranked fairness.

---

## 8. Что сознательно не внедрять

- Raw endless weekly score as the default ranking.
- P2W boosts, paid extra ranked attempts or paid streak preservation.
- Loot boxes, gacha, random paid cosmetics.
- Fake players, fake rank movement or fabricated social proof.
- Open chat, DMs, image avatars or searchable personal profiles.
- Contacts upload and “invite all friends”.
- Public free-form bio.
- Hidden RNG rigging or production “God Mode” that secretly changes difficulty.
- Shame copy, red warning spam, punitive streak resets and forced countdowns.
- Notifications before demonstrated value and explicit opt-in.
- Mandatory account creation before play.

---

## 9. Acceptance criteria for public launch

- A new user reaches the first game in the same number of taps as before.
- A nickname exists immediately and can be changed without registration.
- Offline gameplay, save/restore, scores and streak remain functional.
- A verified ranked run cannot be submitted twice or with a modified score.
- Weekly leaderboard score equals the player’s best verified run in the current UTC week.
- Leaderboard shows Top 100 plus the current player/nearby slice.
- Revive never increases ranked score.
- Competition can be disabled remotely without breaking the game.
- All user-facing strings exist in RU and EN.
- Privacy policy describes anonymous identity, leaderboard and first-party analytics before production enablement.
- Child-safety/privacy review is complete before enabling public profiles or analytics for a product directed at children under 13.
- Client tests, typecheck, lint, Expo Doctor, Edge Function tests and manual offline/reconnect smoke are green.

---

## 10. Recommended delivery sequence

1. **Release A — Identity foundation:** local/generated nickname, profile chip, anonymous sync, safe rename.
2. **Release B — Leaderboard beta:** tickets, verified runs, cached weekly leaderboard, no retention rewards yet.
3. **Release C — Analytics + rank feedback:** first-party typed events, rank delta, milestones, post-week recap.
4. **Release D — Retention experiment 1:** weekly personal goal with cosmetic profile accent.
5. **Release E — Retention experiment 2:** daily shared-seed challenge.
6. **Release F — Expand only what metrics validate:** cosmetics, comeback goal, opt-in notifications, seasons.

This order prevents the team from adding engagement mechanics before leaderboard reliability, privacy and measurement are proven.

---

## 11. External technical references

- Supabase anonymous sign-ins: `https://supabase.com/docs/guides/auth/auth-anonymous`
- Supabase Row Level Security: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase Edge Functions: `https://supabase.com/docs/guides/functions`
- Supabase Edge Function shared code guidance: `https://supabase.com/docs/guides/functions/development-environment`
- Expo SDK 56 docs: `https://docs.expo.dev/versions/v56.0.0/`
- FTC COPPA rule: `https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa`
- FTC dark-patterns report: `https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers`
- Pew Research Center, Teens, Social Media and Technology 2024: `https://www.pewresearch.org/internet/2024/12/12/teens-social-media-and-technology-2024/`
- Common Sense Media, 2025 Census (ages 0–8): `https://www.commonsensemedia.org/research/the-2025-common-sense-census-media-use-by-kids-zero-to-eight`
