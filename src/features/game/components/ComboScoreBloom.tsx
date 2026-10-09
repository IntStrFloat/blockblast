import Animated, { Keyframe } from 'react-native-reanimated';

import { EFFECT_SEQUENCE_TIMING, highComboAuraIntensity } from '../animation/effectSequence';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';

function bloomEntrance(intensity: number, reducedMotion: boolean) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.84 }] },
    54: {
      opacity: intensity * 0.9,
      transform: [{ scale: reducedMotion ? 1 : 1.14 }],
    },
    100: { opacity: intensity * 0.82, transform: [{ scale: 1 }] },
  }).duration(reducedMotion ? 140 : 220);
}

function bloomExit(intensity: number) {
  return new Keyframe({
    0: { opacity: intensity * 0.82, transform: [{ scale: 1 }] },
    100: { opacity: 0, transform: [{ scale: 1.08 }] },
  }).duration(EFFECT_SEQUENCE_TIMING.comboAuraFadeMs);
}

export function ComboScoreBloom() {
  const combo = useGameStore((s) => s.game.combo);
  const reducedMotion = useReducedMotion();
  const intensity = highComboAuraIntensity(combo);

  if (intensity <= 0) return null;

  const legendary = combo >= 10;

  return (
    <Animated.View
      key={legendary ? 'legendary-score-bloom' : 'charged-score-bloom'}
      testID="hud-combo-bloom"
      pointerEvents="none"
      entering={bloomEntrance(intensity, reducedMotion)}
      exiting={bloomExit(intensity)}
      style={{
        position: 'absolute',
        width: legendary ? 118 : 96,
        height: legendary ? 54 : 44,
        borderRadius: 999,
        backgroundColor: legendary ? 'rgba(255,54,196,0.48)' : 'rgba(83,174,255,0.36)',
        borderWidth: 1,
        borderColor: legendary ? 'rgba(255,175,235,0.72)' : 'rgba(151,229,255,0.58)',
        shadowColor: legendary ? '#FF36C4' : '#59D8FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.92,
        shadowRadius: legendary ? 16 : 11,
        elevation: legendary ? 7 : 5,
      }}
    />
  );
}
