# 05 — Монетизация (реклама + IAP, RuStore)

Статус: утверждено · Обновлено: 2026-06-12

## Модель

Гибрид (улучшение оригинала, у которого только реклама):
1. **Реклама**: interstitial после Game Over + rewarded за Revive (+ баннер на игровом экране — опционально, флагом).
2. **IAP**: `remove_ads` (non-consumable) — убирает interstitial и баннер, rewarded-revive остаётся (это услуга игроку). Задел под косметику (скины блоков) и **косметические паки маскота «Капи»** (шапки/ауры/скины — только внешний вид, **no P2W**: помощники и прогресс не продаются) в v1.1. См. [09-mascot.md](09-mascot.md).

Принципы из [06-audience.md](06-audience.md): никакой рекламы в первых 3 партиях, никогда — во время геймплея, rewarded — только добровольно.

## Архитектура (features/monetization)

Все SDK — за интерфейсами. Приложение всегда собирается и работает с Noop-реализациями; реальные провайдеры включаются флагами, когда появятся креды.

```ts
interface AdsProvider {
  init(): Promise<void>;
  showInterstitial(placement: 'gameover'): Promise<'shown' | 'skipped' | 'unavailable'>;
  showRewarded(placement: 'revive'): Promise<'rewarded' | 'dismissed' | 'unavailable'>;
  isRewardedReady(): boolean;          // прячем кнопку Revive, если нет
}
interface IapProvider {
  init(): Promise<void>;
  getProducts(ids: string[]): Promise<Product[]>;
  purchase(id: string): Promise<'purchased' | 'cancelled' | 'failed'>;
  restore(): Promise<string[]>;        // купленные productIds
}
```

- `NoopAdsProvider` / `NoopIapProvider` — дефолт: rewarded → `'unavailable'` (кнопка Revive скрыта… НО в dev-сборках флаг `FAKE_REWARDED=true` даёт revive бесплатно для теста UX).
- Выбор провайдера — фабрика по флагам в `monetization/config.ts`:

```ts
export const MONETIZATION = {
  adsEnabled: false,          // включить при наличии Yandex ad unit IDs
  bannerEnabled: false,       // отдельно: баннер агрессивнее, решение после метрик
  iapEnabled: false,          // включить при регистрации в RuStore Console
  interstitial: { minGamesBeforeFirst: 3, minIntervalSec: 120, everyNGameovers: 2 },
  fakeRewardedInDev: true,
};
```

## Частотные правила interstitial

Показ после закрытия Game Over-оверлея, если: партий сыграно ≥ 3 И с прошлого показа ≥ 120 сек И это каждый 2-й game over И `remove_ads` не куплен. Счётчики — MMKV (`ads.meta`).

## Entitlements

`iap.entitlements` в MMKV: `{ removeAds: boolean }`. Обновляется после purchase/restore; UI читает через zustand-стор. Покупка валидируется SDK (серверной валидации в v1 нет — оффлайн-игра, риск приемлем).

## Реальные SDK (по ресерчу, июнь 2026)

### Реклама — Yandex Mobile Ads (AdMob в РФ мёртв с 08.2024)

- Пакет: **`yandex-mobile-ads@8.1.0`** — официальный RN-пакет Яндекса.
- Форматы: sticky banner, interstitial, rewarded, app open. Требования: minSdk 23+, iOS 13+.
- Expo: config plugin отсутствует → нужен `npx expo prebuild` (мы и так в prebuild-пайплайне для APK).
- Шаги включения: (1) кабинет partner.yandex — создать приложение и ad units (interstitial + rewarded), (2) `npm i yandex-mobile-ads`, prebuild, (3) написать `YandexAdsProvider implements AdsProvider` (~80 строк, обёртка init/load/show), (4) ad unit IDs → `monetization/config.ts`, `adsEnabled: true`, (5) demo-ad-unit-ids для теста: `demo-interstitial-yandex`, `demo-rewarded-yandex`.

### IAP Android — RuStore Billing

- Официальный SDK: `rustore-dev/react-native-rustore-billing-sdk` (распространяется через GitFlic, не npm): `npm i git+https://git@gitflic.ru/project/rustore/react-native-rustore-billing-sdk.git`.
- Альтернатива с Expo config plugin: `@somersets/react-native-rustore-iap`.
- Поток: `init({consoleApplicationId, deeplinkScheme: 'blockblast'})` → `checkPurchasesAvailability` → `getProducts(['remove_ads'])` → `purchaseProduct` → подтверждение. Продукт `remove_ads` завести в RuStore Console.
- `RuStoreIapProvider implements IapProvider`; deeplink scheme уже `blockblast` (app.json).

### IAP iOS — `expo-iap` (рекомендация Expo, есть config plugin) — адаптер `AppleIapProvider`, при выходе в App Store.

## Состояние v1 (этой сборки)

- ✅ Интерфейсы, Noop-провайдеры, фабрика, флаги, частотные правила, entitlements-стор, кнопки «Убрать рекламу»/«Восстановить» в настройках (показывают «недоступно в этой сборке» при `iapEnabled:false` — или скрыты), revive-флоу через `AdsProvider`.
- ⬜ Подключение реальных SDK — по шагам выше, когда появятся аккаунты Yandex Ads / RuStore Console. Код приложения при этом не меняется — только провайдеры и флаги.
