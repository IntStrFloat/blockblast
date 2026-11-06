import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/core/i18n';
import { recordNextGoalClick, useAnalyticsStore } from '@/features/analytics';
import { getSavedGameSummary } from '@/features/game';
import {
  LeaderboardRow,
  Podium,
  WEEKLY_PRIZES,
  currentWeeklyGoal,
  getUtcWeekCountdown,
  getWeeklyGoal,
  resolveWeeklyView,
  selectMyChampionRank,
  selectPreviousWeeklyBest,
  unclaimedPrize,
  useLeaderboardStore,
  useWeeklyGoalStore,
  useWeeklyGoalWeekKey,
} from '@/features/leaderboard';
import { useLang } from '@/features/settings';
import {
  AppText,
  BottomNav,
  CandyBackground,
  CandyIcon,
  CandyProgress,
  GameButton,
  formatNumber,
  nightCandy as n,
} from '@/ui';
import { CandyChip } from '@/ui/primitives/CandyControls';
import { CandyCosmetic } from '@/ui/primitives/CandyCosmetic';

export default function LeaderboardScreen() {
  const router = useRouter();
  const lang = useLang();
  const ru = lang === 'ru';
  const insets = useSafeAreaInsets();
  const state = useLeaderboardStore();
  const goals = useWeeklyGoalStore((s) => s.goals);
  const week = useWeeklyGoalWeekKey();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await useLeaderboardStore.getState().refresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      useAnalyticsStore
        .getState()
        .track('leaderboard_opened', { source: 'screen' });
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
  const view = resolveWeeklyView(
    state.snapshot,
    state.localWeeklyResult,
    selectMyChampionRank(state.weeklyPrizes),
    now,
  );
  const previous = selectPreviousWeeklyBest(
    state.snapshot,
    state.localWeeklyResult,
    now,
  );
  const assignedGoal = currentWeeklyGoal(
    goals,
    now,
    view.effectiveBest,
    previous,
  );
  const goal = getWeeklyGoal(
    Math.max(view.effectiveBest, assignedGoal.progress),
    assignedGoal.target,
  );
  useEffect(() => {
    const record = useWeeklyGoalStore
      .getState()
      .sync(new Date(), view.effectiveBest, 'leaderboard', previous);
    useWeeklyGoalStore.getState().expose(record, 'leaderboard');
  }, [previous, view.effectiveBest, week]);
  const prize = unclaimedPrize(state.weeklyPrizes);
  const countdown = getUtcWeekCountdown(now);
  const status =
    state.lastError || state.viewState === 'error'
      ? t('leaderboard.error', lang)
      : state.viewState === 'loading'
        ? t('leaderboard.loading', lang)
        : state.viewState === 'cached' || state.prizeSyncState === 'offline'
          ? ru
            ? 'Нет сети. Очки сохранятся и попадут в рейтинг позже.'
            : 'Offline. Scores are saved and will sync later.'
          : view.entries.length === 0
            ? t('leaderboard.empty', lang)
            : null;
  const hasError =
    !!state.lastError ||
    state.viewState === 'error' ||
    state.viewState === 'cached' ||
    state.prizeSyncState === 'offline';
  const claimError = state.prizeSyncState === 'error';
  const play = () => {
    recordNextGoalClick('weekly', assignedGoal.goalId);
    if (goal.complete)
      useWeeklyGoalStore.getState().advanceCompleted(new Date(), goal.current);
    router.push({
      pathname: '/game',
      params: { entry: getSavedGameSummary().canContinue ? 'resume' : 'new' },
    });
  };
  const entries = view.entries;
  const list = entries.filter((e) => e.rank == null || e.rank > 3);
  const pinned =
    view.currentEntry && !entries.some((e) => e.isCurrentPlayer)
      ? view.currentEntry
      : null;
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
          {ru ? 'Рейтинг' : 'Rating'}
        </AppText>
        <CandyChip
          icon="flag"
          color={n.lavender}
          label={`${ru ? 'ещё' : 'left'} ${countdown.days}${ru ? 'д' : 'd'} ${countdown.hours}${ru ? 'ч' : 'h'}`}
        />
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        data={list}
        keyExtractor={(entry) => `${entry.tag}-${entry.rank ?? 'self'}`}
        refreshing={loading}
        onRefresh={() => {
          void refresh();
        }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            {status && (
              <View testID="leaderboard-status" style={{ gap: 8 }}>
                <AppText
                  style={{ color: n.lavender, fontSize: 14, lineHeight: 20 }}
                >
                  {status}
                </AppText>
                {hasError && (
                  <GameButton
                    label={t('leaderboard.retry', lang)}
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      void refresh();
                      void state.syncWeeklyOutcomes();
                    }}
                  />
                )}
              </View>
            )}
            <LinearGradient
              colors={['#FFE06B', '#F3B325']}
              style={styles.goalCard}
            >
              <View style={styles.row}>
                <AppText
                  preset="title"
                  style={{ color: n.sunInk, fontSize: 18, lineHeight: 24 }}
                >
                  {ru ? 'Цель недели' : 'Weekly goal'}
                </AppText>
                <View
                  style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
                >
                  <AppText
                    style={{
                      color: n.sunInk,
                      fontFamily: 'Nunito_900Black',
                      fontSize: 13,
                    }}
                  >
                    {ru ? 'Призы топ-3' : 'Top 3 prizes'}
                  </AppText>
                  <CandyCosmetic
                    id={prize?.prize.cosmeticId ?? WEEKLY_PRIZES[1].cosmeticId}
                    size={28}
                  />
                </View>
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}
              >
                <AppText
                  preset="score"
                  style={{ color: n.sunInk, fontSize: 34, lineHeight: 42 }}
                >
                  {formatNumber(goal.current)}
                </AppText>
                <AppText
                  preset="button"
                  style={{ color: '#805400', fontSize: 20, lineHeight: 28 }}
                >
                  / {formatNumber(goal.target)}
                </AppText>
              </View>
              <CandyProgress
                value={goal.current / goal.target}
                color={n.white}
              />
              <GameButton
                variant="ink"
                label={ru ? 'Играть' : 'Play'}
                size="lg"
                icon={<CandyIcon name="play" />}
                onPress={play}
              />
            </LinearGradient>
            {prize && (
              <View style={styles.prize}>
                <View style={styles.row}>
                  <CandyCosmetic id={prize.prize.cosmeticId} />
                  <AppText style={{ flex: 1 }}>
                    {ru ? 'Приз недели' : 'Weekly prize'} · #{prize.rank} · +
                    {formatNumber(prize.prize.points)} XP
                  </AppText>
                </View>
                <GameButton
                  label={
                    state.claimingRewardId
                      ? ru
                        ? 'Получаем…'
                        : 'Claiming…'
                      : t('leaderboard.claim', lang)
                  }
                  disabled={state.claimingRewardId !== null}
                  onPress={() => {
                    void state.claimWeeklyPrize(prize.rewardId);
                  }}
                />
              </View>
            )}
            {claimError && (
              <View style={styles.prize}>
                <AppText>
                  {ru
                    ? 'Не удалось проверить или получить награду'
                    : 'Could not check or claim the reward'}
                </AppText>
                <GameButton
                  label={t('leaderboard.retry', lang)}
                  variant="ghost"
                  onPress={() => {
                    if (prize) void state.claimWeeklyPrize(prize.rewardId);
                    else void state.syncWeeklyOutcomes();
                  }}
                />
              </View>
            )}
            {state.overtaken && (
              <AppText style={{ color: n.muted }}>
                #{state.overtaken.from} → #{state.overtaken.to}
              </AppText>
            )}
            <Podium
              entries={entries.filter((e) => e.rank != null && e.rank <= 3)}
            />
          </View>
        }
        ListFooterComponent={
          pinned ? (
            <View style={{ paddingTop: 8 }}>
              <LeaderboardRow entry={pinned} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            gapToNext={
              item.rank != null
                ? Math.max(
                    0,
                    (entries.find((e) => e.rank === item.rank! - 1)
                      ?.weeklyBest ?? item.weeklyBest) - item.weeklyBest,
                  )
                : undefined
            }
          />
        )}
      />
      <BottomNav active="rating" />
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
    gap: 10,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  goalCard: {
    padding: 18,
    borderRadius: 28,
    gap: 12,
    borderBottomWidth: 6,
    borderBottomColor: n.sunEdge,
  },
  prize: {
    backgroundColor: n.night850,
    padding: 16,
    borderRadius: 24,
    gap: 12,
  },
});
