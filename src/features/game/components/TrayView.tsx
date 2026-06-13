import { View } from 'react-native';

import type { PieceInstance } from '@/core/engine';
import type { ViewStyle } from 'react-native';
import { TrayPiece } from './TrayPiece';

interface TraySlotProps {
  piece: PieceInstance | null;
  trayIndex: number;
}

/** Одиночный слот трея с анимацией появления новой фигуры */
function TraySlot({ piece, trayIndex }: TraySlotProps) {
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
      {piece ? <TrayPiece piece={piece} trayIndex={trayIndex} /> : null}
    </View>
  );
}

interface TrayViewProps {
  tray: (PieceInstance | null)[];
  style?: ViewStyle;
}

export function TrayView({ tray, style }: TrayViewProps) {
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
        <TraySlot key={index} piece={piece} trayIndex={index} />
      ))}
    </View>
  );
}
