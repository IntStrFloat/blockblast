import { StyleSheet, Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

import { colors } from './theme';

type Preset = 'title' | 'score' | 'body' | 'caption' | 'button' | 'speech';

const presets: Record<Preset, TextStyle> = StyleSheet.create({
  title: {
    fontFamily: 'Unbounded_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  score: {
    fontFamily: 'Unbounded_800ExtraBold',
    fontSize: 40,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 13,
    color: colors.textDim,
  },
  button: {
    fontFamily: 'Unbounded_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Голос Капи: округлый Fredoka, отделяет реплику персонажа от системного UI (спека 09).
  speech: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    color: colors.textPrimary,
  },
});

interface AppTextProps extends TextProps {
  preset?: Preset;
}

export function AppText({ preset = 'body', style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[presets[preset], style]} />;
}
