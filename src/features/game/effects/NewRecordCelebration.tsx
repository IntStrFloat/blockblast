import { StyleSheet, View } from 'react-native';

import { GAME_FEEL_MOTION } from '../animation/motion';
import { useReducedMotion } from '../animation/useReducedMotion';
import { type RecordCelebration, useGameStore } from '../store';
import { Confetti } from './Confetti';

const RECORD_GOLD = ['#F5C451', '#FFE27A', '#FFF6BA', '#FFFDF2'] as const;

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
      <Confetti
        key={`record-confetti-${id}`}
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
});
