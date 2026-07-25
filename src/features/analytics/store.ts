import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import type {
  AnalyticsCommonContext,
  AnalyticsEvent,
  AnalyticsEventMap,
  AnalyticsEventName,
} from './types';
import { analyticsTransport, type AnalyticsTransport } from './transport';

const MAX_PERSISTED_EVENTS = 200;

interface AnalyticsState {
  queue: AnalyticsEvent[];
  optOut: boolean;
  context: AnalyticsCommonContext | null;
  initialize: (context: AnalyticsCommonContext) => void;
  flush: () => void;
  track: <Name extends AnalyticsEventName>(
    name: Name,
    properties: AnalyticsEventMap[Name],
  ) => void;
  setOptOut: (value: boolean) => void;
  clear: () => void;
}

interface CreateAnalyticsStoreOptions {
  now?: () => number;
  transport?: AnalyticsTransport;
}

function persist(queue: AnalyticsEvent[], optOut: boolean): void {
  setJSON(KEYS.analyticsQueue, queue);
  setJSON(KEYS.analyticsPrefs, { optOut });
}

export function createAnalyticsStore(options: CreateAnalyticsStoreOptions = {}) {
  const now = options.now ?? Date.now;
  const transport = options.transport ?? analyticsTransport;
  const initialQueue = (getJSON<AnalyticsEvent[]>(KEYS.analyticsQueue) ?? []).slice(
    -MAX_PERSISTED_EVENTS,
  );
  const initialPrefs = getJSON<{ optOut?: boolean }>(KEYS.analyticsPrefs);

  return create<AnalyticsState>((set, get) => ({
    queue: initialQueue,
    optOut: initialPrefs?.optOut ?? false,
    context: null,

    initialize: (context) => {
      transport.initialize({ enabled: !get().optOut });
      set({ context });
    },

    flush: () => {
      if (!get().optOut) transport.sendEventsBuffer();
    },

    track: (name, properties) => {
      if (get().optOut) return;
      const event = { name, properties, timestamp: now() } as AnalyticsEvent;
      const queue = [...get().queue, event].slice(-MAX_PERSISTED_EVENTS);
      set({ queue });
      persist(queue, get().optOut);

      try {
        transport.reportEvent(name, {
          ...(get().context ?? {}),
          ...properties,
          event_timestamp_ms: event.timestamp,
        });
      } catch {
        // The bounded MMKV queue preserves diagnostics until native init.
      }
    },

    setOptOut: (value) => {
      const queue = value ? [] : get().queue;
      set({ optOut: value, queue });
      persist(queue, value);
      transport.setDataSendingEnabled(!value);
    },

    clear: () => {
      set({ queue: [] });
      persist([], get().optOut);
    },
  }));
}

export const useAnalyticsStore = createAnalyticsStore();
