import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  LeaderboardRow,
  Podium,
  getUtcWeekCountdown,
  getWeeklyGoal,
  resolveWeeklyView,
  selectMyChampionRank,
  unclaimedPrize,
  useLeaderboardStore,
  weeklyStatusLabel,
} from '@/features/leaderboard';
import { useMascot } from '@/features/mascot';
import { useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, ChevronIcon, CrownIcon, TrophyIcon, spacing } from '@/ui';

const ARCADE_BLUE = ['#2548B8', '#1998DC'] as const;

function formatCountdown() {
  const countdown = getUtcWeekCountdown(new Date());
  const parts = [
    countdown.days > 0 ? `${countdown.days}д` : null,
    `${String(countdown.hours).padStart(2, '0')}ч`,
    `${String(countdown.minutes).padStart(2, '0')}м`,
  ].filter(Boolean);
  return parts.join(' ');
}

function ArcadeBackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
    >
      <ChevronIcon direction="left" size={27} color="#FFFFFF" />
    </Pressable>
  );
}

function ClaimButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.claimButton, pressed && styles.claimButtonPressed]}>
      <LinearGradient colors={['#A9E16E', '#82C958']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.claimButtonSurface}>
        <AppText preset="speech" style={styles.claimButtonLabel}>{label}</AppText>
      </LinearGradient>
    </Pressable>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const lang = useLang();
  const snapshot = useLeaderboardStore((state) => state.snapshot);
  const viewState = useLeaderboardStore((state) => state.viewState);
  const lastError = useLeaderboardStore((state) => state.lastError);
  const localWeekly = useLeaderboardStore((state) => state.localWeeklyResult);
  const weeklyPrizes = useLeaderboardStore((state) => state.weeklyPrizes);
  const overtaken = useLeaderboardStore((state) => state.overtaken);
  const [loading, setLoading] = useState(false);

  const runRefresh = useCallback(() => {
    setLoading(true);
    return useLeaderboardStore
      .getState()
      .refresh(new Date())
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      useAnalyticsStore.getState().track('leaderboard_opened', { source: 'screen' });
      setLoading(true);
      void useLeaderboardStore
        .getState()
        .refresh(new Date())
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        useLeaderboardStore.getState().ackOvertaken();
      };
    }, []),
  );

  const statusLabel = weeklyStatusLabel(viewState, snapshot?.source, lang);
  const myChampionRank = selectMyChampionRank(weeklyPrizes);
  const pendingPrize = unclaimedPrize(weeklyPrizes);
  const view = resolveWeeklyView(snapshot, localWeekly, myChampionRank, new Date());
  const weeklyBest = view.effectiveBest;
  const goal = getWeeklyGoal(weeklyBest);
  const progressPercent = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;
  const rank = view.rank;
  const rankLabel = rank != null ? `#${rank}` : t('leaderboard.unranked', lang);
  const currentEntry = view.currentEntry;
  const entries = view.entries;
  const podium = entries.slice(0, 3);
  const listData = entries.slice(3);
  const showPinnedCurrent = Boolean(currentEntry) && !entries.some((entry) => entry.isCurrentPlayer);

  const claimPrize = useCallback(() => {
    if (!pendingPrize) return;
    const record = useLeaderboardStore.getState().claimWeeklyPrize(pendingPrize.weekKey);
    if (!record) return;
    useProgression.getState().addPoints(record.prize.points);
    useMascot.getState().unlock(record.prize.cosmeticId);
  }, [pendingPrize]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient colors={ARCADE_BLUE} style={StyleSheet.absoluteFill} />
      <FlatList
        style={styles.list}
        data={listData}
        keyExtractor={(entry) => `${entry.tag}-${entry.rank ?? 'self'}`}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: spacing.s }} />}
        onRefresh={runRefresh}
        refreshing={loading}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <ArcadeBackButton onPress={() => router.back()} label={t('leaderboard.back', lang)} />
              <AppText preset="speech" style={styles.screenTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                {t('leaderboard.title', lang)}
              </AppText>
              <View style={styles.countdown} accessible accessibilityLabel={`${t('leaderboard.resetsIn', lang)} ${formatCountdown()}`}>
                <TrophyIcon size={16} color="#FFE46B" />
                <AppText preset="speech" style={styles.countdownText}>{formatCountdown()}</AppText>
              </View>
            </View>

            {overtaken ? (
              <View style={styles.overtakenBanner}>
                <AppText preset="speech" style={styles.overtakenText} numberOfLines={2}>
                  {overtaken.by
                    ? `${t('leaderboard.overtakenBy', lang)} ${overtaken.by} — ${t('leaderboard.fightBack', lang)}`
                    : `${t('leaderboard.overtaken', lang)} #${overtaken.from} → #${overtaken.to} — ${t('leaderboard.fightBack', lang)}`}
                </AppText>
              </View>
            ) : null}

            <View style={styles.weeklyHero}>
              <LinearGradient colors={['#FFC33A', '#F2940A']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.weeklyHeroSurface}>
                <View style={styles.heroIcon}><CrownIcon size={33} color="#173C91" /></View>
                <View style={styles.heroCopy}>
                  <AppText preset="speech" style={styles.heroKicker} numberOfLines={1}>
                    {t('leaderboard.weeklyBest', lang)}{statusLabel ? ` · ${statusLabel}` : ''}
                  </AppText>
                  <AppText preset="score" style={styles.heroScore} numberOfLines={1}>{weeklyBest}</AppText>
                </View>
                <View style={styles.rankPill}><AppText preset="speech" style={styles.rankPillText}>{rankLabel}</AppText></View>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${Math.max(progressPercent, 2)}%` as `${number}%` }]} />
                </View>
              </LinearGradient>
            </View>

            {pendingPrize ? (
              <View style={styles.prizeCard}>
                <View style={styles.prizeCopy}>
                  <CrownIcon size={23} color="#FFE46B" />
                  <View style={{ flex: 1 }}>
                    <AppText preset="speech" style={styles.prizeTitle}>{t('leaderboard.prizeReady', lang)}</AppText>
                    <AppText preset="caption" style={styles.prizeDetail} numberOfLines={2}>
                      {t('leaderboard.prizePlace', lang)} #{pendingPrize.rank} · +{pendingPrize.prize.points} {t('leaderboard.prizePoints', lang)}
                    </AppText>
                  </View>
                </View>
                <ClaimButton label={t('leaderboard.claim', lang)} onPress={claimPrize} />
              </View>
            ) : null}

            {viewState === 'loading' && podium.length === 0 ? <AppText preset="speech" style={styles.stateText}>{t('leaderboard.loading', lang)}</AppText> : null}
            {viewState === 'empty' ? <AppText preset="speech" style={styles.stateText}>{t('leaderboard.empty', lang)}</AppText> : null}
            {lastError && podium.length === 0 ? <AppText preset="speech" style={styles.stateText}>{t('leaderboard.error', lang)}</AppText> : null}

            {podium.length > 0 ? <Podium entries={podium} /> : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {showPinnedCurrent && currentEntry ? <LeaderboardRow entry={currentEntry} /> : null}
            {viewState === 'error' || viewState === 'cached' || viewState === 'empty' ? <ClaimButton label={t('leaderboard.retry', lang)} onPress={() => void runRefresh()} /> : null}
          </View>
        }
        renderItem={({ item }) => <LeaderboardRow entry={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ARCADE_BLUE[1] },
  list: { flex: 1 },
  content: { paddingHorizontal: spacing.m, paddingTop: spacing.s, paddingBottom: spacing.l, gap: spacing.s },
  headerContent: { gap: spacing.m, paddingBottom: spacing.m },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  backButtonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  screenTitle: { flex: 1, color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 28, lineHeight: 32 },
  countdown: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 18, backgroundColor: 'rgba(15,65,165,0.30)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  countdownText: { color: '#F4FAFF', fontFamily: 'Fredoka_700Bold', fontSize: 14 },
  overtakenBanner: { borderRadius: 14, paddingHorizontal: spacing.m, paddingVertical: spacing.s, backgroundColor: '#E63D2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)' },
  overtakenText: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 16 },
  weeklyHero: { borderRadius: 24, backgroundColor: '#A95A06', shadowColor: 'rgba(3,45,116,0.75)', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.58, shadowRadius: 5, elevation: 7 },
  weeklyHeroSurface: { minHeight: 154, borderRadius: 24, padding: spacing.m, borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)' },
  heroIcon: { width: 54, height: 54, borderRadius: 20, position: 'absolute', left: spacing.m, top: spacing.m, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.40)' },
  heroCopy: { marginLeft: 67, paddingRight: 76 },
  heroKicker: { color: '#173C91', fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  heroScore: { marginTop: 2, color: '#FFFFFF', fontFamily: 'Unbounded_800ExtraBold', fontSize: 43, lineHeight: 52, textShadowColor: 'rgba(125,70,0,0.34)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1 },
  rankPill: { position: 'absolute', right: spacing.m, top: spacing.m + 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1746A7' },
  rankPillText: { color: '#FFE46B', fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  goalTrack: { position: 'absolute', left: spacing.m, right: spacing.m, bottom: spacing.m, height: 12, borderRadius: 6, backgroundColor: 'rgba(19,61,137,0.55)', overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 6, backgroundColor: '#FFFFFF' },
  prizeCard: { gap: spacing.s, padding: spacing.m, borderRadius: 20, backgroundColor: '#276FC7', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  prizeCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  prizeTitle: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 18 },
  prizeDetail: { color: 'rgba(244,250,255,0.80)', marginTop: 2 },
  claimButton: { width: '100%', borderRadius: 13, backgroundColor: '#397D2D', shadowColor: 'rgba(3,45,116,0.55)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 3, elevation: 4 },
  claimButtonPressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
  claimButtonSurface: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' },
  claimButtonLabel: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 20, fontStyle: 'italic' },
  stateText: { color: '#FFFFFF', fontFamily: 'Fredoka_700Bold', fontSize: 17, textAlign: 'center' },
  footer: { gap: spacing.s, paddingBottom: spacing.l },
});
