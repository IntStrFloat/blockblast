import { KEYS, getJSON, setJSON } from '@/core/storage';

import { ANALYTICS_CONFIG_VERSION, ANALYTICS_SCHEMA_VERSION } from './store';
import type { AnalyticsCommonContext, AnalyticsEntrySource } from './types';

export const PRODUCT_SESSION_TIMEOUT_MS = 30 * 60 * 1_000;

interface ProductSessionMeta {
  sessionIndex: number;
  firstLaunchVersion: string;
  lastSeenVersion: string;
  activeContext?: AnalyticsCommonContext;
  backgroundedAt?: number;
}

export interface ProductSessionInput {
  now: number;
  appVersion: string;
  buildNumber: string;
  platform: string;
  locale: string;
  deviceClass: AnalyticsCommonContext['device_class'];
  lifetimeGames: number;
  entrySource: AnalyticsEntrySource;
  idFactory: () => string;
}

export type ProductSessionResolution =
  | { kind: 'resumed'; context: AnalyticsCommonContext; pausedDurationMs: number }
  | {
      kind: 'started';
      context: AnalyticsCommonContext;
      previous?: {
        context: AnalyticsCommonContext;
        reason: 'background_timeout' | 'process_death';
      };
    };

function readMeta(): ProductSessionMeta | null {
  return getJSON<ProductSessionMeta>(KEYS.analyticsSessionMeta);
}

function writeMeta(meta: ProductSessionMeta): void {
  setJSON(KEYS.analyticsSessionMeta, meta);
}

export function resolveProductSession(input: ProductSessionInput): ProductSessionResolution {
  const previousMeta = readMeta();
  const previousContext = previousMeta?.activeContext;
  const backgroundedAt = previousMeta?.backgroundedAt;
  if (previousContext && backgroundedAt !== undefined) {
    const pausedDurationMs = Math.max(0, input.now - backgroundedAt);
    if (pausedDurationMs < PRODUCT_SESSION_TIMEOUT_MS) {
      writeMeta({ ...previousMeta, activeContext: previousContext, backgroundedAt: undefined });
      return { kind: 'resumed', context: previousContext, pausedDurationMs };
    }
  }

  const firstLaunchVersion = previousMeta
    ? previousMeta.firstLaunchVersion ?? 'unknown'
    : input.appVersion;
  const sessionIndex = Math.max(0, previousMeta?.sessionIndex ?? 0) + 1;
  const installState: AnalyticsCommonContext['install_state'] = !previousMeta
    ? 'new_install'
    : !previousMeta.firstLaunchVersion || !previousMeta.lastSeenVersion
      ? 'unknown'
      : previousMeta.lastSeenVersion !== input.appVersion
        ? 'updated_install'
        : 'existing_install';
  const productSessionId = input.idFactory();
  const lifetimeGames = Math.max(input.lifetimeGames, previousContext?.lifetime_games ?? 0);
  const context: AnalyticsCommonContext = {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    config_version: ANALYTICS_CONFIG_VERSION,
    session_id: productSessionId,
    product_session_id: productSessionId,
    session_index: sessionIndex,
    app_version: input.appVersion,
    build_number: input.buildNumber,
    platform: input.platform,
    locale: input.locale,
    games_played: lifetimeGames,
    lifetime_games: lifetimeGames,
    session_games: 0,
    is_first_session: sessionIndex === 1,
    entry_source: input.entrySource,
    first_launch_version: firstLaunchVersion,
    install_state: installState,
    device_class: input.deviceClass,
  };
  writeMeta({
    sessionIndex,
    firstLaunchVersion,
    lastSeenVersion: input.appVersion,
    activeContext: context,
  });
  return {
    kind: 'started',
    context,
    ...(previousContext
      ? {
          previous: {
            context: previousContext,
            reason: backgroundedAt === undefined ? ('process_death' as const) : ('background_timeout' as const),
          },
        }
      : {}),
  };
}

export function pauseProductSession(at: number): void {
  const meta = readMeta();
  if (!meta?.activeContext) return;
  writeMeta({ ...meta, backgroundedAt: at });
}

export function persistActiveProductSession(context: AnalyticsCommonContext): void {
  const meta = readMeta();
  if (!meta) return;
  writeMeta({ ...meta, activeContext: context });
}

export function clearActiveProductSession(): void {
  const meta = readMeta();
  if (!meta) return;
  writeMeta({ ...meta, activeContext: undefined, backgroundedAt: undefined });
}
