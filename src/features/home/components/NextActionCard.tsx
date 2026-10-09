import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, CheckIcon, ChevronIcon, ClayCard, colors, spacing } from '@/ui';

import type { NextActionKind } from '../nextAction';

interface NextActionCardProps {
  kind: NextActionKind;
  title: string;
  detail: string;
  icon: ReactNode;
  current: number;
  target: number;
  valueLabel?: string;
  complete?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** One visual goal; the full explanation belongs to its accessible label. */
export function NextActionCard({
  kind,
  title,
  detail,
  icon,
  current,
  target,
  valueLabel = `${current}/${target}`,
  complete = false,
  onPress,
  accessibilityLabel = title,
}: NextActionCardProps) {
  const progress = complete ? 1 : target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}. ${detail}`}
      onPress={onPress}
      testID={`next-action-${kind}`}
    >
      {({ pressed }) => (
        <ClayCard style={[styles.card, pressed && styles.pressed]}>
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.icon}>
            {icon}
          </View>
          <View style={styles.copy}>
            <AppText
              preset="button"
              style={styles.title}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.86}
            >
              {title}
            </AppText>
            <View style={styles.progressRow}>
              <View style={styles.track}>
                <View
                  testID="next-action-progress"
                  style={[styles.fill, { width: `${progress * 100}%` }]}
                />
              </View>
              {complete ? (
                <CheckIcon size={18} color={colors.accent} />
              ) : (
                <AppText preset="caption" style={styles.value} numberOfLines={1}>
                  {valueLabel}
                </AppText>
              )}
            </View>
          </View>
          <View style={styles.chevron}>
            <ChevronIcon size={18} color={colors.textDim} />
          </View>
        </ClayCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
