import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, colors, mascotPalette, radii } from '@/ui';

import { progressFor } from '../logic/progression';
import { useMascot } from '../store';

/**
 * Компактный пилюль-чип: уровень Капи + тонкий XP-бар.
 *
 * Ширина заливки бара пересчитывается на рендере (XP меняется редко, НЕ на кадр) —
 * никаких анимаций ширины. На макс-уровне (xpToNext === 0) бар полон.
 * Если передан onPress — оборачивается в Pressable (≥44pt) для открытия гардероба.
 */
export function MascotChip({ onPress }: { onPress?: () => void }) {
  const totalXp = useMascot((s) => s.totalXp);
  const p = progressFor(totalXp);

  const fillPct = (p.xpToNext === 0 ? 1 : p.xpInLevel / p.xpToNext) * 100;

  const inner = (
    <View style={styles.pill}>
      <AppText preset="button" style={styles.label}>
        {`🫧 ур.${p.level}`}
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
