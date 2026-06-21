# 16 — Push-уведомления (RuStore, Android)

Статус: реализовано · Обновлено: 2026-06-21

## Модель

**Удалённые маркетинговые / ре-энгейджмент пуши** через RuStore Push. Отправка — **вручную из RuStore Console**; бэкенда нет, сервисный токен в коде приложения не используется. Приложение только **принимает** пуши и ведёт игрока на нужный экран по тапу.

## Платформы

| Платформа | Поведение |
|---|---|
| Android / RuStore | Реальный `RuStorePushProvider` (за флагом `pushEnabled` и непустым `projectId`) |
| iOS / Web / тесты | `NoopPushProvider` — тихий фоллбэк, никаких исключений |
| APNs / iOS пуши | Вне объёма |

## Архитектура (`src/features/notifications/`)

Паттерн повторяет `features/monetization`: реальный SDK прячется за интерфейсом, web/iOS/test получают Noop. Public API только через `index.ts`.

### Интерфейс `PushProvider`

```ts
export type PushPermissionResult = 'granted' | 'denied' | 'unavailable';

export interface PushTapPayload {
  /** Маршрут expo-router, куда вести игрока. Необязателен. */
  route?: string;
  [key: string]: unknown;
}

/** Реализации: NoopPushProvider (web/iOS/test), RuStorePushProvider (Android, по флагу). */
export interface PushProvider {
  init(): Promise<void>;
  requestPermission(): Promise<PushPermissionResult>;
  /** Подписка на тап по пушу. Возвращает функцию отписки. */
  onNotificationTap(handler: (route: string) => void): () => void;
}
```

### Реализации и фабрика

- **`NoopPushProvider`** (`noop.ts`): `init` — no-op, `requestPermission` → `'unavailable'`, `onNotificationTap` возвращает пустую функцию отписки. Используется на web/iOS и в Jest.
- **`RuStorePushProvider`** (`rustorePush.native.ts`): настоящая реализация на `react-native-rustore-push`. Metro резолвит `.native.ts`-файл только в нативной сборке; `rustorePush.ts` без суффикса является web/test-алиасом на Noop.
- **`getPush()`** (`provider.ts`, реэкспортируется из `index.ts`): фабрика выбирает `RuStorePushProvider`, если `PUSH.pushEnabled === true` и `PUSH.projectId !== ''`; иначе возвращает `NoopPushProvider`.

## Конфиг (`src/features/notifications/config.ts`)

```ts
export const PUSH = {
  pushEnabled: true,
  projectId: process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID ?? '',
  testMode: __DEV__,
} as const;
```

- `projectId` передаётся **только через env `EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID`** — не секрет (это идентификатор проекта в RuStore Console), но через env для гибкости окружений.
- Если `projectId` пустой (например, в dev без `.env` или в CI), фабрика автоматически возвращает Noop — сборка не падает.
- `testMode` (`__DEV__`): в режиме разработки логируется push-токен устройства для проверки `sendTestNotification`.
- **Сервисный токен RuStore в коде приложения не используется** — он нужен только серверной/консольной отправке.

## Разрешение: контекстный soft-ask (`softAsk.ts`)

1. **Не на холодном старте** — запрос разрешения не показывается при первом запуске.
2. После **первого** Game Over, когда игрок возвращается на Home (route `/`), показывается внутренний мягкий диалог (`PushSoftAskSheet.tsx`): «Напоминать про дейли-бонус и события?» (тексты через `core/i18n`, ru/en). Диалог не показывается во время геймплея и не накладывается на оверлей Game Over; перепроверка идёт при смене маршрута (та же сессия).
3. Только при тапе «Да» вызывается системный запрос `POST_NOTIFICATIONS` через `provider.requestPermission()`.
4. Состояние хранится в MMKV под ключом `push.prompt.v1` через `markPushSoftAskHandled()`. Повторного диалога нет — независимо от ответа (`handled: true`).
5. `shouldShowPushSoftAsk()` проверяет: `!handled && gameOvers >= 1`.
6. Отказ не ломает игру и не требует повторного подтверждения — игрок может выдать разрешение через системные настройки.

## Маршрутизация тапа (`routing.ts`)

Чистая функция `resolvePushRoute(payload: PushTapPayload | undefined): string` санитизирует payload пуша в безопасный внутренний маршрут expo-router.

**Белый список маршрутов:**

```ts
const ALLOWED_ROUTES = new Set<string>(['/', '/leaderboard', '/map', '/settings', '/game']);
```

- Неизвестный, отсутствующий или внешний маршрут → `'/'` (Home).
- Навигация выполняется из `_layout.tsx` через expo-router при вызове `onNotificationTap`-обработчика.
- Пуши **не прерывают** активный геймплей: обработчик не открывает попапы автоматически.

## Сборка: config-plugin (`plugins/withRuStorePush.js`)

Плагин подключается через поле `plugins` в `app.json` и при `expo prebuild` инжектирует всё, что требует README пакета `react-native-rustore-push`:

- **maven-репозиторий RuStore** `https://artifactory-external.vkpartner.ru/artifactory/maven` в `allprojects.repositories` (`android/build.gradle`) — без него gradle не резолвит нативный `ru.rustore.sdk:pushclient`.
- **messaging-сервис** `ru.reactnativerustorepush.deps.MessagingService` с intent-filter `ru.rustore.sdk.pushclient.MESSAGING_EVENT` в `AndroidManifest.xml` — через него SDK доставляет данные пуша (пакет его сам НЕ объявляет, это обязанность приложения).
- разрешение `android.permission.POST_NOTIFICATIONS` (Android 13+, дедуп через `ensurePermission`).

Метадата канала/иконки уведомлений плагином не задаётся — версия SDK `1.0.0` создаёт канал сама. Чистые функции `patchProjectBuildGradle` и `addMessagingService` покрыты юнит-тестом (`plugins/__tests__/withRuStorePush.test.ts`); фактическое применение проверяется прогоном `expo prebuild`.

## Ограничения доставки

Пуш доставляется только при выполнении всех условий одновременно:

- На устройстве установлен **RuStore** (или иной дистрибьютор экосистемы VK) и пользователь в нём авторизован.
- RuStore разрешено работать в фоне.
- Игрок выдал разрешение `POST_NOTIFICATIONS`.

На «голом» Google-устройстве (без RuStore) доставки нет — это природа механизма, не баг.

## Известные оговорки / TODO к нативной сборке

> **Статус после проверки сборкой и запуском (2026-06-22, AAB vc19, эмулятор API 37).**

1. **Версия SDK `0.9.2` НЕ годится для прод — нужен апгрейд (блокер пушей).**
   Проверено на реальной сборке:
   - ✅ AAB/APK **собираются** на RN 0.85 + New Architecture (gradle-компиляция нативного `pushclient:1.0.0` проходит), приложение **запускается и не падает** — наш Noop/обработка ошибок отрабатывают.
   - ❌ **Регистрация пушей в рантайме падает** на Android 14+ (API 34+, эмулятор был API 37): `RuStorePush.init()` бросает `One of RECEIVER_EXPORTED or RECEIVER_NOT_EXPORTED should be specified...` — SDK 0.9.2 регистрирует BroadcastReceiver без обязательного с Android 14 флага. Ошибку мы ловим (`[push] RuStore init failed`), приложение живёт, но **токен не выдаётся → пуши не работают**.
   - **Вывод:** перейти на актуальный RuStore Push SDK **2.x/6.x с GitFlic** (там флаг ресивера исправлен). Установка — `npm i git+https://...gitflic.ru/...` (нужен доступ к GitFlic). После апгрейда сверить API в `rustorePush.native.ts` (`init`, `getToken`, `messagingService.on`, `RuStorePushClient.isError`) — правки локализованы в этом файле.

   **Сборочная зависимость:** нативный AAR тянется из maven RuStore (`artifactory-external.vkpartner.ru`), чей TLS-сертификат (HARICA CA) отсутствует в truststore JBR → gradle падает с `PKIX path building failed`. Лечится импортом сертификата в `cacerts` JBR (или кастомным truststore через `GRADLE_OPTS`); это нужно и для GitFlic-версии. См. `docs/specs/08-build-release.md`.

2. **Тап vs foreground.** SDK 0.9.2 доставляет события через `messagingService.on('message-received', ...)`. Отдельного колбэка «тап по уведомлению из шторки» (background/killed state) в этой версии может не быть — поведение тапа из фона необходимо сверить с доками закреплённой версии и протестировать на реальном устройстве.

3. **Иконка/вид уведомления.** SDK `1.0.0` создаёт канал и показывает уведомление сам (отдельная `<meta-data>` не нужна). Если потребуется кастомная иконка/цвет — задать по докам закреплённой версии при переходе на 2.x/6.x.

## Поток данных

```
Cold start → getPush().init()
           (Android с projectId: RuStore init({projectId}); иначе Noop)
           → подписка onNotificationTap(handler)

Первый Game Over закрыт
           → recordGameOverForPush()
           → shouldShowPushSoftAsk() === true
           → PushSoftAskSheet («Да» / «Нет»)
           → markPushSoftAskHandled()
           → (при «Да») requestPermission() → POST_NOTIFICATIONS

Маркетолог в RuStore Console
           → отправляет кампанию вручную
           → SDK доставляет пуш на устройство
           → handler(resolvePushRoute(payload))
           → router.navigate(route)
```

## Обработка ошибок

- Нет `projectId` / web / iOS / Jest → Noop, тихо без исключений.
- `requestPermission` отклонён → сохраняем `denied`, игра продолжает работу.
- Некорректный/пустой payload → `resolvePushRoute` возвращает Home.
- Исключения в `init` логируются (`console.warn`), не роняют старт.

## Тестирование

- **Jest (юнит):** фабрика выбирает Noop при пустом `projectId`; поведение `NoopPushProvider` (`'unavailable'`, no-op отписки); `resolvePushRoute` — валидные/битые/пустые payload → корректный маршрут или Home.
- **Ручная проверка:** release-сборка на реальном Android-устройстве с установленным RuStore и авторизацией; `sendTestNotification` в dev; тест-кампания из RuStore Console; проверка тапа → нужный экран.

## Вне объёма (YAGNI)

- iOS / APNs.
- Backend-отправка и серверное хранение push-токенов.
- Сегментация и триггерные авто-пуши.
- Локальные запланированные напоминания (отдельная история, если понадобится).
