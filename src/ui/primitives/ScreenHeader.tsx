import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '../AppText';
import { ChevronIcon } from '../icons/ChevronIcon';
import { colors, spacing } from '../theme';
import { IconButton } from './IconButton';

export function ScreenHeader({
  title,
  onBack,
  right,
  backLabel = 'Back',
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  backLabel?: string;
}) {
  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.m }}>
      {onBack ? (
        <IconButton onPress={onBack} accessibilityLabel={backLabel} size={48}>
          <ChevronIcon direction="left" />
        </IconButton>
      ) : <View style={{ width: 48 }} />}
      <AppText preset="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ flex: 1, fontSize: 21 }}>
        {title}
      </AppText>
      {right ?? <View style={{ width: 48 }} />}
    </View>
  );
}

export function ProgressChip({ label, value, color = colors.accent }: { label: string; value: string; color?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <AppText preset="caption" style={{ color: colors.textPrimary }}>{label}</AppText>
      <AppText preset="button" style={{ fontSize: 12, color }}>{value}</AppText>
    </View>
  );
}

export function RewardPreview({ label, detail }: { label: string; detail: string }) {
  return (
    <View style={{ padding: spacing.s, borderRadius: 14, backgroundColor: '#4A3B1A', borderWidth: 1, borderColor: 'rgba(255,210,63,0.36)' }}>
      <AppText preset="caption" style={{ color: '#FFE08A' }}>{label}</AppText>
      <AppText preset="button" style={{ color: '#FFF1B8', fontSize: 13 }}>{detail}</AppText>
    </View>
  );
}
