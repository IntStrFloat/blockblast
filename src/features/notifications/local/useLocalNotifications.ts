import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import {
  recordNotificationAttribution,
  useAnalyticsStore,
} from '@/features/analytics';
import { useAdventure } from '@/features/adventure/store';
import { getSavedAdventureSummary, getSavedGameSummary } from '@/features/game/store';
// Store-to-store импорты (индексы этих фич тянут компонентные графы): хук живёт
// в notifications/index, который импортируется из game-компонентов.
import { useLeaderboardStore } from '@/features/leaderboard/store';
import { getUtcWeekWindow } from '@/features/leaderboard/week';
import { useLang } from '@/features/settings';
import { canUseProtector, todayISO, useStreak } from '@/features/streak';

import type { Lang } from '@/core/i18n';

import { planLocalNotifications } from './planner';
import {
  applyLocalNotificationPlan,
  getLocalNotificationPermissionStatus,
  initLocalNotifications,
} from './scheduler';
import {
  getManagedLocalNotificationResponse,
  type ManagedLocalNotificationResponse,
} from './response';
import { getInitialSessionIntent } from '../startupIntent';
import { resolveNotificationTargetRoute } from '../routing';
import { recordObservedPushPermissionStatus } from '../softAsk';

/** Собрать вход планировщика из сторов (вне drag-пути, вызывается при уходе в фон). */
async function replan(lang: Lang): Promise<void> {
  const permissionStatus = await getLocalNotificationPermissionStatus();
  const observed = recordObservedPushPermissionStatus(permissionStatus);
  if (observed.unsubscribed) {
    useAnalyticsStore.getState().track('notification_unsubscribed', { source: 'system' });
  }
  const now = new Date();
  const streak = useStreak.getState();
  const todayIso = todayISO();
  const isMonday = now.getDay() === 1;

  const lb = useLeaderboardStore.getState();
  const currentWeek = getUtcWeekWindow(now);
  const previousWeek = getUtcWeekWindow(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const snapshotThisWeek = lb.snapshot?.weekKey === currentWeek.weekKey ? lb.snapshot : null;
  const snapshotPreviousWeek = lb.snapshot?.weekKey === previousWeek.weekKey ? lb.snapshot : null;
  const tournamentPlayedThisWeek =
    lb.localWeeklyResult?.weekKey === currentWeek.weekKey ||
    (snapshotThisWeek?.currentPlayer.rank ?? null) !== null;
  const prizePlayedTargetWeek = isMonday
    ? lb.localWeeklyResult?.weekKey === previousWeek.weekKey ||
      (snapshotPreviousWeek?.currentPlayer.rank ?? null) !== null ||
      (lb.weeklyPrizes?.some(
        (prize) =>
          prize.origin === 'server' &&
          prize.weekKey === previousWeek.weekKey &&
          !prize.claimed,
      ) ?? false)
    : tournamentPlayedThisWeek;
  const adventureSave = getSavedAdventureSummary();
  const classicSave = getSavedGameSummary();
  const savedRun = adventureSave.kind === 'active'
    ? { mode: 'adventure' as const }
    : classicSave.canContinue
      ? { mode: 'classic' as const }
      : null;
  const adventureThemeWindowEndIso =
    useAdventure.getState().seasonWindow?.windowEndIso ?? null;

  const plan = planLocalNotifications(
    {
      todayIso,
      streak: { lastDay: streak.lastDay, count: streak.count },
      protectorAvailable: canUseProtector(streak, todayIso),
      tournamentPlayedThisWeek,
      tournamentCurrentRank: snapshotThisWeek?.currentPlayer.rank ?? null,
      prizePlayedTargetWeek,
      savedRun,
      adventureThemeWindowEndIso,
    },
    now,
  );

  const { scheduledKinds } = await applyLocalNotificationPlan(plan, lang);
  for (const kind of scheduledKinds) {
    useAnalyticsStore.getState().track('notification_scheduled', { kind });
  }
}

export function shouldReplanOnAppStateChange(
  previousState: AppStateStatus,
  nextState: AppStateStatus,
): boolean {
  if (previousState === nextState) return false;
  if (nextState === 'active') return true;
  return previousState === 'active' && (nextState === 'inactive' || nextState === 'background');
}

/**
 * Локальные уведомления (retention фаза 4): канал/инициализация, пересборка
 * плана при уходе приложения в фон, роутинг тапа + событие notification_opened.
 * Монтируется один раз в корневом layout.
 */
export function useLocalNotifications(navigationReady = true) {
  const router = useRouter();
  const lang = useLang();
  const handledResponseKeysRef = useRef<Set<string>>(new Set());
  const navigationReadyRef = useRef(navigationReady);
  const pendingRouteRef = useRef<string | null>(null);

  useEffect(() => {
    navigationReadyRef.current = navigationReady;
    if (!navigationReady) return;
    const pendingRoute = pendingRouteRef.current;
    pendingRouteRef.current = null;
    if (pendingRoute) router.navigate(pendingRoute as never);
  }, [navigationReady, router]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let active = true;
    void (async () => {
      await initLocalNotifications();
      if (active) await replan(lang);
    })();

    const handleNotificationResponse = async (
      managed: ManagedLocalNotificationResponse,
      clearLastResponse: boolean,
    ): Promise<void> => {
      if (clearLastResponse) {
        try {
          await Notifications.clearLastNotificationResponseAsync();
        } catch {
          // Avoid dropping the tap if clearing the retained response fails.
        }
      }
      if (handledResponseKeysRef.current.has(managed.responseKey)) {
        return;
      }
      handledResponseKeysRef.current.add(managed.responseKey);
      const resolvedRoute = resolveNotificationTargetRoute(managed.route, {
        classicCanContinue: getSavedGameSummary().canContinue,
        adventureKind: getSavedAdventureSummary().kind,
      });
      recordNotificationAttribution({
        attributionId: managed.responseKey,
        kind: managed.kind,
        route: resolvedRoute,
      });
      useAnalyticsStore.getState().track('notification_opened', {
        kind: managed.kind,
        origin: 'local',
        attribution_id: managed.responseKey,
        route: resolvedRoute,
      });
      if (navigationReadyRef.current) {
        router.navigate(resolvedRoute as never);
      } else {
        pendingRouteRef.current = resolvedRoute;
      }
    };

    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const managed = getManagedLocalNotificationResponse(event);
      if (managed) void handleNotificationResponse(managed, false);
    });

    void (async () => {
      try {
        const intent = await getInitialSessionIntent();
        if (!active || !intent.localTap) return;
        await handleNotificationResponse(intent.localTap, true);
      } catch {
        // Cold-start notification replay is best-effort; mount must continue without it.
      }
    })();

    let currentState: AppStateStatus = AppState.currentState;
    const appState = AppState.addEventListener('change', (state) => {
      const previousState = currentState;
      currentState = state;
      if (shouldReplanOnAppStateChange(previousState, state)) {
        void replan(lang);
      }
    });

    return () => {
      active = false;
      response.remove();
      appState.remove();
    };
  }, [router, lang]);
}

export { getManagedLocalNotificationResponse } from './response';
