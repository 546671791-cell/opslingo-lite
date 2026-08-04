import { App as CapacitorApp } from '@capacitor/app';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';
import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { PronunciationPractice } from './PronunciationPractice';
import {
  cefrLevels,
  countries,
  courseGroups,
  lifeCourses,
  studyMethods,
  type CefrLevel,
  type LifeCourse,
  type StudyMethod
} from './curriculum';
import { communicationLessons } from './lessons';
import {
  ensureMicrophonePermission,
  isMicrophonePermissionError,
  microphoneErrorMessage
} from './microphone';
import {
  ConversationEngine,
  effectiveSeconds,
  localDate,
  overallCompletion,
  scoreResponse,
  statusFor,
  streak
} from './engine';
import {
  applyCatalogPack,
  checkContentUpdates,
  clearAll,
  deleteVocabulary,
  exportData,
  getDraft,
  id,
  importData,
  loadLocalContent,
  loadVocabularyContent,
  refreshVocabularyContent,
  rollbackPack,
  saveDraft,
  saveSession,
  saveVocabulary,
  sessions,
  vocabulary
} from './storage';
import { speakEnglish, stopEnglish } from './pronunciation';
import type {
  CatalogPack,
  PracticeSession,
  Scenario,
  VocabularyEntry,
  VocabularyItem
} from './types';
import './styles.css';

type Page = 'home' | 'scenes' | 'talk' | 'progress' | 'words' | 'detail' | 'train' | 'settings';
const icon = (name: string) =>
  ({
    home: '⌂',
    scenes: '▦',
    talk: '◌',
    progress: '▥',
    words: '⌁',
    hotel: '⌂',
    flight: '✈',
    email: '✉',
    chat: '●',
    settings: '⚙'
  })[name] ?? '•';
const routeHistoryKey = 'opslingo-route-history';
const hashFor = (page: Page, value?: string) => (value ? `#/${page}/${value}` : `#/${page}`);
const currentRoutePath = () => location.hash || '#/home';
const savedRoutes = () => {
  try {
    const value = JSON.parse(sessionStorage.getItem(routeHistoryKey) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};
const storeRoutes = (paths: string[]) =>
  sessionStorage.setItem(routeHistoryKey, JSON.stringify(paths));
const go = (page: Page, value?: string) => {
  const next = hashFor(page, value);
  if (next === currentRoutePath()) return;
  storeRoutes([...savedRoutes(), next].slice(-20));
  history.pushState({ opslingo: true }, '', next);
  dispatchEvent(new Event('opslingo-route'));
};
const goBack = (fallback: Page) => {
  const paths = savedRoutes();
  if (paths.length > 1) {
    storeRoutes(paths.slice(0, -1));
    history.back();
    return;
  }
  go(fallback);
};
const backFallback = () => {
  const [page, value] = route();
  if (page === 'detail' || page === 'train') return 'scenes';
  if (page === 'words' && value) return 'words';
  return 'home';
};
const route = (): [Page, string?] => {
  const [, page = 'home', value] = location.hash.split('/');
  return [page as Page, value];
};
const labelStatus = {
  notStarted: '未开始',
  inProgress: '学习中',
  completed: '已完成',
  mastered: '已掌握'
};
const download = (name: string, value: unknown) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  );
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

function App() {
  const [location, setLocation] = useState(route());
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [allSessions, setAllSessions] = useState<PracticeSession[]>([]);
  const [words, setWords] = useState<VocabularyItem[]>([]);
  const [library, setLibrary] = useState<VocabularyEntry[]>([]);
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [availableUpdate, setAvailableUpdate] = useState<(() => void) | null>(null);
  const reload = async () => {
    setAllSessions(await sessions());
    setWords(await vocabulary());
  };
  const reloadVocabulary = async () => setLibrary(await loadVocabularyContent());
  useEffect(() => {
    if (!window.location.hash) history.replaceState({ opslingo: true }, '', '#/home');
    const initialPath = currentRoutePath();
    const paths = savedRoutes();
    if (paths.at(-1) !== initialPath) storeRoutes([...paths, initialPath].slice(-20));
    loadLocalContent()
      .then(setScenarios)
      .then(reload)
      .catch((e: Error) => setNotice(e.message));
    reloadVocabulary().catch((e: Error) => setNotice(e.message));
    refreshVocabularyContent()
      .then(({ entries }) => setLibrary(entries))
      .catch(() => undefined);
    const onRoute = () => {
      const path = currentRoutePath();
      const routePaths = savedRoutes();
      if (routePaths.at(-1) !== path) {
        const previous = routePaths.lastIndexOf(path);
        storeRoutes(
          previous >= 0 ? routePaths.slice(0, previous + 1) : [...routePaths, path].slice(-20)
        );
      }
      setLocation(route());
    };
    let edgeSwipe: { x: number; y: number } | null = null;
    const startEdgeSwipe = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (touch.clientX <= 28 || touch.clientX >= window.innerWidth - 28)
        edgeSwipe = { x: touch.clientX, y: touch.clientY };
    };
    const finishEdgeSwipe = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch || !edgeSwipe) return;
      const horizontal = touch.clientX - edgeSwipe.x;
      const vertical = touch.clientY - edgeSwipe.y;
      const isBackGesture =
        Math.abs(horizontal) > 72 &&
        Math.abs(horizontal) > Math.abs(vertical) * 1.4 &&
        ((edgeSwipe.x <= 28 && horizontal > 0) ||
          (edgeSwipe.x >= window.innerWidth - 28 && horizontal < 0));
      edgeSwipe = null;
      if (isBackGesture) goBack('home');
    };
    const online = () => setOffline(!navigator.onLine);
    addEventListener('hashchange', onRoute);
    addEventListener('popstate', onRoute);
    addEventListener('opslingo-route', onRoute);
    addEventListener('touchstart', startEdgeSwipe, { passive: true });
    addEventListener('touchend', finishEdgeSwipe, { passive: true });
    addEventListener('online', online);
    addEventListener('offline', online);
    let nativeBackHandle: { remove: () => Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', () => {
        const [activePage] = route();
        if (activePage !== 'home') goBack(backFallback());
      }).then((handle) => {
        nativeBackHandle = handle;
      });
    }
    const update = registerSW({
      onNeedRefresh() {
        setAvailableUpdate(() => update);
      }
    });
    return () => {
      removeEventListener('hashchange', onRoute);
      removeEventListener('popstate', onRoute);
      removeEventListener('opslingo-route', onRoute);
      removeEventListener('touchstart', startEdgeSwipe);
      removeEventListener('touchend', finishEdgeSwipe);
      removeEventListener('online', online);
      removeEventListener('offline', online);
      nativeBackHandle?.remove();
    };
  }, []);
  const [page, value] = location;
  const selected = scenarios.find((item) => item.id === value);
  const statuses = useMemo(
    () =>
      new Map(
        scenarios.map((s) => [s.id, statusFor(allSessions.filter((x) => x.scenarioId === s.id))])
      ),
    [scenarios, allSessions]
  );
  const shared = {
    scenarios,
    allSessions,
    words,
    library,
    statuses,
    reload,
    reloadVocabulary,
    notice: (message: string) => setNotice(message)
  };
  return (
    <main class="app-shell">
      {offline && (
        <div class="banner warn" role="status">
          离线模式：使用已保存的内容与学习记录。
        </div>
      )}
      {notice && (
        <div class="banner" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {availableUpdate && (
        <div class="banner update">
          发现应用更新。<button onClick={() => availableUpdate()}>保存后更新</button>
        </div>
      )}
      {page === 'home' && <Home {...shared} />}
      {page === 'scenes' && <Scenes {...shared} />}
      {page === 'detail' && selected && (
        <Detail
          scenario={selected}
          status={statuses.get(selected.id) ?? 'notStarted'}
          library={library}
          notify={setNotice}
        />
      )}
      {page === 'train' && selected && (
        <Training scenario={selected} onSaved={reload} notify={setNotice} />
      )}
      {page === 'talk' && <Talk {...shared} />}
      {page === 'progress' && <Progress {...shared} />}
      {page === 'words' && <Words {...shared} lessonId={value} />}
      {page === 'settings' && <Settings onReload={reload} notify={setNotice} />}
      {!['detail', 'train', 'settings'].includes(page) && !(page === 'words' && value) && (
        <Nav page={page} />
      )}
    </main>
  );
}
function Header({
  title,
  back = false,
  fallback = 'home'
}: {
  title: string;
  back?: boolean;
  fallback?: Page;
}) {
  return (
    <header>
      <button
        class="icon-button"
        aria-label={back ? '返回' : '设置'}
        onClick={() => (back ? goBack(fallback) : go('settings'))}
      >
        {back ? '‹' : icon('settings')}
      </button>
      <h1>{title}</h1>
      <span />
    </header>
  );
}
function Nav({ page }: { page: Page }) {
  return (
    <nav aria-label="主导航">
      {(
        [
          ['home', '首页'],
          ['scenes', '场景'],
          ['talk', '对话'],
          ['progress', '进度'],
          ['words', '课程']
        ] as const
      ).map(([target, label]) => (
        <button class={page === target ? 'active' : ''} onClick={() => go(target)}>
          <span>{icon(target)}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
function Home({ scenarios, allSessions, statuses, library, notice, reloadVocabulary }: any) {
  const completed = overallCompletion([...statuses.values()]);
  const hotel = scenarios.filter((s: Scenario) => s.category === 'hotel');
  const flight = scenarios.filter((s: Scenario) => s.category === 'flight');
  const percent = (list: Scenario[]) => overallCompletion(list.map((s) => statuses.get(s.id)));
  const fresh = scenarios.find((s: Scenario) => statuses.get(s.id) !== 'mastered') ?? scenarios[0];
  return (
    <section>
      <Header title="OpsLingo Lite" />
      <div class="hero">
        <p>今日学习目标 · 15 分钟</p>
        <strong>{completed}%</strong>
        <span>整体完成度</span>
        <button onClick={() => fresh && go('detail', fresh.id)}>继续训练</button>
      </div>
      <div class="grid two">
        <Metric label="酒店完成度" value={`${percent(hotel)}%`} />
        <Metric label="航班完成度" value={`${percent(flight)}%`} />
        <Metric label="连续学习" value={`${streak(allSessions)} 天`} />
        <Metric
          label="待复习弱项"
          value={`${Math.max(0, scenarios.length - [...statuses.values()].filter((s) => s === 'mastered').length)} 个`}
        />
      </div>
      <h2>快速开始</h2>
      <div class="quick">
        {[
          ['email', '邮件回复训练'],
          ['chat', '聊天回复训练'],
          ['talk', '场景对话'],
          ['words', '实用沟通']
        ].map(([target, text]) => (
          <button
            onClick={() =>
              target === 'talk' ? go('talk') : target === 'words' ? go('words') : go('scenes')
            }
          >
            <span>{icon(target)}</span>
            {text}
          </button>
        ))}
      </div>
      <h2>内容包</h2>
      <div class="card line">
        <span>当前版本 1.0.0 · 48 个场景</span>
        <button
          onClick={async () => {
            try {
              const updates = await checkContentUpdates();
              notice(
                updates.length
                  ? `发现 ${updates.length} 个内容包更新，请在设置中安装。`
                  : '场景内容已是最新。'
              );
            } catch (e) {
              notice((e as Error).message);
            }
          }}
        >
          检查场景更新
        </button>
      </div>
      <div class="card line">
        <span>日常词汇包 · {library.length} 词句</span>
        <button
          onClick={async () => {
            try {
              const refreshed = await refreshVocabularyContent();
              await reloadVocabulary();
              notice(
                refreshed.updatedEntries
                  ? `已更新 ${refreshed.updatedEntries} 条词汇，学习记录已保留。`
                  : '词汇已是最新。'
              );
            } catch (e) {
              notice((e as Error).message);
            }
          }}
        >
          刷新词汇
        </button>
      </div>
      <InstallTip />
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div class="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function InstallTip() {
  const standalone =
    matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  return standalone ? null : (
    <div class="tip">在 iPhone Safari 点击“分享” → “添加到主屏幕”，即可离线使用。</div>
  );
}
function Scenes({ scenarios, statuses }: any) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [channel, setChannel] = useState('all');
  const [level, setLevel] = useState('all');
  const [state, setState] = useState('all');
  const filtered = scenarios.filter(
    (s: Scenario) =>
      (category === 'all' || s.category === category) &&
      (channel === 'all' || s.channel === channel) &&
      (level === 'all' || s.difficulty === level) &&
      (state === 'all' || statuses.get(s.id) === state) &&
      `${s.titleZh} ${s.titleEn}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <section>
      <Header title="场景" />
      <input
        aria-label="搜索场景"
        placeholder="搜索主题或英文标题"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      <div class="filters">
        <select
          aria-label="业务"
          value={category}
          onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
        >
          <option value="all">全部业务</option>
          <option value="hotel">酒店</option>
          <option value="flight">航班</option>
        </select>
        <select
          aria-label="沟通方式"
          value={channel}
          onChange={(e) => setChannel((e.target as HTMLSelectElement).value)}
        >
          <option value="all">全部方式</option>
          <option value="email">邮件</option>
          <option value="chat">聊天</option>
        </select>
        <select
          aria-label="难度"
          value={level}
          onChange={(e) => setLevel((e.target as HTMLSelectElement).value)}
        >
          <option value="all">全部难度</option>
          <option value="beginner">初级</option>
          <option value="intermediate">中级</option>
          <option value="advanced">高级</option>
        </select>
        <select
          aria-label="学习状态"
          value={state}
          onChange={(e) => setState((e.target as HTMLSelectElement).value)}
        >
          <option value="all">全部状态</option>
          <option value="notStarted">未开始</option>
          <option value="inProgress">学习中</option>
          <option value="completed">已完成</option>
          <option value="mastered">已掌握</option>
        </select>
      </div>
      <p class="muted">{filtered.length} 个场景</p>
      <div class="cards">
        {filtered.map((s: Scenario) => (
          <ScenarioCard scenario={s} status={statuses.get(s.id)} />
        ))}
      </div>
    </section>
  );
}
function ScenarioCard({ scenario, status }: { scenario: Scenario; status: any }) {
  return (
    <button class="card scenario-card" onClick={() => go('detail', scenario.id)}>
      <div>
        <span class="symbol">{icon(scenario.category)}</span>
        <span class="tag">
          {scenario.category === 'hotel' ? '酒店' : '航班'} ·{' '}
          {scenario.channel === 'email' ? '邮件' : '聊天'}
        </span>
        <span class="status">{labelStatus[status as keyof typeof labelStatus]}</span>
      </div>
      <strong>{scenario.titleZh}</strong>
      <small>{scenario.titleEn}</small>
      <footer>
        {scenario.difficulty === 'beginner'
          ? '初级'
          : scenario.difficulty === 'intermediate'
            ? '中级'
            : '高级'}{' '}
        · 约 {scenario.duration} 分钟
      </footer>
    </button>
  );
}
function Detail({
  scenario,
  status,
  library,
  notify
}: {
  scenario: Scenario;
  status: any;
  library: VocabularyEntry[];
  notify: (message: string) => void;
}) {
  const [translation, setTranslation] = useState(false);
  const [selectedWord, setSelectedWord] = useState<VocabularyEntry | null>(null);
  return (
    <section>
      <Header title="场景详情" back fallback="scenes" />
      <article class="card detail">
        <div class="tag">
          {icon(scenario.category)} {scenario.category === 'hotel' ? '酒店' : '航班'} ·{' '}
          {scenario.channel === 'email' ? '邮件' : '聊天'} ·{' '}
          {labelStatus[status as keyof typeof labelStatus]}
        </div>
        <h2>{scenario.titleZh}</h2>
        <p class="muted">{scenario.titleEn}</p>
        <h3>背景</h3>
        <p>{scenario.context}</p>
        <dl>
          <dt>你的身份</dt>
          <dd>{scenario.userRole}</dd>
          <dt>沟通对象</dt>
          <dd>{scenario.partnerRole}</dd>
          <dt>沟通目标</dt>
          <dd>{scenario.requiredObjectives.map((x) => x.label).join('、')}</dd>
        </dl>
        <blockquote>{scenario.partnerMessage}</blockquote>
        <button class="text-button" onClick={() => setTranslation(!translation)}>
          {translation ? scenario.translation : '查看中文释义'}
        </button>
        <h3>必须确认</h3>
        <ul>
          {scenario.requiredObjectives.map((o) => (
            <li>{o.label}</li>
          ))}
        </ul>
        <h3>核心词汇</h3>
        <div class="scenario-vocabulary">
          {scenario.vocabulary.map((v) => {
            const entry = library.find(
              (item) => item.term.toLocaleLowerCase() === v.term.toLocaleLowerCase()
            );
            return (
              <article class="scenario-word">
                <button class="scenario-word-main" onClick={() => entry && setSelectedWord(entry)}>
                  <strong>{v.term}</strong>
                  <span>{v.meaning}</span>
                  <small>{entry?.phonetic ?? '点击扬声器听发音'}</small>
                </button>
                <SpeakButton text={v.term} label={v.term} compact notify={notify} />
              </article>
            );
          })}
        </div>
        <div class="culture-tips scenario-tip">
          <strong>💡 沟通小贴士</strong>
          <p>{scenario.hints[0] ?? '先说明来意，再给出关键信息，最后确认下一步。'}</p>
          <small>点单词卡可查看音标、逐字母拼读、例句和发音练习。</small>
        </div>
        <button class="primary" onClick={() => go('train', scenario.id)}>
          开始训练
        </button>
      </article>
      {selectedWord && (
        <WordSheet
          entry={selectedWord}
          onClose={() => setSelectedWord(null)}
          onAdd={async () => {
            await saveVocabulary({
              id: `library-${selectedWord.id}`,
              text: selectedWord.term,
              meaning: selectedWord.meaning,
              tags: [selectedWord.category, selectedWord.level],
              favorite: true,
              mastered: false,
              nextReview: localDate(new Date()),
              createdAt: new Date().toISOString()
            });
            notify('已加入我的词句。');
          }}
          notice={notify}
        />
      )}
    </section>
  );
}

function VoiceReplyButton({
  onResult,
  notify
}: {
  onResult: (text: string) => void;
  notify: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const browserRecognition = useRef<BrowserSpeechRecognition | null>(null);
  useEffect(
    () => () => {
      SpeechRecognition.stop().catch(() => undefined);
      SpeechRecognition.removeAllListeners().catch(() => undefined);
      browserRecognition.current?.abort();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw new Error('此设备既没有语音识别服务，也不支持浏览器录音。');
    await ensureMicrophonePermission();
    const input = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.current = input;
    chunks.current = [];
    const nextRecorder = new MediaRecorder(input);
    recorder.current = nextRecorder;
    nextRecorder.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    nextRecorder.onstop = () => {
      const audio = new Blob(chunks.current, { type: nextRecorder.mimeType || 'audio/webm' });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(audio));
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setRecording(false);
      notify('录音已完成，可以回放检查。此设备缺少系统转写服务，录音不会自动变成文字。');
    };
    nextRecorder.start();
    setRecording(true);
    notify('系统语音转写不可用，已切换为录音练习。说完后请点“停止并回放”。');
  };
  const startBrowserRecognition = () => {
    const Recognition = browserSpeechRecognitionConstructor();
    if (!Recognition) return false;
    const recognition = new Recognition();
    browserRecognition.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) onResult(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      notify(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? microphoneErrorMessage(new Error('Permission denied'))
          : event.error === 'no-speech'
            ? '没有识别到清晰的英文，请靠近麦克风后重试。'
            : `语音识别暂时不可用（${event.error}），请重试。`
      );
    };
    recognition.onend = () => {
      setListening(false);
      browserRecognition.current = null;
    };
    recognition.start();
    setListening(true);
    notify('正在实时识别英文，说出的内容会自动写入输入框。');
    return true;
  };
  const startNativeRecognition = async () => {
    await ensureMicrophonePermission();
    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener('partialResults', ({ matches }) => {
      const transcript = matches[0]?.trim();
      if (transcript) onResult(transcript);
    });
    await SpeechRecognition.addListener('listeningState', ({ status }) => {
      if (status === 'stopped') setListening(false);
    });
    setListening(true);
    notify('正在实时识别英文，说出的内容会自动写入输入框。');
    await SpeechRecognition.start({
      language: 'en-US',
      maxResults: 3,
      prompt: '请用英语说出回复',
      partialResults: true,
      popup: false
    });
  };
  const toggle = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (listening) {
      if (Capacitor.isNativePlatform()) {
        await SpeechRecognition.stop();
        await SpeechRecognition.removeAllListeners();
      } else {
        browserRecognition.current?.stop();
      }
      setListening(false);
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) await startNativeRecognition();
      else if (!startBrowserRecognition()) await startRecording();
    } catch (error) {
      setListening(false);
      if (isMicrophonePermissionError(error)) {
        notify(microphoneErrorMessage(error));
        return;
      }
      try {
        await startRecording();
      } catch (fallbackError) {
        notify(microphoneErrorMessage(fallbackError));
      }
    }
  };
  return (
    <>
      <button
        class={`voice-input ${listening || recording ? 'listening' : ''}`}
        type="button"
        onClick={toggle}
      >
        {recording ? '■ 停止并回放' : listening ? '■ 正在实时转写，点此停止' : '🎙 用英语说出回复'}
      </button>
      {audioUrl && (
        <div class="voice-playback">
          <span>本次录音</span>
          <audio controls src={audioUrl} />
          <small>录音只保存在当前页面，离开训练后自动清除。</small>
        </div>
      )}
    </>
  );
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
  abort: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
function browserSpeechRecognitionConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}
function Training({
  scenario,
  onSaved,
  notify
}: {
  scenario: Scenario;
  onSaved: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [subject, setSubject] = useState(scenario.reference.subject ?? '');
  const [response, setResponse] = useState('');
  const [hint, setHint] = useState(false);
  const [reference, setReference] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof scoreResponse> | null>(null);
  const [started] = useState(new Date().toISOString());
  const [messages, setMessages] = useState<{ role: string; text: string; meaning?: string }[]>([
    { role: 'partner', text: scenario.partnerMessage, meaning: scenario.translation }
  ]);
  useEffect(() => {
    getDraft(scenario.id).then((draft) => {
      if (draft) {
        setSubject(draft.subject);
        setResponse(draft.body);
      }
    });
  }, [scenario.id]);
  const save = async (score: ReturnType<typeof scoreResponse>) => {
    const end = new Date().toISOString();
    await saveSession({
      id: id(),
      scenarioId: scenario.id,
      packVersion: scenario.version,
      channel: scenario.channel,
      startedAt: started,
      completedAt: end,
      activeSeconds: effectiveSeconds(started, end, 120),
      score,
      usedHint: hint || reference,
      response,
      dateKey: localDate(end)
    });
    await onSaved();
  };
  const submit = async () => {
    const score = scoreResponse(scenario, `${subject}\n${response}`);
    setResult(score);
    await save(score);
  };
  const sendChat = async () => {
    if (!response.trim()) return;
    const engine = new ConversationEngine(scenario);
    const next = engine.reply(response);
    setMessages([
      ...messages,
      { role: 'user', text: response },
      {
        role: 'partner',
        text: next.nextPartnerMessage,
        meaning: next.nextPartnerMeaning
      }
    ]);
    setResponse('');
    if (!next.needsClarification) await submit();
  };
  return (
    <section class="training">
      <Header
        title={scenario.channel === 'email' ? '邮件训练' : '聊天训练'}
        back
        fallback="scenes"
      />
      <div class="task">
        <strong>{scenario.titleZh}</strong>
        <div class="dialogue-line">
          <span>{scenario.partnerMessage}</span>
          <SpeakButton text={scenario.partnerMessage} label="对方消息" compact notify={notify} />
        </div>
        <small>{scenario.translation}</small>
      </div>
      {scenario.channel === 'email' ? (
        <>
          <label>
            邮件主题
            <input
              value={subject}
              onInput={(e) => setSubject((e.target as HTMLInputElement).value)}
              placeholder="简明主题"
            />
          </label>
          <label>
            邮件正文
            <textarea
              value={response}
              onInput={(e) => setResponse((e.target as HTMLTextAreaElement).value)}
              placeholder="用英文自由回复，不会上传。"
              rows={10}
            />
          </label>
        </>
      ) : (
        <>
          <div class="chatbox">
            {messages.map((m) => (
              <article class={`bubble ${m.role}`}>
                <div class="dialogue-line">
                  <span>{m.text}</span>
                  <SpeakButton text={m.text} label={m.text} compact notify={notify} />
                </div>
                {m.meaning && <small>{m.meaning}</small>}
              </article>
            ))}
          </div>
          <textarea
            value={response}
            onInput={(e) => setResponse((e.target as HTMLTextAreaElement).value)}
            placeholder="输入英文回复…"
            rows={3}
          />
          <VoiceReplyButton onResult={setResponse} notify={notify} />
        </>
      )}
      {hint && <div class="tip">{scenario.hints[0]}</div>}
      {reference && <pre class="reference">{scenario.reference.body}</pre>}
      <div class="actions">
        <button onClick={() => setHint(true)}>查看提示</button>
        <button onClick={() => setReference(true)}>参考结构</button>
        <button
          onClick={() =>
            saveDraft({
              id: scenario.id,
              scenarioId: scenario.id,
              subject,
              body: response,
              updatedAt: new Date().toISOString()
            })
          }
        >
          保存草稿
        </button>
        <button class="primary" onClick={scenario.channel === 'email' ? submit : sendChat}>
          {scenario.channel === 'email' ? '提交本地规则评分' : '发送回复'}
        </button>
      </div>
      {result && <Result result={result} scenario={scenario} />}
    </section>
  );
}
function Result({
  result,
  scenario
}: {
  result: ReturnType<typeof scoreResponse>;
  scenario: Scenario;
}) {
  return (
    <article class="card result">
      <h2>本地规则评分：{result.total} 分</h2>
      <div class="grid two">
        <Metric label="业务目标" value={`${result.objectiveRate}%`} />
        <Metric label="信息完整" value={`${result.completeness}%`} />
        <Metric label="清晰度" value={`${result.clarity}%`} />
        <Metric label="礼貌程度" value={`${result.politeness}%`} />
      </div>
      {result.missingObjectives.length > 0 && <p>待补充：{result.missingObjectives.join('、')}</p>}
      <h3>自然版本</h3>
      <p>{scenario.reference.body}</p>
      <h3>改进建议</h3>
      <ul>
        {result.corrections.map((c) => (
          <li>
            {c.explanation} 建议：{c.suggestion}
          </li>
        ))}
      </ul>
    </article>
  );
}
function Talk({ scenarios, reload, notice }: any) {
  const chatScenarios = scenarios.filter((s: Scenario) => s.channel === 'chat');
  const [scenarioId, setScenarioId] = useState(chatScenarios[0]?.id ?? '');
  const [mode, setMode] = useState<'guided' | 'free' | 'challenge'>('guided');
  const [input, setInput] = useState('');
  const [log, setLog] = useState<{ role: 'partner' | 'user'; text: string; meaning?: string }[]>(
    []
  );
  const scenario = chatScenarios.find((s: Scenario) => s.id === scenarioId);
  useEffect(() => {
    if (!scenarioId && chatScenarios[0]) setScenarioId(chatScenarios[0].id);
  }, [scenarioId, chatScenarios]);
  useEffect(() => {
    if (scenario)
      setLog([{ role: 'partner', text: scenario.partnerMessage, meaning: scenario.translation }]);
  }, [scenarioId]);
  if (!scenario)
    return (
      <section>
        <Header title="场景对话" />
        <p>正在加载场景…</p>
      </section>
    );
  const send = async (text = input, meaning?: string) => {
    if (!text.trim()) return;
    const engine = new ConversationEngine(scenario);
    const verdict = engine.reply(text);
    const next = [
      ...log,
      { role: 'user' as const, text, meaning },
      {
        role: 'partner' as const,
        text: verdict.nextPartnerMessage,
        meaning: verdict.nextPartnerMeaning
      }
    ];
    setLog(next);
    setInput('');
    if (!verdict.needsClarification) {
      const end = new Date().toISOString();
      const score = scoreResponse(
        scenario,
        next
          .filter((x) => x.role === 'user')
          .map((x) => x.text)
          .join(' ')
      );
      await saveSession({
        id: id(),
        scenarioId: scenario.id,
        packVersion: scenario.version,
        channel: 'chat',
        startedAt: end,
        completedAt: end,
        activeSeconds: 30,
        score,
        usedHint: mode === 'guided',
        response: text,
        dateKey: localDate(end)
      });
      await reload();
      notice('已记录本轮对话练习。');
    }
  };
  return (
    <section class="training">
      <Header title="场景对话" />
      <label>
        选择场景
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId((e.target as HTMLSelectElement).value)}
        >
          {chatScenarios.map((s: Scenario) => (
            <option value={s.id}>{s.titleZh}</option>
          ))}
        </select>
      </label>
      <div class="segmented">
        {(
          [
            ['guided', '引导'],
            ['free', '自由'],
            ['challenge', '挑战']
          ] as const
        ).map(([value, label]) => (
          <button class={mode === value ? 'selected' : ''} onClick={() => setMode(value)}>
            {label}
          </button>
        ))}
      </div>
      <p class="muted">
        {mode === 'guided'
          ? '显示中文与候选表达。'
          : mode === 'free'
            ? '自由输入，规则会识别意图和实体。'
            : '挑战模式不显示中文提示。'}
      </p>
      <div class="chatbox tall">
        {log.map((m) => (
          <article class={`bubble ${m.role}`}>
            <div class="dialogue-line">
              <span>{m.text}</span>
              <SpeakButton text={m.text} label={m.text} compact notify={notice} />
            </div>
            {m.meaning && mode !== 'challenge' && <small>{m.meaning}</small>}
          </article>
        ))}
      </div>
      {mode === 'guided' && (
        <div class="choices">
          {scenario.phrases.map((p: { text: string; meaning: string }) => (
            <article class="choice-card">
              <button class="choice-main" onClick={() => send(p.text, p.meaning)}>
                <strong>{p.text}</strong>
                <small>{p.meaning}</small>
              </button>
              <SpeakButton text={p.text} label={p.text} compact notify={notice} />
            </article>
          ))}
        </div>
      )}
      <textarea
        value={input}
        onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
        placeholder="输入英文回复…"
        rows={3}
      />
      <VoiceReplyButton onResult={setInput} notify={notice} />
      <button class="primary wide" onClick={() => send()}>
        发送
      </button>
    </section>
  );
}
function Progress({ scenarios, allSessions, statuses }: any) {
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = localDate(d);
    return { key, count: allSessions.filter((s: PracticeSession) => s.dateKey === key).length };
  });
  const average = allSessions.length
    ? Math.round(
        allSessions.reduce((sum: number, s: PracticeSession) => sum + s.score.total, 0) /
          allSessions.length
      )
    : 0;
  const weak = scenarios
    .map((s: Scenario) => ({
      s,
      status: statuses.get(s.id),
      score:
        allSessions.filter((x: PracticeSession) => x.scenarioId === s.id).at(-1)?.score.total ?? 0
    }))
    .sort((a: any, b: any) => a.score - b.score)
    .slice(0, 5);
  return (
    <section>
      <Header title="学习进度" />
      <div class="hero compact">
        <strong>{overallCompletion([...statuses.values()])}%</strong>
        <span>整体完成度 · 本地规则统计</span>
      </div>
      <div class="grid two">
        <Metric
          label="已开始"
          value={`${[...statuses.values()].filter((x) => x !== 'notStarted').length} 个`}
        />
        <Metric
          label="已完成"
          value={`${[...statuses.values()].filter((x) => x === 'completed' || x === 'mastered').length} 个`}
        />
        <Metric
          label="已掌握"
          value={`${[...statuses.values()].filter((x) => x === 'mastered').length} 个`}
        />
        <Metric label="平均得分" value={`${average} 分`} />
        <Metric label="连续学习" value={`${streak(allSessions)} 天`} />
        <Metric
          label="有效学习"
          value={`${Math.round(allSessions.reduce((sum: number, x: PracticeSession) => sum + x.activeSeconds, 0) / 60)} 分钟`}
        />
      </div>
      <h2>最近 7 天</h2>
      <div class="chart" aria-label="最近七天练习次数">
        {days.map((day) => (
          <div>
            <span style={{ height: `${Math.max(6, day.count * 18)}px` }} />
            <small>{day.key.slice(5)}</small>
          </div>
        ))}
      </div>
      <h2>最薄弱场景</h2>
      <div class="cards">
        {weak.map(({ s, score }: any) => (
          <button class="card line" onClick={() => go('detail', s.id)}>
            <span>{s.titleZh}</span>
            <strong>{score ? `${score} 分` : '未练习'}</strong>
          </button>
        ))}
      </div>
      <p class="muted">掌握规则：不同本地日期完成两次，最近一次 ≥85 分、目标 100%、完整率 ≥90%。</p>
    </section>
  );
}
function SpeakButton({
  text,
  label,
  display,
  compact = false,
  rate = 0.82,
  notify
}: {
  text: string;
  label: string;
  display?: string;
  compact?: boolean;
  rate?: number;
  notify: (value: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const play = () => {
    if (playing) {
      stopEnglish()
        .catch((error: Error) => notify(error.message))
        .finally(() => setPlaying(false));
      return;
    }
    setPlaying(true);
    speakEnglish(text, rate)
      .catch((error: Error) => notify(error.message))
      .finally(() => setPlaying(false));
  };
  return (
    <button
      class={compact ? 'speak-button compact' : 'speak-button'}
      aria-label={`朗读 ${label}`}
      aria-live="polite"
      onClick={play}
    >
      {playing ? (compact ? '■' : '■ 停止') : compact ? '🔊' : (display ?? '🔊 朗读')}
    </button>
  );
}

function LevelSwitcher({
  value,
  onChange
}: {
  value: CefrLevel;
  onChange: (value: CefrLevel) => void;
}) {
  return (
    <div class="level-switcher" aria-label="英语等级">
      {cefrLevels.map((level) => (
        <button
          class={`${level.color} ${value === level.id ? 'active' : ''}`}
          aria-pressed={value === level.id}
          onClick={() => onChange(level.id)}
        >
          <strong>{level.id}</strong>
          <span>{level.title}</span>
          <small>{level.subtitle}</small>
        </button>
      ))}
    </div>
  );
}

function MethodSwitcher({
  value,
  onChange
}: {
  value: StudyMethod;
  onChange: (value: StudyMethod) => void;
}) {
  return (
    <div class="method-switcher" aria-label="练习方法">
      {studyMethods.map((method) => (
        <button
          class={value === method.id ? 'active' : ''}
          aria-pressed={value === method.id}
          onClick={() => onChange(method.id)}
        >
          <strong>{method.label}</strong>
          <small>{method.description}</small>
        </button>
      ))}
    </div>
  );
}

const courseWordEntry = (
  course: LifeCourse,
  word: LifeCourse['keywords'][number]
): VocabularyEntry => ({
  id: `${course.id}-${word.term.replace(/\s+/g, '-')}`,
  term: word.term,
  phonetic: word.phonetic,
  meaning: word.meaning,
  category: course.group,
  level: '进阶',
  example: course.steps[2].phrase,
  exampleMeaning: course.steps[2].meaning,
  tips: [course.steps[2].note, ...course.cultureTips.slice(0, 1)]
});

function CourseDetail({
  course,
  level,
  method,
  onLevel,
  onMethod,
  onAdd,
  notice
}: {
  course: LifeCourse;
  level: CefrLevel;
  method: StudyMethod;
  onLevel: (value: CefrLevel) => void;
  onMethod: (value: StudyMethod) => void;
  onAdd: (entry: VocabularyEntry) => Promise<void>;
  notice: (message: string) => void;
}) {
  const levelIndex = cefrLevels.findIndex((item) => item.id === level);
  const step = course.steps[levelIndex];
  const expressions = course.steps.slice(Math.max(0, levelIndex - 2), levelIndex + 1);
  const [selectedWord, setSelectedWord] = useState<VocabularyEntry | null>(null);
  const [passes, setPasses] = useState<boolean[]>([false, false, false, false, false]);
  const practiceEntry: VocabularyEntry = {
    id: `${course.id}-${level}`,
    term: step.phrase,
    phonetic: `${level} · ${step.goal}`,
    meaning: step.meaning,
    category: course.group,
    level: levelIndex < 2 ? '基础' : levelIndex < 4 ? '进阶' : '商务',
    example: step.phrase,
    exampleMeaning: step.meaning,
    tips: [step.note, `本级任务：${step.challenge}`]
  };
  return (
    <section class="course-page">
      <Header title={course.title} back fallback="words" />
      <div class="course-cover">
        <img src={`${import.meta.env.BASE_URL}${course.image}`} alt={course.title} />
        <div>
          <span>{course.group}</span>
          <h2>{course.title}</h2>
          <p>{course.titleEn}</p>
          <small>
            {course.minutes} 分钟 · 当前 {level}
          </small>
        </div>
      </div>
      <h2>自由切换难度</h2>
      <LevelSwitcher value={level} onChange={onLevel} />
      <h2>选择练习方法</h2>
      <MethodSwitcher value={method} onChange={onMethod} />
      <div class="level-objective">
        <span>{level} 本课目标</span>
        <strong>{step.goal}</strong>
        <p>{step.challenge}</p>
      </div>
      {method === 'scene' && (
        <div class="course-method-panel">
          <h2>阶梯表达</h2>
          <p class="muted">显示当前级别和前两级表达，帮助你看见语言如何逐步变得自然。</p>
          <div class="expression-list">
            {expressions.map((item) => (
              <article class={`ladder-expression ${item.level === level ? 'current' : ''}`}>
                <span>{item.level}</span>
                <div>
                  <strong>{item.phrase}</strong>
                  <small>{item.meaning}</small>
                  <p>{item.note}</p>
                </div>
                <SpeakButton text={item.phrase} label={item.phrase} compact notify={notice} />
              </article>
            ))}
          </div>
        </div>
      )}
      {method === 'listen' && (
        <div class="course-method-panel listening-lab">
          <h2>五遍精听循环</h2>
          {[
            '盲听：不看文字抓关键词',
            '对照：看中英确认意思',
            '慢听：听清弱读和连读',
            '跟读：延迟半拍模仿',
            '复述：脱离文字说出来'
          ].map((label, index) => (
            <button
              class={passes[index] ? 'done' : ''}
              onClick={() =>
                setPasses(passes.map((value, position) => (position === index ? !value : value)))
              }
            >
              <span>{passes[index] ? '✓' : index + 1}</span>
              {label}
            </button>
          ))}
          <div class="listen-controls">
            <SpeakButton
              text={step.phrase}
              label="慢速示范"
              display="🐢 慢速 0.68×"
              rate={0.68}
              notify={notice}
            />
            <SpeakButton
              text={step.phrase}
              label="自然语速示范"
              display="🔊 自然 0.95×"
              rate={0.95}
              notify={notice}
            />
          </div>
          <blockquote>
            {step.phrase}
            <small>{step.meaning}</small>
          </blockquote>
        </div>
      )}
      {method === 'shadow' && (
        <div class="course-method-panel shadow-lab">
          <h2>影子跟读</h2>
          <p class="muted">先听自然语速，延迟半拍跟读；不要逐字停顿。</p>
          <div class="shadow-script">
            <strong>{step.phrase}</strong>
            <small>{step.meaning}</small>
            <SpeakButton
              text={step.phrase}
              label="影子跟读示范"
              display="🔊 播放示范"
              rate={0.9}
              notify={notice}
            />
          </div>
          <PronunciationPractice entry={practiceEntry} />
        </div>
      )}
      {method === 'dialogue' && (
        <div class="course-method-panel">
          <h2>任务对话</h2>
          <div class="chatbox course-dialogue">
            <article class="bubble partner">
              <div class="dialogue-line">
                <span>Hi there. How can I help you today?</span>
                <SpeakButton
                  text="Hi there. How can I help you today?"
                  label="对方开场"
                  compact
                  notify={notice}
                />
              </div>
              <small>你好，今天需要什么帮助？</small>
            </article>
            <article class="bubble user">
              <div class="dialogue-line">
                <span>{step.phrase}</span>
                <SpeakButton text={step.phrase} label="本级回答" compact notify={notice} />
              </div>
              <small>{step.meaning}</small>
            </article>
          </div>
          <div class="culture-tips">
            <strong>任务完成标准</strong>
            <p>{step.challenge}</p>
          </div>
        </div>
      )}
      <h2>核心词汇</h2>
      <div class="course-keywords">
        {course.keywords.map((word) => (
          <article>
            <button onClick={() => setSelectedWord(courseWordEntry(course, word))}>
              <strong>{word.term}</strong>
              <span>{word.meaning}</span>
              <small>{word.phonetic}</small>
            </button>
            <SpeakButton text={word.term} label={word.term} compact notify={notice} />
          </article>
        ))}
      </div>
      <h2>💡 美国生活小贴士</h2>
      <div class="culture-tips">
        <ul>
          {course.cultureTips.map((tip) => (
            <li>{tip}</li>
          ))}
        </ul>
      </div>
      {selectedWord && (
        <WordSheet
          entry={selectedWord}
          onClose={() => setSelectedWord(null)}
          onAdd={() => onAdd(selectedWord)}
          notice={notice}
        />
      )}
    </section>
  );
}
function Words({ words, library, reload, reloadVocabulary, notice, lessonId }: any) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [meaning, setMeaning] = useState('');
  const [selected, setSelected] = useState<VocabularyEntry | null>(null);
  const [level, setLevelState] = useState<CefrLevel>(
    () => (localStorage.getItem('opslite-cefr-level') as CefrLevel | null) ?? 'A2'
  );
  const [method, setMethodState] = useState<StudyMethod>(
    () => (localStorage.getItem('opslite-study-method') as StudyMethod | null) ?? 'scene'
  );
  const [country, setCountry] = useState('us');
  const lesson = communicationLessons.find((item) => item.id === lessonId);
  const course = lifeCourses.find((item) => item.id === lessonId);
  const setLevel = (value: CefrLevel) => {
    localStorage.setItem('opslite-cefr-level', value);
    setLevelState(value);
  };
  const setMethod = (value: StudyMethod) => {
    localStorage.setItem('opslite-study-method', value);
    setMethodState(value);
  };
  const filtered = words.filter((w: VocabularyItem) =>
    `${w.text} ${w.meaning} ${w.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
  );
  const libraryFiltered = library.filter((entry: VocabularyEntry) =>
    `${entry.term} ${entry.meaning} ${entry.category}`.toLowerCase().includes(query.toLowerCase())
  );
  const create = async () => {
    if (!text.trim() || !meaning.trim()) return;
    await saveVocabulary({
      id: id(),
      text,
      meaning,
      tags: ['自定义'],
      favorite: false,
      mastered: false,
      nextReview: localDate(new Date()),
      createdAt: new Date().toISOString()
    });
    setText('');
    setMeaning('');
    setEditing(false);
    await reload();
  };
  const addEntry = async (entry: VocabularyEntry) => {
    await saveVocabulary({
      id: `library-${entry.id}`,
      text: entry.term,
      meaning: entry.meaning,
      tags: [entry.category, entry.level],
      favorite: true,
      mastered: false,
      nextReview: localDate(new Date()),
      createdAt: new Date().toISOString()
    });
    await reload();
    notice('已加入我的词句。');
  };
  const addPhrase = async (
    phrase: { id: string; text: string; meaning: string },
    category: string
  ) => {
    await saveVocabulary({
      id: `phrase-${phrase.id}`,
      text: phrase.text,
      meaning: phrase.meaning,
      tags: [category, '常用句型'],
      favorite: true,
      mastered: false,
      nextReview: localDate(new Date()),
      createdAt: new Date().toISOString()
    });
    await reload();
    notice('已加入我的词句。');
  };
  if (course)
    return (
      <CourseDetail
        course={course}
        level={level}
        method={method}
        onLevel={setLevel}
        onMethod={setMethod}
        onAdd={addEntry}
        notice={notice}
      />
    );
  if (lesson) {
    const entries = library.filter((entry: VocabularyEntry) =>
      lesson.categories.includes(entry.category)
    );
    return (
      <LessonDetail
        lesson={lesson}
        entries={entries}
        onOpenWord={setSelected}
        onAddEntry={addEntry}
        onAddPhrase={addPhrase}
        onAddAll={async () => {
          await Promise.all([
            ...entries.map((entry: VocabularyEntry) =>
              saveVocabulary({
                id: `library-${entry.id}`,
                text: entry.term,
                meaning: entry.meaning,
                tags: [entry.category, entry.level],
                favorite: true,
                mastered: false,
                nextReview: localDate(new Date()),
                createdAt: new Date().toISOString()
              })
            ),
            ...lesson.phrases.map((phrase) =>
              saveVocabulary({
                id: `phrase-${phrase.id}`,
                text: phrase.text,
                meaning: phrase.meaning,
                tags: [lesson.title, '常用句型'],
                favorite: true,
                mastered: false,
                nextReview: localDate(new Date()),
                createdAt: new Date().toISOString()
              })
            )
          ]);
          await reload();
          notice('本主题词汇和常用句型已加入我的词句。');
        }}
        onRefresh={async () => {
          const refreshed = await refreshVocabularyContent();
          await reloadVocabulary();
          notice(
            refreshed.updatedEntries
              ? `已更新 ${refreshed.updatedEntries} 条词汇。`
              : '词汇已是最新。'
          );
        }}
        notice={notice}
      >
        {selected && (
          <WordSheet
            entry={selected}
            onClose={() => setSelected(null)}
            onAdd={() => addEntry(selected)}
            notice={notice}
          />
        )}
      </LessonDetail>
    );
  }
  return (
    <section>
      <Header title="英语进阶书" />
      <div class="academy-hero">
        <span>从真实生活出发</span>
        <h2>今天想把英语练到哪一级？</h2>
        <p>六级自由切换 · 四种练习法 · 中英双语 · 可离线学习</p>
      </div>
      <LevelSwitcher value={level} onChange={setLevel} />
      <MethodSwitcher value={method} onChange={setMethod} />
      <div class="country-strip" aria-label="国家与地区">
        {countries.map((item) => (
          <button
            class={country === item.id ? 'active' : ''}
            disabled={!item.available}
            onClick={() => setCountry(item.id)}
          >
            {item.label}
            {!item.available && <small>即将更新</small>}
          </button>
        ))}
      </div>
      <div class="academy-heading line">
        <div>
          <h2>美国生活场景</h2>
          <p class="muted">按真实任务学习，不只背单词。</p>
        </div>
        <span class="level-badge">{level}</span>
      </div>
      {courseGroups.map((group) => (
        <div class="course-group">
          <h3>{group}</h3>
          <div class="course-row">
            {lifeCourses
              .filter((item) => item.group === group)
              .map((item) => (
                <button class="course-card" onClick={() => go('words', item.id)}>
                  <img src={`${import.meta.env.BASE_URL}${item.image}`} alt="" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.titleEn}</small>
                    <em>
                      {item.minutes} 分钟 · {level} ·{' '}
                      {studyMethods.find((x) => x.id === method)?.label}
                    </em>
                  </span>
                </button>
              ))}
          </div>
        </div>
      ))}
      <div class="line academy-tools">
        <h2>词汇与主题</h2>
        <button
          onClick={async () => {
            try {
              const refreshed = await refreshVocabularyContent();
              await reloadVocabulary();
              notice(
                refreshed.updatedEntries
                  ? `已更新 ${refreshed.updatedEntries} 条词汇。`
                  : '词汇已是最新。'
              );
            } catch (error) {
              notice((error as Error).message);
            }
          }}
        >
          ↻ 更新
        </button>
      </div>
      <input
        aria-label="搜索词句"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        placeholder="搜索单词、短语或标签"
      />
      <div class="actions">
        <button onClick={() => setEditing(!editing)}>+ 添加词句</button>
        <button
          onClick={async () => {
            try {
              const refreshed = await refreshVocabularyContent();
              await reloadVocabulary();
              notice(
                refreshed.updatedEntries
                  ? `已更新 ${refreshed.updatedEntries} 条词汇。`
                  : '词汇已是最新。'
              );
            } catch (e) {
              notice((e as Error).message);
            }
          }}
        >
          ↻ 刷新词汇
        </button>
      </div>
      {editing && (
        <div class="card">
          <input
            placeholder="英文词句"
            value={text}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
          <input
            placeholder="中文解释"
            value={meaning}
            onInput={(e) => setMeaning((e.target as HTMLInputElement).value)}
          />
          <button class="primary" onClick={create}>
            保存
          </button>
        </div>
      )}
      <h2>沟通主题</h2>
      <p class="muted">以日常交流、工作协作、社交互动为主；航旅业务保留在“场景”训练中。</p>
      <div class="lesson-grid">
        {communicationLessons.map((item) => {
          const count = library.filter((entry: VocabularyEntry) =>
            item.categories.includes(entry.category)
          ).length;
          return (
            <button class={`lesson-card ${item.accent}`} onClick={() => go('words', item.id)}>
              <span class="lesson-icon">{item.icon}</span>
              <strong>{item.title}</strong>
              <small>
                {item.titleEn} · {count} 词
              </small>
            </button>
          );
        })}
      </div>
      {query && (
        <>
          <h2>搜索结果</h2>
          <div class="cards">
            {libraryFiltered.map((entry: VocabularyEntry) => (
              <article class="card word library-word">
                <div>
                  <strong>{entry.term}</strong>
                  <small>
                    {entry.phonetic} · {entry.level}
                  </small>
                  <p>{entry.meaning}</p>
                </div>
                <div class="word-actions">
                  <SpeakButton text={entry.term} label={entry.term} compact notify={notice} />
                  <button aria-label={`查看 ${entry.term}`} onClick={() => setSelected(entry)}>
                    查看
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <h2>我的词句</h2>
      <div class="cards">
        {filtered.map((item: VocabularyItem) => (
          <article class="card word">
            <div>
              <strong>{item.text}</strong>
              <p>{item.meaning}</p>
              <small>
                {item.tags.join(' · ')} · 下次复习 {item.nextReview}
              </small>
            </div>
            <div class="word-actions">
              <button
                aria-label="复制"
                onClick={() => {
                  navigator.clipboard.writeText(item.text);
                  notice('已复制。');
                }}
              >
                复制
              </button>
              <button
                aria-label="收藏"
                onClick={async () => {
                  await saveVocabulary({ ...item, favorite: !item.favorite });
                  await reload();
                }}
              >
                {item.favorite ? '★' : '☆'}
              </button>
              <button
                aria-label="标记已掌握"
                onClick={async () => {
                  await saveVocabulary({
                    ...item,
                    mastered: !item.mastered,
                    nextReview: localDate(new Date(Date.now() + 14 * 86400000))
                  });
                  await reload();
                }}
              >
                认识
              </button>
              <button
                aria-label="删除"
                onClick={async () => {
                  if (confirm('删除此词句？')) {
                    await deleteVocabulary(item.id);
                    await reload();
                  }
                }}
              >
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
      {!libraryFiltered.length && !filtered.length && query && (
        <div class="empty">暂无词句。可在训练结果中将有用表达手动添加到这里。</div>
      )}
      {selected && (
        <WordSheet
          entry={selected}
          onClose={() => setSelected(null)}
          onAdd={() => addEntry(selected)}
          notice={notice}
        />
      )}
    </section>
  );
}
function LessonDetail({
  lesson,
  entries,
  onOpenWord,
  onAddEntry,
  onAddPhrase,
  onAddAll,
  onRefresh,
  notice,
  children
}: any) {
  return (
    <section class="lesson-page">
      <Header title={lesson.title} back fallback="words" />
      <div class={`lesson-hero ${lesson.accent}`}>
        <span class="lesson-icon">{lesson.icon}</span>
        <div>
          <h2>{lesson.title}</h2>
          <p>{lesson.titleEn}</p>
          <small>
            {entries.length} 个核心词汇 · {lesson.phrases.length} 个常用句型
          </small>
        </div>
      </div>
      <button class="refresh-lesson" onClick={onRefresh}>
        ↻ 检查更新并刷新本主题词汇
      </button>
      <h2>核心词汇</h2>
      <div class="expression-list">
        {entries.map((entry: VocabularyEntry) => (
          <article class="expression-card">
            <button class="expression-main" onClick={() => onOpenWord(entry)}>
              <strong>{entry.term}</strong>
              <span>{entry.meaning}</span>
              <small>{entry.phonetic}</small>
            </button>
            <div class="expression-actions">
              <SpeakButton text={entry.term} label={entry.term} compact notify={notice} />
              <button aria-label={`加入 ${entry.term} 到词句`} onClick={() => onAddEntry(entry)}>
                ＋
              </button>
            </div>
          </article>
        ))}
      </div>
      <h2>常用句型</h2>
      <div class="expression-list">
        {lesson.phrases.map((phrase: { id: string; text: string; meaning: string }) => (
          <article class="expression-card">
            <div class="expression-main">
              <strong>{phrase.text}</strong>
              <span>{phrase.meaning}</span>
            </div>
            <div class="expression-actions">
              <SpeakButton text={phrase.text} label={phrase.text} compact notify={notice} />
              <button
                aria-label={`加入 ${phrase.text} 到词句`}
                onClick={() => onAddPhrase(phrase, lesson.title)}
              >
                ＋
              </button>
            </div>
          </article>
        ))}
      </div>
      <h2>💡 文化小贴士</h2>
      <div class="culture-tips">
        <ul>
          {lesson.cultureTips.map((tip: string) => (
            <li>{tip}</li>
          ))}
        </ul>
      </div>
      <button class="primary wide lesson-add-all" onClick={onAddAll}>
        全部加入我的词句
      </button>
      {children}
    </section>
  );
}
function WordSheet({
  entry,
  onClose,
  onAdd,
  notice
}: {
  entry: VocabularyEntry;
  onClose: () => void;
  onAdd: () => Promise<void>;
  notice: (value: string) => void;
}) {
  const spell = entry.term
    .replace(/[^a-z]/gi, '')
    .toUpperCase()
    .split('')
    .join(' · ');
  return (
    <div class="sheet-backdrop" role="presentation" onClick={onClose}>
      <article
        class="word-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.term} 词汇详情`}
        onClick={(event) => event.stopPropagation()}
      >
        <div class="sheet-handle" />
        <div class="line">
          <h2>{entry.term}</h2>
          <button aria-label="关闭词汇详情" class="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div class="line phonetic">
          <span>{entry.phonetic}</span>
          <strong>{entry.meaning}</strong>
          <SpeakButton text={entry.term} label={entry.term} compact notify={notice} />
        </div>
        <p class="spelling">拼读：{spell}</p>
        <div class="example-card">
          <p>{entry.example}</p>
          <small>{entry.exampleMeaning}</small>
          <SpeakButton text={entry.example} label="例句" notify={notice} />
        </div>
        <h3>用法小贴士</h3>
        <ul>
          {entry.tips.map((tip) => (
            <li>{tip}</li>
          ))}
        </ul>
        <PronunciationPractice entry={entry} />
        <button class="primary wide" onClick={onAdd}>
          加入我的词句
        </button>
      </article>
    </div>
  );
}
function Settings({
  onReload,
  notify
}: {
  onReload: () => Promise<void>;
  notify: (x: string) => void;
}) {
  const [updates, setUpdates] = useState<CatalogPack[]>([]);
  const [busy, setBusy] = useState(false);
  const choose = (fn: (file: File) => Promise<void>) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) fn(file).catch((e: Error) => notify(e.message));
    };
    input.click();
  };
  const update = async () => {
    setBusy(true);
    try {
      setUpdates(await checkContentUpdates());
      notify('检查完成。');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <Header title="设置" back />
      <div class="cards">
        <article class="card">
          <h2>应用与内容</h2>
          <p>应用版本 1.0.0 · 内容目录版本 1</p>
          <button onClick={update} disabled={busy}>
            {busy ? '检查中…' : '检查场景更新'}
          </button>
          {updates.map((pack) => (
            <div class="line">
              <span>
                {pack.id} → {pack.version}
              </span>
              <button
                onClick={async () => {
                  try {
                    await applyCatalogPack(pack);
                    await onReload();
                    notify('内容包已更新，历史成绩已保留。');
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                安装
              </button>
              <button
                onClick={async () => {
                  try {
                    await rollbackPack(pack.id);
                    await onReload();
                    notify('已回滚到上一个可用版本。');
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                回滚
              </button>
            </div>
          ))}
        </article>
        <article class="card">
          <h2>数据备份</h2>
          <p>学习记录只保存在当前设备。导出前不会上传任何内容。</p>
          <div class="actions">
            <button
              onClick={async () =>
                download(`opslite-backup-${localDate(new Date())}.json`, await exportData())
              }
            >
              导出 JSON
            </button>
            <button
              onClick={() =>
                choose(async (file) => {
                  const data = JSON.parse(await file.text());
                  const mode = confirm('点击“确定”合并数据；点击“取消”替换现有学习数据。')
                    ? 'merge'
                    : 'replace';
                  const result = await importData(data, mode);
                  await onReload();
                  notify(
                    result.duplicate
                      ? '该备份已导入过，未重复计入。'
                      : `已导入 ${result.imported} 条练习记录。`
                  );
                })
              }
            >
              导入 JSON
            </button>
          </div>
        </article>
        <article class="card danger">
          <h2>清空本地数据</h2>
          <p>将删除本机学习记录、词句和草稿，内置场景内容保留。</p>
          <button
            onClick={async () => {
              if (
                confirm('确认清空全部本地学习数据？此操作无法撤销。') &&
                confirm('请再次确认：真的要清空吗？')
              ) {
                await clearAll();
                await onReload();
                notify('本地学习数据已清空。');
              }
            }}
          >
            清空数据
          </button>
        </article>
        <article class="card">
          <h2>隐私与离线</h2>
          <p>没有登录、分析追踪或 AI 接口。你的输入不会上传；未主动保存的训练文字不会持久化。</p>
        </article>
      </div>
    </section>
  );
}
render(<App />, document.getElementById('app')!);
