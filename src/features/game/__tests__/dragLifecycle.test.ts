import { dropCommitFor } from '../drag/dropLifecycle';

declare const __dirname: string;

const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');

describe('drop lifecycle', () => {
  it('does not commit a long hold or invalid release', () => {
    expect(dropCommitFor(1, -1, -1)).toBeNull();
  });

  it('does not commit a cancelled gesture', () => {
    expect(dropCommitFor(1, 2, 3, false)).toBeNull();
  });

  it('returns one commit payload for a valid completed drop', () => {
    expect(dropCommitFor(1, 2, 3, true)).toEqual({ trayIndex: 1, row: 2, col: 3 });
  });
});

describe('drag update source contract', () => {
  const source = fs.readFileSync(`${__dirname}/../drag/useDrag.ts`, 'utf8');
  const updateBody = source.match(
    /\.onUpdate\(\(event\) => \{([\s\S]*?)\r?\n    \}\)\r?\n    \.onEnd/,
  )?.[1];

  it('keeps bridge, persistence, audio, and React state work out of onUpdate', () => {
    expect(updateBody).toBeDefined();
    expect(updateBody).not.toMatch(/runOnJS|setString|playSound|setState/);
    expect(updateBody).toContain('dropValidity');
    expect(updateBody).toContain('invalidDropMask');
  });

  it('keeps layout work and animated elevation out of the gesture hot path', () => {
    expect(source).not.toContain('runOnJS(measureForDrag)()');
    expect(source).toContain('scheduleOnRN(measureForDrag)');
    expect(source).not.toContain('elevation.value');
  });

  it('rebuilds the preview only when the target cell changes', () => {
    expect(updateBody).toContain('const positionChanged');
    expect(updateBody).toContain('if (positionChanged)');
  });
});

describe('drag safety-net source contract', () => {
  const dragSource = fs.readFileSync(`${__dirname}/../drag/useDrag.ts`, 'utf8');
  const traySource = fs.readFileSync(`${__dirname}/../components/TrayPiece.tsx`, 'utf8');
  const classicSource = fs.readFileSync(`${__dirname}/../../../app/game.tsx`, 'utf8');
  const adventureSource = fs.readFileSync(`${__dirname}/../../../app/adventure-level.tsx`, 'utf8');

  it('clears a stale preview and claims drag ownership on start (anti stuck-ghost)', () => {
    const startBody = dragSource.match(/\.onStart\(\(\) => \{([\s\S]*?)\r?\n    \}\)\r?\n    \.onUpdate/)?.[1];
    expect(startBody).toBeDefined();
    expect(startBody).toContain('preview.value = EMPTY_MASK');
    expect(startBody).toContain('dragOwner.value = trayIndex');
  });

  it('lets only the drag owner write the preview (serialises multitouch)', () => {
    expect(dragSource).toContain('if (dragOwner.value !== trayIndex) return;');
    expect(dragSource).toContain('dragOwner.value = -1;');
    expect(dragSource).not.toContain('if (ctx.dragOwner.value !== trayIndex) return;');
  });

  it('restores the hidden tray piece when the engine rejects the drop', () => {
    expect(dragSource).toContain('if (!placed)');
    expect(dragSource).toContain('committedOpacity.value = withTiming(1');
  });

  it('publishes the committed board mirror before the next gesture can start', () => {
    expect(classicSource).toContain('boardMirror.value = [...useGameStore.getState().game.board]');
    expect(adventureSource).toContain('boardMirror.value = [...useGameStore.getState().game.board]');
  });

  it('starts a clear prelude on the UI thread before scheduling the JS commit', () => {
    const endBody = dragSource.match(
      /\.onEnd\(\(event, success\) => \{([\s\S]*?)\r?\n    \}\)\r?\n    \.onFinalize/,
    )?.[1];
    expect(endBody).toBeDefined();
    expect(endBody).toContain('clearPrelude.value = withSequence(');
    expect(endBody).toContain('dropCommitted.value = 1');
    expect(endBody!.indexOf('clearPrelude.value = withSequence(')).toBeLessThan(
      endBody!.indexOf('scheduleOnRN(onDropJS'),
    );
    expect(dragSource).toContain('if (!committed)');
  });

  it('shares the clear prelude with both game modes and the board preview', () => {
    const boardCellSource = fs.readFileSync(`${__dirname}/../components/BoardCell.tsx`, 'utf8');
    expect(classicSource).toContain('const clearPrelude = useSharedValue(0)');
    expect(adventureSource).toContain('const clearPrelude = useSharedValue(0)');
    expect(boardCellSource).toContain('ctx.clearPrelude');
    expect(boardCellSource).toContain('1 + prelude * 0.045');
  });

  it('re-runs the appearance effect per piece instance, not per shape id', () => {
    expect(traySource).toContain('}, [piece, reducedMotion]);');
  });

  it('keeps unavailable pieces honest but focusable for an explanation', () => {
    expect(traySource).toContain('accessibilityState={disabled ? { disabled: true } : undefined}');
    expect(traySource).toContain('ctx.onUnavailablePiecePress?.(shape.id)');
    expect(traySource).toContain('ctx.unavailablePieceLabel');
  });

  it('renders occupied conflicts with a dashed outline and X pattern', () => {
    const boardCellSource = fs.readFileSync(`${__dirname}/../components/BoardCell.tsx`, 'utf8');
    expect(boardCellSource).toContain("borderStyle: 'dashed'");
    expect(boardCellSource).toContain("rotate: '45deg'");
    expect(boardCellSource).toContain("rotate: '-45deg'");
    expect(boardCellSource).toContain('ctx.invalidPreview');
  });
});

describe('layout measurement source contract', () => {
  const boardSource = fs.readFileSync(`${__dirname}/../components/BoardView.tsx`, 'utf8');
  const traySource = fs.readFileSync(`${__dirname}/../components/TrayPiece.tsx`, 'utf8');
  const dragSource = fs.readFileSync(`${__dirname}/../drag/useDrag.ts`, 'utf8');
  const updateBody = dragSource.match(
    /\.onUpdate\(\(event\) => \{([\s\S]*?)\r?\n    \}\)\r?\n    \.onEnd/,
  )?.[1];

  it('remeasures board and tray slot positions after layout changes', () => {
    expect(boardSource).toContain('onLayout={onLayout}');
    expect(boardSource).toContain('measureInWindow');
    expect(traySource).toContain('onLayout={measureSlot}');
    expect(traySource).toContain('measureInWindow');
  });

  it('refreshes geometry once at gesture start while onUpdate stays UI-only', () => {
    expect(traySource).toContain('measureForDrag');
    expect(dragSource).toContain('scheduleOnRN(measureForDrag)');
    expect(updateBody).not.toContain('measureForDrag');
  });

  it('calls a plain measureBoard callback instead of mutating a ref object across the worklet boundary', () => {
    expect(traySource).toContain('measureBoard();');
    expect(dragSource).not.toContain('boardMeasureRef.current?.()');
    expect(boardSource).not.toContain('boardMeasureRef.current = measureBoard');
  });

  it('stores the measure callback as a value instead of invoking it as a React updater', () => {
    const classicSource = fs.readFileSync(`${__dirname}/../../../app/game.tsx`, 'utf8');
    const adventureSource = fs.readFileSync(`${__dirname}/../../../app/adventure-level.tsx`, 'utf8');
    expect(classicSource).toContain('setMeasureBoard(() => nextMeasureBoard)');
    expect(adventureSource).toContain('setMeasureBoard(() => nextMeasureBoard)');
    expect(classicSource).not.toContain('onMeasureBoardReady={setMeasureBoard}');
    expect(adventureSource).not.toContain('onMeasureBoardReady={setMeasureBoard}');
  });
});
