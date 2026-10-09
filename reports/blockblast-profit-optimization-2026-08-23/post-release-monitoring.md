# Контроль прибыли после релиза Block Blast 1.1.35

Этот протокол относится только к Android-приложению `com.intstrfloat.blockblast`, AppMetrica `6315187`, Ads Boost `19446153` и кампаниям Direct `710765052` / `712078810`.

## Единица сравнения

Основная когорта после публикации:

- `app_version = 1.1.35` и `build_number = 40`;
- платформа Android;
- дата первой установки не раньше начала распространения релиза;
- отдельно `Yandex.Direct` и organic;
- первое решение — после 7 полных дней или 100 новых Direct-атрибутированных установок, что наступит позже.

Старые версии нельзя смешивать с `1.1.35`. Для retention используется когорта новых пользователей AppMetrica, для рекламной воронки — уникальный `attempt_id`, а не сумма событий.

Источник установки и способ входа в сессию — разные измерения:

- `Yandex.Direct / organic` берутся из acquisition-атрибуции AppMetrica;
- `entry_source = organic / notification / deeplink` описывает только запуск текущей сессии; `organic` здесь означает обычное открытие приложения, а не органическую установку.

## Зафиксированная база

| Показатель | База 24.07–23.08.2026 |
| --- | ---: |
| Новые пользователи AppMetrica | 743 |
| Direct-атрибутированные установки | 658 |
| Direct conversions | 1 077 |
| Расход Direct | 5 837,00 ₽ |
| Эффективный CAC (`расход / установки AppMetrica`) | 8,87 ₽ |
| Boost revenue | 4 892,83 ₽ |
| Boost ARPU | 5,25 ₽ |
| Оценочный paid ROAS | 74,23% |
| `first_line_cleared` | 68,17% |
| D1 / Direct D1 | 21,33% / 22,50% |
| D7 / Direct D7 | 7,88% / 8,66% |
| Crash-free sessions / devices | 99,88% / 99,2% |

Текущее отношение `Direct conversions / AppMetrica installs` равно `1,64`. Оно является диагностикой расхождения атрибуции, но не коэффициентом для пересчёта пользователей.

## Что считать ежедневно

### Приток и стоимость

1. `Direct spend` — фактический расход кампаний.
2. `Direct conversions` — только для проверки биллинга и стратегии Direct.
3. `AppMetrica Direct installs` — знаменатель продуктового CAC.
4. `effective CAC = Direct spend / AppMetrica Direct installs`.
5. `attribution ratio = Direct conversions / AppMetrica Direct installs`.

Если отношение атрибуции меняется более чем на `15%` относительно базы `1,64`, решения по ставке откладываются до проверки окон и модели атрибуции.

### Продуктовая воронка

По уникальным пользователям версии `1.1.35`:

`profile_created → play_tapped → tutorial_completed → first_line_cleared → game_over → D1 → D7`.

Дополнительно контролируются:

- медиана и p75 `elapsed_ms` для `tutorial_completed` и `first_line_cleared`;
- доля `tutorial_completed.skipped = true`;
- повторный `play_tapped` и `game_over` на пользователя;
- `game_over_action` по `replay`, `revive` и `home`;
- `next_action_clicked` по виду следующего действия;
- `streak_protector_saved` и возвраты из `notification_opened` по `origin` и `kind`.

### Рекламная воронка

По каждому `placement` и формату:

`ad_requested → ad_loaded → ad_shown → ad_rewarded / ad_dismissed`.

- попытки дедуплицируются по `attempt_id`;
- `ad_shown` считается только после фактического показа;
- rewarded-ценность начисляется только при `ad_rewarded`;
- отдельно контролируются `ad_failed.stage`, show rate и reward rate;
- interstitial-показы на активного пользователя не должны расти относительно базы без одновременного роста D1.

### Стабильность

По AppMetrica Crashes отдельно фильтровать `app_version = 1.1.35`, `build_number = 40`:

- crash-free sessions — цель `99,9%+`, crash-free devices — не ниже исходных `99,2%`;
- ноль повторов WebGL-сигнатуры `Cannot read property 'precision' of undefined` из `WebGLCapabilities → WebGLRenderer`;
- визуально проверять SVG-fallback на слабых Android-устройствах;
- `RetryableMountingLayerException` группировать по версии React Native, Android и модели устройства; не смешивать её с прикладным WebGL-падением.

## Порог принятия решения

| Метрика | Защитный минимум | Цель |
| --- | ---: | ---: |
| `first_line_cleared` | 68% | 72%+ |
| D1 | 22% | 24%+ |
| D7 | 8% | 10%+ |
| Boost ARPU | 5,25 ₽ | 6,25 ₽+ |
| paid ROAS | 80% | 90%, затем 100%+ |

Для paid ROAS используются только сопоставимые окна:

`estimated paid revenue = Boost revenue × Direct installs / all installs`

`paid ROAS = estimated paid revenue / Direct spend`

Это временная управленческая оценка. После появления когортной рекламной выручки её нужно заменить прямым LTV/ROAS платной когорты.

## Решения после контрольного окна

- Если D1 падает больше чем на `1 п.п.` или `first_line_cleared < 68%`, не усиливать рекламу и разбирать FTUE/частоту fullscreen по placement.
- Если paid ROAS ниже `80%`, бюджет не увеличивать; проверить эффективный CAC, атрибуцию и rewarded show/reward rate.
- Если paid ROAS `80–90%`, удерживать настройки и продолжать продуктовую итерацию до достаточной D7-когорты.
- Если paid ROAS `90–100%`, D1 не ниже `24%`, а D7 не ниже `10%`, сохранить бюджет и подтвердить результат ещё одним сопоставимым окном.
- Масштабировать недельный бюджет максимум на `15%` за итерацию только после двух последовательных окон с paid ROAS `100%+` и без падения D1 более чем на `1 п.п.`.

## Контрольные точки

- День публикации: записать точное время начала rollout и фактическое изменение CPA.
- Через 24 часа: проверить доставку событий, `app_version/build_number`, ошибки рекламы и аномалии FTUE; экономических выводов не делать.
- Через 24 часа: проверить crash-free sessions/devices и отсутствие старой WebGL-сигнатуры на новой сборке.
- Через 7 полных дней и при достаточном объёме: принять первое решение по retention, effective CAC и paid ROAS.
- Через 14 дней: подтвердить D7 и решить, удерживать ли CPA, продолжать продуктовую оптимизацию или готовить осторожное масштабирование.
