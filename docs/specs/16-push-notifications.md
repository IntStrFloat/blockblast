# 16 — Push-уведомления (RuStore, Android)

Статус: реализовано (SDK 6.9.1, собрано и запущено) · Обновлено: 2026-06-22

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
- `testMode` (`__DEV__`): в dev логируется результат `checkPushAvailability()` (для диагностики).
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

SDK: **`react-native-rustore-push` 6.9.1** (GitFlic; нативный `ru.rustore.sdk:pushclient:6.9.1`). Плагин подключён через `plugins` в `app.json` и при `expo prebuild` инжектирует:

- **maven-репозиторий RuStore** `https://artifactory-external.vkpartner.ru/artifactory/maven` в `allprojects.repositories` (`android/build.gradle`) — без него gradle не резолвит нативный `pushclient`.
- **meta-data `ru.rustore.sdk.pushclient.project_id`** со значением из env `EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID` — по нему SDK 6.x инициализируется автоматически.
- разрешение `android.permission.POST_NOTIFICATIONS` (Android 13+, дедуп через `ensurePermission`).

Messaging-сервис (`com.rustorepush.RustorePushService`) и `params_class` пакет 6.x объявляет САМ в своём манифесте (autolinking merge) — плагин их не задаёт. Чистые функции `patchProjectBuildGradle` и `addProjectIdMeta` покрыты юнит-тестом (`plugins/__tests__/withRuStorePush.test.ts`); применение проверяется прогоном `expo prebuild`.

> ⚠️ После смены плагина обязателен **чистый** prebuild (`--clean`): инкрементальный prebuild не удаляет ранее внедрённые узлы манифеста (иначе остаётся старый сервис 0.9.2 → `ClassNotFoundException`).

## Ограничения доставки

Пуш доставляется только при выполнении всех условий одновременно:

- На устройстве установлен **RuStore** (или иной дистрибьютор экосистемы VK) и пользователь в нём авторизован.
- RuStore разрешено работать в фоне.
- Игрок выдал разрешение `POST_NOTIFICATIONS`.

На «голом» Google-устройстве (без RuStore) доставки нет — это природа механизма, не баг.

## Статус проверки (2026-06-22, AAB/APK vc19)

Собрано и запущено на эмуляторе (API 37, Android 16):

- ✅ **AAB/APK собираются** на RN 0.85 + New Architecture; AAB подписан верным ключом (SHA-256 совпадает с консолью RuStore).
- ✅ **SDK 6.9.1 авто-инициализируется**: в логах `RuStorePushClient: Auto init ... successful = true`, генерируется device id; приложение **не падает**.
- ✅ На эмуляторе без RuStore — корректное `Host push app is not installed!` (доставки нет — природа механизма).
- ⏳ **Реальная доставка токена/пуша не проверена** — нужен Android с установленным и авторизованным RuStore + тест-кампания из консоли.

### Оговорки / зависимости

1. **patch-package под RN 0.85.** SDK 6.9.1 собран под RN 0.72 и объявляет `onNewIntent(intent: Intent?)`, а RN 0.85 ждёт non-null `Intent` → Kotlin не компилируется. Патч `patches/react-native-rustore-push+6.9.1.patch` (одна строка) переприменяется через `postinstall`. **Снять патч**, когда RuStore выпустит RN-0.85-совместимую версию.

2. **TLS-truststore для maven RuStore.** Нативный AAR тянется из `artifactory-external.vkpartner.ru`, чей сертификат (HARICA CA) отсутствует в truststore JBR → gradle падает с `PKIX path building failed`. Лечится импортом сертификата в `cacerts` JBR (или кастомным truststore через `GRADLE_OPTS`). См. `docs/specs/08-build-release.md`.

3. **Чистый prebuild при смене плагина** (`expo prebuild --clean`) — инкрементальный оставляет старые узлы манифеста.

4. **Тап из фона/killed.** Foreground-тап — `eventEmitter` `ON_OPENED`; холодный старт по пушу — `getInitialNotification()`. Поведение из killed-состояния проверить на реальном устройстве.

5. **Маршрут в пуше.** `routeFromMessage` берёт `notification.clickAction` при `clickActionType==='DEEP_LINK'`, иначе `data.key==='route'` → `data.value`; всё прогоняется через белый список `resolvePushRoute`. Кампании в консоли настраивать соответственно.

## Поток данных

```
Cold start → getPush().init()
           (Android: SDK 6.x авто-init из manifest project_id; init() поднимает emitter)
           → подписка onNotificationTap(handler) (ON_OPENED + getInitialNotification)

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
