import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { DailyCard } from '@/features/dailybonus';
import { getSavedGameSummary } from '@/features/game';
import type { SavedGameSummary } from '@/features/game';
import {
  WeeklyCard,
  createDailyChallenge,
  shouldShowDailyChallenge,
  useLeaderboardStore,
} from '@/features/leaderboard';
import { AdBanner, MONETIZATION } from '@/features/monetization';
import { ProfileChip, ProfileOverlay, useProfileStore } from '@/features/profile';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
import { useActiveWorldTheme } from '@/features/themes';
import { AppText, ConfirmDialog, GameButton, colors, radii, spacing } from '@/ui';

const LOGO_ROWS = ['BLOCK', 'BLAST'];

function Logo() {
  const palette = useActiveWorldTheme().cellColors;
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
  const [pendingConfirm, setPendingConfirm] = useState<'new' | 'daily' | null>(null);

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

  const startNew = useCallback(async () => {
    const session = await useProfileStore.getState().bootstrapRemote();
    await useLeaderboardStore.getState().issueTickets(session?.authToken);
    router.push({ pathname: '/game', params: { entry: 'new' } });
  }, [router]);

  const confirmNew = useCallback(() => {
    setPendingConfirm('new');
  }, []);

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
    setPendingConfirm('daily');
  }, [savedGame.kind, startDaily]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.l,
          paddingVertical: spacing.m,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 320,
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
          <Pressable onPress={() => router.push('/map')} hitSlop={8}>
            <AppText preset="caption" style={{ color: colors.accent, textDecorationLine: 'underline' }}>
              {t('home.map', lang)}
            </AppText>
          </Pressable>
        </View>

        <DailyCard />

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
      </ScrollView>

      <AdBanner adUnitId={MONETIZATION.yandex.homeBannerAdUnitId} />

      <ProfileOverlay visible={profileOpen} onClose={() => setProfileOpen(false)} />

      <ConfirmDialog
        visible={pendingConfirm !== null}
        title={pendingConfirm === 'daily' ? t('home.dailyChallenge', lang) : t('home.newGame', lang)}
        message={t('home.newGameConfirm', lang)}
        confirmLabel={pendingConfirm === 'daily' ? t('home.dailyChallenge', lang) : t('home.newGame', lang)}
        cancelLabel={t('settings.cancel', lang)}
        destructive
        onConfirm={() => {
          const which = pendingConfirm;
          setPendingConfirm(null);
          if (which === 'daily') startDaily();
          else startNew();
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </SafeAreaView>
  );
}
