import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';
import { ensureMicrophonePermission } from './microphone';

export type RecognitionController = { stop: () => Promise<void> };
type RecognitionCallbacks = {
  onResult: (text: string) => void;
  onStatus: (message: string) => void;
  onError: (error: Error) => void;
  onEnd?: () => void;
};

export async function startEnglishDictation(
  callbacks: RecognitionCallbacks
): Promise<RecognitionController> {
  if (Capacitor.isNativePlatform()) return startNativeDictation(callbacks);
  return startBrowserDictation(callbacks);
}

async function startNativeDictation(callbacks: RecognitionCallbacks) {
  await ensureMicrophonePermission();
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('SPEECH_RECOGNITION_UNAVAILABLE');

  let resultReceived = false;
  let manuallyStopped = false;
  let fallbackStarted = false;
  let fallbackTimer = 0;
  let healthTimer = 0;
  let watchdogTimer = 0;

  const clearTimers = () => {
    window.clearTimeout(fallbackTimer);
    window.clearTimeout(healthTimer);
    window.clearTimeout(watchdogTimer);
  };
  const cleanup = async () => {
    clearTimers();
    await SpeechRecognition.removeAllListeners().catch(() => undefined);
  };
  const popupFallback = async () => {
    if (fallbackStarted || manuallyStopped || resultReceived) return;
    fallbackStarted = true;
    clearTimers();
    callbacks.onStatus('内嵌识别没有返回，正在打开系统语音识别面板…');
    await SpeechRecognition.stop().catch(() => undefined);
    await SpeechRecognition.removeAllListeners().catch(() => undefined);
    try {
      const result = await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 3,
        prompt: '请说出英文，识别后会自动写入回复框',
        partialResults: false,
        popup: true
      });
      const transcript = result.matches?.[0]?.trim();
      if (!transcript) throw new Error('NO_SPEECH_RESULT');
      resultReceived = true;
      callbacks.onResult(transcript);
      callbacks.onStatus(`已识别：${transcript}`);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      await cleanup();
      callbacks.onEnd?.();
    }
  };

  await SpeechRecognition.removeAllListeners();
  await SpeechRecognition.addListener('partialResults', ({ matches }) => {
    const transcript = matches[0]?.trim();
    if (!transcript) return;
    resultReceived = true;
    callbacks.onResult(transcript);
    callbacks.onStatus(`正在转写：${transcript}`);
  });
  await SpeechRecognition.addListener('listeningState', ({ status }) => {
    if (status === 'started') callbacks.onStatus('麦克风已启动，请开始说英文…');
    if (status === 'stopped' && !manuallyStopped) {
      fallbackTimer = window.setTimeout(() => {
        if (resultReceived) {
          callbacks.onStatus('语音输入已完成。');
          callbacks.onEnd?.();
          cleanup().catch(() => undefined);
        } else popupFallback().catch(callbacks.onError);
      }, 650);
    }
  });
  callbacks.onStatus('正在启动麦克风与英语识别服务…');
  await SpeechRecognition.start({
    language: 'en-US',
    maxResults: 3,
    prompt: '请用英语说出回复',
    partialResults: true,
    popup: false
  });

  healthTimer = window.setTimeout(async () => {
    const state = await SpeechRecognition.isListening().catch(() => ({ listening: false }));
    if (!state.listening && !resultReceived) await popupFallback();
  }, 900);
  watchdogTimer = window.setTimeout(popupFallback, 15_000);

  return {
    stop: async () => {
      manuallyStopped = true;
      clearTimers();
      await SpeechRecognition.stop().catch(() => undefined);
      await cleanup();
      callbacks.onStatus(resultReceived ? '语音输入已完成。' : '已停止语音输入。');
      callbacks.onEnd?.();
    }
  };
}

function startBrowserDictation(callbacks: RecognitionCallbacks): RecognitionController {
  const Recognition = browserSpeechRecognitionConstructor();
  if (!Recognition) throw new Error('SPEECH_RECOGNITION_UNAVAILABLE');
  const recognition = new Recognition();
  let stopped = false;
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? '')
      .join(' ')
      .trim();
    if (transcript) {
      callbacks.onResult(transcript);
      callbacks.onStatus(`正在转写：${transcript}`);
    }
  };
  recognition.onerror = (event) => {
    if (!stopped) callbacks.onError(new Error(`BROWSER_SPEECH_${event.error}`));
  };
  recognition.onend = () => {
    callbacks.onStatus('语音输入已结束。');
    callbacks.onEnd?.();
  };
  recognition.start();
  callbacks.onStatus('麦克风已启动，请开始说英文…');
  return {
    stop: async () => {
      stopped = true;
      recognition.stop();
      callbacks.onStatus('已停止语音输入。');
      callbacks.onEnd?.();
    }
  };
}

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
function browserSpeechRecognitionConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}
