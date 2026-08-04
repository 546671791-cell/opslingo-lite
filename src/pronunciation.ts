import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';
import { blobToBase64 } from './audio';
import type { PronunciationAssessment } from './types';

const configuredEndpoint = import.meta.env.VITE_SPEECH_API_URL?.trim();

export const speechApiConfigured = Boolean(configuredEndpoint);
/** Azure Neural is used for every visible English play button when this endpoint is configured. */
export const naturalSpeechConfigured = Boolean(configuredEndpoint);

const naturalSpeechCache = new Map<string, Blob>();
const maxNaturalSpeechCacheEntries = 80;

const speechTimeout = (text: string) => Math.min(20_000, Math.max(4_000, text.length * 140));

export async function stopEnglish() {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.stop();
    return;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speakEnglish(text: string, rate = 0.82) {
  await stopEnglish();
  if (Capacitor.isNativePlatform()) {
    await Promise.race([
      TextToSpeech.speak({
        text,
        lang: 'en-US',
        rate,
        pitch: 1,
        volume: 1,
        queueStrategy: 0
      }),
      new Promise<void>((resolve) => window.setTimeout(resolve, speechTimeout(text)))
    ]);
    return;
  }
  if (!('speechSynthesis' in window)) throw new Error('此设备不支持系统朗读。');
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(watchdog);
      if (error) reject(error);
      else resolve();
    };
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.volume = 1;
    const englishVoice = speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.onend = () => finish();
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') finish();
      else finish(new Error('朗读未能播放。请检查静音开关、媒体音量和系统语音设置。'));
    };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(() => window.speechSynthesis.resume(), 180);
    const watchdog = window.setTimeout(finish, speechTimeout(text));
  });
}

export async function synthesizeNaturalEnglish(text: string) {
  if (!configuredEndpoint) throw new Error('自然美式语音尚未配置，已切换为离线朗读。');
  const normalizedText = text.trim();
  const cached = naturalSpeechCache.get(normalizedText);
  if (cached) return cached;
  const response = await fetch(configuredEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'synthesize', text: normalizedText, locale: 'en-US' })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? '自然美式语音暂时不可用。');
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('audio/')) throw new Error('自然美式语音没有返回可播放音频。');
  const audio = await response.blob();
  if (!audio.size) throw new Error('自然美式语音没有返回可播放音频。');
  if (naturalSpeechCache.size >= maxNaturalSpeechCacheEntries) {
    const oldest = naturalSpeechCache.keys().next().value;
    if (oldest) naturalSpeechCache.delete(oldest);
  }
  naturalSpeechCache.set(normalizedText, audio);
  return audio;
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
