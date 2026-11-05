import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AdBanner } from '../AdBanner';
import { useEntitlements } from '../entitlements';
import { GAME_BANNER_RESERVED_HEIGHT, GameBannerDock } from '../game-banner-dock';
import { shouldShowGameBanner } from '../policy';
import { useGameBannerEligibility } from '../useGameBannerEligibility';

function Game({ runId, gamesPlayed, ftueComplete }: {
  runId: string; gamesPlayed: number; ftueComplete: boolean;
}) {
  const eligibility = useGameBannerEligibility(runId, gamesPlayed, ftueComplete);
  return <GameBannerDock {...eligibility} />;
}

describe('banner eligibility across classic replays', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => useEntitlements.setState({ removeAds: false }));
  afterEach(() => act(() => tree.unmount()));

  function eligible() {
    const props = tree.root.findByType(AdBanner).props;
    return shouldShowGameBanner({ ftueComplete: props.ftueComplete, gamesPlayed: props.gamesPlayed });
  }
  function reservedHeight() {
    return StyleSheet.flatten(tree.root.findByProps({ testID: 'game-banner-dock' }).props.style).minHeight;
  }

  it('enables the banner on the third run without leaving the game screen', () => {
    act(() => { tree = create(<Game runId="one" gamesPlayed={0} ftueComplete />); });
    expect(eligible()).toBe(false);
    act(() => tree.update(<Game runId="two" gamesPlayed={1} ftueComplete />));
    expect(eligible()).toBe(false);
    // Settlement and rewarded revive keep the same run id and board layout.
    act(() => tree.update(<Game runId="two" gamesPlayed={2} ftueComplete />));
    expect(eligible()).toBe(false);
    act(() => tree.update(<Game runId="three" gamesPlayed={2} ftueComplete />));
    expect(eligible()).toBe(true);
    expect(reservedHeight()).toBe(GAME_BANNER_RESERVED_HEIGHT);
  });

  it('defers FTUE completion layout changes until the next run', () => {
    act(() => { tree = create(<Game runId="tutorial" gamesPlayed={2} ftueComplete={false} />); });
    expect(reservedHeight()).toBe(0);
    act(() => tree.update(<Game runId="tutorial" gamesPlayed={2} ftueComplete />));
    expect(reservedHeight()).toBe(0);
    expect(eligible()).toBe(false);
    act(() => tree.update(<Game runId="classic" gamesPlayed={2} ftueComplete />));
    expect(reservedHeight()).toBe(GAME_BANNER_RESERVED_HEIGHT);
    expect(eligible()).toBe(true);
  });

  it('applies an already eligible returning player immediately', () => {
    act(() => { tree = create(<Game runId="resumed" gamesPlayed={8} ftueComplete />); });
    expect(eligible()).toBe(true);
  });
});
