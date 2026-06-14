import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { t } from '@/core/i18n';
import type { Lang } from '@/core/i18n';
import { todayISO } from '@/features/streak';
import { useLang } from '@/features/settings';
import { AppText, colors, mascotPalette, radii, spacing } from '@/ui';

import { COSMETICS } from '../logic/cosmetics';
import { MASCOT_CONFIG } from '../logic/config';
import { progressFor } from '../logic/progression';
import { canUseHelper } from '../logic/rules';
import type { Slot } from '../logic/types';
import { useMascot } from '../store';
import { Mascot, useMascotMotion } from './Mascot';

// ---------------------------------------------------------------------------
// Reverse-lookup: cosmetic id → unlock level
// ---------------------------------------------------------------------------

const COSMETIC_UNLOCK_LEVEL: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const [lvlStr, reward] of Object.entries(MASCOT_CONFIG.rewards)) {
    if (reward && reward.kind === 'cosmetic') {
      map[reward.id] = Number(lvlStr);
    }
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Slot icons
// ---------------------------------------------------------------------------

const SLOT_ICON: Record<Slot, string> = {
  hat: '🎩',
  face: '🕶️',
  accessory: '🎧',
  skin: '🎨',
  aura: '✨',
};

// ---------------------------------------------------------------------------
// Wardrobe
// ---------------------------------------------------------------------------

interface WardrobeProps {
  visible: boolean;
  onClose: () => void;
}

export function Wardrobe({ visible, onClose }: WardrobeProps) {
  if (!visible) return null;

  return <WardrobeInner onClose={onClose} />;
}

function WardrobeInner({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const totalXp = useMascot((s) => s.totalXp);
  const unlocked = useMascot((s) => s.unlocked);
  const equipped = useMascot((s) => s.equipped);
  const helpersUsedDay = useMascot((s) => s.helpersUsedDay);

  const p = progressFor(totalXp);
  const fillPct = p.xpToNext === 0 ? 100 : (p.xpInLevel / p.xpToNext) * 100;

  const today = todayISO();

  // Preview motion (neutral, static)
  const motion = useMascotMotion();

  return (
    // Full-screen scrim — tap backdrop to close
    <Pressable style={styles.scrim} onPress={onClose}>
      {/* Inner card — stop propagation so tapping card doesn't close */}
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppText preset="button" style={styles.title}>
              {t('mascot.wardrobeTitle', lang)}
            </AppText>
            <View style={styles.levelRow}>
              <AppText preset="caption">{`🫧 ур.${p.level}`}</AppText>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${fillPct}%` }]} />
              </View>
            </View>
          </View>
          <View style={styles.previewBox}>
            <Mascot motion={motion} stage={p.stage} equipped={equipped} size={64} />
          </View>
        </View>

        {/* Cosmetics grid */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {COSMETICS.map((item) => {
            const isUnlocked = unlocked.includes(item.id);
            const isEquipped = equipped[item.slot] === item.id;
            const unlockLevel = COSMETIC_UNLOCK_LEVEL[item.id];

            return (
              <CosmeticTile
                key={item.id}
                slotIcon={SLOT_ICON[item.slot]}
                isUnlocked={isUnlocked}
                isEquipped={isEquipped}
                unlockLevel={unlockLevel}
                lang={lang}
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

        {/* Helper status row */}
        <View style={styles.helpersRow}>
          <HelperStatus
            label="💡"
            helperId="hint"
            level={p.level}
            helpersUsedDay={helpersUsedDay}
            today={today}
            lang={lang}
          />
          <HelperStatus
            label="🔀"
            helperId="swap"
            level={p.level}
            helpersUsedDay={helpersUsedDay}
            today={today}
            lang={lang}
          />
        </View>
      </Pressable>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CosmeticTile
// ---------------------------------------------------------------------------

interface CosmeticTileProps {
  slotIcon: string;
  isUnlocked: boolean;
  isEquipped: boolean;
  unlockLevel: number | undefined;
  lang: Lang;
  onPress: () => void;
}

function CosmeticTile({
  slotIcon,
  isUnlocked,
  isEquipped,
  unlockLevel,
  lang,
  onPress,
}: CosmeticTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isEquipped && styles.tileEquipped,
        !isUnlocked && styles.tileLocked,
        pressed && isUnlocked && styles.tilePressed,
      ]}
      accessibilityRole="button"
    >
      <AppText style={styles.tileIcon}>{slotIcon}</AppText>
      {!isUnlocked && (
        <AppText preset="caption" style={styles.lockLabel}>
          {unlockLevel !== undefined
            ? `🔒 ${t('mascot.locked', lang)}${unlockLevel}`
            : '🔒'}
        </AppText>
      )}
      {isEquipped && (
        <View style={styles.checkDot} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HelperStatus
// ---------------------------------------------------------------------------

interface HelperStatusProps {
  label: string;
  helperId: 'hint' | 'swap';
  level: number;
  helpersUsedDay: Partial<Record<'hint' | 'swap', string>>;
  today: string;
  lang: Lang;
}

function HelperStatus({ label, helperId, level, helpersUsedDay, today, lang }: HelperStatusProps) {
  const unlockLevel = MASCOT_CONFIG.helpers[helperId].unlockLevel;

  let statusText: string;
  if (level < unlockLevel) {
    statusText = `🔒 ${t('mascot.locked', lang)}${unlockLevel}`;
  } else if (!canUseHelper(helpersUsedDay[helperId], today, level, helperId)) {
    statusText = t('mascot.helperCooldown', lang);
  } else {
    statusText = t('mascot.helperReady', lang);
  }

  return (
    <View style={styles.helperItem}>
      <AppText style={styles.helperIcon}>{label}</AppText>
      <AppText preset="caption" style={styles.helperStatus}>
        {statusText}
      </AppText>
    </View>
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
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    backgroundColor: colors.cardGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.m,
    gap: spacing.m,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: 14,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  xpTrack: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cellEmpty,
    overflow: 'hidden',
  },
  xpFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: mascotPalette.block,
  },
  previewBox: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    maxHeight: 240,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  tile: {
    width: 56,
    height: 56,
    minWidth: 44,
    minHeight: 44,
    borderRadius: radii.cell,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  tileEquipped: {
    borderColor: mascotPalette.block,
    borderWidth: 2,
    backgroundColor: mascotPalette.blockTint,
  },
  tileLocked: {
    opacity: 0.45,
  },
  tilePressed: {
    backgroundColor: colors.surfacePressed,
  },
  tileIcon: {
    fontSize: 22,
  },
  lockLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  checkDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mascotPalette.block,
  },
  helpersRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  helperItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.cell,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  helperIcon: {
    fontSize: 18,
  },
  helperStatus: {
    flex: 1,
    fontSize: 12,
  },
});
