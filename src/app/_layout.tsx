import {
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/unbounded';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Unbounded_700Bold, Unbounded_800ExtraBold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient colors={[colors.bgTop, colors.bgBottom]} style={{ flex: 1 }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
          }}
        />
      </LinearGradient>
    </GestureHandlerRootView>
  );
}
