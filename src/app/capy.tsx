import { dayLabel } from '@/ui/nightCandy';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnalyticsStore } from '@/features/analytics';
import { COSMETICS } from '@/features/mascot/logic/cosmetics';
import type { Cosmetic, Slot } from '@/features/mascot/logic/types';
import { useMascot } from '@/features/mascot/store';
import { ProfileOverlay, useProfileStore } from '@/features/profile';
import {
  levelForReward,
  nextRewardMilestone,
  progressFor,
  rewardDisplayName,
  useProgression,
} from '@/features/progression';
import { PROGRESSION_CONFIG } from '@/features/progression/logic/config';
import { useProgressionSync } from '@/features/progression/hooks/useProgressionSync';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { useLang } from '@/features/settings';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { getHomeStreakStatus, todayISO, useStreak } from '@/features/streak';
import {
  AppText,
  BottomNav,
  CandyBackground,
  CandyIcon,
  CandyProgress,
  formatNumber,
  nightCandy as n,
} from '@/ui';
import { CandyChip, CandyRoundButton } from '@/ui/primitives/CandyControls';
import { CandyCosmetic, DressedCandyCapy } from '@/ui/primitives/CandyCosmetic';

const categories = [
  { id: 'hat', ru: 'Голова', en: 'Head' },
  { id: 'face', ru: 'Лицо', en: 'Face' },
  { id: 'accessory', ru: 'Шея', en: 'Neck' },
  { id: 'look', ru: 'Образ', en: 'Look' },
] as const;
type Category = (typeof categories)[number]['id'];

function ItemTile({
  item,
  owned,
  equipped,
  isNew,
  ru,
  onPress,
}: {
  item: Cosmetic;
  owned: boolean;
  equipped: boolean;
  isNew: boolean;
  ru: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const reveal = useSharedValue(isNew && !reduced ? 0 : 1);
  useEffect(() => {
    if (!isNew || reduced) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: n.motion.celebrate,
      easing: Easing.linear,
    });
  }, [isNew, reduced, reveal]);
  const animation = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      {
        rotateY: `${interpolate(reveal.value, [0, 0.15, 0.35, 0.45, 1], [90, 90, 0, 0, 0])}deg`,
      },
      {
        scale: interpolate(
          reveal.value,
          [0, 0.15, 0.35, 0.45, 1],
          [0.8, 0.8, 1.12, 1, 1],
        ),
      },
    ],
  }));
  const rays = useAnimatedStyle(() => ({
    opacity:
      isNew && !reduced
        ? interpolate(reveal.value, [0, 0.25, 0.4, 1], [0, 0, 0.9, 0])
        : 0,
    transform: [
      { scale: interpolate(reveal.value, [0, 0.25, 1], [0.4, 0.4, 1.6]) },
      { rotate: `${45 * reveal.value}deg` },
    ],
  }));
  const unlockAt = levelForReward({ kind: 'cosmetic', id: item.id });
  const label = equipped
    ? ru
      ? 'Надето'
      : 'Wearing'
    : isNew
      ? ru
        ? 'Надеть'
        : 'Wear'
      : owned
        ? ru
          ? 'Есть'
          : 'Owned'
        : unlockAt
          ? `${ru ? 'Ранг' : 'Rank'} ${unlockAt}`
          : ru
            ? 'Награда'
            : 'Reward';
  return (
    <View style={{ width: '22%', flexGrow: 1, maxWidth: '24%', minWidth: 64 }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: -18, left: -20 }, rays]}
      >
        <CandyIcon name="sunburst" size={116} color={n.grape} />
      </Animated.View>
      <Animated.View style={animation}>
        <Pressable
          testID={`wardrobe-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${rewardDisplayName({ kind: 'cosmetic', id: item.id }, ru ? 'ru' : 'en')}. ${label}`}
          accessibilityState={{ selected: equipped, disabled: !owned }}
          disabled={!owned}
          onPress={onPress}
          style={[
            styles.tile,
            {
              backgroundColor: owned ? n.night700 : 'rgba(6,9,44,0.55)',
              borderColor: equipped
                ? n.sun
                : isNew
                  ? n.grape
                  : owned
                    ? n.border
                    : 'rgba(157,166,240,0.35)',
              borderWidth: equipped || isNew ? 3 : 2,
              borderStyle: owned ? 'solid' : 'dashed',
            },
          ]}
        >
          {equipped && (
            <View style={styles.check}>
              <CandyIcon name="check" size={16} color={n.sunInk} />
            </View>
          )}
          {isNew && (
            <View style={styles.newBadge}>
              <AppText
                style={{
                  color: '#1E0A4D',
                  fontFamily: 'Nunito_900Black',
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                {ru ? 'НОВОЕ' : 'NEW'}
              </AppText>
            </View>
          )}
          <CandyCosmetic id={item.id} size={48} muted={!owned} />
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {!owned && <CandyIcon name="lock" size={12} color={n.muted} />}
            <AppText
              style={{
                fontFamily: 'Nunito_800ExtraBold',
                fontSize: 12,
                lineHeight: 18,
                color: equipped
                  ? n.sun
                  : isNew
                    ? n.white
                    : owned
                      ? n.lavender
                      : n.muted,
              }}
            >
              {label}
            </AppText>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function CapyScreen() {
  useProgressionSync();
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const ru = lang === 'ru';
  const [category, setCategory] = useState<Category>('hat');
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useProfileStore((s) => s.profile);
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const level = useProgression((s) => s.level);
  const mascot = useMascot();
  const streak = useStreak();
  const streakCount = getHomeStreakStatus(streak, todayISO()).visibleCount;
  const progress = progressFor(lifetimePoints);
  const next = nextRewardMilestone(lifetimePoints + 1);
  const nextName = next ? rewardDisplayName(next.reward, lang) : null;
  const milestones = Object.entries(PROGRESSION_CONFIG.levelRewards)
    .filter(
      ([rank, reward]) => Number(rank) >= Math.max(1, level - 1) && !!reward,
    )
    .slice(0, 10);
  const items = COSMETICS.filter((item) =>
    category === 'look'
      ? item.slot === 'skin' || item.slot === 'aura'
      : item.slot === category,
  );
  const total = progress.pointsInLevel + progress.pointsToNext;
  return (
    <View style={styles.screen}>
      <CandyBackground />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AppText
          preset="title"
          style={{
            fontFamily: 'Unbounded_900Black',
            fontSize: 26,
            lineHeight: 32,
          }}
        >
          {ru ? 'Капи' : 'Capy'}
        </AppText>
        <CandyChip
          icon="fire"
          color={n.coral}
          label={`${streakCount} ${dayLabel(streakCount, lang)}`}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.identity}>
          <DressedCandyCapy equipped={mascot.equipped} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={styles.row}>
              <AppText
                preset="title"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{ flex: 1, fontSize: 17, lineHeight: 24 }}
              >
                {profile.nickname}
              </AppText>
              <CandyRoundButton
                icon="edit"
                size={40}
                label={ru ? 'Изменить ник' : 'Edit nickname'}
                onPress={() => setProfileOpen(true)}
              />
            </View>
            <View style={styles.row}>
              <AppText style={[styles.smallBold, { color: n.grape }]}>
                {ru ? 'Ранг' : 'Rank'} {level}
              </AppText>
              <AppText style={styles.smallBold}>
                {formatNumber(progress.pointsInLevel)} / {formatNumber(total)}
              </AppText>
            </View>
            <CandyProgress
              value={total > 0 ? progress.pointsInLevel / total : 0}
              color={n.grape}
            />
            <AppText style={styles.caption}>
              {next && nextName
                ? ru
                  ? `Ещё ${formatNumber(next.threshold - lifetimePoints)} опыта до награды`
                  : `${formatNumber(next.threshold - lifetimePoints)} XP to next reward`
                : ru
                  ? 'Все награды открыты'
                  : 'All rewards unlocked'}
            </AppText>
          </View>
        </View>
        <View style={styles.path}>
          <AppText style={styles.pathTitle}>
            {ru ? 'ПУТЬ КАПИ — НАГРАДЫ ЗА РАНГИ' : 'CAPY PATH — RANK REWARDS'}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingHorizontal: 4 }}
          >
            {milestones.map(
              ([rank, reward]) =>
                reward && (
                  <View
                    key={rank}
                    style={{ width: 50, alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderStyle:
                          Number(rank) > level + 1 ? 'dashed' : 'solid',
                        borderColor:
                          Number(rank) <= level + 1
                            ? n.grape
                            : 'rgba(157,166,240,0.35)',
                        backgroundColor:
                          Number(rank) <= level ? n.grape : n.night700,
                        opacity: Number(rank) > level + 1 ? 0.35 : 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {reward.kind === 'cosmetic' ? (
                        <CandyCosmetic id={reward.id} size={32} />
                      ) : (
                        <RewardVisual reward={reward} size={30} />
                      )}
                    </View>
                    <AppText
                      style={[
                        styles.smallBold,
                        {
                          fontSize: 12,
                          color: Number(rank) <= level ? n.grape : n.muted,
                        },
                      ]}
                    >
                      {Number(rank) === level
                        ? `${ru ? 'Ранг' : 'Rank'} ${rank}`
                        : rank}
                    </AppText>
                  </View>
                ),
            )}
          </ScrollView>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {categories.map((tab) => (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: category === tab.id }}
              onPress={() => setCategory(tab.id)}
              style={[
                styles.tab,
                category === tab.id && { backgroundColor: n.white },
              ]}
            >
              <AppText
                style={{
                  fontFamily: 'Nunito_900Black',
                  fontSize: 14,
                  lineHeight: 20,
                  color: category === tab.id ? n.night900 : n.lavender,
                }}
              >
                {ru ? tab.ru : tab.en}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.grid}>
          {items.map((item) => {
            const owned = mascot.unlocked.includes(item.id);
            const equipped = mascot.equipped[item.slot] === item.id;
            const isNew =
              owned &&
              !equipped &&
              !(mascot.wornCosmetics ?? []).includes(item.id);
            return (
              <ItemTile
                key={item.id}
                item={item}
                owned={owned}
                equipped={equipped}
                isNew={isNew}
                ru={ru}
                onPress={() => {
                  if (equipped) mascot.unequip(item.slot as Slot);
                  else mascot.equip(item.slot, item.id);
                  useAnalyticsStore
                    .getState()
                    .track('collection_opened', { source: 'capi' });
                }}
              />
            );
          })}
        </View>
      </ScrollView>
      <BottomNav active="capy" />
      <ProfileOverlay
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: n.night900 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  identity: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    padding: 16,
    borderRadius: 26,
    backgroundColor: n.night850,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  smallBold: {
    fontFamily: 'Nunito_900Black',
    fontSize: 13,
    lineHeight: 19,
    color: n.lavender,
  },
  caption: { fontSize: 13, lineHeight: 18, color: n.lavender },
  path: {
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(6,9,44,0.45)',
  },
  pathTitle: {
    fontFamily: 'Nunito_900Black',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.44,
    color: n.lavender,
    paddingLeft: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(6,9,44,0.6)',
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6 },
  tile: {
    height: 104,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  check: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 99,
    borderWidth: 3,
    borderColor: n.night850,
    backgroundColor: n.sun,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  newBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: n.grape,
    zIndex: 2,
  },
});
