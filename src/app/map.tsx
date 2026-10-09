import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t, type Lang } from '@/core/i18n';
import { progressionText } from '@/core/i18n/progression';
import { useAnalyticsStore } from '@/features/analytics';
import { COSMETICS } from '@/features/mascot/logic/cosmetics';
import { useMascot } from '@/features/mascot/store';
import {
  deriveMapNodes,
  nextRewardMilestone,
  progressFor,
  rewardDisplayName,
  rewardForLevel,
  thresholdForLevel,
  useProgression,
  type MapNode,
  type RewardMilestone,
} from '@/features/progression';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { useLang } from '@/features/settings';
import { getWorldTheme } from '@/features/themes';
import { AppText, CheckIcon, ChevronIcon, GameButton, LockIcon, TrophyIcon, spacing } from '@/ui';

const ARCADE_BLUE = ['#2548B8', '#1998DC'] as const;
const RAIL_WIDTH = 50;

function nodeFill(node: MapNode): string {
  if (node.kind === 'world' && node.themeId) return getWorldTheme(node.themeId).cellColors[0];
  if (node.kind === 'cosmetic') return '#FFCC3D';
  if (node.kind === 'helper') return '#52D9F7';
  return '#2B72C7';
}

function previewReward(
  lifetimePoints: number,
  level: number,
  equippedIds: readonly string[],
): RewardMilestone | null {
  for (let candidate = level; candidate >= 1; candidate -= 1) {
    const reward = rewardForLevel(candidate);
    if (reward?.kind !== 'cosmetic' || equippedIds.includes(reward.id)) continue;
    const threshold = thresholdForLevel(candidate);
    return { level: candidate, threshold, reward, remaining: 0, available: true };
  }
  return nextRewardMilestone(lifetimePoints);
}

function RoadNode({ node, current, isFirst, isLast, lang }: { node: MapNode; current: number; isFirst: boolean; isLast: boolean; lang: Lang }) {
  const isWorld = node.kind === 'world';
  const isCurrent = node.state === 'current';
  const isDone = node.state === 'done';
  const fill = nodeFill(node);
  const reward = rewardForLevel(node.level);
  const railColor = node.level <= current ? '#FFE46B' : 'rgba(255,255,255,0.28)';

  return (
    <View style={styles.nodeRow}>
      <View pointerEvents="none" style={styles.rail}>
        <View style={{ flex: 1, backgroundColor: isFirst ? 'transparent' : railColor }} />
        <View style={{ flex: 1, backgroundColor: isLast ? 'transparent' : node.level < current ? '#FFE46B' : 'rgba(255,255,255,0.28)' }} />
      </View>
      <View style={styles.nodeSlot}>
        <View style={[styles.node, { backgroundColor: node.state === 'locked' ? '#2A71C4' : fill }, isCurrent && styles.currentNode]}>
          {node.state === 'locked' ? <LockIcon size={isWorld ? 19 : 16} color="#FFFFFF" /> : isDone ? <CheckIcon size={isWorld ? 21 : 17} color="#1746A7" /> : isWorld ? <TrophyIcon size={21} color="#1746A7" /> : <View style={styles.nodeDot} />}
        </View>
      </View>
      <View
        accessible
        accessibilityLabel={`${progressionText('level', lang)} ${node.level}${reward ? `. ${rewardDisplayName(reward, lang)}` : ''}. ${isCurrent ? progressionText('current', lang) : node.state === 'locked' ? t('mascot.locked', lang) : lang === 'ru' ? 'Открыто' : 'Unlocked'}`}
        style={[styles.nodeCard, isCurrent && styles.currentNodeCard, node.state === 'locked' && styles.lockedNodeCard]}
      >
          <AppText preset="speech" style={styles.nodeLevel}>{progressionText('lvlShort', lang)} {node.level}</AppText>
          {reward ? <RewardVisual reward={reward} size={44} /> : <View style={styles.nodeDot} />}
      </View>
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const lang = useLang();
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const unlocked = useMascot((s) => s.unlocked);
  const equipped = useMascot((s) => s.equipped);
  const info = progressFor(lifetimePoints);
  const from = Math.max(1, info.level - 4);
  const to = info.level + 12;
  const nodes = deriveMapNodes(lifetimePoints, from, to);
  const total = info.pointsInLevel + info.pointsToNext;
  const fill = total > 0 ? info.pointsInLevel / total : 1;
  const worldAccent = getWorldTheme(nodes.find((node) => node.kind === 'world')?.themeId ?? 'classic').cellColors[0];
  const rewardPreview = previewReward(lifetimePoints, info.level, Object.values(equipped));
  const previewRewardId = rewardPreview?.reward.kind === 'cosmetic' ? rewardPreview.reward.id : null;
  const previewCosmetic = previewRewardId
    ? COSMETICS.find((item) => item.id === previewRewardId) ?? null
    : null;
  const previewIsEquipped = previewCosmetic
    ? equipped[previewCosmetic.slot] === previewCosmetic.id
    : false;
  const previewIsAvailable = rewardPreview?.available === true ||
    (previewCosmetic ? unlocked.includes(previewCosmetic.id) : false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient colors={ARCADE_BLUE} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <View style={styles.backShell}>
          <ChevronIcon direction="left" size={27} color="#FFFFFF" />
        </View>
        <Pressable style={styles.headerHit} accessibilityRole="button" accessibilityLabel={t('leaderboard.back', lang)} onPress={() => router.back()} />
        <AppText preset="speech" style={styles.headerTitle}>{progressionText('levels', lang)}</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.worldHero}>
          <LinearGradient colors={['#FFC33A', '#F2940A']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.worldHeroSurface}>
            <View style={[styles.worldIcon, { backgroundColor: worldAccent }]}><TrophyIcon size={27} color="#1746A7" /></View>
            <View style={styles.worldCopy}>
              <AppText preset="speech" style={styles.worldTitle}>{progressionText('world', lang)} {info.world}</AppText>
              <AppText preset="speech" style={styles.worldLevel}>{progressionText('level', lang)} {info.level}</AppText>
            </View>
            <View style={styles.worldProgress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: info.pointsInLevel }} accessibilityLabel={progressionText('toNext', lang)}><View style={[styles.worldProgressFill, { width: `${Math.max(0, Math.min(fill, 1)) * 100}%` as `${number}%` }]} /></View>
            <AppText preset="speech" style={styles.progressText}>{info.pointsInLevel} / {total} XP</AppText>
          </LinearGradient>
        </View>
        {rewardPreview ? (
          <View style={styles.rewardPreview} testID="map-reward-preview">
            <View style={styles.rewardPreviewIcon}>
              <RewardVisual reward={rewardPreview.reward} size={44} />
              {previewIsAvailable ? <View style={styles.rewardCheck}><CheckIcon size={15} color="#1746A7" /></View> : null}
            </View>
            <View
              style={styles.rewardPreviewCopy}
              accessible
              accessibilityLabel={`${rewardDisplayName(rewardPreview.reward, lang)}. ${previewIsAvailable ? lang === 'ru' ? 'Открыто' : 'Unlocked' : `${rewardPreview.remaining} XP. ${progressionText('level', lang)} ${rewardPreview.level}`}`}
            >
              <AppText preset="button" style={styles.rewardPreviewTitle} numberOfLines={2}>
                {rewardDisplayName(rewardPreview.reward, lang)}
              </AppText>
              {!previewIsAvailable ? <AppText preset="caption" style={styles.rewardPreviewDetail}>{progressionText('lvlShort', lang)} {rewardPreview.level}</AppText> : null}
            </View>
            {previewCosmetic && previewIsAvailable ? (
              <GameButton
                label={previewIsEquipped
                  ? lang === 'ru' ? 'Надето' : 'Equipped'
                  : lang === 'ru' ? 'Надеть' : 'Equip'}
                disabled={previewIsEquipped}
                onPress={() => {
                  if (!unlocked.includes(previewCosmetic.id)) {
                    useMascot.getState().unlock(previewCosmetic.id);
                  }
                  useMascot.getState().equip(previewCosmetic.slot, previewCosmetic.id, 'map');
                }}
                style={styles.rewardPreviewAction}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  useAnalyticsStore.getState().track('collection_opened', { source: 'map' });
                  router.push('/capy');
                }}
                style={styles.collectionLink}
              >
                <AppText preset="caption" style={styles.collectionLinkText}>
                  {lang === 'ru' ? 'В гардероб' : 'Wardrobe'}
                </AppText>
              </Pressable>
            )}
          </View>
        ) : null}
        <View style={styles.path}>
          {nodes.map((node, index) => <RoadNode key={node.level} node={node} current={info.level} isFirst={index === 0} isLast={index === nodes.length - 1} lang={lang} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ARCADE_BLUE[1] },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.m, paddingTop: spacing.xs },
  backShell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  headerHit: { position: 'absolute', left: spacing.m, top: spacing.xs, width: 44, height: 44, zIndex: 2 },
  headerTitle: { flex: 1, color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 29 },
  content: { paddingHorizontal: spacing.m, paddingTop: spacing.m, paddingBottom: spacing.xl },
  worldHero: { borderRadius: 24, backgroundColor: '#A95A06', shadowColor: 'rgba(3,45,116,0.75)', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.58, shadowRadius: 5, elevation: 7 },
  worldHeroSurface: { minHeight: 157, borderRadius: 24, padding: spacing.m, borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)' },
  worldIcon: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' },
  worldCopy: { position: 'absolute', left: 87, top: spacing.m + 2 },
  worldTitle: { color: '#1746A7', fontFamily: 'Unbounded_700Bold', fontSize: 25 },
  worldLevel: { marginTop: 1, color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 20 },
  worldProgress: { position: 'absolute', left: spacing.m, right: spacing.m, bottom: 40, height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(23,70,167,0.52)' },
  worldProgressFill: { height: '100%', borderRadius: 6, backgroundColor: '#FFFFFF' },
  progressText: { position: 'absolute', left: spacing.m, right: spacing.m, bottom: spacing.s, color: '#1746A7', fontFamily: 'Unbounded_700Bold', fontSize: 13, textAlign: 'center' },
  rewardPreview: { marginTop: spacing.m, minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.s, padding: spacing.s, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 2, borderColor: 'rgba(255,228,107,0.9)' },
  rewardPreviewIcon: { width: 62, height: 62, flexShrink: 0, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2B8' },
  rewardCheck: { position: 'absolute', right: 0, bottom: 0, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A9E16E' },
  rewardPreviewCopy: { flex: 1, minWidth: 0, gap: 2 },
  rewardPreviewTitle: { color: '#1746A7', fontSize: 17 },
  rewardPreviewDetail: { color: '#4A6DAE', fontVariant: ['tabular-nums'] },
  rewardPreviewAction: { minWidth: 116, minHeight: 50, flexShrink: 0, paddingHorizontal: spacing.s, justifyContent: 'center' },
  collectionLink: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.s },
  collectionLinkText: { color: '#1746A7', textDecorationLine: 'underline' },
  path: { marginTop: spacing.m },
  nodeRow: { minHeight: 76, flexDirection: 'row', paddingVertical: spacing.xs },
  rail: { position: 'absolute', left: RAIL_WIDTH / 2 - 2, top: 0, bottom: 0, width: 4, borderRadius: 2, overflow: 'hidden' },
  nodeSlot: { width: RAIL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  node: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.52)', shadowColor: 'rgba(3,45,116,0.42)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 4 },
  currentNode: { width: 45, height: 45, borderRadius: 23, borderColor: '#FFFFFF', borderWidth: 3, backgroundColor: '#FFE46B' },
  nodeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1746A7' },
  nodeCard: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, paddingHorizontal: 14, paddingVertical: spacing.xs, marginLeft: spacing.s, borderRadius: 19, backgroundColor: 'rgba(42,113,202,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', shadowColor: 'rgba(3,45,116,0.32)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38, shadowRadius: 4, elevation: 3 },
  currentNodeCard: { backgroundColor: '#3A83D6', borderColor: '#FFE46B', borderWidth: 2 },
  lockedNodeCard: { opacity: 0.68 },
  nodeLevel: { color: 'rgba(233,249,255,0.76)', fontFamily: 'Unbounded_700Bold', fontSize: 14 },
});
