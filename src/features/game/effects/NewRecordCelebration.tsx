import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { colors } from '@/ui';

import { GAME_FEEL_MOTION } from '../animation/motion';
import { useReducedMotion } from '../animation/useReducedMotion';
import { type RecordCelebration, useGameStore } from '../store';
import { Confetti } from './Confetti';

const RECORD_GOLD = ['#F5C451', '#FFE27A', '#FFF6BA', '#FFFDF2'] as const;
const REDUCED_HIDE_MS = 420;

const celebrationIds = new WeakMap<RecordCelebration, number>();
let nextCelebrationId = 1;

function celebrationId(record: RecordCelebration) {
  let id = celebrationIds.get(record);
  if (!id) {
    id = nextCelebrationId++;
    celebrationIds.set(record, id);
  }
  return id;
}

function bloomAnimation(reducedMotion: boolean) {
  return new Keyframe(
    reducedMotion
      ? {
          0: { opacity: 0 },
          35: { opacity: 0.5 },
          100: { opacity: 0 },
        }
      : {
          0: { opacity: 0, transform: [{ scale: 0.86 }] },
          28: { opacity: 0.82, transform: [{ scale: 1.04 }] },
          62: { opacity: 0.42, transform: [{ scale: 1.1 }] },
          100: { opacity: 0, transform: [{ scale: 1.16 }] },
        },
  ).duration(reducedMotion ? REDUCED_HIDE_MS : 720);
}

export function NewRecordCelebration() {
  const reducedMotion = useReducedMotion();
  const recordCelebration = useGameStore((state) => state.recordCelebration);
  if (!recordCelebration) return null;
  const id = celebrationId(recordCelebration);

  return (
    <View
      testID="new-record-celebration"
      pointerEvents="none"
      style={styles.root}
    >
      <Animated.View
        key={`record-bloom-${id}`}
        testID="new-record-bloom"
        entering={bloomAnimation(reducedMotion)}
        style={styles.bloom}
      >
        <LinearGradient
          colors={[
            'rgba(255,244,183,0)',
            'rgba(255,211,61,0.34)',
            'rgba(255,193,7,0.12)',
            'rgba(255,193,7,0)',
          ]}
          locations={[0, 0.34, 0.68, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ring} />
      </Animated.View>

      <Confetti
        height={250}
        count={GAME_FEEL_MOTION.recordConfettiMax}
        palette={[...RECORD_GOLD]}
        reducedMotion={reducedMotion}
        seed={recordCelebration.score * 31 + recordCelebration.previousBest * 17}
        testIdPrefix="record-confetti-piece-"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    zIndex: 0,
    overflow: 'hidden',
  },
  bloom: {
    position: 'absolute',
    top: -34,
    left: '12%',
    right: '12%',
    height: 210,
    borderRadius: 999,
  },
  ring: {
    position: 'absolute',
    top: 48,
    left: '20%',
    right: '20%',
    height: 78,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
