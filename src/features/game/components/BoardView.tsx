import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import Animated, { withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import type { PlacementEvent } from '@/core/engine';
import { radii } from '@/ui';

import {
  budgetClearPresentations,
  buildClearPresentation,
  buildRecoveryClearPresentation,
  clearPresentationLifetimeMs,
  countAnimatedClearNodes,
  MAX_ACTIVE_CLEAR_PRESENTATIONS,
  type ClearPresentationInstance,
  type ClearStyle,
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
import { useHintPulse } from '../animation/useHintPulse';
import { HintTarget } from './HintTarget';
import { useAnalyticsStore } from '@/features/analytics';
import { useDragCtx } from '../drag/DragContext';
import { EMPTY_MASK } from '../drag/gridMath';
import { PlacementHandoffLayer } from '../drag/PlacementHandoff';
import { ClearBurstLayer } from '../effects/ClearBurstLayer';
import { ClearChoreographyLayer } from '../effects/ClearChoreographyLayer';
import { ClearDebrisLayer } from '../effects/ClearDebrisLayer';
import { ClearSparkLayer } from '../effects/ClearSparkLayer';
import { BoardDangerFrame } from '../effects/BoardDangerFrame';
import {
  LinePreviewSheen,
  useLinePreviewPulse,
} from '../effects/LinePreviewSheen';
import { BoardFramePulse } from '../effects/BoardFramePulse';
import { GameEffectsLayer } from '../effects/GameEffectsLayer';
import { useShake } from '../effects/useShake';
import { useGameStore } from '../store';
import { BoardCell, type BoardCellVisuals } from './BoardCell';

interface BoardViewProps {
  clearStyle?: ClearStyle;
  style?: ViewStyle;
  onMeasureBoardReady?: (measureBoard: () => void) => void;
}

const clearEventInstanceIds = new WeakMap<object, number>();
let nextClearEventInstanceId = 1;
const placementEventInstanceIds = new WeakMap<PlacementEvent, number>();
let nextPlacementEventInstanceId = 1;

function clearEventInstanceKey(event: object) {
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

export function BoardView({
  style,
  onMeasureBoardReady,
  clearStyle = 'dissolve',
}: BoardViewProps) {
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
  const reducedMotion = useReducedMotion();
  const hasHint = useGameStore((s) => Boolean(s.helperHint));
  const hintPulse = useHintPulse(hasHint, reducedMotion);
  const previewPulse = useLinePreviewPulse(ctx.preview, reducedMotion);
  const cellVisuals = useMemo<BoardCellVisuals>(
    () => ({
      cellColors: stableCellColors,
      cellLine: ctx.cellLine,
      cellRadius: ctx.cellRadius,
      preview: ctx.preview,
      previewColor: ctx.previewColor,
      assistPreview: ctx.assistPreview,
      assistPreviewColor: ctx.assistPreviewColor,
      clearPrelude: ctx.clearPrelude,
      invalidPreview: ctx.invalidPreview,
      handoff: ctx.handoff,
      noMovesWave: ctx.noMovesWave,
      previewPulse,
      hintPulse,
      dragActive: ctx.dragActive,
    }),
    [
      stableCellColors,
      ctx.cellLine,
      ctx.cellRadius,
      ctx.preview,
      ctx.previewColor,
      ctx.assistPreview,
      ctx.assistPreviewColor,
      ctx.clearPrelude,
      ctx.invalidPreview,
      ctx.handoff,
      ctx.noMovesWave,
      previewPulse,
      hintPulse,
      ctx.dragActive,
    ],
  );

  const board = useGameStore((s) => s.game.board);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const recovery = useGameStore((s) =>
    s.boardRecovery?.board === s.game.board ? s.boardRecovery : null,
  );
  const analyticsMode = useGameStore((s) =>
    s.adventure ? ('adventure' as const) : ('classic' as const),
  );
  const noMoves = useGameStore((s) =>
    s.adventure ? s.adventure.status === 'failed' : s.game.status === 'over',
  );
  useEffect(() => {
    if (!ctx.noMovesWave) return;
    ctx.noMovesWave.value = noMoves
      ? reducedMotion
        ? 1
        : withDelay(
            lastEvent?.clearedCells.length ? 420 : 0,
            withTiming(1, { duration: 960 }),
          )
      : reducedMotion
        ? 0
        : withTiming(0, { duration: 280 });
  }, [ctx.noMovesWave, lastEvent, noMoves, reducedMotion]);
  const queuedPresentation = useMemo<ClearPresentationInstance | null>(() => {
    if (recovery) return {
      id: clearEventInstanceKey(recovery),
      presentation: buildRecoveryClearPresentation(
        recovery.previousBoard, boardGeom, stableCellColors, reducedMotion,
      ),
    };
    if (!lastEvent?.clearedCells.length) return null;
    return {
      id: clearEventInstanceKey(lastEvent),
      presentation: buildClearPresentation(
        lastEvent, boardGeom, stableCellColors, reducedMotion, clearStyle,
      ),
    };
  }, [boardGeom, clearStyle, lastEvent, recovery, reducedMotion, stableCellColors]);
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
    if (!lastEvent || lastEvent.clearedCells.length === 0 || !queuedComboFrame)
      return null;
    if (queuedComboFrame.intensity <= 0) return null;
    return {
      id: clearEventInstanceKey(lastEvent),
      presentation: queuedComboFrame,
      color: stableCellColors[Math.max(0, lastEvent.colorId - 1)] ?? '#FFFFFF',
    };
  }, [lastEvent, queuedComboFrame, stableCellColors]);
  const [activePresentations, setActivePresentations] = useState<
    ClearPresentationInstance[]
  >([]);
  const [retiredPresentationIds, setRetiredPresentationIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  // Пул разрушения получает свежий клир сразу, в том же коммите, где доска уже
  // пуста: хоп через setActivePresentations (эффект → setState → новый рендер)
  // добавлял кадр «пустых» ячеек до появления осколков. Дедуп по id внутри
  // ClearBurstLayer не даёт клиру сыграть дважды, когда он позже попадает в
  // activePresentations.
  const renderedClearPresentations = useMemo(() => {
    if (!queuedPresentation)
      return budgetClearPresentations(activePresentations);
    if (retiredPresentationIds.has(queuedPresentation.id)) {
      return budgetClearPresentations(activePresentations);
    }
    if (
      activePresentations.some((entry) => entry.id === queuedPresentation.id)
    ) {
      return budgetClearPresentations(activePresentations);
    }
    return budgetClearPresentations([
      ...activePresentations,
      queuedPresentation,
    ]);
  }, [activePresentations, queuedPresentation, retiredPresentationIds]);
  const [activePlacementEffects, setActivePlacementEffects] = useState<
    PlacementEffectInstance[]
  >([]);
  const [retiredPlacementIds, setRetiredPlacementIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const renderedPlacementEffects = useMemo(() => {
    if (!queuedPlacementEffect) return activePlacementEffects;
    if (retiredPlacementIds.has(queuedPlacementEffect.id))
      return activePlacementEffects;
    if (
      activePlacementEffects.some(
        (entry) => entry.id === queuedPlacementEffect.id,
      )
    ) {
      return activePlacementEffects;
    }
    return [...activePlacementEffects, queuedPlacementEffect].slice(
      -GAME_FEEL_MOTION.placementQueueCap,
    );
  }, [activePlacementEffects, queuedPlacementEffect, retiredPlacementIds]);
  const budgetedPlacementEffects = useMemo(
    () =>
      budgetPlacementEffects(
        renderedClearPresentations.reduce(
          (sum, { presentation }) =>
            sum + countAnimatedClearNodes(presentation),
          0,
        ),
        renderedPlacementEffects,
      ),
    [renderedClearPresentations, renderedPlacementEffects],
  );
  const presentationTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const enqueuedPresentationIdsRef = useRef<Set<string>>(new Set());
  const placementTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const enqueuedPlacementIdsRef = useRef<Set<string>>(new Set());

  const { boardMirror, boardRevision, dragOwner, dragActive, preview,
    previewColor, invalidPreview, invalidReason, clearPrelude } = ctx;
  const landingActive = ctx.handoff?.active;
  const landingOwner = ctx.handoff?.owner;
  const pendingLanding = ctx.handoff?.pending;
  useLayoutEffect(() => {
    const token = lastEvent ? (pendingLanding?.current ?? 0) : 0;
    if (token && pendingLanding) pendingLanding.current = 0;
    // Child clear covers are installed first. Publish the new board, retire its
    // old preview and release the landing in ONE UI transaction, before paint.
    // A passive effect could expose an old line/footprint over the new board.
    scheduleOnUI(() => {
      'worklet';
      boardMirror.value = [...board];
      if (token && landingActive?.value === token) {
        if (dragOwner.value === landingOwner?.value && dragActive.value === 0)
          dragOwner.value = -1;
        landingActive.value = 0;
      }
      if (dragOwner.value < 0) {
        preview.value = EMPTY_MASK;
        previewColor.value = 0;
        invalidPreview.value = EMPTY_MASK;
        invalidReason.value = 0;
        clearPrelude.value = 0;
      }
      // A held next piece recalculates only after all commit inputs are ready.
      if (boardRevision) boardRevision.value += 1;
    });
  }, [board, lastEvent, pendingLanding, landingActive, landingOwner,
    boardMirror, boardRevision, dragOwner, dragActive, preview, previewColor,
    invalidPreview, invalidReason, clearPrelude]);

  // Screen shake при очистке 2+ линий (спека 04)
  const { shakeStyle, triggerShake } = useShake();
  const lastShakenEventRef = useRef<PlacementEvent | null>(null);
  useEffect(() => {
    if (!lastEvent) return;
    if (!reducedMotion && lastShakenEventRef.current === lastEvent) return;
    lastShakenEventRef.current = lastEvent;
    triggerShake({
      clear: queuedPresentation?.presentation.shake ?? null,
      combo: queuedComboFrame,
    });
  }, [
    lastEvent,
    queuedComboFrame,
    queuedPresentation,
    reducedMotion,
    triggerShake,
  ]);

  useEffect(() => {
    if (!queuedPresentation) return;
    if (retiredPresentationIds.has(queuedPresentation.id)) return;
    if (enqueuedPresentationIdsRef.current.has(queuedPresentation.id)) return;
    enqueuedPresentationIdsRef.current.add(queuedPresentation.id);
    if (!presentationTimersRef.current.has(queuedPresentation.id)) {
      const timer = setTimeout(() => {
        presentationTimersRef.current.delete(queuedPresentation.id);
        enqueuedPresentationIdsRef.current.delete(queuedPresentation.id);
        setRetiredPresentationIds((current) => {
          const recentIds = [...current, queuedPresentation.id].slice(-4);
          return new Set(recentIds);
        });
        setActivePresentations((current) =>
          current.filter((item) => item.id !== queuedPresentation.id),
        );
      }, clearPresentationLifetimeMs(queuedPresentation.presentation));
      presentationTimersRef.current.set(queuedPresentation.id, timer);
    }

    setActivePresentations((current) => {
      if (current.some((entry) => entry.id === queuedPresentation.id))
        return current;
      return budgetClearPresentations(
        [...current, queuedPresentation].slice(-MAX_ACTIVE_CLEAR_PRESENTATIONS),
      );
    });
  }, [queuedPresentation, retiredPresentationIds]);

  useEffect(() => {
    if (!queuedPlacementEffect) return;
    if (retiredPlacementIds.has(queuedPlacementEffect.id)) return;
    if (enqueuedPlacementIdsRef.current.has(queuedPlacementEffect.id)) return;
    enqueuedPlacementIdsRef.current.add(queuedPlacementEffect.id);
    if (!placementTimersRef.current.has(queuedPlacementEffect.id)) {
      const timer = setTimeout(
        () => {
          placementTimersRef.current.delete(queuedPlacementEffect.id);
          enqueuedPlacementIdsRef.current.delete(queuedPlacementEffect.id);
          setRetiredPlacementIds(
            (current) =>
              new Set([...current, queuedPlacementEffect.id].slice(-4)),
          );
          setActivePlacementEffects((current) =>
            current.filter((item) => item.id !== queuedPlacementEffect.id),
          );
        },
        placementEffectLifetimeMs(
          queuedPlacementEffect.placement,
          queuedPlacementEffect.comboFrame,
        ),
      );
      placementTimersRef.current.set(queuedPlacementEffect.id, timer);
    }

    setActivePlacementEffects((current) => {
      if (current.some((entry) => entry.id === queuedPlacementEffect.id))
        return current;
      return [...current, queuedPlacementEffect].slice(
        -GAME_FEEL_MOTION.placementQueueCap,
      );
    });
  }, [queuedPlacementEffect, retiredPlacementIds]);

  useEffect(() => {
    const activeIds = new Set(activePresentations.map((entry) => entry.id));
    if (
      queuedPresentation &&
      !retiredPresentationIds.has(queuedPresentation.id)
    ) {
      activeIds.add(queuedPresentation.id);
    }

    presentationTimersRef.current.forEach((timer, id) => {
      if (activeIds.has(id)) return;
      clearTimeout(timer);
      presentationTimersRef.current.delete(id);
      enqueuedPresentationIdsRef.current.delete(id);
    });
  }, [activePresentations, queuedPresentation, retiredPresentationIds]);

  useEffect(() => {
    const activeIds = new Set(activePlacementEffects.map((entry) => entry.id));
    if (
      queuedPlacementEffect &&
      !retiredPlacementIds.has(queuedPlacementEffect.id)
    ) {
      activeIds.add(queuedPlacementEffect.id);
    }

    placementTimersRef.current.forEach((timer, id) => {
      if (activeIds.has(id)) return;
      clearTimeout(timer);
      placementTimersRef.current.delete(id);
      enqueuedPlacementIdsRef.current.delete(id);
    });
  }, [activePlacementEffects, queuedPlacementEffect, retiredPlacementIds]);

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
    onMeasureBoardReady?.(measureBoard);
  }, [measureBoard, onMeasureBoardReady]);

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
  const placedOrder = new Map(
    (lastEvent?.clearedCells.length === 0 ? lastEvent.placed : []).map(
      ([row, col], order) => [row * 8 + col, order],
    ),
  );
  useEffect(() => {
    if (
      renderedClearPresentations.length === 0 ||
      budgetedPlacementEffects.length === 0
    )
      return;
    const conflictId = [
      ...renderedClearPresentations.map((entry) => entry.id),
      ...budgetedPlacementEffects.map((entry) => entry.id),
    ].join(':');
    useAnalyticsStore
      .getState()
      .trackOnce(`effect-conflict:${conflictId}`, 'effect_conflict', {
        mode: analyticsMode,
        clear_presentations: renderedClearPresentations.length,
        placement_presentations: budgetedPlacementEffects.length,
      });
  }, [analyticsMode, budgetedPlacementEffects, renderedClearPresentations]);

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
            colorId > 0 && colorId <= cellColors.length
              ? cellColors[colorId - 1]
              : '';
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
              placementDelayMs={(placedOrder.get(index) ?? 0) * 18}
              visuals={cellVisuals}
            />
          );
        })}
      </View>
      <LinePreviewSheen
        ctx={ctx}
        phase={previewPulse}
        reduced={reducedMotion}
      />
      <BoardDangerFrame
        active={!noMoves && board.filter((cell) => cell > 0).length >= 48}
        reduced={reducedMotion}
      />
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
      <ClearDebrisLayer presentations={renderedClearPresentations} />
      <ClearBurstLayer presentations={renderedClearPresentations} />
      <ClearSparkLayer presentations={renderedClearPresentations} />
      <ClearChoreographyLayer presentations={renderedClearPresentations} />
      <HintTarget pulse={hintPulse} reduced={reducedMotion} />
      {ctx.handoff ? (
        <PlacementHandoffLayer handoff={ctx.handoff} size={cell} gap={gap} />
      ) : null}
    </Animated.View>
  );
}
