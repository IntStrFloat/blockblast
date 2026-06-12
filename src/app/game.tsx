import { useCallback, useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';

import { colors, getBoardMetrics, getBlockTheme } from '@/ui';
import { useSettings } from '@/features/settings';
import { BoardView, DragProvider, TrayView, useGameStore } from '@/features/game';
import type { DragCtx } from '@/features/game';
import { EMPTY_MASK } from '@/features/game/drag/gridMath';

export default function GameScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const themeId = useSettings((s) => s.themeId);
  const theme = getBlockTheme(themeId);

  const { boardSize, cellSize, cellGap } = getBoardMetrics(screenWidth);

  // Геометрия доски (спека 04: pad не указан отдельно — первая ячейка от края)
  const geom = {
    boardSize,
    cell: cellSize,
    gap: cellGap,
    pad: 0,
  };

  // Shared values для drag-системы
  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const boardMirror = useSharedValue<number[]>(new Array(64).fill(0));
  const preview = useSharedValue<number[]>(EMPTY_MASK);
  const previewColor = useSharedValue(0);

  // Загрузка или новая игра
  const loadSaved = useGameStore((s) => s.loadSaved);
  const newGame = useGameStore((s) => s.newGame);

  useEffect(() => {
    const loaded = loadSaved();
    if (!loaded) newGame();
    // Только при маунте
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tray = useGameStore((s) => s.game.tray);

  // onDrop — стабильный колбэк, вызывается из worklet через runOnJS
  const onDrop = useCallback((trayIndex: number, r: number, c: number) => {
    useGameStore.getState().placePiece(trayIndex, r, c);
  }, []);

  const dragCtx: DragCtx = {
    geom,
    boardOrigin,
    boardMirror,
    preview,
    previewColor,
    cellColors: theme.cellColors,
    onDrop,
  };

  return (
    <DragProvider value={dragCtx}>
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.bgBottom,
        }}
        edges={['top', 'bottom']}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 16,
          }}
        >
          {/* Placeholder для HUD (следующая задача) */}
          <View style={{ height: 48 }} />

          {/* Доска */}
          <BoardView />

          {/* Трей */}
          <TrayView
            tray={tray}
            style={{
              width: '100%',
              height: '22%',
            }}
          />
        </View>
      </SafeAreaView>
    </DragProvider>
  );
}
