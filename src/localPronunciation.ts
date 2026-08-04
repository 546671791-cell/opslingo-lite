export type LocalPronunciationResult = {
  score: number;
  completeness: number;
  recognizedText: string;
  words: { word: string; matched: boolean }[];
};

const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, '')
    .match(/[a-z]+/g) ?? [];

export function scoreLocalPronunciation(
  referenceText: string,
  recognizedText: string
): LocalPronunciationResult {
  const reference = words(referenceText);
  const recognized = words(recognizedText);
  const table = Array.from({ length: reference.length + 1 }, () =>
    Array<number>(recognized.length + 1).fill(0)
  );
  for (let i = 1; i <= reference.length; i += 1) {
    for (let j = 1; j <= recognized.length; j += 1) {
      table[i][j] =
        reference[i - 1] === recognized[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  const matched = Array(reference.length).fill(false);
  let i = reference.length;
  let j = recognized.length;
  while (i > 0 && j > 0) {
    if (reference[i - 1] === recognized[j - 1]) {
      matched[i - 1] = true;
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) i -= 1;
    else j -= 1;
  }
  const matchCount = matched.filter(Boolean).length;
  const completeness = reference.length ? Math.round((matchCount / reference.length) * 100) : 0;
  const accuracy = Math.max(reference.length, recognized.length)
    ? Math.round((matchCount / Math.max(reference.length, recognized.length)) * 100)
    : 0;
  return {
    score: Math.round(accuracy * 0.65 + completeness * 0.35),
    completeness,
    recognizedText,
    words: reference.map((word, index) => ({ word, matched: matched[index] }))
  };
}
