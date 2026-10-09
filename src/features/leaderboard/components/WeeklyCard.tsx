import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, ChevronIcon, ClayCard, CrownIcon, colors, radii, spacing } from '@/ui';

import { useLeaderboardStore } from '../store';
import {
  resolveWeeklyView,
  selectPreviousWeeklyBest,
  weeklyStatusLabel,
} from '../presentation';
import { getWeeklyGoal } from '../week';
import { currentWeeklyGoal, useWeeklyGoalStore } from '../weeklyGoalStore';
import { useWeeklyGoalWeekKey } from '../useWeeklyGoalWeekKey';

interface WeeklyCardProps {
  onPress: () => void;
}

export function WeeklyCard({ onPress }: WeeklyCardProps) {
  const lang = useLang();
  const snapshot = useLeaderboardStore((state) => state.snapshot);
  const viewState = useLeaderboardStore((state) => state.viewState);
  const localWeekly = useLeaderboardStore((state) => state.localWeeklyResult);
  const goalRecords = useWeeklyGoalStore((state) => state.goals);
  const currentWeekKey = useWeeklyGoalWeekKey();
  const goalNow = new Date();

  // Единый источник истины с экраном рейтинга: и рекорд, и место берём из одного
  // селектора (max(сервер, локальный текущей недели) + провизорное место до синка),
  // поэтому карточка и экран никогда не расходятся.
  const view = resolveWeeklyView(snapshot, localWeekly, null, goalNow);
  const weeklyBest = view.effectiveBest;
  const previousWeeklyBest = selectPreviousWeeklyBest(snapshot, localWeekly, goalNow);

  const assignedGoal = currentWeeklyGoal(
    goalRecords,
    goalNow,
    weeklyBest,
    previousWeeklyBest,
  );
  const goal = getWeeklyGoal(
    Math.max(weeklyBest, assignedGoal.progress),
    assignedGoal.target,
  );
  const progressPercent =
    goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;

  const rank = view.rank;
  const rankLabel = rank != null ? `#${rank}` : t('leaderboard.unranked', lang);
  const overtaken = useLeaderboardStore((state) => state.overtaken);

  useEffect(() => {
    const source = snapshot?.isCached ? 'cached' : 'home_card';
    const synced = useWeeklyGoalStore.getState().sync(
      new Date(),
      weeklyBest,
      source,
      previousWeeklyBest,
    );
    useWeeklyGoalStore.getState().expose(
      synced,
      source,
    );
  }, [currentWeekKey, previousWeeklyBest, snapshot?.isCached, weeklyBest]);

  const statusLabel = weeklyStatusLabel(viewState, snapshot?.source, lang);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('leaderboard.title', lang)}
      style={{ width: '100%' }}
    >
      <ClayCard style={{ gap: spacing.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radii.button,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CrownIcon size={18} color={colors.bgBottom} />
          </View>

          <View style={{ flex: 1 }}>
            <AppText preset="caption" style={{ color: colors.textDim }} numberOfLines={1}>
              {t('leaderboard.weeklyBest', lang)}
              {statusLabel ? ` · ${statusLabel}` : ''}
            </AppText>
            <AppText preset="title" style={{ fontSize: 20 }} numberOfLines={1}>
              {weeklyBest}
            </AppText>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <AppText preset="caption" style={{ color: colors.accent }} numberOfLines={1}>
              {rankLabel}
            </AppText>
            <ChevronIcon size={16} color={colors.accent} />
          </View>
        </View>

        <View
          style={{ height: 8, borderRadius: 999, backgroundColor: colors.track, overflow: 'hidden' }}
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

        <AppText preset="caption" style={{ color: colors.textDim }} numberOfLines={1}>
          {goal.complete
            ? `${goal.current}/${goal.target}`
            : `${goal.current}/${goal.target} · ${goal.remaining}`}
        </AppText>

        {overtaken ? (
          <AppText preset="caption" style={{ color: colors.accent }} numberOfLines={1}>
            {overtaken.by
              ? `⚡ ${t('leaderboard.overtakenBy', lang)} ${overtaken.by} — ${t('leaderboard.fightBack', lang)}`
              : `⚡ ${t('leaderboard.overtaken', lang)} #${overtaken.from} → #${overtaken.to} — ${t('leaderboard.fightBack', lang)}`}
          </AppText>
        ) : null}
      </ClayCard>
    </Pressable>
  );
}
