import { View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Confetti } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { AppText, GameButton, TrophyIcon } from '@/ui';

import { seasonRewardCosmetic } from '../logic/config';
import { MosaicView } from './MosaicView';

interface Props {
  seasonId: number;
  onContinue: () => void;
}

export function SeasonCelebration({ seasonId, onContinue }: Props) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(6, 26, 42, 0.96)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 24,
        zIndex: 50,
      }}
    >
      <Animated.View entering={ZoomIn.duration(reduced ? 0 : 500)}>
        <TrophyIcon size={88} color="#FFE06B" />
      </Animated.View>
      <AppText preset="title">Сезон завершён</AppText>
      <AppText preset="caption">
        {seasonRewardCosmetic(seasonId)
          ? 'Кубок получен · 🎁 новый предмет Капи'
          : 'Кубок получен'}
      </AppText>
      <MosaicView seasonId={seasonId} cleared={0} revealed width={Math.min(280, width - 80)} />
      <AppText preset="caption" style={{ opacity: 0.82 }}>
        Новый сезон готов.
      </AppText>
      <GameButton label="Следующий уровень" onPress={onContinue} />
      {reduced ? null : <Confetti />}
    </Animated.View>
  );
}
