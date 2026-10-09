# 05 — Монетизация (реклама + IAP, RuStore)

Статус: реализовано · Обновлено: 2026-09-30

Актуальные правила и результаты проверки: [рефактор 30 сентября](../monetization/2026-09-30-refactor.md).
Первый interstitial — после 6 завершений, затем не чаще чем после 4 завершений
и раз в 180 секунд. После реального impression сбрасываются счётчики всех режимов;
проигрыши Adventure и видимые rewarded-предложения защищены от interstitial.
SDK и загрузка форматов разделены: старт не грузит оба формата, rewarded готовится
для применимого предложения и обновляет кнопки через подписку. Продолжение явно
обозначает просмотр рекламы; бонус Adventure выдаёт дополнительно заработанный XP.

## Модель

Гибрид (улучшение оригинала, у которого только реклама):
1. **Реклама**: interstitial в разрешённых паузах после четырёх завершений + rewarded за продолжение, помощников и бонус XP Adventure + sticky-баннер под треем фигур.
2. **IAP**: `remove_ads` (non-consumable) — убирает interstitial и баннер, rewarded-revive остаётся (это услуга игроку). Задел под косметику (скины блоков) и **косметические паки маскота «Капи»** (шапки/ауры/скины — только внешний вид, **no P2W**: помощники и прогресс не продаются) в v1.1. См. [09-mascot.md](09-mascot.md).

Принципы из [06-audience.md](06-audience.md): interstitial впервые разрешён после шести завершений и никогда не прерывает геймплей; rewarded — только добровольно.

## Архитектура (features/monetization)

Все SDK — за интерфейсами. Native-сборка использует Yandex Mobile Ads, web и тесты — platform-safe Noop-реализацию.

```ts
interface AdsProvider {
  init(): Promise<void>;
  prepareInterstitial?(): Promise<void>;
  prepareRewarded?(): Promise<void>;
  subscribeRewardedReady?(listener: () => void): () => void;
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
  interstitial: { minGamesBeforeFirst: 6, minIntervalSec: 180, everyNGameovers: 4 },
  fakeRewardedInDev: false,
};
```

## Частотные правила interstitial

Показ при повторе классической партии с ≥120 секунд активной игры либо переходе
после победы Adventure. Первый показ разрешён после 6 завершений; далее требуется
≥4 завершения в выбранном режиме и ≥180 секунд после fullscreen. Все серии
сбрасываются при фактическом impression, сохраняя общий бюджет при смене режима.
Проигрыш Adventure и экран с предложенной наградой не вызывают interstitial.
Счётчики — MMKV (`ads.meta`). Эксперимент новых установок дополнительно защищает
первую сессию и ограничивает treatment двумя показами за сессию.

## Entitlements

`iap.entitlements` в MMKV: `{ removeAds: boolean }`. Обновляется после purchase/restore; UI читает через zustand-стор. Покупка валидируется SDK (серверной валидации в v1 нет — оффлайн-игра, риск приемлем).

## Реальные SDK (по ресерчу, июнь 2026)

### Реклама — Yandex Mobile Ads (AdMob в РФ мёртв с 08.2024)

- Пакет: **`yandex-mobile-ads@8.3.0`** — официальный RN-пакет Яндекса (Android Yandex Mobile Ads SDK 8.3.0).
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

- ✅ Yandex Mobile Ads: подготовка форматов по игровому контексту, подписка на готовность rewarded, sticky-баннер под треем, награды только после reward-события.
- ✅ Platform-safe web/test fallback, частотные правила, entitlements-стор и `remove_ads`-проверки.
- ⬜ RuStore IAP остаётся выключенным до регистрации продукта.
