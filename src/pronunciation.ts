import { blobToBase64 } from './audio';
import type { PronunciationAssessment } from './types';

const configuredEndpoint = import.meta.env.VITE_SPEECH_API_URL?.trim();

export const speechApiConfigured = Boolean(configuredEndpoint);

export function speakEnglish(text: string) {
  if (!('speechSynthesis' in window)) throw new Error('此设备不支持系统朗读。');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  const englishVoice = speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLowerCase().startsWith('en'));
  if (englishVoice) utterance.voice = englishVoice;
  window.speechSynthesis.speak(utterance);
}

export async function assessPronunciation(audio: Blob, referenceText: string) {
  if (!configuredEndpoint) throw new Error('云端语音服务尚未配置。请先完成 Azure Function 部署。');
  const response = await fetch(configuredEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64: await blobToBase64(audio), referenceText, locale: 'en-US' })
  });
  const payload = (await response.json().catch(() => ({}))) as PronunciationAssessment & {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? '语音评分暂时不可用，请稍后重试。');
  return payload;
}
