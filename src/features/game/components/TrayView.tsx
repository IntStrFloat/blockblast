import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import type React from 'react';

import type { PieceInstance } from '@/core/engine';
import type { ViewStyle } from 'react-native';
import { TrayPiece } from './TrayPiece';

interface TraySlotProps {
  piece: PieceInstance | null;
  trayIndex: number;
  renderPieceCellOverlay?: (slot: number, cellIndex: number, cellSizePx: number) => React.ReactNode;
  readyToken?: string | null;
  onSlotInteractiveReady?: (trayIndex: number, token: string) => void;
}

/** Одиночный слот трея с анимацией появления новой фигуры */
function TraySlot({
  piece,
  trayIndex,
  renderPieceCellOverlay,
  readyToken,
  onSlotInteractiveReady,
}: TraySlotProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        height: '100%',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {piece ? (
        <TrayPiece
          piece={piece}
          trayIndex={trayIndex}
          readyToken={readyToken}
          onInteractiveReady={onSlotInteractiveReady}
          renderCellOverlay={(cellIndex, size) =>
            renderPieceCellOverlay?.(trayIndex, cellIndex, size)
          }
        />
      ) : null}
    </View>
  );
}

interface TrayViewProps {
  tray: (PieceInstance | null)[];
  style?: ViewStyle;
  renderPieceCellOverlay?: (slot: number, cellIndex: number, cellSizePx: number) => React.ReactNode;
  readyToken?: string | null;
  onInteractiveReady?: (token: string) => void;
}

export function TrayView({
  tray,
  style,
  renderPieceCellOverlay,
  readyToken = null,
  onInteractiveReady,
}: TrayViewProps) {
  const readyRef = useRef<{ token: string | null; slots: Set<number> }>({
    token: null,
    slots: new Set(),
  });
  const requiredSlots = tray.reduce((count, piece) => count + (piece ? 1 : 0), 0);
  const handleSlotReady = useCallback((trayIndex: number, token: string) => {
    if (readyRef.current.token !== token) {
      readyRef.current = { token, slots: new Set() };
    }
    readyRef.current.slots.add(trayIndex);
    if (requiredSlots > 0 && readyRef.current.slots.size >= requiredSlots) {
      onInteractiveReady?.(token);
    }
  }, [onInteractiveReady, requiredSlots]);
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'space-around',
          paddingHorizontal: 8,
          overflow: 'visible',
        },
        style,
      ]}
    >
      {tray.map((piece, index) => (
        <TraySlot
          key={index}
          piece={piece}
          trayIndex={index}
          readyToken={readyToken}
          onSlotInteractiveReady={handleSlotReady}
          renderPieceCellOverlay={renderPieceCellOverlay}
        />
      ))}
    </View>
  );
}
