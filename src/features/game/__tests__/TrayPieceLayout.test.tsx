import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import type { SharedValue } from 'react-native-reanimated';

import { SHAPES_BY_ID } from '@/core/engine';

import { TrayPiece } from '../components/TrayPiece';
import { DragProvider, type DragCtx } from '../drag/DragContext';

const mockUseDrag = jest.fn<{ gesture: object; animatedStyle: object }, [unknown]>(
  () => ({ gesture: {}, animatedStyle: {} }),
);
jest.mock('../drag/useDrag', () => ({ useDrag: (options: unknown) => mockUseDrag(options) }));
jest.mock('../animation/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../store', () => ({
  useGameStore: (select: (state: { game: { board: number[] } }) => unknown) =>
    select({ game: { board: new Array(64).fill(0) } }),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

const shared = <T,>(value: T) => ({ value }) as SharedValue<T>;
jest.mock('../animation/useHintPulse', () => ({ useHintPulse: () => ({ value: 1 }) }));

describe('tray artwork and touch bounds', () => {
  function mount() {
    const ctx = {
      geom: { boardSize: 358, cell: 43, gap: 2, pad: 0 },
      trayFit: { slotWidth: 125, slotHeight: 112 },
      boardMirror: shared(new Array(64).fill(0)),
      measureBoard: jest.fn(),
      cellColors: ['#FFFFFF'],
    } as unknown as DragCtx;
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <DragProvider value={ctx}>
          <TrayPiece piece={{ shape: SHAPES_BY_ID.get('v5')!, colorId: 1 }} trayIndex={2} />
        </DragProvider>,
      );
    });
    return tree;
  }

  it('centers artwork in the measured slot independently of the extended touch region', () => {
    const tree = mount();
    const measuredSlot = tree.root.find((node) =>
      node.props.collapsable === false && typeof node.props.onLayout === 'function',
    );
    const slotStyle = StyleSheet.flatten(measuredSlot.props.style);
    expect(slotStyle).toMatchObject({ top: 0, bottom: 0, justifyContent: 'center' });
    const touchRegion = measuredSlot.findByProps({ testID: 'tray-hit-2' });
    expect(StyleSheet.flatten(touchRegion.props.style).bottom).toBe(-24);
    expect(touchRegion.props.children).toBeUndefined();
    const artwork = measuredSlot.find((node) => node.props.pointerEvents === 'none');
    expect(StyleSheet.flatten(artwork.props.style)).toMatchObject({
      width: 43,
      height: 223,
      flexShrink: 0,
    });
  });

  it('fits all five cells inside the shell with two dp clearance on each edge', () => {
    mount();
    const options = mockUseDrag.mock.calls.at(-1)![0] as { restingScale: number };
    const figureHeight = 5 * 43 + 4 * 2;
    const renderedHeight = figureHeight * options.restingScale;
    const artworkTop = (112 - renderedHeight) / 2;
    const artworkBottom = artworkTop + renderedHeight;
    expect(artworkTop).toBeGreaterThanOrEqual(8 + 2);
    expect(artworkBottom).toBeLessThanOrEqual(112 - 8 - 2);
  });
});
