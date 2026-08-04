import { useEffect, useRef, useState } from 'preact/hooks';
import { recordedAudioToWav } from './audio';
import {
  ensureMicrophonePermission,
  isMicrophonePermissionError,
  microphoneErrorMessage
} from './microphone';
import { scoreLocalPronunciation, type LocalPronunciationResult } from './localPronunciation';
import { assessPronunciation, naturalSpeechConfigured, speechApiConfigured } from './pronunciation';
import { startEnglishDictation, type RecognitionController } from './speechRecognition';
import type { PronunciationAssessment, VocabularyEntry } from './types';

export function PronunciationPractice({ entry }: { entry: VocabularyEntry }) {
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('先听示范，再录下自己的跟读。');
  const [result, setResult] = useState<PronunciationAssessment | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [localListening, setLocalListening] = useState(false);
  const [localStatus, setLocalStatus] = useState('点“开始本地跟读”，朗读上方英文。');
  const [localResult, setLocalResult] = useState<LocalPronunciationResult | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recognition = useRef<RecognitionController | null>(null);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    return () => {
      stopTracks();
      recognition.current?.stop().catch(() => undefined);
    };
  }, []);

  const toggleLocalPractice = async () => {
    if (localListening) {
      await recognition.current?.stop();
      recognition.current = null;
      setLocalListening(false);
      return;
    }
    try {
      setLocalResult(null);
      setLocalListening(true);
      recognition.current = await startEnglishDictation({
        onResult: (text) => {
          const next = scoreLocalPronunciation(entry.term, text);
          setLocalResult(next);
          setLocalStatus(`识别到：${text}`);
        },
        onStatus: setLocalStatus,
        onError: (error) => {
          setLocalListening(false);
          setLocalStatus(microphoneErrorMessage(error));
        },
        onEnd: () => setLocalListening(false)
      });
    } catch (error) {
      setLocalListening(false);
      setPermissionBlocked(isMicrophonePermissionError(error));
      setLocalStatus(microphoneErrorMessage(error));
    }
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage('此浏览器不支持录音。请使用最新版 Safari、Chrome 或 Android 应用。');
      return;
    }
    try {
      await ensureMicrophonePermission();
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = input;
      chunks.current = [];
      const nextRecorder = new MediaRecorder(input);
      recorder.current = nextRecorder;
      nextRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      nextRecorder.onstop = async () => {
        try {
          setBusy(true);
          const source = new Blob(chunks.current, { type: nextRecorder.mimeType || 'audio/webm' });
          setAudio(await recordedAudioToWav(source));
          setMessage('录音已准备好。点击“上传并评分”才会发送到 Azure。');
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          stopTracks();
          setBusy(false);
        }
      };
      nextRecorder.start();
      setResult(null);
      setAudio(null);
      setRecording(true);
      setPermissionBlocked(false);
      setMessage('正在录音…请朗读上方英文，完成后点停止。');
    } catch (error) {
      setPermissionBlocked(isMicrophonePermissionError(error));
      setMessage(microphoneErrorMessage(error));
    }
  };

  const stop = () => {
    recorder.current?.stop();
    setRecording(false);
  };

  const assess = async () => {
    if (!audio) return;
    try {
      setBusy(true);
      setMessage('正在提交 Azure Speech 发音评测…');
      const assessment = await assessPronunciation(audio, entry.term);
      setResult(assessment);
      setMessage('评分完成。分数用于练习参考，不代表语言能力认证。');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="pronunciation" aria-label="发音练习">
      <h3>跟读与发音评分</h3>
      <p class="muted">
        优先听自然美式示范，再跟读；离线时使用本机参考朗读。本地判断不会上传录音。
      </p>
      <div class="offline-voice-row">
        <span>
          {naturalSpeechConfigured
            ? '✓ 已连接 Azure 神经语音：句子按美式口语风格朗读'
            : '离线示范模式：核心发音包已内置，无需跳转 Android 安装页面'}
        </span>
      </div>
      {!naturalSpeechConfigured && (
        <p class="inline-warning">自然美式语音尚未连接；当前使用离线参考朗读。</p>
      )}
      <button
        class={`local-shadow-button ${localListening ? 'listening' : ''}`}
        onClick={toggleLocalPractice}
        disabled={busy}
      >
        {localListening ? '■ 正在听，点此停止' : '🎙 开始本地跟读判断'}
      </button>
      <p role="status" class="muted local-status">
        {localStatus}
      </p>
      {localResult && <LocalResult result={localResult} />}
      {permissionBlocked && (
        <div class="permission-help">
          <strong>开启后如何继续</strong>
          <span>修改系统或浏览器权限后回到这里，点击“重新请求麦克风”。</span>
          <button onClick={toggleLocalPractice} disabled={busy}>
            重新请求麦克风
          </button>
        </div>
      )}
      <details class="cloud-assessment">
        <summary>高级音素评分（需要 Azure）</summary>
        <p class="muted">录音仅在点击“上传并评分”后发送，服务端不保存音频。</p>
        <div class="actions">
          <button onClick={recording ? stop : start} disabled={busy}>
            {recording ? '停止录音' : '开始录音'}
          </button>
          <button
            class="primary"
            onClick={assess}
            disabled={!audio || busy || !speechApiConfigured}
          >
            上传并评分
          </button>
        </div>
        {!speechApiConfigured && (
          <p class="inline-warning">云端评分尚未配置；系统朗读与本地词库仍可正常使用。</p>
        )}
        <p role="status" class="muted">
          {busy ? '处理中…' : message}
        </p>
        {result && <AssessmentResult result={result} />}
      </details>
    </section>
  );
}

function LocalResult({ result }: { result: LocalPronunciationResult }) {
  return (
    <div class="local-pronunciation-result">
      <div class="local-score">
        <strong>{result.score}</strong>
        <span>本地跟读匹配分</span>
      </div>
      <p>{result.score >= 85 ? '读得很好，可以继续下一句。' : '再听一次示范，重点补读红色词。'}</p>
      <div class="local-word-feedback" aria-label="逐词匹配结果">
        {result.words.map((word) => (
          <span class={word.matched ? 'matched' : 'missed'}>{word.word}</span>
        ))}
      </div>
      <small>该分数依据本机识别文字与参考句匹配，不是音素或口音诊断。</small>
    </div>
  );
}

function AssessmentResult({ result }: { result: PronunciationAssessment }) {
  const metrics = [
    ['综合', result.pronunciation],
    ['准确度', result.accuracy],
    ['流利度', result.fluency],
    ['完整度', result.completeness],
    ...(typeof result.prosody === 'number' ? [['韵律', result.prosody] as const] : [])
  ];
  return (
    <div class="assessment-result">
      <div class="grid two">
        {metrics.map(([label, value]) => (
          <div class="metric">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {result.recognizedText && <p>识别结果：{result.recognizedText}</p>}
      {result.words.length > 0 && (
        <p class="word-feedback">
          {result.words.map((word) => (
            <span class={word.accuracy < 60 ? 'needs-practice' : ''}>
              {word.word} {word.accuracy}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
