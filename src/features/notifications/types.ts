export type PushPermissionResult = 'granted' | 'denied' | 'unavailable' | 'error';

/** Полезная нагрузка пуша, на которую мы реагируем при тапе. */
export interface PushTapPayload {
  /** Маршрут expo-router, куда вести игрока. Необязателен. */
  route?: string;
  [key: string]: unknown;
}

export interface PushNotificationTap {
  id: string | null;
  route: string;
  /** Семантический тип удалённого уведомления, если отправитель его передал. */
  kind: string;
}

/** Реализации: NoopPushProvider (web/iOS/test), RuStorePushProvider (Android, по флагу). */
export interface PushProvider {
  init(): Promise<void>;
  requestPermission(): Promise<PushPermissionResult>;
  /** Однократно получить уведомление, которым запущено приложение. */
  getInitialNotificationTap(): Promise<PushNotificationTap | null>;
  /** Подписка на тап по пушу. Возвращает функцию отписки. */
  onNotificationTap(handler: (tap: PushNotificationTap) => void): () => void;
}
