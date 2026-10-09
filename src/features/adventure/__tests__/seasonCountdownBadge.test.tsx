import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useSettings } from '@/features/settings';

import { SeasonCountdownBadge } from '../components/SeasonCountdownBadge';
import { useAdventure } from '../store';

jest.mock('expo-router', () => {
  const ReactModule = jest.requireActual<typeof React>('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

const WINDOW = {
  seasonId: 1,
  serverNowIso: '2026-07-06T12:00:00.000Z',
  windowStartIso: '2026-07-05T21:00:00.000Z',
  windowEndIso: '2026-07-19T21:00:00.000Z',
  durationDays: 14,
};
const NOW_MS = Date.parse(WINDOW.serverNowIso);

function renderBadge(): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<SeasonCountdownBadge autoRefresh={false} />);
  });
  return tree;
}

function badgeText(tree: ReactTestRenderer): string {
  return tree.root.findAllByType('Text' as never).map((node) => node.children.join('')).join('');
}

describe('SeasonCountdownBadge', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    useAdventure.getState().reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a neutral localized label while the calendar window is unknown', () => {
    useSettings.setState({ lang: 'ru' });
    const tree = renderBadge();
    expect(badgeText(tree)).toBe('Календарное оформление');
    act(() => tree.unmount());
  });

  it('names the changing theme instead of implying the trophy expires', () => {
    useSettings.setState({ lang: 'ru' });
    useAdventure.setState({
      seasonWindow: WINDOW,
      seasonWindowSyncedAtMs: Date.parse(WINDOW.serverNowIso),
      syncStatus: 'ready',
    });

    const tree = renderBadge();

    expect(badgeText(tree)).toMatch(/^Оформление обновится через/);
    act(() => tree.unmount());
  });

  it('localizes the neutral state in English', () => {
    useSettings.setState({ lang: 'en' });
    const tree = renderBadge();
    expect(badgeText(tree)).toBe('Calendar theme');
    act(() => tree.unmount());
  });
});
