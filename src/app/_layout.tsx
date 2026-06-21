import {
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/unbounded';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getAds } from '@/features/monetization';
import { getPush, PushSoftAskSheet } from '@/features/notifications';
import { colors } from '@/ui';
import { appNavigationTheme } from '@/ui/navigationTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Unbounded_700Bold, Unbounded_800ExtraBold });
  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    void getAds().init();
  }, []);

  useEffect(() => {
    const push = getPush();
    void push.init();
    const unsubscribe = push.onNotificationTap((route) => {
      router.navigate(route as never);
    });
    return unsubscribe;
  }, [router]);

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
          />
        </ThemeProvider>
        <PushSoftAskSheet />
      </LinearGradient>
    </GestureHandlerRootView>
  );
}
