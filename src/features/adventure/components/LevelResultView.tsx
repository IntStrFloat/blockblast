import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { Confetti } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { LevelUpReveal } from '@/features/mascot';
import { RewardProgressSummary, rewardReceiptKey, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import { AppText, ChevronIcon, FireIcon, GameButton, TrophyIcon } from '@/ui';

import { ADVENTURE_THEME } from '../theme';
import { useAdventure } from '../store';
import { MosaicView } from './MosaicView';
import { SeasonCelebration } from './SeasonCelebration';
import { AdventureXpBonus } from './AdventureXpBonus';
import { LevelResultTransition } from './LevelResultTransition';

interface Props {
  completedLevel: number;
  runId: string | null;
  completionId: string | null;
  completedSeason?: number | null;
  onNext: () => void;
  onExit: () => void;
  disabled?: boolean;
  onBonusOfferAvailable?: () => void;
  onBonusBusyChange?: (busy: boolean) => boolean | void;
  onPresentationReady?: () => void;
}

export function LevelResultView({
  completedLevel,
  runId,
  completionId,
  completedSeason = null,
  onNext,
  onExit,
  disabled = false,
  onBonusOfferAvailable,
  onBonusBusyChange,
  onPresentationReady,
}: Props) {
  const lang = useLang();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [presentationReady, setPresentationReady] = useState(false);
  const handleReady = useCallback(() => {
    setPresentationReady(true);
    onPresentationReady?.();
  }, [onPresentationReady]);
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const consecutive = useAdventure((s) => s.consecutive);
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const earnedXp = useProgression((s) =>
    completionId
      ? (s.rewardReceipts[rewardReceiptKey(completionId, 'xp')]?.grantedAmount ?? 0)
      : 0,
  );

  useEffect(() => {
    if (presentationReady && runId) useProgression.getState().presentRevealForRun(runId);
  }, [presentationReady, runId]);

  if (completedSeason !== null) {
    return (
      <LevelResultTransition onReady={handleReady}>
        <SeasonCelebration
          seasonId={completedSeason}
          disabled={disabled}
          earnedXp={earnedXp}
          lifetimePoints={lifetimePoints}
          onContinue={onNext}
          presentationReady={presentationReady}
        />
        {presentationReady ? <LevelUpReveal /> : null}
      </LevelResultTransition>
    );
  }

  const mosaicWidth = Math.min(210, width - 120, height * 0.25);

  return (
    <LevelResultTransition onReady={handleReady}>
      <SafeAreaView
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={{ flex: 1, backgroundColor: ADVENTURE_THEME.resultBottom }}
        edges={['top', 'bottom']}
      >
        <LinearGradient
          colors={[ADVENTURE_THEME.resultTop, ADVENTURE_THEME.resultBottom]}
          style={{ position: 'absolute', inset: 0 }}
        />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, gap: 12 }}
          showsVerticalScrollIndicator
        >
          <View style={{ position: 'absolute', top: 8, left: 12, zIndex: 2 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('adventure.exit', lang)}
              disabled={disabled}
              hitSlop={14}
              onPress={onExit}
              style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronIcon size={28} direction="left" color="#C8F4FF" />
            </Pressable>
          </View>
          <View accessible accessibilityLabel={`${t('adventure.levelClear', lang)}. ${t('adventure.level', lang)} ${completedLevel}`} style={{ alignItems: 'center', gap: 4 }}>
            <TrophyIcon size={44} color="#FFE06B" />
            <AppText preset="button" style={{ color: '#FFFFFF', textAlign: 'center' }}>
              {t('adventure.levelClear', lang)}
            </AppText>
            <AppText preset="title" accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 24, textAlign: 'center' }}>
              {t('adventure.level', lang)} {completedLevel}
            </AppText>
          </View>
          <MosaicView
            seasonId={seasonId}
            cleared={presentationReady ? levelIndex : Math.max(0, levelIndex - 1)}
            justFilled={presentationReady ? levelIndex - 1 : undefined}
            width={mosaicWidth}
          />
          <RewardProgressSummary earnedXp={earnedXp} lifetimePoints={lifetimePoints} light />
          {presentationReady && completionId && runId ? (
            <AdventureXpBonus
              key={completionId}
              completionId={completionId}
              runId={runId}
              disabled={disabled}
              onOfferAvailable={onBonusOfferAvailable}
              onBusyChange={onBonusBusyChange}
            />
          ) : null}
          <GameButton
            label={t('adventure.nextLevel', lang)}
            onPress={onNext}
            disabled={disabled}
            style={{
              width: '100%',
              maxWidth: 300,
              backgroundColor: '#F58A22',
              borderRadius: 8,
              borderWidth: 2,
              borderColor: '#FFAB42',
              borderBottomColor: '#B34D12',
            }}
          />
          {consecutive > 1 ? (
            <View accessible accessibilityLabel={`${t('adventure.consecutive', lang)}: ${consecutive}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <FireIcon size={20} />
              <AppText preset="button" style={{ color: '#062842' }}>{consecutive}</AppText>
            </View>
          ) : null}
        </ScrollView>
        {presentationReady && !reduced ? <Confetti count={14} /> : null}
        {presentationReady ? <LevelUpReveal /> : null}
      </SafeAreaView>
    </LevelResultTransition>
  );
}
