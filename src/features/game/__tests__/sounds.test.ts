import type { PlacementEvent } from '@/core/engine';
import type { AudioStatus } from 'expo-audio';

import { soundForPlacement } from '../sound/soundEvents';

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

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

  it('preserves the destruction cue on a terminal clear', () => {
    expect(
      soundForPlacement(event({ gameOver: true, clearedRows: [0, 1], onFire: true })),
    ).toBe('clear3');
    expect(soundForPlacement(event({ gameOver: true }))).toBe('gameover');
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function mockPlayer() {
  const listeners = new Set<(status: Partial<AudioStatus>) => void>();
  const remove = jest.fn(() => listeners.clear());
  return {
    playing: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0.7,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
    addListener: jest.fn((_name: string, listener: (status: Partial<AudioStatus>) => void) => {
      listeners.add(listener);
      return { remove };
    }),
    remove,
    finish() {
      listeners.forEach((listener) => listener({ didJustFinish: true, playing: false }));
    },
  };
}

function setupAudio(modeReady: Promise<void> = Promise.resolve()) {
  const players: ReturnType<typeof mockPlayer>[] = [];
  const createAudioPlayer = jest.fn(() => {
    const player = mockPlayer();
    players.push(player);
    return player;
  });
  jest.doMock('expo-audio', () => ({
    createAudioPlayer,
    setAudioModeAsync: jest.fn(() => modeReady),
  }));
  let soundModule!: typeof import('../sound/sounds');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    soundModule = require('../sound/sounds') as typeof import('../sound/sounds');
  });
  return { ...soundModule, players, createAudioPlayer };
}

describe('sound player lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.dontMock('expo-audio');
  });

  it('starts preloaded sounds synchronously without seeking through the JS render work', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();

    audio.playSound('clear3');

    expect(audio.players.filter((player) => player.play.mock.calls.length)).toHaveLength(1);
    expect(audio.players.every((player) => player.seekTo.mock.calls.length === 0)).toBe(true);
    expect(audio.createAudioPlayer).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ keepAudioSessionActive: true }),
    );
  });

  it('uses three independent clear voices without cutting them off or queueing excess repeats', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();

    for (let index = 0; index < 8; index += 1) audio.playSound('clear3');
    await flushMicrotasks();

    const played = audio.players.filter((player) => player.play.mock.calls.length);
    expect(played).toHaveLength(3);
    expect(played.every((player) => player.play.mock.calls.length === 1)).toBe(true);
    expect(played.every((player) => player.seekTo.mock.calls.length === 0)).toBe(true);

    played.forEach((player) => player.finish());
    await flushMicrotasks();
    expect(played.every((player) => player.play.mock.calls.length === 1)).toBe(true);
  });

  it('rewinds finished voices ahead of the next input and reserves them until the async seek completes', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('clear3');
    audio.playSound('clear3');
    audio.playSound('clear3');
    await flushMicrotasks();
    const played = audio.players.filter((player) => player.play.mock.calls.length);
    const rewind = deferred();
    played[1].seekTo.mockReturnValueOnce(rewind.promise);

    played[1].finish();
    expect(played[1].pause).toHaveBeenCalledTimes(1);
    expect(played[1].seekTo).toHaveBeenCalledWith(0);
    expect(played[1].pause.mock.invocationCallOrder[0]).toBeLessThan(
      played[1].seekTo.mock.invocationCallOrder[0],
    );
    audio.playSound('clear3');
    await flushMicrotasks();
    expect(played.every((player) => player.play.mock.calls.length === 1)).toBe(true);

    rewind.resolve();
    await flushMicrotasks();
    audio.playSound('clear3');
    expect(played[1].play).toHaveBeenCalledTimes(2);
    expect(played[1].seekTo).toHaveBeenCalledTimes(1);
  });

  it('waits for the first audio session but does not seek a fresh voice', async () => {
    const mode = deferred();
    const audio = setupAudio(mode.promise);
    audio.playSound('pickup');
    expect(audio.players.every((player) => player.play.mock.calls.length === 0)).toBe(true);

    mode.resolve();
    await flushMicrotasks();
    expect(audio.players.filter((player) => player.play.mock.calls.length)).toHaveLength(1);
    expect(audio.players.every((player) => player.seekTo.mock.calls.length === 0)).toBe(true);
  });

  it.each(['pickup', 'drop'] as const)('plays every rapid %s even before native finish delivery', async (name) => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    for (let index = 0; index < 12; index += 1) {
      audio.playSound(name);
      await flushMicrotasks();
      const played = audio.players.filter((player) => player.play.mock.calls.length);
      expect(played.reduce((count, player) => count + player.play.mock.calls.length, 0)).toBe(index + 1);
      // ExoPlayer has finished, but its event has not reached JS yet.
      played.forEach((player) => { player.currentTime = player.duration; });
    }
  });

  it.each(['pickup', 'drop'] as const)('reserves a rewinding %s for the current input', async (name) => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound(name);
    audio.playSound(name);
    const played = audio.players.filter((player) => player.play.mock.calls.length);
    const rewind = deferred();
    played[0].seekTo.mockReturnValueOnce(rewind.promise);
    played[0].finish();
    audio.playSound(name);
    expect(played[0].play).toHaveBeenCalledTimes(1);
    rewind.resolve();
    await flushMicrotasks();
    expect(played[0].play).toHaveBeenCalledTimes(2);
    expect(played[0].seekTo).toHaveBeenCalledTimes(1);
  });

  it('restarts the oldest short input cue when both voices are still playing', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('pickup');
    now.mockReturnValue(20);
    audio.playSound('pickup');
    const played = audio.players.filter((player) => player.play.mock.calls.length);
    played.forEach((player) => { player.playing = true; });
    now.mockReturnValue(40);
    audio.playSound('pickup');
    await flushMicrotasks();
    expect(played[0].play).toHaveBeenCalledTimes(2);
    expect(played[1].play).toHaveBeenCalledTimes(1);
    expect(played[1].pause).not.toHaveBeenCalled();
  });

  it('cancels a reserved input when the sound session is released during its seek', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('drop');
    audio.playSound('drop');
    const played = audio.players.filter((player) => player.play.mock.calls.length);
    const rewind = deferred();
    played[0].seekTo.mockReturnValueOnce(rewind.promise);
    played[0].finish();
    audio.playSound('drop');
    audio.releaseSounds();
    rewind.resolve();
    await flushMicrotasks();
    expect(played.every((player) => player.play.mock.calls.length === 1)).toBe(true);
  });

  it('does not leave an input voice reserved after a synchronous seek failure', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('pickup');
    audio.playSound('pickup');
    const played = audio.players.filter((player) => player.play.mock.calls.length);
    played[0].seekTo.mockImplementationOnce(() => { throw new Error('seek unavailable'); });
    audio.playSound('pickup');
    await flushMicrotasks();
    audio.playSound('pickup');
    await flushMicrotasks();
    expect(played[0].seekTo).toHaveBeenCalledTimes(2);
    expect(played[0].play).toHaveBeenCalledTimes(2);
  });

  it('cancels pending sounds and disposes every player and listener on release', async () => {
    const mode = deferred();
    const audio = setupAudio(mode.promise);
    audio.playSound('pickup');
    audio.releaseSounds();
    mode.resolve();
    await flushMicrotasks();

    expect(audio.players.every((player) => player.play.mock.calls.length === 0)).toBe(true);
    expect(audio.players.every((player) => player.release.mock.calls.length === 1)).toBe(true);
    expect(audio.players.every((player) => player.remove.mock.calls.length === 1)).toBe(true);
  });

  it('does not let an old pending session start a released voice after reinitialization', async () => {
    const mode = deferred();
    const audio = setupAudio(mode.promise);
    audio.playSound('pickup');
    const oldPlayers = [...audio.players];
    audio.releaseSounds();
    audio.playSound('clear1');
    mode.resolve();
    await flushMicrotasks();

    expect(oldPlayers.every((player) => player.play.mock.calls.length === 0)).toBe(true);
    expect(audio.players.filter((player) => player.play.mock.calls.length)).toHaveLength(1);
  });

  it('discards stale startup feedback instead of playing a late burst after audio initialization', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const mode = deferred();
    const audio = setupAudio(mode.promise);
    audio.playSound('clear3');
    now.mockReturnValue(1000);
    mode.resolve();
    await flushMicrotasks();
    expect(audio.players.every((player) => player.play.mock.calls.length === 0)).toBe(true);

    audio.playSound('clear3');
    expect(audio.players.filter((player) => player.play.mock.calls.length)).toHaveLength(1);
  });

  it('does not revive a disposed voice when its pending rewind resolves', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('record');
    const player = audio.players.find((candidate) => candidate.play.mock.calls.length)!;
    const rewind = deferred();
    player.seekTo.mockReturnValueOnce(rewind.promise);
    player.finish();
    audio.releaseSounds();
    rewind.resolve();
    await flushMicrotasks();
    audio.playSound('record');
    await flushMicrotasks();

    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.release).toHaveBeenCalledTimes(1);
    expect(audio.players.filter((candidate) => candidate.play.mock.calls.length)).toHaveLength(2);
  });

  it('recovers a transient seek failure and plays the current input', async () => {
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('record');
    const player = audio.players.find((candidate) => candidate.play.mock.calls.length)!;
    player.seekTo.mockRejectedValueOnce(new Error('temporarily unavailable'));
    player.finish();
    await flushMicrotasks();

    audio.playSound('record');
    await flushMicrotasks();
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(player.seekTo).toHaveBeenCalledTimes(2);
  });

  it('recovers an OS-paused voice but leaves a long-running native sound untouched', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const audio = setupAudio();
    audio.initSounds();
    await flushMicrotasks();
    audio.playSound('record');
    const player = audio.players.find((candidate) => candidate.play.mock.calls.length)!;
    now.mockReturnValue(5000);
    player.playing = true;
    audio.playSound('record');
    expect(player.seekTo).not.toHaveBeenCalled();
    player.playing = false;
    player.isBuffering = true;
    audio.playSound('record');
    expect(player.seekTo).not.toHaveBeenCalled();

    player.isBuffering = false;
    audio.playSound('record');
    await flushMicrotasks();
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(2);
  });
});
