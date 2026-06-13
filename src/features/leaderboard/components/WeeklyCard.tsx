import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useLang } from '@/features/settings';
import { AppText, colors, radii, spacing } from '@/ui';

import { useLeaderboardStore } from '../store';
import { getWeeklyGoal } from '../week';

interface WeeklyCardProps {
  onPress: () => void;
}

export function WeeklyCard({ onPress }: WeeklyCardProps) {
  const lang = useLang();
  const snapshot = useLeaderboardStore((state) => state.snapshot);
  const viewState = useLeaderboardStore((state) => state.viewState);
  const weeklyBest = snapshot?.currentPlayer.weeklyBest ?? 0;
  const goal = getWeeklyGoal(weeklyBest);
  const goalCurrent = goal.current;
  const goalTarget = goal.target;
  const progressPercent =
    goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;

  useEffect(() => {
    useAnalyticsStore.getState().track('weekly_goal_exposed', {
      source: snapshot?.isCached ? 'cached' : 'home_card',
    });
    if (goalCurrent >= goalTarget) {
      useAnalyticsStore.getState().track('weekly_goal_completed', {
        source: snapshot?.isCached ? 'cached' : 'home_card',
      });
    }
  }, [goalCurrent, goalTarget, snapshot?.isCached]);

  const statusLabel =
    viewState === 'cached'
      ? t('leaderboard.cached', lang)
      : snapshot?.source === 'remote'
        ? t('leaderboard.live', lang)
        : t('leaderboard.offline', lang);

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '100%',
        maxWidth: 320,
        borderRadius: radii.card,
        backgroundColor: colors.surface,
        padding: spacing.m,
        gap: spacing.s,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText preset="caption">{t('leaderboard.weeklyTitle', lang)}</AppText>
        <AppText preset="caption">{statusLabel}</AppText>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <AppText preset="title">
          {snapshot?.currentPlayer.rank !== null && snapshot?.currentPlayer.rank !== undefined
            ? `#${snapshot.currentPlayer.rank}`
            : t('leaderboard.unranked', lang)}
        </AppText>
        <AppText preset="body">{t('leaderboard.tapToOpen', lang)}</AppText>
      </View>

      <AppText preset="body">
        {t('leaderboard.weeklyBest', lang)}: {weeklyBest}
      </AppText>

      <View style={{ gap: 6 }}>
        <AppText preset="caption">
          {t('leaderboard.weeklyGoal', lang)}: {goal.current}/{goal.target}
        </AppText>
        <View
          style={{
            height: 8,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progressPercent}%` as `${number}%`,
              height: '100%',
              borderRadius: 999,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </View>
    </Pressable>
  );
}
