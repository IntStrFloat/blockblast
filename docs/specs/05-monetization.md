# 05 — Монетизация (реклама + IAP, RuStore)

Статус: реализовано · Обновлено: 2026-06-13

## Модель

Гибрид (улучшение оригинала, у которого только реклама):
1. **Реклама**: interstitial после каждого третьего Game Over + rewarded за Revive + sticky-баннер под треем фигур.
2. **IAP**: `remove_ads` (non-consumable) — убирает interstitial и баннер, rewarded-revive остаётся (это услуга игроку). Задел под косметику (скины) в v1.1.

Принципы из [06-audience.md](06-audience.md): interstitial не показывается после первых двух партий и никогда не прерывает геймплей; rewarded — только добровольно.

## Архитектура (features/monetization)

Все SDK — за интерфейсами. Native-сборка использует Yandex Mobile Ads, web и тесты — platform-safe Noop-реализацию.

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

- `NoopAdsProvider` / `NoopIapProvider`: web/test fallback; rewarded → `'unavailable'`.
- Выбор провайдера — фабрика по флагам в `monetization/config.ts`:

```ts
export const MONETIZATION = {
  adsEnabled: true,
  bannerEnabled: true,
  iapEnabled: false,          // включить при регистрации в RuStore Console
  interstitial: { minGamesBeforeFirst: 3, minIntervalSec: 0, everyNGameovers: 3 },
  fakeRewardedInDev: false,
};
```

## Частотные правила interstitial

Показ при выходе из Game Over-оверлея после 3-го, 6-го, 9-го и далее проигрыша, если `remove_ads` не куплен. Счётчик сбрасывается только после фактического показа. Счётчики — MMKV (`ads.meta`).

## Entitlements

`iap.entitlements` в MMKV: `{ removeAds: boolean }`. Обновляется после purchase/restore; UI читает через zustand-стор. Покупка валидируется SDK (серверной валидации в v1 нет — оффлайн-игра, риск приемлем).

## Реальные SDK (по ресерчу, июнь 2026)

### Реклама — Yandex Mobile Ads (AdMob в РФ мёртв с 08.2024)

- Пакет: **`yandex-mobile-ads@8.1.0`** — официальный RN-пакет Яндекса.
- Форматы: sticky banner, interstitial, rewarded, app open. Требования: minSdk 23+, iOS 13+.
- Expo: пакет подключается через React Native autolinking в prebuild/native-сборке.
- Ad unit IDs публичны и имеют env-overrides `EXPO_PUBLIC_YANDEX_*_AD_UNIT_ID`. OAuth/UAuth-токен кабинета не используется приложением и хранится только локально вне git.

### IAP Android — RuStore Billing

- Официальный SDK: `rustore-dev/react-native-rustore-billing-sdk` (распространяется через GitFlic, не npm): `npm i git+https://git@gitflic.ru/project/rustore/react-native-rustore-billing-sdk.git`.
- Альтернатива с Expo config plugin: `@somersets/react-native-rustore-iap`.
- Поток: `init({consoleApplicationId, deeplinkScheme: 'blockblast'})` → `checkPurchasesAvailability` → `getProducts(['remove_ads'])` → `purchaseProduct` → подтверждение. Продукт `remove_ads` завести в RuStore Console.
- `RuStoreIapProvider implements IapProvider`; deeplink scheme уже `blockblast` (app.json).

### IAP iOS — `expo-iap` (рекомендация Expo, есть config plugin) — адаптер `AppleIapProvider`, при выходе в App Store.

## Состояние v1 (этой сборки)

- ✅ Yandex Mobile Ads: preload/reload interstitial и rewarded, sticky-баннер под треем, revive только после reward-события.
- ✅ Platform-safe web/test fallback, частотные правила, entitlements-стор и `remove_ads`-проверки.
- ⬜ RuStore IAP остаётся выключенным до регистрации продукта.
