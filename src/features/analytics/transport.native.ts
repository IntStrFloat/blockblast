import Constants from 'expo-constants';

import type { AnalyticsProperties, AnalyticsTransport } from './transport';

interface AppMetricaSdk {
  activate(config: { apiKey: string; statisticsSending?: boolean; logs?: boolean }): void;
  reportEvent(name: string, properties?: Record<string, unknown>): void;
  sendEventsBuffer(): void;
  setDataSendingEnabled(enabled: boolean): void;
}

interface AppMetricaTransportOptions {
  sdk?: AppMetricaSdk;
  getApiKey?: () => string | undefined;
  dev?: boolean;
}

function loadSdk(): AppMetricaSdk {
  // Lazy loading keeps SSR and unit tests independent from the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@appmetrica/react-native-analytics').default as AppMetricaSdk;
}

function configuredApiKey(): string | undefined {
  return Constants.expoConfig?.extra?.appMetricaApiKey as string | undefined;
}

export class AppMetricaTransport implements AnalyticsTransport {
  private initialized = false;
  private enabled = true;
  private sdk: AppMetricaSdk | undefined;
  private readonly getApiKey: () => string | undefined;
  private readonly dev: boolean;

  constructor(options: AppMetricaTransportOptions = {}) {
    this.sdk = options.sdk;
    this.getApiKey = options.getApiKey ?? configuredApiKey;
    this.dev = options.dev ?? __DEV__;
  }

  initialize({ enabled }: { enabled: boolean }): void {
    this.enabled = enabled;
    if (this.initialized) {
      this.sdk!.setDataSendingEnabled(enabled);
      return;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      if (this.dev) console.warn('AppMetrica is disabled: API key is unavailable.');
      return;
    }

    const sdk = (this.sdk ??= loadSdk());
    sdk.activate({
      apiKey,
      statisticsSending: enabled,
      logs: this.dev,
    });
    this.initialized = true;
  }

  reportEvent(name: string, properties: AnalyticsProperties): void {
    if (!this.initialized || !this.enabled) {
      throw new Error('AppMetrica transport is not ready');
    }
    this.sdk!.reportEvent(name, properties);
  }

  sendEventsBuffer(): void {
    if (this.initialized && this.enabled) this.sdk!.sendEventsBuffer();
  }

  setDataSendingEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.initialized) this.sdk!.setDataSendingEnabled(enabled);
  }

}

export function createAppMetricaTransport(
  options: AppMetricaTransportOptions = {},
): AnalyticsTransport {
  return new AppMetricaTransport(options);
}

export const analyticsTransport: AnalyticsTransport = new AppMetricaTransport();
