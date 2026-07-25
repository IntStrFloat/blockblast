import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Confetti } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { AppText } from '@/ui';

interface Props {
  fromLevel: number;
  onDone: () => void;
}

/**
 * Празднование «уровень пройден»: конфетти + чипы Ур.N → Ур.N+1. Отдельного
 * прогресс-бара здесь НЕТ — заполнение доигрывает тот же радужный бар цели
 * (ObjectivePanel), который игрок наполнял весь уровень.
 */
export function LevelUpBanner({ fromLevel, onDone }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onDone, reduced ? 500 : 1500);
    return () => clearTimeout(timer);
  }, [onDone, reduced]);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(4, 16, 28, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
      }}
    >
      <Animated.View
        entering={reduced ? FadeIn.duration(160) : ZoomIn.duration(260)}
        style={{ alignItems: 'center', gap: 12 }}
      >
        <AppText preset="title" style={{ color: '#FFFFFF', fontSize: 30, textAlign: 'center' }}>
          Уровень пройден!
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppText preset="button" style={{ color: '#BFD9FF', fontSize: 22 }}>
            Ур.{fromLevel + 1}
          </AppText>
          <AppText preset="button" style={{ color: '#FFE06B', fontSize: 22 }}>
            →
          </AppText>
          <AppText preset="button" style={{ color: '#FFE06B', fontSize: 22 }}>
            Ур.{fromLevel + 2}
          </AppText>
        </View>
      </Animated.View>
      {reduced ? null : <Confetti />}
    </Animated.View>
  );
}
