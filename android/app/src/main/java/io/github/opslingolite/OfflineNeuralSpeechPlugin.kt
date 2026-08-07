package io.github.opslingolite

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor bridge for the offline voice service.
 *
 * Neural inference runs in a secondary Android process. If a device cannot load
 * the native runtime or runs out of memory, Android may stop that process, but
 * the learning app remains alive and the web layer can fall back to system TTS.
 */
@CapacitorPlugin(name = "OfflineNeuralSpeech")
class OfflineNeuralSpeechPlugin : Plugin() {
    private fun hasModel(context: Context): Boolean = try {
        context.assets.open("$MODEL_ASSET_DIR/$MODEL_FILE").close()
        context.assets.open("$MODEL_ASSET_DIR/voices.bin").close()
        context.assets.open("$MODEL_ASSET_DIR/tokens.txt").close()
        true
    } catch (_: Throwable) {
        false
    }

    private fun supportsDeviceAbi(): Boolean = Build.SUPPORTED_ABIS.any {
        it == "arm64-v8a" || it == "armeabi-v7a"
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val output = JSObject()
        output.put("available", hasModel(context) && supportsDeviceAbi())
        output.put("engine", "Kokoro INT8 neural US English")
        call.resolve(output)
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text")?.trim().orEmpty()
        if (text.isEmpty()) {
            call.reject("朗读内容不能为空。")
            return
        }
        if (!hasModel(context) || !supportsDeviceAbi()) {
            call.reject("此设备不支持 APK 内置神经语音，已准备切换为系统朗读。")
            return
        }
        val speed = (call.getDouble("speed", 1.0) ?: 1.0).toFloat().coerceIn(0.7f, 1.3f)
        val receiver = object : ResultReceiver(Handler(Looper.getMainLooper())) {
            override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
                when (resultCode) {
                    SPEECH_RESULT_OK, SPEECH_RESULT_CANCELLED -> call.resolve()
                    else -> call.reject(
                        resultData?.getString(SPEECH_RESULT_MESSAGE)
                            ?: "离线神经语音未能播放，已准备切换为系统朗读。"
                    )
                }
            }
        }
        try {
            context.startService(
                Intent(context, OfflineNeuralSpeechService::class.java).apply {
                    action = SPEECH_ACTION_SPEAK
                    putExtra(SPEECH_EXTRA_TEXT, text)
                    putExtra(SPEECH_EXTRA_SPEED, speed)
                    putExtra(SPEECH_EXTRA_RECEIVER, receiver)
                }
            )
        } catch (error: Throwable) {
            call.reject(error.message ?: "无法启动离线神经语音。")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        try {
            context.stopService(Intent(context, OfflineNeuralSpeechService::class.java))
        } catch (_: Throwable) {
            // A stopped or unavailable secondary process is already the desired state.
        }
        call.resolve()
    }

    override fun handleOnDestroy() {
        try {
            context.stopService(Intent(context, OfflineNeuralSpeechService::class.java))
        } catch (_: Throwable) {
        }
        super.handleOnDestroy()
    }
}

internal const val MODEL_ASSET_DIR = "kokoro-int8-en-v0_19"
internal const val MODEL_FILE = "model.int8.onnx"
internal const val SPEECH_ACTION_SPEAK = "io.github.opslingolite.SPEAK"
internal const val SPEECH_EXTRA_TEXT = "text"
internal const val SPEECH_EXTRA_SPEED = "speed"
internal const val SPEECH_EXTRA_RECEIVER = "receiver"
internal const val SPEECH_RESULT_MESSAGE = "message"
internal const val SPEECH_RESULT_OK = 1
internal const val SPEECH_RESULT_ERROR = 2
internal const val SPEECH_RESULT_CANCELLED = 3
