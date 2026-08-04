package io.github.opslingolite

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.getOfflineTtsConfig
import java.util.concurrent.Executors

/**
 * On-device US-English neural speech. The native runtime reads the model from
 * APK assets and streams PCM directly to the media channel. No text or audio
 * leaves the device in this path.
 */
@CapacitorPlugin(name = "OfflineNeuralSpeech")
class OfflineNeuralSpeechPlugin : Plugin() {
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var stopped = false
    @Volatile private var track: AudioTrack? = null
    private var tts: OfflineTts? = null

    private fun hasModel(context: Context): Boolean = try {
        context.assets.open("kokoro-en-v0_19/model.onnx").close()
        context.assets.open("kokoro-en-v0_19/voices.bin").close()
        context.assets.open("kokoro-en-v0_19/tokens.txt").close()
        true
    } catch (_: Exception) {
        false
    }

    private fun getTts(): OfflineTts {
        tts?.let { return it }
        if (!hasModel(context)) throw IllegalStateException("离线神经语音包尚未包含在此 APK 中。")
        val config = getOfflineTtsConfig(
            modelDir = "kokoro-en-v0_19",
            modelName = "model.onnx",
            acousticModelName = "",
            vocoder = "",
            voices = "voices.bin",
            lexicon = "",
            dataDir = "kokoro-en-v0_19/espeak-ng-data",
            dictDir = "",
            ruleFsts = "",
            ruleFars = "",
            numThreads = 4
        )
        return OfflineTts(context.assets, config).also { tts = it }
    }

    private fun createTrack(sampleRate: Int): AudioTrack {
        val minBuffer = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_FLOAT
        ).coerceAtLeast(sampleRate / 5)
        return AudioTrack(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
            AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                .setSampleRate(sampleRate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build(),
            minBuffer,
            AudioTrack.MODE_STREAM,
            AudioManager.AUDIO_SESSION_ID_GENERATE
        )
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val output = JSObject()
        output.put("available", hasModel(context))
        output.put("engine", "Kokoro neural US English")
        call.resolve(output)
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text")?.trim().orEmpty()
        if (text.isEmpty()) {
            call.reject("朗读内容不能为空。")
            return
        }
        val requestedSpeed = (call.getDouble("speed", 1.0) ?: 1.0).toFloat().coerceIn(0.7f, 1.3f)
        executor.execute {
            try {
                stopPlayback()
                val engine = getTts()
                val audioTrack = createTrack(engine.sampleRate())
                track = audioTrack
                stopped = false
                audioTrack.play()
                engine.generateWithCallback(text, sid = 2, speed = requestedSpeed) { samples ->
                    if (stopped) 0
                    else {
                        audioTrack.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING)
                        1
                    }
                }
                audioTrack.stop()
                audioTrack.release()
                if (track === audioTrack) track = null
                call.resolve()
            } catch (error: Exception) {
                stopPlayback()
                call.reject(error.message ?: "离线神经语音未能播放。", error)
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        stopPlayback()
        call.resolve()
    }

    private fun stopPlayback() {
        stopped = true
        track?.let {
            try { it.pause() } catch (_: Exception) { }
            try { it.flush() } catch (_: Exception) { }
            try { it.release() } catch (_: Exception) { }
        }
        track = null
    }

    override fun handleOnDestroy() {
        stopPlayback()
        tts?.release()
        executor.shutdownNow()
        super.handleOnDestroy()
    }
}
