import { app, HttpRequest, HttpResponseInit } from '@azure/functions';

const maxReferenceLength = 300;
const maxAudioBytes = 1_100_000;

type RequestBody = {
  audioBase64?: unknown;
  referenceText?: unknown;
  locale?: unknown;
};

type AzureWord = {
  Word?: string;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
};

type AzureResponse = {
  DisplayText?: string;
  NBest?: {
    Display?: string;
    PronunciationAssessment?: {
      AccuracyScore?: number;
      FluencyScore?: number;
      CompletenessScore?: number;
      PronScore?: number;
      ProsodyScore?: number;
    };
    Words?: AzureWord[];
  }[];
  RecognitionStatus?: string;
};

const responseHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  Vary: 'Origin',
  'Content-Type': 'application/json; charset=utf-8'
});

function originFor(request: HttpRequest) {
  const origin = request.headers.get('origin') ?? '';
  const allowlist = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return origin && allowlist.includes(origin) ? origin : null;
}

function json(status: number, body: object, origin?: string): HttpResponseInit {
  return {
    status,
    headers: origin
      ? responseHeaders(origin)
      : { 'Content-Type': 'application/json; charset=utf-8' },
    jsonBody: body
  };
}

function validPayload(value: RequestBody) {
  const referenceText = typeof value.referenceText === 'string' ? value.referenceText.trim() : '';
  const audioBase64 = typeof value.audioBase64 === 'string' ? value.audioBase64 : '';
  if (value.locale !== undefined && value.locale !== 'en-US')
    throw new Error('当前仅支持 en-US 发音评测。');
  const locale = 'en-US' as const;
  if (!referenceText || referenceText.length > maxReferenceLength)
    throw new Error('跟读文本无效或过长。');
  if (!audioBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64))
    throw new Error('录音数据无效。');
  const audio = Buffer.from(audioBase64, 'base64');
  if (!audio.length || audio.length > maxAudioBytes) throw new Error('录音超过 30 秒或文件过大。');
  return { audio, referenceText, locale };
}

function score(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

async function pronunciation(request: HttpRequest): Promise<HttpResponseInit> {
  const origin = originFor(request);
  if (!origin) return json(403, { error: '此来源未获语音服务授权。' });
  if (request.method === 'OPTIONS') return { status: 204, headers: responseHeaders(origin) };
  let payload: { audio: Buffer; referenceText: string; locale: 'en-US' };
  try {
    payload = validPayload((await request.json()) as RequestBody);
  } catch (error) {
    return json(400, { error: (error as Error).message }, origin);
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return json(503, { error: '语音服务尚未完成配置。' }, origin);

  const assessmentHeader = Buffer.from(
    JSON.stringify({
      ReferenceText: payload.referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Phoneme',
      Dimension: 'Comprehensive',
      EnableProsodyAssessment: 'True'
    })
  ).toString('base64');
  const endpoint = new URL(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
  );
  endpoint.searchParams.set('language', payload.locale);
  endpoint.searchParams.set('format', 'detailed');
  endpoint.searchParams.set('profanity', 'masked');

  try {
    const speechResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Pronunciation-Assessment': assessmentHeader,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json'
      },
      body: Uint8Array.from(payload.audio).buffer
    });
    const source = (await speechResponse.json().catch(() => ({}))) as AzureResponse;
    if (!speechResponse.ok || source.RecognitionStatus === 'InitialSilenceTimeout')
      return json(502, { error: '未能识别录音。请在安静环境中重新朗读。' }, origin);
    const best = source.NBest?.[0];
    const assessment = best?.PronunciationAssessment;
    if (!best || !assessment) return json(502, { error: '未获得发音评分，请重新录制。' }, origin);
    return json(
      200,
      {
        recognizedText: best.Display ?? source.DisplayText ?? '',
        accuracy: score(assessment.AccuracyScore),
        fluency: score(assessment.FluencyScore),
        completeness: score(assessment.CompletenessScore),
        pronunciation: score(assessment.PronScore),
        ...(typeof assessment.ProsodyScore === 'number'
          ? { prosody: score(assessment.ProsodyScore) }
          : {}),
        words: (best.Words ?? []).map((word) => ({
          word: word.Word ?? '',
          accuracy: score(word.PronunciationAssessment?.AccuracyScore),
          ...(word.PronunciationAssessment?.ErrorType
            ? { errorType: word.PronunciationAssessment.ErrorType }
            : {})
        }))
      },
      origin
    );
  } catch {
    return json(502, { error: '无法连接 Azure Speech，请稍后重试。' }, origin);
  }
}

app.http('pronunciation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pronunciation',
  handler: pronunciation
});
