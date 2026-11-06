import { useEffect } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  recordExperimentExposure,
  useAnalyticsStore,
} from '@/features/analytics';
import {
  FTUE_EXPERIMENT_ID,
  TutorialPointer,
  shouldShowFtueAssistance,
  useFtueStore,
} from '@/features/onboarding';
import type { TutorialPoint } from '@/features/onboarding/components/TutorialPointer';
import { useLang } from '@/features/settings';
import { AppText, CandyCapy, nightCandy as n } from '@/ui';

import { useReducedMotion } from '../animation/useReducedMotion';
import { useGameStore } from '../store';

export interface TutorialTargetCell {
  x: number;
  y: number;
  size: number;
}

interface TutorialHintsProps {
  pieceCenter?: TutorialPoint;
  targetCells?: readonly TutorialTargetCell[];
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
      withSequence(
        withTiming(0.55, { duration: 520 }),
        withTiming(1, { duration: 520 }),
      ),
      -1,
      true,
    );
  }, [pulse, reducedMotion]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants"
    >
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
              borderColor: emphasized ? n.sun : 'rgba(255,201,60,0.72)',
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
export function TutorialHints({
  pieceCenter,
  targetCells = [],
}: TutorialHintsProps = {}) {
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const status = useFtueStore((state) => state.status);
  const variant = useFtueStore((state) => state.variant);
  const invalidDrops = useFtueStore((state) => state.invalidDrops);
  const placements = useFtueStore((state) => state.placements);
  const startedAt = useFtueStore((state) => state.startedAt);
  const ftueRunId = useFtueStore((state) => state.runId);
  const classicRunId = useGameStore((state) =>
    state.classicMeta?.runKind === 'tutorial' ? state.classicMeta.runId : null,
  );
  const start = useFtueStore((state) => state.start);
  const finishGuidedCelebration = useFtueStore(
    (state) => state.finishGuidedCelebration,
  );

  useEffect(() => {
    if (status === 'not_started') {
      start();
    }
  }, [start, status]);

  useEffect(() => {
    if (!ftueRunId || ftueRunId !== classicRunId) return;
    useAnalyticsStore
      .getState()
      .trackOnce(`tutorial-shown:${ftueRunId}`, 'tutorial_shown', {
        step: 'grab_piece',
      });
  }, [classicRunId, ftueRunId]);

  useEffect(() => {
    if (!ftueRunId || ftueRunId !== classicRunId || status === 'not_started')
      return;
    recordExperimentExposure(FTUE_EXPERIMENT_ID, variant, 'tutorial_game');
  }, [classicRunId, ftueRunId, status, variant]);

  useEffect(() => {
    if (status !== 'guided_success' || !ftueRunId || ftueRunId !== classicRunId)
      return;
    const timer = setTimeout(() => {
      const currentFtue = useFtueStore.getState();
      const currentRunId = useGameStore.getState().classicMeta?.runId;
      if (
        currentFtue.runId !== currentRunId ||
        currentFtue.status !== 'guided_success'
      )
        return;
      finishGuidedCelebration();
      useGameStore.getState().syncTutorialCheckpoint();
    }, 700);
    return () => clearTimeout(timer);
  }, [classicRunId, finishGuidedCelebration, ftueRunId, status]);

  useEffect(() => {
    if (status !== 'complete' || !ftueRunId || ftueRunId !== classicRunId)
      return;
    useAnalyticsStore
      .getState()
      .trackOnce(`tutorial-completed:${ftueRunId}`, 'tutorial_completed', {
        elapsed_ms: startedAt ? Date.now() - startedAt : 0,
        placements,
        skipped: false,
      });
  }, [classicRunId, ftueRunId, placements, startedAt, status]);

  if (
    status === 'not_started' ||
    status === 'guided_success' ||
    status === 'complete' ||
    status === 'skipped'
  ) {
    return null;
  }

  const emphasized = invalidDrops >= 3;
  const showAssistance = shouldShowFtueAssistance(useFtueStore.getState());
  const target =
    targetCells.length > 0
      ? (() => {
          const left = Math.min(...targetCells.map((cell) => cell.x));
          const top = Math.min(...targetCells.map((cell) => cell.y));
          const right = Math.max(
            ...targetCells.map((cell) => cell.x + cell.size),
          );
          const bottom = Math.max(
            ...targetCells.map((cell) => cell.y + cell.size),
          );
          return { x: (left + right) / 2, y: (top + bottom) / 2 };
        })()
      : { x: width * 0.56, y: height * 0.43 };
  const from = pieceCenter ?? { x: width * 0.5, y: height * 0.78 };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {showAssistance && targetCells.length > 0 ? (
        <GhostTarget
          cells={targetCells}
          emphasized={emphasized}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {showAssistance && targetCells.length > 0 ? (
        <TutorialPointer
          from={from}
          to={target}
          reducedMotion={reducedMotion}
          emphasized={emphasized}
        />
      ) : null}
    </View>
  );
}

export function TutorialHeader({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const state = useFtueStore();
  const stage =
    state.status === 'grab_piece' || state.status === 'not_started'
      ? 0
      : state.status === 'valid_drop'
        ? 1
        : 2;
  const message =
    state.status === 'guided_success'
      ? lang === 'ru'
        ? 'Получилось! Обе линии сгорели. Теперь попробуй сам!'
        : 'Great! Both lines cleared. Now try on your own!'
      : stage === 2
        ? lang === 'ru'
          ? 'Теперь твой ход! Собери ещё одну линию.'
          : 'Your turn! Complete another line.'
        : lang === 'ru'
          ? 'Привет, я Капи! Перетащи квадрат в светящееся место — обе линии сгорят.'
          : 'Hi, I’m Capy! Drag the square into the glowing space to clear both lines.';
  return (
    <View
      style={{
        width: '100%',
        paddingHorizontal: 20,
        height: compact ? 136 : 166,
      }}
    >
      <View
        style={{
          height: compact ? 28 : 40,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === stage ? 24 : 8,
                height: 8,
                borderRadius: 99,
                backgroundColor: i === stage ? n.sun : '#5D68AA',
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={lang === 'ru' ? 'Пропустить' : 'Skip'}
          hitSlop={8}
          onPress={() => {
            useAnalyticsStore
              .getState()
              .trackOnce(
                `tutorial-skip:${state.runId ?? 'unbound'}`,
                'tutorial_completed',
                {
                  elapsed_ms: state.startedAt
                    ? Date.now() - state.startedAt
                    : 0,
                  placements: state.placements,
                  skipped: true,
                },
              );
            state.skip('user');
            useGameStore.getState().syncTutorialCheckpoint();
          }}
          style={{ minHeight: 40, justifyContent: 'center' }}
        >
          <AppText
            style={{
              fontFamily: 'Nunito_900Black',
              color: n.lavender,
              fontSize: 16,
            }}
          >
            {lang === 'ru' ? 'Пропустить' : 'Skip'}
          </AppText>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 10,
          marginTop: compact ? 8 : 20,
          height: compact ? 88 : 96,
        }}
      >
        <CandyCapy size={compact ? 44 : 72} />
        <View
          style={{
            flex: 1,
            paddingVertical: compact ? 8 : 10,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: '#FFFFFF',
            marginBottom: compact ? 0 : 18,
          }}
        >
          <AppText
            accessibilityLiveRegion="polite"
            style={{
              color: '#141A5C',
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: compact ? 12 : 14,
              lineHeight: compact ? 16 : 19,
            }}
          >
            {message}
          </AppText>
          <View
            style={{
              position: 'absolute',
              left: 22,
              bottom: -7,
              width: 14,
              height: 14,
              backgroundColor: '#FFFFFF',
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ghostCell: {
    position: 'absolute',
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: 'rgba(255,201,60,0.2)',
    zIndex: 48,
  },
});
