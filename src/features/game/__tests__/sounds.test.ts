import type { PlacementEvent } from '@/core/engine';

import { soundForPlacement } from '../sound/soundEvents';

declare const __dirname: string;

function event(overrides: Partial<PlacementEvent> = {}): PlacementEvent {
  return {
    placed: [[0, 0]],
    colorId: 1,
    clearedRows: [],
    clearedCols: [],
    clearedCells: [],
    clearedColors: [],
    scoreDelta: 1,
    score: 1,
    combo: 0,
    praise: 'none',
    onFire: false,
    boardCleared: false,
    newTray: false,
    gameOver: false,
    ...overrides,
  };
}

describe('soundForPlacement', () => {
  it('maps a normal placement to drop', () => {
    expect(soundForPlacement(event())).toBe('drop');
  });

  it('maps one, two, and three lines deterministically', () => {
    expect(soundForPlacement(event({ clearedRows: [0] }))).toBe('clear1');
    expect(soundForPlacement(event({ clearedRows: [0, 1] }))).toBe('clear2');
    expect(soundForPlacement(event({ clearedRows: [0, 1, 2] }))).toBe('clear3');
  });

  it('maps a high combo clear to clear3', () => {
    expect(soundForPlacement(event({ clearedRows: [0], onFire: true, combo: 3 }))).toBe('clear3');
  });

  it('эскалирует по комбо: комбо ×2 с одной линией звучит как clear2', () => {
    expect(soundForPlacement(event({ clearedRows: [0], combo: 2 }))).toBe('clear2');
  });

  it('оставляет drop для хода без очистки независимо от комбо', () => {
    expect(soundForPlacement(event({ combo: 2 }))).toBe('drop');
  });

  it('gives Game Over precedence over clear and drop', () => {
    expect(
      soundForPlacement(event({ gameOver: true, clearedRows: [0, 1], onFire: true })),
    ).toBe('gameover');
  });
});

describe('sound player lifecycle', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('expo-audio');
  });

  it('rotates clear combo sounds across a small player pool for rapid repeats', () => {
    const players = Array.from({ length: 40 }, () => ({
      play: jest.fn(),
      seekTo: jest.fn(),
      release: jest.fn(),
    }));
    let nextPlayer = 0;

    jest.doMock('expo-audio', () => ({
      createAudioPlayer: jest.fn(() => players[nextPlayer++]),
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
    }));

    let soundModule: typeof import('../sound/sounds') | null = null;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      soundModule = require('../sound/sounds') as typeof import('../sound/sounds');
    });
    const { initSounds, playSound } = soundModule!;

    initSounds();
    playSound('clear3');
    playSound('clear3');
    playSound('clear3');

    const playedPlayers = players.filter((player) => player.play.mock.calls.length > 0);
    expect(playedPlayers).toHaveLength(3);
    expect(playedPlayers.every((player) => player.play.mock.calls.length === 1)).toBe(true);
  });

  it('exposes a cleanup path for direct expo-audio players', () => {
    const fs = jest.requireActual<{ readFileSync(path: string, encoding: string): string }>('fs');
    const source = fs.readFileSync(`${__dirname}/../sound/sounds.ts`, 'utf8');

    expect(source).toContain('export function releaseSounds');
    expect(source).toContain('player?.release()');
    expect(source).toContain('players = null');
  });
});
