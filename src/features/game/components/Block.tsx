import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

interface BlockProps {
  size: number;
  color: string;
  style?: AnimatedStyle<ViewStyle>;
}

/** Candy anatomy from the reference: 22% radius, 7% light, 11% edge, 28×12% glint. */
export const Block = memo(function Block({ size, color, style }: BlockProps) {
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          backgroundColor: color,
          boxShadow: '0px 2px 0px rgba(5,8,40,0.35)',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <BlockShine size={size} />
    </Animated.View>
  );
});

/** Shared by tray, board, landing and clear covers so a handoff never changes the art. */
export const BlockShine = memo(function BlockShine(_props: { size?: number }) {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '7%',
          minHeight: 2,
          backgroundColor: 'rgba(255,255,255,0.50)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '11%',
          minHeight: 2,
          backgroundColor: 'rgba(30,10,70,0.30)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: '17%',
          top: '17%',
          width: '28%',
          height: '12%',
          borderRadius: 99,
          backgroundColor: 'rgba(255,255,255,0.6)',
        }}
      />
    </>
  );
});
