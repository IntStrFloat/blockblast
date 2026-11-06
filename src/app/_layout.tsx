import { CandySplash } from '@/ui/primitives/CandySplash';
import { Fredoka_500Medium, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import {
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
  Unbounded_900Black,
  useFonts,
} from '@expo-google-fonts/unbounded';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { getLocales } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, Linking, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  recordNotificationAttribution,
  useAnalyticsStore,
  clearActiveProductSession,
  pauseProductSession,
  resolveProductSession,
  type AnalyticsEntrySource,
} from '@/features/analytics';
import {
  getSavedAdventureSummary,
  getSavedGameSummary,
  useGameStore,
} from '@/features/game';
import { getAds, initializeInterstitialExperiment } from '@/features/monetization';
import { recoverAdventureXpBonuses } from '@/features/monetization/adventureXpBonus';
import { recoverRewardedBenefits } from '@/features/monetization/rewardedBenefits';
import {
  getManagedLocalNotificationResponse,
  getInitialSessionIntent,
  getPush,
  createRemoteTapDedupeState,
  shouldHandleRemoteTap,
  resolveNotificationTargetRoute,
  useLocalNotifications,
  type PushNotificationTap,
} from '@/features/notifications';
import { useWelcomePromptStore } from '@/features/onboarding';
import { useScores } from '@/features/scores';
import { colors } from '@/ui';
import { appNavigationTheme } from '@/ui/navigationTheme';

// The custom screen already owns the transition. Android's default 400ms native
// fade would leave a second Capy floating over it at a different position.
SplashScreen.setOptions({ duration: 0 });
SplashScreen.preventAutoHideAsync().catch(() => {});

// Cold start always waits for the shared intent promise. This tiny warm-start window lets
// native tap/url events that accompany the foreground transition win over an ordinary open.
const WARM_ENTRY_SETTLE_MS = 50;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    Unbounded_900Black,
    Nunito_700Bold: require('../../assets/fonts/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('../../assets/fonts/Nunito_800ExtraBold.ttf'),
    Nunito_900Black: require('../../assets/fonts/Nunito_900Black.ttf'),
    // Голос Капи (округлый, тёплый) — отделён от системного UI (Unbounded), спека 09.
    // Fredoka_700Bold — крупный «сочный» леттеринг похвал/комбо (как в оригинале).
    Fredoka_500Medium,
    Fredoka_700Bold,
  });
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);
  const welcomePromptResolved = useWelcomePromptStore((state) => state.resolved);
  const analyticsOptOut = useAnalyticsStore((state) => state.optOut);
  const appStateRef = useRef(AppState.currentState);
  const initialIntentResolvedRef = useRef(false);
  const pendingEntrySourceRef = useRef<AnalyticsEntrySource>('unknown');
  const pendingRemoteTapRef = useRef<PushNotificationTap | null>(null);
  const foregroundStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTapDedupeRef = useRef(createRemoteTapDedupeState());
  const navigationReadyRef = useRef(fontsLoaded);
  const pendingNotificationRouteRef = useRef<string | null>(null);

  const startAnalyticsSession = useCallback((entrySource: AnalyticsEntrySource) => {
    const analytics = useAnalyticsStore.getState();
    const appVersion = Constants.expoConfig?.version ?? 'unknown';
    const resolution = resolveProductSession({
      now: Date.now(),
      appVersion,
      buildNumber: String(Constants.expoConfig?.android?.versionCode ?? 'unknown'),
      platform: Platform.OS,
      locale: getLocales()[0]?.languageTag ?? 'unknown',
      deviceClass:
        Platform.OS === 'web'
          ? 'desktop'
          : Dimensions.get('window').width >= 600
            ? 'tablet'
            : 'phone',
      lifetimeGames: useScores.getState().gamesPlayed,
      entrySource,
      idFactory: () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    });
    if (resolution.kind === 'started' && resolution.previous) {
      analytics.initialize(resolution.previous.context);
      analytics.exitRun(resolution.previous.reason);
      analytics.track('session_ended', { reason: resolution.previous.reason });
      analytics.endSession();
      clearActiveProductSession();
    }
    analytics.initialize(resolution.context);
    useGameStore.getState().recoverHelperRescues();
    recoverAdventureXpBonuses();
    recoverRewardedBenefits();
    initializeInterstitialExperiment(resolution.context);
    if (resolution.kind === 'resumed') {
      if (analytics.activeRun && !analytics.activeRun.terminal_reported) {
        analytics.resumeRun(analytics.activeRun.mode, 'saved');
        if (analytics.activeRun.mode === 'classic') {
          useGameStore.getState().resumeClassicActivity();
        }
      }
      analytics.track('session_resumed', { paused_duration_ms: resolution.pausedDurationMs });
    } else {
      analytics.track('session_started', {});
    }
  }, []);

  const recordRemoteNotificationOpen = useCallback(
    (tap: PushNotificationTap) => {
      if (!shouldHandleRemoteTap(tap, remoteTapDedupeRef.current)) return;
      const resolvedRoute = resolveNotificationTargetRoute(tap.route, {
        classicCanContinue: getSavedGameSummary().canContinue,
        adventureKind: getSavedAdventureSummary().kind,
      });
      const attributionId = tap.id ?? ('remote:' + tap.kind + ':' + resolvedRoute);
      recordNotificationAttribution({
        attributionId,
        kind: tap.kind,
        route: resolvedRoute,
      });
      useAnalyticsStore.getState().track('notification_opened', {
        kind: tap.kind,
        origin: 'remote',
        attribution_id: attributionId,
        route: resolvedRoute,
      });
      if (navigationReadyRef.current) {
        router.navigate(resolvedRoute as never);
      } else {
        pendingNotificationRouteRef.current = resolvedRoute;
      }
    },
    [router],
  );

  const beginPendingSession = useCallback(() => {
    if (!initialIntentResolvedRef.current) return;
    if (
      useAnalyticsStore.getState().context &&
      pendingEntrySourceRef.current === 'unknown'
    ) return;
    const source =
      pendingEntrySourceRef.current === 'unknown' ? 'organic' : pendingEntrySourceRef.current;
    startAnalyticsSession(source);
    const remoteTap = pendingRemoteTapRef.current;
    pendingRemoteTapRef.current = null;
    if (remoteTap) recordRemoteNotificationOpen(remoteTap);
  }, [recordRemoteNotificationOpen, startAnalyticsSession]);

  const schedulePendingSession = useCallback(() => {
    if (foregroundStartTimerRef.current) clearTimeout(foregroundStartTimerRef.current);
    foregroundStartTimerRef.current = setTimeout(() => {
      foregroundStartTimerRef.current = null;
      beginPendingSession();
    }, WARM_ENTRY_SETTLE_MS);
  }, [beginPendingSession]);

  const markPendingEntrySource = useCallback((source: AnalyticsEntrySource) => {
    if (AppState.currentState === 'active' && useAnalyticsStore.getState().context) return;
    const priority: Record<AnalyticsEntrySource, number> = {
      unknown: 0,
      organic: 1,
      deeplink: 2,
      notification: 3,
    };
    if (priority[source] > priority[pendingEntrySourceRef.current]) {
      pendingEntrySourceRef.current = source;
    }
  }, []);

  useEffect(() => {
    navigationReadyRef.current = fontsLoaded;
    if (!fontsLoaded) return;
    const pendingRoute = pendingNotificationRouteRef.current;
    pendingNotificationRouteRef.current = null;
    if (pendingRoute) router.navigate(pendingRoute as never);
  }, [fontsLoaded, router]);

  useEffect(() => {
    let active = true;
    const push = getPush();

    const pushTapSubscription = push.onNotificationTap((tap) => {
      if (AppState.currentState !== 'active' || !useAnalyticsStore.getState().context) {
        markPendingEntrySource('notification');
        pendingRemoteTapRef.current = tap;
        return;
      }
      recordRemoteNotificationOpen(tap);
    });
    const localTapSubscription = Notifications.addNotificationResponseReceivedListener((event) => {
      if (getManagedLocalNotificationResponse(event)) markPendingEntrySource('notification');
    });
    const linkSubscription = Linking.addEventListener('url', () => {
      markPendingEntrySource('deeplink');
    });

    void getInitialSessionIntent().then((intent) => {
      if (!active) return;
      markPendingEntrySource(intent.source);
      if (intent.remoteTap) pendingRemoteTapRef.current = intent.remoteTap;
      initialIntentResolvedRef.current = true;
      if (AppState.currentState === 'active') schedulePendingSession();
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active') {
        if (previousState === 'active') {
          if (foregroundStartTimerRef.current) {
            clearTimeout(foregroundStartTimerRef.current);
            foregroundStartTimerRef.current = null;
          }
          const analytics = useAnalyticsStore.getState();
          useGameStore.getState().pauseClassicActivity();
          analytics.pauseRun();
          analytics.flush();
          pauseProductSession(Date.now());
          pendingEntrySourceRef.current = 'organic';
          pendingRemoteTapRef.current = null;
        }
        return;
      }
      if (previousState !== 'active') schedulePendingSession();
    });

    return () => {
      active = false;
      if (foregroundStartTimerRef.current) clearTimeout(foregroundStartTimerRef.current);
      pushTapSubscription();
      localTapSubscription.remove();
      linkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [
    beginPendingSession,
    markPendingEntrySource,
    recordRemoteNotificationOpen,
    schedulePendingSession,
  ]);

  useEffect(() => {
    if (analyticsOptOut || !initialIntentResolvedRef.current) return;
    if (!useAnalyticsStore.getState().context && AppState.currentState === 'active') {
      schedulePendingSession();
    }
  }, [analyticsOptOut, schedulePendingSession]);

  useEffect(() => {
    void getAds().init();
  }, []);

  useEffect(() => {
    if (!welcomePromptResolved) return;
    const push = getPush();
    void push.init();
  }, [welcomePromptResolved]);

  // Локальные напоминания (retention фаза 4): план пересобирается при уходе в фон.
  useLocalNotifications(fontsLoaded);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView onLayout={() => { void SplashScreen.hideAsync().catch(() => {}); }} style={{ flex: 1, backgroundColor: colors.bgBottom }}>
      <LinearGradient
        colors={[colors.bgTop, colors.bgBottom]}
        style={{ flex: 1, backgroundColor: colors.bgBottom }}
      >
        <StatusBar style="light" />
        <ThemeProvider value={appNavigationTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="game" options={{ gestureEnabled: false }} />
          </Stack>
          {showSplash ? <CandySplash onDone={finishSplash} /> : null}
        </ThemeProvider>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}
