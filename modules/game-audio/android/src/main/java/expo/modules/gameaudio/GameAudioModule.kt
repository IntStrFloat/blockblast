package expo.modules.gameaudio

import android.media.AudioAttributes
import android.media.SoundPool
import android.util.Log
import android.os.SystemClock
import org.json.JSONObject
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
  private data class ActiveStream(val id: Int, val endsAt: Long)
  private data class Sample(val name: String, val durationMs: Long)
  private val streams = ArrayDeque<ActiveStream>()
  private val cues = mutableMapOf<String, List<Sample>>()
  private val lastVariant = mutableMapOf<String, Int>()
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
        val variants = requireNotNull(cues[name]) { "Unknown game sound: $name" }
        val previous = lastVariant[name] ?: -1
        // Random alternate without consecutive repeats; no pitch-shifted resampling.
        val offset = if (variants.size > 1) (1 until variants.size).random() else 0
        val next = if (previous < 0) variants.indices.random() else (previous + offset) % variants.size
        val sample = variants[next]
        val soundId = samples[sample.name]
        val currentPool = pool
        val now = SystemClock.uptimeMillis()
        streams.removeAll { it.endsAt <= now }
        // Refuse overload instead of SoundPool stealing and chopping an audible tail.
        val streamId = if (foreground && loadError == null && currentPool != null &&
          streams.size < MAX_STREAMS && soundId != null && loaded.contains(soundId)) {
          currentPool.play(soundId, 0.85f, 0.85f, 1, 0, 1f)
        } else 0
        if (streamId != 0) {
          lastVariant[name] = next
          streams.addLast(ActiveStream(streamId, now + sample.durationMs + 24))
        }
        playCount += 1
        if (BuildConfig.DEBUG) {
          Log.d(TAG, "play count=$playCount name=$name variant=${sample.name} active=${streams.size} stream=$streamId foreground=$foreground")
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
        streams.forEach { pool?.stop(it.id) }
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
      val manifest = JSONObject(context.assets.open("game-audio/sound-bank.json").bufferedReader().use { it.readText() })
      manifest.keys().forEach { cue ->
        val entries = manifest.getJSONArray(cue)
        cues[cue] = (0 until entries.length()).map { i ->
          val entry = entries.getJSONObject(i)
          Sample(entry.getString("name"), entry.getLong("durationMs"))
        }
      }
      cues.values.flatten().forEach { sample ->
        val name = sample.name
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
    if (error == null && (loaded.size != samples.size || samples.isEmpty())) return
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
    cues.clear()
    lastVariant.clear()
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

  }
}
