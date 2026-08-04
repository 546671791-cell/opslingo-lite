import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { naturalSpeechConfigured, prefetchNaturalEnglish } from './pronunciation';
import {
  fetchOfflineVocabularyCatalog,
  installOfflineVocabularyPacks,
  vocabularyEntriesForPacks
} from './storage';
import type { VocabularyCatalog } from './types';

const descriptions: Record<string, string> = {
  'offline-foundation': '最高频基础表达，含 3000 个离线参考发音，推荐所有学习者安装。',
  'offline-everyday': '覆盖吃喝、购物、交通、健康、社交等真实生活交流。',
  'offline-intermediate': '适合 B1–B2 的常见阅读、听说与观点表达。',
  'offline-advanced': '扩展较难词汇与复杂表达，适合 C1–C2 进阶。',
  'offline-academic': '覆盖学术阅读、研究、会议和职场书面表达。'
};

export function PackOnboarding({ onComplete }: { onComplete: () => Promise<void> }) {
  const [catalog, setCatalog] = useState<VocabularyCatalog | null>(null);
  const [selected, setSelected] = useState(
    () => new Set(['offline-foundation', 'offline-everyday', 'offline-intermediate'])
  );
  const [progress, setProgress] = useState({ completed: 0, total: 1, label: '正在读取内置内容…' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloadNaturalVoice, setDownloadNaturalVoice] = useState(naturalSpeechConfigured);

  useEffect(() => {
    fetchOfflineVocabularyCatalog()
      .then(setCatalog)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const install = async () => {
    if (!selected.size) return;
    try {
      setBusy(true);
      setError('');
      await installOfflineVocabularyPacks([...selected], (completed, total, label) =>
        setProgress({ completed, total: Math.max(1, total), label })
      );
      if (downloadNaturalVoice && naturalSpeechConfigured) {
        const entries = await vocabularyEntriesForPacks([...selected]);
        const result = await prefetchNaturalEnglish(
          entries.map((entry) => entry.term),
          (completed, total) =>
            setProgress({
              completed,
              total: Math.max(1, total),
              label: `正在下载自然美式单词发音 ${completed}/${total}`
            })
        );
        if (result.failed) setError(`${result.failed} 个单词语音未完成，稍后可在设置中继续下载。`);
      }
      localStorage.setItem('opslite-onboarding-v2', 'complete');
      await onComplete();
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
    }
  };

  return (
    <div class="pack-onboarding">
      <section class="pack-onboarding-card" aria-labelledby="pack-title">
        <span class="onboarding-mark">OL</span>
        <p class="eyebrow">首次使用 · 先准备离线学习内容</p>
        <h1 id="pack-title">选择你的英语词汇包</h1>
        <p class="muted">
          {Capacitor.isNativePlatform()
            ? '词汇和离线参考音已装进 APK；自然美式语音包可选下载到本机。'
            : '选择后会下载并缓存到当前设备；完成后可离线使用。'}
        </p>
        <div class="pack-options">
          {catalog?.packs.map((pack) => (
            <label class={`pack-option ${selected.has(pack.id) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={selected.has(pack.id)}
                onChange={() => toggle(pack.id)}
                disabled={busy}
              />
              <span>
                <strong>{pack.title}</strong>
                <small>{descriptions[pack.id]}</small>
                <em>
                  {pack.entryCount} 词
                  {pack.audioIncluded
                    ? ` · ${pack.audioEntryCount} 个离线参考音`
                    : ' · 可下载自然美式发音'}
                </em>
              </span>
            </label>
          ))}
        </div>
        <label class={`pack-option ${downloadNaturalVoice ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={downloadNaturalVoice}
            onChange={() => setDownloadNaturalVoice((value) => !value)}
            disabled={busy || !naturalSpeechConfigured}
          />
          <span>
            <strong>下载自然美式单词语音</strong>
            <small>
              {naturalSpeechConfigured
                ? '使用 Azure 神经语音预先下载所选词汇；下载后播放无需联网或等待。'
                : '完成 Azure Speech 配置后可启用；目前仍可使用内置离线参考音。'}
            </small>
            <em>可随时在设置继续下载或重试</em>
          </span>
        </label>
        {busy && (
          <div class="pack-progress" role="status">
            <progress value={progress.completed} max={progress.total} />
            <span>{progress.label}</span>
          </div>
        )}
        {error && <p class="inline-warning">{error}</p>}
        <button
          class="primary wide onboarding-start"
          disabled={busy || !catalog || !selected.size}
          onClick={install}
        >
          {busy ? '正在准备离线内容…' : `安装所选 ${selected.size} 个词汇包并开始`}
        </button>
        <small class="privacy-note">无账号、无广告、无分析追踪；学习记录仅保存在本机。</small>
      </section>
    </div>
  );
}
