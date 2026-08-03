import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { lifeCourses } from '../src/curriculum';
import type { VocabularyEntry, VocabularyPack } from '../src/types';

const root = resolve(import.meta.dirname, '..');
const basePackPath = resolve(root, 'public/vocabulary/packs/everyday-english-core-1.0.1.json');
const outputPath = resolve(root, 'public/vocabulary/packs/us-life-core-1.0.0.json');
const base = JSON.parse(await readFile(basePackPath, 'utf8')) as VocabularyPack;
const existing = new Set(base.entries.map((entry) => entry.term.toLowerCase()));
const entries: VocabularyEntry[] = lifeCourses.flatMap((course) =>
  course.keywords
    .filter((word) => !existing.has(word.term.toLowerCase()))
    .map((word) => ({
      id: `${course.id}-${word.term.toLowerCase().replace(/[^a-z]+/g, '-')}`.replace(/-$/, ''),
      term: word.term,
      phonetic: word.phonetic,
      meaning: word.meaning,
      category: course.group,
      level: '进阶' as const,
      example: course.steps[1].phrase,
      exampleMeaning: course.steps[1].meaning,
      tips: [course.steps[1].note, course.cultureTips[0]]
    }))
);
const pack: VocabularyPack = {
  id: 'us-life-core',
  version: '1.0.0',
  releasedAt: '2026-08-04T03:00:00.000Z',
  entries
};
const output = await format(JSON.stringify(pack), {
  parser: 'json',
  printWidth: 100,
  trailingComma: 'none'
});
if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== output)
    throw new Error('美国生活词汇包已过期，请运行 npm run build:vocabulary。');
  console.log(`Validated US life vocabulary pack / ${entries.length} entries`);
} else {
  await writeFile(outputPath, output);
  console.log(`Built US life vocabulary pack / ${entries.length} entries`);
}
