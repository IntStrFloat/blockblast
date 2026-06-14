import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut , useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/core/i18n';
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
import { GameOverOverlay } from '@/features/game/components/GameOverOverlay';
import { Hud } from '@/features/game/components/Hud';
import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import { TutorialHints } from '@/features/game/components/TutorialHints';
import type { DragCtx } from '@/features/game';
import { MascotLayer } from '@/features/mascot';
import { useLang, useSettings } from '@/features/settings';
import { AppText, getBlockTheme, getBoardMetrics, radii } from '@/ui';

/** Мини-тост пасхалки (спека 06): секундный, не блокирует геймплей. */
function EggToast() {
  const lastEvent = useGameStore((s) => s.lastEvent);
  const lang = useLang();
  const [egg, setEgg] = useState<{ id: number; text: string } | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.scoreDelta <= 0) return;
    const key = eggForScore(lastEvent.score - lastEvent.scoreDelta, lastEvent.score);
    if (!key) return;
    const id = ++counter.current;
    setEgg({ id, text: t(key, lang) });
    const timer = setTimeout(() => {
      if (counter.current === id) setEgg(null);
    }, 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

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
      <AppText preset="button">{egg.text} 🐟</AppText>
    </Animated.View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const themeId = useSettings((s) => s.themeId);
  const theme = getBlockTheme(themeId);

  const { boardSize, cellSize, cellGap } = getBoardMetrics(screenWidth);

  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellSize, cellGap],
  );

  // Shared values для drag-системы
  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);
  // Перф-сигнал drag для паузы мозга маскота (спека 09); слой маскота — Task 12.
  const dragActive = useSharedValue(0);

  const loadSaved = useGameStore((s) => s.loadSaved);
  const newGame = useGameStore((s) => s.newGame);

  useEffect(() => {
    const loaded = loadSaved();
    if (!loaded) newGame();
    // Только при маунте
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tray = useGameStore((s) => s.game.tray);
  const [paused, setPaused] = useState(false);

  // Звук + хаптика по событиям партии (спека 04)
  const { onGrab } = useGameFeedback();

  const onDrop = useCallback((trayIndex: number, r: number, c: number) => {
    useGameStore.getState().placePiece(trayIndex, r, c);
  }, []);

  const dragCtx: DragCtx = useMemo(
    () => ({
      geom,
      boardOrigin,
      boardMirror,
      preview,
      previewColor,
      dragActive,
      cellColors: theme.cellColors,
      boardBg: theme.boardBg,
      cellEmpty: theme.cellEmpty,
      onDrop,
      onGrab,
    }),
    // shared values стабильны; реактивные зависимости — geom/theme/колбэки
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geom, theme, onDrop, onGrab],
  );

  const goHome = useCallback(() => router.replace('/'), [router]);
  const restart = useCallback(() => {
    useGameStore.getState().newGame();
    setPaused(false);
  }, []);

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
          }}
        >
          <Hud onPause={() => setPaused(true)} />

          {/* Слой Капи над доской (спека 09) */}
          <MascotLayer dragActive={dragActive} />

          {/* Доска + похвалы поверх */}
          <View>
            <BoardView />
            <PraiseBanner />
          </View>

          {/* Трей */}
          <TrayView tray={tray} style={{ width: '100%', height: '22%' }} />
        </View>

        <TutorialHints />
        <EggToast />

        {paused ? (
          <PauseOverlay
            onResume={() => setPaused(false)}
            onRestart={restart}
            onHome={goHome}
          />
        ) : null}

        <GameOverOverlay onPlayAgain={restart} onHome={goHome} />
      </SafeAreaView>
    </DragProvider>
  );
}
