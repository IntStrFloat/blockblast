import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useAnalyticsStore } from '@/features/analytics';
// Store-to-store импорты (индексы этих фич тянут компонентные графы): хук живёт
// в notifications/index, который импортируется из game-компонентов.
import { useAdventure } from '@/features/adventure/store';
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { getUtcWeekWindow } from '@/features/leaderboard/week';
import { useLang } from '@/features/settings';
import { todayISO, useStreak } from '@/features/streak';

import type { Lang } from '@/core/i18n';

import { planLocalNotifications, type LocalNotificationKind } from './planner';
import { applyLocalNotificationPlan, initLocalNotifications } from './scheduler';

/** Собрать вход планировщика из сторов (вне drag-пути, вызывается при уходе в фон). */
function replan(lang: Lang): Promise<void> {
  const now = new Date();
  const streak = useStreak.getState();

  const lb = useLeaderboardStore.getState();
  const week = getUtcWeekWindow(now);
  const snapshotThisWeek = lb.snapshot?.weekKey === week.weekKey ? lb.snapshot : null;
  const playedThisWeek =
    lb.localWeeklyResult?.weekKey === week.weekKey ||
    (snapshotThisWeek?.currentPlayer.rank ?? null) !== null;

  const adventure = useAdventure.getState();

  const plan = planLocalNotifications(
    {
      todayIso: todayISO(),
      streak: { lastDay: streak.lastDay, count: streak.count },
      playedThisWeek,
      currentRank: snapshotThisWeek?.currentPlayer.rank ?? null,
      seasonEndIso: adventure.seasonWindow?.windowEndIso ?? null,
      seasonStarted: adventure.levelIndex > 0 || adventure.trophies.length > 0,
      seasonCompleted: false, // завершённый сезон сразу сменяется следующим
    },
    now,
  );

  for (const item of plan) {
    useAnalyticsStore.getState().track('notification_scheduled', { kind: item.kind });
  }
  return applyLocalNotificationPlan(plan, lang);
}

/**
 * Локальные уведомления (retention фаза 4): канал/инициализация, пересборка
 * плана при уходе приложения в фон, роутинг тапа + событие notification_opened.
 * Монтируется один раз в корневом layout.
 */
export function useLocalNotifications() {
  const router = useRouter();
  const lang = useLang();

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    void initLocalNotifications();

    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const data = event.notification.request.content.data as
        | { kind?: LocalNotificationKind; route?: string }
        | undefined;
      if (data?.kind) {
        useAnalyticsStore.getState().track('notification_opened', { kind: data.kind });
      }
      if (data?.route) {
        router.navigate(data.route as never);
      }
    });

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void replan(lang);
      }
    });

    return () => {
      response.remove();
      appState.remove();
    };
  }, [router, lang]);
}
