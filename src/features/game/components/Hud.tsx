import { useEffect } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { AppText, colors } from '@/ui';

import { ComboBadge } from '../effects/ComboBadge';
import { useGameStore } from '../store';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Бегущий каунтер счёта: 300мс, на UI-потоке через animatedProps (спека 04). */
function ScoreCounter() {
  const score = useGameStore((s) => s.game.score);
  const scoreSv = useSharedValue(0);

  useEffect(() => {
    scoreSv.value = withTiming(score, { duration: 300 });
  }, [score, scoreSv]);

  const animatedProps = useAnimatedProps(() => {
    return { text: `${Math.round(scoreSv.value)}` } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      defaultValue="0"
      animatedProps={animatedProps}
      style={{
        fontFamily: 'Unbounded_800ExtraBold',
        fontSize: 36,
        color: colors.textPrimary,
        padding: 0,
        textAlign: 'center',
      }}
    />
  );
}

interface HudProps {
  onPause: () => void;
}

export function Hud({ onPause }: HudProps) {
  const best = useScores((s) => s.best);
  const lang = useLang();

  return (
    <View style={{ width: '100%', paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Best слева */}
        <View style={{ minWidth: 72 }}>
          <AppText preset="caption">👑 {t('game.best', lang)}</AppText>
          <AppText preset="button" style={{ color: colors.accent }}>
            {best}
          </AppText>
        </View>

        {/* Счёт по центру */}
        <View style={{ alignItems: 'center' }}>
          <ScoreCounter />
          <ComboBadge />
        </View>

        {/* Пауза справа */}
        <Pressable
          onPress={onPause}
          hitSlop={8}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText preset="button">II</AppText>
        </Pressable>
      </View>
    </View>
  );
}
