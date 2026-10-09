import {
  EMPTY_ADS_META,
  recordFullscreenCooldown,
  recordAdventureFail,
  recordAdventureLevelWin,
  recordGameOver,
  recordInterstitialShown,
  interstitialShowsForSession,
  shouldShowInterstitial,
} from '../frequency';
import { MONETIZATION } from '../config';

const CFG = { minGamesBeforeFirst: 3, minIntervalSec: 0, everyNGameovers: 3 };
const NOW = 1_000_000_000;

function opts(over: Partial<Parameters<typeof shouldShowInterstitial>[1]> = {}) {
  return { enabled: true, removeAds: false, nowMs: NOW, cfg: CFG, ...over };
}

describe('shouldShowInterstitial', () => {
  it('production config delays the first ad to the 6th game, then every fourth loss', () => {
    expect(MONETIZATION.interstitial).toEqual({
      minGamesBeforeFirst: 6,
      minIntervalSec: 180,
      everyNGameovers: 4,
    });
  });

  it('первая межстраничка не показывается новичку до 6-й партии', () => {
    const cfg = MONETIZATION.interstitial;
    // 5 партий сыграно, серия проигрышей достаточная — всё равно рано.
    const early = { ...EMPTY_ADS_META, gamesPlayed: 5, gameOversSinceAd: 5 };
    expect(shouldShowInterstitial(early, opts({ cfg }))).toBe(false);
    // 6-я партия — первый показ разрешён.
    const ready = { ...EMPTY_ADS_META, gamesPlayed: 6, gameOversSinceAd: 6 };
    expect(shouldShowInterstitial(ready, opts({ cfg }))).toBe(true);
  });

  it('после первой рекламы каденс — каждые 4 проигрыша', () => {
    const cfg = MONETIZATION.interstitial;
    const base = {
      ...EMPTY_ADS_META,
      gamesPlayed: 12,
      gameOversSinceAd: 3,
      lastInterstitialAt: NOW - 10 * 60_000,
    };
    expect(shouldShowInterstitial(base, opts({ cfg }))).toBe(false);
    expect(
      shouldShowInterstitial({ ...base, gameOversSinceAd: 4 }, opts({ cfg })),
    ).toBe(true);
  });

  it('выключено или куплен remove_ads → никогда', () => {
    const meta = { ...EMPTY_ADS_META, gamesPlayed: 10, gameOversSinceAd: 5 };
    expect(shouldShowInterstitial(meta, opts({ enabled: false }))).toBe(false);
    expect(shouldShowInterstitial(meta, opts({ removeAds: true }))).toBe(false);
  });

  it('показывает первую рекламу ровно после третьего проигрыша', () => {
    const meta = { ...EMPTY_ADS_META, gamesPlayed: 2, gameOversSinceAd: 2 };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    expect(
      shouldShowInterstitial({ ...meta, gamesPlayed: 3, gameOversSinceAd: 3 }, opts()),
    ).toBe(true);
  });

  it('сохраняет старый порог сыгранных партий для обычного Game Over', () => {
    const meta = { ...EMPTY_ADS_META, gamesPlayed: 2, gameOversSinceAd: 3 };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
  });

  it('показывает следующую рекламу после ещё трёх проигрышей', () => {
    const meta = {
      ...EMPTY_ADS_META,
      gamesPlayed: 5,
      gameOversSinceAd: 2,
      lastInterstitialAt: NOW - 1,
    };
    expect(shouldShowInterstitial(meta, opts())).toBe(false);
    expect(
      shouldShowInterstitial({ ...meta, gamesPlayed: 6, gameOversSinceAd: 3 }, opts()),
    ).toBe(true);
  });

  it('соблюдает интервал, когда он включён конфигурацией', () => {
    const intervalCfg = { ...CFG, minIntervalSec: 120 };
    const meta = {
      ...EMPTY_ADS_META,
      gamesPlayed: 5,
      gameOversSinceAd: 3,
      lastInterstitialAt: NOW - 60_000,
    };
    expect(shouldShowInterstitial(meta, opts({ cfg: intervalCfg }))).toBe(false);
    const longAgo = { ...meta, lastInterstitialAt: NOW - 121_000 };
    expect(shouldShowInterstitial(longAgo, opts({ cfg: intervalCfg }))).toBe(true);
  });

  it('использует rewarded fullscreen cooldown, не подменяя факт межстранички', () => {
    const intervalCfg = { ...CFG, minGamesBeforeFirst: 0, minIntervalSec: 120 };
    const meta = {
      ...EMPTY_ADS_META,
      gameOversSinceAd: 3,
      lastInterstitialAt: null,
      lastFullscreenAt: NOW - 60_000,
    };
    expect(shouldShowInterstitial(meta, opts({ cfg: intervalCfg }))).toBe(false);
    expect(recordFullscreenCooldown(meta, NOW).lastInterstitialAt).toBeNull();
  });

  it('показывает рекламу после каждого третьего проигрыша в Adventure', () => {
    const one = recordAdventureFail(EMPTY_ADS_META);
    const two = recordAdventureFail(one);
    const three = recordAdventureFail(two);

    expect(shouldShowInterstitial(two, opts(), 'adventure_fail')).toBe(false);
    expect(shouldShowInterstitial(three, opts(), 'adventure_fail')).toBe(true);

    const afterAd = recordInterstitialShown(three, NOW, 'adventure_fail');
    expect(afterAd.adventureFailsSinceAd).toBe(0);
    expect(shouldShowInterstitial(afterAd, opts(), 'adventure_fail')).toBe(false);
  });

  it('держит первую Adventure Fail межстраничку за общим global shield до 6 завершений', () => {
    const cfg = MONETIZATION.interstitial;
    const early = {
      ...EMPTY_ADS_META,
      adventureRunsPlayed: 5,
      adventureFailsSinceAd: 5,
    };
    expect(shouldShowInterstitial(early, opts({ cfg }), 'adventure_fail')).toBe(false);

    const ready = {
      ...EMPTY_ADS_META,
      adventureRunsPlayed: 6,
      adventureFailsSinceAd: 6,
    };
    expect(shouldShowInterstitial(ready, opts({ cfg }), 'adventure_fail')).toBe(true);
  });

  it('показывает рекламу после каждого третьего пройденного Adventure уровня', () => {
    const one = recordAdventureLevelWin(EMPTY_ADS_META);
    const two = recordAdventureLevelWin(one);
    const three = recordAdventureLevelWin(two);

    expect(shouldShowInterstitial(two, opts(), 'adventure_level')).toBe(false);
    expect(shouldShowInterstitial(three, opts(), 'adventure_level')).toBe(true);

    const afterAd = recordInterstitialShown(three, NOW, 'adventure_level');
    expect(afterAd.adventureLevelsSinceAd).toBe(0);
    expect(shouldShowInterstitial(afterAd, opts(), 'adventure_level')).toBe(false);
  });

  it('держит первую Adventure Win межстраничку за общим global shield до 6 завершений', () => {
    const cfg = MONETIZATION.interstitial;
    const early = {
      ...EMPTY_ADS_META,
      adventureRunsPlayed: 5,
      adventureLevelsCompleted: 5,
      adventureLevelsSinceAd: 5,
    };
    expect(shouldShowInterstitial(early, opts({ cfg }), 'adventure_level')).toBe(false);

    const ready = {
      ...EMPTY_ADS_META,
      adventureRunsPlayed: 6,
      adventureLevelsCompleted: 6,
      adventureLevelsSinceAd: 6,
    };
    expect(shouldShowInterstitial(ready, opts({ cfg }), 'adventure_level')).toBe(true);
  });

  it('сохраняет every-N каденс для Adventure после первого показа', () => {
    const meta = {
      ...EMPTY_ADS_META,
      adventureRunsPlayed: 1,
      adventureFailsSinceAd: 3,
      lastInterstitialAt: NOW - 10 * 60_000,
    };
    expect(shouldShowInterstitial(meta, opts(), 'adventure_fail')).toBe(true);
  });
});

describe('счётчики', () => {
  it.each(['gameover', 'adventure_fail', 'adventure_level'] as const)(
    'resets all modes after an impression at %s so switching modes cannot spend an old series',
    (placement) => {
      const before = { ...EMPTY_ADS_META, gamesPlayed: 20, gameOversSinceAd: 8,
        adventureFailsSinceAd: 7, adventureLevelsSinceAd: 6 };
      const shown = recordInterstitialShown(before, NOW, placement);
      for (const counter of ['gameover', 'adventure_fail', 'adventure_level'] as const) {
        expect(shouldShowInterstitial(shown, opts({ nowMs: NOW + 600_000,
          cfg: MONETIZATION.interstitial }), counter)).toBe(false);
      }
      expect(shown).toMatchObject({ gamesPlayed: 20, gameOversSinceAd: 0,
        adventureFailsSinceAd: 0, adventureLevelsSinceAd: 0 });
    },
  );

  it('enforces the same three-minute cooldown at the exact boundary after rewarded', () => {
    const meta = recordFullscreenCooldown({ ...EMPTY_ADS_META, gamesPlayed: 10,
      gameOversSinceAd: 4 }, NOW);
    expect(shouldShowInterstitial(meta, opts({ cfg: MONETIZATION.interstitial,
      nowMs: NOW + 179_999 }))).toBe(false);
    expect(shouldShowInterstitial(meta, opts({ cfg: MONETIZATION.interstitial,
      nowMs: NOW + 180_000 }))).toBe(true);
  });
  it('recordGameOver инкрементит', () => {
    const m = recordGameOver(recordGameOver(EMPTY_ADS_META));
    expect(m.gamesPlayed).toBe(2);
    expect(m.gameOversSinceAd).toBe(2);
  });

  it('recordInterstitialShown сбрасывает серию и пишет время', () => {
    const m = recordInterstitialShown(recordGameOver(EMPTY_ADS_META), NOW);
    expect(m.gameOversSinceAd).toBe(0);
    expect(m.lastInterstitialAt).toBe(NOW);
    expect(m.gamesPlayed).toBe(1);
  });

  it('counts interstitials per product session without counting rewarded fullscreen anchors', () => {
    const first = recordInterstitialShown(EMPTY_ADS_META, NOW, 'gameover', 'session-1');
    const second = recordInterstitialShown(first, NOW + 1, 'gameover', 'session-1');
    const rewarded = recordFullscreenCooldown(second, NOW + 2);
    expect(interstitialShowsForSession(rewarded, 'session-1')).toBe(2);
    expect(interstitialShowsForSession(rewarded, 'session-2')).toBe(0);
    const coldStart = recordInterstitialShown(rewarded, NOW + 3, 'gameover', 'session-2');
    expect(interstitialShowsForSession(coldStart, 'session-2')).toBe(1);
  });
});
