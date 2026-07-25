import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import {
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/unbounded';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { getLocales } from 'expo-localization';
import { Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { KEYS, getJSON, setJSON } from '@/core/storage';
import { useAnalyticsStore, type AnalyticsCommonContext } from '@/features/analytics';
import { getAds } from '@/features/monetization';
import { getPush, useLocalNotifications } from '@/features/notifications';
import { useConsentStore } from '@/features/onboarding';
import { useScores } from '@/features/scores';
import { colors } from '@/ui';
import { appNavigationTheme } from '@/ui/navigationTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

let processSessionContext: AnalyticsCommonContext | null = null;

function getProcessSessionContext(): AnalyticsCommonContext {
  if (processSessionContext) return processSessionContext;
  const previous = getJSON<{ sessionIndex?: number }>(KEYS.analyticsSessionMeta);
  const sessionIndex = Math.max(0, previous?.sessionIndex ?? 0) + 1;
  setJSON(KEYS.analyticsSessionMeta, { sessionIndex });
  processSessionContext = {
    schema_version: 1,
    session_id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    session_index: sessionIndex,
    app_version: Constants.expoConfig?.version ?? 'unknown',
    build_number: String(Constants.expoConfig?.android?.versionCode ?? 'unknown'),
    platform: Platform.OS,
    locale: getLocales()[0]?.languageTag ?? 'unknown',
    games_played: useScores.getState().gamesPlayed,
    is_first_session: sessionIndex === 1,
    entry_source: 'unknown',
  };
  return processSessionContext;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
    // Голос Капи (округлый, тёплый) — отделён от системного UI (Unbounded), спека 09.
    // Fredoka_700Bold — крупный «сочный» леттеринг похвал/комбо (как в оригинале).
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const router = useRouter();
  const consentAccepted = useConsentStore((state) => state.accepted);
  const gamesPlayed = useScores((state) => state.gamesPlayed);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    const analytics = useAnalyticsStore.getState();
    analytics.initialize(getProcessSessionContext());
    analytics.track('session_started', {});
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') useAnalyticsStore.getState().flush();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void getAds().init();
  }, []);

  useEffect(() => {
    if (!consentAccepted || gamesPlayed < 2) return;
    const push = getPush();
    void push.init();
    const unsubscribe = push.onNotificationTap((route) => {
      router.navigate(route as never);
    });
    return unsubscribe;
  }, [consentAccepted, gamesPlayed, router]);

  // Локальные напоминания (retention фаза 4): план пересобирается при уходе в фон.
  useLocalNotifications();

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgBottom }}>
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
        </ThemeProvider>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}
