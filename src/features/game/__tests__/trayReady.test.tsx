import React from 'react';
import { act, create } from 'react-test-renderer';

import { SHAPES_BY_ID, type PieceInstance } from '@/core/engine';

import { TrayView } from '../components/TrayView';

jest.mock('../components/TrayPiece', () => ({
  TrayPiece: ({
    trayIndex,
    readyToken,
    onInteractiveReady,
  }: {
    trayIndex: number;
    readyToken?: string | null;
    onInteractiveReady?: (trayIndex: number, token: string) => void;
  }) => {
    const ReactModule = jest.requireActual<typeof React>('react');
    ReactModule.useEffect(() => {
      if (readyToken) onInteractiveReady?.(trayIndex, readyToken);
    }, [onInteractiveReady, readyToken, trayIndex]);
    return null;
  },
}));

const dot = SHAPES_BY_ID.get('dot')!;
const piece = (): PieceInstance => ({ shape: dot, colorId: 1 });

describe('TrayView native-ready aggregation', () => {
  it('emits one token only after every committed piece reports ready', () => {
    const onReady = jest.fn();
    act(() => {
      create(
        <TrayView
          tray={[piece(), piece(), piece()]}
          readyToken="refill-1"
          onInteractiveReady={onReady}
        />,
      );
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith('refill-1');
  });
});
