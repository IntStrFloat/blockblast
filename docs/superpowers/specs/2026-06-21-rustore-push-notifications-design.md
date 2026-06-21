# Дизайн: Push-уведомления через RuStore (приём + ручные кампании)

Статус: на согласовании · Дата: 2026-06-21 · Автор: brainstorming-сессия

## Цель

Дать возможность отправлять маркетинговые/ре-энгейджмент пуши («Загляни в приложение —
у нас тут кое-что прикольное») игрокам на Android через RuStore. Отправка — **вручную
из RuStore Console**. Приложение только **принимает** пуши и аккуратно ведёт игрока внутрь
по тапу.

## Решения (зафиксированы на брейншторме)

- **Тип:** удалённые пуши через RuStore (не локальные напоминания).
- **Отправка:** вручную из RuStore Console. **Backend не пишем, сервисный токен в коде не
  используется.** (Утёкший в чат сервисный токен подлежит ротации в консоли — он нужен
  только консоли/серверной отправке, которой у нас нет.)
- **Платформы:** только Android / RuStore. iOS и web — Noop. APNs/iOS — вне объёма.
- **Роль приложения:** receive-only (SDK + projectId + обработка тапа).

## Ограничения и контекст

- **Доставка RuStore Push возможна только если** на устройстве установлен RuStore (или
  иной дистрибьютор пушей экосистемы VK) и пользователь в нём авторизован, RuStore разрешено
  работать в фоне. На «голом» Google-устройстве доставки нет — это природа механизма, не баг.
- **Бюджет нативных зависимостей** (`docs/specs/07-performance.md`) сейчас разрешает только
  `mmkv (+ ad/iap SDK)`. RuStore Push — новая нативная зависимость → требует правки 07 с
  обоснованием.
- **Позиционирование** «оффлайн, без регистрации» сохраняется: пуши не требуют аккаунта в
  нашей игре; разрешение спрашиваем мягко и опционально; отказ не ломает игру.
- **Конвенции проекта:** SDK за интерфейсом + Noop-фоллбэк (как `features/monetization`);
  public API через `index.ts`; тексты через `core/i18n`; никаких нативных зависимостей вне
  обоснования в 07.

## Технические факты по SDK (сверено с доками RuStore, 2026-06)

- Пакет: **`react-native-rustore-push`** (актуальные мажоры 2.x/6.x по версионным докам
  RuStore; на npm встречается устаревшая 0.9.2). **Точную версию пиннить на этапе
  реализации по версионным докам** (требование `AGENTS.md`).
- Инициализация: `init({ projectId })`.
- Токен и входящие сообщения: подписка через `messagingService.on(...)`; отписка
  `unsubscribeAll()`.
- E2E-проверка: `sendTestNotification()` (при включённом тест-режиме).
- Android: сервис в `AndroidManifest.xml`, метадата канала/иконки/цвета, runtime-разрешение
  **POST_NOTIFICATIONS** (Android 13+).
- Официального Expo config-plugin нет → пишем свой (паттерн как у
  `@somersets/react-native-rustore-iap`).

## Архитектура

Повторяем паттерн `features/monetization`: реальный SDK прячется за интерфейсом, web/iOS/test
получают Noop.

### Модуль `src/features/notifications/`

Public API только через `index.ts`.

```ts
type PermissionResult = 'granted' | 'denied' | 'unavailable';

interface PushProvider {
  init(): Promise<void>;
  requestPermission(): Promise<PermissionResult>;
  onNotificationTap(handler: (route: string) => void): () => void; // returns unsubscribe
}
```

- `RuStorePushProvider` — Android, реальный `react-native-rustore-push`.
- `NoopPushProvider` — iOS/web/test: `init` no-op, `requestPermission → 'unavailable'`,
  `onNotificationTap → () => {}`.
- Фабрика `getPushProvider()` выбирает по `Platform.OS` и флагу `pushEnabled`.

### Конфиг `src/features/notifications/config.ts`

```ts
export const PUSH = {
  pushEnabled: true,
  projectId: process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID ?? '',
  testMode: __DEV__, // включает sendTestNotification-путь в dev
};
```

`projectId` — не секрет (идентификатор проекта в консоли), допускает env-override и пустое
значение (тогда фабрика отдаёт Noop, чтобы dev/CI без projectId не падали).

### project_id и токены

- В приложение кладём **только `projectId`**.
- **Сервисный токен нигде не используется.**
- Push-токен устройства SDK регистрирует сам; на сервере **не храним** (рассылки идут на
  весь проект/сегменты из консоли). В dev — допустимо логировать токен для
  `sendTestNotification`.

### Разрешение — контекстный soft-ask

1. Не на холодном старте.
2. После закрытия **первого** экрана Game Over показываем мягкий внутренний экран:
   «Напоминать про дейли-бонус и события? 🎁» (тексты — `core/i18n`, ru/en).
3. Только при тапе «Да» вызываем системный POST_NOTIFICATIONS через
   `provider.requestPermission()`.
4. Отказ запоминаем (MMKV), не доспрашиваем агрессивно (повтор — не раньше, чем через
   заметный игровой прогресс; конкретику закрепляем в плане).

Соответствует анти-чеклисту `docs/specs/06-audience.md`.

### Тап по пушу → deep-link

- Payload несёт поле `route` (строка маршрута expo-router). По умолчанию — Home.
- Чистая функция `resolvePushRoute(payload): string` (валидирует/санитизирует, фоллбэк на
  Home) — покрывается юнит-тестом.
- Навигация через expo-router в обработчике `onNotificationTap`. Без авто-попапов и без
  прерывания активного геймплея.

### Config-plugin `plugins/withRuStorePush.js`

Инжектит в prebuild:
- сервис RuStore messaging в `AndroidManifest.xml`;
- метадату канала уведомлений (id/имя), иконку и цвет;
- разрешение `POST_NOTIFICATIONS`.

Подключается через `plugins` в `app.json`. Версию нативного SDK пиннить на реализации.

## Поток данных

```
Cold start → getPushProvider().init()  (Android: RuStore init({projectId}); web/iOS: noop)
            → подписка onNotificationTap(handler)
Первый Game Over закрыт → soft-ask экран → (Да) → requestPermission() → POST_NOTIFICATIONS
Маркетолог в RuStore Console → отправляет кампанию → SDK доставляет пуш
Тап по пушу → handler(resolvePushRoute(payload)) → router.navigate(route)
```

## Обработка ошибок

- Нет `projectId` / web / iOS / тест → Noop, тихо без падений.
- `requestPermission` отклонён → сохраняем `denied`, игра работает как обычно.
- Некорректный/пустой payload → `resolvePushRoute` отдаёт Home.
- SDK-исключения в `init` ловим и логируем (dev), не роняем старт.

## Тестирование

- **Юнит (jest):**
  - фабрика выбирает Noop на web/test и при пустом `projectId`;
  - поведение `NoopPushProvider` (`'unavailable'`, no-op отписки);
  - `resolvePushRoute` — валидные/битые/пустые payload’ы → корректный маршрут/фоллбэк.
- **Ручная проверка:** release-сборка на реальном Android-устройстве **с установленным
  RuStore и авторизацией**; `sendTestNotification` в dev и реальная тест-кампания из консоли;
  проверка тапа → нужный экран.
- `npx tsc --noEmit` и `npm test` зелёные перед коммитом (конвенция проекта).

## Правки документации (часть объёма)

1. **Новый** `docs/specs/16-push-notifications.md` — каноничная спека (этот дизайн в
   статусе «реализовано» после внедрения) + строка в таблице спек в `CLAUDE.md`.
2. `docs/specs/07-performance.md` — в строку «Нативные зависимости сверх Expo» добавить
   `rustore-push` с обоснованием (receive-only, Android, за флагом).
3. `docs/specs/06-audience.md` — в анти-чеклист: частотные лимиты пушей, без прерывания
   геймплея, лёгкий opt-out, soft-ask вместо холодного промпта.

## Вне объёма (YAGNI)

- iOS / APNs.
- Backend-отправка и серверное хранение push-токенов.
- Сегментация/триггерные авто-пуши.
- Локальные запланированные напоминания (отдельная история, если понадобится).

## Открытые вопросы для плана

- Точный мажор `react-native-rustore-push` (пиннить по версионным докам на реализации).
- Точная политика повторного soft-ask после `denied`.
- Иконка/цвет/имя канала уведомления (взять из дизайн-системы `ui/theme.ts`).
