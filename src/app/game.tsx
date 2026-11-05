import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  getClassicPlayfieldMetrics,
  getSavedGameSummary,
  useDelayedTray,
  useGameFeedback,
  useInvalidDropNotice,
  useGameStore,
  turnReadinessSource,
} from '@/features/game';
import type { DragCtx } from '@/features/game';
import { AtmosphereToast } from '@/features/game/components/AtmosphereToast';
import { GameBackground } from '@/features/game/components/GameBackground';
import { GameOverOverlay } from '@/features/game/components/GameOverOverlay';
import { Hud } from '@/features/game/components/Hud';
import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import { TutorialHints } from '@/features/game/components/TutorialHints';
import { AtmosphereLayer } from '@/features/game/effects/AtmosphereLayer';
import { BoardAuraFrame } from '@/features/game/effects/BoardAuraFrame';
import { NewRecordCelebration } from '@/features/game/effects/NewRecordCelebration';
import { HelperControls, LevelUpReveal, MascotLayer, MascotMessages, useMascot } from '@/features/mascot';
import type { EmoteId } from '@/features/mascot/logic/types';
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
import { useLang, useSettings } from '@/features/settings';
import { useActiveWorldTheme } from '@/features/themes';
import { AppText, ConfirmDialog, radii } from '@/ui';

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
    const key = eggForScore(lastEvent.score - lastEvent.scoreDelta, lastEvent.score);
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
  const gamesPlayed = useScores((state) => state.gamesPlayed);
  const runId = useGameStore((state) => state.classicMeta?.runId ?? null);
  const verticalGap = Math.max(
    PLAYFIELD_LAYOUT.minVerticalGap,
    Math.min(
      PLAYFIELD_LAYOUT.maxVerticalGap,
      Math.round(screenHeight * PLAYFIELD_LAYOUT.verticalGapRatio),
    ),
  );
  const { boardSize, cellSize, cellGap, trayHeight, hudHeight, mascotHeight, compactHeader } = getClassicPlayfieldMetrics(
    screenWidth,
    playfieldHeight ?? screenHeight,
    playfieldHeight == null ? insets : { top: 0, bottom: 0 },
    verticalGap,
    // GameBannerDock owns the physical reserve as a sibling, so the measured
    // playfield height already excludes it.
    false,
  );
  const trayFit = useMemo(
    () => ({ slotWidth: (screenWidth - 16) / 3, slotHeight: trayHeight }),
    [screenWidth, trayHeight],
  );
  const ftueStatus = useFtueStore((state) => state.status);
  const ftueShouldShowAssistance = useFtueStore(shouldShowFtueAssistance);
  const ftueActive = !['complete', 'skipped'].includes(ftueStatus);
  const showMascot = useSettings((s) => s.showMascot);
  const introDone = useMascot((s) => s.introDone);
  const reveal = useProgression((s) => s.reveal);
  const [mascotLostText, setMascotLostText] = useState<string | null>(null);
  const [atmosphereVisible, setAtmosphereVisible] = useState(false);
  const mascotEmoteRef = useRef<((id: EmoteId) => void) | null>(null);
  const handleMascotEmoteReady = useCallback((handler: ((id: EmoteId) => void) | null) => {
    mascotEmoteRef.current = handler;
  }, []);
  const relayMascotEmote = useCallback((id: EmoteId) => mascotEmoteRef.current?.(id), []);
  const mascotMessageVisible = !ftueActive && showMascot && (!introDone || mascotLostText !== null);
  const notificationBusy = mascotMessageVisible || reveal !== null;
  const railWidth = Math.max(0, screenWidth - 24);
  const mascotWidth = compactHeader ? 104 : 144;
  const bannerEligibility = useGameBannerEligibility(runId, gamesPlayed, !ftueActive);
  // Сеттинг всей игровой области (фон/атмосфера) следует активной теме мира (спека 12 §3).
  const bgPalette = useMemo(
    () => ({
      bgTop: theme.bgTop,
      bgBottom: theme.bgBottom,
      glowColors: theme.juiceColors,
      haloColor: theme.praiseAccent,
    }),
    [theme],
  );
  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellSize, cellGap],
  );

  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const [measureBoard, setMeasureBoard] = useState<() => void>(() => () => {});
  const handleMeasureBoardReady = useCallback((nextMeasureBoard: () => void) => {
    setMeasureBoard(() => nextMeasureBoard);
  }, []);
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);
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
  const [restartOpen, setRestartOpen] = useState(false);
  const [boardLayout, setBoardLayout] = useState<BoardLayout | null>(null);
  const [trayLayout, setTrayLayout] = useState<BoardLayout | null>(null);
  const entryHandled = useRef(false);
  const returnedAtRef = useRef<number | null>(null);
  const returnedRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useAdPresentation.getState().fullscreenActive) return true;
      const current = useGameStore.getState();
      if (current.game.status === 'over' && current.classicMeta?.runId) {
        leaveRewardedOffer(current.classicMeta.runId);
      }
      if (restartOpen) {
        setRestartOpen(false);
        return true;
      }
      setPaused((current) => !current);
      return true;
    });
    return () => subscription.remove();
  }, [restartOpen]);

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
        if (meta?.runKind === 'tutorial' && useFtueStore.getState().runId !== meta.runId) {
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
      if (summary.kind === 'active' && summary.runKind === 'tutorial' && loadSaved()) {
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
      const rawStartTs = Array.isArray(params.startTs) ? params.startTs[0] : params.startTs;
      const startedAt = Number(rawStartTs);
      useAnalyticsStore.getState().track('game_visible', {
        entry:
          entry === 'resume' || entry === 'new' || entry === 'tutorial'
            ? entry
            : 'unknown',
        latency_ms: Number.isFinite(startedAt) ? Math.max(0, Date.now() - startedAt) : 0,
        network_ready: Boolean(useProfileStore.getState().authToken),
      });
    }, 0);
    return () => clearTimeout(readyTimer);
  }, [
    discardAndStartNew,
    loadSaved,
    params.entry,
    params.startTs,
    router,
  ]);

  const { onGrab: feedbackOnGrab, onInvalidDrop: feedbackOnInvalidDrop } = useGameFeedback();
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
  const onInvalidDrop = useCallback((reason: 'occupied' | 'outside-board') => {
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
  }, [feedbackOnInvalidDrop, invalidDropNotice]);
  const onReturn = useCallback(() => {
    feedbackOnInvalidDrop('outside-board');
  }, [feedbackOnInvalidDrop]);
  const onUnavailablePiecePress = useCallback((shapeId: string) => {
    invalidDropNotice.report('unavailable', shapeId);
  }, [invalidDropNotice]);
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
      const postCommitPlayable = useGameStore.getState().game.status === 'playing' && !event.gameOver;
      const readinessSource = turnReadinessSource(event.newTray, postCommitPlayable);
      if (!readinessSource) {
        pendingTrayReadyRef.current = null;
        setTrayReadyToken(null);
      } else if (readinessSource === 'native_layout') {
        const token = `classic:${event.score}:${commitStartedAt}`;
        pendingTrayReadyRef.current = { token, committedAt: commitStartedAt, clearedLines };
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
      const tutorialRun = useGameStore.getState().classicMeta?.runKind === 'tutorial';
      if (tutorialRun) {
        useAnalyticsStore.getState().track('tutorial_action', {
          step: ftue.status,
          result:
            event.clearedRows.length + event.clearedCols.length > 0 ? 'clear' : 'valid_drop',
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
      x: boardLayout.x + col * (cellSize + cellGap),
      y: boardLayout.y + row * (cellSize + cellGap),
      size: cellSize,
    }));
  }, [boardLayout, cellGap, cellSize, tutorialRecommendation]);
  const tutorialPieceCenter = tutorialRecommendation
    ? {
        x: trayLayout
          ? trayLayout.x + ((tutorialRecommendation.trayIndex + 0.5) * trayLayout.width) / 3
          : ((tutorialRecommendation.trayIndex + 0.5) * screenWidth) / 3,
        y: trayLayout ? trayLayout.y + trayLayout.height / 2 : screenHeight - trayHeight - 110,
      }
    : undefined;

  const dragCtx: DragCtx = useMemo(
    () => ({
      geom,
      boardOrigin,
      measureBoard,
      boardMirror,
      preview,
      previewColor,
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
    [geom, theme, trayFit, measureBoard, onDrop, feedbackOnGrab, onGrab, onReturn, onInvalidDrop, onUnavailablePiecePress, lang],
  );

  const goHome = useCallback(() => {
    if (useAdPresentation.getState().fullscreenActive) return;
    const analytics = useAnalyticsStore.getState();
    const current = useGameStore.getState();
    if (current.classicMeta?.runId) leaveRewardedOffer(current.classicMeta.runId);
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
    if (current.classicMeta?.runId) leaveRewardedOffer(current.classicMeta.runId);
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
  const confirmRestart = useCallback(() => {
    setPaused(false);
    setRestartOpen(true);
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
      <SafeAreaView style={{ flex: 1, overflow: 'hidden', backgroundColor: theme.bgTop }} edges={['top', 'bottom']}>
        <View
          importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}
          onLayout={handlePlayfieldLayout}
          pointerEvents={status === 'over' ? 'none' : 'auto'}
          style={{
            flex: 1,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: verticalGap,
            paddingTop: PLAYFIELD_LAYOUT.contentTopPadding,
            paddingBottom: 0,
            overflow: 'hidden',
          }}
        >
          <GameBackground boardSize={boardSize} boardLayout={boardLayout} tutorial={ftueActive} {...bgPalette} />
          {/* Эволюция сцены по ходу партии: аврора+искры поверх фона, под UI. */}
          <AtmosphereLayer
            glowColors={theme.juiceColors}
            accent={theme.praiseAccent}
            active={!ftueActive}
          />
          <View style={{ width: '100%', height: hudHeight, overflow: 'hidden', zIndex: 30 }}>
            <NewRecordCelebration />
            <View style={{ zIndex: 1 }}><Hud compact={compactHeader} onPause={() => setPaused(true)} /></View>
          </View>

          {/* Every interactive control stays inside its own native row bounds. */}
          <View
            testID="game-companion-rail"
            pointerEvents={ftueActive ? 'none' : 'box-none'}
            style={
              ftueActive
                ? { display: 'none' }
                : {
                    width: railWidth,
                    height: mascotHeight,
                    flexDirection: 'row',
                    gap: 8,
                    zIndex: 35,
                  }
            }
          >
            <View style={{ width: mascotWidth, height: mascotHeight }}>
              <MascotLayer width={mascotWidth} height={mascotHeight} compact={compactHeader} dragActive={dragActive} active={!ftueActive} onEmoteReady={handleMascotEmoteReady} onLostTextChange={setMascotLostText} />
            </View>
            <HelperControls width={Math.max(0, railWidth - mascotWidth - 8)} height={mascotHeight} compact={compactHeader} active={!ftueActive} />
          </View>

          <View testID="game-board-frame" onLayout={handleBoardLayout}>
            <BoardAuraFrame accent={theme.praiseAccent} edge={theme.juiceColors[0]} />
            <BoardView onMeasureBoardReady={handleMeasureBoardReady} />
            {/* Keep the event consumer mounted throughout FTUE. Mounting it only
                after the 700 ms tutorial celebration replayed the already-finished
                clear event late, so “КОСМОС!” appeared after the board animation. */}
            <PraiseBanner suppressed={notificationBusy || atmosphereVisible} />
            <View testID="board-notification-slot" pointerEvents="box-none" style={{ position: 'absolute', top: 8, left: 8, right: 8, height: Math.max(0, boardSize - 16), zIndex: 50 }}>
              <MascotMessages active={!ftueActive && showMascot} lostText={mascotLostText} onEmote={relayMascotEmote} />
              <AtmosphereToast hidden={notificationBusy} onVisibleChange={setAtmosphereVisible} />
            </View>
          </View>

          <View
            onLayout={(event) => {
              const { x, y, width, height } = event.nativeEvent.layout;
              setTrayLayout((current) =>
                current && current.x === x && current.y === y && current.width === width && current.height === height
                  ? current
                  : { x, y, width, height },
              );
            }}
            style={{ width: '100%', height: trayHeight, position: 'relative' }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 18,
                right: 18,
                top: 8,
                bottom: 8,
                borderRadius: 30,
                backgroundColor: 'rgba(16, 74, 175, 0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.26)',
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
          </View>
          {/* Board/tray layouts are local to this playfield, including safe-area placement. */}
          <TutorialHints pieceCenter={tutorialPieceCenter} targetCells={tutorialTargetCells} />
        </View>

        <GameBannerDock
          hidden={game.status !== 'playing' || paused || restartOpen}
          {...bannerEligibility}
        />

        <EggToast />
        <InvalidDropNotice message={invalidDropNotice.message} />

        <GameOverOverlay
          onPlayAgain={() => startFresh('replay')}
          onOpenSettings={() => setPaused(true)}
        />
        <LevelUpReveal hidden={game.status === 'playing' && mascotMessageVisible} top={game.status === 'playing' && boardLayout ? insets.top + boardLayout.y + 8 : undefined} width={game.status === 'playing' ? Math.max(0, boardSize - 16) : undefined} />

        {paused ? (
          <PauseOverlay
            onClose={() => setPaused(false)}
            onRestart={confirmRestart}
            onHome={goHome}
          />
        ) : null}

        <ConfirmDialog
          visible={restartOpen}
          title={t('pause.restart', lang)}
          message={t('home.newGameConfirm', lang)}
          confirmLabel={t('pause.restart', lang)}
          cancelLabel={t('settings.cancel', lang)}
          destructive
          onConfirm={() => {
            setRestartOpen(false);
            startFresh('restart');
          }}
          onCancel={() => setRestartOpen(false)}
        />

      </SafeAreaView>
    </DragProvider>
  );
}
