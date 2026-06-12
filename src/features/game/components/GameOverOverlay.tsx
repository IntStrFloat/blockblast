import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

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
import { useLang } from '@/features/settings';
import { shareScore } from '@/features/share';
import { AppText, GameButton, Overlay, colors } from '@/ui';

import { Confetti } from '../effects/Confetti';
import { useGameStore } from '../store';

interface GameOverOverlayProps {
  onPlayAgain: () => void;
  onHome: () => void;
}

/**
 * Оверлей Game Over: появление через ~0.8с (спека 01), рекорд + конфетти,
 * revive через rewarded, interstitial по частотным правилам — после закрытия.
 */
export function GameOverOverlay({ onPlayAgain, onHome }: GameOverOverlayProps) {
  const game = useGameStore((s) => s.game);
  const finalResult = useGameStore((s) => s.finalResult);
  const reviveGame = useGameStore((s) => s.reviveGame);
  const removeAds = useEntitlements((s) => s.removeAds);
  const lang = useLang();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const countedRef = useRef(false);

  const isOver = game.status === 'over';

  // Появление с задержкой + однократный учёт game over в счётчиках рекламы
  useEffect(() => {
    if (!isOver) {
      setVisible(false);
      countedRef.current = false;
      return;
    }
    if (!countedRef.current) {
      countedRef.current = true;
      saveAdsMeta(recordGameOver(loadAdsMeta()));
    }
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [isOver]);

  if (!isOver || !visible) return null;

  const newRecord = finalResult?.newRecord ?? false;
  const canRevive = !game.reviveUsed && getAds().isRewardedReady();

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
        await getAds().showInterstitial('gameover');
        saveAdsMeta(recordInterstitialShown(meta, Date.now()));
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
      if (result === 'rewarded') reviveGame();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay>
      {newRecord ? <Confetti height={280} /> : null}

      <AppText preset="title" style={{ textAlign: 'center' }}>
        {newRecord ? `🏆 ${t('gameOver.newRecord', lang)}` : t('gameOver.title', lang)}
      </AppText>

      <View style={{ alignItems: 'center', gap: 4 }}>
        <AppText preset="caption">{t('gameOver.score', lang)}</AppText>
        <AppText preset="score">{game.score}</AppText>
        {newRecord && finalResult && finalResult.delta > 0 ? (
          <AppText preset="caption" style={{ color: colors.accent }}>
            +{finalResult.delta} {t('gameOver.recordDelta', lang)}
          </AppText>
        ) : null}
      </View>

      {canRevive ? (
        <GameButton
          label={`▶ ${t('gameOver.revive', lang)}`}
          onPress={handleRevive}
          disabled={busy}
        />
      ) : null}

      <GameButton
        label={t('gameOver.playAgain', lang)}
        variant={canRevive ? 'ghost' : 'primary'}
        disabled={busy}
        onPress={() => closeWithInterstitial(onPlayAgain)}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GameButton
          label={`↗ ${t('gameOver.share', lang)}`}
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => shareScore(game.score, newRecord, lang)}
        />
        <GameButton
          label={t('gameOver.home', lang)}
          variant="ghost"
          style={{ flex: 1 }}
          disabled={busy}
          onPress={() => closeWithInterstitial(onHome)}
        />
      </View>
    </Overlay>
  );
}
