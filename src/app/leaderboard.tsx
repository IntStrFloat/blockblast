import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  LeaderboardRow,
  Podium,
  getUtcWeekCountdown,
  getWeeklyGoal,
  prizeForRank,
  resolveWeeklyView,
  selectMyChampionRank,
  unclaimedPrize,
  useLeaderboardStore,
  weeklyStatusLabel,
} from '@/features/leaderboard';
import { useMascot } from '@/features/mascot';
import { useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import {
  AppText,
  ChevronIcon,
  ClayCard,
  CrownIcon,
  GameButton,
  IconButton,
  TrophyIcon,
  colors,
  radii,
  spacing,
} from '@/ui';

function formatCountdown() {
  const countdown = getUtcWeekCountdown(new Date());
  const parts = [
    countdown.days > 0 ? `${countdown.days}d` : null,
    `${String(countdown.hours).padStart(2, '0')}h`,
    `${String(countdown.minutes).padStart(2, '0')}m`,
  ].filter(Boolean);
  return parts.join(' ');
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const lang = useLang();
  const snapshot = useLeaderboardStore((state) => state.snapshot);
  const viewState = useLeaderboardStore((state) => state.viewState);
  const lastError = useLeaderboardStore((state) => state.lastError);
  const localWeekly = useLeaderboardStore((state) => state.localWeeklyResult);
  const weeklyPrizes = useLeaderboardStore((state) => state.weeklyPrizes);
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
      };
    }, []),
  );

  const statusLabel = weeklyStatusLabel(viewState, snapshot?.source, lang);
  const myChampionRank = selectMyChampionRank(weeklyPrizes);
  const pendingPrize = unclaimedPrize(weeklyPrizes);

  // Единый источник истины: рекорд, место и строки списка — из одного селектора,
  // поэтому показанный рекорд всегда соответствует строке игрока в таблице.
  const view = resolveWeeklyView(snapshot, localWeekly, myChampionRank, new Date());
  const weeklyBest = view.effectiveBest;

  const goal = getWeeklyGoal(weeklyBest);
  const progressPercent =
    goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;

  const rank = view.rank;
  const rankLabel = rank != null ? `#${rank}` : t('leaderboard.unranked', lang);

  const currentEntry = view.currentEntry;
  const entries = view.entries;
  const podium = entries.slice(0, 3);
  const listData = entries.slice(3);
  // Закреплённая строка нужна, только если игрок не попал в отрисованный список.
  const showPinnedCurrent =
    Boolean(currentEntry) && !entries.some((entry) => entry.isCurrentPlayer);

  const claimPrize = useCallback(() => {
    if (!pendingPrize) return;
    const record = useLeaderboardStore.getState().claimWeeklyPrize(pendingPrize.weekKey);
    if (!record) return;
    useProgression.getState().addPoints(record.prize.points);
    useMascot.getState().unlock(record.prize.cosmeticId);
  }, [pendingPrize]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <FlatList
        data={listData}
        keyExtractor={(entry) => `${entry.tag}-${entry.rank ?? 'self'}`}
        contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.s }} />}
        onRefresh={runRefresh}
        refreshing={loading}
        ListHeaderComponent={
          <View style={{ gap: spacing.m, paddingBottom: spacing.xs }}>
            {/* Заголовок + обратный отсчёт */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
              <IconButton
                onPress={() => router.back()}
                accessibilityLabel={t('leaderboard.back', lang)}
                size={44}
              >
                <ChevronIcon size={22} direction="left" />
              </IconButton>
              <View style={{ flex: 1 }}>
                <AppText preset="title" style={{ fontSize: 22 }}>
                  {t('leaderboard.title', lang)}
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: spacing.s,
                  paddingVertical: 6,
                  borderRadius: radii.button,
                  backgroundColor: colors.cardSolid,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                }}
              >
                <TrophyIcon size={14} color={colors.accent} />
                <AppText preset="caption" style={{ color: colors.textDim }}>
                  {formatCountdown()}
                </AppText>
              </View>
            </View>

            {/* Герой: твой недельный рекорд */}
            <ClayCard accent={colors.accent} style={{ gap: spacing.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.button,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CrownIcon size={22} color="#10203F" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText preset="caption" style={{ color: colors.textDim }} numberOfLines={1}>
                    {t('leaderboard.weeklyBest', lang)}
                    {statusLabel ? ` · ${statusLabel}` : ''}
                  </AppText>
                  <AppText preset="title" style={{ fontSize: 28 }} numberOfLines={1}>
                    {weeklyBest}
                  </AppText>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing.s,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.track,
                  }}
                >
                  <AppText preset="button" style={{ color: colors.accent, fontSize: 14 }}>
                    {rankLabel}
                  </AppText>
                </View>
              </View>
              <View
                style={{
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: colors.track,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.max(progressPercent, 2)}%` as `${number}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
            </ClayCard>

            {/* Баннер забора недельной награды (claim) */}
            {pendingPrize ? (
              <ClayCard accent={colors.accent} style={{ gap: spacing.s }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
                  <CrownIcon size={22} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <AppText preset="button">{t('leaderboard.prizeReady', lang)}</AppText>
                    <AppText preset="caption" style={{ color: colors.textDim }}>
                      {t('leaderboard.prizePlace', lang)} #{pendingPrize.rank} · +
                      {pendingPrize.prize.points} {t('leaderboard.prizePoints', lang)} ·{' '}
                      {t('leaderboard.prizeCosmetic', lang)}
                    </AppText>
                  </View>
                </View>
                <GameButton label={t('leaderboard.claim', lang)} size="md" onPress={claimPrize} />
              </ClayCard>
            ) : null}

            {/* Состояния загрузки / пусто / ошибка */}
            {viewState === 'loading' && podium.length === 0 ? (
              <ClayCard>
                <AppText preset="body" style={{ color: colors.textDim }}>
                  {t('leaderboard.loading', lang)}
                </AppText>
              </ClayCard>
            ) : viewState === 'empty' ? (
              <ClayCard>
                <AppText preset="body" style={{ color: colors.textDim }}>
                  {t('leaderboard.empty', lang)}
                </AppText>
              </ClayCard>
            ) : lastError && podium.length === 0 ? (
              <ClayCard>
                <AppText preset="body" style={{ color: colors.textDim }}>
                  {t('leaderboard.error', lang)}
                </AppText>
              </ClayCard>
            ) : null}

            {podium.length > 0 ? <Podium entries={podium} /> : null}
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: spacing.m, paddingBottom: spacing.l }}>
            {showPinnedCurrent && currentEntry ? (
              <View style={{ gap: spacing.xs }}>
                <AppText preset="caption" style={{ color: colors.textDim }}>
                  {t('leaderboard.currentPlayer', lang)}
                </AppText>
                <LeaderboardRow entry={currentEntry} />
              </View>
            ) : null}

            {viewState === 'error' || viewState === 'cached' || viewState === 'empty' ? (
              <GameButton
                label={t('leaderboard.retry', lang)}
                variant="ghost"
                size="md"
                onPress={() => {
                  void runRefresh();
                }}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => <LeaderboardRow entry={item} />}
      />
    </SafeAreaView>
  );
}
