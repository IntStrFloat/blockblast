# GameAudio

Local Android Expo module for short, overlapping game sounds. SoundPool decodes
the ten WAV samples once and starts a fresh native stream for each request.

Native API (`requireNativeModule('GameAudio')`):

- `init(): Promise<void>` preloads every sample; rejects on loading failure.
- `play(name: string): number` returns a nonzero SoundPool stream ID on success,
  or zero when unready, backgrounded, or playback fails. Unknown names throw.
- `release(): void` releases resources and rejects pending initialization.
  A subsequent `init()` can prepare a fresh pool.

Initialization also starts when Expo creates the module. Call `init()` before
dispatching sounds. Backgrounding stops existing one-shots; returning does not
replay them. Native operations and load callbacks share a lock, and callbacks
from released pools are ignored.

Gradle generates packaged assets from the application's `assets/sounds/*.wav`.
Do not add duplicate WAV files here. Changes to this module require an Android
rebuild; JavaScript refresh alone cannot update native code or bundled samples.

Debug builds log `GameAudio` initialization and each playback's name, count,
stream ID and foreground state. These logs establish native acceptance, not
audibility; validate the emulator or device's recorded output as well.
