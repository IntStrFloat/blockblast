import { View } from 'react-native';

import { AppText } from '../AppText';
import { colors, spacing } from '../theme';

export function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: spacing.s, borderRadius: 14, backgroundColor: colors.surface }}>
      <AppText preset="button" style={{ fontSize: 16 }}>{value}</AppText>
      <AppText preset="caption">{label}</AppText>
    </View>
  );
}
