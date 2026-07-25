import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAnalyticsStore } from '@/features/analytics';
import { TutorialPointer, useFtueStore } from '@/features/onboarding';
import type { TutorialPoint } from '@/features/onboarding/components/TutorialPointer';
import { useLang } from '@/features/settings';
import { AppText, colors, radii, spacing } from '@/ui';

import { useReducedMotion } from '../animation/useReducedMotion';

export interface TutorialTargetCell {
  x: number;
  y: number;
  size: number;
}

interface TutorialHintsProps {
  pieceCenter?: TutorialPoint;
  targetCells?: readonly TutorialTargetCell[];
  showInstruction?: boolean;
}

function GhostTarget({
  cells,
  emphasized,
  reducedMotion,
}: {
  cells: readonly TutorialTargetCell[];
  emphasized: boolean;
  reducedMotion: boolean;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 520 }), withTiming(1, { duration: 520 })),
      -1,
      true,
    );
  }, [pulse, reducedMotion]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      {cells.map((cell, index) => (
        <Animated.View
          key={`${cell.x}:${cell.y}:${index}`}
          style={[
            styles.ghostCell,
            {
              left: cell.x,
              top: cell.y,
              width: cell.size,
              height: cell.size,
              borderColor: emphasized ? colors.accent : 'rgba(255,201,60,0.72)',
            },
            animatedStyle,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * Action-driven FTUE presentation. Progress is advanced only by game callbacks in
 * useFtueStore; tapping instructional text cannot advance it.
 */
export function TutorialHints({ pieceCenter, targetCells = [], showInstruction = true }: TutorialHintsProps = {}) {
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const status = useFtueStore((state) => state.status);
  const invalidDrops = useFtueStore((state) => state.invalidDrops);
  const placements = useFtueStore((state) => state.placements);
  const startedAt = useFtueStore((state) => state.startedAt);
  const start = useFtueStore((state) => state.start);
  const completeAfterCelebration = useFtueStore((state) => state.completeAfterCelebration);
  const skip = useFtueStore((state) => state.skip);

  useEffect(() => {
    if (status === 'not_started') {
      start();
      useAnalyticsStore.getState().track('tutorial_shown', { step: 'grab_piece' });
    }
  }, [start, status]);

  useEffect(() => {
    if (status !== 'celebrating') return;
    const timer = setTimeout(() => {
      useAnalyticsStore.getState().track('tutorial_completed', {
        elapsed_ms: startedAt ? Date.now() - startedAt : 0,
        placements,
        skipped: false,
      });
      completeAfterCelebration();
    }, 700);
    return () => clearTimeout(timer);
  }, [completeAfterCelebration, placements, startedAt, status]);

  if (
    placements > 0 ||
    status === 'not_started' ||
    status === 'celebrating' ||
    status === 'complete' ||
    status === 'skipped'
  ) {
    return null;
  }

  const emphasized = invalidDrops >= 3;
  const target = targetCells.length > 0
    ? (() => {
        const left = Math.min(...targetCells.map((cell) => cell.x));
        const top = Math.min(...targetCells.map((cell) => cell.y));
        const right = Math.max(...targetCells.map((cell) => cell.x + cell.size));
        const bottom = Math.max(...targetCells.map((cell) => cell.y + cell.size));
        return { x: (left + right) / 2, y: (top + bottom) / 2 };
      })()
    : { x: width * 0.56, y: height * 0.43 };
  const from = pieceCenter ?? { x: width * 0.5, y: height * 0.78 };
  const instruction = lang === 'ru' ? 'Перетащи фигуру сюда' : 'Drag the piece here';
  const skipLabel = lang === 'ru' ? 'Пропустить' : 'Skip';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {targetCells.length > 0 ? (
        <GhostTarget cells={targetCells} emphasized={emphasized} reducedMotion={reducedMotion} />
      ) : null}
      <TutorialPointer
        from={from}
        to={target}
        reducedMotion={reducedMotion}
        emphasized={emphasized}
      />

      {status === 'grab_piece' && showInstruction ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(180)}
          exiting={reducedMotion ? undefined : FadeOut.duration(120)}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityLabel={instruction}
          style={styles.instruction}
        >
          <AppText preset="body" style={styles.instructionText}>
            {instruction}
          </AppText>
        </Animated.View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={skipLabel}
        onPress={() => {
          useAnalyticsStore.getState().track('tutorial_completed', {
            elapsed_ms: startedAt ? Date.now() - startedAt : 0,
            placements,
            skipped: true,
          });
          skip('user');
        }}
        hitSlop={4}
        style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
      >
        <AppText preset="caption" style={styles.skipText}>
          {skipLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  instruction: {
    position: 'absolute',
    top: 112,
    left: spacing.l,
    right: spacing.l,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(20,33,66,0.92)',
    paddingHorizontal: spacing.m,
  },
  instructionText: {
    textAlign: 'center',
  },
  skip: {
    position: 'absolute',
    top: 56,
    right: spacing.m,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    paddingHorizontal: spacing.s,
    zIndex: 60,
  },
  skipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  skipText: {
    color: colors.accent,
  },
  ghostCell: {
    position: 'absolute',
    borderRadius: radii.cell,
    borderWidth: 2,
    backgroundColor: 'rgba(255,201,60,0.2)',
    zIndex: 48,
  },
});
