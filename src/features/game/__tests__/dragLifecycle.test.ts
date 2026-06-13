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
