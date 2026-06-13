import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from '@/ui';

import type { EmoteId } from '../logic/types';

/** Символ эмоции по id; none → нет символа. */
const SYMBOL: Record<EmoteId, string | null> = {
  none: null,
  heart: '❤️',
  sparkle: '✨',
  sleep: '💤',
  sweat: '💧',
  note: '🎵',
  think: '💭',
  excl: '❗',
  fire: '🔥',
};

interface EmoteProps {
  id: EmoteId;
  size?: number;
}

/**
 * Маленький пузырь-эмоция над маскотом. Родитель управляет монтированием:
 * появляется (FadeIn) при mount, исчезает (FadeOut) при unmount.
 */
export function Emote({ id, size = 22 }: EmoteProps) {
  const symbol = SYMBOL[id];
  if (!symbol) return null;

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      pointerEvents="none"
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <AppText style={{ fontSize: Math.round(size * 0.6) }}>{symbol}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
