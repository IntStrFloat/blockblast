import {
  assignExperimentVariant,
  getExperimentAssignment,
  recordExperimentExposure,
  useAnalyticsStore,
} from '@/features/analytics';
import type { AnalyticsCommonContext, AnalyticsGameMode } from '@/features/analytics';

import { MONETIZATION } from './config';
import { areAutomaticAdsSuppressed } from './adPresentation';
import { placementSuppression, type ResultAdContext, type PlacementSuppression } from './placementPolicy';
import {
  interstitialShowsForSession,
  shouldShowInterstitial,
} from './frequency';
import type { AdsMeta, FrequencyOpts, InterstitialCounter } from './frequency';
import type { InterstitialTelemetry } from './types';

export type InterstitialExperimentVariant = 'control' | 'first_session_capped';
export type InterstitialPolicyDecision =
  | PlacementSuppression
  | 'frequency_policy'
  | 'request'
  | 'suppressed_first_session'
  | 'suppressed_session_cap';

export interface InterstitialOpportunity {
  variant: InterstitialExperimentVariant;
  baseEligible: boolean;
  shouldRequest: boolean;
  decision: InterstitialPolicyDecision;
  telemetry: InterstitialTelemetry | null;
}

function isVariant(value: string | null): value is InterstitialExperimentVariant {
  return value === 'control' || value === 'first_session_capped';
}

export function initializeInterstitialExperiment(
  context: AnalyticsCommonContext,
): InterstitialExperimentVariant {
  const config = MONETIZATION.interstitialExperiment;
  if (!config.enabled) return 'control';
  const existing = getExperimentAssignment(config.id);
  let variant: InterstitialExperimentVariant;
  if (isVariant(existing)) {
    variant = existing;
  } else if (context.is_first_session && context.install_state === 'new_install') {
    variant = assignExperimentVariant(config.id, config.variants) as InterstitialExperimentVariant;
  } else {
    return 'control';
  }
  if (context.is_first_session && context.install_state === 'new_install') {
    useAnalyticsStore.getState().trackOnce(
      `experiment-assignment:${config.id}:${variant}`,
      'experiment_assignment',
      {
        experiment_id: config.id,
        variant,
        unit: 'installation',
        enrollment: 'new_install',
      },
    );
  }
  return variant;
}

export function currentInterstitialExperimentVariant(): InterstitialExperimentVariant {
  if (!MONETIZATION.interstitialExperiment.enabled) return 'control';
  const assigned = getExperimentAssignment(MONETIZATION.interstitialExperiment.id);
  return isVariant(assigned) ? assigned : 'control';
}

function activePlayMs(nowMs: number): number {
  const run = useAnalyticsStore.getState().activeRun;
  if (!run) return 0;
  return run.active_duration_ms +
    (run.active_since_ms === null ? 0 : Math.max(0, nowMs - run.active_since_ms));
}

export function evaluateInterstitialOpportunity(
  meta: AdsMeta,
  opts: FrequencyOpts,
  counter: InterstitialCounter,
  mode: AnalyticsGameMode,
  resultContext: ResultAdContext = {},
): InterstitialOpportunity {
  const baseEligible = shouldShowInterstitial(meta, opts, counter);
  const variant = currentInterstitialExperimentVariant();
  if (!baseEligible) {
    return {
      variant,
      baseEligible: false,
      shouldRequest: false,
      decision: 'frequency_policy',
      telemetry: null,
    };
  }

  const analytics = useAnalyticsStore.getState();
  const context = analytics.context;
  const productSessionId = context?.product_session_id ?? 'bootstrap';
  const sessionShows = interstitialShowsForSession(meta, productSessionId);
  const treatment = variant === 'first_session_capped';
  const suppression = placementSuppression(counter, {
    ...resultContext,
    rewardedOfferPresented: resultContext.rewardedOfferPresented ||
      (!!resultContext.resultContextId && meta.rewardedOfferContextId === resultContext.resultContextId) ||
      areAutomaticAdsSuppressed(opts.nowMs),
  });
  const decision: Exclude<InterstitialPolicyDecision, 'frequency_policy'> =
    suppression ?? (treatment && context?.is_first_session
      ? 'suppressed_first_session'
      : treatment &&
          sessionShows >= MONETIZATION.interstitialExperiment.treatmentMaxShowsPerSession
        ? 'suppressed_session_cap'
        : 'request');
  const telemetry: InterstitialTelemetry = {
    experiment_id: MONETIZATION.interstitialExperiment.id,
    variant,
    mode,
    product_session_id: productSessionId,
    session_index: context?.session_index ?? 0,
    session_depth: context?.session_games ?? 0,
    active_play_ms: activePlayMs(opts.nowMs),
    session_interstitial_shows: sessionShows,
    policy_version: MONETIZATION.placementPolicy.version,
    result_context_id: resultContext.resultContextId,
  };

  recordExperimentExposure(
    MONETIZATION.interstitialExperiment.id,
    variant,
    'interstitial_eligibility',
  );
  analytics.track('interstitial_policy_eligible', {
    ...telemetry,
    placement: counter,
    decision,
  });
  return {
    variant,
    baseEligible: true,
    shouldRequest: decision === 'request',
    decision,
    telemetry,
  };
}
