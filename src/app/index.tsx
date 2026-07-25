import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { progressionText } from '@/core/i18n/progression';
import { useAnalyticsStore } from '@/features/analytics';
import { SeasonCountdownBadge } from '@/features/adventure';
import { getSavedGameSummary } from '@/features/game';
import type { SavedGameSummary } from '@/features/game';
import { useLeaderboardStore } from '@/features/leaderboard';
import { HomePromptHost } from '@/features/notifications';
import { WelcomeNotificationOverlay, shouldEnterFtue, useFtueStore, useWelcomePromptStore } from '@/features/onboarding';
import { ProfileOverlay, useProfileStore } from '@/features/profile';
import { useProgression } from '@/features/progression';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { isStreakAlive, todayISO, useStreak } from '@/features/streak';
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
            style={{
              color,
              fontFamily: 'Fredoka_700Bold',
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
        style={{
          color: '#35DDF6',
          fontFamily: 'Fredoka_700Bold',
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
      <AppText preset="caption" style={styles.logoTagline} numberOfLines={1}>
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
        <AppText preset="speech" style={styles.menuButtonLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
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
      <View style={{ gap: 1 }}>
        <AppText preset="speech" style={styles.quickLinkLabel} numberOfLines={1}>
          {label}
        </AppText>
        <AppText preset="caption" style={styles.quickLinkDetail} numberOfLines={1}>
          {detail}
        </AppText>
      </View>
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
  const ftueComplete = ftueStatus === 'complete' || ftueStatus === 'skipped';
  const analyticsFirstSession = useAnalyticsStore(
    (s) => s.context?.is_first_session ?? gamesPlayed === 0,
  );
  const streakLastDay = useStreak((s) => s.lastDay);
  const streakCount = useStreak((s) => s.count);
  const world = useProgression((s) => s.world);
  const level = useProgression((s) => s.level);
  const worldAccent = useActiveWorldTheme().cellColors[0];
  const localWeekly = useLeaderboardStore((s) => s.localWeeklyResult);
  const weeklySnapshot = useLeaderboardStore((s) => s.snapshot);
  const [savedGame, setSavedGame] = useState<SavedGameSummary>({
    kind: 'none',
    score: null,
    canContinue: false,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const autoFtueStarted = useRef(false);
  const streakVisible = isStreakAlive({ lastDay: streakLastDay, count: streakCount }, todayISO())
    ? streakCount
    : 0;
  const weeklyBest = Math.max(localWeekly?.bestScore ?? 0, weeklySnapshot?.currentPlayer.weeklyBest ?? 0);
  const weeklyRank = weeklySnapshot?.currentPlayer.rank ?? null;

  useEffect(() => {
    if (autoFtueStarted.current) return;
    if (!welcomePromptResolved) return;
    if (!shouldEnterFtue(useFtueStore.getState(), gamesPlayed)) return;
    autoFtueStarted.current = true;
    const startTs = Date.now();
    useAnalyticsStore.getState().track('play_tapped', { source: 'home', has_saved_game: false });
    router.replace({ pathname: '/game', params: { entry: 'tutorial', startTs: String(startTs) } });
  }, [welcomePromptResolved, gamesPlayed, router]);

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

      useAnalyticsStore.getState().track('home_viewed', {
        home_state: savedGame.kind === 'active' ? 'continue' : gamesPlayed === 0 ? 'first_clear' : 'return_loop',
        cards_visible: ['adventure', 'classic', 'quick_links'],
      });

      return () => {
        active = false;
      };
    }, [gamesPlayed, savedGame.kind]),
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
    if (savedGame.kind === 'active') {
      const startTs = Date.now();
      useAnalyticsStore.getState().track('play_tapped', { source: 'home', has_saved_game: true });
      router.push({ pathname: '/game', params: { entry: 'resume', startTs: String(startTs) } });
      return;
    }
    startNew();
  }, [router, savedGame.kind, startNew]);

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

          <View style={{ flex: 1 }} />

          <View style={styles.menuStack}>
            <ReferenceMenuButton
              label={t('adventure.title', lang)}
              symbol={<AdventureSymbol />}
              gradient={['#FFB82B', '#EF8B0D']}
              baseColor="#A95A06"
              accessibilityLabel={t('adventure.title', lang)}
              testID="home-menu-adventure"
              ribbon={<SeasonCountdownBadge compact short variant="ribbon" />}
              onPress={() => {
                useAnalyticsStore.getState().track('mode_selected', { mode: 'adventure', source: 'home_reference_menu' });
                router.push('/adventure' as Href);
              }}
            />
            <ReferenceMenuButton
              label={t('home.classic', lang)}
              symbol={<InfinitySymbol />}
              gradient={['#A9E16E', '#82C958']}
              baseColor="#397D2D"
              accessibilityLabel={savedGame.kind === 'active' ? t('home.continue', lang) : t('home.classic', lang)}
              testID="home-menu-classic"
              onPress={() => {
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

      <ProfileOverlay visible={profileOpen} onClose={() => setProfileOpen(false)} />

      {welcomePromptResolved && gamesPlayed >= 2 ? (
        <HomePromptHost
          ftueComplete={ftueComplete}
          isFirstSession={analyticsFirstSession}
          blockingOverlayVisible={profileOpen}
          userDialogOpen={false}
        />
      ) : null}

      <WelcomeNotificationOverlay />
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerControl: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    fontFamily: 'Fredoka_700Bold',
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
    width: '78%',
    maxWidth: MENU_WIDTH,
    gap: 15,
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
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 31,
    lineHeight: 36,
    fontStyle: 'italic',
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
    backgroundColor: '#DE3723',
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickLinkPressed: {
    opacity: 0.65,
  },
  quickLinkDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  quickLinkLabel: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 14,
  },
  quickLinkDetail: {
    color: 'rgba(229,250,255,0.76)',
    fontSize: 10,
  },
});
