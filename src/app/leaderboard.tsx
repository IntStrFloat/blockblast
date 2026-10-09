import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { recordNextGoalClick, useAnalyticsStore } from '@/features/analytics';
import {
  LeaderboardRow,
  Podium,
  getUtcWeekCountdown,
  getWeeklyGoal,
  currentWeeklyGoal,
  useWeeklyGoalStore,
  useWeeklyGoalWeekKey,
  resolveWeeklyView,
  selectPreviousWeeklyBest,
  selectMyChampionRank,
  unclaimedPrize,
  useLeaderboardStore,
  weeklyStatusLabel,
} from '@/features/leaderboard';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { useLang } from '@/features/settings';
import { AppText, CheckIcon, ChevronIcon, CrownIcon, TrophyIcon, spacing } from '@/ui';

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

function ClaimButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.claimButton,
        pressed && styles.claimButtonPressed,
        disabled && { opacity: 0.58 },
      ]}
    >
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
  const weeklyOutcomes = useLeaderboardStore((state) => state.weeklyOutcomes);
  const prizeSyncState = useLeaderboardStore((state) => state.prizeSyncState);
  const prizeLastError = useLeaderboardStore((state) => state.prizeLastError);
  const claimingRewardId = useLeaderboardStore((state) => state.claimingRewardId);
  const weeklyGoals = useWeeklyGoalStore((state) => state.goals);
  const overtaken = useLeaderboardStore((state) => state.overtaken);
  const [loading, setLoading] = useState(false);
  const currentWeekKey = useWeeklyGoalWeekKey();
  const goalNow = new Date();

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
  const latestOutcome = weeklyOutcomes[0] ?? null;
  const missedPrizeCount = weeklyPrizes.filter(
    (record) => record.origin === 'server' && !record.claimed,
  ).length;
  const view = resolveWeeklyView(snapshot, localWeekly, myChampionRank, goalNow);
  const weeklyBest = view.effectiveBest;
  const previousWeeklyBest = selectPreviousWeeklyBest(snapshot, localWeekly, goalNow);
  const assignedGoal = currentWeeklyGoal(
    weeklyGoals,
    goalNow,
    weeklyBest,
    previousWeeklyBest,
  );
  const goal = getWeeklyGoal(
    Math.max(weeklyBest, assignedGoal.progress),
    assignedGoal.target,
  );

  useEffect(() => {
    const synced = useWeeklyGoalStore.getState().sync(
      new Date(),
      weeklyBest,
      'leaderboard',
      previousWeeklyBest,
    );
    useWeeklyGoalStore.getState().expose(synced, 'leaderboard');
  }, [currentWeekKey, previousWeeklyBest, weeklyBest]);
  const progressPercent = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;
  const rank = view.rank;
  const rankLabel = rank != null ? `#${rank}` : t('leaderboard.unranked', lang);
  const goalStateLabel = goal.complete
    ? lang === 'ru' ? 'Выполнено' : 'Complete'
    : `${lang === 'ru' ? 'Осталось' : 'Left'} ${goal.remaining}`;
  const currentEntry = view.currentEntry;
  const entries = view.entries;
  const podium = entries.slice(0, 3);
  const listData = entries.slice(3);
  const showPinnedCurrent = Boolean(currentEntry) && !entries.some((entry) => entry.isCurrentPlayer);
  const emptyStateLabel = podium.length > 0 ? null : lastError
    ? t('leaderboard.error', lang)
    : viewState === 'loading'
      ? t('leaderboard.loading', lang)
      : viewState === 'empty' ? t('leaderboard.empty', lang) : null;
  const consolidateEmptyStatus = entries.length === 0 && !pendingPrize && weeklyOutcomes.length === 0;
  const combinedStatusLabel = lastError || viewState === 'error' || prizeSyncState === 'error'
    ? t('leaderboard.error', lang)
    : viewState === 'loading'
      ? t('leaderboard.loading', lang)
      : prizeSyncState === 'offline' || statusLabel
        ? statusLabel ?? t('leaderboard.offline', lang)
        : emptyStateLabel ?? t('leaderboard.empty', lang);
  const retryEmptyStatus = Boolean(lastError) ||
    viewState === 'error' || viewState === 'cached' || viewState === 'empty' ||
    prizeSyncState === 'offline' || prizeSyncState === 'error';

  const playWeeklyGoal = () => {
    recordNextGoalClick('weekly', assignedGoal.goalId);
    if (goal.complete) {
      useWeeklyGoalStore.getState().advanceCompleted(new Date(), goal.current);
    }
    router.push({ pathname: '/game', params: { entry: 'new' } });
  };

  const claimPrize = useCallback(() => {
    if (!pendingPrize) return;
    void useLeaderboardStore.getState().claimWeeklyPrize(pendingPrize.rewardId);
  }, [pendingPrize]);

  const retryPrizeSync = useCallback(() => {
    void useLeaderboardStore.getState().syncWeeklyOutcomes();
  }, []);

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
                {lang === 'ru' ? 'Рейтинг' : 'Leaderboard'}
              </AppText>
              <View style={styles.countdown} accessible accessibilityLabel={`${t('leaderboard.resetsIn', lang)} ${formatCountdown()}`}>
                <TrophyIcon size={16} color="#FFE46B" />
                <AppText preset="speech" style={styles.countdownText}>{formatCountdown()}</AppText>
              </View>
            </View>

            {overtaken ? (
              <View style={styles.overtakenBanner} accessible accessibilityLabel={overtaken.by ? `${t('leaderboard.overtakenBy', lang)} ${overtaken.by}` : t('leaderboard.overtaken', lang)}>
                <AppText preset="speech" style={styles.overtakenText} numberOfLines={2}>
                  #{overtaken.from} → #{overtaken.to}
                </AppText>
              </View>
            ) : null}

            <View style={styles.weeklyHero}>
              <LinearGradient colors={['#FFC33A', '#F2940A']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.weeklyHeroSurface}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}><CrownIcon size={29} color="#173C91" /></View>
                  <AppText preset="speech" style={styles.heroKicker}>{lang === 'ru' ? 'Цель недели' : 'Weekly goal'}</AppText>
                  <View style={styles.rankPill} accessible accessibilityLabel={rankLabel}><AppText preset="speech" style={styles.rankPillText}>{rank == null ? '—' : rankLabel}</AppText></View>
                </View>
                <View style={styles.goalValue} accessible accessibilityLabel={`${t('leaderboard.weeklyBest', lang)} ${weeklyBest}. ${goal.current}/${goal.target}. ${goalStateLabel}`}>
                  <AppText preset="score" style={styles.heroScore} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{`${goal.current}/${goal.target}`}</AppText>
                  {goal.complete ? <CheckIcon size={23} color="#1746A7" /> : null}
                </View>
                <View style={styles.goalTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: goal.target, now: Math.min(goal.current, goal.target) }}>
                  <View style={[styles.goalFill, { width: `${progressPercent}%` as `${number}%` }]} />
                </View>
              </LinearGradient>
            </View>

            <ClaimButton
              label={goal.complete
                ? lang === 'ru' ? 'Следующая цель · Играть' : 'Next goal · Play'
                : lang === 'ru' ? 'Играть' : 'Play'}
              onPress={playWeeklyGoal}
            />

            {pendingPrize ? (
              <View style={styles.prizeCard}>
                <View style={styles.prizeCopy} accessible accessibilityLabel={`${t('leaderboard.prizeReady', lang)} ${t('leaderboard.prizePlace', lang)} ${pendingPrize.rank}. +${pendingPrize.prize.points} XP${missedPrizeCount > 1 ? `. ${lang === 'ru' ? 'Ещё наград' : 'More rewards'}: ${missedPrizeCount - 1}` : ''}`}>
                  <RewardVisual reward={{ kind: 'cosmetic', id: pendingPrize.prize.cosmeticId }} size={48} />
                  <View style={{ flex: 1 }}>
                    <AppText preset="speech" style={styles.prizeTitle}>#{pendingPrize.rank} · +{pendingPrize.prize.points} XP</AppText>
                  </View>
                  {missedPrizeCount > 1 ? <AppText preset="button" style={styles.prizeDetail}>+{missedPrizeCount - 1}</AppText> : null}
                </View>
                <ClaimButton
                  label={claimingRewardId === pendingPrize.rewardId
                    ? lang === 'ru' ? 'Получаем…' : 'Claiming…'
                    : t('leaderboard.claim', lang)}
                  onPress={claimPrize}
                  disabled={claimingRewardId !== null}
                />
              </View>
            ) : null}

            {!consolidateEmptyStatus && !pendingPrize && !lastError && snapshot?.source === 'remote' && viewState !== 'error' && viewState !== 'cached' &&
            (prizeSyncState === 'idle' || prizeSyncState === 'loading') &&
            weeklyOutcomes.length === 0 ? (
              <AppText preset="caption" style={styles.stateText}>
                {lang === 'ru' ? 'Подводим итог прошлой недели…' : 'Finalizing last week…'}
              </AppText>
            ) : null}
            {!consolidateEmptyStatus && prizeSyncState === 'offline' ? (
              <View style={styles.prizeCard}>
                <AppText preset="speech" style={styles.prizeTitle}>
                  {lang === 'ru'
                    ? 'Нет сети — проверим итог позже'
                    : 'Offline — we’ll check the result later'}
                </AppText>
                {prizeLastError ? (
                  <ClaimButton
                    label={t('leaderboard.retry', lang)}
                    onPress={retryPrizeSync}
                  />
                ) : null}
              </View>
            ) : null}
            {!consolidateEmptyStatus && prizeSyncState === 'error' ? (
              <View style={styles.prizeCard}>
                <AppText preset="speech" style={styles.prizeTitle}>
                  {lang === 'ru'
                    ? 'Не удалось проверить или получить награду'
                    : 'Could not check or claim the reward'}
                </AppText>
                <ClaimButton
                  label={t('leaderboard.retry', lang)}
                  onPress={pendingPrize ? claimPrize : retryPrizeSync}
                  disabled={claimingRewardId !== null}
                />
              </View>
            ) : null}
            {!pendingPrize && prizeSyncState === 'ready' && latestOutcome ? (
              <View style={styles.prizeCard}>
                <AppText preset="speech" style={styles.prizeTitle}>
                  {latestOutcome.reward
                    ? lang === 'ru' ? 'Награда недели получена' : 'Weekly reward claimed'
                    : lang === 'ru'
                      ? `Итог недели: #${latestOutcome.rank} · без приза`
                      : `Final result: #${latestOutcome.rank} · no prize`}
                </AppText>
              </View>
            ) : null}

            {consolidateEmptyStatus ? (
              <View style={styles.emptyStatus} testID="leaderboard-empty-status">
                <AppText preset="caption" style={styles.stateText}>{combinedStatusLabel}</AppText>
                {retryEmptyStatus ? <ClaimButton label={t('leaderboard.retry', lang)} onPress={() => { void runRefresh(); retryPrizeSync(); }} /> : null}
              </View>
            ) : (
              <>
                {emptyStateLabel && prizeSyncState !== 'offline' && prizeSyncState !== 'error' ? <AppText preset="caption" style={styles.stateText}>{emptyStateLabel}</AppText> : null}
                {statusLabel && !emptyStateLabel && prizeSyncState !== 'offline' && prizeSyncState !== 'error' ? <AppText preset="caption" style={styles.statusText}>{statusLabel}</AppText> : null}
              </>
            )}

            {podium.length > 0 ? <Podium entries={podium} /> : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {showPinnedCurrent && currentEntry ? <LeaderboardRow entry={currentEntry} /> : null}
            {!consolidateEmptyStatus && (viewState === 'error' || viewState === 'cached' || viewState === 'empty') ? <ClaimButton label={t('leaderboard.retry', lang)} onPress={() => void runRefresh()} /> : null}
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
  screenTitle: { flex: 1, color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 28, lineHeight: 34 },
  countdown: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 18, backgroundColor: 'rgba(15,65,165,0.30)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  countdownText: { color: '#F4FAFF', fontFamily: 'Unbounded_700Bold', fontSize: 14 },
  overtakenBanner: { borderRadius: 14, paddingHorizontal: spacing.m, paddingVertical: spacing.s, backgroundColor: '#E63D2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)' },
  overtakenText: { color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 16 },
  weeklyHero: { borderRadius: 24, backgroundColor: '#A95A06', shadowColor: 'rgba(3,45,116,0.75)', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.58, shadowRadius: 5, elevation: 7 },
  weeklyHeroSurface: { borderRadius: 24, padding: spacing.m, gap: spacing.s, borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  heroIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.40)' },
  heroKicker: { flex: 1, color: '#173C91', fontFamily: 'Unbounded_700Bold', fontSize: 15 },
  goalValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  heroScore: { flex: 1, color: '#FFFFFF', fontFamily: 'Unbounded_800ExtraBold', fontSize: 32, lineHeight: 42, textShadowColor: 'rgba(125,70,0,0.34)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1 },
  rankPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1746A7' },
  rankPillText: { color: '#FFE46B', fontFamily: 'Unbounded_700Bold', fontSize: 18 },
  goalTrack: { height: 12, borderRadius: 6, backgroundColor: 'rgba(19,61,137,0.55)', overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 6, backgroundColor: '#FFFFFF' },
  prizeCard: { gap: spacing.s, padding: spacing.m, borderRadius: 20, backgroundColor: '#276FC7', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' },
  prizeCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  prizeTitle: { color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 18 },
  prizeDetail: { color: 'rgba(244,250,255,0.80)', marginTop: 2 },
  claimButton: { width: '100%', borderRadius: 13, backgroundColor: '#397D2D', shadowColor: 'rgba(3,45,116,0.55)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 3, elevation: 4 },
  claimButtonPressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
  claimButtonSurface: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' },
  claimButtonLabel: { color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 18 },
  stateText: { color: '#FFFFFF', fontSize: 13, textAlign: 'center' },
  emptyStatus: { gap: spacing.s },
  statusText: { color: 'rgba(244,250,255,0.8)', fontSize: 12, textAlign: 'center' },
  footer: { gap: spacing.s, paddingBottom: spacing.l },
});
