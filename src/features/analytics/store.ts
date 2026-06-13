import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import type { AnalyticsEvent, AnalyticsEventMap, AnalyticsEventName } from './types';

interface AnalyticsState {
  queue: AnalyticsEvent[];
  optOut: boolean;
  track: <Name extends AnalyticsEventName>(
    name: Name,
    properties: AnalyticsEventMap[Name],
  ) => void;
  setOptOut: (value: boolean) => void;
  clear: () => void;
}

interface CreateAnalyticsStoreOptions {
  now?: () => number;
}

function persist(queue: AnalyticsEvent[], optOut: boolean): void {
  setJSON(KEYS.analyticsQueue, queue);
  setJSON(KEYS.analyticsPrefs, { optOut });
}

export function createAnalyticsStore(options: CreateAnalyticsStoreOptions = {}) {
  const now = options.now ?? Date.now;
  const initialQueue = getJSON<AnalyticsEvent[]>(KEYS.analyticsQueue) ?? [];
  const initialPrefs = getJSON<{ optOut?: boolean }>(KEYS.analyticsPrefs);

  return create<AnalyticsState>((set, get) => ({
    queue: initialQueue,
    optOut: initialPrefs?.optOut ?? false,

    track: (name, properties) => {
      if (get().optOut) return;
      const queue = [...get().queue, { name, properties, timestamp: now() }];
      set({ queue });
      persist(queue, get().optOut);
    },

    setOptOut: (value) => {
      const queue = value ? [] : get().queue;
      set({ optOut: value, queue });
      persist(queue, value);
    },

    clear: () => {
      set({ queue: [] });
      persist([], get().optOut);
    },
  }));
}

export const useAnalyticsStore = createAnalyticsStore();
