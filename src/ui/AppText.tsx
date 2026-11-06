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
  // Full bundled Nunito faces include Cyrillic; body text matches the source HTML.
  speech: {
    ...typography.speech,
    color: colors.textPrimary,
  },
});

interface AppTextProps extends TextProps {
  preset?: Preset;
}

export function AppText({ preset = 'body', style, ...rest }: AppTextProps) {
  const resolved = StyleSheet.flatten([presets[preset], style]);
  const weight = Number(resolved.fontWeight ?? 0);
  // Select actual bundled faces instead of asking Android to synthesize a weight.
  if (resolved.fontFamily?.startsWith('Nunito_') && weight) {
    resolved.fontFamily = weight >= 900 ? 'Nunito_900Black' : weight >= 800 ? 'Nunito_800ExtraBold' : 'Nunito_700Bold';
    resolved.fontWeight = undefined;
  }
  return <Text {...rest} style={[{ includeFontPadding: false }, resolved]} />;
}
