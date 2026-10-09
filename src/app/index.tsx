import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, type Lang } from '@/core/i18n';
import { progressionText } from '@/core/i18n/progression';
import { KEYS, getString, setString } from '@/core/storage';
import {
  SeasonCountdownBadge,
  useAdventure,
  useSeasonWindowRefresh,
} from '@/features/adventure';
import { adventureSeasonRemainingMs } from '@/features/adventure/logic/seasonWindow';
import { NextActionCard, selectNextAction } from '@/features/home';
import { recordNextGoalClick, useAnalyticsStore } from '@/features/analytics';
import { getSavedAdventureSummary, getSavedGameSummary } from '@/features/game';
import type { SavedAdventureSummary, SavedGameSummary } from '@/features/game';
import {
  currentWeeklyGoal,
  getUtcWeekWindow,
  getWeeklyGoal,
  selectEffectiveWeeklyBest,
  selectPreviousWeeklyBest,
  useLeaderboardStore,
  useWeeklyGoalStore,
  useWeeklyGoalWeekKey,
} from '@/features/leaderboard';
import { useMascot } from '@/features/mascot';
import { HomePromptHost } from '@/features/notifications';
import { shouldEnterFtue, useFtueStore, useWelcomePromptStore } from '@/features/onboarding';
import { ProfileOverlay, useProfileStore } from '@/features/profile';
import {
  nextRewardInCurrentWorld,
  nextRewardMilestone,
  rewardDisplayName,
  useProgression,
} from '@/features/progression';
import { RewardVisual } from '@/features/progression/components/RewardVisual';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { getHomeStreakStatus, type HomeStreakStatusKind, todayISO, useStreak } from '@/features/streak';
import { useActiveWorldTheme } from '@/features/themes';
import {
  AppText,
  CrownIcon,
  FireIcon,
  GearIcon,
  StarIcon,
  TrophyIcon,
  UserIcon,
  spacing,
} from '@/ui';

const MENU_WIDTH = 294;
const HOME_BLUE = ['#2548B8', '#1998DC'] as const;
const LOGO_LETTERS = [
  { letter: 'Б', color: '#FFB220', shadow: '#A84F08', rotation: '-7deg' },
  { letter: 'Л', color: '#31CAF4', shadow: '#0A75BE', rotation: '-1deg' },
  { letter: 'О', color: '#FF5A60', shadow: '#AD2639', rotation: '1deg' },
  { letter: 'К', color: '#BD5AE9', shadow: '#6F299B', rotation: '7deg' },
] as const;

function InfinitySymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={36} height={28} viewBox="0 0 36 28" fill="none">
      <Path
        d="M3 14c3.2-7.8 8.1-9.8 13.2-1.4L18 15.5l1.8-2.9C24.8 4.2 29.8 6.2 33 14c-3.2 7.8-8.2 9.8-13.2 1.4L18 12.5l-1.8 2.9C11.1 23.8 6.2 21.8 3 14z"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AdventureSymbol({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
      <Circle cx={17} cy={17} r={12} stroke={color} strokeWidth={3.2} strokeDasharray="50 12" />
      <Path d="M11 17h12M17 11v12" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** Русский логотип повторяет композицию референса: корона, объёмные разноцветные буквы и бирюзовая строка. */
function ReferenceLogo() {
  const { width } = useWindowDimensions();
  const mainSize = Math.min(84, Math.max(64, Math.floor((width - spacing.l * 2) * 0.25)));
  const secondSize = Math.round(mainSize * 0.55);

  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Блок Бластик!" style={styles.logo}>
      <View style={{ marginBottom: -12, zIndex: 1 }}>
        <CrownIcon size={Math.round(mainSize * 0.52)} color="#F8FBFF" />
      </View>
      <View style={styles.logoTopWord}>
        {LOGO_LETTERS.map(({ letter, color, shadow, rotation }) => (
          <AppText
            key={letter}
            preset="speech"
            maxFontSizeMultiplier={1}
            style={{
              color,
              fontFamily: 'Unbounded_700Bold',
              fontSize: mainSize,
              lineHeight: mainSize,
              letterSpacing: -4,
              textShadowColor: shadow,
              textShadowOffset: { width: 0, height: 6 },
              textShadowRadius: 1,
              transform: [{ rotate: rotation }],
            }}
          >
            {letter}
          </AppText>
        ))}
      </View>
      <AppText
        preset="speech"
        maxFontSizeMultiplier={1}
        style={{
          color: '#35DDF6',
          fontFamily: 'Unbounded_700Bold',
          fontSize: secondSize,
          lineHeight: secondSize,
          fontStyle: 'italic',
          letterSpacing: -2,
          textShadowColor: '#0C72BC',
          textShadowOffset: { width: 0, height: 5 },
          textShadowRadius: 1,
        }}
      >
        БЛАСТИК!
      </AppText>
      <AppText preset="caption" maxFontSizeMultiplier={1} style={styles.logoTagline} numberOfLines={1}>
        ПРИКЛЮЧЕНИЯ · РЕКОРДЫ
      </AppText>
    </View>
  );
}

function HeaderControl({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerControl, pressed && styles.headerControlPressed]}
    >
      {icon}
    </Pressable>
  );
}

function HeaderStats({ best, streak }: { best: number; streak: number }) {
  const lang = useLang();
  return (
    <View
      accessible
      accessibilityLabel={`${t('home.best', lang)}: ${best}. ${t('home.streak', lang)}: ${streak}.`}
      style={styles.headerStats}
    >
      <View style={styles.headerStatValue}>
        <StarIcon size={16} color="#FFF3A6" />
        <AppText preset="speech" style={styles.headerStatText}>
          {best}
        </AppText>
      </View>
      <View style={styles.headerStatDivider} />
      <View style={styles.headerStatValue}>
        <FireIcon size={17} color="#FF8B27" innerColor="#FFE061" />
        <AppText preset="speech" style={styles.headerStatText}>
          {streak}
        </AppText>
      </View>
    </View>
  );
}

interface ReferenceMenuButtonProps {
  label: string;
  symbol: ReactNode;
  gradient: readonly [string, string];
  baseColor: string;
  iconColor?: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
  ribbon?: ReactNode;
}

/** Объёмная кнопка режима: узкая, высокая и с нижней гранью как в визуальном референсе. */
function ReferenceMenuButton({
  label,
  symbol,
  gradient,
  baseColor,
  onPress,
  accessibilityLabel,
  testID,
  ribbon,
}: ReferenceMenuButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.menuButton, { backgroundColor: baseColor }, pressed && styles.menuButtonPressed]}
    >
      {ribbon ? <View style={styles.seasonRibbon}>{ribbon}</View> : null}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.menuButtonSurface}
      >
        <View style={styles.menuButtonSymbol}>{symbol}</View>
        <AppText
          preset="button"
          style={styles.menuButtonLabel}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {label}
        </AppText>
      </LinearGradient>
    </Pressable>
  );
}

function QuickLink({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
    >
      {icon}
      <View style={styles.quickLinkCopy}>
        <AppText
          preset="speech"
          style={styles.quickLinkLabel}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.86}
        >
          {label}
        </AppText>
        <AppText preset="caption" style={styles.quickLinkDetail} numberOfLines={1}>
          {detail}
        </AppText>
      </View>
    </Pressable>
  );
}

function StreakStatusCard({
  kind,
  count,
  lang,
  onPress,
}: {
  kind: HomeStreakStatusKind;
  count: number;
  lang: Lang;
  onPress: () => void;
}) {
  if (kind !== 'at_risk_today' && kind !== 'protector_recoverable') {
    return null;
  }

  const title = kind === 'protector_recoverable' ? t('home.streakRecover', lang) : t('home.streakKeep', lang);
  const detail = `${count} ${t('home.streakDays', lang)}`;
  const action = t('home.streakAction', lang);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ${detail}. ${action}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.streakCard, pressed && styles.streakCardPressed]}
    >
      <View style={styles.streakBadge}>
        <FireIcon size={17} color="#FF8B27" innerColor="#FFE061" />
      </View>
      <View style={styles.streakCopy}>
        <AppText preset="speech" style={styles.streakTitle} numberOfLines={2}>
          {title}
        </AppText>
        <AppText preset="caption" style={styles.streakDetail} numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      <AppText preset="caption" style={styles.streakAction}>
        {action}
      </AppText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const lang = useLang();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const best = useScores((s) => s.best);
  const gamesPlayed = useScores((s) => s.gamesPlayed);
  const ftueStatus = useFtueStore((s) => s.status);
  const welcomePromptResolved = useWelcomePromptStore((s) => s.resolved);
  const resolveWelcomePrompt = useWelcomePromptStore((s) => s.resolve);
  const ftueComplete = ftueStatus === 'complete' || ftueStatus === 'skipped';
  const analyticsFirstSession = useAnalyticsStore(
    (s) => s.context?.is_first_session ?? gamesPlayed === 0,
  );
  const streakLastDay = useStreak((s) => s.lastDay);
  const streakCount = useStreak((s) => s.count);
  const streakProtectorLastUsedDay = useStreak((s) => s.protectorLastUsedDay);
  const world = useProgression((s) => s.world);
  const level = useProgression((s) => s.level);
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const mascotUnlocked = useMascot((s) => s.unlocked);
  const mascotEquipped = useMascot((s) => s.equipped);
  const worldAccent = useActiveWorldTheme().cellColors[0];
  const localWeekly = useLeaderboardStore((s) => s.localWeeklyResult);
  const weeklySnapshot = useLeaderboardStore((s) => s.snapshot);
  const weeklyGoals = useWeeklyGoalStore((s) => s.goals);
  const adventureSeasonWindow = useAdventure((s) => s.seasonWindow);
  const adventureSeasonWindowSyncedAtMs = useAdventure((s) => s.seasonWindowSyncedAtMs);
  const adventureSeasonRemaining = adventureSeasonRemainingMs(
    adventureSeasonWindow,
    adventureSeasonWindowSyncedAtMs,
  );
  const reactiveWeekKey = useWeeklyGoalWeekKey();
  useSeasonWindowRefresh();
  const [savedGame, setSavedGame] = useState<SavedGameSummary>(() => getSavedGameSummary());
  const [savedAdventure, setSavedAdventure] = useState<SavedAdventureSummary>(
    () => getSavedAdventureSummary(),
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'classic' | 'adventure'>(() =>
    getString(KEYS.homeSelectedMode) === 'adventure' ? 'adventure' : 'classic',
  );
  const autoFtueStarted = useRef(false);
  const streakStatus = getHomeStreakStatus(
    {
      lastDay: streakLastDay,
      count: streakCount,
      protectorLastUsedDay: streakProtectorLastUsedDay,
    },
    todayISO(),
  );
  const streakVisible = streakStatus.visibleCount;
  const now = new Date();
  const weeklyBest = selectEffectiveWeeklyBest(weeklySnapshot, localWeekly, now);
  const previousWeeklyBest = selectPreviousWeeklyBest(weeklySnapshot, localWeekly, now);
  const currentWeekKey = getUtcWeekWindow(now).weekKey;
  const weeklyRank = weeklySnapshot?.weekKey === currentWeekKey
    ? weeklySnapshot.currentPlayer.rank
    : null;
  const weeklyRecord = currentWeeklyGoal(
    weeklyGoals,
    now,
    weeklyBest,
    previousWeeklyBest,
  );
  const weeklyGoal = getWeeklyGoal(
    Math.max(weeklyBest, weeklyRecord.progress),
    weeklyRecord.target,
  );
  const rewardMilestone = nextRewardInCurrentWorld(lifetimePoints);
  const fallbackReward = nextRewardMilestone(lifetimePoints);
  const activeClassic = savedGame.kind === 'active' || savedGame.kind === 'terminal_revivable';
  const activeAdventure = savedAdventure.kind === 'active';
  const selectedResumeMode =
    selectedMode === 'adventure' && activeAdventure
      ? 'adventure'
      : selectedMode === 'classic' && activeClassic
        ? 'classic'
        : activeAdventure
          ? 'adventure'
          : activeClassic
            ? 'classic'
            : null;
  const resumeGoal =
    selectedResumeMode === 'adventure' && savedAdventure.runId
      ? {
          available: true,
          mode: 'adventure' as const,
          goalId: `resume:${savedAdventure.runId}`,
          current: savedAdventure.objectiveCurrent ?? savedAdventure.score ?? 0,
          target: Math.max(
            savedAdventure.objectiveCurrent ?? 0,
            savedAdventure.objectiveTarget ?? savedAdventure.objectiveCurrent ?? 0,
          ),
          complete: false,
          level: (savedAdventure.levelIndex ?? 0) + 1,
          score: savedAdventure.score ?? 0,
          savedState: 'active' as const,
        }
      : selectedResumeMode === 'classic' && savedGame.runId
        ? {
            available: true,
            mode: 'classic' as const,
            goalId: `resume:${savedGame.runId}`,
            current: savedGame.score ?? 0,
            target: Math.max(
              savedGame.score ?? 0,
              Math.max(0, (fallbackReward?.threshold ?? lifetimePoints) - lifetimePoints),
            ),
            complete: false,
            score: savedGame.score ?? 0,
            savedState:
              savedGame.kind === 'terminal_revivable' ? ('second_chance' as const) : ('active' as const),
          }
        : null;
  const rewardGoal = rewardMilestone
    ? {
        available: true,
        goalId: `reward:${rewardMilestone.level}:${
          rewardMilestone.reward.kind === 'world'
            ? rewardMilestone.reward.themeId
            : rewardMilestone.reward.id
        }`,
        current: rewardMilestone.available ? 1 : lifetimePoints,
        target: rewardMilestone.available ? 1 : rewardMilestone.threshold,
        complete:
          rewardMilestone.available && rewardMilestone.reward.kind !== 'cosmetic'
            ? true
            : rewardMilestone.reward.kind === 'cosmetic' &&
              Object.values(mascotEquipped).includes(rewardMilestone.reward.id),
        rewardId:
          rewardMilestone.reward.kind === 'world'
            ? rewardMilestone.reward.themeId
            : rewardMilestone.reward.id,
        rewardKind: rewardMilestone.reward.kind,
        level: rewardMilestone.level,
        availableNow:
          rewardMilestone.available ||
          (rewardMilestone.reward.kind === 'cosmetic' && mascotUnlocked.includes(rewardMilestone.reward.id)),
      }
    : null;
  const nextAction = selectNextAction({
    gamesPlayed,
    resume: resumeGoal,
    reward: rewardGoal,
    weekly: {
      available: true,
      goalId: weeklyRecord.goalId,
      weekKey: weeklyRecord.weekKey,
      current: weeklyGoal.current,
      target: weeklyGoal.target,
      complete: weeklyGoal.complete,
    },
  });
  useEffect(() => {
    useWeeklyGoalStore.getState().sync(
      new Date(),
      weeklyBest,
      weeklySnapshot?.isCached ? 'cached' : 'home_card',
      previousWeeklyBest,
    );
  }, [previousWeeklyBest, reactiveWeekKey, weeklyBest, weeklySnapshot?.isCached]);

  useEffect(() => {
    const sessionId = useAnalyticsStore.getState().context?.session_id ?? 'bootstrap';
    useAnalyticsStore.getState().trackOnce(
      `next-goal:${sessionId}:${nextAction.goalId}`,
      'next_goal_presented',
      {
        ...(nextAction.mode ? { mode: nextAction.mode } : {}),
        goal_type: nextAction.kind,
        goal_id: nextAction.goalId,
      },
    );
    if (nextAction.kind === 'weekly') {
      useWeeklyGoalStore.getState().expose(
        weeklyRecord,
        weeklySnapshot?.isCached ? 'cached' : 'home_card',
      );
    }
  }, [nextAction.goalId, nextAction.kind, nextAction.mode, weeklyRecord, weeklySnapshot?.isCached]);

  useEffect(() => {
    if (gamesPlayed > 0 && !welcomePromptResolved) {
      resolveWelcomePrompt();
    }
  }, [gamesPlayed, resolveWelcomePrompt, welcomePromptResolved]);

  useEffect(() => {
    if (autoFtueStarted.current) return;
    if (!shouldEnterFtue(useFtueStore.getState(), gamesPlayed)) return;
    autoFtueStarted.current = true;
    resolveWelcomePrompt();
    const startTs = Date.now();
    const tutorialSave = getSavedGameSummary();
    if (tutorialSave.fallbackReason) {
      return;
    }
    const resumeTutorial =
      tutorialSave.runKind === 'tutorial' &&
      (tutorialSave.kind === 'active' || tutorialSave.kind === 'terminal_revivable');
    useAnalyticsStore.getState().track('play_tapped', {
      source: 'home',
      has_saved_game: resumeTutorial,
    });
    router.replace({
      pathname: '/game',
      params: { entry: resumeTutorial ? 'resume' : 'tutorial', startTs: String(startTs) },
    });
  }, [gamesPlayed, resolveWelcomePrompt, router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const savedSummary = getSavedGameSummary();
      setSavedGame(savedSummary);
      setSavedAdventure(getSavedAdventureSummary());

      void (async () => {
        const session = await useProfileStore.getState().bootstrapRemote();
        if (!active) return;
        await useLeaderboardStore.getState().issueTickets(session?.authToken);
        await useLeaderboardStore.getState().refreshIfStale(new Date(), 30_000);
      })();

      useAnalyticsStore.getState().track('home_viewed', {
        home_state: savedSummary.kind !== 'none' ? 'continue' : gamesPlayed === 0 ? 'first_clear' : 'return_loop',
        cards_visible: ['adventure', 'classic', 'next_action', 'quick_links'],
      });

      return () => {
        active = false;
      };
    }, [gamesPlayed]),
  );

  const startNew = useCallback(() => {
    const startTs = Date.now();
    useAnalyticsStore.getState().track('play_tapped', { source: 'home', has_saved_game: false });
    router.push({ pathname: '/game', params: { entry: 'new', startTs: String(startTs) } });
    void (async () => {
      const session = await useProfileStore.getState().bootstrapRemote();
      await useLeaderboardStore.getState().issueTickets(session?.authToken);
    })();
  }, [router]);

  const play = useCallback(() => {
    if (savedGame.kind === 'active' || savedGame.kind === 'terminal_revivable') {
      const startTs = Date.now();
      useAnalyticsStore.getState().track('play_tapped', { source: 'home', has_saved_game: true });
      router.push({ pathname: '/game', params: { entry: 'resume', startTs: String(startTs) } });
      return;
    }
    if (shouldEnterFtue(useFtueStore.getState(), useScores.getState().gamesPlayed)) {
      const startTs = Date.now();
      useAnalyticsStore.getState().track('play_tapped', {
        source: 'home',
        has_saved_game: false,
      });
      router.push({
        pathname: '/game',
        params: { entry: 'tutorial', startTs: String(startTs) },
      });
      return;
    }
    startNew();
  }, [router, savedGame.kind, startNew]);

  const classicLabel = nextAction.kind === 'resume' && nextAction.mode === 'classic'
    ? t('home.classic', lang)
    :
    savedGame.kind === 'active'
      ? `${t('home.continue', lang)} · ${savedGame.score ?? 0}`
      : savedGame.kind === 'terminal_revivable'
        ? lang === 'ru'
          ? `Результат ${savedGame.score ?? 0} · Второй шанс`
          : `Result ${savedGame.score ?? 0} · Second chance`
        : savedGame.kind === 'terminal_final'
          ? lang === 'ru' ? 'Новая игра' : 'New game'
          : t('home.classic', lang);

  const adventureLabel = nextAction.kind === 'resume' && nextAction.mode === 'adventure'
    ? t('adventure.title', lang)
    :
    savedAdventure.kind === 'active'
      ? `${t('home.continue', lang)} · ${lang === 'ru' ? 'Ур.' : 'Lv.'} ${(savedAdventure.levelIndex ?? 0) + 1}`
      : savedAdventure.kind === 'terminal'
        ? `${lang === 'ru' ? 'Результат' : 'Result'} · ${lang === 'ru' ? 'Ур.' : 'Lv.'} ${(savedAdventure.levelIndex ?? 0) + 1}`
        : t('adventure.title', lang);

  const nextActionCard =
    nextAction.kind === 'resume'
      ? {
            kind: nextAction.kind,
            title: nextAction.savedState === 'second_chance'
              ? lang === 'ru' ? 'Второй шанс' : 'Second chance'
              : nextAction.mode === 'adventure'
                ? `${lang === 'ru' ? 'Продолжить · ур.' : 'Continue · lv.'} ${nextAction.level}`
                : lang === 'ru' ? 'Продолжить' : 'Continue',
            icon: nextAction.mode === 'adventure'
              ? <AdventureSymbol color="#FFE46B" />
              : fallbackReward
                ? <RewardVisual reward={fallbackReward.reward} size={40} />
                : <InfinitySymbol color="#A9E16E" />,
            current: nextAction.mode === 'classic' ? lifetimePoints : nextAction.current,
            target: nextAction.mode === 'classic' ? fallbackReward?.threshold ?? 0 : nextAction.target,
            valueLabel: nextAction.mode === 'classic'
              ? fallbackReward
                ? `${lifetimePoints}/${fallbackReward.threshold}`
                : `${nextAction.score ?? nextAction.current}`
              : `${nextAction.current}/${nextAction.target}`,
            complete: nextAction.mode === 'classic' && Boolean(fallbackReward?.available),
            detail:
              nextAction.mode === 'adventure'
                ? lang === 'ru'
                  ? `Приключение · ур. ${nextAction.level} · ${nextAction.current}/${nextAction.target} · осталось ${nextAction.remaining}`
                  : `Adventure · lv. ${nextAction.level} · ${nextAction.current}/${nextAction.target} · ${nextAction.remaining} left`
                : lang === 'ru'
                  ? `Классика · счёт ${nextAction.score ?? nextAction.current} · ${nextAction.savedState === 'second_chance' ? 'сохранён второй шанс' : `до награды ${fallbackReward?.remaining ?? 0} XP`}`
                  : `Classic · score ${nextAction.score ?? nextAction.current} · ${nextAction.savedState === 'second_chance' ? 'second chance saved' : `${fallbackReward?.remaining ?? 0} XP to reward`}`,
            accessibilityLabel: `${lang === 'ru' ? 'Продолжить сохранённую игру' : 'Continue saved game'}${nextAction.mode === 'classic' && fallbackReward ? `. ${rewardDisplayName(fallbackReward.reward, lang)}. ${lifetimePoints}/${fallbackReward.threshold} XP` : ''}`,
            onPress: () => {
              recordNextGoalClick(nextAction.kind, nextAction.goalId);
              if (nextAction.mode === 'adventure') {
                setSelectedMode('adventure');
                setString(KEYS.homeSelectedMode, 'adventure');
                router.push('/adventure-level' as Href);
              } else {
                setSelectedMode('classic');
                setString(KEYS.homeSelectedMode, 'classic');
                play();
              }
            },
          }
      : nextAction.kind === 'reward' && rewardMilestone
        ? {
            kind: nextAction.kind,
            title: rewardDisplayName(rewardMilestone.reward, lang),
            icon: <RewardVisual reward={rewardMilestone.reward} size={40} />,
            current: nextAction.current,
            target: nextAction.target,
            valueLabel: `${nextAction.current}/${nextAction.target}`,
            complete: nextAction.availableNow,
            detail:
              nextAction.availableNow
                ? lang === 'ru' ? 'Доступно сейчас · открыть и надеть' : 'Available now · open and equip'
                : lang === 'ru'
                  ? `Ур. ${nextAction.level} · осталось ${nextAction.remaining} XP`
                  : `Lv. ${nextAction.level} · ${nextAction.remaining} XP left`,
            accessibilityLabel: rewardDisplayName(rewardMilestone.reward, lang),
            onPress: () => {
              recordNextGoalClick(nextAction.kind, nextAction.goalId);
              router.push('/map');
            },
          }
        : {
            kind: nextAction.kind,
            title: weeklyGoal.complete
              ? lang === 'ru' ? 'Следующая цель' : 'Next goal'
              : lang === 'ru' ? 'Цель недели' : 'Weekly goal',
            icon: <CrownIcon size={36} color="#FFE46B" />,
            current: weeklyGoal.current,
            target: weeklyGoal.target,
            valueLabel: `${weeklyGoal.current}/${weeklyGoal.target}`,
            complete: weeklyGoal.complete,
            detail: weeklyGoal.complete
              ? `${weeklyGoal.current}/${weeklyGoal.target} · ${lang === 'ru' ? 'выполнено' : 'complete'}`
              : `${weeklyGoal.current}/${weeklyGoal.target} · ${lang === 'ru' ? 'осталось' : 'left'} ${weeklyGoal.remaining}`,
            accessibilityLabel: t('leaderboard.title', lang),
            onPress: () => {
              recordNextGoalClick(nextAction.kind, nextAction.goalId);
              if (weeklyGoal.complete) {
                useWeeklyGoalStore.getState().advanceCompleted(new Date(), weeklyGoal.current);
              }
              useAnalyticsStore.getState().track('mode_selected', {
                mode: 'classic',
                source: 'home_next_action',
              });
              startNew();
            },
          };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient colors={HOME_BLUE} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.screen,
            { minHeight: Math.max(640, height - insets.top - insets.bottom - spacing.m * 2) },
          ]}
        >
          <View style={styles.header}>
            <HeaderControl
              label={t('settings.title', lang)}
              onPress={() => router.push('/settings')}
              icon={<GearIcon size={21} color="#F4FAFF" />}
            />
            <HeaderStats best={best} streak={streakVisible} />
            <HeaderControl
              label={t('profile.title', lang)}
              onPress={() => setProfileOpen(true)}
              icon={<UserIcon size={21} color="#F4FAFF" />}
            />
          </View>

          <ReferenceLogo />

          <View style={styles.goalAnchor}>
            <NextActionCard
              kind={nextActionCard.kind}
              title={nextActionCard.title}
              detail={nextActionCard.detail}
              icon={nextActionCard.icon}
              current={nextActionCard.current}
              target={nextActionCard.target}
              valueLabel={nextActionCard.valueLabel}
              complete={nextActionCard.complete}
              accessibilityLabel={nextActionCard.accessibilityLabel}
              onPress={nextActionCard.onPress}
            />
          </View>

          <View style={styles.menuStack}>
            {savedGame.fallbackReason || savedAdventure.fallbackReason ? (
              <AppText preset="body" style={{ color: '#FFF4D6', textAlign: 'center' }}>
                {lang === 'ru'
                  ? 'Не удалось продолжить. Начни новую игру.'
                  : 'Unable to continue. Start a new game.'}
              </AppText>
            ) : null}
            <StreakStatusCard kind={streakStatus.kind} count={streakVisible} lang={lang} onPress={play} />
            <ReferenceMenuButton
              label={adventureLabel}
              symbol={<AdventureSymbol color="#173C4D" />}
              gradient={['#FFB82B', '#EF8B0D']}
              baseColor="#A95A06"
              accessibilityLabel={adventureLabel}
              testID="home-menu-adventure"
              ribbon={adventureSeasonRemaining !== null && adventureSeasonRemaining > 0
                ? <SeasonCountdownBadge compact short variant="ribbon" autoRefresh={false} />
                : undefined}
              onPress={() => {
                setSelectedMode('adventure');
                setString(KEYS.homeSelectedMode, 'adventure');
                useAnalyticsStore.getState().track('mode_selected', { mode: 'adventure', source: 'home_reference_menu' });
                router.push(
                  (savedAdventure.kind === 'none' ? '/adventure' : '/adventure-level') as Href,
                );
              }}
            />
            <ReferenceMenuButton
              label={classicLabel}
              symbol={<InfinitySymbol color="#173C4D" />}
              gradient={['#A9E16E', '#82C958']}
              baseColor="#397D2D"
              accessibilityLabel={classicLabel}
              testID="home-menu-classic"
              onPress={() => {
                setSelectedMode('classic');
                setString(KEYS.homeSelectedMode, 'classic');
                useAnalyticsStore.getState().track('mode_selected', { mode: 'classic', source: 'home_reference_menu' });
                play();
              }}
            />
          </View>

          <View style={styles.quickLinks}>
            <QuickLink
              icon={<TrophyIcon size={18} color={worldAccent} />}
              label={t('home.levels', lang)}
              detail={`${progressionText('world', lang)} ${world} · ${progressionText('lvlShort', lang)} ${level}`}
              onPress={() => router.push('/map')}
            />
            <View style={styles.quickLinkDivider} />
            <QuickLink
              icon={<CrownIcon size={18} color="#FFE46B" />}
              label={t('leaderboard.title', lang)}
              detail={weeklyRank == null ? `${t('leaderboard.weeklyBest', lang)}: ${weeklyBest}` : `#${weeklyRank} · ${weeklyBest}`}
              onPress={() => router.push('/leaderboard')}
            />
          </View>
        </View>
      </ScrollView>

      <ProfileOverlay
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenCollection={() => {
          setProfileOpen(false);
          useAnalyticsStore.getState().track('collection_opened', { source: 'profile' });
          router.push('/capy');
        }}
      />

      <HomePromptHost
        ftueComplete={ftueComplete}
        isFirstSession={analyticsFirstSession}
        blockingOverlayVisible={profileOpen}
        userDialogOpen={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: HOME_BLUE[1],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
    paddingBottom: spacing.m,
  },
  screen: {
    width: '100%',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    maxWidth: 360,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  headerControlPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.95 }],
  },
  headerStats: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(12,53,156,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  headerStatValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerStatText: {
    color: '#FFFFFF',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 17,
  },
  headerStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  logo: {
    alignItems: 'center',
    marginTop: spacing.l,
  },
  logoTopWord: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 0,
  },
  logoTagline: {
    marginTop: 5,
    color: 'rgba(220,249,255,0.76)',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  menuStack: {
    width: '100%',
    maxWidth: 330,
    gap: 15,
  },
  streakCard: {
    width: '100%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 13,
    backgroundColor: 'rgba(18,33,76,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  streakCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  streakBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  streakCopy: {
    flex: 1,
    gap: 2,
  },
  streakTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
  },
  streakDetail: {
    color: 'rgba(232,245,255,0.82)',
  },
  streakAction: {
    color: '#A9E16E',
  },
  goalAnchor: {
    flex: 1,
    width: '100%',
    maxWidth: 330,
    minHeight: 96,
    justifyContent: 'flex-end',
    paddingVertical: spacing.m,
  },
  menuButton: {
    width: '100%',
    minHeight: 76,
    borderRadius: 13,
    shadowColor: 'rgba(3,45,116,0.72)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.58,
    shadowRadius: 4,
    elevation: 6,
  },
  menuButtonPressed: {
    opacity: 0.9,
    transform: [{ translateY: 3 }, { scale: 0.985 }],
  },
  menuButtonSurface: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.m,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  menuButtonSymbol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonLabel: {
    flex: 1,
    color: '#173C4D',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    textShadowColor: 'rgba(52,89,99,0.40)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 1,
  },
  seasonRibbon: {
    position: 'absolute',
    top: -5,
    left: -11,
    zIndex: 2,
    maxWidth: 118,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#9E1F19',
    borderWidth: 1,
    borderColor: 'rgba(255,225,190,0.44)',
    shadowColor: '#7A170F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 8,
    transform: [{ rotate: '-30deg' }],
  },
  quickLinks: {
    width: '100%',
    maxWidth: MENU_WIDTH + 18,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 19,
    paddingHorizontal: 3,
  },
  quickLink: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickLinkPressed: {
    opacity: 0.65,
  },
  quickLinkCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  quickLinkDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  quickLinkLabel: {
    color: '#062842',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 12,
    lineHeight: 16,
  },
  quickLinkDetail: {
    color: '#062842',
    fontSize: 10,
  },
});
