import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  MONETIZATION,
  evaluateInterstitialOpportunity,
  getAds,
  loadAdsMeta,
  recordGameOver,
  recordInterstitialShown,
  saveAdsMeta,
  useEntitlements,
} from '@/features/monetization';
import {
  recordGameOverForPush,
  recordFirstRecordForPush,
} from '@/features/notifications';
import { leaveRewardedOffer } from '@/features/monetization/rewardedOfferPolicy';
import { useInterstitialPreparation } from '@/features/monetization/useInterstitialPreparation';
import { recoverRewardedBenefits } from '@/features/monetization/rewardedBenefits';
import { useScores } from '@/features/scores';
import { RewardProgressSummary, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import {
  AppText,
  CandyBackground,
  CandyIcon,
  GameButton,
  formatNumber,
  nightCandy as n,
} from '@/ui';
import { CandyRoundButton } from '@/ui/primitives/CandyControls';
import { useReducedMotion } from '../animation/useReducedMotion';

import { Confetti } from '../effects/Confetti';
import { gameOverPresentationFor } from '../gameOverPresentation';
import { useGameStore } from '../store';
import { NoMovesSheet } from './NoMovesSheet';

interface GameOverOverlayProps {
  onPlayAgain: () => void;
  onOpenSettings: () => void;
  onHome?: () => void;
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
      {formatNumber(score)}
    </AppText>
  );
}

export function GameOverOverlay({ onPlayAgain, onHome }: GameOverOverlayProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const crownScale = useSharedValue(1);
  const crownY = useSharedValue(0);
  const crownStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: crownY.value }, { scale: crownScale.value }],
  }));
  const game = useGameStore((s) => s.game);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const finalResult = useGameStore((s) => s.finalResult);
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

  const presentation = gameOverPresentationFor(
    game.status,
    lastEvent,
    reducedMotion,
  );
  const isOver = presentation.visible;
  const needsRecovery =
    !classicMeta?.resultAcknowledged &&
    !(
      classicMeta?.resultAcknowledged === undefined &&
      classicMeta?.lifecycle === 'terminal_final' &&
      !presentation.fresh
    );
  const resultVisible =
    isOver && (!presentation.fresh || visible) && !needsRecovery;
  const firstResult = runBestAtStart <= 0 && game.score > 0;
  // A terminal save is allowed to reopen after process death. In that case the
  // transient submit result is gone, but the persisted best still identifies
  // the run that established it.
  const newRecord =
    !firstResult && (finalResult?.newRecord ?? game.score > runBestAtStart);
  const earnedXp = classicMeta?.settlement
    ? Math.max(0, classicMeta.settlement.targetScore)
    : 0;

  const resultContextId = classicMeta?.runId ?? `classic-result:${epoch}`;
  useEffect(() => {
    recoverRewardedBenefits();
  }, [resultContextId]);

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
  }, [epoch, isOver, presentation.fresh, presentation.revealDelayMs]);

  useEffect(() => {
    if (resultVisible) {
      if (classicMeta?.runId) {
        if (newRecord) recordFirstRecordForPush(classicMeta.runId);
        useProgression.getState().presentRevealForRun(classicMeta.runId);
      }
      useAnalyticsStore
        .getState()
        .trackOnce(
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
  }, [
    classicMeta?.runId,
    resultVisible,
    game.score,
    isOver,
    newRecord,
    presentation.fresh,
    runBestAtStart,
    visible,
  ]);

  useEffect(() => {
    if (!resultVisible) return;
    crownY.value = reducedMotion ? 0 : -70;
    crownY.value = withTiming(0, {
      duration: reducedMotion ? 0 : 360,
      easing: Easing.out(Easing.cubic),
    });
    crownScale.value = reducedMotion ? 1 : 0.6;
    crownScale.value = reducedMotion
      ? 1
      : withSequence(
          withTiming(1.18, { duration: 300, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 180 }),
        );
  }, [crownScale, crownY, resultVisible, reducedMotion]);

  useEffect(() => {
    if (!isOver) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (resultVisible && !busyRef.current) onHome?.();
      return true;
    });
    return () => sub.remove();
  }, [isOver, onHome, resultVisible]);

  useInterstitialPreparation({
    active: resultVisible && !busy,
    counter: 'gameover',
    mode: 'classic',
    removeAds,
    resultContextId,
    activePlayMs: classicMeta?.activeDurationMs,
  });

  if (!isOver || (presentation.fresh && !visible)) return null;

  const closeWithInterstitial = async (
    action: 'replay' | 'home',
    after: () => void,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    leaveRewardedOffer(resultContextId);
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
        { activePlayMs: classicMeta?.activeDurationMs, resultContextId },
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
            saveAdsMeta(
              recordInterstitialShown(
                loadAdsMeta(),
                Date.now(),
                'gameover',
                opportunity.telemetry?.product_session_id,
              ),
              true,
            );
          },
        );
      }
    } finally {
      setBusy(false);
      after();
    }
  };

  if (needsRecovery)
    return (
      <NoMovesSheet
        onFinish={() => useGameStore.getState().finishCurrentResult()}
      />
    );

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(280)}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      style={styles.screen}
    >
      <CandyBackground />
      {newRecord ? (
        <Confetti
          height={420}
          palette={[...n.blockColors]}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <View style={[styles.share, { top: insets.top + 8 }]}>
        <CandyRoundButton
          icon="share"
          label={lang === 'ru' ? 'Поделиться результатом' : 'Share score'}
          onPress={() => {
            void Share.share({
              message:
                lang === 'ru'
                  ? `Мой результат в Блок Бластик — ${formatNumber(game.score)}!`
                  : `My Block Blastic score: ${formatNumber(game.score)}!`,
            });
          }}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (newRecord ? 96 : 106),
            paddingBottom: Math.max(30, insets.bottom + 16),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          {newRecord ? (
            <Animated.View style={crownStyle}>
              <CandyIcon name="crown" size={64} color={n.sun} />
            </Animated.View>
          ) : (
            <AppText style={styles.label}>
              {lang === 'ru' ? 'КЛАССИКА' : 'CLASSIC'}
            </AppText>
          )}
          <AppText
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.title, newRecord && styles.recordTitle]}
          >
            {newRecord
              ? t('gameOver.newRecord', lang)
              : t('gameOver.title', lang)}
          </AppText>
          <AnimatedFinalScore score={game.score} />
          <View style={styles.bestBlock}>
            <CandyIcon name="crown" size={18} color={n.sun} />
            <AppText style={[styles.bestScore, newRecord && { color: n.mint }]}>
              {newRecord
                ? lang === 'ru'
                  ? `+${formatNumber(Math.max(0, game.score - runBestAtStart))} к прошлому`
                  : `+${formatNumber(Math.max(0, game.score - runBestAtStart))} to your best`
                : lang === 'ru'
                  ? `Рекорд ${formatNumber(best)}${best > game.score ? ` · ещё ${formatNumber(best - game.score)}` : ''}`
                  : `Best ${formatNumber(best)}`}
            </AppText>
          </View>
        </View>
        <View style={{ flex: 1, minHeight: 64 }} />
        <RewardProgressSummary
          earnedXp={earnedXp}
          lifetimePoints={lifetimePoints}
          light
        />
        <View style={styles.actions}>
          <GameButton
            label={t('gameOver.playAgain', lang)}
            onPress={() => {
              void closeWithInterstitial('replay', onPlayAgain);
            }}
            disabled={busy}
            size="lg"
            icon={<CandyIcon name="retry" color={n.sunInk} size={24} />}
          />
          <GameButton
            label={lang === 'ru' ? 'Домой' : 'Home'}
            variant="ghost"
            onPress={() => {
              if (onHome) void closeWithInterstitial('home', onHome);
            }}
            disabled={busy || !onHome}
            icon={<CandyIcon name="home" size={24} />}
          />
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
  share: { position: 'absolute', right: 16, zIndex: 2 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  heading: { width: '100%', alignItems: 'center', gap: 10 },
  title: {
    width: '100%',
    textAlign: 'center',
    fontFamily: 'Unbounded_900Black',
    fontSize: 28,
    lineHeight: 32,
    color: '#FFFFFF',
    letterSpacing: -0.28,
  },
  recordTitle: {
    color: n.sun,
    fontSize: 32,
    lineHeight: 37,
    textShadowColor: n.sunEdge,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  label: {
    color: n.sky,
    fontFamily: 'Nunito_900Black',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.44,
  },
  score: {
    width: '100%',
    color: '#FFFFFF',
    fontFamily: 'Unbounded_800ExtraBold',
    fontSize: 76,
    lineHeight: 76,
    textAlign: 'center',
    textShadowColor: 'rgba(5,8,40,0.5)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 0,
  },
  bestBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: 'rgba(200,205,251,0.18)',
    backgroundColor: 'rgba(7,10,42,0.5)',
  },
  bestScore: {
    color: '#FFFFFF',
    fontFamily: 'Unbounded_700Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: { width: '100%', gap: 12 },
});
