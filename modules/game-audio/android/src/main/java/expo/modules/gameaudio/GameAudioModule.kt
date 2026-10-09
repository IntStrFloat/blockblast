package expo.modules.gameaudio

import android.media.AudioAttributes
import android.media.SoundPool
import android.util.Log
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.LifecycleState
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Predecoded one-shots; each play creates a new native stream without seeking. */
class GameAudioModule : Module() {
  private val lock = Any()
  private var pool: SoundPool? = null
  private val samples = mutableMapOf<String, Int>()
  private val loaded = mutableSetOf<Int>()
  private val waiters = mutableListOf<Promise>()
  private val streams = ArrayDeque<Int>()
  private var loadError: String? = null
  private var foreground = false
  private var destroyed = false
  private var playCount = 0L

  override fun definition() = ModuleDefinition {
    Name("GameAudio")

    OnCreate {
      synchronized(lock) {
        foreground = (appContext.reactContext as? ReactContext)?.lifecycleState == LifecycleState.RESUMED
        prepare()
      }
    }

    AsyncFunction("init") { promise: Promise ->
      synchronized(lock) {
        if (destroyed) {
          promise.reject("ERR_GAME_AUDIO_RELEASED", "Audio module was destroyed", null)
        } else {
          waiters.add(promise)
          prepare()
          settleWaiters()
        }
      }
    }

    Function("play") { name: String ->
      synchronized(lock) {
        require(NAMES.contains(name)) { "Unknown game sound: $name" }
        val soundId = samples[name]
        val currentPool = pool
        val streamId = if (foreground && loadError == null && currentPool != null &&
          soundId != null && loaded.contains(soundId)) {
          currentPool.play(soundId, 1f, 1f, 1, 0, 1f)
        } else {
          0
        }
        if (streamId != 0) {
          // SoundPool itself evicts the oldest equal-priority stream at this limit.
          if (streams.size == MAX_STREAMS) streams.removeFirst()
          streams.addLast(streamId)
        }
        playCount += 1
        if (BuildConfig.DEBUG) {
          Log.d(TAG, "play count=$playCount name=$name stream=$streamId foreground=$foreground")
        }
        streamId
      }
    }

    Function("release") {
      synchronized(lock) { releasePool() }
    }

    OnActivityEntersBackground {
      synchronized(lock) {
        foreground = false
        // Stop, never autoPause/autoResume: an old drop must not replay on return.
        streams.forEach { pool?.stop(it) }
        streams.clear()
      }
    }

    OnActivityEntersForeground {
      synchronized(lock) { foreground = true }
    }

    OnDestroy {
      synchronized(lock) {
        destroyed = true
        releasePool()
      }
    }
  }

  // Every entry point, including asynchronous load callbacks, holds lock.
  private fun prepare() {
    if (pool != null || loadError != null || destroyed) return
    try {
      val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
      val newPool = SoundPool.Builder()
        .setMaxStreams(MAX_STREAMS)
        .setAudioAttributes(AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_GAME)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build())
        .build()
      pool = newPool
      newPool.setOnLoadCompleteListener { completedPool, sampleId, status ->
        synchronized(lock) {
          // Ignore callbacks from a pool released during reload or teardown.
          if (pool === completedPool) {
            if (status == 0) loaded.add(sampleId)
            else loadError = "Unable to decode sample $sampleId (status $status)"
            settleWaiters()
          }
        }
      }
      NAMES.forEach { name ->
        context.assets.openFd("game-audio/$name.wav").use { asset ->
          val sampleId = newPool.load(asset, 1)
          check(sampleId != 0) { "Unable to load game sound $name" }
          samples[name] = sampleId
        }
      }
    } catch (error: Exception) {
      loadError = error.message ?: "Unable to prepare game sounds"
    }
    settleWaiters()
  }

  private fun settleWaiters() {
    val error = loadError
    if (error == null && loaded.size != NAMES.size) return
    val pending = waiters.toList()
    waiters.clear()
    pending.forEach {
      if (error == null) it.resolve(null)
      else it.reject("ERR_GAME_AUDIO_LOAD", error, null)
    }
    if (BuildConfig.DEBUG && pending.isNotEmpty()) {
      Log.d(TAG, "init loaded=${loaded.size} error=$error")
    }
  }

  private fun releasePool() {
    val oldPool = pool
    pool = null
    oldPool?.setOnLoadCompleteListener(null)
    oldPool?.release()
    samples.clear()
    loaded.clear()
    streams.clear()
    loadError = null
    val pending = waiters.toList()
    waiters.clear()
    pending.forEach {
      it.reject("ERR_GAME_AUDIO_RELEASED", "Game sounds were released", null)
    }
  }

  companion object {
    private const val TAG = "GameAudio"
    private const val MAX_STREAMS = 32
    private val NAMES = listOf(
      "pickup", "drop", "clear1", "clear2", "clear3", "gameover",
      "record", "feed", "levelup", "lost"
    )
  }
}
