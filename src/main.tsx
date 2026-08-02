import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
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
  rollbackPack,
  saveDraft,
  saveSession,
  saveVocabulary,
  sessions,
  vocabulary
} from './storage';
import type { CatalogPack, PracticeSession, Scenario, VocabularyItem } from './types';
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
const go = (page: Page, value?: string) => {
  location.hash = value ? `#/${page}/${value}` : `#/${page}`;
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
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [availableUpdate, setAvailableUpdate] = useState<(() => void) | null>(null);
  const reload = async () => {
    setAllSessions(await sessions());
    setWords(await vocabulary());
  };
  useEffect(() => {
    loadLocalContent()
      .then(setScenarios)
      .then(reload)
      .catch((e: Error) => setNotice(e.message));
    const onHash = () => setLocation(route());
    const online = () => setOffline(!navigator.onLine);
    addEventListener('hashchange', onHash);
    addEventListener('online', online);
    addEventListener('offline', online);
    const update = registerSW({
      onNeedRefresh() {
        setAvailableUpdate(() => update);
      }
    });
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener('online', online);
      removeEventListener('offline', online);
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
    statuses,
    reload,
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
        <Detail scenario={selected} status={statuses.get(selected.id) ?? 'notStarted'} />
      )}
      {page === 'train' && selected && <Training scenario={selected} onSaved={reload} />}
      {page === 'talk' && <Talk {...shared} />}
      {page === 'progress' && <Progress {...shared} />}
      {page === 'words' && <Words {...shared} />}
      {page === 'settings' && <Settings onReload={reload} notify={setNotice} />}
      {!['detail', 'train', 'settings'].includes(page) && <Nav page={page} />}
    </main>
  );
}
function Header({ title, back = false }: { title: string; back?: boolean }) {
  return (
    <header>
      <button
        class="icon-button"
        aria-label={back ? '返回' : '设置'}
        onClick={() => go(back ? 'scenes' : 'settings')}
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
          ['words', '词句']
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
function Home({ scenarios, allSessions, statuses, notice }: any) {
  const completed = overallCompletion([...statuses.values()]);
  const hotel = scenarios.filter((s: Scenario) => s.category === 'hotel');
  const flight = scenarios.filter((s: Scenario) => s.category === 'flight');
  const percent = (list: Scenario[]) => overallCompletion(list.map((s) => statuses.get(s.id)));
  const fresh = scenarios.find((s: Scenario) => statuses.get(s.id) !== 'mastered') ?? scenarios[0];
  return (
    <section>
      <Header title="航旅英语" />
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
          ['words', '常用表达']
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
function Detail({ scenario, status }: { scenario: Scenario; status: any }) {
  const [translation, setTranslation] = useState(false);
  return (
    <section>
      <Header title="场景详情" back />
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
        <p>{scenario.vocabulary.map((v) => `${v.term}（${v.meaning}）`).join(' · ')}</p>
        <button class="primary" onClick={() => go('train', scenario.id)}>
          开始训练
        </button>
      </article>
    </section>
  );
}
function Training({ scenario, onSaved }: { scenario: Scenario; onSaved: () => Promise<void> }) {
  const [subject, setSubject] = useState(scenario.reference.subject ?? '');
  const [response, setResponse] = useState('');
  const [hint, setHint] = useState(false);
  const [reference, setReference] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof scoreResponse> | null>(null);
  const [started] = useState(new Date().toISOString());
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'partner', text: scenario.partnerMessage }
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
      { role: 'partner', text: next.nextPartnerMessage }
    ]);
    setResponse('');
    if (!next.needsClarification) await submit();
  };
  return (
    <section class="training">
      <Header title={scenario.channel === 'email' ? '邮件训练' : '聊天训练'} back />
      <div class="task">
        <strong>{scenario.titleZh}</strong>
        <span>{scenario.partnerMessage}</span>
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
              <p class={`bubble ${m.role}`}>{m.text}</p>
            ))}
          </div>
          <textarea
            value={response}
            onInput={(e) => setResponse((e.target as HTMLTextAreaElement).value)}
            placeholder="输入英文回复…"
            rows={3}
          />
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
  const [log, setLog] = useState<{ role: 'partner' | 'user'; text: string }[]>([]);
  const scenario = chatScenarios.find((s: Scenario) => s.id === scenarioId);
  useEffect(() => {
    if (scenario) setLog([{ role: 'partner', text: scenario.partnerMessage }]);
  }, [scenarioId]);
  if (!scenario)
    return (
      <section>
        <Header title="场景对话" />
        <p>正在加载场景…</p>
      </section>
    );
  const send = async (text = input) => {
    if (!text.trim()) return;
    const engine = new ConversationEngine(scenario);
    const verdict = engine.reply(text);
    const next = [
      ...log,
      { role: 'user' as const, text },
      { role: 'partner' as const, text: verdict.nextPartnerMessage }
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
          <p class={`bubble ${m.role}`}>{m.text}</p>
        ))}
      </div>
      {mode === 'guided' && (
        <div class="choices">
          {scenario.phrases.map((p: { text: string }) => (
            <button onClick={() => send(p.text)}>{p.text}</button>
          ))}
        </div>
      )}
      <textarea
        value={input}
        onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
        placeholder="输入英文回复…"
        rows={3}
      />
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
function Words({ words, reload, notice }: any) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [meaning, setMeaning] = useState('');
  const filtered = words.filter((w: VocabularyItem) =>
    `${w.text} ${w.meaning} ${w.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
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
  return (
    <section>
      <Header title="词句" />
      <input
        aria-label="搜索词句"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        placeholder="搜索单词、短语或标签"
      />
      <div class="actions">
        <button onClick={() => setEditing(!editing)}>+ 添加词句</button>
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
      {!filtered.length && (
        <div class="empty">暂无词句。可在训练结果中将有用表达手动添加到这里。</div>
      )}
    </section>
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
