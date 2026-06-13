import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
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
import type { DragCtx } from '@/features/game';
import { GameOverOverlay } from '@/features/game/components/GameOverOverlay';
import { Hud } from '@/features/game/components/Hud';
import { PauseOverlay } from '@/features/game/components/PauseOverlay';
import { TutorialHints } from '@/features/game/components/TutorialHints';
import { AdBanner } from '@/features/monetization';
import { useLang, useSettings } from '@/features/settings';
import { AppText, getBlockTheme, getBoardMetrics, radii } from '@/ui';

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
  }, [lang, lastEvent]);

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
  const params = useLocalSearchParams<{
    entry?: string | string[];
    seed?: string | string[];
    challengeDate?: string | string[];
  }>();
  const { width: screenWidth } = useWindowDimensions();
  const themeId = useSettings((s) => s.themeId);
  const theme = getBlockTheme(themeId);
  const { boardSize, cellSize, cellGap } = getBoardMetrics(screenWidth);
  const geom = useMemo(
    () => ({ boardSize, cell: cellSize, gap: cellGap, pad: 0 }),
    [boardSize, cellSize, cellGap],
  );

  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);

  const loadSaved = useGameStore((s) => s.loadSaved);
  const discardAndStartNew = useGameStore((s) => s.discardAndStartNew);
  const tray = useGameStore((s) => s.game.tray);
  const status = useGameStore((s) => s.game.status);
  const [entryReady, setEntryReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const entryHandled = useRef(false);

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
      discardAndStartNew({ mode: 'weekly' });
    } else if (entry === 'daily') {
      const rawSeed = Array.isArray(params.seed) ? params.seed[0] : params.seed;
      const challengeDate = Array.isArray(params.challengeDate)
        ? params.challengeDate[0]
        : params.challengeDate;
      const seed = Number(rawSeed);
      if (!Number.isFinite(seed) || !challengeDate) {
        router.replace('/');
        return;
      }
      discardAndStartNew({ seed, mode: 'daily', challengeDate });
    } else {
      router.replace('/');
      return;
    }

    const readyTimer = setTimeout(() => setEntryReady(true), 0);
    return () => clearTimeout(readyTimer);
  }, [
    discardAndStartNew,
    loadSaved,
    params.challengeDate,
    params.entry,
    params.seed,
    router,
  ]);

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
      cellColors: theme.cellColors,
      boardBg: theme.boardBg,
      cellEmpty: theme.cellEmpty,
      onDrop,
      onGrab,
    }),
    // Shared values are stable. Reactive inputs are geometry, theme, and callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geom, theme, onDrop, onGrab],
  );

  const goHome = useCallback(() => router.replace('/'), [router]);
  const startFresh = useCallback(() => {
    useGameStore.getState().discardAndStartNew();
    setPaused(false);
  }, []);
  const confirmRestart = useCallback(() => {
    Alert.alert(t('pause.restart', lang), t('home.newGameConfirm', lang), [
      { text: t('common.cancel', lang), style: 'cancel' },
      { text: t('pause.restart', lang), style: 'destructive', onPress: startFresh },
    ]);
  }, [lang, startFresh]);

  if (!entryReady) {
    return <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']} />;
  }

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          pointerEvents={status === 'over' ? 'none' : 'auto'}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
          }}
        >
          <Hud onPause={() => setPaused(true)} />

          <View>
            <BoardView />
            <PraiseBanner />
          </View>

          <TrayView tray={tray} style={{ width: '100%', height: '20%' }} />
          <AdBanner />
        </View>

        <TutorialHints />
        <EggToast />

        {paused ? (
          <PauseOverlay
            onResume={() => setPaused(false)}
            onRestart={confirmRestart}
            onHome={goHome}
          />
        ) : null}

        <GameOverOverlay onPlayAgain={startFresh} onHome={goHome} />
      </SafeAreaView>
    </DragProvider>
  );
}
