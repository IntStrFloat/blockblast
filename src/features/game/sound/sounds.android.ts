import { requireNativeModule } from 'expo';

import type { SoundName } from './sounds';

export type { SoundName } from './sounds';

interface GameAudio {
  init(): Promise<void>;
  play(name: SoundName): number;
  release(): void;
}

// Resolving the module starts native preloading while the app is still opening.
// Android effects use independent, predecoded streams: no seek or completion
// event is required before the next pickup/drop can play.
const audio = requireNativeModule<GameAudio>('GameAudio');
let ready = false;
let preparation: Promise<void> | null = null;
let generation = 0;

export function initSounds(): void {
  if (ready || preparation) return;
  const session = generation;
  preparation = audio.init().then(() => {
    if (session === generation) ready = true;
  }).catch((error: unknown) => {
    if (session === generation) {
      // A failed native pool retains its load error until released. Start the
      // next attempt with fresh samples instead of rejecting forever.
      audio.release();
      preparation = null;
    }
    console.warn('Unable to prepare game sounds', error);
  });
}

export function playSound(name: SoundName): void {
  initSounds();
  const session = generation;
  const play = () => {
    if (!ready || session !== generation) return;
    // Native code suppresses background playback and reports unsuccessful plays.
    audio.play(name);
  };
  if (ready) play();
  else void preparation?.then(play);
}

export function releaseSounds(): void {
  generation += 1;
  ready = false;
  preparation = null;
  audio.release();
}
