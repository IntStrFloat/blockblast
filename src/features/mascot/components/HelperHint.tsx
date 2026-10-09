import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import { EMPTY_MASK, previewMask, useDragCtx, useGameStore } from '@/features/game';
import {
  getAds,
  loadAdsMeta,
  recordFullscreenCooldown,
  saveAdsMeta,
} from '@/features/monetization';
import { isHelperUnlocked, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { todayISO } from '@/features/streak';
import { useRewardedReady } from '@/features/monetization/useRewardedReady';
import { AppText, colors, mascotPalette, radii } from '@/ui';

import { MASCOT_CONFIG } from '../logic/config';
import { findHintMove, isStuckish } from '../logic/helpers';
import type { EmoteId } from '../logic/types';
import { canUseHelper } from '../logic/rules';
import { useMascot } from '../store';

interface HelperHintProps {
  onEmote: (id: EmoteId) => void;
  reduceMotion: boolean;
}

const THRESHOLD = MASCOT_CONFIG.helpers.hint.stuckThreshold;

/**
 * Мягкий помощник «подсказка» (разлок ур.5). Не мигающий чип появляется ТОЛЬКО
 * в момент реального затыка (мало валидных позиций) и пока кулдаун свободен. Тап
 * подсвечивает реальную валидную позицию ghost-блоками (переиспользует preview
 * drag-системы) — ход за игрока НЕ делается. После показа — кулдаун до завтра.
 */
export function HelperHint({ onEmote, reduceMotion }: HelperHintProps) {
  const ctx = useDragCtx();

  const board = useGameStore((s) => s.game.board);
  const tray = useGameStore((s) => s.game.tray);
  const level = useProgression((s) => s.level);
  const usedDay = useMascot((s) => s.helpersUsedDay.hint);
  const charges = useMascot((s) => s.helperCharges.hint ?? 0);
  const lang = useLang();
  const [rewardBusy, setRewardBusy] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const today = todayISO();

  // Таймер сброса подсветки — чистим на размонтировании, не читаем в рендере.
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardInFlightRef = useRef(false);
  const pressLockRef = useRef(false);
  const pressUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
      if (pressUnlockTimer.current) clearTimeout(pressUnlockTimer.current);
      // Не оставлять «висящую» подсветку после анмаунта.
      ctx.preview.value = EMPTY_MASK;
      ctx.previewColor.value = 0;
    },
    [ctx.preview, ctx.previewColor],
  );
  const stuck = isStuckish(board, tray, THRESHOLD);
  const move = stuck ? findHintMove(board, tray) : null;
  const helperUnlocked = isHelperUnlocked('hint', level);
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


  if (!available && !resultText) return null;

  function showHint() {
    // Свежий расчёт на момент тапа (доска могла измениться).
    const m = findHintMove(board, tray);
    if (!m) return false;
    const piece = tray[m.trayIndex];
    if (!piece) return false;

    ctx.preview.value = previewMask(board, piece.shape.cells, m.r, m.c);
    ctx.previewColor.value = piece.colorId;
    onEmote('sparkle');

    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(
      () => {
        ctx.preview.value = EMPTY_MASK;
        ctx.previewColor.value = 0;
      },
      reduceMotion ? 1200 : 1900,
    );

    // Кулдаун списывается за сам показ подсказки.
    const used = useMascot.getState().useHelper('hint');
    if (used) {
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
    try {
      const result = await getAds().showRewarded('helper_charge');
      if (result !== 'unavailable') {
        saveAdsMeta(recordFullscreenCooldown(loadAdsMeta(), Date.now()));
      }
      if (result === 'rewarded') {
        useMascot.getState().addHelperCharge('hint');
        showHint();
      }
    } finally {
      rewardInFlightRef.current = false;
      setRewardBusy(false);
    }
  }

  if (resultText) {
    return (
      <Animated.View entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} style={styles.result}>
        <AppText preset="caption" style={styles.resultText}>{resultText}</AppText>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn}
      exiting={reduceMotion ? undefined : FadeOut}
    >
      <Pressable
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
          <AppText preset="speech" style={styles.label}>
            {rewardOffer
              ? `🎬 ${t('mascot.hint', lang)} · ${t('mascot.adCharge', lang)}`
              : `🐾 ${t('mascot.hint', lang)}${charges > 0 ? ` · ${charges}` : ''}`}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    fontSize: 13,
    // Тёмные чернила на жёлтом — высокий контраст и читаемость (≥4.5:1).
    color: mascotPalette.ink,
  },
  result: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  resultText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
