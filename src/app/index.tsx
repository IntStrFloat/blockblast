import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { progressionText } from '@/core/i18n/progression';
import { useAnalyticsStore } from '@/features/analytics';
import { DailyCard } from '@/features/dailybonus';
import { getSavedGameSummary } from '@/features/game';
import type { SavedGameSummary } from '@/features/game';
import { progressFor, useProgression } from '@/features/progression';
import {
  WeeklyCard,
  createDailyChallenge,
  shouldShowDailyChallenge,
  useLeaderboardStore,
} from '@/features/leaderboard';
import { AdBanner, MONETIZATION } from '@/features/monetization';
import { OnboardingOverlay } from '@/features/onboarding';
import { ProfileOverlay, useProfileStore } from '@/features/profile';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
import { useActiveWorldTheme } from '@/features/themes';
import {
  AppText,
  ChevronIcon,
  ClayCard,
  ConfirmDialog,
  FireIcon,
  GameButton,
  GearIcon,
  IconButton,
  StarIcon,
  TrophyIcon,
  UserIcon,
  colors,
  radii,
  spacing,
} from '@/ui';

const LOGO_ROWS = ['BLOCK', 'BLAST'];
const CONTENT_MAX_WIDTH = 360;

/** Компактный чип статистики для шапки: иконка + значение (+ подпись). */
function StatChip({
  icon,
  value,
  label,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  value: string;
  label?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.s,
        paddingVertical: 4,
        borderRadius: radii.button,
        backgroundColor: colors.cardSolid,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      {icon}
      <AppText preset="button" style={{ fontSize: 15 }} numberOfLines={1}>
        {value}
      </AppText>
      {label ? <AppText preset="caption">{label}</AppText> : null}
    </View>
  );
}

/** Индикатор Уровня Игры на Home: мир + уровень + прогресс-бар, тап → карта достижений. */
function HomeLevelBar({ onPress }: { onPress: () => void }) {
  const lang = useLang();
  const level = useProgression((s) => s.level);
  const world = useProgression((s) => s.world);
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const worldAccent = useActiveWorldTheme().cellColors[0];
  const info = progressFor(lifetimePoints);
  const total = info.pointsInLevel + info.pointsToNext;
  const fill = total > 0 ? info.pointsInLevel / total : 1;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('home.map', lang)}
      style={{ width: '100%' }}
    >
      <ClayCard style={{ gap: spacing.s }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 5,
                backgroundColor: worldAccent,
              }}
            />
            <AppText preset="button">
              {progressionText('world', lang)} {world} · {progressionText('lvlShort', lang)} {level}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TrophyIcon size={16} />
            <AppText preset="caption" style={{ color: colors.accent }}>
              {t('home.map', lang)}
            </AppText>
            <ChevronIcon size={16} color={colors.accent} />
          </View>
        </View>
        <View
          style={{
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.track,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.max(fill, 0.03) * 100}%`,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </ClayCard>
    </Pressable>
  );
}

function Logo() {
  const palette = useActiveWorldTheme().cellColors;
  return (
    <View style={{ gap: spacing.s, alignItems: 'center' }}>
      {LOGO_ROWS.map((row, rowIdx) => (
        <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
          {[...row].map((ch, index) => (
            <Animated.View
              key={`${rowIdx}-${index}`}
              entering={FadeInDown.delay((rowIdx * row.length + index) * 55).springify().damping(14)}
              style={{
                width: 46,
                height: 46,
                borderRadius: radii.cell + 6,
                backgroundColor: palette[(rowIdx * 2 + index) % palette.length],
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.clayShadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 6,
                elevation: 4,
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
  const [pendingConfirm, setPendingConfirm] = useState<'daily' | null>(null);

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

  const play = useCallback(() => {
    if (savedGame.kind === 'active') {
      router.push({ pathname: '/game', params: { entry: 'resume' } });
      return;
    }
    void startNew();
  }, [router, savedGame.kind, startNew]);

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
          paddingHorizontal: spacing.l,
          paddingTop: spacing.s,
          paddingBottom: spacing.xl,
          gap: spacing.m,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: '100%',
            maxWidth: CONTENT_MAX_WIDTH,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            onPress={() => router.push('/settings')}
            accessibilityLabel={t('settings.title', lang)}
          >
            <GearIcon size={22} />
          </IconButton>

          {/* Кластер ключевых статов в шапке: рекорд + стрик (раньше стрик занимал
              отдельную карточку — теперь компактный чип, без дубля «Рекорда»). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <StatChip
              icon={<StarIcon size={14} />}
              value={String(best)}
              label={t('home.best', lang)}
            />
            {streakVisible >= 1 ? (
              <StatChip
                icon={<FireIcon size={14} />}
                value={String(streakVisible)}
                accessibilityLabel={`${streakVisible} ${t('home.streakDays', lang)}`}
              />
            ) : null}
          </View>

          <IconButton
            onPress={() => setProfileOpen(true)}
            accessibilityLabel={t('profile.title', lang)}
          >
            <UserIcon size={22} />
          </IconButton>
        </View>

        <Logo />

        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
          <HomeLevelBar onPress={() => router.push('/map')} />
        </View>

        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
          <GameButton label={t('home.play', lang)} size="lg" onPress={play} />
        </View>

        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
          <DailyCard />
        </View>

        <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
          <WeeklyCard onPress={() => router.push('/leaderboard')} />
        </View>

        {showDailyChallenge ? (
          <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, gap: spacing.xs }}>
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
      </ScrollView>

      <AdBanner adUnitId={MONETIZATION.yandex.homeBannerAdUnitId} />

      <OnboardingOverlay />

      <ProfileOverlay visible={profileOpen} onClose={() => setProfileOpen(false)} />

      <ConfirmDialog
        visible={pendingConfirm !== null}
        title={t('home.dailyChallenge', lang)}
        message={t('home.newGameConfirm', lang)}
        confirmLabel={t('home.dailyChallenge', lang)}
        cancelLabel={t('settings.cancel', lang)}
        destructive
        onConfirm={() => {
          setPendingConfirm(null);
          startDaily();
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </SafeAreaView>
  );
}
