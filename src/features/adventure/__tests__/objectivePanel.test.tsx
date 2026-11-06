import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { createAdventureRun, type AdventurePlacementEvent } from '@/core/engine';
import { useGameStore } from '@/features/game';
import { useSettings } from '@/features/settings';
import { CandyIcon } from '@/ui';

import { ObjectivePanel } from '../components/ObjectivePanel';
import { levelFor } from '../logic/levels';
import { useAdventure } from '../store';

function text(tree: ReactTestRenderer): string {
  return tree.root.findAllByType('Text' as never).map((node) => node.children.join('')).join('|');
}

function KeyedObjectivePanel() {
  const runId = useGameStore((state) => state.adventure?.runId ?? 'preview');
  return <ObjectivePanel key={runId} />;
}

function jewelEvent(total: number, delta: number): AdventurePlacementEvent {
  return {
    presentationId: `run:${total}`,
    placed: [[0, 0]],
    colorId: 1,
    clearedRows: [0],
    clearedCols: [],
    clearedCells: [[0, 0]],
    clearedColors: [1],
    scoreDelta: 10,
    score: 10,
    combo: 1,
    praise: 'good',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    adventureStatus: 'playing',
    collectedJewels: total,
    remainingJewels: Math.max(0, 2 - total),
    jewelsCollectedThisMove: delta,
    collectedJewelCells: [0],
    jewelsPlacedThisMove: 0,
  };
}

describe('ObjectivePanel presentation', () => {
  let tree: ReactTestRenderer;

  beforeEach(() => {
    useSettings.setState({ lang: 'ru' });
    useAdventure.setState({ seasonId: 1, levelIndex: 0, seasonWindow: null });
    useGameStore.setState({ adventure: null, lastAdventureEvent: null });
  });

  afterEach(() => {
    if (tree) act(() => tree.unmount());
  });

  it('keeps the score objective numeric and primary', () => {
    const run = createAdventureRun({ ...levelFor(1, 0), objective: { type: 'score', target: 128 } }, 0);
    useGameStore.setState({ adventure: run, game: { ...run.game, score: 64 } });
    act(() => { tree = create(<ObjectivePanel />); });
    expect(text(tree)).toContain('64 / 128');
    expect(tree.root.findAllByType(CandyIcon)).toHaveLength(1);
    expect(tree.root.findByProps({ accessibilityLabel: 'Очки 64/128' }).props.accessible).toBe(true);
  });

  it('aggregates pending jewels and advances only on the matching arrival', async () => {
    const level = { ...levelFor(1, 7), objective: { type: 'jewels' as const, target: 2 } };
    const initial = createAdventureRun(level, 0, undefined, 'objective-test');
    useAdventure.setState({ seasonId: 1, levelIndex: 7 });
    useGameStore.setState({ adventure: initial, game: initial.game, lastAdventureEvent: null });

    act(() => { tree = create(<ObjectivePanel />); });
    expect(text(tree)).toContain('0 / 2');
    expect(tree.root.findAllByType(CandyIcon)).toHaveLength(1);
    expect(tree.root.findByProps({ accessibilityLabel: 'Кристаллов осталось 2' }).props.accessible).toBe(true);

    const event = jewelEvent(1, 1);
    await act(async () => {
      useGameStore.setState({
        adventure: { ...initial, collectedJewels: 1 },
        lastAdventureEvent: event,
      });
      await Promise.resolve();
    });
    expect(text(tree)).toContain('0 / 2');
    expect(text(tree)).toContain('+1');

    await act(async () => {
      tree.update(
        <ObjectivePanel arrival={{ presentationId: event.presentationId, delta: 1, total: 1 }} />,
      );
      await Promise.resolve();
    });
    expect(text(tree)).toContain('1 / 2');
    expect(text(tree)).not.toContain('+1');
    expect(tree.root.findByProps({ accessibilityLabel: 'Кристаллов осталось 1' }).props.accessible).toBe(true);
  });

  it('hydrates the durable jewel total after mount and resets it for a new run', () => {
    const level = { ...levelFor(1, 7), objective: { type: 'jewels' as const, target: 2 } };
    const saved = createAdventureRun(level, 0, undefined, 'saved-run');
    const restarted = createAdventureRun(level, 1, undefined, 'restart-run');
    useAdventure.setState({ seasonId: 1, levelIndex: 7 });

    act(() => { tree = create(<KeyedObjectivePanel />); });
    expect(text(tree)).toContain('0 / 16');

    act(() => {
      useGameStore.setState({
        adventure: { ...saved, collectedJewels: 1 },
        game: saved.game,
        lastAdventureEvent: null,
      });
    });
    expect(text(tree)).toContain('1 / 2');

    act(() => {
      useGameStore.setState({ adventure: restarted, game: restarted.game, lastAdventureEvent: null });
    });
    expect(text(tree)).toContain('0 / 2');
  });

  it('deduplicates rapid collections and arrivals without regressing the counter', async () => {
    const initial = createAdventureRun({ ...levelFor(1, 7), objective: { type: 'jewels' as const, target: 2 } }, 0, undefined, 'rapid-objective');
    useAdventure.setState({ seasonId: 1, levelIndex: 7 });
    useGameStore.setState({ adventure: initial, game: initial.game, lastAdventureEvent: null });
    act(() => { tree = create(<ObjectivePanel />); });

    const first = jewelEvent(1, 1);
    const second = jewelEvent(2, 1);
    for (const event of [first, { ...first }, second]) {
      await act(async () => {
        useGameStore.setState({
          adventure: { ...initial, collectedJewels: event.collectedJewels },
          lastAdventureEvent: event,
        });
        await Promise.resolve();
      });
    }
    expect(text(tree)).toContain('0 / 2|+2');

    const arrival = { presentationId: second.presentationId, delta: 1, total: 2 };
    for (const item of [arrival, { ...arrival }]) {
      await act(async () => {
        tree.update(<ObjectivePanel arrival={item} />);
        await Promise.resolve();
      });
      expect(text(tree)).toContain('2 / 2|+1');
    }

    await act(async () => {
      tree.update(<ObjectivePanel arrival={{ presentationId: first.presentationId, delta: 1, total: 1 }} />);
      await Promise.resolve();
    });
    expect(text(tree)).toContain('2 / 2');
    expect(useGameStore.getState().adventure?.collectedJewels).toBe(2);
  });
});
