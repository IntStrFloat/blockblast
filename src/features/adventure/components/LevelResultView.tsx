import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { Confetti } from '@/features/game/effects/Confetti';
import { LevelUpReveal } from '@/features/mascot';
import { progressFor, rewardReceiptKey, useProgression } from '@/features/progression';
import { useLang } from '@/features/settings';
import {
  AppText,
  CandyBackground,
  CandyCapy,
  CandyIcon,
  CandyProgress,
  GameButton,
  nightCandy as n,
} from '@/ui';
import { ChapterPicture } from './ChapterPicture';
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
  const ru = lang === 'ru';
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [presentationReady, setPresentationReady] = useState(false);
  const handleReady = useCallback(() => {
    setPresentationReady(true);
    onPresentationReady?.();
  }, [onPresentationReady]);
  const lifetimePoints = useProgression((s) => s.lifetimePoints);
  const earnedXp = useProgression((s) =>
    completionId ? (s.rewardReceipts[rewardReceiptKey(completionId, 'xp')]?.grantedAmount ?? 0) : 0,
  );
  const progress = progressFor(lifetimePoints);
  const parts = ((Math.max(1, completedLevel) - 1) % 12) + 1;
  const pictureWidth = Math.min(227, width - 112);
  useEffect(() => {
    if (presentationReady && runId) useProgression.getState().presentRevealForRun(runId);
  }, [presentationReady, runId]);
  return (
    <LevelResultTransition onReady={handleReady}>
      <SafeAreaView
        accessibilityViewIsModal
        importantForAccessibility="yes"
        style={{ flex: 1, backgroundColor: n.night900 }}
        edges={['top', 'bottom']}
      >
        <CandyBackground />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            width: '100%',
            maxWidth: 520,
            alignSelf: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 48,
            paddingBottom: 20,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <CandyIcon name="trophy" size={44} color={n.sun} />
          <AppText
            style={{
              color: n.mandarin,
              fontFamily: 'Nunito_900Black',
              fontSize: 12,
              letterSpacing: 1.44,
            }}
          >
            {ru ? 'ПРИКЛЮЧЕНИЕ' : 'ADVENTURE'}
          </AppText>
          <AppText
            accessibilityRole="header"
            style={{
              color: '#FFFFFF',
              fontFamily: 'Unbounded_900Black',
              fontSize: 26,
              lineHeight: 32,
              textAlign: 'center',
              letterSpacing: -0.26,
            }}
          >
            {ru ? `Уровень ${completedLevel} пройден` : `Level ${completedLevel} complete`}
          </AppText>
          <View
            style={{
              padding: 18,
              gap: 14,
              borderWidth: 1.5,
              borderColor: n.border,
              borderRadius: 28,
              backgroundColor: '#161C59',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <ChapterPicture parts={parts} width={pictureWidth} reveal={presentationReady} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <CandyIcon name={parts === 12 ? 'trophy' : 'sunburst'} color={n.sun} size={18} />
              <AppText style={{ fontFamily: 'Nunito_900Black', fontSize: 14 }}>
                {ru
                  ? parts === 12
                    ? 'Картина собрана · 12 / 12'
                    : `+1 часть картины · ${parts} / 12`
                  : `+1 picture part · ${parts} / 12`}
              </AppText>
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 40 }} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: '100%',
              gap: 12,
              padding: 16,
              borderRadius: 24,
              backgroundColor: 'rgba(7,10,42,0.5)',
            }}
          >
            <CandyCapy size={32} />
            <View style={{ flex: 1 }}>
              <CandyProgress
                value={
                  progress.pointsInLevel /
                  Math.max(1, progress.pointsInLevel + progress.pointsToNext)
                }
                color={n.grape}
                height={12}
              />
            </View>
            <AppText style={{ fontFamily: 'Nunito_900Black', fontSize: 14, color: n.grape }}>
              +{earnedXp}
            </AppText>
          </View>
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
            label={ru ? 'Дальше' : 'Next'}
            onPress={onNext}
            disabled={disabled}
            size="lg"
            style={{ width: '100%' }}
            icon={<CandyIcon name="next" color={n.sunInk} size={24} />}
          />
          <GameButton
            label={ru ? 'На главную' : 'Home'}
            variant="text"
            onPress={onExit}
            disabled={disabled}
            style={{ width: '100%' }}
          />
        </ScrollView>
        {presentationReady && !reduced && (parts === 12 || completedSeason !== null) ? (
          <Confetti count={24} palette={[...n.blockColors]} />
        ) : null}
        {presentationReady ? <LevelUpReveal /> : null}
      </SafeAreaView>
    </LevelResultTransition>
  );
}
