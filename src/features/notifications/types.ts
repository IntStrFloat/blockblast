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
