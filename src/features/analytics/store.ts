import { create } from 'zustand';

import { KEYS, getJSON, setJSON } from '@/core/storage';

import type {
  AnalyticsCommonContext,
  AnalyticsEvent,
  AnalyticsEventMap,
  AnalyticsEventName,
  AnalyticsGameMode,
  AnalyticsRunEndReason,
  AnalyticsRunState,
} from './types';
import { analyticsTransport, type AnalyticsTransport } from './transport';

const MAX_PERSISTED_EVENTS = 500;
const MAX_DEDUPE_KEYS = 1_000;
export const ANALYTICS_SCHEMA_VERSION = 2 as const;
export const ANALYTICS_CONFIG_VERSION = 'contextual-monetization-1';

interface AnalyticsRuntimeState {
  activeRun: AnalyticsRunState | null;
  dedupeKeys: string[];
}

interface AnalyticsState {
  queue: AnalyticsEvent[];
  optOut: boolean;
  context: AnalyticsCommonContext | null;
  activeRun: AnalyticsRunState | null;
  initialize: (context: AnalyticsCommonContext) => void;
  endSession: () => void;
  updateContext: (patch: Partial<AnalyticsCommonContext>) => void;
  flush: () => void;
  track: <Name extends AnalyticsEventName>(name: Name, properties: AnalyticsEventMap[Name]) => string | null;
  trackOnce: <Name extends AnalyticsEventName>(dedupeKey: string, name: Name, properties: AnalyticsEventMap[Name]) => string | null;
  startRun: (
    mode: AnalyticsGameMode,
    startKind?: 'new' | 'restart',
    runId?: string,
    source?: 'home' | 'result' | 'restart' | 'next',
  ) => string;
  resumeRun: (
    mode: AnalyticsGameMode,
    resumeKind?: 'saved' | 'revive',
    runId?: string,
    counters?: { placements: number; lines: number; activeDurationMs: number },
  ) => string;
  pauseRun: () => void;
  recordFirstGrab: (mode: AnalyticsGameMode) => void;
  recordPlacement: (input: {
    mode: AnalyticsGameMode;
    guidance: 'guided' | 'assisted' | 'independent';
    clearedLines: number;
  }) => void;
  finishRun: (input: {
    mode: AnalyticsGameMode;
    result: 'completed' | 'failed' | 'abandoned';
    reason: AnalyticsRunEndReason;
    score?: number;
    lines?: number;
  }) => boolean;
  leaveRun: (reason: 'home') => void;
  exitRun: (reason: AnalyticsRunEndReason) => void;
  setOptOut: (value: boolean) => void;
  clear: () => void;
}

interface CreateAnalyticsStoreOptions {
  now?: () => number;
  idFactory?: () => string;
  transport?: AnalyticsTransport;
}

function persistQueue(queue: AnalyticsEvent[], optOut: boolean): void {
  setJSON(KEYS.analyticsQueue, queue);
  setJSON(KEYS.analyticsPrefs, { optOut });
}

function persistRuntime(activeRun: AnalyticsRunState | null, dedupeKeys: string[]): void {
  setJSON(KEYS.analyticsRuntime, { activeRun, dedupeKeys } satisfies AnalyticsRuntimeState);
}

function persistContext(context: AnalyticsCommonContext): void {
  const meta = getJSON<Record<string, unknown>>(KEYS.analyticsSessionMeta);
  if (meta) setJSON(KEYS.analyticsSessionMeta, { ...meta, activeContext: context });
}

export function payloadFor(event: AnalyticsEvent): Record<string, unknown> {
  const frozenContext = event.context ?? {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    config_version: ANALYTICS_CONFIG_VERSION,
    bootstrap_policy: 'preserve_without_historical_attribution',
  };
  return {
    ...event.properties,
    ...frozenContext,
    event_id: event.event_id,
    ...(event.run_id ? { run_id: event.run_id } : {}),
    context_status: event.context_status,
    event_timestamp_ms: event.timestamp,
  };
}

function migrateQueue(value: unknown): AnalyticsEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_PERSISTED_EVENTS).map((candidate, index) => {
    const legacy = candidate as Partial<AnalyticsEvent>;
    const timestamp = typeof legacy.timestamp === 'number' ? legacy.timestamp : 0;
    return {
      event_id: legacy.event_id ?? `legacy-${timestamp}-${index}`,
      name: legacy.name as AnalyticsEventName,
      properties: legacy.properties ?? {},
      timestamp,
      context: legacy.context ?? null,
      run_id: legacy.run_id ?? null,
      context_status: legacy.context ? 'ready' : 'bootstrap_unattributed',
    } as AnalyticsEvent;
  });
}

function pauseAt(run: AnalyticsRunState, at: number): AnalyticsRunState {
  if (run.active_since_ms === null) return run;
  return {
    ...run,
    active_duration_ms: run.active_duration_ms + Math.max(0, at - run.active_since_ms),
    active_since_ms: null,
  };
}

function normalizeRun(run: AnalyticsRunState | null | undefined): AnalyticsRunState | null {
  if (!run) return null;
  return {
    ...run,
    lines: Number.isFinite(run.lines) ? run.lines : 0,
    result_revision: Number.isFinite(run.result_revision) ? run.result_revision : 0,
  };
}

export function createAnalyticsStore(options: CreateAnalyticsStoreOptions = {}) {
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? (() => `${now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  const transport = options.transport ?? analyticsTransport;
  const initialQueue = migrateQueue(getJSON<unknown>(KEYS.analyticsQueue));
  const initialPrefs = getJSON<{ optOut?: boolean }>(KEYS.analyticsPrefs);
  const initialRuntime = getJSON<AnalyticsRuntimeState>(KEYS.analyticsRuntime);
  let dedupeKeys = initialRuntime?.dedupeKeys?.slice(-MAX_DEDUPE_KEYS) ?? [];

  const deliverQueued = (events: AnalyticsEvent[]): AnalyticsEvent[] => {
    let sentCount = 0;
    for (const event of events) {
      try {
        transport.reportEvent(event.name, payloadFor(event));
        sentCount += 1;
      } catch {
        break;
      }
    }
    return events.slice(sentCount);
  };

  return create<AnalyticsState>((set, get) => ({
    queue: initialQueue,
    optOut: initialPrefs?.optOut ?? false,
    context: null,
    activeRun: normalizeRun(initialRuntime?.activeRun),

    initialize: (context) => {
      transport.initialize({ enabled: !get().optOut });
      set({ context });
      persistContext(context);
      if (get().optOut || get().queue.length === 0) return;
      const remaining = deliverQueued(get().queue);
      set({ queue: remaining });
      persistQueue(remaining, get().optOut);
    },

    endSession: () => {
      get().pauseRun();
      set({ context: null });
    },

    updateContext: (patch) => {
      const current = get().context;
      if (current) {
        const next = { ...current, ...patch };
        set({ context: next });
        persistContext(next);
      }
    },

    flush: () => {
      if (get().optOut) return;
      const previous = get().queue;
      const remaining = deliverQueued(previous);
      if (remaining.length !== previous.length) {
        set({ queue: remaining });
        persistQueue(remaining, get().optOut);
      }
      transport.sendEventsBuffer();
    },

    track: (name, properties) => {
      if (get().optOut) return null;
      const context = get().context;
      const event = {
        event_id: idFactory(),
        name,
        properties,
        timestamp: now(),
        context: context ? { ...context } : null,
        run_id: get().activeRun?.run_id ?? null,
        context_status: context ? 'ready' : 'bootstrap_unattributed',
      } as AnalyticsEvent;
      try {
        transport.reportEvent(name, payloadFor(event));
      } catch {
        const queue = [...get().queue, event].slice(-MAX_PERSISTED_EVENTS);
        set({ queue });
        persistQueue(queue, get().optOut);
      }
      return event.event_id;
    },

    trackOnce: (dedupeKey, name, properties) => {
      if (get().optOut || dedupeKeys.includes(dedupeKey)) return null;
      dedupeKeys = [...dedupeKeys, dedupeKey].slice(-MAX_DEDUPE_KEYS);
      persistRuntime(get().activeRun, dedupeKeys);
      return get().track(name, properties);
    },

    startRun: (mode, startKind = 'new', runId, source) => {
      const current = get().activeRun;
      if (current && !current.terminal_reported) {
        get().finishRun({ mode: current.mode, result: 'abandoned', reason: 'replaced' });
      }
      const at = now();
      const run: AnalyticsRunState = {
        run_id: runId ?? idFactory(),
        mode,
        started_at_ms: at,
        active_since_ms: at,
        active_duration_ms: 0,
        placements: 0,
        lines: 0,
        result_revision: 0,
        first_grab_recorded: false,
        first_guided_clear_recorded: false,
        first_independent_clear_recorded: false,
        terminal_reported: false,
      };
      set({ activeRun: run });
      persistRuntime(run, dedupeKeys);
      get().track('run_started', { mode, start_kind: startKind });
      get().track('new_game', {
        mode,
        source: source ?? (startKind === 'restart' ? 'restart' : 'home'),
      });
      return run.run_id;
    },

    resumeRun: (mode, resumeKind = 'saved', runId, counters) => {
      const current = get().activeRun;
      if (!current || current.mode !== mode || (runId && current.run_id !== runId)) {
        const createdId = get().startRun(mode, 'new', runId);
        const created = get().activeRun;
        if (created && counters) {
          const reconciled = {
            ...created,
            placements: counters.placements,
            lines: counters.lines,
            active_duration_ms: counters.activeDurationMs,
          };
          set({ activeRun: reconciled });
          persistRuntime(reconciled, dedupeKeys);
        }
        return createdId;
      }
      if (current.terminal_reported && resumeKind !== 'revive') return current.run_id;
      const wasPaused = current.active_since_ms === null || current.terminal_reported;
      const resumed = {
        ...current,
        active_since_ms: current.active_since_ms ?? now(),
        placements: Math.max(current.placements, counters?.placements ?? 0),
        lines: Math.max(current.lines, counters?.lines ?? 0),
        active_duration_ms: Math.max(
          current.active_duration_ms,
          counters?.activeDurationMs ?? 0,
        ),
      };
      resumed.terminal_reported = false;
      set({ activeRun: resumed });
      persistRuntime(resumed, dedupeKeys);
      if (wasPaused) get().track('run_resumed', { mode, resume_kind: resumeKind });
      return resumed.run_id;
    },

    pauseRun: () => {
      const current = get().activeRun;
      if (!current || current.terminal_reported) return;
      const paused = pauseAt(current, now());
      set({ activeRun: paused });
      persistRuntime(paused, dedupeKeys);
    },

    recordFirstGrab: (mode) => {
      const current = get().activeRun;
      if (!current || current.mode !== mode || current.first_grab_recorded) return;
      const updated = { ...current, first_grab_recorded: true };
      set({ activeRun: updated });
      persistRuntime(updated, dedupeKeys);
      get().track('piece_grabbed', {
        first_in_install: get().context?.lifetime_games === 0,
        game_depth: (get().context?.lifetime_games ?? 0) + 1,
      });
    },

    recordPlacement: ({ mode, guidance, clearedLines }) => {
      const current = get().activeRun;
      if (!current || current.mode !== mode || current.terminal_reported) return;
      const placementIndex = current.placements + 1;
      const firstGuided =
        guidance !== 'independent' && clearedLines > 0 && !current.first_guided_clear_recorded;
      const firstIndependent =
        guidance === 'independent' && clearedLines > 0 && !current.first_independent_clear_recorded;
      const updated = {
        ...current,
        placements: placementIndex,
        lines: current.lines + clearedLines,
        first_guided_clear_recorded: current.first_guided_clear_recorded || firstGuided,
        first_independent_clear_recorded: current.first_independent_clear_recorded || firstIndependent,
      };
      set({ activeRun: updated });
      persistRuntime(updated, dedupeKeys);
      if (placementIndex <= 10) {
        get().track('piece_accepted', {
          mode,
          placement_index: placementIndex,
          cleared_lines: clearedLines,
          guidance,
        });
      }
      if (firstGuided) get().track('first_guided_clear', { mode, placement_index: placementIndex });
      if (firstIndependent) get().track('first_independent_clear', { mode, placement_index: placementIndex });
    },

    finishRun: ({ mode, result, reason, score, lines }) => {
      const current = get().activeRun;
      if (!current || current.mode !== mode || current.terminal_reported) return false;
      const terminal = {
        ...pauseAt(current, now()),
        terminal_reported: true,
        result_revision: current.result_revision + 1,
      };
      set({ activeRun: terminal });
      persistRuntime(terminal, dedupeKeys);
      const context = get().context;
      if (context && current.result_revision === 0 && result !== 'abandoned') {
        const nextContext = {
          ...context,
          games_played: context.lifetime_games + 1,
          lifetime_games: context.lifetime_games + 1,
          session_games: context.session_games + 1,
        };
        set({ context: nextContext });
        persistContext(nextContext);
      }
      get().trackOnce(`run-result:${terminal.run_id}:${terminal.result_revision}`, 'run_result', {
        mode,
        result,
        reason,
        active_duration_ms: terminal.active_duration_ms,
        placements: terminal.placements,
        ...(score === undefined ? {} : { score }),
        lines: lines ?? terminal.lines,
      });
      return true;
    },

    leaveRun: (reason) => {
      const current = get().activeRun;
      if (!current) return;
      get().pauseRun();
      get().track('run_exit', { mode: current.mode, reason });
    },

    exitRun: (reason) => {
      const current = get().activeRun;
      if (!current) return;
      if (!current.terminal_reported) get().finishRun({ mode: current.mode, result: 'abandoned', reason });
      get().trackOnce(`run-exit:${current.run_id}:${reason}`, 'run_exit', { mode: current.mode, reason });
    },

    setOptOut: (value) => {
      const queue = value ? [] : get().queue;
      if (value) {
        dedupeKeys = [];
        persistRuntime(null, dedupeKeys);
        const sessionMeta = getJSON<Record<string, unknown>>(KEYS.analyticsSessionMeta);
        if (sessionMeta) {
          setJSON(KEYS.analyticsSessionMeta, {
            ...sessionMeta,
            activeContext: undefined,
            backgroundedAt: undefined,
          });
        }
      }
      set({ optOut: value, queue, context: value ? null : get().context, activeRun: value ? null : get().activeRun });
      persistQueue(queue, value);
      transport.setDataSendingEnabled(!value);
    },

    clear: () => {
      set({ queue: [] });
      persistQueue([], get().optOut);
    },
  }));
}

export const useAnalyticsStore = createAnalyticsStore();
