import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

export async function ensureMicrophonePermission() {
  if (!Capacitor.isNativePlatform()) return;
  const current = await SpeechRecognition.checkPermissions();
  if (current.speechRecognition === 'granted') return;
  const requested = await SpeechRecognition.requestPermissions();
  if (requested.speechRecognition !== 'granted') {
    throw new Error('MICROPHONE_PERMISSION_DENIED');
  }
  await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
}

export function microphoneErrorMessage(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/MICROPHONE_PERMISSION_DENIED|permission denied|notallowederror|not allowed/i.test(raw)) {
    return Capacitor.isNativePlatform()
      ? '麦克风权限未开启。请到手机“设置 → 应用 → OpsLingo Lite → 权限 → 麦克风”选择允许，然后返回重试。'
      : '麦克风权限未开启。请点浏览器地址栏旁的权限图标，允许此网站使用麦克风，然后刷新页面重试。';
  }
  if (/notfounderror|requested device not found|no recording device/i.test(raw)) {
    return '没有检测到可用麦克风，请检查系统录音设备。';
  }
  if (/notreadableerror|could not start audio source|audio recording error/i.test(raw)) {
    return '麦克风正被其他应用占用，请关闭其他录音或通话应用后重试。';
  }
  if (/SPEECH_RECOGNITION_UNAVAILABLE|recognition service/i.test(raw)) {
    return '此手机没有可用的英语识别服务。请安装或启用系统语音服务，并下载英语（美国）离线识别包。';
  }
  if (/NO_SPEECH_RESULT|no match|no speech|speech timeout/i.test(raw)) {
    return '没有识别到英文。请靠近麦克风、稍慢一些完整说完，然后重试。';
  }
  return `无法开启麦克风：${error instanceof Error ? error.message : String(error)}`;
}

export function isMicrophonePermissionError(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /MICROPHONE_PERMISSION_DENIED|permission denied|notallowederror|not allowed/i.test(raw);
}
