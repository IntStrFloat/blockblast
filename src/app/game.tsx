import { previewMask } from '@/features/game/drag/gridMath';
import {
  getCandyTutorialMetrics,
  getCandyPlayfieldMetrics,
} from '@/features/game/playfield-layout';
import {
  TutorialHeader,
  TutorialHints,
} from '@/features/game/components/TutorialHints';
import { useReducedMotion } from '@/features/game/animation/useReducedMotion';
import { usePlacementHandoff } from '@/features/game/drag/PlacementHandoff';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  AppState,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  Easing,
  useSharedValue,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import {
  recordNotificationTargetAction,
  recordNotificationTargetViewed,
  useAnalyticsStore,
} from '@/features/analytics';
import {
  BoardView,
  DragProvider,
  EMPTY_MASK,
  InvalidDropNotice,
  PLAYFIELD_LAYOUT,
  PraiseBanner,
  TrayView,
  eggForScore,
  getSavedGameSummary,
  useDelayedTray,
  useGameFeedback,
  useInvalidDropNotice,
  useGameStore,
  turnReadinessSource,
} from '@/features/game';
import type { DragCtx } from '@/features/game';
import { GameOverOverlay } from '@/features/game/components/GameOverOverlay';
import { Hud } from '@/features/game/components/Hud';
import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import { NewRecordCelebration } from '@/features/game/effects/NewRecordCelebration';
import { HelperControls, LevelUpReveal } from '@/features/mascot';
import { GameBannerDock } from '@/features/monetization';
import { useAdPresentation } from '@/features/monetization/adPresentation';
import { leaveRewardedOffer } from '@/features/monetization/rewardedOfferPolicy';
import { useGameBannerEligibility } from '@/features/monetization/useGameBannerEligibility';
import {
  createTutorialGame,
  findTutorialRecommendation,
  shouldShowFtueAssistance,
  useFtueStore,
} from '@/features/onboarding';
import { useProgressionSync } from '@/features/progression/hooks/useProgressionSync';
import { useProgression } from '@/features/progression';
import { useProfileStore } from '@/features/profile';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { useActiveWorldTheme } from '@/features/themes';
import { AppText, CandyBackground, nightCandy as n, radii } from '@/ui';

type BoardLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function EggToast() {
  const lastEvent = useGameStore((s) => s.lastEvent);
  const recordCelebration = useGameStore((s) => s.recordCelebration);
  const lang = useLang();
  const [egg, setEgg] = useState<{ id: number; text: string } | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.scoreDelta <= 0) return;
    if (recordCelebration?.score === lastEvent.score) return;
    const key = eggForScore(
      lastEvent.score - lastEvent.scoreDelta,
      lastEvent.score,
    );
    if (!key) return;
    const id = ++counter.current;
    setEgg({ id, text: t(key, lang) });
    const timer = setTimeout(() => {
      if (counter.current === id) setEgg(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [lang, lastEvent, recordCelebration]);

  if (!egg) return null;
  return (
    <Animated.View
      key={egg.id}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: '26%',
        alignSelf: 'center',
        backgroundColor: 'rgba(20,33,66,0.92)',
        borderRadius: radii.button,
        paddingHorizontal: 18,
        paddingVertical: 8,
        zIndex: 60,
      }}
    >
      <AppText preset="button">
        {egg.text} {'\u{1F41F}'}
      </AppText>
    </Animated.View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const lang = useLang();
  const reduced = useReducedMotion();
  const sectionTransition = useMemo(
    () =>
      reduced
        ? undefined
        : LinearTransition.duration(280).easing(
            Easing.bezier(0.22, 1, 0.36, 1),
          ),
    [reduced],
  );
  useEffect(() => {
    recordNotificationTargetViewed('/game');
  }, []);
  // Начисляет очки в Уровень Игры на game-over и сверяет гардероб Капи (спека 11 §6).
  useProgressionSync();
  const params = useLocalSearchParams<{
    entry?: string | string[];
    startTs?: string | string[];
  }>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useActiveWorldTheme();
  const [playfieldHeight, setPlayfieldHeight] = useState<number | null>(null);
  const ftueStatus = useFtueStore((state) => state.status);
  const ftueActive = !['complete', 'skipped'].includes(ftueStatus);
  const helperHint = useGameStore((s) => s.helperHint);
  const gamesPlayed = useScores((state) => state.gamesPlayed);
  const runId = useGameStore((state) => state.classicMeta?.runId ?? null);
  const {
    boardSize,
    cellSize,
    cellGap,
    trayHeight,
    hudHeight,
    helperHeight,
    compactHeader,
    boardTopGap,
  } = (ftueActive ? getCandyTutorialMetrics : getCandyPlayfieldMetrics)(
    screenWidth,
    playfieldHeight ?? screenHeight,
    playfieldHeight == null ? insets : { top: 0, bottom: 0 },
  );
  const trayFit = useMemo(
    () => ({
      slotWidth: (boardSize + 4) / 3,
      slotHeight: trayHeight - 12,
      restingScale: ftueActive ? 0.75 : 0.55,
    }),
    [boardSize, ftueActive, trayHeight],
  );
  const ftueShouldShowAssistance = useFtueStore(shouldShowFtueAssistance);
  const reveal = useProgression((s) => s.reveal);
  const notificationBusy = reveal !== null;
  const mascotMessageVisible = false;
  const railWidth = boardSize + 16;
  const bannerEligibility = useGameBannerEligibility(
    runId,
    gamesPlayed,
    !ftueActive,
  );
  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellSize, cellGap],
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

  const loadSaved = useGameStore((s) => s.loadSaved);
  const discardAndStartNew = useGameStore((s) => s.discardAndStartNew);
  const game = useGameStore((s) => s.game);
  const lastEvent = useGameStore((s) => s.lastEvent);
  const tray = useDelayedTray(game.tray, lastEvent);
  const status = game.status;
  const [trayReadyToken, setTrayReadyToken] = useState<string | null>(null);
  const pendingTrayReadyRef = useRef<{
    token: string;
    committedAt: number;
    clearedLines: number;
  } | null>(null);
  const [entryReady, setEntryReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [boardLayout, setBoardLayout] = useState<BoardLayout | null>(null);
  const [trayLayout, setTrayLayout] = useState<BoardLayout | null>(null);
  const entryHandled = useRef(false);
  const returnedAtRef = useRef<number | null>(null);
  const returnedRunIdRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!entryReady || !runId) return;
      const syncActivity = () => {
        const current = useGameStore.getState();
        if (current.adventure || current.classicMeta?.runId !== runId) return;
        if (!paused && AppState.currentState === 'active')
          current.resumeClassicActivity();
        else current.pauseClassicActivity();
      };
      syncActivity();
      const subscription = AppState.addEventListener('change', syncActivity);
      return () => {
        subscription.remove();
        const current = useGameStore.getState();
        if (!current.adventure && current.classicMeta?.runId === runId)
          current.pauseClassicActivity();
      };
    }, [entryReady, paused, runId]),
  );

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (useAdPresentation.getState().fullscreenActive) return true;
          const current = useGameStore.getState();
          if (current.game.status === 'over' && current.classicMeta?.runId) {
            leaveRewardedOffer(current.classicMeta.runId);
          }
          setPaused((current) => !current);
          return true;
        },
      );
      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    if (entryHandled.current) return;
    entryHandled.current = true;

    const entry = Array.isArray(params.entry) ? params.entry[0] : params.entry;
    if (entry === 'resume') {
      const summary = getSavedGameSummary();
      useAnalyticsStore.getState().track('resume_attempt', {
        mode: 'classic',
        saved_state: summary.kind,
      });
      const loaded = loadSaved();
      if (!loaded) {
        useAnalyticsStore.getState().track('resume_result', {
          mode: 'classic',
          result: 'fallback',
          reason: summary.fallbackReason ?? 'missing',
        });
        router.replace('/');
        return;
      }
      useAnalyticsStore.getState().track('resume_result', {
        mode: 'classic',
        result: loaded === 'active' ? 'resumed' : 'result_opened',
        reason:
          loaded === 'active'
            ? 'active'
            : summary.kind === 'terminal_revivable'
              ? 'terminal_revivable'
              : 'terminal_final',
      });
      if (loaded === 'active') {
        const meta = useGameStore.getState().classicMeta;
        if (
          meta?.runKind === 'tutorial' &&
          useFtueStore.getState().runId !== meta.runId
        ) {
          useFtueStore.getState().bindRun(meta.runId);
        }
        returnedAtRef.current = Date.now();
        returnedRunIdRef.current = meta?.runId ?? null;
      }
    } else if (entry === 'new') {
      discardAndStartNew();
    } else if (entry === 'tutorial') {
      const seed = 0x46545545;
      const summary = getSavedGameSummary();
      if (
        summary.kind === 'active' &&
        summary.runKind === 'tutorial' &&
        loadSaved()
      ) {
        const runId = useGameStore.getState().classicMeta?.runId;
        if (runId) useFtueStore.getState().bindRun(runId);
      } else {
        discardAndStartNew({ seed, initialGame: createTutorialGame(seed) });
      }
    } else {
      router.replace('/');
      return;
    }

    const readyTimer = setTimeout(() => {
      setEntryReady(true);
      const rawStartTs = Array.isArray(params.startTs)
        ? params.startTs[0]
        : params.startTs;
      const startedAt = Number(rawStartTs);
      useAnalyticsStore.getState().track('game_visible', {
        entry:
          entry === 'resume' || entry === 'new' || entry === 'tutorial'
            ? entry
            : 'unknown',
        latency_ms: Number.isFinite(startedAt)
          ? Math.max(0, Date.now() - startedAt)
          : 0,
        network_ready: Boolean(useProfileStore.getState().authToken),
      });
    }, 0);
    return () => clearTimeout(readyTimer);
  }, [discardAndStartNew, loadSaved, params.entry, params.startTs, router]);

  const { onGrab: feedbackOnGrab, onInvalidDrop: feedbackOnInvalidDrop } =
    useGameFeedback();
  const invalidDropNotice = useInvalidDropNotice('classic');
  const onGrab = useCallback(() => {
    useAnalyticsStore.getState().recordFirstGrab('classic');
    const ftue = useFtueStore.getState();
    if (ftue.status === 'grab_piece') {
      ftue.recordGrab();
      useGameStore.getState().syncTutorialCheckpoint();
      useAnalyticsStore.getState().track('tutorial_action', {
        step: 'grab_piece',
        result: 'grab',
        elapsed_ms: ftue.startedAt ? Date.now() - ftue.startedAt : 0,
      });
    }
  }, []);
  const onInvalidDrop = useCallback(
    (reason: 'occupied' | 'outside-board') => {
      feedbackOnInvalidDrop(reason);
      invalidDropNotice.report(reason);
      const ftue = useFtueStore.getState();
      if (!['complete', 'skipped'].includes(ftue.status)) {
        ftue.recordInvalidDrop(reason);
        useGameStore.getState().syncTutorialCheckpoint();
        useAnalyticsStore.getState().track('tutorial_action', {
          step: ftue.status,
          result: 'invalid_drop',
          elapsed_ms: ftue.startedAt ? Date.now() - ftue.startedAt : 0,
        });
      }
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
  const handleTrayInteractiveReady = useCallback((token: string) => {
    const pending = pendingTrayReadyRef.current;
    if (!pending || pending.token !== token) return;
    if (useGameStore.getState().game.status !== 'playing') {
      pendingTrayReadyRef.current = null;
      setTrayReadyToken(null);
      return;
    }
    pendingTrayReadyRef.current = null;
    setTrayReadyToken(null);
    useAnalyticsStore.getState().track('turn_input_ready', {
      mode: 'classic',
      elapsed_ms: Math.max(0, Date.now() - pending.committedAt),
      new_tray: true,
      cleared_lines: pending.clearedLines,
      readiness_source: 'native_layout',
    });
  }, []);
  const onDrop = useCallback(
    (trayIndex: number, r: number, c: number) => {
      const commitStartedAt = Date.now();
      const event = useGameStore.getState().placePiece(trayIndex, r, c);
      if (!event) return false;
      recordNotificationTargetAction('classic_move');
      invalidDropNotice.recordValidDrop();
      if (returnedAtRef.current !== null && returnedRunIdRef.current) {
        const analytics = useAnalyticsStore.getState();
        analytics.trackOnce(
          `return-first-move:${returnedRunIdRef.current}:${analytics.context?.session_id ?? 'bootstrap'}`,
          'return_first_move',
          {
            mode: 'classic',
            elapsed_ms: Math.max(0, Date.now() - returnedAtRef.current),
            placement_index: analytics.activeRun?.placements ?? 1,
          },
        );
        returnedAtRef.current = null;
        returnedRunIdRef.current = null;
      }
      // The next gesture reads this on the UI runtime. Publish the committed
      // board in the same JS callback instead of waiting for BoardView's effect.
      boardMirror.value = [...useGameStore.getState().game.board];
      const clearedLines = event.clearedRows.length + event.clearedCols.length;
      const postCommitPlayable =
        useGameStore.getState().game.status === 'playing' && !event.gameOver;
      const readinessSource = turnReadinessSource(
        event.newTray,
        postCommitPlayable,
      );
      if (!readinessSource) {
        pendingTrayReadyRef.current = null;
        setTrayReadyToken(null);
      } else if (readinessSource === 'native_layout') {
        const token = `classic:${event.score}:${commitStartedAt}`;
        pendingTrayReadyRef.current = {
          token,
          committedAt: commitStartedAt,
          clearedLines,
        };
        setTrayReadyToken(token);
      } else {
        useAnalyticsStore.getState().track('turn_input_ready', {
          mode: 'classic',
          elapsed_ms: Math.max(0, Date.now() - commitStartedAt),
          new_tray: false,
          cleared_lines: clearedLines,
          readiness_source: readinessSource,
        });
      }
      const ftue = useFtueStore.getState();
      const tutorialRun =
        useGameStore.getState().classicMeta?.runKind === 'tutorial';
      if (tutorialRun) {
        useAnalyticsStore.getState().track('tutorial_action', {
          step: ftue.status,
          result:
            event.clearedRows.length + event.clearedCols.length > 0
              ? 'clear'
              : 'valid_drop',
          elapsed_ms: ftue.startedAt ? Date.now() - ftue.startedAt : 0,
        });
      }
      return true;
    },
    [boardMirror, invalidDropNotice],
  );

  const tutorialRecommendation = useMemo(
    () => (ftueShouldShowAssistance ? findTutorialRecommendation(game) : null),
    [ftueShouldShowAssistance, game],
  );
  const tutorialTargetCells = useMemo(() => {
    if (!boardLayout || !tutorialRecommendation) return [];
    return tutorialRecommendation.targetCells.map(([row, col]) => ({
      x: boardLayout.x + 8 + col * (cellSize + cellGap),
      y: boardLayout.y + 8 + row * (cellSize + cellGap),
      size: cellSize,
    }));
  }, [boardLayout, cellGap, cellSize, tutorialRecommendation]);
  const tutorialPieceCenter = tutorialRecommendation
    ? {
        x: trayLayout
          ? trayLayout.x +
            ((tutorialRecommendation.trayIndex + 0.5) * trayLayout.width) / 3
          : ((tutorialRecommendation.trayIndex + 0.5) * screenWidth) / 3,
        y: trayLayout
          ? trayLayout.y + trayLayout.height / 2
          : screenHeight - trayHeight - 110,
      }
    : undefined;

  useLayoutEffect(() => {
    const piece = helperHint ? tray[helperHint.trayIndex] : null;
    assistPreview.value =
      piece && helperHint
        ? previewMask(game.board, piece.shape.cells, helperHint.r, helperHint.c)
        : EMPTY_MASK;
    assistPreviewColor.value = piece?.colorId ?? 0;
  }, [assistPreview, assistPreviewColor, game.board, helperHint, tray]);

  const dragCtx: DragCtx = useMemo(
    () => ({
      geom,
      boardOrigin,
      measureBoard,
      boardMirror,
      boardRevision,
      handoff,
      noMovesWave,
      preview,
      previewColor,
      assistPreview,
      assistPreviewColor,
      invalidPreview,
      invalidReason,
      clearPrelude,
      dragActive,
      dragOwner,
      trayFit,
      cellColors: theme.cellColors,
      boardBg: theme.boardBg,
      cellEmpty: theme.cellEmpty,
      onDrop,
      onTouch: feedbackOnGrab,
      onGrab,
      onReturn,
      onInvalidDrop,
      onUnavailablePiecePress,
      unavailablePieceLabel: t('game.pieceNoSpace', lang),
    }),
    // Shared values are stable. Reactive inputs are geometry, theme, and callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      geom,
      theme,
      trayFit,
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

  const goHome = useCallback(() => {
    if (useAdPresentation.getState().fullscreenActive) return;
    const analytics = useAnalyticsStore.getState();
    const current = useGameStore.getState();
    if (current.classicMeta?.runId)
      leaveRewardedOffer(current.classicMeta.runId);
    if (current.game.status === 'over') {
      current.settleClassicRun('home');
    } else {
      current.pauseClassicActivity();
    }
    analytics.leaveRun('home');
    router.replace('/');
  }, [router]);
  const startFresh = useCallback((reason: 'replay' | 'restart' = 'replay') => {
    if (useAdPresentation.getState().fullscreenActive) return;
    const analytics = useAnalyticsStore.getState();
    const current = useGameStore.getState();
    if (current.classicMeta?.runId)
      leaveRewardedOffer(current.classicMeta.runId);
    if (current.game.status === 'over') {
      current.settleClassicRun(reason);
    } else {
      analytics.exitRun('restart');
    }
    useGameStore.getState().discardAndStartNew({
      analyticsSource: current.game.status === 'over' ? 'result' : 'restart',
    });
    setPaused(false);
  }, []);
  const handlePlayfieldLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setPlayfieldHeight((current) => (current === height ? current : height));
  }, []);
  const handleBoardLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setBoardLayout((current) => {
      if (
        current &&
        current.x === x &&
        current.y === y &&
        current.width === width &&
        current.height === height
      ) {
        return current;
      }
      return { x, y, width, height };
    });
  }, []);

  if (!entryReady) {
    return <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']} />;
  }

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView
        style={{ flex: 1, overflow: 'hidden', backgroundColor: n.night900 }}
        edges={['top', 'bottom']}
      >
        <CandyBackground />
        <View
          importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}
          onLayout={handlePlayfieldLayout}
          pointerEvents={status === 'over' ? 'none' : 'auto'}
          style={{
            flex: 1,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 0,
            paddingTop: PLAYFIELD_LAYOUT.contentTopPadding,
            paddingBottom: 0,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            layout={sectionTransition}
            style={{
              width: '100%',
              height: hudHeight,
              overflow: 'hidden',
              zIndex: 30,
            }}
          >
            <NewRecordCelebration />
            <Animated.View
              key={ftueActive ? 'tutorial-header' : 'game-hud'}
              entering={reduced ? undefined : FadeIn.duration(280)}
              exiting={reduced ? undefined : FadeOut.duration(140)}
              style={{ zIndex: 1 }}
            >
              {ftueActive ? (
                <TutorialHeader compact={compactHeader} />
              ) : (
                <Hud compact={compactHeader} onPause={() => setPaused(true)} />
              )}
            </Animated.View>
          </Animated.View>

          <View style={{ height: boardTopGap }} />
          <Animated.View
            layout={sectionTransition}
            testID="game-board-frame"
            onLayout={handleBoardLayout}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: '#141A5A',
              boxShadow: 'inset 0px 0px 0px 2px #2E3A9E',
            }}
          >
            <BoardView onMeasureBoardReady={handleMeasureBoardReady} />
            {ftueActive &&
            ['grab_piece', 'valid_drop', 'not_started'].includes(ftueStatus) ? (
              <View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                style={{ position: 'absolute', left: 8, top: 8 }}
              >
                {[5, 6].flatMap((row) =>
                  [0, 1, 2, 5, 6, 7].map((col) => (
                    <View
                      key={`${row}:${col}`}
                      style={{
                        position: 'absolute',
                        left: col * (cellSize + cellGap),
                        top: row * (cellSize + cellGap),
                        width: cellSize,
                        height: cellSize,
                        borderRadius: cellSize * 0.22,
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,.9)',
                        boxShadow: '0 0 14px rgba(255,212,63,.55)',
                      }}
                    />
                  )),
                )}
              </View>
            ) : null}
            {/* Keep the event consumer mounted throughout FTUE. Mounting it only
                after the 700 ms tutorial celebration replayed the already-finished
                clear event late, so “КОСМОС!” appeared after the board animation. */}
            <PraiseBanner suppressed={notificationBusy} />
          </Animated.View>
          {!ftueActive && (
            <Animated.View
              entering={reduced ? undefined : FadeIn.duration(140).delay(140)}
              testID="game-companion-rail"
              style={{
                width: railWidth,
                height: helperHeight,
                marginTop: 17,
                marginBottom: 14,
              }}
            >
              <HelperControls
                width={railWidth}
                height={helperHeight}
                compact={compactHeader}
                candy
              />
            </Animated.View>
          )}
          <Animated.View
            layout={sectionTransition}
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              setTrayLayout((current) =>
                current &&
                current.x === x &&
                current.y === y &&
                current.width === width &&
                current.height === height
                  ? current
                  : { x, y, width, height },
              );
            }}
            style={{
              width: railWidth,
              height: trayHeight,
              position: 'relative',
              marginTop: ftueActive ? (compactHeader ? 16 : 26) : 0,
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
                borderRadius: 24,
                backgroundColor: 'rgba(8,11,52,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                shadowColor: '#0A3F9F',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 3,
              }}
            />
            <TrayView
              tray={tray}
              readyToken={trayReadyToken}
              onInteractiveReady={handleTrayInteractiveReady}
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
          {ftueActive ? (
            <AppText
              style={{
                marginTop: compactHeader ? 16 : 26,
                paddingHorizontal: 24,
                textAlign: 'center',
                fontFamily: 'Nunito_800ExtraBold',
                color: n.lavender,
                fontSize: compactHeader ? 13 : 14,
                lineHeight: compactHeader ? 18 : 20,
              }}
            >
              {lang === 'ru'
                ? 'Фигуры не вращаются. Линия сгорает, когда заполнена по горизонтали или вертикали.'
                : 'Pieces do not rotate. Fill a row or column to clear it.'}
            </AppText>
          ) : null}
          {/* Board/tray layouts are local to this playfield, including safe-area placement. */}
          <TutorialHints
            pieceCenter={tutorialPieceCenter}
            targetCells={tutorialTargetCells}
          />
        </View>

        <GameBannerDock
          hidden={game.status !== 'playing' || paused}
          {...bannerEligibility}
        />

        <EggToast />
        <InvalidDropNotice message={invalidDropNotice.message} />

        <GameOverOverlay
          onHome={goHome}
          onPlayAgain={() => startFresh('replay')}
          onOpenSettings={() => setPaused(true)}
        />
        <LevelUpReveal
          hidden={game.status === 'playing' && mascotMessageVisible}
          top={
            game.status === 'playing' && boardLayout
              ? insets.top + boardLayout.y + 8
              : undefined
          }
          width={
            game.status === 'playing' ? Math.max(0, boardSize - 16) : undefined
          }
        />

        {paused ? (
          <PauseOverlay
            onClose={() => setPaused(false)}
            onRestart={() => startFresh('restart')}
            onHome={goHome}
          />
        ) : null}
      </SafeAreaView>
    </DragProvider>
  );
}
