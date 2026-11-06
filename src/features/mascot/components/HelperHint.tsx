import { useEffect, useMemo, useRef, useState } from 'react';
import { CandyHelperPill } from './CandyHelperPill';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { useGameStore } from '@/features/game';
import {
  getAds,
  loadAdsMeta,
  recordFullscreenCooldown,
  saveAdsMeta,
} from '@/features/monetization';
import { isHelperUnlocked, useProgression } from '@/features/progression';
import { useLang, useSettings } from '@/features/settings';
import { playSound } from '@/features/game/sound/sounds';
import { todayISO } from '@/features/streak';
import { useRewardedReady } from '@/features/monetization/useRewardedReady';
import { claimRewardedBenefit } from '@/features/monetization/rewardedBenefits';
import { AppText, colors, mascotPalette, radii } from '@/ui';

import { MASCOT_CONFIG } from '../logic/config';
import { findHintMove, isStuckish } from '../logic/helpers';
import type { EmoteId } from '../logic/types';
import { canUseHelper } from '../logic/rules';
import { useMascot } from '../store';

interface HelperHintProps {
  onEmote: (id: EmoteId) => void;
  reduceMotion: boolean;
  compact?: boolean;
  candy?: boolean;
}

const THRESHOLD = MASCOT_CONFIG.helpers.hint.stuckThreshold;

/**
 * Мягкий помощник «подсказка» (разлок ур.5). Не мигающий чип появляется ТОЛЬКО
 * в момент реального затыка (мало валидных позиций) и пока кулдаун свободен. Тап
 * подсвечивает реальную валидную позицию ghost-блоками (переиспользует preview
 * drag-системы) — ход за игрока НЕ делается. После показа — кулдаун до завтра.
 */
export function HelperHint({ onEmote, reduceMotion, compact = false, candy = false }: HelperHintProps) {

  const game = useGameStore((s) => s.game);
  const adventure = useGameStore((s) => s.adventure);
  const activeConfig = useGameStore((s) => s.activeConfig);
  const level = useProgression((s) => s.level);
  const usedDay = useMascot((s) => s.helpersUsedDay.hint);
  const charges = useMascot((s) => s.helperCharges.hint ?? 0);
  const lang = useLang();
  const [rewardBusy, setRewardBusy] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const today = todayISO();

  // Transient receipt / press lock; guidance itself belongs to the run's UI state.
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardInFlightRef = useRef(false);
  const pressLockRef = useRef(false);
  const pressUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
      if (pressUnlockTimer.current) clearTimeout(pressUnlockTimer.current);
    },
    [],
  );
  const helperUnlocked = isHelperUnlocked('hint', level);
  const move = useMemo(() => {
    if (!helperUnlocked || !isStuckish(game.board, game.tray, THRESHOLD)) return null;
    return findHintMove(game, { adventure, config: adventure ? undefined : activeConfig });
  }, [activeConfig, adventure, game, helperUnlocked]);
  const freeAvailable = canUseHelper(usedDay, today, level, 'hint', charges) && move !== null;
  const canOfferRewarded = helperUnlocked && usedDay === today && charges === 0 && move !== null;
  const rewardedReady = useRewardedReady(canOfferRewarded && !rewardBusy);
  const rewardOffer = canOfferRewarded && rewardedReady && !rewardBusy;
  const available = freeAvailable || rewardOffer;
  const source = rewardOffer ? 'rewarded' : usedDay === today ? 'charge' : 'free';

  useEffect(() => {
    if (!available) return;
    const runId = useAnalyticsStore.getState().activeRun?.run_id ?? 'no-run';
    for (const stage of ['eligible', 'shown'] as const) {
      useAnalyticsStore.getState().trackOnce(
        `helper:${runId}:hint:${stage}:${today}`,
        'helper_funnel',
        { helper: 'hint', stage, source, remaining_charges: charges },
      );
    }
  }, [available, charges, source, today]);


  if (!candy && !available && !resultText) return null;

  function showHint() {
    const current = useGameStore.getState();
    const m = current.game === game && current.adventure === adventure
      ? move
      : isStuckish(current.game.board, current.game.tray, THRESHOLD)
        ? findHintMove(current.game, {
            adventure: current.adventure,
            config: current.adventure ? undefined : current.activeConfig,
          })
        : null;
    if (!m) return false;

    // Кулдаун списывается за сам показ подсказки.
    const used = useMascot.getState().useHelper('hint');
    if (used) {
      // Persistent presentation is separate from the finger-owned drag preview.
      useGameStore.setState({ helperHint: m });
      if (useSettings.getState().sound) playSound('hint');
      onEmote('sparkle');
      const remaining = useMascot.getState().helperCharges.hint ?? 0;
      useAnalyticsStore.getState().track('helper_funnel', {
        helper: 'hint',
        stage: 'used',
        source,
        remaining_charges: remaining,
      });
      setResultText(`${t('mascot.helperUsed', lang)} · ${t('mascot.charges', lang)} ${remaining}`);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => {
        resultTimer.current = null;
        setResultText(null);
      }, 1_800);
    }
    return used;
  }

  async function handlePress() {
    if (pressLockRef.current) return;
    pressLockRef.current = true;
    if (pressUnlockTimer.current) clearTimeout(pressUnlockTimer.current);
    pressUnlockTimer.current = setTimeout(() => {
      pressUnlockTimer.current = null;
      pressLockRef.current = false;
    }, 350);
    if (freeAvailable) {
      showHint();
      return;
    }
    if (!rewardOffer || rewardBusy || rewardInFlightRef.current) {
      return;
    }

    rewardInFlightRef.current = true;
    setRewardBusy(true);
    const offeredEpoch = useGameStore.getState().epoch;
    try {
      const result = await claimRewardedBenefit({ kind: 'helper', helperId: 'hint' }, getAds());
      if (result === 'applied' || result === 'pending' || result === 'dismissed') {
        saveAdsMeta(recordFullscreenCooldown(loadAdsMeta(), Date.now()));
      }
      if (result === 'applied' && useGameStore.getState().epoch === offeredEpoch) {
        showHint();
      }
    } finally {
      rewardInFlightRef.current = false;
      setRewardBusy(false);
    }
  }

  if (candy) return <CandyHelperPill helper="hint" label={t('mascot.hint', lang)} count={charges + (helperUnlocked && usedDay !== today ? 1 : 0)} disabled={!available || rewardBusy} rewarded={rewardOffer} onPress={() => { void handlePress(); }} />;

  if (resultText) {
    return (
      <Animated.View testID="helper-hint-result" entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} style={styles.result}>
        <AppText preset="caption" numberOfLines={2} allowFontScaling={false} maxFontSizeMultiplier={1.2} style={[styles.resultText, { fontSize: compact ? 10 : 11 }]}>{resultText}</AppText>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn}
      exiting={reduceMotion ? undefined : FadeOut}
      style={styles.frame}
    >
      <Pressable
        testID="helper-hint"
        onPress={() => {
          void handlePress();
        }}
        style={styles.hit}
        disabled={rewardBusy}
        accessibilityRole="button"
        accessibilityLabel={
          rewardOffer
            ? `${t('mascot.hint', lang)} ${t('mascot.adCharge', lang)}`
            : t('mascot.hint', lang)
        }
      >
        <View style={styles.pill}>
          <AppText preset="speech" numberOfLines={2} allowFontScaling={false} maxFontSizeMultiplier={1.2} style={[styles.label, { fontSize: compact ? 10 : 11 }]}>
            {rewardOffer
              ? `${t('mascot.hint', lang)}\n${t('mascot.adCharge', lang)}`
              : `${compact ? '' : '🐾 '}${t('mascot.hint', lang)}${charges > 0 ? ` · ${charges}` : ''}`}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', minWidth: 0 },
  hit: {
    width: '100%',
    minWidth: 0,
    minHeight: 44,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    width: '100%',
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.button,
    // Акцент Капи (блок-жёлтый) — чип читается как «Капи помогает», не безличный бейдж.
    backgroundColor: mascotPalette.block,
    shadowColor: colors.clayShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 3,
  },
  label: {
    fontFamily: 'Unbounded_700Bold',
    lineHeight: 14,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
    includeFontPadding: false,
    // Тёмные чернила на жёлтом — высокий контраст и читаемость (≥4.5:1).
    color: mascotPalette.ink,
  },
  result: {
    height: 44,
    width: '100%',
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  resultText: {
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
    flexShrink: 1,
    includeFontPadding: false,
  },
});
