import { Chunk } from "../types";

const MAX_WORDS = 7;
const MIN_WORDS_BEFORE_SOFT_SPLIT = 3;

const conjunctions = new Set([
  "and",
  "but",
  "or",
  "because",
  "although",
  "though",
  "since",
  "unless",
  "while",
  "when",
  "if",
  "so",
  "yet",
  "nor",
  "as",
  "whereas",
]);

const prepositions = new Set([
  "in",
  "on",
  "at",
  "for",
  "with",
  "by",
  "from",
  "of",
  "about",
  "between",
  "through",
  "during",
  "under",
  "into",
  "over",
  "after",
  "before",
  "without",
  "within",
  "across",
  "around",
  "against",
  "among",
  "toward",
  "towards",
  "upon",
  "near",
  "beside",
  "behind",
  "beyond",
  "despite",
]);

const relatives = new Set([
  "who",
  "which",
  "that",
  "whom",
  "whose",
  "what",
  "how",
  "where",
  "why",
]);

const normalizeWord = (word: string) =>
  word
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

const endsWithPunctuation = (word: string) =>
  /[,.!?;:]["'”’)]?$/.test(word);

const toChunk = (words: string[]): Chunk => ({
  en: words.join(" "),
  jp: "",
  speaker: null,
});

const chunkPlainText = (text: string): Chunk[] => {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentWords: string[] = [];

  const flush = () => {
    if (currentWords.length === 0) return;
    chunks.push(toChunk(currentWords));
    currentWords = [];
  };

  for (const word of words) {
    const normalized = normalizeWord(word);
    const isClauseStarter =
      conjunctions.has(normalized) || relatives.has(normalized);
    const isPreposition = prepositions.has(normalized);
    const isTo = normalized === "to";

    const shouldSoftSplit =
      currentWords.length >= MIN_WORDS_BEFORE_SOFT_SPLIT &&
      (isClauseStarter || isPreposition);

    const shouldSplitBeforeTo = isTo && currentWords.length >= 4;
    const reachedMax = currentWords.length >= MAX_WORDS;

    if (currentWords.length > 0 && (reachedMax || shouldSoftSplit || shouldSplitBeforeTo)) {
      flush();
    }

    currentWords.push(word);

    if (endsWithPunctuation(word) || currentWords.length >= MAX_WORDS) {
      flush();
    }
  }

  flush();
  return chunks;
};

/**
 * Parses English text locally.
 *
 * Supported input:
 * 1. JSON array of strings or objects with an `en` property.
 * 2. Short newline-separated chunks.
 * 3. Plain English text, split into meaning-aware chunks of at most 7 words.
 */
export const parseTextLocal = (text: string): Chunk[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. JSON input
  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const chunks: Chunk[] = [];

      for (const item of parsed) {
        if (typeof item === "string" && item.trim()) {
          chunks.push({ en: item.trim(), jp: "", speaker: null });
          continue;
        }

        if (
          item &&
          typeof item === "object" &&
          typeof item.en === "string" &&
          item.en.trim()
        ) {
          chunks.push({
            en: item.en.trim(),
            jp: typeof item.jp === "string" ? item.jp.trim() : "",
            speaker:
              typeof item.speaker === "string" && item.speaker.trim()
                ? item.speaker.trim()
                : null,
          });
        }
      }

      if (chunks.length > 0) return chunks;
    }
  } catch {
    // Not JSON. Continue with local text parsing.
  }

  // 2. Preserve intentionally pre-chunked, short lines.
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const wordCounts = lines.map((line) => line.split(/\s+/).filter(Boolean).length);
    const averageWords =
      wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;

    if (averageWords <= MAX_WORDS) {
      return lines.flatMap((line, index) => {
        const lineWordCount = wordCounts[index];
        return lineWordCount <= MAX_WORDS
          ? [{ en: line, jp: "", speaker: null }]
          : chunkPlainText(line);
      });
    }
  }

  // 3. Meaning-aware local chunking.
  return chunkPlainText(trimmed);
};
