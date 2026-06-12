import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { getSavedScore, useGameStore } from '@/features/game';
import { useScores } from '@/features/scores';
import { useLang, useSettings } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
import { AppText, GameButton, colors, getBlockTheme, radii, spacing } from '@/ui';

const LOGO_ROWS = ['BLOCK', 'BLAST'];

/** Лого из цветных блоков, стаггер-появление один раз (спека 01). */
function Logo() {
  const themeId = useSettings((s) => s.themeId);
  const palette = getBlockTheme(themeId).cellColors;
  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      {LOGO_ROWS.map((row, rowIdx) => (
        <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
          {[...row].map((ch, i) => (
            <Animated.View
              key={`${rowIdx}-${i}`}
              entering={FadeInDown.delay((rowIdx * row.length + i) * 55)
                .springify()
                .damping(14)}
              style={{
                width: 46,
                height: 46,
                borderRadius: radii.cell + 4,
                backgroundColor: palette[(rowIdx * 2 + i) % palette.length],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText preset="title" style={{ fontSize: 24, color: '#10203F' }}>
                {ch}
              </AppText>
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const lang = useLang();
  const best = useScores((s) => s.best);
  const streakLastDay = useStreak((s) => s.lastDay);
  const streakCount = useStreak((s) => s.count);
  const streakVisible = isStreakAlive({ lastDay: streakLastDay, count: streakCount }, todayISO())
    ? streakCount
    : 0;

  const [savedScore, setSavedScore] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      setSavedScore(getSavedScore());
    }, []),
  );

  const startNew = useCallback(() => {
    useGameStore.getState().newGame();
    router.push('/game');
  }, [router]);

  const confirmNew = useCallback(() => {
    Alert.alert(t('home.newGame', lang), t('home.newGameConfirm', lang), [
      { text: t('settings.cancel', lang), style: 'cancel' },
      { text: t('home.newGame', lang), style: 'destructive', onPress: startNew },
    ]);
  }, [lang, startNew]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      {/* Настройки */}
      <Pressable
        onPress={() => router.push('/settings')}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: 56,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <AppText preset="body">⚙️</AppText>
      </Pressable>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.l,
          gap: spacing.xl,
        }}
      >
        <Logo />

        {/* Рекорд + стрик */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          <AppText preset="body" style={{ color: colors.accent }}>
            👑 {t('home.best', lang)}: {best}
          </AppText>
          {streakVisible >= 1 ? (
            <AppText preset="caption">
              🔥 {streakVisible} {t('home.streakDays', lang)}
            </AppText>
          ) : null}
        </View>

        {/* Кнопки */}
        <View style={{ width: '100%', maxWidth: 320, gap: spacing.m }}>
          {savedScore !== null ? (
            <>
              <GameButton
                label={`${t('home.continue', lang)} · ${savedScore}`}
                onPress={() => router.push('/game')}
              />
              <GameButton
                label={t('home.newGame', lang)}
                variant="ghost"
                onPress={confirmNew}
              />
            </>
          ) : (
            <GameButton label={t('home.play', lang)} onPress={startNew} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
