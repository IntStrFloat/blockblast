import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { nightCandy as n } from '../nightCandy';

export function CandyProgress({
  value,
  color = n.sun,
  height = 12,
  duration = n.motion.sheet,
  from,
}: {
  value: number;
  color?: string;
  height?: number;
  duration?: number;
  from?: number;
}) {
  const progress = useSharedValue(Math.min(1, Math.max(0, from ?? value)));
  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value)), { duration });
  }, [duration, progress, value]);
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(Math.min(1, Math.max(0, value)) * 100),
      }}
      style={{
        height,
        borderRadius: 99,
        backgroundColor: '#0B0F42',
        overflow: 'hidden',
        borderTopWidth: 2,
        borderTopColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: 99,
            backgroundColor: color,
            borderTopWidth: 2,
            borderTopColor: 'rgba(255,255,255,0.45)',
            borderBottomWidth: 3,
            borderBottomColor: 'rgba(0,0,0,0.18)',
          },
          style,
        ]}
      />
    </View>
  );
}
