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

const stripCodeFence = (source: string): string =>
  source
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

/**
 * Some AI/chat apps replace JSON's ASCII quotes with typographic smart quotes.
 * Recover the common pattern without touching ordinary prose.
 *
 * Example:
 * { “en”: “\"libraries of things.\"”, “jp”: “「物の図書館」”, “speaker”: null }
 */
const normalizeSmartQuotedJson = (source: string): string =>
  source
    // Normalize smart-quoted object keys.
    .replace(/([{,]\s*)[“”]([^“”]+)[“”](\s*:)/g, '$1"$2"$3')
    // Normalize smart-quoted string values and JSON-escape their contents.
    .replace(/:\s*“([\s\S]*?)”(?=\s*[,}])/g, (_match, value: string) =>
      `: ${JSON.stringify(value)}`,
    );

const toChunksFromParsedJson = (parsed: unknown): Chunk[] => {
  if (!Array.isArray(parsed) || parsed.length === 0) return [];

  const chunks: Chunk[] = [];

  for (const item of parsed) {
    if (typeof item === "string" && item.trim()) {
      chunks.push({ en: item.trim(), jp: "", speaker: null });
      continue;
    }

    if (
      item &&
      typeof item === "object" &&
      "en" in item &&
      typeof (item as { en?: unknown }).en === "string" &&
      (item as { en: string }).en.trim()
    ) {
      const candidate = item as {
        en: string;
        jp?: unknown;
        speaker?: unknown;
      };

      chunks.push({
        en: candidate.en.trim(),
        jp: typeof candidate.jp === "string" ? candidate.jp.trim() : "",
        speaker:
          typeof candidate.speaker === "string" && candidate.speaker.trim()
            ? candidate.speaker.trim()
            : null,
      });
    }
  }

  return chunks;
};

const tryParseJsonChunks = (source: string): Chunk[] | null => {
  const withoutFence = stripCodeFence(source);
  const candidates = [withoutFence];
  const normalizedSmartQuotes = normalizeSmartQuotedJson(withoutFence);

  if (normalizedSmartQuotes !== withoutFence) {
    candidates.push(normalizedSmartQuotes);
  }

  for (const candidate of candidates) {
    try {
      const chunks = toChunksFromParsedJson(JSON.parse(candidate));
      if (chunks.length > 0) return chunks;
    } catch {
      // Try the next recovery candidate.
    }
  }

  return null;
};

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

    if (
      currentWords.length > 0 &&
      (reachedMax || shouldSoftSplit || shouldSplitBeforeTo)
    ) {
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
 * 2. AI-generated JSON that accidentally uses smart quotes.
 * 3. Short newline-separated chunks.
 * 4. Plain English text, split into meaning-aware chunks of at most 7 words.
 */
export const parseTextLocal = (text: string): Chunk[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. JSON / AI-JSON input, including recovery for common smart-quote output.
  const jsonChunks = tryParseJsonChunks(trimmed);
  if (jsonChunks) return jsonChunks;

  const jsonCandidate = stripCodeFence(trimmed);
  if (jsonCandidate.startsWith("[") || jsonCandidate.startsWith("{")) {
    throw new Error(
      "JSON形式を解析できません。半角のダブルクォートとJSON構文を確認してください。",
    );
  }

  // 2. Preserve intentionally pre-chunked, short lines.
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const wordCounts = lines.map(
      (line) => line.split(/\s+/).filter(Boolean).length,
    );
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
