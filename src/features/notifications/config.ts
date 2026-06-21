export const PUSH = {
  /** Приём пушей RuStore (Android). Web/iOS/test всегда Noop независимо от флага. */
  pushEnabled: true,
  /** Идентификатор проекта RuStore Push. Не секрет, но держим через env. */
  projectId: process.env.EXPO_PUBLIC_RUSTORE_PUSH_PROJECT_ID ?? '',
  /** В dev включает путь sendTestNotification и логирование токена. */
  testMode: __DEV__,
} as const;
