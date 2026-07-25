import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

export type SoundName =
  | 'pickup'
  | 'drop'
  | 'clear1'
  | 'clear2'
  | 'clear3'
  | 'gameover'
  | 'record'
  | 'feed'
  | 'levelup'
  | 'lost';

const SOURCES: Record<SoundName, number> = {
  pickup: require('../../../../assets/sounds/pickup.wav'),
  drop: require('../../../../assets/sounds/drop.wav'),
  clear1: require('../../../../assets/sounds/clear1.wav'),
  clear2: require('../../../../assets/sounds/clear2.wav'),
  clear3: require('../../../../assets/sounds/clear3.wav'),
  gameover: require('../../../../assets/sounds/gameover.wav'),
  record: require('../../../../assets/sounds/record.wav'),
  feed: require('../../../../assets/sounds/feed.wav'),
  levelup: require('../../../../assets/sounds/levelup.wav'),
  lost: require('../../../../assets/sounds/lost.wav'),
};

const POOL_SIZE: Record<SoundName, number> = {
  pickup: 2,
  drop: 2,
  clear1: 3,
  clear2: 3,
  clear3: 3,
  gameover: 1,
  record: 1,
  feed: 1,
  levelup: 1,
  lost: 1,
};

let players: Partial<Record<SoundName, AudioPlayer[]>> | null = null;
let cursors: Partial<Record<SoundName, number>> = {};
let audioModeReady: Promise<void> | null = null;
let playbackTails = new WeakMap<AudioPlayer, Promise<void>>();

export function initSounds(): void {
  if (players) return;
  try {
    players = {};
    (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
      players![name] = Array.from({ length: POOL_SIZE[name] }, () =>
        createAudioPlayer(SOURCES[name]),
      );
    });
    // Audio mode is asynchronous in expo-audio. Do not start a one-shot until
    // the native session has accepted this configuration.
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
  } catch {
    players = null;
    cursors = {};
    audioModeReady = null;
  }
}

function restartPlayer(player: AudioPlayer): void {
  // `seekTo` is async on iOS and Android. Serialize restarts per player so a
  // fast pickup/combo cannot call `play` before its seek has completed.
  const previous = playbackTails.get(player) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => Promise.resolve(player.seekTo(0)))
    .then(() => {
      player.play();
    })
    .catch(() => {});

  playbackTails.set(player, next);
}

export function playSound(name: SoundName): void {
  // A very fast first interaction can precede the screen's effect hook.
  // Initialize here too so that event is delayed for the audio session instead
  // of being silently discarded.
  if (!players) initSounds();

  const pool = players?.[name];
  if (!pool?.length) return;

  const cursor = cursors[name] ?? 0;
  const player = pool[cursor % pool.length];
  cursors[name] = (cursor + 1) % pool.length;

  const play = () => restartPlayer(player);
  if (audioModeReady) {
    void audioModeReady.then(play, play);
  } else {
    play();
  }
}

export function releaseSounds(): void {
  if (!players) return;
  Object.values(players).forEach((pool) => {
    pool?.forEach((player) => {
      try {
        player?.release();
      } catch {
        // Sound feedback is optional.
      }
    });
  });
  players = null;
  cursors = {};
  audioModeReady = null;
  playbackTails = new WeakMap<AudioPlayer, Promise<void>>();
}
