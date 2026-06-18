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
  });

  it('rebuilds the preview only when the target cell changes', () => {
    expect(updateBody).toContain('const positionChanged');
    expect(updateBody).toContain('if (positionChanged)');
  });
});

describe('drag safety-net source contract', () => {
  const dragSource = fs.readFileSync(`${__dirname}/../drag/useDrag.ts`, 'utf8');
  const traySource = fs.readFileSync(`${__dirname}/../components/TrayPiece.tsx`, 'utf8');

  it('clears a stale preview and claims drag ownership on start (anti stuck-ghost)', () => {
    const startBody = dragSource.match(/\.onStart\(\(\) => \{([\s\S]*?)\r?\n    \}\)\r?\n    \.onUpdate/)?.[1];
    expect(startBody).toBeDefined();
    expect(startBody).toContain('ctx.preview.value = EMPTY_MASK');
    expect(startBody).toContain('ctx.dragOwner.value = trayIndex');
  });

  it('lets only the drag owner write the preview (serialises multitouch)', () => {
    expect(dragSource).toContain('if (ctx.dragOwner.value !== trayIndex) return;');
    expect(dragSource).toContain('ctx.dragOwner.value = -1;');
  });

  it('restores the hidden tray piece when the engine rejects the drop', () => {
    expect(dragSource).toContain('if (!placed)');
    expect(dragSource).toContain('committedOpacity.value = withTiming(1');
  });

  it('refreshes the board mirror from the live store before each drag', () => {
    expect(traySource).toContain('ctx.boardMirror.value = [...useGameStore.getState().game.board]');
  });

  it('re-runs the appearance effect per piece instance, not per shape id', () => {
    expect(traySource).toContain('}, [piece]);');
  });
});

describe('layout measurement source contract', () => {
  const boardSource = fs.readFileSync(`${__dirname}/../components/BoardView.tsx`, 'utf8');
  const traySource = fs.readFileSync(`${__dirname}/../components/TrayPiece.tsx`, 'utf8');
  const dragSource = fs.readFileSync(`${__dirname}/../drag/useDrag.ts`, 'utf8');

  it('remeasures board and tray slot positions after layout changes', () => {
    expect(boardSource).toContain('onLayout={onLayout}');
    expect(boardSource).toContain('measureInWindow');
    expect(traySource).toContain('onLayout={measureSlot}');
    expect(traySource).toContain('measureInWindow');
  });

  it('remeasures board and tray immediately before each drag', () => {
    expect(traySource).toContain('measureForDrag');
    expect(traySource).toContain('ctx.boardMeasureRef.current?.()');
    expect(dragSource).toContain('runOnJS(measureForDrag)()');
  });
});
