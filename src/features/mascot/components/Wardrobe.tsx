import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { t } from '@/core/i18n';
import type { Lang } from '@/core/i18n';
import { PROGRESSION_CONFIG, progressFor, rewardDisplayName, stageForLevel, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, CheckIcon, LockIcon, colors, mascotPalette, spacing } from '@/ui';

import { COSMETICS } from '../logic/cosmetics';
import type { Cosmetic } from '../logic/types';
import { useMascot } from '../store';
import { Mascot, useMascotMotion } from './Mascot';
import { CosmeticIcon } from './MascotArt';

// Источник истины косметики-наград — Уровень Игры (спека 15): id→уровень разлока.
const COSMETIC_UNLOCK_LEVEL: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const [lvlStr, reward] of Object.entries(PROGRESSION_CONFIG.levelRewards)) {
    if (reward && reward.kind === 'cosmetic') map[reward.id] = Number(lvlStr);
  }
  return map;
})();

const COSMETIC_BY_ID = new Map(COSMETICS.map((item) => [item.id, item]));

// Legacy bonus cosmetics stay visible for players who already unlocked them.
const LEGACY_BONUS_NAMES: Record<string, Record<Lang, string>> = {
  'skin-chrome': { ru: 'Хромированный образ', en: 'Chrome look' },
  'hat-tophat': { ru: 'Цилиндр', en: 'Top hat' },
  'face-vr-visor': { ru: 'VR-очки', en: 'VR visor' },
  'skin-obsidian': { ru: 'Обсидиановый образ', en: 'Obsidian look' },
  'hat-halo': { ru: 'Нимб', en: 'Halo' },
};

// Все обретаемые косметики: награды уровней + ранее выданные legacy-предметы.
const OBTAINABLE_IDS: string[] = [
  ...Object.values(PROGRESSION_CONFIG.levelRewards)
    .filter(
      (reward): reward is { kind: 'cosmetic'; id: string } =>
        reward !== undefined && reward.kind === 'cosmetic',
    )
    .map((reward) => reward.id),
  ...Object.keys(LEGACY_BONUS_NAMES),
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
  const visibleCosmetics = WARDROBE_COSMETICS.filter((item) =>
    COSMETIC_UNLOCK_LEVEL[item.id] !== undefined ||
    unlocked.includes(item.id) || equipped[item.slot] === item.id,
  );

  const p = progressFor(lifetimePoints);
  const stage = stageForLevel(p.level);
  const total = p.pointsInLevel + p.pointsToNext;
  const fillPct = total > 0 ? Math.max(0, Math.min(100, (p.pointsInLevel / total) * 100)) : 100;
  const panelWidth = Math.min(width - spacing.m * 2, 392);
  const panelMaxHeight = Math.min(height - spacing.l * 2, 680);
  const tileSize = Math.floor((panelWidth - spacing.m * 2 - spacing.s * 3) / 4);

  // Preview motion (neutral, static)
  const motion = useMascotMotion();

  return (
    <Pressable importantForAccessibility="yes" style={styles.scrim} onPress={onClose}>
      <Pressable
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
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

          <View style={styles.titleRow}>
            <AppText preset="button" style={styles.title}>{t('mascot.wardrobeTitle', lang)}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={lang === 'ru' ? 'Закрыть' : 'Close'} onPress={onClose} style={styles.closeButton}>
              <AppText preset="title">×</AppText>
            </Pressable>
          </View>
          <View style={styles.hero}>
            <View style={styles.previewPod}>
              <View style={styles.previewHalo} />
              <Mascot motion={motion} stage={stage} equipped={equipped} size={76} />
            </View>
            <View style={styles.heroText}>
              <AppText preset="button" style={styles.levelNumber}>
                {lang === 'ru' ? 'Ур.' : 'Lv.'} {p.level}
              </AppText>
              <View style={styles.xpTrackLarge} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: p.pointsInLevel }} accessibilityLabel={lang === 'ru' ? 'До следующего уровня' : 'Next level'}>
                <View style={[styles.xpFill, { width: `${fillPct}%` }]} />
              </View>
              <AppText preset="caption" style={styles.statText}>
                {p.pointsInLevel} / {total} XP
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
            {visibleCosmetics.map((item) => {
              const isEquipped = equipped[item.slot] === item.id;
              const isUnlocked = isEquipped || unlocked.includes(item.id);
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
  const name = LEGACY_BONUS_NAMES[itemId]?.[lang] ?? rewardDisplayName({ kind: 'cosmetic', id: itemId }, lang);
  const lockedLabel = unlockLevel !== undefined
    ? `${t('mascot.locked', lang)}${unlockLevel}`
    : lang === 'ru' ? 'Закрыто' : 'Locked';
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
      accessibilityLabel={`${name}. ${isEquipped ? lang === 'ru' ? 'Надето. Снять' : 'Equipped. Unequip' : isUnlocked ? lang === 'ru' ? 'Надеть' : 'Equip' : lockedLabel}`}
      accessibilityState={{ disabled: !isUnlocked, selected: isEquipped }}
    >
      <CosmeticIcon id={itemId} size={Math.round(size * 0.52)} simple />
      {isEquipped ? <View style={styles.equippedCheck}><CheckIcon size={15} color={mascotPalette.block} /></View> : null}
      {!isUnlocked && (
        <View style={styles.lockRow}>
          <LockIcon size={11} color="#DCE7FF" />
          <AppText preset="caption" style={styles.lockLabel}>
            {unlockLevel !== undefined ? unlockLevel.toString() : ''}
          </AppText>
        </View>
      )}
    </Pressable>
  );
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
    minHeight: 84,
    gap: spacing.m,
  },
  heroText: {
    flex: 1,
    gap: spacing.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    color: mascotPalette.block,
    fontSize: 22,
    lineHeight: 28,
  },
  title: {
    fontSize: 17,
    lineHeight: 21,
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
  statText: {
    color: '#C8D4F2',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  previewPod: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  previewHalo: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,210,63,0.1)',
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
    backgroundColor: '#41607C',
    borderColor: 'rgba(206,233,255,0.24)',
  },
  tilePressed: {
    backgroundColor: colors.surfacePressed,
  },
  equippedCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  lockRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 5,
    minHeight: 16,
    flexDirection: 'row',
    gap: 3,
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
