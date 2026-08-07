package io.github.opslingolite

import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ResultReceiver
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.getOfflineTtsConfig
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/** Runs all native inference outside the main application process. */
class OfflineNeuralSpeechService : Service() {
    private val executor = Executors.newSingleThreadExecutor()
    private val generation = AtomicInteger(0)
    private val idleHandler = Handler(Looper.getMainLooper())
    private var tts: OfflineTts? = null
    private var track: AudioTrack? = null
    @Volatile private var stopped = true

    private val stopAfterIdle = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != SPEECH_ACTION_SPEAK) return START_NOT_STICKY
        val text = intent.getStringExtra(SPEECH_EXTRA_TEXT)?.trim().orEmpty()
        val speed = intent.getFloatExtra(SPEECH_EXTRA_SPEED, 1.0f).coerceIn(0.7f, 1.3f)
        @Suppress("DEPRECATION")
        val receiver = intent.getParcelableExtra<ResultReceiver>(SPEECH_EXTRA_RECEIVER)
        if (text.isEmpty() || receiver == null) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        idleHandler.removeCallbacks(stopAfterIdle)
        stopped = true
        val request = generation.incrementAndGet()
        executor.execute {
            if (request != generation.get()) {
                receiver.send(SPEECH_RESULT_CANCELLED, Bundle())
                return@execute
            }
            try {
                val engine = getOrCreateTts()
                val audioTrack = getOrCreateTrack(engine.sampleRate())
                stopped = false
                audioTrack.pause()
                audioTrack.flush()
                audioTrack.play()
                val audio = engine.generateWithConfigAndCallback(
                    text = text,
                    config = GenerationConfig(sid = 2, speed = speed),
                ) { samples ->
                    if (stopped || request != generation.get()) {
                        0
                    } else {
                        val written = audioTrack.write(
                            samples,
                            0,
                            samples.size,
                            AudioTrack.WRITE_BLOCKING
                        )
                        if (written >= 0) 1 else 0
                    }
                }
                if (request != generation.get() || stopped) {
                    receiver.send(SPEECH_RESULT_CANCELLED, Bundle())
                } else if (audio.samples.isEmpty()) {
                    throw IllegalStateException("离线语音没有生成音频。")
                } else {
                    audioTrack.pause()
                    receiver.send(SPEECH_RESULT_OK, Bundle())
                }
            } catch (error: Throwable) {
                stopPlayback()
                receiver.send(
                    SPEECH_RESULT_ERROR,
                    Bundle().apply {
                        putString(
                            SPEECH_RESULT_MESSAGE,
                            error.message ?: "设备无法运行离线神经语音。"
                        )
                    }
                )
            } finally {
                idleHandler.removeCallbacks(stopAfterIdle)
                idleHandler.postDelayed(stopAfterIdle, 120_000L)
            }
        }
        return START_NOT_STICKY
    }

    @Synchronized
    private fun getOrCreateTts(): OfflineTts {
        tts?.let { return it }
        val dataDir = prepareEspeakData()
        val config = getOfflineTtsConfig(
            modelDir = MODEL_ASSET_DIR,
            modelName = MODEL_FILE,
            acousticModelName = "",
            vocoder = "",
            voices = "voices.bin",
            lexicon = "",
            dataDir = dataDir,
            dictDir = "",
            ruleFsts = "",
            ruleFars = "",
            numThreads = 2
        )
        return OfflineTts(assets, config).also { engine ->
            require(engine.sampleRate() in 8_000..96_000) { "离线语音采样率无效。" }
            require(engine.numSpeakers() > 2) { "离线美式声音数据不完整。" }
            tts = engine
        }
    }

    private fun prepareEspeakData(): String {
        val root = File(filesDir, "offline-neural-voice-v2")
        val target = File(root, "espeak-ng-data")
        val marker = File(root, ".complete")
        if (!marker.exists()) {
            root.deleteRecursively()
            target.mkdirs()
            copyAssetTree("$MODEL_ASSET_DIR/espeak-ng-data", target)
            marker.writeText("kokoro-int8-en-v0_19-v1\n")
        }
        require(File(target, "en_dict").isFile) { "离线英文发音规则复制失败。" }
        return target.absolutePath
    }

    private fun copyAssetTree(source: String, destination: File) {
        val children = assets.list(source).orEmpty()
        if (children.isEmpty()) {
            destination.parentFile?.mkdirs()
            assets.open(source).use { input ->
                destination.outputStream().use { output -> input.copyTo(output) }
            }
            return
        }
        destination.mkdirs()
        children.forEach { child ->
            copyAssetTree("$source/$child", File(destination, child))
        }
    }

    @Synchronized
    private fun getOrCreateTrack(sampleRate: Int): AudioTrack {
        track?.let { existing ->
            if (existing.sampleRate == sampleRate && existing.state == AudioTrack.STATE_INITIALIZED) {
                return existing
            }
            try { existing.release() } catch (_: Throwable) { }
        }
        val bufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_FLOAT
        )
        require(bufferSize > 0) { "设备无法创建语音播放器。" }
        val next = AudioTrack(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
            AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build(),
            bufferSize,
            AudioTrack.MODE_STREAM,
            AudioManager.AUDIO_SESSION_ID_GENERATE
        )
        require(next.state == AudioTrack.STATE_INITIALIZED) { "设备语音播放器初始化失败。" }
        track = next
        return next
    }

    private fun stopPlayback() {
        stopped = true
        generation.incrementAndGet()
        track?.let { audioTrack ->
            try { audioTrack.pause() } catch (_: Throwable) { }
            try { audioTrack.flush() } catch (_: Throwable) { }
        }
    }

    override fun onDestroy() {
        idleHandler.removeCallbacks(stopAfterIdle)
        stopPlayback()
        try { track?.release() } catch (_: Throwable) { }
        track = null
        try { tts?.release() } catch (_: Throwable) { }
        tts = null
        executor.shutdownNow()
        super.onDestroy()
    }
}
