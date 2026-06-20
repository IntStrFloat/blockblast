import { Pressable, StyleSheet, View } from 'react-native';

import { progressFor, useProgression } from '@/features/progression';
import { AppText, colors, mascotPalette, radii } from '@/ui';

import { MascotMark } from './MascotArt';

/**
 * Компактный пилюль-чип: Уровень Игры + тонкий бар очков (единый стержень, спека 15).
 *
 * Ширина заливки бара пересчитывается на рендере (очки меняются редко, НЕ на кадр) —
 * никаких анимаций ширины.
 * Если передан onPress — оборачивается в Pressable (≥44pt) для открытия гардероба.
 */
export function MascotChip({ onPress }: { onPress?: () => void }) {
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const p = progressFor(lifetimePoints);

  const total = p.pointsInLevel + p.pointsToNext;
  const fillPct = total > 0 ? (p.pointsInLevel / total) * 100 : 100;

  const inner = (
    <View style={styles.pill}>
      <MascotMark size={18} />
      <AppText preset="button" style={styles.label}>
        {`ур.${p.level}`}
      </AppText>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fillPct}%` }]} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.hitArea}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 11,
  },
  track: {
    width: 40,
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
