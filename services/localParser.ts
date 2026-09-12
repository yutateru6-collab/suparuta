import type { Chunk } from '../types';

export const MAX_INPUT_CHARS = 200_000;
export const MAX_CHUNKS = 5_000;
export const PROMPT_MAX_WORDS = 12;
export interface ParsedReading { chunks: Chunk[]; warnings: string[] }
export class ReadingInputError extends Error {
  constructor(message: string) { super(message); this.name = 'ReadingInputError'; }
}
const unwrap = (input: string): string => {
  let text = input.trim();
  for (let i = 0; i < 2; i++) {
    const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\s*```$/i);
    if (fence) { text = fence[1].trim(); continue; }
    if ((text.startsWith('「') && text.endsWith('」')) || (text.startsWith('『') && text.endsWith('』'))) {
      const inner = text.slice(1, -1).trim();
      if (/^[\[{]/.test(inner) || inner.startsWith('```')) { text = inner; continue; }
    }
    break;
  }
  return text;
};
/** Recover typographic JSON delimiters, not text inside valid JSON strings. */
export const normalizeSmartJson = (text: string): string => {
  let out = ''; let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const start = i++; let closed = false;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i++] === '"') { closed = true; break; }
      }
      if (!closed) throw new ReadingInputError('JSON内の引用符が閉じられていません。');
      out += text.slice(start, i);
    } else if (c === '“') {
      i++; let value = ''; let depth = 1;
      while (i < text.length && depth > 0) {
        const char = text[i++];
        if (char === '\\') {
          const n = text[i]; const length = n === 'u' ? 5 : 1;
          const escape = '\\' + text.slice(i, i + length);
          try { value += JSON.parse('"' + escape + '"'); }
          catch { throw new ReadingInputError('JSON内のエスケープが不正です。'); }
          i += length;
        } else if (char === '“') { depth++; value += char; }
        else if (char === '”') { depth--; if (depth > 0) value += char; }
        else { value += char; }
      }
      if (depth !== 0) throw new ReadingInputError('スマートクォートの対応が取れていません。');
      out += JSON.stringify(value);
    } else { out += c; i++; }
  }
  return out;
};
const validatedChunks = (value: unknown): Chunk[] => {
  if (!Array.isArray(value) || value.length === 0) throw new ReadingInputError('JSONは、英文を含む空でない配列にしてください。');
  if (value.length > MAX_CHUNKS) throw new ReadingInputError(`一度に読み込めるのは${MAX_CHUNKS}チャンクまでです。`);
  return value.map((entry: unknown, index: number) => {
    const error = (detail: string): never => { throw new ReadingInputError(`JSONの${index + 1}件目：${detail}`); };
    if (typeof entry === 'string') {
      if (!entry.trim()) return error('英文が空です。');
      return { en: entry.trim(), jp: '', speaker: null };
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return error('英文文字列、またはenを持つオブジェクトが必要です。');
    const row = entry as Record<string, unknown>;
    if (typeof row.en !== 'string' || !row.en.trim()) return error('enに空でない英文文字列を指定してください。');
    if ('jp' in row && typeof row.jp !== 'string') return error('jpは文字列にしてください。');
    if ('speaker' in row && row.speaker !== null && typeof row.speaker !== 'string') return error('speakerは文字列またはnullにしてください。');
    return { en: row.en.trim(), jp: typeof row.jp === 'string' ? row.jp.trim() : '', speaker: typeof row.speaker === 'string' && row.speaker.trim() ? row.speaker.trim() : null };
  });
};
const splitMarkers = new Set('and but or because although though since unless while when if whereas in on at for with by from of about between through during under into over after before without across around against among who which that whom whose what how where why'.split(' '));
const abbreviations = /^(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e)\.$/i;
const punctuationEnd = (word: string) => /[,.!?;:]$/.test(word.replace(/["'”’)]*$/, '')) && !abbreviations.test(word) && !/^(?:[a-z]\.){2,}$/i.test(word);
const normalizeWord = (word: string) => word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
const cannotEnd = new Set('a an the my your his her its our their to will would can could may might must shall should have has had is are was were be been being'.split(' '));
/** Heuristic only: not a syntactic parser or a translator. */
const chunkPlainText = (source: string): Chunk[] => {
  const words = source.trim().split(/\s+/).filter(Boolean);
  const groups: string[][] = []; let current: string[] = [];
  const flush = () => { if (current.length) groups.push(current); current = []; };
  for (const word of words) {
    const last = normalizeWord(current.at(-1) ?? '');
    if (current.length >= PROMPT_MAX_WORDS || (current.length >= 5 && splitMarkers.has(normalizeWord(word)) && !cannotEnd.has(last))) flush();
    current.push(word); if (punctuationEnd(word)) flush();
  }
  flush();
  for (let i = groups.length - 1; i > 0; i--) {
    if (groups[i].length === 1 && groups[i - 1].length === PROMPT_MAX_WORDS && !punctuationEnd(groups[i - 1].at(-1)!)) groups[i].unshift(groups[i - 1].pop()!);
  }
  return groups.map(group => ({ en: group.join(' '), jp: '', speaker: null }));
};
export const parseReadingInput = (input: string): ParsedReading => {
  if (input.length > MAX_INPUT_CHARS) throw new ReadingInputError('入力が長すぎます。20万文字以下に分けてください。');
  const text = unwrap(input);
  if (!text) return { chunks: [], warnings: [] };
  let parsed: unknown; let parsedOK = false; let recovered = false;
  try { parsed = JSON.parse(text); parsedOK = true; } catch { /* Try recognizable JSON only. */ }
  const looksLikeJson = /^[\[{]/.test(text) || /^\s*[「『“"']\s*[\[{]/.test(text) || /^```/.test(text) || /\[\s*\{\s*["“]en["”]\s*:/.test(text);
  if (!parsedOK && looksLikeJson) {
    try { parsed = JSON.parse(normalizeSmartJson(text)); parsedOK = true; recovered = true; }
    catch { throw new ReadingInputError('JSON形式を解析できません。半角の引用符、括弧、末尾のカンマを確認してください。'); }
  }
  if (parsedOK) return { chunks: validatedChunks(parsed), warnings: recovered ? ['引用符の形式を補正しました。英文・和訳は変更していません。'] : [] };
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const chunks = lines.length > 1 && lines.every(line => line.split(/\s+/).length <= PROMPT_MAX_WORDS) ? lines.map(en => ({ en, jp: '', speaker: null })) : chunkPlainText(text);
  if (chunks.length > MAX_CHUNKS) throw new ReadingInputError(`一度に読み込めるのは${MAX_CHUNKS}チャンクまでです。`);
  return { chunks, warnings: [] };
};
export const parseTextLocal = (input: string): Chunk[] => parseReadingInput(input).chunks;
export const getPromptSource = (input: string): string => {
  const text = unwrap(input);
  if (/^[\[{]/.test(text)) return parseTextLocal(text).map(chunk => chunk.en).join(' ');
  return text;
};
