import { useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { getAds } from '@/features/monetization';
import { claimRewardedBenefit, hasEarnedBoardRecovery } from '@/features/monetization/rewardedBenefits';
import { useRewardedReady } from '@/features/monetization/useRewardedReady';
import { useLang } from '@/features/settings';
import {
  AppText,
  CandyCapy,
  CandyIcon,
  GameButton,
  Overlay,
  formatNumber,
  nightCandy as n,
} from '@/ui';
import { canOfferBoardRecovery, useGameStore } from '../store';

export function NoMovesSheet({ onFinish }: { onFinish: () => void }) {
  const ru = useLang() === 'ru';
  const { height } = useWindowDimensions();
  const game = useGameStore((s) => s.game);
  const adventure = useGameStore((s) => s.adventure);
  const meta = useGameStore((s) => s.classicMeta);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'dismissed' | 'unavailable' | null>(null);
  const lock = useRef(false);
  const runId = adventure?.runId ?? meta?.runId;
  const spendPending = Boolean(adventure ? adventure.helperSpend : meta?.helperSpend);
  const canClear = canOfferBoardRecovery({ game, adventure, classicMeta: meta }, runId);
  const earned = Boolean(canClear && runId && hasEarnedBoardRecovery(runId));
  const ready = useRewardedReady(canClear && !earned && !busy);
  const score = formatNumber(game.score).replaceAll(' ', '\u00a0');

  async function clearBoard() {
    if (!runId || !canClear || (!earned && !ready) || lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await claimRewardedBenefit({ kind: 'revive', runId }, getAds());
      if (outcome === 'dismissed') setNotice('dismissed');
      if (outcome === 'unavailable' || outcome === 'failed') setNotice('unavailable');
    } catch {
      setNotice('unavailable');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Overlay>
      <ScrollView
        style={{ maxHeight: height * 0.72 }}
        contentContainerStyle={{ gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CandyCapy size={60} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText
              accessibilityRole="header"
              style={{
                fontFamily: 'Unbounded_900Black',
                fontSize: 20,
                lineHeight: 23,
                letterSpacing: -0.2,
              }}
            >
              {ru ? 'Фигурам некуда встать' : 'No room for these pieces'}
            </AppText>
            <AppText style={{ color: n.lavender, fontSize: 14, lineHeight: 19 }}>
              {canClear
                ? ru
                  ? `Посмотри рекламу, чтобы очистить поле и продолжить со счётом ${score}. Один раз за партию.`
                  : `Watch an ad to clear the board and keep your ${score} points. Once per game.`
                : ru
                  ? `Итоговый счёт — ${score}.`
                  : `Final score: ${score}.`}
            </AppText>
          </View>
        </View>
        {canClear ? (
          <GameButton
            label={earned
              ? ru ? 'Применить очистку' : 'Apply reward'
              : ru ? 'Очистить поле за рекламу' : 'Watch ad to clear'}
            disabled={busy || (!earned && !ready)}
            icon={earned ? undefined : <CandyIcon name="play" size={16} color={n.sunInk} />}
            onPress={() => { void clearBoard(); }}
          />
        ) : null}
        {canClear && !busy && (earned || notice || !ready) ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: n.lavender }}>
            {earned
              ? ru ? 'Награда получена. Можно применить её сразу.' : 'Your reward is ready to apply.'
              : notice === 'dismissed'
                ? ru ? 'Досмотри ролик, чтобы получить очистку.' : 'Finish the video to earn a clear.'
                : ru ? 'Реклама пока недоступна.' : 'An ad is currently unavailable.'}
          </AppText>
        ) : null}
        <GameButton
          label={ru ? 'Завершить партию' : 'End game'}
          variant={canClear ? 'text' : 'primary'}
          disabled={busy || earned || spendPending}
          onPress={onFinish}
        />
      </ScrollView>
    </Overlay>
  );
}
