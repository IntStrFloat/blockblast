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

interface SoundVoice {
  player: AudioPlayer;
  state: 'ready' | 'pending' | 'playing' | 'rewinding' | 'ended' | 'released';
  startedAt: number;
  rewind?: Promise<boolean>;
  subscription?: { remove: () => void };
}

type SoundPlayers = Partial<Record<SoundName, SoundVoice[]>>;

const MAX_START_DELAY_MS = 250;
let players: SoundPlayers | null = null;
let audioModeReady: Promise<void> | null = null;

function rewindVoice(voice: SoundVoice): Promise<boolean> {
  if (voice.state === 'released') return Promise.resolve(false);
  if (voice.state === 'rewinding' && voice.rewind) return voice.rewind;
  voice.state = 'rewinding';
  try {
    // ExoPlayer keeps playWhenReady at the end of a clip. Pause before seeking
    // so preparing a voice cannot accidentally replay its destruction sound.
    voice.player.pause();
    voice.rewind = Promise.resolve(voice.player.seekTo(0)).then(
      () => {
        if (voice.state === 'rewinding') voice.state = 'ready';
        return voice.state !== 'released';
      },
      () => {
        if (voice.state !== 'released') voice.state = 'ended';
        return false;
      },
    );
  } catch {
    voice.state = 'ended';
    voice.rewind = Promise.resolve(false);
  }
  return voice.rewind;
}

export function initSounds(): void {
  if (players) return;
  try {
    const session: SoundPlayers = {};
    players = session;
    (Object.keys(SOURCES) as SoundName[]).forEach((name) => {
      const pool: SoundVoice[] = [];
      session[name] = pool;
      for (let index = 0; index < POOL_SIZE[name]; index += 1) {
        const player = createAudioPlayer(SOURCES[name], {
          keepAudioSessionActive: true,
          updateInterval: 1000,
        });
        const voice: SoundVoice = { player, state: 'ready', startedAt: 0 };
        pool.push(voice);
        voice.subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (voice.state === 'released') return;
          if (status.didJustFinish && voice.state === 'playing') void rewindVoice(voice);
          else if (status.error) voice.state = 'ended';
        });
      }
    });
    // Audio mode is asynchronous in expo-audio. Do not start a one-shot until
    // the native session has accepted this configuration.
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {}).then(() => {
      if (players === session) audioModeReady = null;
    });
  } catch {
    releaseSounds();
  }
}

export function playSound(name: SoundName): void {
  // A very fast first interaction can precede the screen's effect hook.
  // Initialize here too so that event is delayed for the audio session instead
  // of being silently discarded.
  if (!players) initSounds();

  const pool = players?.[name];
  if (!pool?.length) return;

  const requestedAt = Date.now();
  let voice = pool.find((candidate) => candidate.state === 'ready');
  let preparation: Promise<boolean> | undefined;
  if (!voice) {
    voice = pool.find((candidate) => candidate.state === 'ended' || (
      candidate.state === 'playing' &&
      !candidate.player.playing && !candidate.player.isBuffering && (
        // Native completion can precede delivery of didJustFinish to JS.
        (candidate.player.duration > 0 && candidate.player.currentTime >= candidate.player.duration) ||
        requestedAt - candidate.startedAt > Math.max(candidate.player.duration * 1000, 1000)
      )
    ));
    if (voice) preparation = rewindVoice(voice);
  }
  if (!voice && (name === 'pickup' || name === 'drop')) {
    // Input cues must survive rapid repeats and an in-flight seek. Longer
    // celebration sounds keep their overlap limit and are never cut short.
    voice = pool.find((candidate) => candidate.state === 'rewinding');
    if (voice) {
      preparation = voice.rewind;
    } else {
      voice = pool.filter((candidate) => candidate.state === 'playing')
        .sort((a, b) => a.startedAt - b.startedAt)[0];
      if (voice) preparation = rewindVoice(voice);
    }
  }
  if (!voice) return;
  // Reserve synchronously so another input cannot claim the same rewind.
  voice.state = 'pending';
  const reservedVoice = voice;

  const play = () => {
    const voice = reservedVoice;
    if (voice.state !== 'pending') return;
    if (Date.now() - requestedAt > MAX_START_DELAY_MS) {
      voice.state = 'ready';
      return;
    }
    voice.state = 'playing';
    voice.startedAt = Date.now();
    try {
      // Finished voices are rewound ahead of time, off the input/render path.
      voice.player.play();
    } catch {
      voice.state = 'ended';
    }
  };
  if (preparation) {
    void Promise.all([preparation, audioModeReady]).then(([ready]) => {
      if (ready) play();
      else if (reservedVoice.state === 'pending') reservedVoice.state = 'ended';
    });
  } else if (audioModeReady) {
    void audioModeReady.then(play, play);
  } else {
    play();
  }
}

export function releaseSounds(): void {
  if (!players) return;
  const session = players;
  players = null;
  audioModeReady = null;
  Object.values(session).forEach((pool) => {
    pool?.forEach((voice) => {
      voice.state = 'released';
      try {
        voice.subscription?.remove();
      } catch {
        // Still release the native player if listener cleanup fails.
      }
      try {
        voice.player.release();
      } catch {
        // Sound feedback is optional.
      }
    });
  });
}
