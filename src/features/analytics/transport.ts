export type AnalyticsProperties = Record<string, unknown>;

export interface AnalyticsTransport {
  initialize(options: { enabled: boolean }): void;
  reportEvent(name: string, properties: AnalyticsProperties): void;
  sendEventsBuffer(): void;
  setDataSendingEnabled(enabled: boolean): void;
}

const DEV_BUFFER_LIMIT = 200;

/** Web, SSR and test fallback. It is deliberately bounded. */
export class BufferedDevTransport implements AnalyticsTransport {
  readonly events: { name: string; properties: AnalyticsProperties }[] = [];
  private enabled = true;

  initialize({ enabled }: { enabled: boolean }): void {
    this.enabled = enabled;
    if (!enabled) this.events.length = 0;
  }

  reportEvent(name: string, properties: AnalyticsProperties): void {
    if (!this.enabled) return;
    this.events.push({ name, properties });
    if (this.events.length > DEV_BUFFER_LIMIT) {
      this.events.splice(0, this.events.length - DEV_BUFFER_LIMIT);
    }
  }

  sendEventsBuffer(): void {}

  setDataSendingEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.events.length = 0;
  }
}

export const analyticsTransport: AnalyticsTransport = new BufferedDevTransport();
