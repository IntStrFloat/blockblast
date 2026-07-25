import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Lang } from '@/core/i18n';
import { progressionText } from '@/core/i18n/progression';
import { deriveMapNodes, progressFor, useProgression, type MapNode } from '@/features/progression';
import { useLang } from '@/features/settings';
import { getWorldTheme } from '@/features/themes';
import { AppText, CheckIcon, ChevronIcon, LockIcon, TrophyIcon, spacing } from '@/ui';

const ARCADE_BLUE = ['#2548B8', '#1998DC'] as const;
const RAIL_WIDTH = 50;

function nodeFill(node: MapNode): string {
  if (node.kind === 'world' && node.themeId) return getWorldTheme(node.themeId).cellColors[0];
  if (node.kind === 'cosmetic') return '#FFCC3D';
  if (node.kind === 'helper') return '#52D9F7';
  return '#2B72C7';
}

function rewardLabel(node: MapNode, lang: Lang): string {
  if (node.kind === 'world') return progressionText('worldReward', lang);
  if (node.kind === 'cosmetic') return progressionText('capiStyle', lang);
  if (node.kind === 'helper') return progressionText('helper', lang);
  return progressionText('nothing', lang);
}

function RoadNode({ node, current, isFirst, isLast, lang }: { node: MapNode; current: number; isFirst: boolean; isLast: boolean; lang: Lang }) {
  const isWorld = node.kind === 'world';
  const isCurrent = node.state === 'current';
  const isDone = node.state === 'done';
  const fill = nodeFill(node);
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
      <View style={[styles.nodeCard, isCurrent && styles.currentNodeCard, node.state === 'locked' && styles.lockedNodeCard]}>
        <View style={styles.nodeCardTop}>
          <AppText preset="speech" style={styles.nodeLevel}>{progressionText('lvlShort', lang)} {node.level}</AppText>
          {isCurrent ? <View style={styles.currentPill}><AppText preset="speech" style={styles.currentPillText}>{progressionText('current', lang)}</AppText></View> : null}
        </View>
        <AppText preset="speech" style={styles.nodeReward}>{rewardLabel(node, lang)}</AppText>
        {isWorld && node.themeId ? <View style={styles.swatches}>{getWorldTheme(node.themeId).cellColors.slice(0, 6).map((color, index) => <View key={`${node.level}-${index}`} style={[styles.swatch, { backgroundColor: color }]} />)}</View> : null}
      </View>
    </View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const lang = useLang();
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const info = progressFor(lifetimePoints);
  const from = Math.max(1, info.level - 4);
  const to = info.level + 12;
  const nodes = deriveMapNodes(lifetimePoints, from, to);
  const total = info.pointsInLevel + info.pointsToNext;
  const fill = total > 0 ? info.pointsInLevel / total : 1;
  const pct = Math.round(fill * 100);
  const worldAccent = getWorldTheme(nodes.find((node) => node.kind === 'world')?.themeId ?? 'classic').cellColors[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient colors={ARCADE_BLUE} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <View style={styles.backShell}>
          <ChevronIcon direction="left" size={27} color="#FFFFFF" />
        </View>
        <Pressable style={styles.headerHit} accessibilityRole="button" accessibilityLabel={progressionText('levels', lang)} onPress={() => router.back()} />
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
            <View style={styles.worldProgress}><View style={[styles.worldProgressFill, { width: `${Math.max(fill, 0.03) * 100}%` as `${number}%` }]} /></View>
            <AppText preset="speech" style={styles.progressText}>{info.pointsInLevel} / {total} · {pct}% {progressionText('toNext', lang)}</AppText>
          </LinearGradient>
        </View>
        <AppText preset="speech" style={styles.pathTitle}>{progressionText('mapTitle', lang)}</AppText>
        {nodes.map((node, index) => <RoadNode key={node.level} node={node} current={info.level} isFirst={index === 0} isLast={index === nodes.length - 1} lang={lang} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ARCADE_BLUE[1] },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.m, paddingTop: spacing.xs },
  backShell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  headerHit: { position: 'absolute', left: spacing.m, top: spacing.xs, width: 44, height: 44, zIndex: 2 },
  headerTitle: { flex: 1, color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 29 },
  content: { paddingHorizontal: spacing.m, paddingTop: spacing.m, paddingBottom: spacing.xl },
  worldHero: { borderRadius: 24, backgroundColor: '#A95A06', shadowColor: 'rgba(3,45,116,0.75)', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.58, shadowRadius: 5, elevation: 7 },
  worldHeroSurface: { minHeight: 157, borderRadius: 24, padding: spacing.m, borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)' },
  worldIcon: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' },
  worldCopy: { position: 'absolute', left: 87, top: spacing.m + 2 },
  worldTitle: { color: '#1746A7', fontFamily: 'Fredoka_700Bold', fontSize: 25 },
  worldLevel: { marginTop: 1, color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 20 },
  worldProgress: { position: 'absolute', left: spacing.m, right: spacing.m, bottom: 40, height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(23,70,167,0.52)' },
  worldProgressFill: { height: '100%', borderRadius: 6, backgroundColor: '#FFFFFF' },
  progressText: { position: 'absolute', left: spacing.m, right: spacing.m, bottom: spacing.s, color: '#1746A7', fontFamily: 'Fredoka_700Bold', fontSize: 13, textAlign: 'center' },
  pathTitle: { marginTop: spacing.l, marginBottom: spacing.s, color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 23 },
  nodeRow: { minHeight: 92, flexDirection: 'row', paddingVertical: spacing.s },
  rail: { position: 'absolute', left: RAIL_WIDTH / 2 - 2, top: 0, bottom: 0, width: 4, borderRadius: 2, overflow: 'hidden' },
  nodeSlot: { width: RAIL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  node: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.52)', shadowColor: 'rgba(3,45,116,0.42)', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 4 },
  currentNode: { width: 45, height: 45, borderRadius: 23, borderColor: '#FFFFFF', borderWidth: 3, backgroundColor: '#FFE46B' },
  nodeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1746A7' },
  nodeCard: { flex: 1, minHeight: 76, justifyContent: 'center', gap: 3, paddingHorizontal: 14, paddingVertical: 10, marginLeft: spacing.s, borderRadius: 19, backgroundColor: 'rgba(42,113,202,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', shadowColor: 'rgba(3,45,116,0.32)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.38, shadowRadius: 4, elevation: 3 },
  currentNodeCard: { backgroundColor: '#3A83D6', borderColor: '#FFE46B', borderWidth: 2 },
  lockedNodeCard: { opacity: 0.68 },
  nodeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nodeLevel: { color: 'rgba(233,249,255,0.76)', fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  currentPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: '#FFE46B' },
  currentPillText: { color: '#1746A7', fontFamily: 'Fredoka_700Bold', fontSize: 12 },
  nodeReward: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  swatches: { flexDirection: 'row', gap: 4, marginTop: 2 },
  swatch: { width: 16, height: 16, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' },
});
