import { dayLabel } from '@/ui/nightCandy';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAdventure } from '@/features/adventure';
import { levelFor } from '@/features/adventure/logic/levels';
import { useAnalyticsStore } from '@/features/analytics';
import { getSavedGameSummary, type SavedGameSummary } from '@/features/game';
import {
  currentWeeklyGoal,
  getWeeklyGoal,
  selectEffectiveWeeklyBest,
  selectPreviousWeeklyBest,
  useLeaderboardStore,
  useWeeklyGoalStore,
  useWeeklyGoalWeekKey,
} from '@/features/leaderboard';
import { HomePromptHost } from '@/features/notifications';
import { shouldEnterFtue, useFtueStore, useWelcomePromptStore } from '@/features/onboarding';
import { useProfileStore } from '@/features/profile';
import { useProgression } from '@/features/progression';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { getHomeStreakStatus, todayISO, useStreak } from '@/features/streak';
import {
  AppText,
  BottomNav,
  CandyAvatar,
  CandyBackground,
  CandyCapy,
  CandyIcon,
  CandyProgress,
  GameButton,
  formatNumber,
  nightCandy as n,
} from '@/ui';
import { CandyChip, CandyRoundButton } from '@/ui/primitives/CandyControls';
import { CandyLogo } from '@/ui/primitives/CandyLogo';

export default function HomeScreen() {
  const router = useRouter();
  const lang = useLang();
  const ru = lang === 'ru';
  const insets = useSafeAreaInsets();
  const best = useScores((s) => s.best);
  const gamesPlayed = useScores((s) => s.gamesPlayed);
  const rank = useProgression((s) => s.level);
  const ftueStatus = useFtueStore((s) => s.status);
  const isFirstSession = useAnalyticsStore((s) => s.context?.is_first_session ?? gamesPlayed === 0);
  const streak = useStreak();
  const visibleStreak = getHomeStreakStatus(streak, todayISO()).visibleCount;
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const objective = levelFor(seasonId, levelIndex).objective;
  const localWeekly = useLeaderboardStore((s) => s.localWeeklyResult);
  const snapshot = useLeaderboardStore((s) => s.snapshot);
  const weeklyGoals = useWeeklyGoalStore((s) => s.goals);
  const week = useWeeklyGoalWeekKey();
  const now = new Date();
  const weeklyBest = selectEffectiveWeeklyBest(snapshot, localWeekly, now);
  const previousBest = selectPreviousWeeklyBest(snapshot, localWeekly, now);
  const goalRecord = currentWeeklyGoal(weeklyGoals, now, weeklyBest, previousBest);
  const weeklyGoal = getWeeklyGoal(Math.max(weeklyBest, goalRecord.progress), goalRecord.target);
  const [savedGame, setSavedGame] = useState<SavedGameSummary>(() => getSavedGameSummary());
  const autoFtueStarted = useRef(false);

  useEffect(() => {
    useWeeklyGoalStore
      .getState()
      .sync(new Date(), weeklyBest, snapshot?.isCached ? 'cached' : 'home_card', previousBest);
  }, [previousBest, snapshot?.isCached, week, weeklyBest]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSavedGame(getSavedGameSummary());
      void (async () => {
        const session = await useProfileStore.getState().bootstrapRemote();
        if (!active) return;
        await useLeaderboardStore.getState().issueTickets(session?.authToken);
        if (active) await useLeaderboardStore.getState().refreshIfStale(new Date(), 30_000);
      })();
      useAnalyticsStore
        .getState()
        .track('home_viewed', {
          home_state: getSavedGameSummary().canContinue
            ? 'continue'
            : gamesPlayed === 0
              ? 'first_clear'
              : 'return_loop',
          cards_visible: ['classic', 'adventure', 'weekly'],
        });
      return () => {
        active = false;
      };
    }, [gamesPlayed]),
  );

  useEffect(() => {
    if (gamesPlayed > 0) useWelcomePromptStore.getState().resolve();
    if (autoFtueStarted.current || !shouldEnterFtue(useFtueStore.getState(), gamesPlayed)) return;
    const saved = getSavedGameSummary();
    if (saved.fallbackReason) return;
    autoFtueStarted.current = true;
    useWelcomePromptStore.getState().resolve();
    const resumeTutorial = saved.runKind === 'tutorial' && saved.canContinue;
    router.replace({
      pathname: '/game',
      params: { entry: resumeTutorial ? 'resume' : 'tutorial', startTs: String(Date.now()) },
    });
  }, [gamesPlayed, router]);

  const canContinue = savedGame.kind === 'active' || savedGame.kind === 'terminal_revivable';
  const play = () => {
    useAnalyticsStore
      .getState()
      .track('play_tapped', { source: 'home', has_saved_game: canContinue });
    router.push({
      pathname: '/game',
      params: { entry: canContinue ? 'resume' : 'new', startTs: String(Date.now()) },
    });
  };

  return (
    <View style={styles.screen}>
      <CandyBackground decorated />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <CandyRoundButton
          icon="gear"
          label={ru ? 'Настройки' : 'Settings'}
          onPress={() => router.push('/settings')}
        />
        <View style={styles.stats}>
          <CandyChip icon="crown" label={formatNumber(best)} />
          <CandyChip
            icon="fire"
            color={n.coral}
            label={`${visibleStreak} ${dayLabel(visibleStreak, lang)}`}
          />
        </View>
        <CandyAvatar rank={rank} onPress={() => router.navigate('/capy')} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <CandyLogo />
        <View style={styles.speechRow}>
          <View style={styles.speech}>
            <AppText
              style={{
                color: '#1B1F5E',
                fontFamily: 'Nunito_800ExtraBold',
                fontSize: 14,
                lineHeight: 19,
              }}
            >
              {ru
                ? best > 0
                  ? `Рекорд — ${formatNumber(best)}. Сегодня побьём?`
                  : 'Привет! Соберём первые линии?'
                : best > 0
                  ? `Best — ${formatNumber(best)}. Beat it today?`
                  : 'Hi! Let’s clear our first lines!'}
            </AppText>
            <View style={styles.speechTail} />
          </View>
          <CandyCapy />
        </View>
        <LinearGradient colors={['#2A62D9', '#1D3FAE']} style={styles.classicCard}>
          <View style={styles.row}>
            <AppText preset="title" style={{ fontSize: 22, lineHeight: 28 }}>
              {ru ? 'Классика' : 'Classic'}
            </AppText>
            <CandyIcon name="infinity" size={30} color={n.sky} />
          </View>
          <AppText style={{ color: '#DCE6FF', fontSize: 15, lineHeight: 21 }}>
            {canContinue
              ? ru
                ? `Партия сохранена · счёт ${formatNumber(savedGame.score ?? 0)}`
                : `Saved game · score ${formatNumber(savedGame.score ?? 0)}`
              : ru
                ? 'Бесконечная партия · собирай линии'
                : 'Endless game · clear the lines'}
          </AppText>
          <GameButton
            size="lg"
            label={canContinue ? (ru ? 'Продолжить' : 'Continue') : ru ? 'Играть' : 'Play'}
            icon={<CandyIcon name="play" color={n.sunInk} />}
            onPress={play}
          />
        </LinearGradient>
        <LinearGradient colors={['#B4561A', '#8A3A12']} style={styles.adventureCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText
              style={{
                fontFamily: 'Nunito_900Black',
                fontSize: 12,
                lineHeight: 17,
                letterSpacing: 1.44,
                color: '#FFD9B8',
              }}
            >
              {ru ? 'ПРИКЛЮЧЕНИЕ' : 'ADVENTURE'}
            </AppText>
            <AppText preset="title" style={{ fontSize: 19, lineHeight: 24 }}>
              {ru ? 'Уровень' : 'Level'} {levelIndex + 1}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CandyIcon
                name={objective.type === 'jewels' ? 'gem' : 'crown'}
                color="#FFE3CC"
                size={16}
              />
              <AppText style={{ color: '#FFE3CC', fontSize: 14, lineHeight: 19, flexShrink: 1 }}>
                {objective.type === 'jewels'
                  ? ru
                    ? `Собери ${objective.target} кристаллов`
                    : `Collect ${objective.target} crystals`
                  : ru
                    ? `Набери ${formatNumber(objective.target)} очков`
                    : `Score ${formatNumber(objective.target)} points`}
              </AppText>
            </View>
          </View>
          <GameButton
            style={{ width: 120 }}
            variant="mandarin"
            label={ru ? 'Играть' : 'Play'}
            onPress={() => router.navigate('/adventure')}
          />
        </LinearGradient>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ru ? 'Цель недели' : 'Weekly goal'}
          onPress={() => router.navigate('/leaderboard')}
          style={styles.weekly}
        >
          <View style={styles.row}>
            <AppText style={styles.weeklyLabel}>{ru ? 'Цель недели' : 'Weekly goal'}</AppText>
            <AppText style={[styles.weeklyLabel, { color: n.sun }]}>
              {formatNumber(weeklyGoal.current)} / {formatNumber(weeklyGoal.target)}
            </AppText>
          </View>
          <CandyProgress
            value={weeklyGoal.target > 0 ? weeklyGoal.current / weeklyGoal.target : 0}
          />
        </Pressable>
      </ScrollView>
      <BottomNav active="play" />
      <HomePromptHost
        ftueComplete={ftueStatus === 'complete' || ftueStatus === 'skipped'}
        isFirstSession={isFirstSession}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: n.night900 },
  header: {
    width: '100%',
    maxWidth: 512,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stats: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 32,
    gap: 16,
  },
  speechRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 6 },
  speech: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: n.white,
    marginBottom: 26,
  },
  speechTail: {
    position: 'absolute',
    left: 22,
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: n.white,
    transform: [{ rotate: '45deg' }],
  },
  classicCard: { borderRadius: 28, borderWidth: 2, borderColor: '#4C7DE0', padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  adventureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    paddingLeft: 20,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#BB783D',
  },
  weekly: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(6,9,44,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  weeklyLabel: { fontFamily: 'Nunito_900Black', fontSize: 14, lineHeight: 20 },
});
