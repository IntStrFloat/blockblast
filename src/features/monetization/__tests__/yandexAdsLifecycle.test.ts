const mockTrack = jest.fn();
const mockInterstitialLoad = jest.fn();
const mockRewardedLoad = jest.fn();
const mockInterstitialLoaderCreate = jest.fn(async () => ({ loadAd: mockInterstitialLoad }));
const mockRewardedLoaderCreate = jest.fn(async () => ({ loadAd: mockRewardedLoad }));
const mockSetJSON = jest.fn();
const mockInitialize = jest.fn(async () => {});

jest.mock('@/core/storage', () => ({
  KEYS: { adsMeta: 'ads.meta', adsPresentation: 'ads.presentation.v1' },
  getJSON: () => null,
  setJSON: (...args: unknown[]) => mockSetJSON(...args),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockInterstitialLoad.mockReset();
  mockRewardedLoad.mockReset();
  mockInitialize.mockReset().mockResolvedValue(undefined);
  mockInterstitialLoaderCreate.mockReset().mockResolvedValue({ loadAd: mockInterstitialLoad });
  mockRewardedLoaderCreate.mockReset().mockResolvedValue({ loadAd: mockRewardedLoad });
});

jest.mock('@/features/analytics', () => ({
  getExperimentAssignment: () => 'first_session_capped',
  useAnalyticsStore: {
    getState: () => ({
      context: {
        product_session_id: 'session-native',
        session_games: 6,
      },
      track: mockTrack,
    }),
  },
}));

jest.mock('yandex-mobile-ads', () => ({
  InterstitialAdLoader: { create: mockInterstitialLoaderCreate },
  RewardedAdLoader: { create: mockRewardedLoaderCreate },
  MobileAds: { initialize: mockInitialize },
}));

describe('Yandex interstitial native lifecycle provenance', () => {
  it('tracks real preload completion and invokes persistence callback at impression, before dismiss', async () => {
    const interstitial: Record<string, unknown> & { show: jest.Mock } = {
      show: jest.fn(async () => {}),
    };
    const rewarded = { show: jest.fn(async () => {}) };
    mockInterstitialLoad.mockResolvedValueOnce(interstitial);
    mockRewardedLoad.mockResolvedValueOnce(rewarded);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { YandexAdsProvider } = require('../yandexAds.native') as typeof import('../yandexAds.native');
    await YandexAdsProvider.init();
    await YandexAdsProvider.prepareInterstitial!();

    const loadRequested = mockTrack.mock.calls.find(([name]) => name === 'ad_load_requested');
    const loaded = mockTrack.mock.calls.find(([name]) => name === 'ad_loaded');
    expect(loadRequested?.[1]).toMatchObject({
      format: 'interstitial',
      variant: 'first_session_capped',
      product_session_id: 'session-native',
      load_id: expect.any(String),
    });
    expect(loaded?.[1]).toMatchObject({
      format: 'interstitial',
      placement: 'preload',
      load_id: loadRequested?.[1].load_id,
    });

    mockTrack.mockClear();
    const onImpression = jest.fn();
    const telemetry = {
      experiment_id: 'interstitial-first-session-v1',
      variant: 'first_session_capped' as const,
      mode: 'classic' as const,
      product_session_id: 'session-native',
      session_index: 2,
      session_depth: 6,
      active_play_ms: 42_000,
      session_interstitial_shows: 1,
    };
    const result = YandexAdsProvider.showInterstitial('gameover', telemetry, onImpression);

    expect(mockTrack).toHaveBeenCalledWith(
      'ad_requested',
      expect.objectContaining({
        attempt_id: expect.any(String),
        load_id: loadRequested?.[1].load_id,
      }),
    );
    expect(mockTrack.mock.calls.some(([name]) => name === 'ad_loaded')).toBe(false);

    (interstitial.onAdImpression as () => void)();
    (interstitial.onAdImpression as () => void)();
    expect(onImpression).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      'ad_shown',
      expect.objectContaining({ load_id: loadRequested?.[1].load_id }),
    );

    (interstitial.onAdDismissed as () => void)();
    await expect(result).resolves.toBe('shown');
    expect(mockTrack).toHaveBeenCalledWith(
      'ad_dismissed',
      expect.objectContaining({ load_id: loadRequested?.[1].load_id }),
    );
  });
});

type FakeAd = Record<string, unknown> & { show: jest.Mock };
const callback = (ad: FakeAd, name: string, payload?: unknown) =>
  (ad[name] as (data?: unknown) => void)(payload);

async function readyAds() {
  const interstitial: FakeAd = { show: jest.fn(async () => {}) };
  const rewarded: FakeAd = { show: jest.fn(async () => {}) };
  mockInterstitialLoad.mockResolvedValue(interstitial);
  mockRewardedLoad.mockResolvedValue(rewarded);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { YandexAdsProvider: provider } = require('../yandexAds.native') as typeof import('../yandexAds.native');
  await provider.init();
  await Promise.all([provider.prepareInterstitial!(), provider.prepareRewarded!()]);
  return { provider, interstitial, rewarded };
}

describe('reward evidence and fullscreen arbitration', () => {
  it('delivers earned once before dismiss, records impression revenue once, and preserves reward on failure', async () => {
    const { provider, rewarded, interstitial } = await readyAds();
    const earned = jest.fn();
    const pending = provider.showRewarded('adventure_xp_bonus', earned);
    expect(provider.isRewardedReady()).toBe(false);
    await expect(provider.showInterstitial('gameover')).resolves.toBe('unavailable');
    await expect(provider.showRewarded('revive')).resolves.toBe('unavailable');
    expect(interstitial.show).not.toHaveBeenCalled();
    expect(rewarded.show).toHaveBeenCalledTimes(1);

    const impression = { rawData: JSON.stringify({ revenue: '0.35', currency: 'RUB', precision: 'estimated' }) };
    callback(rewarded, 'onAdImpression', impression);
    callback(rewarded, 'onAdImpression', impression);
    callback(rewarded, 'onRewarded');
    callback(rewarded, 'onRewarded');
    expect(earned).toHaveBeenCalledTimes(1);
    expect(mockSetJSON).toHaveBeenCalledWith('ads.meta', expect.objectContaining({ lastFullscreenAt: expect.any(Number) }));
    expect(mockTrack.mock.calls.filter(([name]) => name === 'ad_revenue')).toHaveLength(1);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    callback(rewarded, 'onAdFailedToShow', { description: 'late failure' });
    await expect(pending).resolves.toBe('rewarded');
    callback(rewarded, 'onAdDismissed');
    expect(earned).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('retries failed reward delivery on terminal callback without repeating earned analytics', async () => {
    const { provider, rewarded } = await readyAds();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const earned = jest.fn().mockImplementationOnce(() => { throw new Error('disk full'); });
    const pending = provider.showRewarded('adventure_xp_bonus', earned);
    callback(rewarded, 'onRewarded');
    expect(earned).toHaveBeenCalledTimes(1);
    callback(rewarded, 'onAdDismissed');
    await expect(pending).resolves.toBe('rewarded');
    expect(earned).toHaveBeenCalledTimes(2);
    expect(mockTrack.mock.calls.filter(([name]) => name === 'ad_rewarded')).toHaveLength(1);
    warn.mockRestore();
  });

  it('never rewards dismissal or an impression and blocks interstitials after a dismissed rewarded impression', async () => {
    const { provider, rewarded } = await readyAds();
    const earned = jest.fn();
    const pending = provider.showRewarded('revive', earned);
    callback(rewarded, 'onAdImpression');
    callback(rewarded, 'onAdDismissed');
    await expect(pending).resolves.toBe('dismissed');
    expect(earned).not.toHaveBeenCalled();
    await expect(provider.showInterstitial('gameover')).resolves.toBe('unavailable');
    expect(mockTrack).toHaveBeenCalledWith('ad_eligible', expect.objectContaining({ blocked_reason: 'rewarded_cooldown' }));
  });

  it('ignores old callbacks without unlocking the following fullscreen attempt', async () => {
    const { provider, rewarded } = await readyAds();
    const pending = provider.showRewarded('revive');
    const oldDismiss = rewarded.onAdDismissed as () => void;
    const oldEarned = rewarded.onRewarded as () => void;
    oldDismiss();
    await pending;
    await provider.prepareRewarded!();
    const next = provider.showRewarded('revive');
    oldDismiss();
    oldEarned();
    await expect(provider.showRewarded('revive')).resolves.toBe('unavailable');
    expect(mockTrack.mock.calls.filter(([name]) => name === 'ad_rewarded')).toHaveLength(0);
    callback(rewarded, 'onAdDismissed');
    await next;
  });

  it('releases the shared lock after synchronous show failure', async () => {
    const { provider, rewarded, interstitial } = await readyAds();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    rewarded.show.mockImplementationOnce(() => { throw new Error('Activity missing'); });
    await expect(provider.showRewarded('revive')).resolves.toBe('unavailable');
    const next = provider.showInterstitial('gameover');
    expect(interstitial.show).toHaveBeenCalledTimes(1);
    callback(interstitial, 'onAdDismissed');
    await next;
    warn.mockRestore();
  });

  it('protects a rewarded dismissal even when an impression callback was lost', async () => {
    const { provider, rewarded, interstitial } = await readyAds();
    const pending = provider.showRewarded('revive');
    callback(rewarded, 'onAdDismissed');
    await expect(pending).resolves.toBe('dismissed');
    await expect(provider.showInterstitial('gameover')).resolves.toBe('unavailable');
    expect(interstitial.show).not.toHaveBeenCalled();
  });
});

describe('contextual loading and readiness', () => {
  function provider() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../yandexAds.native') as typeof import('../yandexAds.native')).YandexAdsProvider;
  }

  it('initializes the SDK without requesting either format', async () => {
    const ads = provider();
    await ads.init();
    await ads.init();
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInterstitialLoad).not.toHaveBeenCalled();
    expect(mockRewardedLoad).not.toHaveBeenCalled();
  });

  it.each(['interstitial', 'rewarded'] as const)('reuses its native %s loader after load failure', async (format) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const load = format === 'interstitial' ? mockInterstitialLoad : mockRewardedLoad;
    const create = format === 'interstitial' ? mockInterstitialLoaderCreate : mockRewardedLoaderCreate;
    const ads = provider();
    const prepare = format === 'interstitial' ? ads.prepareInterstitial! : ads.prepareRewarded!;
    load.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ show: jest.fn(async () => {}) });
    await prepare();
    await prepare();
    expect(load).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('reuses its rewarded loader after consuming inventory and retries failed loader creation', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRewardedLoaderCreate.mockRejectedValueOnce(new Error('Activity missing'));
    const ad: FakeAd = { show: jest.fn(async () => {}) };
    mockRewardedLoad.mockResolvedValue(ad);
    const ads = provider();
    await ads.prepareRewarded!();
    expect(mockRewardedLoad).not.toHaveBeenCalled();
    await ads.prepareRewarded!();
    const pending = ads.showRewarded('revive');
    callback(ad, 'onAdDismissed');
    await pending;
    await ads.prepareRewarded!();
    expect(mockRewardedLoad).toHaveBeenCalledTimes(2);
    expect(mockRewardedLoaderCreate).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('prepares rewarded independently of interstitial and records actual load provenance', async () => {
    const ads = provider();
    const rewarded: FakeAd = { show: jest.fn(async () => {}) };
    mockRewardedLoad.mockResolvedValue(rewarded);
    const listener = jest.fn();
    const unsubscribe = ads.subscribeRewardedReady!(listener);
    await Promise.all([ads.prepareRewarded!(), ads.prepareRewarded!()]);
    expect(mockInterstitialLoad).not.toHaveBeenCalled();
    expect(mockRewardedLoad).toHaveBeenCalledTimes(1);
    expect(ads.isRewardedReady()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const request = mockTrack.mock.calls.find(([name]) => name === 'ad_load_requested');
    expect(mockTrack).toHaveBeenCalledWith('ad_loaded', {
      format: 'rewarded', placement: 'preload', load_id: request?.[1].load_id,
    });
    mockTrack.mockClear();
    const pending = ads.showRewarded('revive');
    expect(ads.isRewardedReady()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(mockTrack.mock.calls.some(([name]) => name === 'ad_loaded')).toBe(false);
    callback(rewarded, 'onAdImpression');
    callback(rewarded, 'onAdDismissed');
    await pending;
    expect(listener).toHaveBeenCalledTimes(3);
    expect(mockRewardedLoad).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('ad_shown', expect.objectContaining({ load_id: request?.[1].load_id }));
    unsubscribe();
    await ads.prepareRewarded!();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(ads.isRewardedReady()).toBe(true);
  });

  it('does not load after failed initialization and retries on next preparation', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockInitialize.mockRejectedValueOnce(new Error('SDK unavailable'));
    mockRewardedLoad.mockResolvedValue({ show: jest.fn(async () => {}) });
    const ads = provider();
    await ads.prepareRewarded!();
    expect(mockRewardedLoad).not.toHaveBeenCalled();
    expect(ads.isRewardedReady()).toBe(false);
    await ads.prepareRewarded!();
    expect(mockInitialize).toHaveBeenCalledTimes(2);
    expect(mockRewardedLoad).toHaveBeenCalledTimes(1);
    expect(ads.isRewardedReady()).toBe(true);
    warn.mockRestore();
  });

  it('avoids replacement loads during fullscreen and after dismissal without an active offer', async () => {
    const { provider: ads, rewarded } = await readyAds();
    const pending = ads.showRewarded('revive');
    await ads.prepareRewarded!();
    await ads.prepareInterstitial!();
    expect(mockRewardedLoad).toHaveBeenCalledTimes(1);
    expect(mockInterstitialLoad).toHaveBeenCalledTimes(1);
    callback(rewarded, 'onAdDismissed');
    await pending;
    expect(mockRewardedLoad).toHaveBeenCalledTimes(1);
    expect(mockInterstitialLoad).toHaveBeenCalledTimes(1);
  });
});
