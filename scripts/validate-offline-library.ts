import { access, readFile } from 'node:fs/promises';

type Catalog = {
  packs: {
    id: string;
    path: string;
    entryCount: number;
    audioEntryCount?: number;
  }[];
};

const catalog = JSON.parse(
  await readFile('public/vocabulary/offline-catalog.json', 'utf8')
) as Catalog;
if (catalog.packs.length !== 5) throw new Error('离线词库必须包含 5 个分级包。');

const ids = new Set<string>();
let entries = 0;
let audio = 0;
for (const descriptor of catalog.packs) {
  const packPath = `public/vocabulary/${descriptor.path.replace(/^\.\//, '')}`;
  const pack = JSON.parse(await readFile(packPath, 'utf8')) as {
    id: string;
    entries: { id: string; term: string; meaning: string; audio?: string }[];
  };
  if (pack.id !== descriptor.id || pack.entries.length !== descriptor.entryCount)
    throw new Error(`${descriptor.id} 的目录信息与词汇包不一致。`);
  for (const entry of pack.entries) {
    if (!entry.term || !entry.meaning || ids.has(entry.id))
      throw new Error(`词条无效或重复：${entry.id}`);
    ids.add(entry.id);
    if (entry.audio) {
      await access(`public/${entry.audio}`);
      audio += 1;
    }
  }
  entries += pack.entries.length;
}
if (entries !== 20_000) throw new Error(`词汇总数应为 20000，实际为 ${entries}。`);
if (audio !== 3_000) throw new Error(`内置发音应为 3000，实际为 ${audio}。`);
process.stdout.write(`Validated ${entries} vocabulary entries and ${audio} audio files.\n`);
