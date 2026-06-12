import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';

import type { PieceInstance } from '@/core/engine';
import type { ViewStyle } from 'react-native';
import { TrayPiece } from './TrayPiece';

interface TraySlotProps {
  piece: PieceInstance | null;
  trayIndex: number;
}

/** Одиночный слот трея с анимацией появления новой фигуры */
function TraySlot({ piece, trayIndex }: TraySlotProps) {
  const scaleIn = useSharedValue(piece ? 0 : 1);

  // При появлении новой фигуры — scale-in ~150мс
  useEffect(() => {
    if (piece) {
      scaleIn.value = 0;
      scaleIn.value = withSpring(1, { damping: 14, stiffness: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece?.shape.id, piece?.colorId]);

  const slotAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleIn.value }],
    opacity: scaleIn.value,
  }));

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44, // минимальная цель тача (спека 04)
      }}
    >
      {piece ? (
        <Animated.View style={slotAnimStyle}>
          <TrayPiece piece={piece} trayIndex={trayIndex} />
        </Animated.View>
      ) : null}
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
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 8,
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
