import { openDB, type DBSchema } from 'idb';
import { contentPackSchema } from './content/schema';
import type {
  Catalog,
  ContentPack,
  Draft,
  PracticeSession,
  Scenario,
  VocabularyCatalog,
  VocabularyEntry,
  VocabularyItem
} from './types';

interface OpsDb extends DBSchema {
  contentPacks: { key: string; value: ContentPack & { key: string; previous?: ContentPack } };
  scenarios: { key: string; value: Scenario };
  practiceSessions: { key: string; value: PracticeSession; indexes: { 'by-scenario': string } };
  vocabularyItems: { key: string; value: VocabularyItem & { key: string } };
  drafts: { key: string; value: Draft & { key: string } };
  settings: { key: string; value: { key: string; value: unknown } };
  appMeta: { key: string; value: { key: string; value: unknown } };
  importFingerprints: { key: string; value: { key: string; importedAt: string } };
  conversationMessages: {
    key: string;
    value: { key: string; sessionId: string; role: string; text: string };
  };
  progress: { key: string; value: { key: string; value: unknown } };
  vocabularyPacks: { key: string; value: VocabularyPackRecord };
}
type VocabularyPackRecord = {
  key: string;
  id: string;
  version: string;
  releasedAt: string;
  entries: VocabularyEntry[];
};

export const dbPromise = openDB<OpsDb>('opslite-pwa', 4, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const sessions = db.createObjectStore('practiceSessions', { keyPath: 'id' });
      sessions.createIndex('by-scenario', 'scenarioId');
      db.createObjectStore('scenarios', { keyPath: 'id' });
      (
        [
          'contentPacks',
          'vocabularyItems',
          'drafts',
          'settings',
          'appMeta',
          'importFingerprints',
          'conversationMessages',
          'progress'
        ] as const
      ).forEach((name) => db.createObjectStore(name, { keyPath: 'key' }));
    }
    if (oldVersion < 2 && !db.objectStoreNames.contains('progress'))
      db.createObjectStore('progress', { keyPath: 'key' });
    if (oldVersion < 3) {
      db.deleteObjectStore('scenarios');
      db.deleteObjectStore('contentPacks');
      db.createObjectStore('scenarios', { keyPath: 'id' });
      db.createObjectStore('contentPacks', { keyPath: 'key' });
    }
    if (oldVersion < 4 && !db.objectStoreNames.contains('vocabularyPacks'))
      db.createObjectStore('vocabularyPacks', { keyPath: 'key' });
  }
});

export const id = () => crypto.randomUUID();
export async function loadLocalContent() {
  const db = await dbPromise;
  const packs = await db.getAll('contentPacks');
  if (packs.length) return (await db.getAll('scenarios')).sort((a, b) => a.id.localeCompare(b.id));
  const catalog = (await fetch('./content/catalog.json', { cache: 'no-store' }).then((r) =>
    r.json()
  )) as Catalog;
  for (const entry of catalog.packs) {
    const pack = (await fetch(`./content/${entry.path.replace('./', '')}`, {
      cache: 'force-cache'
    }).then((r) => r.json())) as ContentPack;
    await installPack(pack, entry.sha256);
  }
  return db.getAll('scenarios');
}

function vocabularyPackFrom(input: unknown, expected?: { id: string; version: string }) {
  const pack = input as VocabularyPackRecord;
  if (
    !pack ||
    typeof pack.id !== 'string' ||
    typeof pack.version !== 'string' ||
    !Array.isArray(pack.entries) ||
    pack.entries.some(
      (entry) =>
        !entry ||
        typeof entry.id !== 'string' ||
        typeof entry.term !== 'string' ||
        typeof entry.phonetic !== 'string' ||
        typeof entry.meaning !== 'string' ||
        typeof entry.example !== 'string' ||
        !Array.isArray(entry.tips)
    ) ||
    new Set(pack.entries.map((entry) => entry.id)).size !== pack.entries.length
  )
    throw new Error('词汇包格式无效，已保留本机词库。');
  if (expected && (pack.id !== expected.id || pack.version !== expected.version))
    throw new Error('词汇包身份或版本不匹配，已保留本机词库。');
  return pack;
}

async function fetchVocabularyCatalog() {
  const response = await fetch(`./vocabulary/catalog.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('无法获取词汇目录。');
  const catalog = (await response.json()) as VocabularyCatalog;
  if (!Array.isArray(catalog.packs)) throw new Error('词汇目录格式无效。');
  return catalog;
}

export async function fetchOfflineVocabularyCatalog() {
  const response = await fetch('./vocabulary/offline-catalog.json', { cache: 'force-cache' });
  if (!response.ok) throw new Error('无法读取内置离线词汇目录。');
  const catalog = (await response.json()) as VocabularyCatalog;
  if (!Array.isArray(catalog.packs)) throw new Error('离线词汇目录格式无效。');
  return catalog;
}

async function fetchVocabularyPack(entry: VocabularyCatalog['packs'][number]) {
  const response = await fetch(`./vocabulary/${entry.path.replace('./', '')}?v=${entry.version}`, {
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`无法下载词汇包：${entry.id}`);
  return vocabularyPackFrom(await response.json(), entry);
}

export async function loadVocabularyContent() {
  const db = await dbPromise;
  const local = await db.getAll('vocabularyPacks');
  if (local.length)
    return local
      .flatMap((pack) => pack.entries)
      .sort((a, b) => a.category.localeCompare(b.category) || a.term.localeCompare(b.term));
  const catalog = await fetchVocabularyCatalog();
  for (const entry of catalog.packs) {
    const pack = await fetchVocabularyPack(entry);
    await db.put('vocabularyPacks', { ...pack, key: pack.id });
  }
  return (await db.getAll('vocabularyPacks'))
    .flatMap((pack) => pack.entries)
    .sort((a, b) => a.category.localeCompare(b.category) || a.term.localeCompare(b.term));
}

export async function refreshVocabularyContent() {
  if (!navigator.onLine) throw new Error('当前离线，无法刷新词汇。');
  const db = await dbPromise;
  const catalog = await fetchVocabularyCatalog();
  let updatedEntries = 0;
  for (const entry of catalog.packs) {
    const local = await db.get('vocabularyPacks', entry.id);
    if (local?.version === entry.version) continue;
    const pack = await fetchVocabularyPack(entry);
    await db.put('vocabularyPacks', { ...pack, key: pack.id });
    updatedEntries += pack.entries.length;
  }
  return { updatedEntries, entries: await loadVocabularyContent() };
}

export async function installedVocabularyPackIds() {
  return (await (await dbPromise).getAll('vocabularyPacks')).map((pack) => pack.id);
}

export async function installOfflineVocabularyPacks(
  packIds: string[],
  onProgress?: (completed: number, total: number, label: string) => void
) {
  const catalog = await fetchOfflineVocabularyCatalog();
  const selected = catalog.packs.filter((pack) => packIds.includes(pack.id));
  const total = selected.reduce(
    (sum, pack) => sum + 1 + (pack.audioIncluded ? (pack.audioEntryCount ?? 0) : 0),
    0
  );
  let completed = 0;
  const db = await dbPromise;
  for (const entry of selected) {
    const pack = await fetchVocabularyPack(entry);
    await db.put('vocabularyPacks', { ...pack, key: pack.id });
    completed += 1;
    onProgress?.(completed, total, `已安装 ${entry.title ?? entry.id}`);
    const audioEntries = pack.entries.filter((item) => item.audio);
    if (audioEntries.length && 'caches' in window) {
      const cache = await caches.open('opslite-offline-audio-v1');
      const queue = [...audioEntries];
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const item = queue.shift();
          if (!item?.audio) continue;
          const url = `${import.meta.env.BASE_URL}${item.audio}`;
          if (!(await cache.match(url))) {
            const response = await fetch(url, { cache: 'force-cache' });
            if (response.ok) await cache.put(url, response.clone());
          }
          completed += 1;
          if (completed % 20 === 0 || completed === total)
            onProgress?.(completed, total, `正在准备本地发音 ${completed}/${total}`);
        }
      });
      await Promise.all(workers);
    }
  }
  return loadVocabularyContent();
}

export async function uninstallOfflineVocabularyPack(packId: string) {
  await (await dbPromise).delete('vocabularyPacks', packId);
}
export async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export async function installPack(pack: ContentPack, expectedHash?: string) {
  const validated = contentPackSchema.parse(pack);
  if (expectedHash && (await sha256(JSON.stringify(pack, null, 2) + '\n')) !== expectedHash)
    throw new Error('内容包校验失败：SHA-256 不匹配。');
  const db = await dbPromise;
  const existing = await db.get('contentPacks', validated.id);
  const tx = db.transaction(['contentPacks', 'scenarios'], 'readwrite');
  await tx.objectStore('contentPacks').put({ ...validated, key: validated.id, previous: existing });
  for (const scenario of validated.scenarios) await tx.objectStore('scenarios').put(scenario);
  await tx.done;
}
export async function checkContentUpdates() {
  if (!navigator.onLine) throw new Error('当前离线，无法检查内容更新。');
  const catalog = (await fetch(`./content/catalog.json?t=${Date.now()}`, {
    cache: 'no-store'
  }).then((r) => r.json())) as Catalog;
  const db = await dbPromise;
  const current = await db.getAll('contentPacks');
  const currentVersion = new Map(current.map((p) => [p.id, p.version]));
  return catalog.packs.filter((pack) => (currentVersion.get(pack.id) ?? '0.0.0') !== pack.version);
}
export async function applyCatalogPack(entry: Catalog['packs'][number]) {
  const pack = (await fetch(`./content/${entry.path.replace('./', '')}?v=${entry.version}`, {
    cache: 'no-store'
  }).then((r) => r.json())) as ContentPack;
  await installPack(pack, entry.sha256);
}
export async function rollbackPack(packId: string) {
  const db = await dbPromise;
  const current = await db.get('contentPacks', packId);
  if (!current?.previous) throw new Error('没有可回滚的内容版本。');
  await installPack(current.previous);
}
export async function sessions() {
  return (await dbPromise).getAll('practiceSessions');
}
export async function sessionsFor(id: string) {
  return (await dbPromise).getAllFromIndex('practiceSessions', 'by-scenario', id);
}
export async function saveSession(session: PracticeSession) {
  await (await dbPromise).put('practiceSessions', session);
}
export async function vocabulary() {
  return (await dbPromise).getAll('vocabularyItems');
}
export async function saveVocabulary(item: VocabularyItem) {
  await (await dbPromise).put('vocabularyItems', { ...item, key: item.id });
}
export async function deleteVocabulary(itemId: string) {
  await (await dbPromise).delete('vocabularyItems', itemId);
}
export async function getDraft(scenarioId: string) {
  return (await dbPromise).get('drafts', scenarioId);
}
export async function saveDraft(draft: Draft) {
  await (await dbPromise).put('drafts', { ...draft, key: draft.id });
}
export async function clearAll() {
  const db = await dbPromise;
  const tx = db.transaction(
    [
      'practiceSessions',
      'vocabularyItems',
      'drafts',
      'settings',
      'appMeta',
      'importFingerprints',
      'conversationMessages',
      'progress'
    ],
    'readwrite'
  );
  for (const name of [
    'practiceSessions',
    'vocabularyItems',
    'drafts',
    'settings',
    'appMeta',
    'importFingerprints',
    'conversationMessages',
    'progress'
  ] as const)
    await tx.objectStore(name).clear();
  await tx.done;
}
export interface ExportData {
  formatVersion: 1;
  appVersion: string;
  exportedAt: string;
  sessions: PracticeSession[];
  vocabulary: VocabularyItem[];
  drafts: Draft[];
}
export async function exportData(): Promise<ExportData> {
  const db = await dbPromise;
  return {
    formatVersion: 1,
    appVersion: '1.2.0',
    exportedAt: new Date().toISOString(),
    sessions: await db.getAll('practiceSessions'),
    vocabulary: await db.getAll('vocabularyItems'),
    drafts: await db.getAll('drafts')
  };
}
export async function importData(input: ExportData, mode: 'merge' | 'replace') {
  if (
    input.formatVersion !== 1 ||
    !Array.isArray(input.sessions) ||
    !Array.isArray(input.vocabulary)
  )
    throw new Error('导入文件格式无效。');
  const fingerprint = await sha256(JSON.stringify(input));
  const db = await dbPromise;
  if (await db.get('importFingerprints', fingerprint)) return { imported: 0, duplicate: true };
  if (mode === 'replace') await clearAll();
  const tx = db.transaction(
    ['practiceSessions', 'vocabularyItems', 'drafts', 'importFingerprints'],
    'readwrite'
  );
  let imported = 0;
  for (const session of input.sessions) {
    if (!(await tx.objectStore('practiceSessions').get(session.id))) {
      await tx.objectStore('practiceSessions').put(session);
      imported += 1;
    }
  }
  for (const item of input.vocabulary)
    if (!(await tx.objectStore('vocabularyItems').get(item.id)))
      await tx.objectStore('vocabularyItems').put({ ...item, key: item.id });
  for (const draft of input.drafts ?? [])
    await tx.objectStore('drafts').put({ ...draft, key: draft.id });
  await tx
    .objectStore('importFingerprints')
    .put({ key: fingerprint, importedAt: new Date().toISOString() });
  await tx.done;
  return { imported, duplicate: false };
}
