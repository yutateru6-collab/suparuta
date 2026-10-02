import type { Chunk } from '../types';

export const DRAFT_KEY = 'spartan_reader_draft_v1';
export const SETTINGS_KEY = 'spartan_reader_settings_v1';
export const SESSION_KEY = 'spartan_reader_session_v1';
export interface ReaderSettings {
  wpm: number; showTranslation: boolean; translationDelay: number;
  wordGroupSize: number; revealMode: 'fade' | 'flash' | 'blur' | 'zoom';
}
export const defaultSettings = (): ReaderSettings => ({ wpm: 110, showTranslation: false, translationDelay: 0, wordGroupSize: 0, revealMode: 'fade' });
export type ViewedRange = [number, number];
export interface ReaderStateProps {
  settings: ReaderSettings; onSettingsChange: (settings: ReaderSettings) => void;
  initialPosition: { wordOffset: number; viewed: ViewedRange[] };
  onPosition: (wordOffset: number, viewed: ViewedRange[]) => void;
}
export interface ReadingSession {
  version: 1; text: string; chunks: Chunk[]; wordOffset: number;
  viewed: ViewedRange[]; experience: 'quest' | 'classic';
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved state');
  return value as Record<string, unknown>;
};
export const decodeSettings = (value: unknown): ReaderSettings => {
  const row = object(value);
  if (!Number.isInteger(row.wpm) || Number(row.wpm) < 70 || Number(row.wpm) > 160 ||
    typeof row.showTranslation !== 'boolean' || ![0, 2, 3, 4, 5, 6, 7].includes(Number(row.translationDelay)) ||
    typeof row.translationDelay !== 'number' || !Number.isInteger(row.wordGroupSize) || Number(row.wordGroupSize) < 0 || Number(row.wordGroupSize) > 5 ||
    !['fade', 'flash', 'blur', 'zoom'].includes(String(row.revealMode))) throw new Error('Invalid settings');
  return row as unknown as ReaderSettings;
};
export const decodeDraft = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Invalid draft');
  return value;
};
export const decodeSession = (value: unknown): ReadingSession | null => {
  if (value === null) return null;
  const row = object(value);
  if (row.version !== 1 || typeof row.text !== 'string' || !['quest', 'classic'].includes(String(row.experience)) ||
    !Array.isArray(row.chunks) || !row.chunks.length || row.chunks.length > 5000 ||
    !row.chunks.every(c => c && typeof c.en === 'string' && c.en.trim() && typeof c.jp === 'string' && (c.speaker == null || typeof c.speaker === 'string'))) throw new Error('Invalid session');
  const total = row.chunks.reduce((n, c) => n + c.en.trim().split(/\s+/).length, 0);
  if (!Number.isInteger(row.wordOffset) || Number(row.wordOffset) < 0 || Number(row.wordOffset) >= total ||
    !Array.isArray(row.viewed) || !row.viewed.every(r => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] >= 0 && r[1] > r[0] && r[1] <= total)) throw new Error('Invalid position');
  return row as unknown as ReadingSession;
};
/** Keep corrupt/unsupported records intact; failed storage never prevents reading. */
export const loadState = <T>(key: string, decode: (value: unknown) => T, fallback: T) => {
  try {
    const raw = localStorage.getItem(key);
    return { value: raw === null ? fallback : decode(JSON.parse(raw)), writable: true, warning: '' };
  } catch {
    return { value: fallback, writable: false, warning: '保存データを読み込めませんでした。既存データは上書きせず、この画面内で学習を続けます。' };
  }
};
/** Record explicitly advanced display ranges, independent of later grouping changes. */
export const addViewedRange = (ranges: ViewedRange[], start: number, count: number): ViewedRange[] => {
  const sorted = [...ranges, [start, start + count] as ViewedRange].sort((a, b) => a[0] - b[0]);
  const merged: ViewedRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
};
export const allWordsViewed = (ranges: ViewedRange[], total: number) => total > 0 && ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] === total;
