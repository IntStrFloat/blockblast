import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { progressFor, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, colors, mascotPalette, radii } from '@/ui';

import { MascotMark } from './MascotArt';

/**
 * Компактный пилюль-чип: Уровень Игры + тонкий бар очков (единый стержень, спека 15).
 *
 * Ширина заливки бара пересчитывается на рендере (очки меняются редко, НЕ на кадр) —
 * никаких анимаций ширины.
 * Если передан onPress — оборачивается в Pressable (≥44pt) для открытия гардероба.
 */
export function MascotChip({ onPress, compact = false, width = compact ? 56 : 80 }: {
  onPress?: () => void;
  compact?: boolean;
  width?: number;
}) {
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const lang = useLang();
  const p = progressFor(lifetimePoints);

  const total = p.pointsInLevel + p.pointsToNext;
  const fillPct = total > 0 ? (p.pointsInLevel / total) * 100 : 100;
  const accessibilityLabel = lang === 'ru'
    ? `Уровень ${p.level}. Прогресс: ${p.pointsInLevel} из ${total} очков.`
    : `Level ${p.level}. Progress: ${p.pointsInLevel} of ${total} points.`;

  const inner = (
    <View style={[styles.pill, { width }]}>
      <View style={styles.caption}>
        {!compact ? <MascotMark size={14} /> : null}
        <AppText preset="button" numberOfLines={1} allowFontScaling={false} style={styles.label}>
        {`ур.${p.level}`}
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%` }]} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable testID="mascot-chip" onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.hitArea, { width }]}>
        {inner}
      </Pressable>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  hitArea: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    flexShrink: 1,
    minWidth: 0,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  track: {
    width: 40,
    maxWidth: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cellEmpty,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: mascotPalette.block,
  },
});
