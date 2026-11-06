import { useEffect, useRef, useState } from 'react';
import { View, type LayoutRectangle } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

import { EFFECT_SEQUENCE_TIMING, useGameStore } from '@/features/game';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { useAnalyticsStore } from '@/features/analytics';
import { AppText } from '@/ui';

import { JewelIcon } from './JewelIcon';

interface JewelCollectionFlightLayerProps {
  boardLayout: LayoutRectangle | null;
  objectiveLayout: LayoutRectangle | null;
  cell: number;
  gap: number;
  boardOffset: number;
  onArrive?: (arrival: AdventureObjectiveArrival) => void;
}

export interface AdventureObjectiveArrival {
  presentationId: string;
  delta: number;
  total: number;
}

export interface FlightBatch extends AdventureObjectiveArrival {
  cellIndexes: number[];
  queuedAtMs: number;
}

export const MAX_JEWEL_FLIGHT_QUEUE = 4;

export function enqueueJewelFlight(queue: readonly FlightBatch[], next: FlightBatch): FlightBatch[] {
  if (queue.length < MAX_JEWEL_FLIGHT_QUEUE) return [...queue, next];
  const tail = queue[queue.length - 1];
  return [
    ...queue.slice(0, -1),
    {
      presentationId: `${tail.presentationId}+${next.presentationId}`,
      cellIndexes: [...tail.cellIndexes, ...next.cellIndexes].slice(-3),
      delta: tail.delta + next.delta,
      total: next.total,
      queuedAtMs: Math.min(tail.queuedAtMs, next.queuedAtMs),
    },
  ];
}

function flightAnimation(
  dx: number,
  dy: number,
  lift: number,
  delayMs: number,
  ghost: boolean,
) {
  return new Keyframe({
    0: {
      opacity: 0,
      transform: [
        { translateX: 0 },
        { translateY: 0 },
        { scale: ghost ? 0.62 : 0.84 },
        { rotate: '-8deg' },
      ],
    },
    12: {
      opacity: ghost ? 0.28 : 1,
      transform: [
        { translateX: dx * 0.08 },
        { translateY: -lift * 0.42 },
        { scale: ghost ? 0.7 : 1.08 },
        { rotate: '2deg' },
      ],
    },
    52: {
      opacity: ghost ? 0.22 : 1,
      transform: [
        { translateX: dx * 0.54 },
        { translateY: dy * 0.46 - lift },
        { scale: ghost ? 0.58 : 0.94 },
        { rotate: '18deg' },
      ],
    },
    86: {
      opacity: ghost ? 0.12 : 0.96,
      transform: [
        { translateX: dx * 0.9 },
        { translateY: dy * 0.88 - lift * 0.24 },
        { scale: ghost ? 0.42 : 0.76 },
        { rotate: '34deg' },
      ],
    },
    100: {
      opacity: 0,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale: ghost ? 0.24 : 0.48 },
        { rotate: '45deg' },
      ],
    },
  })
    .duration(EFFECT_SEQUENCE_TIMING.adventureFlightMs)
    .delay(delayMs);
}

function arrivalAnimation(delayMs: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.24 }, { rotate: '45deg' }] },
    34: { opacity: 0.94, transform: [{ scale: 1.2 }, { rotate: '45deg' }] },
    68: { opacity: 0.64, transform: [{ scale: 0.92 }, { rotate: '45deg' }] },
    100: { opacity: 0, transform: [{ scale: 1.65 }, { rotate: '45deg' }] },
  })
    .duration(260)
    .delay(delayMs);
}

export function JewelCollectionFlightLayer({
  boardLayout,
  objectiveLayout,
  cell,
  gap,
  boardOffset,
  onArrive,
}: JewelCollectionFlightLayerProps) {
  const event = useGameStore((s) => s.lastAdventureEvent);
  const reducedMotion = useReducedMotion();
  const [queue, setQueue] = useState<FlightBatch[]>([]);
  const handledIdsRef = useRef(new Set<string>());
  const deliveredIdsRef = useRef(new Set<string>());
  const active = queue[0] ?? null;

  useEffect(() => {
    const collectedJewelCells = event?.collectedJewelCells ?? [];

    if (
      !event ||
      handledIdsRef.current.has(event.presentationId) ||
      collectedJewelCells.length === 0 ||
      !boardLayout ||
      !objectiveLayout
    ) {
      return;
    }

    handledIdsRef.current.add(event.presentationId);
    const next: FlightBatch = {
      presentationId: event.presentationId,
      cellIndexes: collectedJewelCells.slice(0, 3),
      delta: event.jewelsCollectedThisMove,
      total: event.collectedJewels,
      queuedAtMs: Date.now(),
    };
    if (reducedMotion) {
      deliveredIdsRef.current.add(next.presentationId);
      onArrive?.(next);
      useAnalyticsStore.getState().track('adventure_objective_hud_arrived', {
        presentation_id: next.presentationId,
        delta: next.delta,
        total: next.total,
        wait_ms: 0,
        reduced_motion: true,
      });
      return;
    }
    queueMicrotask(() => setQueue((current) => enqueueJewelFlight(current, next)));
  }, [boardLayout, event, objectiveLayout, onArrive, reducedMotion]);

  useEffect(() => {
    if (event) return;
    handledIdsRef.current.clear();
    deliveredIdsRef.current.clear();
    queueMicrotask(() => setQueue([]));
  }, [event]);

  useEffect(() => {
    if (!reducedMotion || queue.length === 0) return;
    const pending = queue.filter((batch) => !deliveredIdsRef.current.has(batch.presentationId));
    if (pending.length > 0) {
      const latest = pending[pending.length - 1];
      const aggregate: AdventureObjectiveArrival = {
        presentationId: pending.map((batch) => batch.presentationId).join('+'),
        delta: pending.reduce((total, batch) => total + batch.delta, 0),
        total: latest.total,
      };
      deliveredIdsRef.current.add(aggregate.presentationId);
      onArrive?.(aggregate);
      useAnalyticsStore.getState().track('adventure_objective_hud_arrived', {
        presentation_id: aggregate.presentationId,
        delta: aggregate.delta,
        total: aggregate.total,
        wait_ms: 0,
        reduced_motion: true,
      });
    }
    queueMicrotask(() => setQueue([]));
  }, [onArrive, queue, reducedMotion]);

  useEffect(() => {
    if (!active) return;
    const visibleCount = active.cellIndexes.length;
    const arrivalDelay =
      EFFECT_SEQUENCE_TIMING.adventureArrivalMs + Math.max(0, visibleCount - 1) * 42;
    const arrivalTimer = setTimeout(() => {
      if (deliveredIdsRef.current.has(active.presentationId)) return;
      deliveredIdsRef.current.add(active.presentationId);
      onArrive?.(active);
      useAnalyticsStore.getState().track('adventure_objective_hud_arrived', {
        presentation_id: active.presentationId,
        delta: active.delta,
        total: active.total,
        wait_ms: Math.max(0, Date.now() - active.queuedAtMs),
        reduced_motion: false,
      });
    }, arrivalDelay);
    const completionTimer = setTimeout(() => {
      setQueue((current) => current[0]?.presentationId === active.presentationId ? current.slice(1) : current);
    }, arrivalDelay + 260);
    return () => {
      clearTimeout(arrivalTimer);
      clearTimeout(completionTimer);
    };
  }, [active, onArrive]);

  if (!active || !boardLayout || !objectiveLayout) return null;

  const targetX = objectiveLayout.x + objectiveLayout.width / 2;
  const targetY = objectiveLayout.y + objectiveLayout.height / 2;
  const visibleFlights = active.cellIndexes;
  const arrivalDelay =
    EFFECT_SEQUENCE_TIMING.adventureArrivalMs + Math.max(0, visibleFlights.length - 1) * 42;

  return (
    <View
      testID="jewel-collection-flight-layer"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        zIndex: 45,
      }}
    >
      {visibleFlights.map((cellIndex, index) => {
        const row = Math.floor(cellIndex / 8);
        const col = cellIndex % 8;
        const startX =
          boardLayout.x + boardOffset + col * (cell + gap) + cell / 2;
        const startY =
          boardLayout.y + boardOffset + row * (cell + gap) + cell / 2;
        const dx = targetX - startX;
        const dy = targetY - startY;
        const lift = Math.max(46, Math.min(96, Math.abs(dy) * 0.24));
        const delayMs = index * 42;
        const size = Math.max(22, cell * 0.82);

        return (
          <View key={`${active.presentationId}-${cellIndex}-${index}`}>
            <Animated.View
              entering={flightAnimation(dx, dy, lift, delayMs + 28, true)}
              style={{
                position: 'absolute',
                left: startX - size / 2,
                top: startY - size / 2,
                width: size,
                height: size,
                opacity: 0,
              }}
            >
              <JewelIcon size={size} />
            </Animated.View>
            <Animated.View
              entering={flightAnimation(dx, dy, lift, delayMs, false)}
              style={{
                position: 'absolute',
                left: startX - size / 2,
                top: startY - size / 2,
                width: size,
                height: size,
                opacity: 0,
              }}
            >
              <JewelIcon size={size} />
            </Animated.View>
          </View>
        );
      })}
      <Animated.View
        key={`arrival-${active.presentationId}`}
        entering={arrivalAnimation(arrivalDelay)}
        style={{
          position: 'absolute',
          left: targetX - 19,
          top: targetY - 19,
          width: 38,
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          backgroundColor: 'rgba(72,187,255,0.24)',
          shadowColor: '#48BBFF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 8,
          opacity: 0,
        }}
      >
        <AppText
          preset="caption"
          maxFontSizeMultiplier={1.3}
          style={{ color: '#FFFFFF', fontFamily: 'Unbounded_700Bold', fontSize: 12 }}
        >
          +{active.delta}
        </AppText>
      </Animated.View>
    </View>
  );
}
