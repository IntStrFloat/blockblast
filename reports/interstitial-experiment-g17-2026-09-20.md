# G17 — эксперимент рекламной нагрузки

## Политика

Эксперимент interstitial-first-session-v1 меняет только interstitial:

| Вариант | Global shield | Cadence | Cooldown | Первая product session | Session cap |
| --- | ---: | ---: | ---: | --- | ---: |
| control | 6 завершённых runs | every 3 соответствующих outcomes | 90 s | текущая политика | без нового cap |
| first_session_capped | те же 6 | тот же every 3 | те же 90 s | interstitial подавлен | максимум 2 shown |

Rewarded revive/helper остаётся добровольным, не увеличивает interstitial count,
но сохраняет общий fullscreen cooldown anchor. Баннеры, Home, FTUE, сложность,
награды и генератор не менялись.

Kill switch:
EXPO_PUBLIC_INTERSTITIAL_EXPERIMENT_ENABLED=false. Он возвращает policy resolver
к control без изменения сохранённых assignment/counter данных. Неназначенные
обновившиеся установки остаются control; только new_install в первой product
session получает стабильный случайный assignment.

## Eligibility и доставка

Assignment фиксируется на старте для **всех назначенных новых установок** через
experiment_assignment. Основной анализ поэтому intention-to-treat и включает
тех, кто никогда не дошёл до рекламы.

Когда текущая min6/everyN/90 политика впервые разрешает opportunity, обе группы
попадают в одну точку interstitial_policy_eligible. Событие содержит вариант,
request/suppression decision, mode, placement, active play ms, session depth,
product session id и число показов в сессии. experiment_exposure фиксируется в
той же точке и не используется как знаменатель D1.

Реальный SDK preload получает собственный loadId: ad_load_requested и
ad_loaded/ad_failed возникают в момент loadAd completion, а не синтетически при
cache hit. Show-attempt получает attemptId и ссылку на тот же loadId; request,
shown, dismiss/fail/result дополнены policy context. Если cached ad отсутствует,
showInterstitial немедленно возвращает unavailable и запускает новый preload в
фоне: replay/offline не ждёт сеть.

Cooldown, cadence reset и session count критически сохраняются из
onAdImpression, до dismiss. Идемпотентный callback не считает impression дважды;
process interruption между impression и dismiss уже не теряет реальный показ.
No-fill без impression не расходует cap.

## Сценарная приёмка

- шесть коротких Adventure wins в первой сессии: control запрашивает шестую
  opportunity, treatment фиксирует её и подавляет;
- mixed Classic + Adventure: общий shield считает оба режима, локальный
  every-N counter остаётся placement-specific;
- background/resume сохраняет product session id и cap;
- cold start/new product session сбрасывает только session cap, не глобальный
  cadence/cooldown;
- return from rewarded не увеличивает interstitial count и соблюдает 90 s;
- no fill не потребляет counter/cap;
- impression до dismiss/process interruption уже сохраняет cooldown/cap;
- preload success/failure имеет настоящий loadId и не подменяется cache hit;
- unassigned update остаётся control;
- стабильность assignment проверена через storage/process boundary.

## Анализ

scripts/analytics/interstitial-experiment-g17.sql строит:

- D1/D7 по всем assigned installations, версии, источнику и классу устройства;
- second product session;
- opportunity/request/suppression funnel;
- request/load/show/dismiss/fail delivery;
- active-play/session-depth и frame-budget guardrail.

Primary: calendar D1 зрелых новых установок. Secondary: second session и D7.
Freeze/crash/ANR сверяются с AppMetrica export по версии и варианту, а не
локальным отсутствием ошибок.

Денежный guardrail **недоступен**: текущие verified client события не содержат
impression revenue, а связанного с assignment внешнего revenue export нет.
ad_shown не подменяет revenue. Поэтому эта реализация не утверждает, что доход
сохранён; перед решением нужен verified revenue per assigned install к D7/D14.

## Выборка и решение

Использован фактический предварительный baseline D1=17.61% и заранее выбранный
минимально полезный эффект +5 п.п. (22.61%), two-sided alpha=0.05, power=80%.
Обычная оценка двух долей:

- 1008 assigned installs на вариант;
- 2016 всего;
- при 25 новых installs/day — около 81 дня набора плюс созревание D1/D7.

Это planning estimate, не обещание эффекта и не текущая значимость. Не выбирать
победителя раньше объёма, по exposed-only группе или по одному ARPDAU.
Functional telemetry/save/crash checks выполняются раньше статистического
решения.

## Verification

- focused policy/native lifecycle/callsites: 5 suites, 19 tests passed;
- full frontend: 162 suites, 1045 tests passed;
- backend: 16 tests passed;
- TypeScript: pass;
- Expo lint: pass with two pre-existing warnings outside G17;
- production revenue linkage: UNAVAILABLE, explicitly not certified.
