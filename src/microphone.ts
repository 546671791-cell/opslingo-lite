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
  return `无法开启麦克风：${error instanceof Error ? error.message : String(error)}`;
}

export function isMicrophonePermissionError(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /MICROPHONE_PERMISSION_DENIED|permission denied|notallowederror|not allowed/i.test(raw);
}
