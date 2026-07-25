import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import type { PlacementEvent } from '@/core/engine';
import { radii } from '@/ui';

import {
  buildClearPresentation,
  clearPresentationLifetimeMs,
  countAnimatedClearNodes,
  MAX_ACTIVE_CLEAR_PRESENTATIONS,
  type ClearPresentationInstance,
} from '../animation/clearPresentation';
import {
  budgetPlacementEffects,
  buildPlacementPresentation,
  comboFrameFor,
  placementEffectLifetimeMs,
  type PlacementEffectInstance,
} from '../animation/gameFeelPresentation';
import { GAME_FEEL_MOTION } from '../animation/motion';
import { useReducedMotion } from '../animation/useReducedMotion';
import { useDragCtx } from '../drag/DragContext';
import { ClearBurstLayer } from '../effects/ClearBurstLayer';
import { ClearDebrisLayer } from '../effects/ClearDebrisLayer';
import { BoardFramePulse } from '../effects/BoardFramePulse';
import { GameEffectsLayer } from '../effects/GameEffectsLayer';
import { useShake } from '../effects/useShake';
import { useGameStore } from '../store';
import { BoardCell } from './BoardCell';

interface BoardViewProps {
  style?: ViewStyle;
}

const clearEventInstanceIds = new WeakMap<PlacementEvent, number>();
let nextClearEventInstanceId = 1;
const placementEventInstanceIds = new WeakMap<PlacementEvent, number>();
let nextPlacementEventInstanceId = 1;

function clearEventInstanceKey(event: PlacementEvent) {
  let id = clearEventInstanceIds.get(event);
  if (!id) {
    id = nextClearEventInstanceId++;
    clearEventInstanceIds.set(event, id);
  }
  return `clear-${id}`;
}

function placementEventInstanceKey(event: PlacementEvent) {
  let id = placementEventInstanceIds.get(event);
  if (!id) {
    id = nextPlacementEventInstanceId++;
    placementEventInstanceIds.set(event, id);
  }
  return `placement-${id}`;
}

export function BoardView({ style }: BoardViewProps) {
  const ctx = useDragCtx();
  const { geom } = ctx;
  const cellColorsKey = ctx.cellColors.join('\u0000');
  const boardGeom = useMemo(
    () => ({
      boardSize: geom.boardSize,
      cell: geom.cell,
      gap: geom.gap,
    }),
    [geom.boardSize, geom.cell, geom.gap],
  );
  // The derived key already tracks color value changes; memoizing by the key avoids
  // churn when the drag context object identity changes without changing the colors.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCellColors = useMemo(() => [...ctx.cellColors], [cellColorsKey]);

  const board = useGameStore((s) => s.game.board);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const reducedMotion = useReducedMotion();
  const queuedPresentation = useMemo<ClearPresentationInstance | null>(
    () =>
      lastEvent && lastEvent.clearedCells.length > 0
        ? {
            id: clearEventInstanceKey(lastEvent),
            presentation: buildClearPresentation(
              lastEvent,
              boardGeom,
              stableCellColors,
              reducedMotion,
            ),
          }
        : null,
    [boardGeom, lastEvent, reducedMotion, stableCellColors],
  );
  const queuedComboFrame = useMemo(
    () => (lastEvent ? comboFrameFor(lastEvent, reducedMotion) : null),
    [lastEvent, reducedMotion],
  );
  const queuedPlacementEffect = useMemo<PlacementEffectInstance | null>(() => {
    if (!lastEvent) return null;
    if (lastEvent.clearedCells.length > 0) return null;

    return {
      id: placementEventInstanceKey(lastEvent),
      placement: buildPlacementPresentation(
        lastEvent,
        boardGeom,
        stableCellColors,
        reducedMotion,
      ),
      comboFrame: queuedComboFrame!,
      color: stableCellColors[Math.max(0, lastEvent.colorId - 1)] ?? '#FFFFFF',
    };
  }, [boardGeom, lastEvent, queuedComboFrame, reducedMotion, stableCellColors]);
  const queuedClearComboFrame = useMemo(() => {
    if (!lastEvent || lastEvent.clearedCells.length === 0 || !queuedComboFrame) return null;
    if (queuedComboFrame.intensity <= 0) return null;
    return {
      id: clearEventInstanceKey(lastEvent),
      presentation: queuedComboFrame,
      color: stableCellColors[Math.max(0, lastEvent.colorId - 1)] ?? '#FFFFFF',
    };
  }, [lastEvent, queuedComboFrame, stableCellColors]);
  const [activePresentations, setActivePresentations] = useState<ClearPresentationInstance[]>([]);
  // Пул разрушения получает свежий клир сразу, в том же коммите, где доска уже
  // пуста: хоп через setActivePresentations (эффект → setState → новый рендер)
  // добавлял кадр «пустых» ячеек до появления осколков. Дедуп по id внутри
  // ClearBurstLayer не даёт клиру сыграть дважды, когда он позже попадает в
  // activePresentations.
  const burstPresentations = useMemo(() => {
    if (!queuedPresentation) return activePresentations;
    if (activePresentations.some((entry) => entry.id === queuedPresentation.id)) {
      return activePresentations;
    }
    return [...activePresentations, queuedPresentation];
  }, [activePresentations, queuedPresentation]);
  const [activePlacementEffects, setActivePlacementEffects] = useState<PlacementEffectInstance[]>([]);
  const budgetedPlacementEffects = useMemo(
    () =>
      budgetPlacementEffects(
        activePresentations.reduce((sum, { presentation }) => sum + countAnimatedClearNodes(presentation), 0),
        activePlacementEffects,
      ),
    [activePlacementEffects, activePresentations],
  );
  const presentationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const enqueuedPresentationIdsRef = useRef<Set<string>>(new Set());
  const placementTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const enqueuedPlacementIdsRef = useRef<Set<string>>(new Set());

  // Синхронизация boardMirror для worklet-проверок
  useEffect(() => {
    ctx.boardMirror.value = [...board];
  }, [board, ctx.boardMirror]);

  // Screen shake при очистке 2+ линий (спека 04)
  const { shakeStyle, triggerShake } = useShake();
  useEffect(() => {
    if (!lastEvent) return;
    triggerShake({
      clear: queuedPresentation?.presentation.shake ?? null,
      combo: queuedComboFrame,
    });
  }, [lastEvent, queuedComboFrame, queuedPresentation, triggerShake]);

  useEffect(() => {
    if (!queuedPresentation) return;
    if (enqueuedPresentationIdsRef.current.has(queuedPresentation.id)) return;
    enqueuedPresentationIdsRef.current.add(queuedPresentation.id);
    if (!presentationTimersRef.current.has(queuedPresentation.id)) {
      const timer = setTimeout(() => {
        presentationTimersRef.current.delete(queuedPresentation.id);
        enqueuedPresentationIdsRef.current.delete(queuedPresentation.id);
        setActivePresentations((current) =>
          current.filter((item) => item.id !== queuedPresentation.id),
        );
      }, clearPresentationLifetimeMs(queuedPresentation.presentation));
      presentationTimersRef.current.set(queuedPresentation.id, timer);
    }

    setActivePresentations((current) => {
      if (current.some((entry) => entry.id === queuedPresentation.id)) return current;
      return [...current, queuedPresentation].slice(-MAX_ACTIVE_CLEAR_PRESENTATIONS);
    });
  }, [queuedPresentation]);

  useEffect(() => {
    if (!queuedPlacementEffect) return;
    if (enqueuedPlacementIdsRef.current.has(queuedPlacementEffect.id)) return;
    enqueuedPlacementIdsRef.current.add(queuedPlacementEffect.id);
    if (!placementTimersRef.current.has(queuedPlacementEffect.id)) {
      const timer = setTimeout(() => {
        placementTimersRef.current.delete(queuedPlacementEffect.id);
        enqueuedPlacementIdsRef.current.delete(queuedPlacementEffect.id);
        setActivePlacementEffects((current) =>
          current.filter((item) => item.id !== queuedPlacementEffect.id),
        );
      }, placementEffectLifetimeMs(queuedPlacementEffect.placement, queuedPlacementEffect.comboFrame));
      placementTimersRef.current.set(queuedPlacementEffect.id, timer);
    }

    setActivePlacementEffects((current) => {
      if (current.some((entry) => entry.id === queuedPlacementEffect.id)) return current;
      return [...current, queuedPlacementEffect].slice(-GAME_FEEL_MOTION.placementQueueCap);
    });
  }, [queuedPlacementEffect]);

  useEffect(() => {
    const activeIds = new Set(activePresentations.map((entry) => entry.id));

    presentationTimersRef.current.forEach((timer, id) => {
      if (activeIds.has(id)) return;
      clearTimeout(timer);
      presentationTimersRef.current.delete(id);
      enqueuedPresentationIdsRef.current.delete(id);
    });
  }, [activePresentations]);

  useEffect(() => {
    const activeIds = new Set(activePlacementEffects.map((entry) => entry.id));

    placementTimersRef.current.forEach((timer, id) => {
      if (activeIds.has(id)) return;
      clearTimeout(timer);
      placementTimersRef.current.delete(id);
      enqueuedPlacementIdsRef.current.delete(id);
    });
  }, [activePlacementEffects]);

  useEffect(
    () => () => {
      presentationTimersRef.current.forEach((timer) => clearTimeout(timer));
      presentationTimersRef.current.clear();
      enqueuedPresentationIdsRef.current.clear();
      placementTimersRef.current.forEach((timer) => clearTimeout(timer));
      placementTimersRef.current.clear();
      enqueuedPlacementIdsRef.current.clear();
    },
    [],
  );

  // Запоминаем ref доски для measureInWindow
  const boardRef = useRef<View>(null);

  const measureBoard = useCallback(() => {
    boardRef.current?.measureInWindow((x, y) => {
      ctx.boardOrigin.value = { x, y };
    });
  }, [ctx.boardOrigin]);

  useEffect(() => {
    ctx.boardMeasureRef.current = measureBoard;
    return () => {
      if (ctx.boardMeasureRef.current === measureBoard) ctx.boardMeasureRef.current = null;
    };
  }, [ctx.boardMeasureRef, measureBoard]);

  const onLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      // setTimeout 0 гарантирует валидную позицию после layout-pass
      setTimeout(measureBoard, 0);
    },
    [measureBoard],
  );

  const { boardSize, cell, gap } = geom;
  const cellColors = ctx.cellColors;
  const { boardBg, cellEmpty } = ctx;

  return (
    <Animated.View
      style={[
        {
          width: boardSize,
          height: boardSize,
          position: 'relative',
          overflow: 'visible',
        },
        shakeStyle,
        style,
      ]}
    >
      <View
        ref={boardRef}
        onLayout={onLayout}
        style={[
          {
            width: boardSize,
            height: boardSize,
            borderRadius: radii.card / 2,
            overflow: 'hidden',
            backgroundColor: boardBg,
            position: 'relative',
          },
        ]}
      >
        {board.map((colorId, index) => {
          const fillColor =
            colorId > 0 && colorId <= cellColors.length ? cellColors[colorId - 1] : '';
          return (
            <BoardCell
              key={index}
              index={index}
              colorId={colorId}
              size={cell}
              gap={gap}
              fillColor={fillColor}
              emptyColor={cellEmpty}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </View>
      <GameEffectsLayer placementEffects={budgetedPlacementEffects} />
      {queuedClearComboFrame ? (
        <BoardFramePulse
          key={queuedClearComboFrame.id}
          presentation={queuedClearComboFrame.presentation}
          color={queuedClearComboFrame.color}
        />
      ) : null}
      {/* Пулы разрушения (осколки + крошка) — сиблинги вне клиппинга доски
          (частицы разлетаются за её края). Монтируются один раз и
          переиспользуют вью, поэтому не дают «рывка» от массового mount на
          каждой очистке. */}
      <ClearDebrisLayer presentations={activePresentations} />
      <ClearBurstLayer presentations={burstPresentations} />
    </Animated.View>
  );
}
