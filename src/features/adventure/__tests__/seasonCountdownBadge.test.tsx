import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useProfileStore } from '@/features/profile';

import { SeasonCountdownBadge } from '../components/SeasonCountdownBadge';
import { useAdventure } from '../store';

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
    tree = create(<SeasonCountdownBadge />);
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

  it('starts a season sync on mount when the window is missing', () => {
    const syncSeasonWindow = jest.fn().mockResolvedValue(null);
    useAdventure.setState({ syncSeasonWindow });
    useProfileStore.setState({ authToken: 'token-abc' });

    const tree = renderBadge();

    expect(syncSeasonWindow).toHaveBeenCalledWith('token-abc');
    expect(badgeText(tree)).toBe('Обновляем время');
    act(() => tree.unmount());
  });

  it('does not re-sync when the window is already known', () => {
    const syncSeasonWindow = jest.fn().mockResolvedValue(null);
    useAdventure.setState({
      syncSeasonWindow,
      seasonWindow: WINDOW,
      seasonWindowSyncedAtMs: Date.parse(WINDOW.serverNowIso),
      syncStatus: 'ready',
    });

    const tree = renderBadge();

    expect(syncSeasonWindow).not.toHaveBeenCalled();
    expect(badgeText(tree)).toMatch(/^Осталось/);
    act(() => tree.unmount());
  });

  it('shows an honest error label instead of an eternal "updating"', () => {
    const syncSeasonWindow = jest.fn().mockResolvedValue(null);
    useAdventure.setState({ syncSeasonWindow, syncStatus: 'error' });

    const tree = renderBadge();

    expect(badgeText(tree)).toBe('Не удалось обновить время');
    expect(syncSeasonWindow).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
