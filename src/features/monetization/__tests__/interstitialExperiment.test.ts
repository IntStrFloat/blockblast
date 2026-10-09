import { KEYS, getJSON, removeKey, setJSON } from '@/core/storage';
import { useAnalyticsStore } from '@/features/analytics';
import type { AnalyticsCommonContext } from '@/features/analytics';

import { MONETIZATION } from '../config';
import { useAdPresentation } from '../adPresentation';
import {
  EMPTY_ADS_META,
  recordAdventureLevelWin,
  recordFullscreenCooldown,
  recordGameOver,
  recordInterstitialShown,
} from '../frequency';
import {
  evaluateInterstitialOpportunity,
  initializeInterstitialExperiment,
} from '../interstitialExperiment';

const NOW = 2_000_000_000;

function context(overrides: Partial<AnalyticsCommonContext> = {}): AnalyticsCommonContext {
  return {
    schema_version: 2,
    config_version: 'retention-diagnostics-1',
    session_id: 'session-1',
    product_session_id: 'session-1',
    session_index: 1,
    app_version: '1.1.38',
    build_number: '43',
    platform: 'android',
    locale: 'ru-RU',
    games_played: 6,
    lifetime_games: 6,
    session_games: 6,
    is_first_session: true,
    entry_source: 'organic',
    first_launch_version: '1.1.38',
    install_state: 'new_install',
    device_class: 'phone',
    ...overrides,
  };
}

function forceVariant(variant: 'control' | 'first_session_capped'): void {
  setJSON(KEYS.analyticsExperiments, {
    seed: 'install-seed',
    assignments: { [MONETIZATION.interstitialExperiment.id]: variant },
  });
}

function initializeContext(value: AnalyticsCommonContext): void {
  useAnalyticsStore.setState({ context: value, activeRun: null, queue: [], optOut: false });
}

function eligibleAdventureMeta() {
  let meta = EMPTY_ADS_META;
  for (let index = 0; index < 6; index += 1) meta = recordAdventureLevelWin(meta);
  return meta;
}

function opportunity(
  meta = eligibleAdventureMeta(),
  mode: 'classic' | 'adventure' = 'adventure',
  counter: 'gameover' | 'adventure_level' = 'adventure_level',
  nowMs = NOW,
) {
  return evaluateInterstitialOpportunity(
    meta,
    {
      enabled: true,
      removeAds: false,
      nowMs,
      cfg: MONETIZATION.interstitial,
    },
    counter,
    mode,
    { activePlayMs: 120_000 },
  );
}

beforeEach(() => {
  useAdPresentation.setState({ automaticAdsSuppressedUntil: 0, fullscreenActive: false });
  removeKey(KEYS.analyticsExperiments);
  useAnalyticsStore.setState({ context: null, activeRun: null, queue: [], optOut: false });
});

describe('stable new-install assignment', () => {
  it('keeps a reversible config with the four-round control and a two-show treatment cap', () => {
    expect(MONETIZATION.interstitial).toEqual({
      minGamesBeforeFirst: 6,
      minIntervalSec: 180,
      everyNGameovers: 4,
    });
    expect(MONETIZATION.interstitialExperiment).toMatchObject({
      id: 'interstitial-first-session-v1',
      variants: ['control', 'first_session_capped'],
      treatmentMaxShowsPerSession: 2,
    });
  });
  it('randomizes a new install once and keeps the assignment across calls', () => {
    initializeContext(context());
    const trackOnce = jest.spyOn(useAnalyticsStore.getState(), 'trackOnce');
    const first = initializeInterstitialExperiment(context());
    const second = initializeInterstitialExperiment(context({
      session_index: 2,
      is_first_session: false,
      install_state: 'existing_install',
    }));
    expect(MONETIZATION.interstitialExperiment.variants).toContain(first);
    expect(second).toBe(first);
    expect(trackOnce).toHaveBeenCalledWith(
      expect.stringContaining('experiment-assignment:'),
      'experiment_assignment',
      expect.objectContaining({ variant: first, unit: 'installation' }),
    );
    trackOnce.mockRestore();
  });

  it('keeps an unassigned update in control instead of enrolling it', () => {
    expect(initializeInterstitialExperiment(context({
      first_launch_version: '1.1.37',
      install_state: 'updated_install',
      is_first_session: false,
    }))).toBe('control');
    expect(getJSON(KEYS.analyticsExperiments)).toBeNull();
  });
});

describe('first-session/cap treatment', () => {
  it('blocks retries, short Classic runs and previously offered rewards in both arms', () => {
    for (const variant of ['control', 'first_session_capped'] as const) {
      forceVariant(variant);
      initializeContext(context({ is_first_session: false, session_index: 2 }));
      const meta = { ...eligibleAdventureMeta(), adventureFailsSinceAd: 4, gameOversSinceAd: 4 };
      const opts = { enabled: true, removeAds: false, nowMs: NOW };
      expect(evaluateInterstitialOpportunity(meta, opts, 'adventure_fail', 'adventure').decision)
        .toBe('suppressed_adventure_retry');
      expect(evaluateInterstitialOpportunity(meta, opts, 'gameover', 'classic', { activePlayMs: 10_000 }).decision)
        .toBe('suppressed_short_run');
      expect(evaluateInterstitialOpportunity({ ...meta, rewardedOfferContextId: 'win-1' }, opts,
        'adventure_level', 'adventure', { resultContextId: 'win-1' }).decision)
        .toBe('suppressed_rewarded_offer');
      expect(evaluateInterstitialOpportunity(meta, opts, 'adventure_level', 'adventure',
        { resultContextId: 'other-win' }).shouldRequest).toBe(true);
    }
  });
  it('protects a recent rewarded decline regardless of the next result identity', () => {
    forceVariant('control');
    initializeContext(context({ is_first_session: false }));
    useAdPresentation.setState({ automaticAdsSuppressedUntil: NOW + 90_000 });
    expect(opportunity().decision).toBe('suppressed_rewarded_offer');
  });
  it('suppresses the sixth short Adventure win in session one but exposes both variants at base eligibility', () => {
    forceVariant('first_session_capped');
    initializeContext(context());
    const track = jest.spyOn(useAnalyticsStore.getState(), 'track');
    let meta = EMPTY_ADS_META;
    for (let index = 0; index < 5; index += 1) {
      meta = recordAdventureLevelWin(meta);
      expect(opportunity(meta).baseEligible).toBe(false);
    }
    meta = recordAdventureLevelWin(meta);
    expect(opportunity(meta)).toMatchObject({
      baseEligible: true,
      shouldRequest: false,
      decision: 'suppressed_first_session',
    });
    expect(track).toHaveBeenCalledWith(
      'interstitial_policy_eligible',
      expect.objectContaining({
        variant: 'first_session_capped',
        decision: 'suppressed_first_session',
      }),
    );
    track.mockRestore();
  });

  it('keeps current control behavior at the same sixth-win eligibility point', () => {
    forceVariant('control');
    initializeContext(context());
    expect(opportunity()).toMatchObject({
      variant: 'control',
      baseEligible: true,
      shouldRequest: true,
      decision: 'request',
    });
  });

  it('caps the treatment at two shown interstitials in one product session and resets on cold start', () => {
    forceVariant('first_session_capped');
    initializeContext(context({ is_first_session: false, session_index: 2, install_state: 'existing_install' }));
    let meta = eligibleAdventureMeta();
    meta = recordInterstitialShown(meta, NOW - 400_000, 'adventure_level', 'session-1');
    meta = { ...recordAdventureLevelWin(recordAdventureLevelWin(recordAdventureLevelWin(recordAdventureLevelWin(meta)))),
      lastFullscreenAt: NOW - 200_000, lastInterstitialAt: NOW - 200_000 };
    meta = recordInterstitialShown(meta, NOW - 200_000, 'adventure_level', 'session-1');
    meta = { ...recordAdventureLevelWin(recordAdventureLevelWin(recordAdventureLevelWin(recordAdventureLevelWin(meta)))),
      lastFullscreenAt: NOW - 200_000, lastInterstitialAt: NOW - 200_000 };

    expect(opportunity(meta)).toMatchObject({
      shouldRequest: false,
      decision: 'suppressed_session_cap',
    });

    initializeContext(context({
      product_session_id: 'session-2',
      session_id: 'session-2',
      session_index: 3,
      is_first_session: false,
      install_state: 'existing_install',
    }));
    expect(opportunity(meta)).toMatchObject({
      shouldRequest: true,
      decision: 'request',
    });
  });

  it('keeps rewarded outside the interstitial count while preserving fullscreen cooldown', () => {
    forceVariant('first_session_capped');
    initializeContext(context({ is_first_session: false, session_index: 2, install_state: 'existing_install' }));
    const rewarded = recordFullscreenCooldown(eligibleAdventureMeta(), NOW - 30_000);
    expect(opportunity(rewarded)).toMatchObject({
      baseEligible: false,
      decision: 'frequency_policy',
    });
    expect(rewarded.interstitialShowsInSession).toBe(0);
    expect(opportunity(rewarded, 'adventure', 'adventure_level', NOW + 150_000))
      .toMatchObject({ shouldRequest: true, decision: 'request' });
  });

  it('does not consume frequency or session cap on no-fill and handles a mixed eligible session', () => {
    forceVariant('control');
    initializeContext(context({ is_first_session: false, session_index: 2, install_state: 'existing_install' }));
    const noFillMeta = eligibleAdventureMeta();
    expect(opportunity(noFillMeta).shouldRequest).toBe(true);
    expect(opportunity(noFillMeta).shouldRequest).toBe(true);

    let mixed = EMPTY_ADS_META;
    for (let index = 0; index < 4; index += 1) mixed = recordGameOver(mixed);
    for (let index = 0; index < 4; index += 1) mixed = recordAdventureLevelWin(mixed);
    expect(opportunity(mixed, 'classic', 'gameover')).toMatchObject({ shouldRequest: true });
    expect(opportunity(mixed, 'adventure', 'adventure_level')).toMatchObject({ shouldRequest: true });
  });
});
