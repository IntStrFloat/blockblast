import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  LeaderboardRow,
  Podium,
  getUtcWeekCountdown,
  getVisibleWeeklyBest,
  useLeaderboardStore,
  weeklyStatusLabel,
} from '@/features/leaderboard';
import { useLang } from '@/features/settings';
import { AppText, colors, radii, spacing } from '@/ui';

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
  const localWeeklyResult = useLeaderboardStore((state) => state.localWeeklyResult);
  const viewState = useLeaderboardStore((state) => state.viewState);
  const lastError = useLeaderboardStore((state) => state.lastError);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    useAnalyticsStore.getState().track('leaderboard_opened', { source: 'screen' });
    void useLeaderboardStore
      .getState()
      .refresh(new Date())
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(refresh);

  const entries = snapshot?.entries ?? [];
  const podium = entries.slice(0, 3);
  const listData = entries.slice(3);
  const showPinnedCurrent =
    Boolean(snapshot?.currentPlayer) &&
    !entries.some((entry) => entry.tag === snapshot?.currentPlayer.tag) &&
    snapshot?.currentPlayer.rank !== null;
  const statusLabel = weeklyStatusLabel(viewState, snapshot?.source, lang);
  const visibleWeeklyBest = getVisibleWeeklyBest(
    snapshot?.currentPlayer.weeklyBest ?? 0,
    localWeeklyResult,
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <FlatList
        data={listData}
        keyExtractor={(entry) => `${entry.tag}-${entry.rank ?? 'self'}`}
        contentContainerStyle={{ padding: spacing.l, gap: spacing.m }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.s }} />}
        onRefresh={() => {
          setLoading(true);
          void useLeaderboardStore
            .getState()
            .refresh(new Date())
            .finally(() => setLoading(false));
        }}
        refreshing={loading}
        ListHeaderComponent={
          <View style={{ gap: spacing.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <AppText preset="title">{'<'}</AppText>
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppText preset="title">{t('leaderboard.title', lang)}</AppText>
                <AppText preset="caption">
                  {t('leaderboard.resetsIn', lang)} {formatCountdown()}
                </AppText>
              </View>
            </View>

            <View
              style={{
                borderRadius: radii.card,
                backgroundColor: colors.surface,
                padding: spacing.m,
                gap: spacing.s,
              }}
            >
              {statusLabel ? <AppText preset="caption">{statusLabel}</AppText> : null}
              {viewState === 'loading' ? (
                <AppText preset="body">{t('leaderboard.loading', lang)}</AppText>
              ) : viewState === 'empty' ? (
                <AppText preset="body">{t('leaderboard.empty', lang)}</AppText>
              ) : viewState === 'cached' ? (
                <AppText preset="body">{t('leaderboard.cachedBody', lang)}</AppText>
              ) : lastError ? (
                <AppText preset="body">{t('leaderboard.error', lang)}</AppText>
              ) : (
                <AppText preset="body">
                  {t('leaderboard.weeklyBest', lang)}: {visibleWeeklyBest}
                </AppText>
              )}
            </View>

            {podium.length > 0 ? <Podium entries={podium} /> : null}
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: spacing.m, paddingBottom: spacing.l }}>
            {showPinnedCurrent && snapshot ? (
              <View
                style={{
                  borderRadius: radii.card,
                  backgroundColor: 'rgba(255,201,60,0.14)',
                  padding: spacing.m,
                  gap: spacing.s,
                }}
              >
                <AppText preset="caption">{t('leaderboard.currentPlayer', lang)}</AppText>
                <LeaderboardRow entry={snapshot.currentPlayer} />
              </View>
            ) : null}

            {(viewState === 'error' || viewState === 'cached' || viewState === 'empty') ? (
              <Pressable
                onPress={() => {
                  setLoading(true);
                  void useLeaderboardStore.getState().refresh(new Date()).finally(() => setLoading(false));
                }}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: radii.button,
                  backgroundColor: colors.surface,
                }}
              >
                <AppText preset="caption">{t('leaderboard.retry', lang)}</AppText>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <LeaderboardRow entry={item} />}
      />
    </SafeAreaView>
  );
}
