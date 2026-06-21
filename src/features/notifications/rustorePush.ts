import { NoopPushProvider } from './noop';

/** Web and test fallback. Metro resolves rustorePush.native.ts on native builds. */
export const RuStorePushProvider = NoopPushProvider;
