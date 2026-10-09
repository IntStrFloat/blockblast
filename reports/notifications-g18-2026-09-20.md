# G18 — полезные уведомления для любого режима

## Eligibility и prompt

HomePromptHost теперь всегда монтируется на Home: внешний Classic-only
gamesPlayed>=2 удалён. Единственный eligibility source:

- FTUE завершён или пропущен;
- минимум 3 distinct meaningful product sessions;
- не первая product session;
- OS permission ещё undetermined;
- soft ask не был обработан;
- Home свободен от blocking overlay/user dialog и auto-prompt slot.

Adventure win записывает meaningful mode=adventure, Classic clear — classic.
Поэтому Adventure-only игрок с 0 Classic и тремя полезными сессиями получает ту
же eligibility. Текст soft ask объясняет последнюю полезную причину: сохранённый
Adventure level либо Classic run/стрик.

Later и soft acceptance остаются single-shot. Soft accepted фиксируется отдельно
от OS result. Один Allow выполняет ровно один системный permission request:
Android local/RuStore используют тот же POST_NOTIFICATIONS result, без второго
диалога. granted, denied, unavailable и API error различаются. Ошибка начального
permission probe блокирует prompt и логируется без unhandled rejection.

Settings содержит явное «Настроить»: пользователь сам повторно запускает
permission flow; если OS не разрешил запрос из приложения, открываются системные
настройки. Автоматический prompt после Later/denied не возвращается.

## Правдивый план

Планировщик сохраняет quiet-time расписание и лимит не более одного managed
notification в день. Добавлены:

- saved Classic run → /game, текст обещает только продолжение сохранённой доски;
- active saved Adventure run → /adventure-level, текст обещает только
  продолжение сохранённого уровня;
- calendar-theme refresh использует server-owned G09 windowEndIso за день до
  обновления и явно говорит, что личная мозаика/кубок сохраняются.

Completed/removed target не ведёт в пустой run: /game падает на Home,
/adventure-level — на Adventure map. Foreground replan отменяет stale managed
jobs, в том числе после OS unsubscribe.

## Tap и meaningful return

Local и RuStore remote taps проходят прежний cold/warm dedupe и теперь оба
создают attribution id с уже проверенным актуальным route. /game и
/adventure-level фиксируют target viewed; первый valid move фиксирует
classic_move/adventure_move и закрывает attribution ровно один раз. Двойной tap
не создаёт второй переход.

Переход OS permission granted→denied фиксируется как notification_unsubscribed.
scripts/analytics/notifications-g18.sql строит:

- eligible→shown→soft accepted→OS granted по последнему meaningful mode;
- permission outcomes отдельно для soft ask и Settings;
- notification open→meaningful target action;
- unsubscribe counts.

Эти метрики не доказывают исправление оттока до первого возврата: prompt
появляется только после трёх полезных product sessions. D1/D7 оцениваются позже
по зрелым когортам.

## Приёмка

- Classic-only, Adventure-only с 0 Classic и mixed eligibility: PASS;
- first session/unfinished FTUE/handled Later/denied suppression: PASS;
- accepted отдельно от granted; denied/error различаются: PASS;
- один OS prompt на Allow: PASS;
- explicit Settings retry/open OS settings: PASS;
- truthful saved run and G09 calendar deadline: PASS;
- cold/warm/double tap and completed-target fallback: PASS;
- local/remote attribution to first meaningful move: PASS;
- unsubscribe detection and stale managed cancellation: PASS.

## Verification

- focused G18: 12 suites, 78 tests passed before permission hardening;
- permission/Home/RuStore regression: 5 suites, 23 tests passed;
- full frontend: 166 suites, 1063 tests passed;
- backend: 16 tests passed;
- TypeScript: pass;
- Expo lint: pass with two pre-existing warnings outside G18.
