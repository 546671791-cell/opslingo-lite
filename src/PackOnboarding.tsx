import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { fetchOfflineVocabularyCatalog, installOfflineVocabularyPacks } from './storage';
import type { VocabularyCatalog } from './types';

const descriptions: Record<string, string> = {
  'offline-foundation': '最高频基础表达，含 3000 个统一标准美式发音，推荐所有学习者安装。',
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
            ? '所有内容已装进 APK；这里仅建立本机词库和音频索引，不会联网下载。'
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
                  {pack.audioIncluded ? ` · ${pack.audioEntryCount} 个内置发音` : ' · 系统朗读'}
                </em>
              </span>
            </label>
          ))}
        </div>
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
