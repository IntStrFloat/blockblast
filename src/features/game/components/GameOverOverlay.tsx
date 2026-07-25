import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  MONETIZATION,
  getAds,
  getRewardedCtaPolicy,
  loadAdsMeta,
  recordGameOver,
  recordInterstitialShown,
  saveAdsMeta,
  shouldShowInterstitial,
  useEntitlements,
} from '@/features/monetization';
import { recordGameOverForPush } from '@/features/notifications';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { AppText, CrownIcon, GearIcon, radii, spacing } from '@/ui';

import { Confetti } from '../effects/Confetti';
import { gameOverPresentationFor } from '../gameOverPresentation';
import { useGameStore } from '../store';
import { useReducedMotion } from '../animation/useReducedMotion';
import { ReviveButton } from './ReviveButton';

const GAME_OVER_GRADIENT = ['#163EAE', '#1763CE', '#1798E0'] as const;
const RECORD_GRADIENT = ['#4B0EAB', '#7529CE', '#9D68E8'] as const;
const SCORE_COUNT_UP_DURATION = 900;

interface GameOverOverlayProps {
  onPlayAgain: () => void;
  onOpenSettings: () => void;
}

function AnimatedFinalScore({ score }: { score: number }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = reducedMotion
      ? 1
      : withTiming(1, {
          duration: SCORE_COUNT_UP_DURATION,
          easing: Easing.out(Easing.cubic),
        });

    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  useAnimatedReaction(
    () => Math.round(progress.value * score),
    (nextScore, previousScore) => {
      if (nextScore !== previousScore) runOnJS(setDisplayedScore)(nextScore);
    },
    [score],
  );

  return (
    <AppText
      preset="score"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.55}
      style={styles.score}
    >
      {displayedScore}
    </AppText>
  );
}

function PlayIcon() {
  return (
    <Svg width={54} height={54} viewBox="0 0 54 54" fill="none">
      <Path
        d="M18 11.5v31l25-15.5-25-15.5z"
        fill="#FFFFFF"
        stroke="rgba(12,36,70,0.28)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GameOverOverlay({ onPlayAgain, onOpenSettings }: GameOverOverlayProps) {
  const game = useGameStore((s) => s.game);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const finalResult = useGameStore((s) => s.finalResult);
  const continueGame = useGameStore((s) => s.continueGame);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const removeAds = useEntitlements((s) => s.removeAds);
  const best = useScores((s) => s.best);
  const lang = useLang();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rewardedReady, setRewardedReady] = useState(false);
  const countedRef = useRef(false);

  const presentation = gameOverPresentationFor(game.status, lastEvent);
  const isOver = presentation.visible;
  const firstResult = runBestAtStart <= 0 && game.score > 0;
  // A terminal save is allowed to reopen after process death. In that case the
  // transient submit result is gone, but the persisted best still identifies
  // the run that established it.
  const newRecord =
    !firstResult && (finalResult?.newRecord ?? (game.score > 0 && game.score === best));
  const canOfferRevive = !game.reviveUsed;
  const revivePolicy = getRewardedCtaPolicy({
    offerAllowed: canOfferRevive,
    rewardedReady,
    busy,
  });

  useEffect(() => {
    if (!isOver) return;
    let active = true;
    if (presentation.fresh && !countedRef.current) {
      countedRef.current = true;
      saveAdsMeta(recordGameOver(loadAdsMeta()));
      recordGameOverForPush();
    }
    void getAds()
      .init()
      .finally(() => {
        if (!active) return;
        const available = getAds().isRewardedReady();
        setRewardedReady(available);
        if (canOfferRevive) {
          useAnalyticsStore.getState().track('revive_shown', { available });
        }
      });
    const timer = presentation.fresh
      ? setTimeout(() => setVisible(true), presentation.revealDelayMs)
      : null;
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      setVisible(false);
      setRewardedReady(false);
      countedRef.current = false;
    };
  }, [canOfferRevive, isOver, presentation.fresh, presentation.revealDelayMs]);

  useEffect(() => {
    if (isOver && (!presentation.fresh || visible)) {
      useAnalyticsStore.getState().track('result_viewed', {
        mode: 'classic',
        score: game.score,
        is_new_record: newRecord,
        best_at_start: runBestAtStart,
        game_depth: useScores.getState().gamesPlayed,
      });
    }
  }, [game.score, isOver, newRecord, presentation.fresh, runBestAtStart, visible]);

  if (!isOver || (presentation.fresh && !visible)) return null;

  const closeWithInterstitial = async (action: 'replay', after: () => void) => {
    if (busy) return;
    useAnalyticsStore.getState().track('game_over_action', { action });
    setBusy(true);
    try {
      const meta = loadAdsMeta();
      const show = shouldShowInterstitial(meta, {
        enabled: MONETIZATION.adsEnabled,
        removeAds,
        nowMs: Date.now(),
      });
      if (show) {
        const result = await getAds().showInterstitial('gameover');
        if (result === 'shown') saveAdsMeta(recordInterstitialShown(meta, Date.now()));
      }
    } finally {
      setBusy(false);
      after();
    }
  };

  const handleRevive = async () => {
    if (busy) return;
    useAnalyticsStore.getState().track('game_over_action', { action: 'revive' });
    setBusy(true);
    try {
      const result = await getAds().showRewarded('revive');
      if (result === 'rewarded') continueGame();
      setRewardedReady(getAds().isRewardedReady());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.screen}>
      <LinearGradient
        colors={newRecord ? RECORD_GRADIENT : GAME_OVER_GRADIENT}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {newRecord ? <Confetti height={380} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.title', lang)}
        hitSlop={12}
        onPress={onOpenSettings}
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
      >
        <GearIcon size={30} color="#FFFFFF" />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.heading}>
          {newRecord ? <CrownIcon size={72} /> : null}
          <AppText
            preset="speech"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.68}
            style={[styles.title, newRecord ? styles.recordTitle : styles.gameOverTitle]}
          >
            {firstResult
              ? t('gameOver.firstResult', lang)
              : newRecord
                ? t('gameOver.newRecord', lang)
                : t('gameOver.title', lang)}
          </AppText>
        </View>

        <View style={styles.scoreBlock}>
          <AppText preset="speech" style={[styles.label, newRecord && styles.recordLabel]}>
            {t('gameOver.score', lang)}
          </AppText>
          <AnimatedFinalScore score={game.score} />
          {!newRecord ? (
            <View style={styles.bestBlock}>
              <AppText preset="speech" style={styles.label}>
                {t('gameOver.best', lang)}
              </AppText>
              <AppText preset="score" style={styles.bestScore}>
                {best}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('gameOver.playAgain', lang)}
            disabled={busy}
            onPress={() => closeWithInterstitial('replay', onPlayAgain)}
            style={({ pressed }) => [
              styles.playShadow,
              newRecord ? styles.playShadowRecord : styles.playShadowGameOver,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <LinearGradient
              colors={newRecord ? ['#FFC33A', '#F39A08'] : ['#4BE21F', '#12AD05']}
              style={styles.playSurface}
            >
              <PlayIcon />
            </LinearGradient>
          </Pressable>

          {revivePolicy.visible ? (
            <ReviveButton
              label={t('gameOver.revive', lang)}
              onPress={handleRevive}
              disabled={revivePolicy.disabled}
            />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  gear: {
    position: 'absolute',
    top: spacing.m,
    right: spacing.m,
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,25,71,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    zIndex: 3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: 72,
    paddingBottom: spacing.xl,
    gap: 46,
  },
  heading: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.s,
  },
  title: {
    width: '100%',
    textAlign: 'center',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 54,
    lineHeight: 60,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 2,
  },
  gameOverTitle: {
    color: '#25CFF4',
    textShadowColor: 'rgba(0,65,145,0.62)',
  },
  recordTitle: {
    color: '#FFC21B',
    textShadowColor: 'rgba(90,43,0,0.55)',
  },
  scoreBlock: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.s,
  },
  label: {
    color: '#46D9F2',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 24,
    letterSpacing: 2,
  },
  recordLabel: {
    color: '#D886EA',
  },
  score: {
    width: '100%',
    color: '#FFFFFF',
    fontSize: 72,
    lineHeight: 84,
    textAlign: 'center',
    textShadowColor: 'rgba(14,38,88,0.55)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 3,
  },
  bestBlock: {
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.m,
  },
  bestScore: {
    color: '#FFC733',
    fontSize: 42,
    lineHeight: 50,
    textShadowColor: 'rgba(124,73,0,0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 2,
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.m,
  },
  playShadow: {
    width: '100%',
    borderRadius: radii.button,
  },
  playShadowGameOver: {
    backgroundColor: '#087D08',
  },
  playShadowRecord: {
    backgroundColor: '#B66700',
  },
  playSurface: {
    minHeight: 82,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    boxShadow: '0 8px 12px rgba(8, 26, 64, 0.35)',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ translateY: 2 }, { scale: 0.985 }],
  },
});
