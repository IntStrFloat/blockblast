import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { getSavedGameSummary } from '@/features/game';
import type { SavedGameSummary } from '@/features/game';
import {
  WeeklyCard,
  createDailyChallenge,
  shouldShowDailyChallenge,
  useLeaderboardStore,
} from '@/features/leaderboard';
import { ProfileChip, ProfileOverlay, useProfileStore } from '@/features/profile';
import { useScores } from '@/features/scores';
import { useLang, useSettings } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
import { AppText, GameButton, colors, getBlockTheme, radii, spacing } from '@/ui';

const LOGO_ROWS = ['BLOCK', 'BLAST'];

function Logo() {
  const themeId = useSettings((s) => s.themeId);
  const palette = getBlockTheme(themeId).cellColors;
  return (
    <View style={{ gap: 8, alignItems: 'center' }}>
      {LOGO_ROWS.map((row, rowIdx) => (
        <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
          {[...row].map((ch, index) => (
            <Animated.View
              key={`${rowIdx}-${index}`}
              entering={FadeInDown.delay((rowIdx * row.length + index) * 55).springify().damping(14)}
              style={{
                width: 46,
                height: 46,
                borderRadius: radii.cell + 4,
                backgroundColor: palette[(rowIdx * 2 + index) % palette.length],
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
  const gamesPlayed = useScores((s) => s.gamesPlayed);
  const streakLastDay = useStreak((s) => s.lastDay);
  const streakCount = useStreak((s) => s.count);
  const streakVisible = isStreakAlive({ lastDay: streakLastDay, count: streakCount }, todayISO())
    ? streakCount
    : 0;
  const [savedGame, setSavedGame] = useState<SavedGameSummary>({
    kind: 'none',
    score: null,
    canContinue: false,
  });
  const [profileOpen, setProfileOpen] = useState(false);

  const dailyChallenge = createDailyChallenge(new Date().toISOString().slice(0, 10));
  const showDailyChallenge = shouldShowDailyChallenge(gamesPlayed);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSavedGame(getSavedGameSummary());

      void (async () => {
        const session = await useProfileStore.getState().bootstrapRemote();
        if (!active) return;
        await useLeaderboardStore.getState().issueTickets(session?.authToken);
        await useLeaderboardStore.getState().refreshIfStale(new Date(), 30_000);
      })();

      if (showDailyChallenge) {
        useAnalyticsStore.getState().track('daily_challenge_exposed', { source: 'home_card' });
      }

      return () => {
        active = false;
      };
    }, [showDailyChallenge]),
  );

  const startNew = useCallback(() => {
    router.push({ pathname: '/game', params: { entry: 'new' } });
  }, [router]);

  const confirmNew = useCallback(() => {
    Alert.alert(t('home.newGame', lang), t('home.newGameConfirm', lang), [
      { text: t('settings.cancel', lang), style: 'cancel' },
      { text: t('home.newGame', lang), style: 'destructive', onPress: startNew },
    ]);
  }, [lang, startNew]);

  const startDaily = useCallback(() => {
    useAnalyticsStore.getState().track('daily_challenge_started', { source: 'home_card' });
    router.push({
      pathname: '/game',
      params: {
        entry: 'daily',
        seed: String(dailyChallenge.seed),
        challengeDate: dailyChallenge.dateIso,
      },
    });
  }, [dailyChallenge.dateIso, dailyChallenge.seed, router]);

  const confirmDaily = useCallback(() => {
    if (savedGame.kind === 'none') {
      startDaily();
      return;
    }
    Alert.alert(t('home.dailyChallenge', lang), t('home.newGameConfirm', lang), [
      { text: t('settings.cancel', lang), style: 'cancel' },
      { text: t('home.dailyChallenge', lang), style: 'destructive', onPress: startDaily },
    ]);
  }, [lang, savedGame.kind, startDaily]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View
        style={{
          position: 'absolute',
          top: 56,
          left: 20,
          right: 20,
          zIndex: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText preset="body">S</AppText>
        </Pressable>

        <ProfileChip onPress={() => setProfileOpen(true)} />
      </View>

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

        <View style={{ alignItems: 'center', gap: 6 }}>
          <AppText preset="body" style={{ color: colors.accent }}>
            {t('home.best', lang)}: {best}
          </AppText>
          {streakVisible >= 1 ? (
            <AppText preset="caption">
              {streakVisible} {t('home.streakDays', lang)}
            </AppText>
          ) : null}
        </View>

        <WeeklyCard onPress={() => router.push('/leaderboard')} />

        {showDailyChallenge ? (
          <View style={{ width: '100%', maxWidth: 320, gap: spacing.xs }}>
              <GameButton
                label={t('home.dailyChallenge', lang)}
                variant="ghost"
                onPress={confirmDaily}
              />
            <AppText preset="caption" style={{ textAlign: 'center' }}>
              {t('home.dailyCode', lang)}: {dailyChallenge.code}
            </AppText>
          </View>
        ) : null}

        <View style={{ width: '100%', maxWidth: 320, gap: spacing.m }}>
          {savedGame.canContinue && savedGame.score !== null ? (
            <>
              <GameButton
                label={`${t('home.continue', lang)} - ${savedGame.score}`}
                onPress={() =>
                  router.push({ pathname: '/game', params: { entry: 'resume' } })
                }
              />
              <GameButton
                label={t('home.newGame', lang)}
                variant="ghost"
                onPress={confirmNew}
              />
            </>
          ) : savedGame.kind === 'terminal' ? (
            <GameButton label={t('home.newGame', lang)} onPress={confirmNew} />
          ) : (
            <GameButton label={t('home.play', lang)} onPress={startNew} />
          )}
        </View>
      </View>

      <ProfileOverlay visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </SafeAreaView>
  );
}
