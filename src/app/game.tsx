import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
import { useAnalyticsStore } from '@/features/analytics';
import {
  BoardView,
  DragProvider,
  EMPTY_MASK,
  PraiseBanner,
  TrayView,
  eggForScore,
  useGameFeedback,
  useGameStore,
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
import { MascotLayer } from '@/features/mascot';
import { AdBanner } from '@/features/monetization';
import {
  createTutorialGame,
  findTutorialRecommendation,
  useFtueStore,
} from '@/features/onboarding';
import { useProgressionSync } from '@/features/progression/hooks/useProgressionSync';
import { useProfileStore } from '@/features/profile';
import { useScores } from '@/features/scores';
import { useLang } from '@/features/settings';
import { useActiveWorldTheme } from '@/features/themes';
import { AppText, ConfirmDialog, getBoardMetrics, radii } from '@/ui';

type BoardLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const HUD_RESERVED_HEIGHT = 108;
const MASCOT_RESERVED_HEIGHT = 70;
const TRAY_SLOT_MIN_HEIGHT = 160;
const TRAY_SLOT_MAX_HEIGHT = 420;
const TRAY_SLOT_HEIGHT_RATIO = 0.18;
const AD_SLOT_MIN_HEIGHT = 150;
const AD_SLOT_MAX_HEIGHT = 190;
const AD_SLOT_HEIGHT_RATIO = 0.16;
const CONTENT_TOP_PADDING = 8;
const AD_BOTTOM_SAFE_GAP = 44;

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
  // Начисляет очки в Уровень Игры на game-over и сверяет гардероб Капи (спека 11 §6).
  useProgressionSync();
  const params = useLocalSearchParams<{
    entry?: string | string[];
    startTs?: string | string[];
  }>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const theme = useActiveWorldTheme();
  const stageHeight = Math.max(560, screenHeight);
  const verticalGap = Math.max(6, Math.min(12, Math.round(stageHeight * 0.009)));
  const trayHeight = Math.max(
    TRAY_SLOT_MIN_HEIGHT,
    Math.min(TRAY_SLOT_MAX_HEIGHT, Math.round(stageHeight * TRAY_SLOT_HEIGHT_RATIO)),
  );
  const [entryGamesPlayed] = useState(() => useScores.getState().gamesPlayed);
  const [ftueCompleteAtEntry] = useState(() =>
    ['complete', 'skipped'].includes(useFtueStore.getState().status),
  );
  const ftueStatus = useFtueStore((state) => state.status);
  const ftueActive = !['complete', 'skipped'].includes(ftueStatus);
  const gameBannerEligible = ftueCompleteAtEntry && entryGamesPlayed >= 2;
  const adSlotHeight = gameBannerEligible
    ? Math.max(
    AD_SLOT_MIN_HEIGHT,
    Math.min(AD_SLOT_MAX_HEIGHT, Math.round(stageHeight * AD_SLOT_HEIGHT_RATIO)),
      )
    : 0;
  const fixedChromeHeight =
    HUD_RESERVED_HEIGHT +
    (ftueActive ? 0 : MASCOT_RESERVED_HEIGHT) +
    trayHeight +
    adSlotHeight +
    verticalGap * (ftueActive ? 2 : 4) +
    CONTENT_TOP_PADDING +
    AD_BOTTOM_SAFE_GAP;
  const maxBoardSize = Math.max(240, stageHeight - fixedChromeHeight);
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
  const { boardSize, cellSize, cellGap } = getBoardMetrics(screenWidth, maxBoardSize);
  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellSize, cellGap],
  );

  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const boardMeasureRef = useRef<(() => void) | null>(null);
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const dragOwner = useSharedValue(-1);

  const loadSaved = useGameStore((s) => s.loadSaved);
  const discardAndStartNew = useGameStore((s) => s.discardAndStartNew);
  const game = useGameStore((s) => s.game);
  const tray = game.tray;
  const status = game.status;
  const [entryReady, setEntryReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [boardLayout, setBoardLayout] = useState<BoardLayout | null>(null);
  const [trayLayout, setTrayLayout] = useState<BoardLayout | null>(null);
  const entryHandled = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
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
      if (!loadSaved()) {
        router.replace('/');
        return;
      }
    } else if (entry === 'new') {
      discardAndStartNew();
    } else if (entry === 'tutorial') {
      const seed = 0x46545545;
      discardAndStartNew({ seed, initialGame: createTutorialGame(seed) });
      useFtueStore.getState().start();
    } else {
      router.replace('/');
      return;
    }

    const readyTimer = setTimeout(() => {
      setEntryReady(true);
      const rawStartTs = Array.isArray(params.startTs) ? params.startTs[0] : params.startTs;
      const startedAt = Number(rawStartTs);
      useAnalyticsStore.getState().track('game_visible', {
        entry: entry === 'resume' || entry === 'new' || entry === 'tutorial' ? 'home' : 'unknown',
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
  const onGrab = useCallback(() => {
    feedbackOnGrab();
    const ftue = useFtueStore.getState();
    if (ftue.status === 'grab_piece') {
      ftue.recordGrab();
      useAnalyticsStore.getState().track('tutorial_action', {
        step: 'grab_piece',
        result: 'grab',
        elapsed_ms: ftue.startedAt ? Date.now() - ftue.startedAt : 0,
      });
    }
  }, [feedbackOnGrab]);
  const onInvalidDrop = useCallback(() => {
    feedbackOnInvalidDrop();
    const ftue = useFtueStore.getState();
    if (!['complete', 'skipped'].includes(ftue.status)) {
      ftue.recordInvalidDrop();
      useAnalyticsStore.getState().track('tutorial_action', {
        step: ftue.status,
        result: 'invalid_drop',
        elapsed_ms: ftue.startedAt ? Date.now() - ftue.startedAt : 0,
      });
    }
  }, [feedbackOnInvalidDrop]);
  const onDrop = useCallback(
    (trayIndex: number, r: number, c: number) => {
      const event = useGameStore.getState().placePiece(trayIndex, r, c);
      if (!event) return false;
      const ftue = useFtueStore.getState();
      if (!['complete', 'skipped'].includes(ftue.status)) {
        ftue.recordValidDrop();
        useAnalyticsStore.getState().track('tutorial_action', {
          step: ftue.status,
          result: 'valid_drop',
          elapsed_ms: ftue.startedAt ? Date.now() - ftue.startedAt : 0,
        });
        if (event.clearedRows.length + event.clearedCols.length > 0) {
          const afterDrop = useFtueStore.getState();
          afterDrop.recordLineClear();
          useAnalyticsStore.getState().track('first_line_cleared', {
            elapsed_ms: afterDrop.startedAt ? Date.now() - afterDrop.startedAt : 0,
            placements: afterDrop.placements,
          });
        }
      }
      return true;
    },
    [],
  );

  const tutorialRecommendation = useMemo(
    () => (ftueActive ? findTutorialRecommendation(game) : null),
    [ftueActive, game],
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
      boardMeasureRef,
      boardMirror,
      preview,
      previewColor,
      dragActive,
      dragOwner,
      cellColors: theme.cellColors,
      boardBg: theme.boardBg,
      cellEmpty: theme.cellEmpty,
      onDrop,
      onGrab,
      onInvalidDrop,
    }),
    // Shared values are stable. Reactive inputs are geometry, theme, and callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geom, theme, onDrop, onGrab, onInvalidDrop],
  );

  const goHome = useCallback(() => router.replace('/'), [router]);
  const startFresh = useCallback(() => {
    useGameStore.getState().discardAndStartNew();
    setPaused(false);
  }, []);
  const confirmRestart = useCallback(() => {
    setPaused(false);
    setRestartOpen(true);
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
          pointerEvents={status === 'over' ? 'none' : 'auto'}
          style={{
            flex: 1,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: verticalGap,
            paddingTop: CONTENT_TOP_PADDING,
            paddingBottom: 0,
            overflow: 'hidden',
          }}
        >
          <GameBackground boardSize={boardSize} boardLayout={boardLayout} tutorial={ftueActive} {...bgPalette} />
          {/* Эволюция сцены по ходу партии: аврора+искры поверх фона, под UI. */}
          {!ftueActive ? <AtmosphereLayer glowColors={theme.juiceColors} accent={theme.praiseAccent} /> : null}
          <Hud onPause={() => setPaused(true)} />

          {!ftueActive ? <MascotLayer dragActive={dragActive} /> : null}

          <View onLayout={handleBoardLayout}>
            <BoardAuraFrame accent={theme.praiseAccent} edge={theme.juiceColors[0]} />
            <BoardView />
            {!ftueActive ? <PraiseBanner /> : null}
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
                top: 14,
                bottom: 14,
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
            <TrayView tray={tray} style={{ width: '100%', height: '100%' }} />
          </View>
          <View
            style={{
              width: '100%',
              height: adSlotHeight,
              alignItems: 'center',
              justifyContent: 'flex-end',
              // Поднимаем баннер над нижним краем: зазор уже заложен в
              // fixedChromeHeight (AD_BOTTOM_SAFE_GAP), но раньше не рендерился —
              // баннер прижимался к краю и обрезался поверх системной панели.
              paddingBottom: AD_BOTTOM_SAFE_GAP,
              overflow: 'hidden',
            }}
          >
            <AdBanner
              placement="game"
              ftueComplete={ftueCompleteAtEntry}
              gamesPlayed={entryGamesPlayed}
            />
          </View>
        </View>

        <TutorialHints pieceCenter={tutorialPieceCenter} targetCells={tutorialTargetCells} showInstruction={ftueActive} />
        <AtmosphereToast />
        <EggToast />
        <NewRecordCelebration />

        <GameOverOverlay
          onPlayAgain={startFresh}
          onOpenSettings={() => setPaused(true)}
        />

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
            startFresh();
          }}
          onCancel={() => setRestartOpen(false)}
        />
      </SafeAreaView>
    </DragProvider>
  );
}
