import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { parse } from 'csv-parse/sync';
import { format } from 'prettier';

const exec = promisify(execFile);
const sourcePath = process.argv.find((argument) => argument.startsWith('--source='))?.slice(9);
const buildAudio = process.argv.includes('--audio');
const librarySize = 20_000;
const audioSize = 3_000;
if (!sourcePath)
  throw new Error(
    'Usage: tsx scripts/build-offline-library.ts --source=/path/ecdict.csv [--audio]'
  );

type SourceRow = {
  word: string;
  phonetic: string;
  translation: string;
  pos: string;
  collins: string;
  oxford: string;
  tag: string;
  bnc: string;
  frq: string;
};

const packDefinitions = [
  { id: 'offline-foundation', title: '核心基础 3000', level: '基础', start: 0, end: 3000 },
  { id: 'offline-everyday', title: '生活交流 5000', level: '基础', start: 3000, end: 8000 },
  { id: 'offline-intermediate', title: '能力进阶 5000', level: '进阶', start: 8000, end: 13000 },
  { id: 'offline-advanced', title: '高阶表达 4000', level: '商务', start: 13000, end: 17000 },
  { id: 'offline-academic', title: '学术与职场 3000', level: '商务', start: 17000, end: 20000 }
] as const;

const cleanTranslation = (value: string) =>
  value
    .replace(/\\n/g, '；')
    .replace(/\[网络\][^；]*/g, '')
    .replace(/\s+/g, ' ')
    .split(/[；;]/)
    .slice(0, 2)
    .join('；')
    .replace(/^[a-z]+\.\s*/i, '')
    .trim();

const categoryFor = (word: string, translation: string) => {
  const english = word.toLowerCase();
  if (
    /\b(?:time|date|day|week|month|year|hour|minute|number|schedule|calendar|clock)\b/.test(
      english
    ) ||
    /时间|日期|星期|月份|数字|日历|时钟/.test(translation)
  )
    return '数字与时间';
  if (
    /\b(?:doctor|health|pain|medicine|hospital|body|sick|clinic|pharmacy|symptom)\b/.test(
      english
    ) ||
    /药物|药品|医院|诊所|疼痛|健康|身体|疾病|症状/.test(translation)
  )
    return '健康';
  if (
    /\b(?:bus|train|airport|road|street|travel|ticket|taxi|subway|traffic|flight)\b/.test(
      english
    ) ||
    /公交|火车|机场|道路|街道|旅行|车票|交通|航班|出租车|地铁/.test(translation)
  )
    return '出行';
  if (
    /\b(?:food|eat|drink|restaurant|meal|fruit|meat|menu|breakfast|lunch|dinner|cafe)\b/.test(
      english
    ) ||
    /餐厅|食品|食物|饮料|菜肴|菜单|牛肉|猪肉|鸡肉|水果|早餐|午餐|晚餐/.test(translation)
  )
    return '餐饮';
  if (
    /\b(?:buy|sell|price|shop|store|money|pay|purchase|refund|discount|receipt)\b/.test(english) ||
    /购买|出售|价格|商店|金钱|付款|支付|退款|折扣|收据/.test(translation)
  )
    return '购物与服务';
  if (
    /\b(?:office|business|company|project|meeting|work|job|career|colleague|manager)\b/.test(
      english
    ) ||
    /办公室|商业|公司|工作|项目|会议|职业|同事|经理/.test(translation)
  )
    return '职场沟通';
  if (
    /\b(?:friend|party|invite|relationship|social|neighbor|conversation)\b/.test(english) ||
    /朋友|聚会|邀请|人际关系|社交|邻居|交谈/.test(translation)
  )
    return '社交';
  return '日常生活';
};

const rows = parse(await readFile(sourcePath, 'utf8'), {
  columns: true,
  relax_quotes: true,
  relax_column_count: true,
  skip_empty_lines: true
}) as SourceRow[];

const seen = new Set<string>();
const selected = rows
  .filter((row) => {
    const word = row.word?.toLowerCase().trim();
    const translation = cleanTranslation(row.translation ?? '');
    if (!/^[a-z]+(?:[ -][a-z]+)?$/.test(word) || !translation || seen.has(word)) return false;
    if (!Number(row.frq) && !Number(row.bnc) && !row.oxford && !row.tag) return false;
    seen.add(word);
    return true;
  })
  .sort((left, right) => {
    const rank = (row: SourceRow) => Number(row.frq) || Number(row.bnc) || 999_999;
    return rank(left) - rank(right) || left.word.localeCompare(right.word);
  })
  .slice(0, librarySize);

if (selected.length !== librarySize)
  throw new Error(`Expected ${librarySize} entries, found ${selected.length}`);

const outputDirectory = 'public/vocabulary/packs';
const audioDirectory = 'public/audio/vocabulary';
await mkdir(outputDirectory, { recursive: true });
await mkdir(audioDirectory, { recursive: true });

const packs = [];
for (const definition of packDefinitions) {
  const entries = selected.slice(definition.start, definition.end).map((row, offset) => {
    const index = definition.start + offset + 1;
    const word = row.word.toLowerCase().trim();
    const safeName = `${String(index).padStart(4, '0')}-${word.replace(/[^a-z]+/g, '-')}`;
    return {
      id: `ecdict-${safeName}`,
      term: word,
      phonetic: row.phonetic ? `/${row.phonetic.replace(/^\/+|\/+$/g, '')}/` : '',
      meaning: cleanTranslation(row.translation),
      category: categoryFor(word, row.translation),
      level: definition.level,
      example: `Listen and repeat: ${word}.`,
      exampleMeaning: `听示范并跟读：${cleanTranslation(row.translation)}。`,
      tips: [
        row.pos ? `词性：${row.pos.replace(/\//g, '、')}` : '先听发音，再完整读出单词。',
        '加入复习后，系统会根据掌握情况安排下一次练习。'
      ],
      ...(index <= audioSize ? { audio: `audio/vocabulary/${safeName}.m4a` } : {})
    };
  });
  const pack = {
    id: definition.id,
    title: definition.title,
    version: '2.0.0',
    releasedAt: '2026-08-04T05:00:00.000Z',
    entries
  };
  const fileName = `${definition.id}-2.0.0.json`;
  await writeFile(
    join(outputDirectory, fileName),
    await format(JSON.stringify(pack), { parser: 'json', printWidth: 100, trailingComma: 'none' })
  );
  packs.push({
    id: definition.id,
    title: definition.title,
    version: '2.0.0',
    path: `./packs/${fileName}`,
    entryCount: entries.length,
    audioIncluded: definition.start === 0,
    audioEntryCount: definition.start === 0 ? audioSize : 0,
    estimatedBytes: definition.start === 0 ? 32_000_000 : entries.length * 650
  });
}

await writeFile(
  'public/vocabulary/offline-catalog.json',
  await format(
    JSON.stringify({ catalogVersion: 1, releasedAt: '2026-08-04T05:00:00.000Z', packs }),
    { parser: 'json', printWidth: 100, trailingComma: 'none' }
  )
);

if (buildAudio) {
  const temporaryDirectory = await import('node:fs/promises').then(({ mkdtemp }) =>
    mkdtemp(join(tmpdir(), 'opslite-audio-'))
  );
  let completed = 0;
  const audioRows = selected.slice(0, audioSize);
  const queue = audioRows.map((row, index) => async () => {
    const word = row.word.toLowerCase().trim();
    const safeName = `${String(index + 1).padStart(4, '0')}-${word.replace(/[^a-z]+/g, '-')}`;
    const aiff = join(temporaryDirectory, `${safeName}.aiff`);
    const target = join(audioDirectory, `${safeName}.m4a`);
    if (
      await access(target)
        .then(() => true)
        .catch(() => false)
    ) {
      completed += 1;
      return;
    }
    await exec('/usr/bin/say', ['-v', 'Samantha', '-r', '165', '-o', aiff, word]);
    await exec('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', aiff, target]);
    await rm(aiff, { force: true });
    completed += 1;
    if (completed % 100 === 0)
      process.stdout.write(`Prepared ${completed}/${audioSize} audio files\n`);
  });
  const workers = Array.from({ length: 24 }, async () => {
    while (queue.length) await queue.shift()?.();
  });
  await Promise.all(workers);
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write(
  `Built ${packs.length} offline packs / ${librarySize} entries${buildAudio ? ` with ${audioSize} audio files` : ''}\n`
);
