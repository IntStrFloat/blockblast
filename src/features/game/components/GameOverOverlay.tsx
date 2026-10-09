import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  MONETIZATION,
  evaluateInterstitialOpportunity,
  getAds,
  getRewardedCtaPolicy,
  loadAdsMeta,
  recordFullscreenCooldown,
  recordGameOver,
  recordInterstitialShown,
  saveAdsMeta,
  useEntitlements,
} from '@/features/monetization';
import { recordGameOverForPush } from '@/features/notifications';
import { rememberRewardedOffer, leaveRewardedOffer } from '@/features/monetization/rewardedOfferPolicy';
import { useRewardedReady } from '@/features/monetization/useRewardedReady';
import { useScores } from '@/features/scores';
import { RewardProgressSummary, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, CrownIcon, GearIcon, radii, spacing } from '@/ui';

import { Confetti } from '../effects/Confetti';
import { gameOverPresentationFor } from '../gameOverPresentation';
import { useGameStore } from '../store';
import { ReviveButton } from './ReviveButton';

const GAME_OVER_GRADIENT = ['#163EAE', '#1763CE', '#1798E0'] as const;
const RECORD_GRADIENT = ['#4B0EAB', '#7529CE', '#9D68E8'] as const;

interface GameOverOverlayProps {
  onPlayAgain: () => void;
  onOpenSettings: () => void;
}

function AnimatedFinalScore({ score }: { score: number }) {
  return (
    <AppText
      preset="score"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.55}
      style={styles.score}
    >
      {score}
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
  const insets = useSafeAreaInsets();
  const game = useGameStore((s) => s.game);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const finalResult = useGameStore((s) => s.finalResult);
  const continueGame = useGameStore((s) => s.continueGame);
  const epoch = useGameStore((s) => s.epoch);
  const runBestAtStart = useGameStore((s) => s.runBestAtStart);
  const classicMeta = useGameStore((s) => s.classicMeta);
  const removeAds = useEntitlements((s) => s.removeAds);
  const best = useScores((s) => s.best);
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const lang = useLang();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const countedEpochRef = useRef<number | null>(null);

  const presentation = gameOverPresentationFor(game.status, lastEvent);
  const isOver = presentation.visible;
  const firstResult = runBestAtStart <= 0 && game.score > 0;
  // A terminal save is allowed to reopen after process death. In that case the
  // transient submit result is gone, but the persisted best still identifies
  // the run that established it.
  const newRecord =
    !firstResult && (finalResult?.newRecord ?? game.score > runBestAtStart);
  const canOfferRevive = classicMeta?.lifecycle === 'terminal_revivable';
  const rewardedReady = useRewardedReady(isOver && canOfferRevive && !busy);
  const revivePolicy = getRewardedCtaPolicy({
    offerAllowed: canOfferRevive,
    rewardedReady,
    busy,
  });
  const earnedXp = classicMeta?.settlement
    ? Math.max(0, classicMeta.settlement.targetScore - classicMeta.settlement.previousTargetScore)
    : 0;

  const resultContextId = classicMeta?.runId ?? `classic-result:${epoch}`;
  useEffect(() => {
    if (isOver && (!presentation.fresh || visible) && revivePolicy.visible) {
      rememberRewardedOffer(resultContextId);
    }
  }, [isOver, presentation.fresh, resultContextId, revivePolicy.visible, visible]);

  useEffect(() => {
    if (!isOver) {
      busyRef.current = false;
      return;
    }
    if (presentation.fresh && countedEpochRef.current !== epoch) {
      countedEpochRef.current = epoch;
      saveAdsMeta(recordGameOver(loadAdsMeta()));
      recordGameOverForPush();
    }
    const timer = presentation.fresh
      ? setTimeout(() => setVisible(true), presentation.revealDelayMs)
      : null;
    return () => {
      if (timer) clearTimeout(timer);
      setVisible(false);
    };
  }, [canOfferRevive, epoch, isOver, presentation.fresh, presentation.revealDelayMs]);

  useEffect(() => {
    if (isOver && (!presentation.fresh || visible) && revivePolicy.visible) {
      useAnalyticsStore.getState().trackOnce(
        `revive-offered:${resultContextId}`,
        'revive_shown',
        { available: true },
      );
    }
  }, [isOver, presentation.fresh, resultContextId, revivePolicy.visible, visible]);

  useEffect(() => {
    if (isOver && (!presentation.fresh || visible)) {
      if (classicMeta?.runId) {
        useProgression.getState().presentRevealForRun(classicMeta.runId);
      }
      useAnalyticsStore.getState().trackOnce(
        `classic-result-viewed:${classicMeta?.runId ?? 'legacy'}`,
        'result_viewed',
        {
          mode: 'classic',
          score: game.score,
          is_new_record: newRecord,
          best_at_start: runBestAtStart,
          game_depth: useScores.getState().gamesPlayed,
        },
      );
    }
  }, [classicMeta?.runId, game.score, isOver, newRecord, presentation.fresh, runBestAtStart, visible]);

  if (!isOver || (presentation.fresh && !visible)) return null;

  const closeWithInterstitial = async (action: 'replay', after: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const rewardedOfferPresented = leaveRewardedOffer(resultContextId) || revivePolicy.visible;
    useAnalyticsStore.getState().track('game_over_action', { action });
    setBusy(true);
    try {
      const meta = loadAdsMeta();
      const opportunity = evaluateInterstitialOpportunity(
        meta,
        {
          enabled: MONETIZATION.adsEnabled,
          removeAds,
          nowMs: Date.now(),
        },
        'gameover',
        'classic',
        { activePlayMs: classicMeta?.activeDurationMs, rewardedOfferPresented, resultContextId },
      );
      if (!opportunity.baseEligible) {
        useAnalyticsStore.getState().track('ad_eligible', {
          format: 'interstitial',
          placement: 'gameover',
          blocked_reason: 'frequency_policy',
        });
      } else if (!opportunity.shouldRequest) {
        useAnalyticsStore.getState().track('ad_eligible', {
          format: 'interstitial',
          placement: 'gameover',
          blocked_reason: opportunity.decision,
          ...opportunity.telemetry,
        });
      }
      if (opportunity.shouldRequest) {
        let impressionRecorded = false;
        await getAds().showInterstitial(
          'gameover',
          opportunity.telemetry ?? undefined,
          () => {
            if (impressionRecorded) return;
            impressionRecorded = true;
            saveAdsMeta(recordInterstitialShown(
              loadAdsMeta(),
              Date.now(),
              'gameover',
              opportunity.telemetry?.product_session_id,
            ), true);
          },
        );
      }
    } finally {
      setBusy(false);
      after();
    }
  };

  const handleRevive = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    useAnalyticsStore.getState().track('game_over_action', { action: 'revive' });
    setBusy(true);
    try {
      const result = await getAds().showRewarded('revive');
      if (result !== 'unavailable') {
        saveAdsMeta(recordFullscreenCooldown(loadAdsMeta(), Date.now()));
      }
      if (result === 'rewarded') {
        const continued = continueGame();
        if (!continued) {
          useAnalyticsStore.getState().track('revive_used', { result: 'rewarded' });
        }
      } else {
        useAnalyticsStore.getState().track('revive_used', { result });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={styles.screen}
    >
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
        disabled={busy}
        onPress={() => {
          if (busyRef.current) return;
          leaveRewardedOffer(resultContextId);
          onOpenSettings();
        }}
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
      >
        <GearIcon size={30} color="#FFFFFF" />
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + spacing.l }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          {newRecord ? <CrownIcon size={48} /> : null}
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
          {!newRecord && best > game.score ? (
            <View style={styles.bestBlock} accessible accessibilityLabel={`${t('gameOver.best', lang)}: ${best}`}>
              <CrownIcon size={20} color="#FFC733" />
              <AppText preset="score" style={styles.bestScore}>
                {best}
              </AppText>
            </View>
          ) : null}
          <RewardProgressSummary
            earnedXp={earnedXp}
            lifetimePoints={lifetimePoints}
            light
          />
        </View>

        <View style={styles.actions}>
          {revivePolicy.visible ? (
            <ReviveButton
              label={t('gameOver.revive', lang)}
              onPress={handleRevive}
              disabled={revivePolicy.disabled}
            />
          ) : null}
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

        </View>
      </ScrollView>
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
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: 72,
    paddingBottom: spacing.xl,
    gap: 24,
  },
  heading: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.s,
  },
  title: {
    width: '100%',
    textAlign: 'center',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 28,
    lineHeight: 36,
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
    fontFamily: 'Unbounded_700Bold',
    fontSize: 14,
    letterSpacing: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: spacing.s,
  },
  bestScore: {
    color: '#FFC733',
    fontSize: 20,
    lineHeight: 26,
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
    minHeight: 72,
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
