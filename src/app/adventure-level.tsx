import { NoMovesSheet } from '@/features/game/components/NoMovesSheet';
import { getCandyAdventureMetrics } from '@/features/game/playfield-layout';
import { StoneBoardLayer } from '@/features/adventure/components/StoneBoardLayer';
import { Block } from '@/features/game/components/Block';
import { CandyRoundButton } from '@/ui/primitives/CandyControls';
import { usePlacementHandoff } from '@/features/game/drag/PlacementHandoff';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { AdventureHelpPolicy } from '@/core/engine';
import { t } from '@/core/i18n';
import {
  FailOverlay,
  JewelBoardLayer,
  JewelCollectionFlightLayer,
  JewelIcon,
  LevelResultView,
  ObjectivePanel,
  absoluteLevelNumber,
  adventureCompletionIdentity,
  adventureFailurePresentation,
  findAdventureHelpMove,
  levelFor,
  seasonLength,
  shouldOfferAdventureHelp,
  useAdventure,
  type AdventureObjectiveArrival,
} from '@/features/adventure';
import {
  recordNotificationTargetAction,
  recordNotificationTargetViewed,
  useAnalyticsStore,
} from '@/features/analytics';
import {
  BoardView,
  DragProvider,
  EMPTY_MASK,
  EFFECT_SEQUENCE_TIMING,
  InvalidDropNotice,
  PraiseBanner,
  TrayView,
  getSavedAdventureSummary,
  previewMask,
  useDelayedTray,
  useGameFeedback,
  useInvalidDropNotice,
  useGameStore,
  turnReadinessSource,
} from '@/features/game';
import type { DragCtx } from '@/features/game';
import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import {
  GameBannerDock,
  MONETIZATION,
  evaluateInterstitialOpportunity,
  getAds,
  loadAdsMeta,
  recordInterstitialShown,
  saveAdsMeta,
  useEntitlements,
} from '@/features/monetization';
import type { InterstitialCounter } from '@/features/monetization';
import { recoverRewardedBenefits } from '@/features/monetization/rewardedBenefits';
import {
  rememberRewardedOffer,
  leaveRewardedOffer,
} from '@/features/monetization/rewardedOfferPolicy';
import { useInterstitialPreparation } from '@/features/monetization/useInterstitialPreparation';
import { useFtueStore } from '@/features/onboarding';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import {
  AppText,
  spacing,
  CandyBackground,
  CandyCapy,
  nightCandy as n,
} from '@/ui';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';

type Phase = 'playing' | 'settling' | 'result' | 'failed';
// Рамка BoardView: сетка клеток начинается с этим отступом от угла обёртки,
// оверлей кристаллов обязан учитывать его, иначе джевелы уползают к углу клетки.
const BOARD_FRAME_WIDTH = 8;
const EMPTY_JEWEL_MARKERS: NonNullable<
  ReturnType<typeof useGameStore.getState>['adventure']
>['jewelsInTray'] = [];

export default function AdventureLevelScreen() {
  const router = useRouter();
  const lang = useLang();
  useEffect(() => {
    recordNotificationTargetViewed('/adventure-level');
  }, []);
  const reducedMotion = useReducedMotion();
  const gamesPlayed = useScores((state) => state.gamesPlayed);
  const ftueStatus = useFtueStore((state) => state.status);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const seasonId = useAdventure((s) => s.seasonId);
  const levelIndex = useAdventure((s) => s.levelIndex);
  // Progress advances when the win is saved; the visible run advances only on Next.
  const [spec, setSpec] = useState(() => levelFor(seasonId, levelIndex));
  const completedAdventureLevels = useMemo(
    () => Math.max(0, absoluteLevelNumber(spec.seasonId, spec.levelIndex) - 1),
    [spec],
  );
  const bannerGamesPlayed = gamesPlayed + completedAdventureLevels;
  // Календарь меняет оформление, а уровень и его генерация зависят от прохождения.
  const helperHint = useGameStore((s) => s.helperHint);
  const runStatus = useGameStore((s) => s.adventure?.status);
  const activeAdventure = useGameStore((s) => s.adventure);
  const runLevelId = useGameStore((s) => s.adventure?.level.id);
  const activeAdventureRunId = useGameStore(
    (s) => s.adventure?.runId ?? 'preview',
  );
  const [requestedPhase, setPhase] = useState<Phase>('playing');
  const phase =
    requestedPhase === 'playing' &&
    runLevelId === spec.id &&
    (runStatus === 'won' || runStatus === 'failed')
      ? 'settling'
      : requestedPhase;
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [resultReadyRunId, setResultReadyRunId] = useState<string | null>(null);
  const adBusyRef = useRef(false);
  const resultContextId = adventureCompletionIdentity(
    spec.seasonId,
    spec.levelIndex,
  ).completionId;
  const onBonusBusyChange = useCallback(
    (value: boolean) => {
      const currentRun = useGameStore.getState().adventure;
      if (
        value &&
        (adBusyRef.current ||
          !currentRun ||
          currentRun.status !== 'won' ||
          currentRun.level.id !== spec.id)
      )
        return false;
      adBusyRef.current = value;
      setAdBusy(value);
      return true;
    },
    [spec.id],
  );
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (adBusyRef.current) return true;
      leaveRewardedOffer(resultContextId);
      return false;
    });
    return () => listener.remove();
  }, [resultContextId]);
  const [headerLayout, setHeaderLayout] = useState<LayoutRectangle | null>(
    null,
  );
  const [objectiveLayout, setObjectiveLayout] =
    useState<LayoutRectangle | null>(null);
  const [objectiveCounterLayout, setObjectiveCounterLayout] =
    useState<LayoutRectangle | null>(null);
  const [objectiveArrival, setObjectiveArrival] =
    useState<AdventureObjectiveArrival | null>(null);
  const [adventureBoardLayout, setAdventureBoardLayout] =
    useState<LayoutRectangle | null>(null);
  const [playfieldHeight, setPlayfieldHeight] = useState<number | null>(null);
  const handledOutcome = useRef(false);
  const winCommittedAtRef = useRef<number | null>(null);
  const resultAcceleratedRef = useRef(false);
  const leavingRef = useRef(false);
  const returnedAtRef = useRef<number | null>(null);
  const returnedRunIdRef = useRef<string | null>(null);
  const removeAds = useEntitlements((s) => s.removeAds);

  const insets = useSafeAreaInsets();
  // Баннер — отдельный sibling ниже playfield. После первого layout используем
  // уже оставшуюся фактическую высоту и не вычитаем рекламный слот второй раз.
  const { boardSize, cellSize, cellGap, trayHeight, boardTrayGap } =
    getCandyAdventureMetrics(
      screenWidth,
      playfieldHeight ?? screenHeight,
      playfieldHeight == null ? insets : { top: 0, bottom: 0 },
    );
  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellGap, cellSize],
  );
  // Реальный слот трея: он центрирован (maxWidth 390) внутри горизонтального
  // паддинга контента, поэтому фактическая ширина слота уже, чем (экран−16)/3.
  // Передаём её и высоту трея в drag-контекст, чтобы фигуры не налезали на
  // соседей (ширина) и не вылезали за трей (высота).
  const trayOuterWidth = boardSize + 16;
  const traySlotWidth = (trayOuterWidth - 16) / 3;
  const trayFit = useMemo(
    () => ({ slotWidth: traySlotWidth, slotHeight: trayHeight - 12 }),
    [traySlotWidth, trayHeight],
  );
  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const [measureBoard, setMeasureBoard] = useState<() => void>(() => () => {});
  const handleMeasureBoardReady = useCallback(
    (nextMeasureBoard: () => void) => {
      setMeasureBoard(() => nextMeasureBoard);
    },
    [],
  );
  const handoff = usePlacementHandoff();
  const noMovesWave = useSharedValue(0);
  const boardRevision = useSharedValue(0);
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);
  const assistPreview = useSharedValue<number[]>(EMPTY_MASK);
  const assistPreviewColor = useSharedValue(0);
  const invalidPreview = useSharedValue<number[]>(EMPTY_MASK);
  const invalidReason = useSharedValue(0);
  const clearPrelude = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const dragOwner = useSharedValue(-1);
  const { onGrab: feedbackOnGrab, onInvalidDrop: feedbackOnInvalidDrop } =
    useGameFeedback();
  const invalidDropNotice = useInvalidDropNotice('adventure');
  const onGrab = useCallback(() => {
    useAnalyticsStore.getState().recordFirstGrab('adventure');
  }, []);
  const onInvalidDrop = useCallback(
    (reason: 'occupied' | 'outside-board') => {
      feedbackOnInvalidDrop(reason);
      invalidDropNotice.report(reason);
    },
    [feedbackOnInvalidDrop, invalidDropNotice],
  );
  const onReturn = useCallback(() => {
    feedbackOnInvalidDrop('outside-board');
  }, [feedbackOnInvalidDrop]);
  const onUnavailablePiecePress = useCallback(
    (shapeId: string) => {
      invalidDropNotice.report('unavailable', shapeId);
    },
    [invalidDropNotice],
  );
  const rawTray = useGameStore((s) => s.game.tray);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const lastAdventureEvent = useGameStore((s) => s.lastAdventureEvent);
  const tray = useDelayedTray(rawTray, lastEvent);
  const [trayReadyToken, setTrayReadyToken] = useState<string | null>(null);
  const pendingTrayReadyRef = useRef<{
    token: string;
    committedAt: number;
    clearedLines: number;
  } | null>(null);
  const gameEpoch = useGameStore((s) => s.epoch);
  const jewelMarkers = useGameStore(
    (s) => s.adventure?.jewelsInTray ?? EMPTY_JEWEL_MARKERS,
  );
  const handleTrayInteractiveReady = useCallback((token: string) => {
    const pending = pendingTrayReadyRef.current;
    if (!pending || pending.token !== token) return;
    if (useGameStore.getState().adventure?.status !== 'playing') {
      pendingTrayReadyRef.current = null;
      setTrayReadyToken(null);
      return;
    }
    pendingTrayReadyRef.current = null;
    setTrayReadyToken(null);
    useAnalyticsStore.getState().track('turn_input_ready', {
      mode: 'adventure',
      elapsed_ms: Math.max(0, Date.now() - pending.committedAt),
      new_tray: true,
      cleared_lines: pending.clearedLines,
      readiness_source: 'native_layout',
    });
  }, []);

  useEffect(() => {
    if (phase !== 'playing' || leavingRef.current) return;
    handledOutcome.current = false;
    const store = useGameStore.getState();
    const current = store.adventure;
    if (
      current &&
      current.attempt === attempt &&
      current.level.seasonId === spec.seasonId &&
      current.level.levelIndex === spec.levelIndex &&
      current.level.objective.type === spec.objective.type &&
      current.level.objective.target === spec.objective.target
    ) {
      return;
    }
    if (current) {
      useAnalyticsStore.getState().track('resume_attempt', {
        mode: 'adventure',
        saved_state: `${current.status}:attached_mismatch`,
      });
      useAnalyticsStore.getState().track('resume_result', {
        mode: 'adventure',
        result: 'fallback',
        reason: 'incompatible',
      });
      store.suspendAdventure();
      router.replace('/adventure' as Href);
      return;
    }
    // Холодный вход (процесс убит или экран размонтирован системной «назад»):
    // сперва пробуем продолжить сохранённый ран этого же уровня (FR-7).
    if (!current) {
      const savedSummary = getSavedAdventureSummary();
      if (savedSummary.fallbackReason) {
        useAnalyticsStore.getState().track('resume_attempt', {
          mode: 'adventure',
          saved_state: 'archived',
        });
        useAnalyticsStore.getState().track('resume_result', {
          mode: 'adventure',
          result: 'fallback',
          reason: savedSummary.fallbackReason,
        });
        router.replace('/adventure' as Href);
        return;
      }
      if (savedSummary.kind !== 'none') {
        useAnalyticsStore.getState().track('resume_attempt', {
          mode: 'adventure',
          saved_state: `${savedSummary.kind}:${savedSummary.status}`,
        });
      }
      const resumed = store.resumeSavedAdventure(spec);
      if (resumed) {
        // The player already ended this attempt and chose Home. Play starts a
        // fresh attempt while retaining its durable per-level failure history.
        if (resumed.status === 'failed' && resumed.resultAcknowledged) {
          const nextSpec = levelFor(
            resumed.level.seasonId,
            resumed.level.levelIndex,
          );
          store.newAdventureGame(nextSpec, resumed.attempt + 1, 'home', 'none');
          setTimeout(() => {
            setSpec(nextSpec);
            setAttempt(resumed.attempt + 1);
          }, 0);
          return;
        }
        useAnalyticsStore.getState().track('resume_result', {
          mode: 'adventure',
          result: resumed.status === 'playing' ? 'resumed' : 'result_opened',
          reason: resumed.status === 'playing' ? 'active' : 'terminal_final',
        });
        if (resumed.status === 'playing') {
          returnedAtRef.current = Date.now();
          returnedRunIdRef.current = resumed.runId;
        }
        if (
          resumed.level.id !== spec.id ||
          resumed.level.objective.type !== spec.objective.type ||
          resumed.level.objective.target !== spec.objective.target
        ) {
          setTimeout(() => setSpec(resumed.level as typeof spec), 0);
        }
        if (resumed.attempt !== attempt) {
          setTimeout(() => setAttempt(resumed.attempt), 0);
        }
        return;
      }
      if (savedSummary.kind !== 'none') {
        useAnalyticsStore.getState().track('resume_result', {
          mode: 'adventure',
          result: 'fallback',
          reason: 'incompatible',
        });
        router.replace('/adventure' as Href);
        return;
      }
    }
    store.newAdventureGame(spec, attempt);
  }, [attempt, phase, router, spec]);

  // Системная кнопка «назад» минует exitToHub: отцепляем ран от стора, чтобы
  // Endless-партия не продолжила играть по adventure-доске. Снапшот в MMKV
  // остаётся — уровень восстановится при следующем входе.
  useEffect(
    () => () => {
      const analytics = useAnalyticsStore.getState();
      if (
        analytics.activeRun?.mode === 'adventure' &&
        !analytics.activeRun.terminal_reported
      ) {
        analytics.leaveRun('home');
      }
      useGameStore.getState().suspendAdventure();
    },
    [],
  );

  useEffect(() => {
    if (activeAdventureRunId !== 'preview') recoverRewardedBenefits();
  }, [activeAdventureRunId]);

  useEffect(() => {
    if (phase !== 'failed' || runStatus !== 'playing') return;
    const timer = setTimeout(() => setPhase('playing'), 0);
    return () => clearTimeout(timer);
  }, [phase, runStatus]);

  useEffect(() => {
    if (!runStatus || runStatus === 'playing' || handledOutcome.current) return;
    const state = useGameStore.getState().adventure;
    if (!state) return;
    if (state.status === 'playing') return;
    handledOutcome.current = true;
    // Settlement is a durable Adventure store action. The screen is only a
    // recovery trigger and presentation owner; Classic hooks are not involved.
    if (!state.outcomeSettledAt) {
      useGameStore.getState().settleAdventureOutcome(state.runId);
    }
  }, [runStatus]);

  const handleResultPresentationReady = useCallback(() => {
    const run = useGameStore.getState().adventure;
    if (!run || run.status !== 'won' || run.level.id !== spec.id) return;
    setResultReadyRunId(run.runId);
    if (winCommittedAtRef.current === null) return;
    useAnalyticsStore
      .getState()
      .trackOnce(
        `adventure-result-ready:${run.runId}`,
        'adventure_result_ready',
        {
          elapsed_ms: Math.max(0, Date.now() - winCommittedAtRef.current),
          objective: spec.objective.type,
          reduced_motion: reducedMotion,
          accelerated: resultAcceleratedRef.current,
        },
      );
  }, [reducedMotion, spec.id, spec.objective.type]);

  useEffect(() => {
    if (phase !== 'settling') return;
    // The board, jewel flight and goal fill finish on the same mounted run.
    const won = runStatus === 'won';
    const waitingForFinalJewelArrival =
      won &&
      spec.objective.type === 'jewels' &&
      (lastAdventureEvent?.jewelsCollectedThisMove ?? 0) > 0 &&
      (objectiveArrival?.total ?? 0) < spec.objective.target;
    if (waitingForFinalJewelArrival) {
      const fallbackTimer = setTimeout(
        () => setPhase('result'),
        EFFECT_SEQUENCE_TIMING.adventureOutcomeFallbackMs,
      );
      return () => clearTimeout(fallbackTimer);
    }
    const delay = won
      ? spec.objective.type === 'jewels'
        ? reducedMotion
          ? 0
          : EFFECT_SEQUENCE_TIMING.adventureResultSettleMs
        : reducedMotion
          ? EFFECT_SEQUENCE_TIMING.adventureOutcomeReducedMs
          : EFFECT_SEQUENCE_TIMING.adventureOutcomeReadyMs
      : reducedMotion
        ? 0
        : 960 + (lastEvent?.clearedCells.length ? 420 : 0);
    const timer = setTimeout(() => setPhase(won ? 'result' : 'failed'), delay);
    return () => clearTimeout(timer);
  }, [
    lastAdventureEvent,
    lastEvent,
    objectiveArrival,
    phase,
    reducedMotion,
    runStatus,
    spec.objective,
  ]);

  const onDrop = useCallback(
    (trayIndex: number, row: number, col: number) => {
      if (
        phase !== 'playing' ||
        paused ||
        useGameStore.getState().adventure?.status !== 'playing'
      )
        return false;
      const commitStartedAt = Date.now();
      const event = useGameStore.getState().placePiece(trayIndex, row, col);
      const placed = event !== null;
      if (placed) {
        recordNotificationTargetAction('adventure_move');
        invalidDropNotice.recordValidDrop();
        boardMirror.value = [...useGameStore.getState().game.board];
        const clearedLines =
          event.clearedRows.length + event.clearedCols.length;
        const postCommitPlayable =
          useGameStore.getState().adventure?.status === 'playing';
        const readinessSource = turnReadinessSource(
          event.newTray,
          postCommitPlayable,
        );
        if (!readinessSource) {
          pendingTrayReadyRef.current = null;
          setTrayReadyToken(null);
        } else if (readinessSource === 'native_layout') {
          const token = `adventure:${event.score}:${commitStartedAt}`;
          pendingTrayReadyRef.current = {
            token,
            committedAt: commitStartedAt,
            clearedLines,
          };
          setTrayReadyToken(token);
        } else {
          useAnalyticsStore.getState().track('turn_input_ready', {
            mode: 'adventure',
            elapsed_ms: Math.max(0, Date.now() - commitStartedAt),
            new_tray: false,
            cleared_lines: clearedLines,
            readiness_source: readinessSource,
          });
        }
        if (useGameStore.getState().adventure?.status === 'won') {
          winCommittedAtRef.current = commitStartedAt;
          resultAcceleratedRef.current = false;
        }
        if (returnedAtRef.current !== null && returnedRunIdRef.current) {
          const analytics = useAnalyticsStore.getState();
          analytics.trackOnce(
            `return-first-move:${returnedRunIdRef.current}:${analytics.context?.session_id ?? 'bootstrap'}`,
            'return_first_move',
            {
              mode: 'adventure',
              elapsed_ms: Math.max(0, Date.now() - returnedAtRef.current),
              placement_index: analytics.activeRun?.placements ?? 1,
            },
          );
          returnedAtRef.current = null;
          returnedRunIdRef.current = null;
        }
      }
      return placed;
    },
    [boardMirror, invalidDropNotice, paused, phase],
  );

  const dragCtx: DragCtx = useMemo(
    () => ({
      geom,
      trayFit,
      boardOrigin,
      measureBoard,
      boardMirror,
      boardRevision,
      handoff,
      noMovesWave,
      jewelMarkers,
      preview,
      previewColor,
      assistPreview,
      assistPreviewColor,
      invalidPreview,
      invalidReason,
      clearPrelude,
      dragActive,
      dragOwner,
      cellColors: [...n.blockColors],
      boardBg: '#141A5A',
      cellEmpty: n.cell,
      onDrop,
      onTouch: feedbackOnGrab,
      onGrab,
      onReturn,
      onInvalidDrop,
      onUnavailablePiecePress,
      unavailablePieceLabel: t('game.pieceNoSpace', lang),
    }),
    // Shared values are stable; реактивные входы — геометрия, скин и колбэки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      geom,
      trayFit,
      jewelMarkers,
      measureBoard,
      onDrop,
      feedbackOnGrab,
      onGrab,
      onReturn,
      onInvalidDrop,
      onUnavailablePiecePress,
      lang,
    ],
  );

  useLayoutEffect(() => {
    if (helperHint && activeAdventure?.status === 'playing') {
      const piece = activeAdventure.game.tray[helperHint.trayIndex];
      if (piece) {
        assistPreview.value = previewMask(
          activeAdventure.game.board,
          piece.shape.cells,
          helperHint.r,
          helperHint.c,
        );
        assistPreviewColor.value = piece.colorId;
      }
      return () => {
        assistPreview.value = EMPTY_MASK;
        assistPreviewColor.value = 0;
      };
    }
    if (
      phase !== 'playing' ||
      !activeAdventure ||
      activeAdventure.status !== 'playing' ||
      activeAdventure.helpPolicy !== 'highlight' ||
      activeAdventure.helpUsed
    ) {
      return;
    }
    const move = findAdventureHelpMove(activeAdventure);
    const piece = move ? activeAdventure.game.tray[move.trayIndex] : null;
    if (!move || !piece) return;
    assistPreview.value = previewMask(
      activeAdventure.game.board,
      piece.shape.cells,
      move.row,
      move.col,
    );
    assistPreviewColor.value = piece.colorId;
    return () => {
      assistPreview.value = EMPTY_MASK;
      assistPreviewColor.value = 0;
    };
  }, [activeAdventure, assistPreview, assistPreviewColor, helperHint, phase]);

  const failurePresentation = activeAdventure
    ? adventureFailurePresentation(activeAdventure)
    : null;
  const helpEligible = activeAdventure
    ? shouldOfferAdventureHelp(
        activeAdventure.level.levelIndex,
        activeAdventure.failureCount,
      )
    : false;

  const exitToHome = useCallback(() => {
    if (adBusyRef.current) return;
    leaveRewardedOffer(resultContextId);
    leavingRef.current = true;
    const store = useGameStore.getState();
    const analytics = useAnalyticsStore.getState();
    if (store.adventure?.status === 'playing') analytics.leaveRun('home');
    else analytics.exitRun('home');
    if (store.adventure?.status === 'failed') store.suspendAdventure();
    else if (store.adventure?.outcomeSettledAt) store.discardAdventure();
    else store.exitAdventure();
    router.replace('/' as Href);
  }, [resultContextId, router]);

  const startCurrentLevel = useCallback(
    (nextAttempt = 0, helpPolicy?: AdventureHelpPolicy) => {
      const progress = useAdventure.getState();
      const nextSpec = levelFor(progress.seasonId, progress.levelIndex);
      if (progress.lastWinCompletedSeason !== null)
        progress.ackSeasonCelebration();
      handledOutcome.current = false;
      winCommittedAtRef.current = null;
      resultAcceleratedRef.current = false;
      setResultReadyRunId(null);
      setObjectiveArrival(null);
      setSpec(nextSpec);
      setAttempt(nextAttempt);
      const store = useGameStore.getState();
      if (helpPolicy) {
        store.newAdventureGame(
          nextSpec,
          nextAttempt,
          nextAttempt > 0 ? 'restart' : 'next',
          helpPolicy,
        );
      } else {
        store.newAdventureGame(
          nextSpec,
          nextAttempt,
          nextAttempt > 0 ? 'restart' : 'next',
        );
      }
      setPhase('playing');
    },
    [],
  );

  const handlePlayfieldLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setPlayfieldHeight((current) => (current === height ? current : height));
  }, []);

  const restartCurrentLevel = useCallback(() => {
    if (adBusyRef.current) return;
    setPaused(false);
    const run = useGameStore.getState().adventure;
    const analytics = useAnalyticsStore.getState();
    if (run) {
      analytics.track('adventure_retry_decision', {
        seasonId: run.level.seasonId,
        levelIndex: run.level.levelIndex,
        attempt: run.attempt,
        failure_count: run.failureCount,
        decision: 'voluntary_restart',
      });
    }
    analytics.exitRun('restart');
    startCurrentLevel(attempt + 1);
  }, [attempt, startCurrentLevel]);

  useInterstitialPreparation({
    active:
      phase === 'result' &&
      runStatus === 'won' &&
      resultReadyRunId === activeAdventureRunId &&
      !adBusy,
    counter: 'adventure_level',
    mode: 'adventure',
    removeAds,
    resultContextId,
  });

  const runAfterInterstitial = useCallback(
    async (counter: InterstitialCounter, after: () => void) => {
      if (adBusyRef.current) return;
      const currentRun = useGameStore.getState().adventure;
      if (
        !currentRun ||
        currentRun.level.id !== spec.id ||
        currentRun.status !== (counter === 'adventure_fail' ? 'failed' : 'won')
      )
        return;
      adBusyRef.current = true;
      leaveRewardedOffer(resultContextId);
      setAdBusy(true);
      try {
        const meta = loadAdsMeta();
        const opportunity = evaluateInterstitialOpportunity(
          meta,
          {
            enabled: MONETIZATION.adsEnabled,
            removeAds,
            nowMs: Date.now(),
          },
          counter,
          'adventure',
          { resultContextId },
        );
        if (!opportunity.baseEligible) {
          useAnalyticsStore.getState().track('ad_eligible', {
            format: 'interstitial',
            placement: counter,
            blocked_reason: 'frequency_policy',
          });
        } else if (!opportunity.shouldRequest) {
          useAnalyticsStore.getState().track('ad_eligible', {
            format: 'interstitial',
            placement: counter,
            blocked_reason: opportunity.decision,
            ...opportunity.telemetry,
          });
        }
        if (opportunity.shouldRequest) {
          let impressionRecorded = false;
          await getAds().showInterstitial(
            counter,
            opportunity.telemetry ?? undefined,
            () => {
              if (impressionRecorded) return;
              impressionRecorded = true;
              saveAdsMeta(
                recordInterstitialShown(
                  loadAdsMeta(),
                  Date.now(),
                  counter,
                  opportunity.telemetry?.product_session_id,
                ),
                true,
              );
            },
          );
        }
      } finally {
        adBusyRef.current = false;
        setAdBusy(false);
        after();
      }
    },
    [removeAds, resultContextId, spec.id],
  );
  const retryFailedLevel = useCallback(
    (withHelp: boolean) => {
      if (adBusyRef.current) return;
      const run = useGameStore.getState().adventure;
      if (!run) return;
      const eligible = shouldOfferAdventureHelp(
        run.level.levelIndex,
        run.failureCount,
      );
      const policy: AdventureHelpPolicy | undefined = withHelp
        ? 'highlight'
        : eligible
          ? 'declined'
          : undefined;
      if (
        policy &&
        !useGameStore.getState().setAdventureRetryPolicy(run.runId, policy)
      ) {
        return;
      }
      useAnalyticsStore.getState().track('adventure_retry_decision', {
        seasonId: run.level.seasonId,
        levelIndex: run.level.levelIndex,
        attempt: run.attempt,
        failure_count: run.failureCount,
        decision: withHelp ? 'help' : 'standard',
      });
      void runAfterInterstitial('adventure_fail', () => {
        startCurrentLevel(run.attempt + 1, policy);
      });
    },
    [runAfterInterstitial, startCurrentLevel],
  );
  const overlayBlocksPlayfield =
    paused || phase === 'result' || phase === 'failed';

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: n.night900 }}
        edges={['top', 'bottom']}
      >
        <CandyBackground adventure />
        <View
          // Keep the native parent stable when exit/settling changes pointerEvents.
          // Flattening it reparents animated children out of SafeAreaView on Android.
          collapsable={false}
          importantForAccessibility={
            overlayBlocksPlayfield ? 'no-hide-descendants' : 'auto'
          }
          onLayout={handlePlayfieldLayout}
          pointerEvents={
            phase === 'playing' && runStatus === 'playing' ? 'auto' : 'none'
          }
          style={{
            flex: 1,
            alignItems: 'center',
            paddingHorizontal: spacing.m,
            paddingTop: spacing.s,
          }}
        >
          <View
            onLayout={(event) => setHeaderLayout(event.nativeEvent.layout)}
            style={{
              width: boardSize + 16,
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <CandyRoundButton
              icon="pause"
              label={lang === 'ru' ? 'Пауза' : 'Pause'}
              onPress={() => setPaused(true)}
            />
            <ObjectivePanel
              key={`objective:${activeAdventureRunId}`}
              arrival={objectiveArrival}
              onLayout={(event) => setObjectiveLayout(event.nativeEvent.layout)}
              onTargetLayout={(event) =>
                setObjectiveCounterLayout(event.nativeEvent.layout)
              }
            />
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 99,
                borderWidth: 2,
                borderColor: n.grape,
                backgroundColor: n.night700,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CandyCapy size={40} />
            </View>
          </View>
          <View
            style={{
              width: boardSize + 16,
              alignItems: 'flex-start',
              height: 36,
              marginTop: 18,
            }}
          >
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 99,
                paddingHorizontal: 12,
                height: 36,
                justifyContent: 'center',
              }}
            >
              <AppText
                style={{
                  fontFamily: 'Nunito_900Black',
                  color: '#141A5C',
                  fontSize: 14,
                }}
              >
                {helperHint
                  ? lang === 'ru' ? 'Перетащи выделенную фигуру сюда' : 'Drag the highlighted piece here'
                  : lang === 'ru'
                  ? spec.objective.type === 'jewels'
                    ? 'Собирай линии, где лежат кристаллы!'
                    : 'Собирай линии и набирай очки!'
                  : 'Clear lines to reach your goal!'}
              </AppText>
              <View
                style={{
                  position: 'absolute',
                  left: 20,
                  bottom: -8,
                  width: 14,
                  height: 14,
                  backgroundColor: '#FFFFFF',
                  transform: [{ rotate: '45deg' }],
                }}
              />
            </View>
          </View>

          {phase === 'playing' &&
          activeAdventure?.helpPolicy === 'highlight' &&
          !activeAdventure.helpUsed ? (
            <View
              accessible
              accessibilityRole="summary"
              style={{
                marginTop: spacing.s,
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: spacing.m,
                borderRadius: 14,
                backgroundColor: 'rgba(255, 206, 85, 0.18)',
                borderWidth: 1,
                borderColor: 'rgba(255, 224, 132, 0.68)',
              }}
            >
              <AppText
                preset="caption"
                style={{
                  color: '#FFF4C4',
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {t('adventure.helpActive', lang)}
              </AppText>
            </View>
          ) : null}

          <View
            key={`${spec.id}-${attempt}-${gameEpoch}`}
            onLayout={(event) =>
              setAdventureBoardLayout(event.nativeEvent.layout)
            }
            style={{
              position: 'relative',
              marginTop: 26,
              // ТОЛЬКО iOS-тень. Никакого elevation на обёртке доски: на Android
              // elevation поднимает всю доску над треем (он — следующий сосед), и
              // фигура при перетаскивании уезжает ЗА полотно. Endless не ставит
              // elevation на доску — именно поэтому там этого бага нет.
              shadowColor: '#080A30',
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.28,
              shadowRadius: 6,
            }}
          >
            {/* Рамка доски — ровное кольцо со всех сторон через padding+фон.
                Раньше рамка задавалась бордюром на самом BoardView, но его
                внутренний слой в полный boardSize перекрывал бордюр по правому и
                нижнему краю — коричневая рамка оставалась видна только в углах. */}
            <View
              style={{
                padding: BOARD_FRAME_WIDTH,
                borderRadius: 20,
                backgroundColor: '#141A5A',
                boxShadow: 'inset 0px 0px 0px 2px #9A5D3A',
              }}
            >
              <BoardView
                clearStyle="dissolve"
                style={{ borderRadius: 12 }}
                onMeasureBoardReady={handleMeasureBoardReady}
              />
            </View>
            <JewelBoardLayer
              cell={cellSize}
              gap={cellGap}
              offset={BOARD_FRAME_WIDTH}
            />
            <StoneBoardLayer
              cell={cellSize}
              gap={cellGap}
              offset={BOARD_FRAME_WIDTH}
            />
            <PraiseBanner />
          </View>

          <View
            style={{
              width: trayOuterWidth,
              height: trayHeight,
              marginTop: boardTrayGap,
              marginBottom: 8,
              position: 'relative',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                borderRadius: 28,
                backgroundColor: 'rgba(8,11,52,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            />
            <TrayView
              tray={tray}
              readyToken={trayReadyToken}
              onInteractiveReady={handleTrayInteractiveReady}
              style={{ width: '100%', height: '100%' }}
              renderPieceCellOverlay={(slot, cellIndex, size) =>
                jewelMarkers.some(
                  (m) => m.slot === slot && m.cell === cellIndex,
                ) ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View style={{ position: 'absolute', inset: 0 }}>
                      <Block size={size} color="#FFD43F" />
                    </View>
                    <JewelIcon size={size * 0.56} />
                  </View>
                ) : null
              }
            />
          </View>
        </View>

        <JewelCollectionFlightLayer
          key={`flight:${activeAdventureRunId}`}
          boardLayout={
            adventureBoardLayout
              ? {
                  ...adventureBoardLayout,
                  y: adventureBoardLayout.y + insets.top,
                }
              : null
          }
          objectiveLayout={
            objectiveLayout && objectiveCounterLayout
              ? {
                  x:
                    (headerLayout?.x ?? 0) +
                    objectiveLayout.x +
                    objectiveCounterLayout.x,
                  y:
                    insets.top +
                    (headerLayout?.y ?? 0) +
                    objectiveLayout.y +
                    objectiveCounterLayout.y,
                  width: objectiveCounterLayout.width,
                  height: objectiveCounterLayout.height,
                }
              : null
          }
          cell={cellSize}
          gap={cellGap}
          boardOffset={BOARD_FRAME_WIDTH}
          onArrive={setObjectiveArrival}
        />
        <InvalidDropNotice message={invalidDropNotice.message} />

        {phase === 'settling' && runStatus === 'won' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('adventure.showResult', lang)}
            onPress={() => {
              resultAcceleratedRef.current = true;
              setPhase('result');
            }}
            style={({ pressed }) => ({
              position: 'absolute',
              right: spacing.l,
              bottom: spacing.l,
              zIndex: 60,
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: spacing.m,
              borderRadius: 14,
              backgroundColor: 'rgba(17,39,79,0.92)',
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <AppText preset="button" style={{ color: '#FFFFFF' }}>
              {t('adventure.showResult', lang)}
            </AppText>
          </Pressable>
        ) : null}

        {phase === 'result' ? (
          <View style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
            <LevelResultView
              key={activeAdventureRunId}
              completedLevel={absoluteLevelNumber(
                spec.seasonId,
                spec.levelIndex,
              )}
              runId={useGameStore.getState().adventure?.runId ?? null}
              completionId={
                adventureCompletionIdentity(spec.seasonId, spec.levelIndex)
                  .completionId
              }
              completedSeason={
                spec.levelIndex + 1 >= seasonLength(spec.seasonId)
                  ? spec.seasonId
                  : null
              }
              disabled={adBusy}
              onBonusOfferAvailable={() =>
                rememberRewardedOffer(resultContextId)
              }
              onBonusBusyChange={onBonusBusyChange}
              onPresentationReady={handleResultPresentationReady}
              onNext={() =>
                void runAfterInterstitial('adventure_level', () =>
                  startCurrentLevel(0),
                )
              }
              onExit={exitToHome}
            />
          </View>
        ) : null}
        {phase === 'failed' && !activeAdventure?.resultAcknowledged ? (
          <NoMovesSheet
            onFinish={() => useGameStore.getState().finishCurrentResult()}
          />
        ) : null}
        {phase === 'failed' && activeAdventure?.resultAcknowledged ? (
          <FailOverlay
            disabled={adBusy}
            objective={
              activeAdventure?.level.objective.type ?? spec.objective.type
            }
            current={failurePresentation?.current ?? 0}
            target={failurePresentation?.target ?? spec.objective.target}
            remaining={failurePresentation?.remaining ?? spec.objective.target}
            tip={failurePresentation?.tip ?? 'open_space'}
            helpEligible={helpEligible}
            onRetry={() => retryFailedLevel(false)}
            onRetryWithHelp={() => retryFailedLevel(true)}
            onExit={exitToHome}
          />
        ) : null}
        <View
          importantForAccessibility={
            overlayBlocksPlayfield ? 'no-hide-descendants' : 'auto'
          }
        >
          <GameBannerDock
            hidden={overlayBlocksPlayfield || adBusy}
            ftueComplete={ftueStatus === 'complete' || ftueStatus === 'skipped'}
            gamesPlayed={bannerGamesPlayed}
          />
        </View>

        {paused ? (
          <PauseOverlay
            onClose={() => setPaused(false)}
            onRestart={restartCurrentLevel}
            onHome={exitToHome}
          />
        ) : null}
      </SafeAreaView>
    </DragProvider>
  );
}
