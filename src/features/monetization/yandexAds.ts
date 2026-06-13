import { NoopAdsProvider } from './noop';

/** Web and test fallback. Metro resolves yandexAds.native.ts on native builds. */
export const YandexAdsProvider = NoopAdsProvider;
