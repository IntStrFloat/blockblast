import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { t } from '@/core/i18n';
import type { Lang } from '@/core/i18n';
import { DAILY_CONFIG } from '@/features/dailybonus';
import { PROGRESSION_CONFIG, progressFor, stageForLevel, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, colors, mascotPalette, spacing } from '@/ui';

import { COSMETICS } from '../logic/cosmetics';
import type { Cosmetic } from '../logic/types';
import { useMascot } from '../store';
import { Mascot, useMascotMotion } from './Mascot';
import { CosmeticIcon, MascotMark } from './MascotArt';

// Источник истины косметики-наград — Уровень Игры (спека 15): id→уровень разлока.
const COSMETIC_UNLOCK_LEVEL: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const [lvlStr, reward] of Object.entries(PROGRESSION_CONFIG.levelRewards)) {
    if (reward && reward.kind === 'cosmetic') map[reward.id] = Number(lvlStr);
  }
  return map;
})();

const COSMETIC_BY_ID = new Map(COSMETICS.map((item) => [item.id, item]));

// Все обретаемые косметики: награды уровней + дейли-пулы (дроп/редкие).
const OBTAINABLE_IDS: string[] = [
  ...Object.values(PROGRESSION_CONFIG.levelRewards)
    .filter(
      (reward): reward is { kind: 'cosmetic'; id: string } =>
        reward !== undefined && reward.kind === 'cosmetic',
    )
    .map((reward) => reward.id),
  ...DAILY_CONFIG.dailyCosmeticPool,
  ...DAILY_CONFIG.rarePool,
];

const WARDROBE_COSMETICS: Cosmetic[] = Array.from(new Set(OBTAINABLE_IDS))
  .map((id) => COSMETIC_BY_ID.get(id))
  .filter((item): item is Cosmetic => item !== undefined)
  .sort((a, b) => (COSMETIC_UNLOCK_LEVEL[a.id] ?? 9999) - (COSMETIC_UNLOCK_LEVEL[b.id] ?? 9999));

interface WardrobeProps {
  visible: boolean;
  onClose: () => void;
}

export function Wardrobe({ visible, onClose }: WardrobeProps) {
  if (!visible) return null;

  return <WardrobeInner onClose={onClose} />;
}

function WardrobeInner({ onClose }: { onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const lang = useLang();
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const unlocked = useMascot((s) => s.unlocked);
  const equipped = useMascot((s) => s.equipped);

  const p = progressFor(lifetimePoints);
  const stage = stageForLevel(p.level);
  const total = p.pointsInLevel + p.pointsToNext;
  const fillPct = total > 0 ? (p.pointsInLevel / total) * 100 : 100;
  const copy = wardrobeCopy(lang);
  const panelWidth = Math.min(width - spacing.m * 2, 392);
  const panelMaxHeight = Math.min(height - spacing.l * 2, 680);
  const tileSize = Math.floor((panelWidth - spacing.m * 2 - spacing.s * 3) / 4);
  const unlockedCount = WARDROBE_COSMETICS.filter((item) => unlocked.includes(item.id)).length;
  const nextRewardLevel = Object.keys(PROGRESSION_CONFIG.levelRewards)
    .map(Number)
    .filter((level) => level > p.level)
    .sort((a, b) => a - b)[0];
  const xpLabel = `${p.pointsInLevel}/${total} ${copy.pointsShort}`;
  const nextLabel = nextRewardLevel ? `${copy.next} ${copy.levelShort}${nextRewardLevel}` : copy.maxed;

  // Preview motion (neutral, static)
  const motion = useMascotMotion();

  return (
    <Pressable style={styles.scrim} onPress={onClose}>
      <Pressable
        style={[styles.card, { width: panelWidth, maxHeight: panelMaxHeight }]}
        onPress={(e) => e.stopPropagation()}
      >
        <View style={styles.headerPanel}>
          <LinearGradient
            colors={['rgba(126,231,255,0.22)', 'rgba(255,210,63,0.08)', 'rgba(13,22,45,0.84)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGlow}
            pointerEvents="none"
          />

          <View style={styles.hero}>
            <View style={styles.heroText}>
              <View style={styles.eyebrowRow}>
                <MascotMark size={18} />
                <AppText preset="caption" style={styles.eyebrow}>
                  {copy.currentLevel}
                </AppText>
              </View>
              <View style={styles.levelHeadlineRow}>
                <AppText preset="score" style={styles.levelNumber}>
                  {p.level}
                </AppText>
                <View style={styles.levelMeta}>
                  <AppText preset="button" style={styles.title}>
                    {t('mascot.wardrobeTitle', lang)}
                  </AppText>
                  <AppText preset="caption" style={styles.stageText}>
                    {`${copy.stage} ${stage} / ${copy.maxLevel} ${PROGRESSION_CONFIG.maxAuthoredLevel}`}
                  </AppText>
                </View>
              </View>
              <View style={styles.xpTrackLarge}>
                <View style={[styles.xpFill, { width: `${fillPct}%` }]} />
              </View>
              <View style={styles.levelStats}>
                <AppText preset="caption" style={styles.statText}>
                  {xpLabel}
                </AppText>
                <AppText preset="caption" style={styles.statText}>
                  {nextLabel}
                </AppText>
              </View>
            </View>
            <View style={styles.previewPod}>
              <View style={styles.previewHalo} />
              <Mascot motion={motion} stage={stage} equipped={equipped} size={84} />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <AppText preset="caption" style={styles.summaryLabel}>
                {copy.unlocked}
              </AppText>
              <AppText preset="button" style={styles.summaryValue}>
                {`${unlockedCount}/${WARDROBE_COSMETICS.length}`}
              </AppText>
            </View>
            <View style={styles.summaryPill}>
              <AppText preset="caption" style={styles.summaryLabel}>
                {copy.equipped}
              </AppText>
              <AppText preset="button" style={styles.summaryValue}>
                {Object.keys(equipped).length.toString()}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.gridPanel}>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {WARDROBE_COSMETICS.map((item) => {
              const isUnlocked = unlocked.includes(item.id);
              const isEquipped = equipped[item.slot] === item.id;
              const unlockLevel = COSMETIC_UNLOCK_LEVEL[item.id];

              return (
                <CosmeticTile
                  key={item.id}
                  itemId={item.id}
                  isUnlocked={isUnlocked}
                  isEquipped={isEquipped}
                  unlockLevel={unlockLevel}
                  lang={lang}
                  size={tileSize}
                  onPress={() => {
                    if (!isUnlocked) return;
                    if (isEquipped) {
                      useMascot.getState().unequip(item.slot);
                    } else {
                      useMascot.getState().equip(item.slot, item.id);
                    }
                  }}
                />
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CosmeticTile
// ---------------------------------------------------------------------------

interface CosmeticTileProps {
  itemId: string;
  isUnlocked: boolean;
  isEquipped: boolean;
  unlockLevel: number | undefined;
  lang: Lang;
  size: number;
  onPress: () => void;
}

function CosmeticTile({
  itemId,
  isUnlocked,
  isEquipped,
  unlockLevel,
  lang,
  size,
  onPress,
}: CosmeticTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        [styles.tile, { width: size, height: size }],
        isEquipped && styles.tileEquipped,
        !isUnlocked && styles.tileLocked,
        pressed && isUnlocked && styles.tilePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${isUnlocked ? '' : `${t('mascot.locked', lang)}${unlockLevel ?? ''} `}${itemId}`}
      accessibilityState={{ disabled: !isUnlocked, selected: isEquipped }}
    >
      <CosmeticIcon id={itemId} size={Math.round(size * 0.52)} muted={!isUnlocked} simple />
      {!isUnlocked && (
        <View style={styles.lockRow}>
          <AppText preset="caption" style={styles.lockLabel}>
            {unlockLevel !== undefined ? unlockLevel.toString() : ''}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

function wardrobeCopy(lang: Lang) {
  if (lang === 'ru') {
    return {
      currentLevel: 'Текущий уровень',
      levelShort: 'ур.',
      maxLevel: 'макс.',
      stage: 'стадия',
      maxed: 'максимум',
      next: 'следующая награда',
      pointsShort: 'очк.',
      unlocked: 'открыто',
      equipped: 'надето',
    };
  }
  return {
    currentLevel: 'Current level',
    levelShort: 'lvl ',
    maxLevel: 'max',
    stage: 'stage',
    maxed: 'maxed',
    next: 'next reward',
    pointsShort: 'pts',
    unlocked: 'unlocked',
    equipped: 'equipped',
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: spacing.l,
  },
  card: {
    borderRadius: 24,
    backgroundColor: 'transparent',
    gap: 0,
  },
  headerPanel: {
    borderRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(13,22,45,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(126,231,255,0.24)',
    padding: spacing.m,
    gap: spacing.s,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 128,
    gap: spacing.m,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    color: mascotPalette.auraBlue,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  levelHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  levelNumber: {
    color: mascotPalette.block,
    fontSize: 56,
    lineHeight: 62,
  },
  levelMeta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    lineHeight: 21,
  },
  stageText: {
    color: '#B8C8EA',
    fontSize: 11,
  },
  xpTrackLarge: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: mascotPalette.block,
  },
  levelStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  statText: {
    color: '#C8D4F2',
    fontSize: 10,
  },
  previewPod: {
    width: 104,
    height: 104,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  previewHalo: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255,210,63,0.1)',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  summaryPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabel: {
    color: '#91A7D2',
    fontSize: 10,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  scrollArea: {
    maxHeight: 326,
  },
  gridPanel: {
    borderRadius: 22,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: 'rgba(2,13,28,0.76)',
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderColor: 'rgba(126,231,255,0.18)',
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
    paddingBottom: spacing.s,
  },
  tile: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(20,33,66,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(126,231,255,0.12)',
  },
  tileEquipped: {
    borderColor: mascotPalette.block,
    borderWidth: 2,
    backgroundColor: 'rgba(255,210,63,0.18)',
  },
  tileLocked: {
    backgroundColor: 'rgba(8,15,31,0.9)',
    borderColor: 'rgba(255,255,255,0.09)',
  },
  tilePressed: {
    backgroundColor: colors.surfacePressed,
  },
  lockRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 5,
    minHeight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockLabel: {
    color: '#DCE7FF',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
    textAlign: 'center',
  },
});
