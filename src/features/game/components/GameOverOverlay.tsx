import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';

import { t } from '@/core/i18n';
import {
  MONETIZATION,
  getAds,
  loadAdsMeta,
  recordGameOver,
  recordInterstitialShown,
  saveAdsMeta,
  shouldShowInterstitial,
  useEntitlements,
} from '@/features/monetization';
import { recordGameOverForPush } from '@/features/notifications';
import { useLang } from '@/features/settings';
import { AppText, Overlay } from '@/ui';

import { Confetti } from '../effects/Confetti';
import { gameOverPresentationFor } from '../gameOverPresentation';
import { useGameStore } from '../store';
import { ReviveButton } from './ReviveButton';

interface GameOverOverlayProps {
  onPlayAgain: () => void;
}

export function GameOverOverlay({ onPlayAgain }: GameOverOverlayProps) {
  const game = useGameStore((s) => s.game);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const finalResult = useGameStore((s) => s.finalResult);
  const continueGame = useGameStore((s) => s.continueGame);
  const removeAds = useEntitlements((s) => s.removeAds);
  const lang = useLang();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rewardedReady, setRewardedReady] = useState(false);
  const countedRef = useRef(false);

  const presentation = gameOverPresentationFor(game.status, lastEvent);
  const isOver = presentation.visible;

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
        if (active) setRewardedReady(getAds().isRewardedReady());
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
  }, [isOver, presentation.fresh, presentation.revealDelayMs]);

  if (!isOver || (presentation.fresh && !visible)) return null;

  const newRecord = finalResult?.newRecord ?? false;
  const canOfferRevive = !game.reviveUsed;

  const closeWithInterstitial = async (after: () => void) => {
    if (busy) return;
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
        if (result === 'shown') {
          saveAdsMeta(recordInterstitialShown(meta, Date.now()));
        }
      }
    } finally {
      setBusy(false);
      after();
    }
  };

  const handleRevive = async () => {
    if (busy) return;
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
    <Overlay>
      {newRecord ? <Confetti height={280} /> : null}

      <AppText preset="title" style={{ textAlign: 'center' }}>
        {canOfferRevive ? t('gameOver.revivePrompt', lang) : t('gameOver.title', lang)}
      </AppText>

      {canOfferRevive ? (
        <ReviveButton
          label={t('gameOver.revive', lang)}
          onPress={handleRevive}
          disabled={busy || !rewardedReady}
        />
      ) : null}

      <Pressable
        disabled={busy}
        onPress={() => closeWithInterstitial(onPlayAgain)}
        hitSlop={12}
        style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4 }}
      >
        <AppText
          preset="body"
          style={{ textDecorationLine: 'underline', opacity: busy ? 0.4 : 1 }}
        >
          {canOfferRevive ? t('gameOver.decline', lang) : t('gameOver.ok', lang)}
        </AppText>
      </Pressable>
    </Overlay>
  );
}
