import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { LevelResultView } from '../components/LevelResultView';

const mockReveal = jest.fn();
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@/features/settings', () => ({ useLang: () => 'ru' }));
jest.mock('@/features/game/animation/useReducedMotion', () => ({ useReducedMotion: () => false }));
jest.mock('@/features/game', () => ({ Confetti: 'Confetti' }));
jest.mock('@/features/mascot', () => ({ LevelUpReveal: 'LevelUpReveal' }));
jest.mock('@/features/progression', () => ({
  progressFor: jest.requireActual('@/features/progression/logic/levels').progressFor,
  rewardReceiptKey: () => 'xp',
  useProgression: Object.assign((select: (s: object) => unknown) => select({ lifetimePoints: 500, rewardReceipts: { xp: { grantedAmount: 500 } } }), {
    getState: () => ({ presentRevealForRun: mockReveal }),
  }),
}));
jest.mock('../store', () => ({ useAdventure: (select: (s: object) => unknown) => select({ seasonId: 1, levelIndex: 1, consecutive: 1 }) }));
jest.mock('../components/ChapterPicture', () => ({ ChapterPicture: 'ChapterPicture' }));
jest.mock('@/features/game/effects/Confetti', () => ({ Confetti: 'Confetti' }));
jest.mock('../components/SeasonCelebration', () => ({ SeasonCelebration: 'SeasonCelebration' }));
jest.mock('../components/AdventureXpBonus', () => ({ AdventureXpBonus: 'AdventureXpBonus' }));
jest.mock('../components/LevelResultTransition', () => ({ LevelResultTransition: 'LevelResultTransition' }));
jest.mock('@/ui', () => ({ ...jest.requireActual('@/ui/nightCandy'), CandyBackground: 'CandyBackground', CandyCapy: 'CandyCapy', CandyProgress: 'CandyProgress', CandyIcon: 'CandyIcon', AppText: 'AppText', ChevronIcon: 'ChevronIcon', FireIcon: 'FireIcon', GameButton: 'GameButton', TrophyIcon: 'TrophyIcon' }));

describe('Adventure result optional work', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => { mockReveal.mockClear(); });
  afterEach(() => { act(() => tree.unmount()); });
  const nodes = (name: string) => tree.root.findAllByType(name as React.ElementType);

  it('shows the result immediately and starts reward, confetti and last mosaic tile after entrance', () => {
    const ready = jest.fn();
    act(() => { tree = create(<LevelResultView completedLevel={1} completionId="level-1" runId="run-1" onNext={jest.fn()} onExit={jest.fn()} onPresentationReady={ready} />); });
    expect(nodes('CandyProgress')).toHaveLength(1);
    expect(nodes('GameButton')).toHaveLength(2);
    expect(nodes('AdventureXpBonus')).toHaveLength(0);
    expect(nodes('Confetti')).toHaveLength(0);
    expect(nodes('LevelUpReveal')).toHaveLength(0);
    expect(nodes('ChapterPicture')[0].props.reveal).toBe(false);
    expect(mockReveal).not.toHaveBeenCalled();
    act(() => { nodes('LevelResultTransition')[0].props.onReady(); });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(nodes('ChapterPicture')[0].props).toMatchObject({ parts: 1, reveal: true });
    expect(nodes('AdventureXpBonus')).toHaveLength(1);
    expect(nodes('Confetti')).toHaveLength(0);
    expect(nodes('LevelUpReveal')).toHaveLength(1);
    expect(mockReveal).toHaveBeenCalledWith('run-1');
  });

  it('also defers optional celebration work for the final level of a season', () => {
    act(() => { tree = create(<LevelResultView completedLevel={96} completionId="season-1" runId="run-96" completedSeason={1} onNext={jest.fn()} onExit={jest.fn()} />); });
    expect(nodes('ChapterPicture')[0].props).toMatchObject({ parts: 12, reveal: false });
    expect(nodes('Confetti')).toHaveLength(0);
    expect(nodes('LevelUpReveal')).toHaveLength(0);
    act(() => { nodes('LevelResultTransition')[0].props.onReady(); });
    expect(nodes('ChapterPicture')[0].props).toMatchObject({ parts: 12, reveal: true });
    expect(nodes('Confetti')).toHaveLength(1);
    expect(nodes('LevelUpReveal')).toHaveLength(1);
  });
});
