import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

export type SoundName =
  | 'pickup'
  | 'drop'
  | 'clear1'
  | 'clear2'
  | 'clear3'
  | 'gameover'
  | 'record';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES: Record<SoundName, number> = {
  pickup: require('@/assets/sounds/pickup.wav'),
  drop: require('@/assets/sounds/drop.wav'),
  clear1: require('@/assets/sounds/clear1.wav'),
  clear2: require('@/assets/sounds/clear2.wav'),
  clear3: require('@/assets/sounds/clear3.wav'),
  gameover: require('@/assets/sounds/gameover.wav'),
  record: require('@/assets/sounds/record.wav'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

let players: Partial<Record<SoundName, AudioPlayer>> | null = null;

/** Предзагрузка плееров при входе в игру (спека 07 п.6). Идемпотентно. */
export function initSounds(): void {
  if (players) return;
  try {
    // Микс с другим аудио, без записи
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
      () => {},
    );
    players = {};
    (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
      players![name] = createAudioPlayer(SOURCES[name]);
    });
  } catch {
    players = null; // звук недоступен (например, web) — играем молча
  }
}

export function playSound(name: SoundName): void {
  const p = players?.[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // звук не критичен
  }
}

/** Питч очистки растёт с комбо (спека 04). */
export function clearSoundFor(combo: number): SoundName {
  if (combo >= 3) return 'clear3';
  if (combo === 2) return 'clear2';
  return 'clear1';
}
