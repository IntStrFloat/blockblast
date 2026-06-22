/**
 * Локальный type-shim для `react-native-rustore-push` (GitFlic 6.x).
 * Пакет поставляется только в виде `src/*.tsx` без собранных `lib/typescript`,
 * поэтому tsc не может разрешить его типы. Объявляем минимальную поверхность API,
 * которую реально используем в `rustorePush.native.ts`. Рантайм берёт настоящий
 * модуль (Metro резолвит `react-native` → `src/index`), shim — только для типов.
 */
declare module 'react-native-rustore-push' {
  export interface RemoteMessage {
    messageId?: string;
    data?: { key: string; value: string };
    notification?: {
      title?: string;
      body?: string;
      clickAction?: string;
      clickActionType?: string;
    };
  }

  export const PushEvents: {
    ON_NEW_TOKEN: 'ON_NEW_TOKEN';
    ON_MESSAGE_RECEIVED: 'ON_MESSAGE_RECEIVED';
    ON_DELETED_MESSAGES: 'ON_DELETED_MESSAGES';
    ON_ERROR: 'ON_ERROR';
    ON_OPENED: 'ON_OPENED';
  };

  export interface RustorePushModule {
    createPushEmitter(): void;
    deletePushEmitter(): void;
    getToken(): Promise<string>;
    deleteToken(): Promise<boolean>;
    checkPushAvailability(): Promise<boolean>;
    getInitialNotification(): Promise<RemoteMessage | null>;
  }

  export interface PushEventSubscription {
    remove(): void;
  }

  export const eventEmitter: {
    addListener(
      event: string,
      listener: (message: RemoteMessage) => void,
    ): PushEventSubscription;
  };

  const RustorePushClient: RustorePushModule;
  export default RustorePushClient;
}
