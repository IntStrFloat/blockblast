import Animated, { FadeOut, Keyframe } from 'react-native-reanimated';

import { t } from '@/core/i18n';
import { useLang } from '@/features/settings';
import { AppText, FireIcon } from '@/ui';

import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';

const ENTER_MS = 190;
const REDUCED_ENTER_MS = 90;

// Без плашки-«пилюли»: огонь + глянцевый леттеринг, как остальной игровой UI.
export function ComboBadge() {
  const combo = useGameStore((s) => s.game.combo);
  const lang = useLang();
  const reducedMotion = useReducedMotion();

  if (combo < 2) return null;

  const entering = new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0 },
          100: { opacity: 1 },
        }
      : {
          0: { opacity: 0, transform: [{ scale: 0.7 }, { translateY: 3 }] },
          55: { opacity: 1, transform: [{ scale: 1.12 }, { translateY: 0 }] },
          100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
        },
  ).duration(reducedMotion ? REDUCED_ENTER_MS : ENTER_MS);

  return (
    <Animated.View
      key={combo}
      entering={entering}
      exiting={FadeOut.duration(90)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 24,
        gap: 5,
      }}
    >
      <FireIcon size={16} color="#FF9F1C" innerColor="#FFE36A" />
      <AppText
        preset="button"
        numberOfLines={1}
        style={{
          fontFamily: 'Fredoka_700Bold',
          color: '#FFE9A8',
          fontSize: 14,
          lineHeight: 18,
          letterSpacing: 0.2,
          textShadowColor: 'rgba(255,159,28,0.6)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 6,
        }}
      >
        {t('game.combo', lang)} ×{combo}
      </AppText>
    </Animated.View>
  );
}
