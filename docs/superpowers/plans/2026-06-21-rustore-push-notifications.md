# RuStore Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Принимать удалённые пуши RuStore на Android (рассылки шлются вручную из RuStore Console) и аккуратно вести игрока внутрь приложения по тапу.

**Architecture:** Новый модуль `src/features/notifications/` повторяет паттерн `features/monetization`: реальный SDK (`react-native-rustore-push`) прячется за интерфейсом `PushProvider`; web/iOS/test получают `NoopPushProvider` через Metro-резолв `*.native.ts`. Разрешение спрашиваем контекстным soft-ask после первого Game Over. Тап по пушу → чистая функция `resolvePushRoute` → expo-router. Нативная склейка — локальный config-plugin `plugins/withRuStorePush.js`.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript strict, zustand, react-native-mmkv, expo-router, jest/jest-expo, `react-native-rustore-push` (нативно, Android-only).

**Контекст для исполнителя (прочитать до старта):**
- Источник истины — дизайн: `docs/superpowers/specs/2026-06-21-rustore-push-notifications-design.md`.
- Эталонный паттерн — `src/features/monetization/` (`types.ts`, `noop.ts`, `config.ts`, `index.ts`, `yandexAds.ts` + `yandexAds.native.ts`, `__tests__/config.test.ts`, `__tests__/yandexAdsSource.test.ts`). Копируем стиль, не изобретаем.
- Конвенции (`CLAUDE.md`): TS strict; `npx tsc --noEmit` и `npm test` зелёные перед каждым коммитом; `features/*` экспортируют public API только через `index.ts`; тексты — через `core/i18n` (ru/en); цвета — `ui/theme.ts`; коммиты conventional, на русском допустимо.
- **В репозитории работают параллельные агенты (worktrees).** Перед правкой уже существующих файлов (`src/app/_layout.tsx`, `src/features/game/components/GameOverOverlay.tsx`, `src/core/storage/index.ts`, `src/core/i18n/*.ts`, `app.json`, спеки) проверь `git status`/`git log -1 <file>` и убедись, что не перетираешь чужую правку.
- **projectId:** `M0xzrLkJBflEHvW4vaoyf134MX9yxBF3`. В код кладём **только** через env `EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID`; реальное значение в коммиты не пишем (кладётся в `.env.local`/CI). Сервисный токен RuStore в коде не используется вообще.
- **AGENTS.md:** перед написанием нативного кода открыть версионную доку RuStore Push под закреплённый мажор `react-native-rustore-push` (https://www.rustore.ru/help/en/sdk/push-notifications/react) и сверить точные имена методов/событий — см. Task 5.

---

## Структура файлов

Создаём:
- `src/features/notifications/types.ts` — интерфейс `PushProvider`, типы payload/результатов.
- `src/features/notifications/config.ts` — флаг `pushEnabled`, `projectId`, `testMode`.
- `src/features/notifications/routing.ts` — чистая `resolvePushRoute(payload)`.
- `src/features/notifications/noop.ts` — `NoopPushProvider`.
- `src/features/notifications/rustorePush.ts` — web/test реэкспорт Noop.
- `src/features/notifications/rustorePush.native.ts` — реальный SDK (Android).
- `src/features/notifications/softAsk.ts` — MMKV-логика «когда показывать soft-ask».
- `src/features/notifications/PushSoftAskSheet.tsx` — UI мягкого запроса разрешения.
- `src/features/notifications/index.ts` — public API + фабрика `getPush()`.
- `src/features/notifications/__tests__/config.test.ts`
- `src/features/notifications/__tests__/routing.test.ts`
- `src/features/notifications/__tests__/noopSelection.test.ts`
- `src/features/notifications/__tests__/rustorePushSource.test.ts`
- `src/features/notifications/__tests__/softAsk.test.ts`
- `plugins/withRuStorePush.js` — config-plugin.
- `docs/specs/16-push-notifications.md` — каноничная спека.

Модифицируем:
- `src/core/storage/index.ts` — добавить KEY `pushPrompt`.
- `src/app/_layout.tsx` — `getPush().init()` + подписка на тап + монтирование `PushSoftAskSheet`.
- `src/features/game/components/GameOverOverlay.tsx` — вызвать `recordGameOverForPush()` при закрытии.
- `src/core/i18n/en.ts`, `src/core/i18n/ru.ts` — секция `push`.
- `app.json` — projectId-плагин в `plugins`.
- `docs/specs/07-performance.md`, `docs/specs/06-audience.md`, `CLAUDE.md` — правки.

---

## Task 1: Типы и конфиг модуля

**Files:**
- Create: `src/features/notifications/types.ts`
- Create: `src/features/notifications/config.ts`
- Test: `src/features/notifications/__tests__/config.test.ts`

- [ ] **Step 1: Написать падающий тест конфига**

`src/features/notifications/__tests__/config.test.ts`:
```ts
describe('push configuration', () => {
  const KEY = 'EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID';
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
    jest.resetModules();
  });

  it('defaults projectId to empty string when env is absent', () => {
    delete process.env[KEY];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PUSH } = require('../config') as typeof import('../config');
      expect(PUSH.projectId).toBe('');
      expect(PUSH.pushEnabled).toBe(true);
    });
  });

  it('uses build-time projectId when provided', () => {
    process.env[KEY] = 'proj-123';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PUSH } = require('../config') as typeof import('../config');
      expect(PUSH.projectId).toBe('proj-123');
    });
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx jest src/features/notifications/__tests__/config.test.ts`
Expected: FAIL — `Cannot find module '../config'`.

- [ ] **Step 3: Написать типы**

`src/features/notifications/types.ts`:
```ts
export type PushPermissionResult = 'granted' | 'denied' | 'unavailable';

/** Полезная нагрузка пуша, на которую мы реагируем при тапе. */
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

- [ ] **Step 4: Написать конфиг**

`src/features/notifications/config.ts`:
```ts
export const PUSH = {
  /** Приём пушей RuStore (Android). Web/iOS/test всегда Noop независимо от флага. */
  pushEnabled: true,
  /** Идентификатор проекта RuStore Push. Не секрет, но держим через env. */
  projectId: process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID ?? '',
  /** В dev включает путь sendTestNotification и логирование токена. */
  testMode: __DEV__,
} as const;
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `npx jest src/features/notifications/__tests__/config.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/features/notifications/types.ts src/features/notifications/config.ts src/features/notifications/__tests__/config.test.ts
git commit -m "feat(push): типы PushProvider и конфиг RuStore Push"
```

---

## Task 2: Чистая маршрутизация тапа `resolvePushRoute`

**Files:**
- Create: `src/features/notifications/routing.ts`
- Test: `src/features/notifications/__tests__/routing.test.ts`

- [ ] **Step 1: Написать падающий тест**

`src/features/notifications/__tests__/routing.test.ts`:
```ts
import { resolvePushRoute } from '../routing';

describe('resolvePushRoute', () => {
  it('returns Home for empty/undefined payload', () => {
    expect(resolvePushRoute(undefined)).toBe('/');
    expect(resolvePushRoute({})).toBe('/');
  });

  it('returns Home when route is missing or not a string', () => {
    expect(resolvePushRoute({ route: 42 as unknown as string })).toBe('/');
  });

  it('passes through known in-app routes', () => {
    expect(resolvePushRoute({ route: '/leaderboard' })).toBe('/leaderboard');
    expect(resolvePushRoute({ route: '/map' })).toBe('/map');
  });

  it('falls back to Home for unknown or unsafe routes', () => {
    expect(resolvePushRoute({ route: 'https://evil.example' })).toBe('/');
    expect(resolvePushRoute({ route: '/does-not-exist' })).toBe('/');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx jest src/features/notifications/__tests__/routing.test.ts`
Expected: FAIL — `Cannot find module '../routing'`.

- [ ] **Step 3: Реализовать**

`src/features/notifications/routing.ts`:
```ts
import type { PushTapPayload } from './types';

/** Белый список маршрутов, на которые можно вести по тапу пуша. */
const ALLOWED_ROUTES = new Set<string>(['/', '/leaderboard', '/map', '/settings', '/game']);

const HOME = '/';

/** Санитизирует payload пуша в безопасный внутренний маршрут expo-router. */
export function resolvePushRoute(payload: PushTapPayload | undefined): string {
  const route = payload?.route;
  if (typeof route !== 'string') return HOME;
  return ALLOWED_ROUTES.has(route) ? route : HOME;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx jest src/features/notifications/__tests__/routing.test.ts`
Expected: PASS (4 теста).

> Примечание: сверь набор `ALLOWED_ROUTES` с реальными файлами в `src/app/` (`index`, `leaderboard`, `map`, `settings`, `game`). Если маршрут переименован — поправь множество и тест.

- [ ] **Step 5: Коммит**

```bash
git add src/features/notifications/routing.ts src/features/notifications/__tests__/routing.test.ts
git commit -m "feat(push): чистая resolvePushRoute с белым списком маршрутов"
```

---

## Task 3: Noop-провайдер и фабрика `getPush()`

**Files:**
- Create: `src/features/notifications/noop.ts`
- Create: `src/features/notifications/rustorePush.ts`
- Create: `src/features/notifications/index.ts`
- Test: `src/features/notifications/__tests__/noopSelection.test.ts`

- [ ] **Step 1: Написать падающий тест выбора провайдера**

`src/features/notifications/__tests__/noopSelection.test.ts`:
```ts
import { getPush } from '../index';
import { NoopPushProvider } from '../noop';

describe('push provider selection (web/test)', () => {
  it('returns NoopPushProvider under jest (rustorePush.ts resolves to Noop)', () => {
    expect(getPush()).toBe(NoopPushProvider);
  });

  it('NoopPushProvider reports unavailable and no-ops', async () => {
    await expect(NoopPushProvider.init()).resolves.toBeUndefined();
    await expect(NoopPushProvider.requestPermission()).resolves.toBe('unavailable');
    const unsubscribe = NoopPushProvider.onNotificationTap(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx jest src/features/notifications/__tests__/noopSelection.test.ts`
Expected: FAIL — `Cannot find module '../index'`.

- [ ] **Step 3: Реализовать Noop**

`src/features/notifications/noop.ts`:
```ts
import type { PushProvider } from './types';

export const NoopPushProvider: PushProvider = {
  async init() {},
  async requestPermission() {
    return 'unavailable';
  },
  onNotificationTap() {
    return () => {};
  },
};
```

- [ ] **Step 4: Реализовать web/test реэкспорт**

`src/features/notifications/rustorePush.ts`:
```ts
import { NoopPushProvider } from './noop';

/** Web and test fallback. Metro resolves rustorePush.native.ts on native builds. */
export const RuStorePushProvider = NoopPushProvider;
```

- [ ] **Step 5: Реализовать index с фабрикой**

`src/features/notifications/index.ts`:
```ts
import { PUSH } from './config';
import { NoopPushProvider } from './noop';
import { RuStorePushProvider } from './rustorePush';
import type { PushProvider } from './types';

export { PUSH } from './config';
export { resolvePushRoute } from './routing';
export { PushSoftAskSheet } from './PushSoftAskSheet';
export { recordGameOverForPush, shouldShowPushSoftAsk, markPushSoftAskHandled } from './softAsk';
export type { PushProvider, PushPermissionResult, PushTapPayload } from './types';

export function getPush(): PushProvider {
  if (PUSH.pushEnabled && PUSH.projectId !== '') {
    return RuStorePushProvider; // На native резолвится rustorePush.native.ts
  }
  return NoopPushProvider;
}
```

> На этом шаге `index.ts` ссылается на `./PushSoftAskSheet` и `./softAsk`, которых ещё нет. Это нормально для TDD-порядка: данный тест запускаем точечно (Step 6), он импортирует `getPush`/`NoopPushProvider`, а Metro/jest подтянет только реально используемые модули. Полный `npx tsc --noEmit` гоняем в конце Task 6, когда оба файла созданы. Если хочешь зелёный tsc уже сейчас — временно закомментируй две строки экспорта и раскомментируй в Task 5/6.

- [ ] **Step 6: Запустить тест — убедиться, что проходит**

Run: `npx jest src/features/notifications/__tests__/noopSelection.test.ts`
Expected: PASS (2 теста). Под jest резолвится `rustorePush.ts` (Noop), а `projectId` в тестовом env пуст → `getPush()` всё равно отдаёт Noop. Тест проверяет именно равенство `NoopPushProvider`.

- [ ] **Step 7: Коммит**

```bash
git add src/features/notifications/noop.ts src/features/notifications/rustorePush.ts src/features/notifications/index.ts src/features/notifications/__tests__/noopSelection.test.ts
git commit -m "feat(push): Noop-провайдер и фабрика getPush"
```

---

## Task 4: Soft-ask логика (MMKV) + KEY

**Files:**
- Modify: `src/core/storage/index.ts` (добавить KEY)
- Create: `src/features/notifications/softAsk.ts`
- Test: `src/features/notifications/__tests__/softAsk.test.ts`

- [ ] **Step 1: Добавить KEY персиста**

В `src/core/storage/index.ts`, в объект `KEYS`, после строки `onboardingMeta: 'onboarding.meta.v1',` добавить:
```ts
  pushPrompt: 'push.prompt.v1',
```
(Проверь `git status` файла перед правкой — он общий.)

- [ ] **Step 2: Написать падающий тест soft-ask**

`src/features/notifications/__tests__/softAsk.test.ts`:
```ts
import { KEYS, getJSON, setJSON, removeKey } from '@/core/storage';

import {
  recordGameOverForPush,
  shouldShowPushSoftAsk,
  markPushSoftAskHandled,
} from '../softAsk';

describe('push soft-ask gating', () => {
  beforeEach(() => removeKey(KEYS.pushPrompt));

  it('does not prompt before the first game over', () => {
    expect(shouldShowPushSoftAsk()).toBe(false);
  });

  it('prompts after the first recorded game over', () => {
    recordGameOverForPush();
    expect(shouldShowPushSoftAsk()).toBe(true);
  });

  it('never prompts again once handled', () => {
    recordGameOverForPush();
    markPushSoftAskHandled();
    expect(shouldShowPushSoftAsk()).toBe(false);
    recordGameOverForPush();
    expect(shouldShowPushSoftAsk()).toBe(false);
  });

  it('persists handled flag via MMKV', () => {
    recordGameOverForPush();
    markPushSoftAskHandled();
    expect(getJSON<{ handled: boolean }>(KEYS.pushPrompt)?.handled).toBe(true);
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `npx jest src/features/notifications/__tests__/softAsk.test.ts`
Expected: FAIL — `Cannot find module '../softAsk'`.

- [ ] **Step 4: Реализовать softAsk**

`src/features/notifications/softAsk.ts`:
```ts
import { KEYS, getJSON, setJSON } from '@/core/storage';

interface PushPromptState {
  gameOvers: number;
  handled: boolean;
}

const EMPTY: PushPromptState = { gameOvers: 0, handled: false };

/** Минимум проигрышей до показа мягкого запроса разрешения. */
const MIN_GAME_OVERS = 1;

function load(): PushPromptState {
  return getJSON<PushPromptState>(KEYS.pushPrompt) ?? EMPTY;
}

/** Вызывается при закрытии экрана Game Over. */
export function recordGameOverForPush(): void {
  const state = load();
  if (state.handled) return;
  setJSON(KEYS.pushPrompt, { ...state, gameOvers: state.gameOvers + 1 });
}

/** Показывать ли soft-ask сейчас. */
export function shouldShowPushSoftAsk(): boolean {
  const state = load();
  return !state.handled && state.gameOvers >= MIN_GAME_OVERS;
}

/** Игрок принял решение (да/нет) — больше не доспрашиваем. */
export function markPushSoftAskHandled(): void {
  setJSON(KEYS.pushPrompt, { ...load(), handled: true });
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `npx jest src/features/notifications/__tests__/softAsk.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/core/storage/index.ts src/features/notifications/softAsk.ts src/features/notifications/__tests__/softAsk.test.ts
git commit -m "feat(push): soft-ask gating на MMKV (после первого Game Over)"
```

---

## Task 5: Нативный провайдер RuStore (Android) + source-контракт

**Files:**
- Create: `src/features/notifications/rustorePush.native.ts`
- Test: `src/features/notifications/__tests__/rustorePushSource.test.ts`

> **До кода:** установи пакет и закрепи мажор по версионной доке (AGENTS.md):
> `npm i react-native-rustore-push@<latest-stable>` — открой https://www.rustore.ru/help/en/sdk/push-notifications/react для закреплённого мажора и сверь точные имена методов/событий (`init`, получение токена, подписка на сообщения/тап). Код ниже отражает документированную форму API; при расхождении правь вызовы под закреплённую версию, **сохраняя** контракт ниже (имена `RuStorePushProvider`, `reportPushError`, обработка тапа через `resolvePushRoute`).

- [ ] **Step 1: Написать source-контракт тест**

`src/features/notifications/__tests__/rustorePushSource.test.ts`:
```ts
declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

describe('RuStore push native source contract', () => {
  it('uses projectId, reports errors, and routes taps through resolvePushRoute', () => {
    const src = fs.readFileSync(`${__dirname}/../rustorePush.native.ts`, 'utf8');
    expect(src).toContain("from 'react-native-rustore-push'");
    expect(src).toContain('PUSH.projectId');
    expect(src).toContain('function reportPushError');
    expect(src).toContain('resolvePushRoute');
    expect(src).toContain('export const RuStorePushProvider');
    // POST_NOTIFICATIONS запрашиваем на Android 13+
    expect(src).toContain('requestPermission');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npx jest src/features/notifications/__tests__/rustorePushSource.test.ts`
Expected: FAIL — файла `rustorePush.native.ts` нет (`ENOENT`).

- [ ] **Step 3: Реализовать нативный провайдер**

`src/features/notifications/rustorePush.native.ts`:
```ts
import { PermissionsAndroid, Platform } from 'react-native';
import RuStorePushClient from 'react-native-rustore-push';

import { PUSH } from './config';
import { resolvePushRoute } from './routing';
import type { PushPermissionResult, PushProvider, PushTapPayload } from './types';

let initPromise: Promise<void> | null = null;

function reportPushError(stage: string, error: unknown): void {
  console.warn(`[push] RuStore ${stage} failed`, error);
}

async function init(): Promise<void> {
  if (PUSH.projectId === '') return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await RuStorePushClient.init({ projectId: PUSH.projectId });
        if (PUSH.testMode) {
          const token = await RuStorePushClient.getToken();
          console.log('[push] token', token);
        }
      } catch (error) {
        reportPushError('init', error);
        initPromise = null;
      }
    })();
  }
  await initPromise;
}

async function requestPermission(): Promise<PushPermissionResult> {
  if (Platform.OS !== 'android') return 'unavailable';
  // Android < 13 не требует runtime-разрешения уведомлений.
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return 'granted';
  try {
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
  } catch (error) {
    reportPushError('permission', error);
    return 'denied';
  }
}

function onNotificationTap(handler: (route: string) => void): () => void {
  try {
    const subscription = RuStorePushClient.addListener?.(
      'notificationTap',
      (event: { data?: PushTapPayload }) => handler(resolvePushRoute(event?.data)),
    );
    return () => {
      try {
        subscription?.remove?.();
      } catch (error) {
        reportPushError('unsubscribe', error);
      }
    };
  } catch (error) {
    reportPushError('tap subscription', error);
    return () => {};
  }
}

export const RuStorePushProvider: PushProvider = {
  init,
  requestPermission,
  onNotificationTap,
};
```

> Имена `RuStorePushClient.init/getToken/addListener` и payload события тапа — сверить с версионной докой закреплённого мажора и при необходимости заменить, не меняя экспортируемый контракт. Контракт-тест проверяет только структурные инварианты (импорт SDK, projectId, reportPushError, resolvePushRoute, экспорт провайдера, requestPermission).

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npx jest src/features/notifications/__tests__/rustorePushSource.test.ts`
Expected: PASS (1 тест).

- [ ] **Step 5: Коммит**

```bash
git add src/features/notifications/rustorePush.native.ts src/features/notifications/__tests__/rustorePushSource.test.ts package.json package-lock.json
git commit -m "feat(push): нативный RuStorePushProvider (Android) за интерфейсом"
```

---

## Task 6: UI soft-ask + i18n

**Files:**
- Modify: `src/core/i18n/en.ts`, `src/core/i18n/ru.ts`
- Create: `src/features/notifications/PushSoftAskSheet.tsx`

- [ ] **Step 1: Добавить строки i18n (en)**

В `src/core/i18n/en.ts` добавить новую секцию верхнего уровня (рядом с прочими, проверь запятые):
```ts
  push: {
    title: 'Stay in the loop?',
    body: 'Get a nudge when your daily bonus is ready and when something cool drops.',
    allow: 'Sure',
    later: 'Not now',
  },
```

- [ ] **Step 2: Добавить строки i18n (ru)**

В `src/core/i18n/ru.ts` добавить ту же секцию:
```ts
  push: {
    title: 'Напоминать?',
    body: 'Подскажем, когда готов дейли-бонус и когда появится что-то прикольное.',
    allow: 'Давай',
    later: 'Не сейчас',
  },
```

> Если в проекте есть тест полноты переводов (сверка ключей en/ru) — он подтвердит, что секции совпадают. Запусти `npm test` и убедись, что i18n-тесты (если есть) зелёные.

- [ ] **Step 3: Реализовать UI-компонент**

`src/features/notifications/PushSoftAskSheet.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { t } from '@/core/i18n';
import { AppText } from '@/ui';
import { GameButton } from '@/ui/primitives/GameButton';

import { getPush } from './index';
import { markPushSoftAskHandled, shouldShowPushSoftAsk } from './softAsk';

/**
 * Контекстный мягкий запрос разрешения на уведомления.
 * Сам решает, показываться ли (после первого Game Over) при каждом маунте/визите.
 */
export function PushSoftAskSheet() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (shouldShowPushSoftAsk()) setVisible(true);
  }, []);

  if (!visible) return null;

  const close = () => {
    markPushSoftAskHandled();
    setVisible(false);
  };

  const allow = async () => {
    markPushSoftAskHandled();
    setVisible(false);
    await getPush().requestPermission();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View style={{ borderRadius: 24, padding: 24, gap: 16 }}>
          <AppText preset="title">{t('push.title')}</AppText>
          <AppText preset="body">{t('push.body')}</AppText>
          <GameButton label={t('push.allow')} onPress={allow} />
          <GameButton label={t('push.later')} variant="ghost" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
```

> Сверь импорты/пропсы с реальными API: `t` из `@/core/i18n`, пресеты `AppText` (`title`/`body`) из `src/ui`, доступные `variant` у `GameButton` (`src/ui/primitives/GameButton.tsx`), цвета фона/карточки из `ui/theme.ts` (не хардкодь — возьми токены, как в существующих оверлеях, напр. `ClayCard`). Если в проекте есть готовый `ClayCard` — оберни контент в него вместо ручного `View` со скруглением.

- [ ] **Step 4: Полный тайпчек и тесты**

Run: `npx tsc --noEmit` затем `npm test`
Expected: оба зелёные. Если tsc ругается на экспорт `PushSoftAskSheet`/`softAsk` из `index.ts` — на этом шаге оба файла уже существуют, ошибок быть не должно.

- [ ] **Step 5: Коммит**

```bash
git add src/core/i18n/en.ts src/core/i18n/ru.ts src/features/notifications/PushSoftAskSheet.tsx
git commit -m "feat(push): UI soft-ask + строки i18n (ru/en)"
```

---

## Task 7: Склейка в приложении (_layout + GameOverOverlay)

**Files:**
- Modify: `src/app/_layout.tsx`
- Modify: `src/features/game/components/GameOverOverlay.tsx`

- [ ] **Step 1: Init пушей + подписка на тап + монтирование sheet в `_layout.tsx`**

В `src/app/_layout.tsx`:
1. Добавить импорты рядом с существующим импортом монетизации:
```ts
import { useRouter } from 'expo-router';
import { getPush, PushSoftAskSheet } from '@/features/notifications';
```
2. В компоненте `RootLayout` добавить роутер и эффект инициализации рядом с существующим `getAds().init()`:
```ts
  const router = useRouter();

  useEffect(() => {
    const push = getPush();
    void push.init();
    const unsubscribe = push.onNotificationTap((route) => {
      router.navigate(route as never);
    });
    return unsubscribe;
  }, [router]);
```
3. Смонтировать sheet внутри `GestureHandlerRootView` (после `</ThemeProvider>` либо рядом с `<StatusBar/>`), чтобы он жил над навигацией:
```tsx
        <PushSoftAskSheet />
```

> `router.navigate(route as never)` — приведение типа из-за типизации статических маршрутов expo-router; маршрут уже санитизирован `resolvePushRoute`.

- [ ] **Step 2: Триггер soft-ask при закрытии Game Over**

В `src/features/game/components/GameOverOverlay.tsx`:
1. Импорт:
```ts
import { recordGameOverForPush } from '@/features/notifications';
```
2. Вызвать `recordGameOverForPush()` один раз при появлении оверлея (в `useEffect` с пустыми зависимостями, либо в существующем эффекте при `visible === true`). Пример, если оверлей управляется пропом `visible`:
```ts
  useEffect(() => {
    if (visible) recordGameOverForPush();
  }, [visible]);
```

> Проверь фактическую сигнатуру `GameOverOverlay` (как он узнаёт, что показан). Если он монтируется только при game over (без пропа `visible`) — достаточно `useEffect(() => { recordGameOverForPush(); }, [])`. Файл может редактироваться параллельным агентом — сверь `git status`.

- [ ] **Step 3: Тайпчек и тесты**

Run: `npx tsc --noEmit` затем `npm test`
Expected: оба зелёные.

- [ ] **Step 4: Коммит**

```bash
git add src/app/_layout.tsx src/features/game/components/GameOverOverlay.tsx
git commit -m "feat(push): init/тап в _layout и soft-ask после Game Over"
```

---

## Task 8: Config-plugin + регистрация в app.json

**Files:**
- Create: `plugins/withRuStorePush.js`
- Modify: `app.json`

- [ ] **Step 1: Написать config-plugin**

`plugins/withRuStorePush.js` (паттерн как у `plugins/withAppMetrica.js` — `expo/config-plugins`):
```js
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('expo/config-plugins');

const { addPermission } = AndroidConfig.Permissions;

/**
 * Готовит Android-проект под react-native-rustore-push:
 * - разрешение POST_NOTIFICATIONS (Android 13+);
 * - метадата канала/иконки уведомлений по умолчанию.
 * Сам нативный сервис регистрируется autolinking-ом пакета; здесь — манифестные мелочи.
 */
function withRuStorePush(config) {
  config = withAndroidManifest(config, (cfg) => {
    addPermission(cfg.modResults, 'android.permission.POST_NOTIFICATIONS');

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['meta-data'] = app['meta-data'] ?? [];
    const upsert = (name, value) => {
      const existing = app['meta-data'].find((m) => m.$['android:name'] === name);
      if (existing) existing.$['android:value'] = value;
      else app['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
    };
    upsert('ru.rustore.sdk.pushclient.default_notification_channel_id', 'default');
    return cfg;
  });

  return config;
}

module.exports = createRunOncePlugin(withRuStorePush, 'withRuStorePush', '1.0.0');
```

> Сверь требуемую метадату (имя канала, иконку, цвет) с версионной докой Android RuStore Push для закреплённого мажора. Если пакет требует иконку `drawable` — добавь ресурс через плагин или задокументируй ручной шаг. Тестируется на prebuild (Step 3), юнит-тестов для плагина не пишем (паттерн проекта — плагины не покрыты jest).

- [ ] **Step 2: Зарегистрировать плагин в app.json**

В `app.json`, в массив `expo.plugins`, добавить рядом с `"./plugins/withAppMetrica"`:
```json
"./plugins/withRuStorePush"
```
(Сверь `git status app.json` — файл открыт/может редактироваться; добавляй аккуратно с запятыми.)

- [ ] **Step 3: Проверить prebuild**

Run: `npx expo prebuild -p android --no-install`
Expected: проходит без ошибок; в `android/app/src/main/AndroidManifest.xml` появляется `POST_NOTIFICATIONS` и meta-data канала.

> Если репозиторий хранит `android/` как managed (генерируемый) — не коммить сгенерированную папку; коммить только плагин и app.json. Сверь `.gitignore`.

- [ ] **Step 4: Коммит**

```bash
git add plugins/withRuStorePush.js app.json
git commit -m "feat(push): config-plugin withRuStorePush (манифест + POST_NOTIFICATIONS)"
```

---

## Task 9: Документация (спеки)

**Files:**
- Create: `docs/specs/16-push-notifications.md`
- Modify: `docs/specs/07-performance.md`, `docs/specs/06-audience.md`, `CLAUDE.md`

- [ ] **Step 1: Создать каноничную спеку**

`docs/specs/16-push-notifications.md` — перенести содержание дизайна (`docs/superpowers/specs/2026-06-21-rustore-push-notifications-design.md`) в формат прочих спек: заголовок, статус «реализовано», дата, разделы Модель / Архитектура (`features/notifications`, `PushProvider`, Noop, фабрика) / Разрешение (soft-ask) / Маршрутизация тапа / Config-plugin / Ограничения доставки RuStore / Вне объёма (iOS, backend). Указать `projectId` через env, отсутствие сервисного токена в коде.

- [ ] **Step 2: Правка бюджета нативных зависимостей (07)**

В `docs/specs/07-performance.md`, в таблице «Бюджеты», строка «Нативные зависимости сверх Expo»: дополнить — было `только mmkv (+ ad/iap SDK при включении флагов)`, стало:
```
только mmkv (+ ad/iap SDK при включении флагов; + rustore-push (receive-only, Android, за флагом pushEnabled)); маскот «Капи» — 0 новых
```

- [ ] **Step 3: Правка анти-чеклиста (06)**

В `docs/specs/06-audience.md` в анти-чеклист добавить пункты про пуши: рассылки только из консоли RuStore вручную; не прерывают геймплей; разрешение — контекстный soft-ask после первого Game Over, не на холодном старте; отказ не доспрашиваем агрессивно; лёгкий opt-out через системные настройки.

- [ ] **Step 4: Добавить строку в таблицу спек CLAUDE.md**

В `CLAUDE.md`, в таблицу «Документация», добавить строку:
```
| [docs/specs/16-push-notifications.md](docs/specs/16-push-notifications.md) | Push-уведомления RuStore: приём, soft-ask, ручные кампании из консоли |
```

- [ ] **Step 5: Тайпчек/тесты (sanity) и коммит**

Run: `npx tsc --noEmit` затем `npm test`
Expected: зелёные (доки не влияют, но прогон обязателен по конвенции).

```bash
git add docs/specs/16-push-notifications.md docs/specs/07-performance.md docs/specs/06-audience.md CLAUDE.md
git commit -m "docs(push): спека 16 + правки бюджета 07 и анти-чеклиста 06"
```

---

## Финальная проверка (вне TDD-цикла, ручная на устройстве)

- [ ] Release-сборка на реальном Android-устройстве **с установленным RuStore и авторизацией** (см. `docs/specs/08-build-release.md` и скилл `build-signed-aab`). Указать реальный `EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID=M0xzrLkJBflEHvW4vaoyf134MX9yxBF3`.
- [ ] Проверить инициализацию (в dev — лог токена), `sendTestNotification` (если testMode), затем реальную тест-кампанию из RuStore Console.
- [ ] Тап по пушу с `data.route` ведёт на нужный экран; без `route` — на Home.
- [ ] Soft-ask появляется после первого Game Over, повторно не доспрашивает.

## Самопроверка плана (выполнена автором)

- **Покрытие дизайна:** интерфейс/Noop/фабрика → Task 1,3; projectId/без токена → Task 1,5; soft-ask → Task 4,6,7; тап→deep-link → Task 2,5,7; config-plugin → Task 8; правки 07/06/16/CLAUDE → Task 9; тесты → в каждом task; ограничение доставки RuStore → финальная ручная проверка. iOS/web Noop → Task 3 + `.native.ts` резолв.
- **Плейсхолдеры:** код приведён целиком в каждом шаге; «сверь с докой» относится только к версионно-зависимым именам нативного API (требование AGENTS.md), контракт зафиксирован тестом.
- **Согласованность имён:** `PushProvider`, `getPush`, `NoopPushProvider`, `RuStorePushProvider`, `resolvePushRoute`, `recordGameOverForPush`/`shouldShowPushSoftAsk`/`markPushSoftAskHandled`, `PushSoftAskSheet`, KEY `pushPrompt`, env `EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID` — едины во всех задачах.
