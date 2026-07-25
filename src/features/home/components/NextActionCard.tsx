import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ChevronIcon, ClayCard, colors, radii, spacing } from '@/ui';

import type { NextActionKind } from '../nextAction';

interface NextActionCardProps {
  kind: NextActionKind;
  title: string;
  detail: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Presentational shell shared by Adventure and leaderboard next actions. */
export function NextActionCard({
  kind,
  title,
  detail,
  onPress,
  accessibilityLabel = title,
}: NextActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={`next-action-${kind}`}
    >
      {({ pressed }) => (
        <ClayCard style={[styles.card, pressed && styles.pressed]}>
          <View style={styles.copy}>
            <AppText preset="button" numberOfLines={1}>
              {title}
            </AppText>
            <AppText preset="caption" style={styles.detail} numberOfLines={2}>
              {detail}
            </AppText>
          </View>
          <View style={styles.chevron}>
            <ChevronIcon size={18} color={colors.textPrimary} />
          </View>
        </ClayCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  detail: {
    color: colors.textDim,
  },
  chevron: {
    width: 34,
    height: 34,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardRaised,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
