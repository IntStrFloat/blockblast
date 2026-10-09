import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import { useEntitlements } from '../entitlements';
import { GAME_BANNER_RESERVED_HEIGHT, GameBannerDock } from '../game-banner-dock';

describe('game banner dock', () => {
  beforeEach(() => {
    useEntitlements.setState({ removeAds: false });
  });

  it('does not shrink and keeps the adaptive banner at the bottom', () => {
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<GameBannerDock ftueComplete gamesPlayed={2} />);
    });

    const dock = renderer!.root.findByProps({ testID: 'game-banner-dock' });
    const style = StyleSheet.flatten(dock.props.style);

    expect(style.width).toBe('100%');
    expect(style.minHeight).toBe(GAME_BANNER_RESERVED_HEIGHT);
    expect(style.flexShrink).toBe(0);
    expect(style.alignItems).toBe('center');
    expect(style.justifyContent).toBe('flex-end');

    act(() => renderer!.unmount());
  });

  it('does not reserve the banner slot during FTUE or after ads are removed', () => {
    let renderer: ReturnType<typeof create> | null = null;
    act(() => {
      renderer = create(<GameBannerDock ftueComplete={false} gamesPlayed={0} />);
    });

    let dock = renderer!.root.findByProps({ testID: 'game-banner-dock' });
    expect(StyleSheet.flatten(dock.props.style).minHeight).toBe(0);

    act(() => {
      useEntitlements.setState({ removeAds: true });
      renderer!.update(<GameBannerDock ftueComplete gamesPlayed={2} />);
    });

    dock = renderer!.root.findByProps({ testID: 'game-banner-dock' });
    expect(StyleSheet.flatten(dock.props.style).minHeight).toBe(0);

    act(() => renderer!.unmount());
  });
});
