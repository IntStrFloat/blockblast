import { StyleSheet, Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

import { colors, typography } from './theme';

type Preset = 'title' | 'score' | 'body' | 'caption' | 'button' | 'speech';

const presets: Record<Preset, TextStyle> = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  score: {
    ...typography.score,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  body: {
    ...typography.body,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textDim,
  },
  button: {
    ...typography.button,
    color: colors.textPrimary,
  },
  // System sans has complete Cyrillic coverage; do not rely on font fallback.
  speech: {
    ...typography.speech,
    color: colors.textPrimary,
  },
});

interface AppTextProps extends TextProps {
  preset?: Preset;
}

export function AppText({ preset = 'body', style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[presets[preset], style]} />;
}
