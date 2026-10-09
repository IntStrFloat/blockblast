import React from 'react';
import { act, create } from 'react-test-renderer';

import LeaderboardScreen from '../leaderboard';

const mockRefresh = jest.fn(() => Promise.resolve());
const mockSyncOutcomes = jest.fn();
const mockClaim = jest.fn();
let mockState: Record<string, unknown>;
let mockEntries: object[] = [];
let mockPrize: object | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useFocusEffect: () => {} }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/features/analytics', () => ({ recordNextGoalClick: jest.fn(), useAnalyticsStore: { getState: () => ({ track: jest.fn() }) } }));
jest.mock('@/features/progression/components/RewardVisual', () => ({ RewardVisual: () => null }));
jest.mock('@/features/leaderboard', () => ({
  LeaderboardRow: () => null, Podium: () => null,
  getUtcWeekCountdown: () => ({ days: 1, hours: 0, minutes: 0 }),
  getWeeklyGoal: () => ({ current: 0, target: 1500, progress: 0, remaining: 1500, complete: false }),
  currentWeeklyGoal: () => ({ goalId: 'goal', target: 1500, progress: 0 }),
  useWeeklyGoalWeekKey: () => '2026-W38',
  useWeeklyGoalStore: Object.assign(() => ({}), { getState: () => ({ sync: jest.fn(), expose: jest.fn() }) }),
  resolveWeeklyView: () => ({ effectiveBest: 0, rank: null, currentEntry: null, entries: mockEntries }),
  selectPreviousWeeklyBest: () => 0, selectMyChampionRank: () => null,
  unclaimedPrize: () => mockPrize,
  weeklyStatusLabel: () => 'Без подключения',
  useLeaderboardStore: Object.assign((select: (state: typeof mockState) => unknown) => select(mockState), {
    getState: () => ({ refresh: mockRefresh, syncWeeklyOutcomes: mockSyncOutcomes, claimWeeklyPrize: mockClaim }),
  }),
}));
jest.mock('expo-linear-gradient', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return { LinearGradient: ({ children }: { children?: React.ReactNode }) => ReactLocal.createElement('gradient', {}, children) };
});
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  return Object.create(RN, {
    FlatList: { value: ({ ListHeaderComponent, ListFooterComponent }: { ListHeaderComponent?: React.ReactNode; ListFooterComponent?: React.ReactNode }) => ReactLocal.createElement('list', {}, ListHeaderComponent, ListFooterComponent) },
  });
});
jest.mock('@/ui', () => {
  const ReactLocal = jest.requireActual<typeof import('react')>('react');
  const component = (name: string) => ({ children, ...props }: { children?: React.ReactNode }) => ReactLocal.createElement(name, props, children);
  return { AppText: component('app-text'), CheckIcon: component('check-icon'), ChevronIcon: component('icon'), CrownIcon: component('icon'), TrophyIcon: component('icon'), spacing: { m: 16, s: 8, l: 24 } };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEntries = [];
  mockPrize = null;
  mockState = { snapshot: null, viewState: 'error', lastError: 'network', localWeeklyResult: null, weeklyPrizes: [], weeklyOutcomes: [], prizeSyncState: 'idle', prizeLastError: null, claimingRewardId: null, overtaken: null };
});

function visibleText(renderer: ReturnType<typeof create>): string[] {
  return renderer.root.findAll((node) => String(node.type) === 'app-text').map((node) => node.children.filter((child) => typeof child === 'string').join(''));
}

describe('leaderboard status presentation', () => {
  it('shows one offline/error status and retries both sources without a duplicate footer', async () => {
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<LeaderboardScreen />); });
    const text = visibleText(renderer!);
    expect(text).toContain('Рейтинг');
    expect(text).not.toContain('Без подключения');
    expect(text).not.toContain('Подводим итог прошлой недели…');
    expect(text.filter((value) => value.includes('не удалось'))).toHaveLength(1);
    expect(text.filter((value) => value === 'Повторить')).toHaveLength(1);
    const retry = renderer!.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Повторить')[0];
    await act(async () => { retry.props.onPress(); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockSyncOutcomes).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
  });

  it('shows only table loading on a fresh request without inventing a prior-week result', () => {
    mockState.viewState = 'loading'; mockState.lastError = null; mockState.prizeSyncState = 'loading';
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<LeaderboardScreen />); });
    const text = visibleText(renderer!);
    expect(text).toContain('Обновляем рейтинг...');
    expect(text).not.toContain('Без подключения');
    expect(text).not.toContain('Подводим итог прошлой недели…');
    act(() => renderer!.unmount());
  });

  it('retains the actionable claim error when a real reward and ranking are loaded', () => {
    mockEntries = [{ rank: 1 }];
    mockPrize = { rewardId: 'reward', rank: 1, prize: { points: 1200, cosmeticId: 'hat-block-crown' } };
    mockState.viewState = 'ready'; mockState.lastError = null; mockState.prizeSyncState = 'error';
    let renderer: ReturnType<typeof create>;
    act(() => { renderer = create(<LeaderboardScreen />); });
    expect(visibleText(renderer!)).toContain('Не удалось проверить или получить награду');
    const retry = renderer!.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Повторить')[0];
    act(() => { retry.props.onPress(); });
    expect(mockClaim).toHaveBeenCalledWith('reward');
    expect(mockRefresh).not.toHaveBeenCalled();
    act(() => renderer!.unmount());
  });
});
