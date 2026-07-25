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

export function initSounds(): void {
  if (players) return;
  try {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
      () => {},
    );
    players = {};
    (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
      players![name] = Array.from({ length: POOL_SIZE[name] }, () =>
        createAudioPlayer(SOURCES[name]),
      );
    });
  } catch {
    players = null;
    cursors = {};
  }
}

export function playSound(name: SoundName): void {
  const pool = players?.[name];
  if (!pool?.length) return;

  const cursor = cursors[name] ?? 0;
  const player = pool[cursor % pool.length];
  cursors[name] = (cursor + 1) % pool.length;

  try {
    player.seekTo(0);
    player.play();
  } catch {
    // Sound feedback is optional.
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
}
