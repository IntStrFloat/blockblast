import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, ChevronIcon, GameButton } from '@/ui';

import { ADVENTURE_THEME } from '../theme';
import { useAdventure } from '../store';
import { MosaicView } from './MosaicView';
import { SeasonCelebration } from './SeasonCelebration';

interface Props {
  onNext: () => void;
  onExit: () => void;
  disabled?: boolean;
}

export function LevelResultView({ onNext, onExit, disabled = false }: Props) {
  const lang = useLang();
  const { width } = useWindowDimensions();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  const consecutive = useAdventure((s) => s.consecutive);
  const completedSeason = useAdventure((s) => s.lastWinCompletedSeason);

  if (completedSeason !== null) {
    return (
      <SeasonCelebration
        seasonId={completedSeason}
        onContinue={() => {
          useAdventure.getState().ackSeasonCelebration();
          onNext();
        }}
      />
    );
  }

  const mosaicWidth = Math.min(260, width - 104);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: ADVENTURE_THEME.resultBottom }} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[ADVENTURE_THEME.resultTop, ADVENTURE_THEME.resultBottom]}
        style={{ position: 'absolute', inset: 0 }}
      />
      <View style={{ flex: 1, alignItems: 'center', padding: 24, paddingTop: 34, gap: 18 }}>
        <View style={{ width: '100%', alignItems: 'flex-start' }}>
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
        <BlockBlastLogo />
        <MosaicView seasonId={seasonId} cleared={levelIndex} justFilled={levelIndex - 1} width={mosaicWidth} />
        <AppText preset="button" style={{ color: 'rgba(220,241,255,0.62)', fontSize: 22, textAlign: 'center' }}>
          Заверши сезон и собери мозаику!
        </AppText>
        <GameButton
          label="Следующий уровень"
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
        <AppText preset="button" style={{ color: '#DDF6FF', fontSize: 21 }}>
          Побед подряд {consecutive}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

function BlockBlastLogo() {
  const firstLine = [
    ['Б', '#FF9A24'],
    ['Л', '#2EC8FF'],
    ['О', '#FF4845'],
    ['К', '#FFD338'],
  ] as const;
  const secondLine = [
    ['Б', '#2EC8FF'],
    ['Л', '#2EC8FF'],
    ['А', '#2EC8FF'],
    ['С', '#2EC8FF'],
    ['Т', '#2EC8FF'],
    ['И', '#2EC8FF'],
    ['К', '#2EC8FF'],
  ] as const;
  return (
    <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {firstLine.map(([letter, color]) => (
          <AppText
            key={letter}
            preset="title"
            style={{
              color,
              fontSize: 40,
              textShadowColor: 'rgba(9,28,94,0.55)',
              textShadowOffset: { width: 0, height: 4 },
              textShadowRadius: 2,
              transform: [{ rotate: letter === 'Б' ? '-6deg' : letter === 'К' ? '6deg' : '0deg' }],
            }}
          >
            {letter}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: -6 }}>
        {secondLine.map(([letter, color]) => (
          <AppText
            key={`second-${letter}`}
            preset="title"
            style={{
              color,
              fontSize: 34,
              textShadowColor: 'rgba(9,28,94,0.55)',
              textShadowOffset: { width: 0, height: 4 },
              textShadowRadius: 2,
            }}
          >
            {letter}
          </AppText>
        ))}
      </View>
    </View>
  );
}
