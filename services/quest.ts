import type { Chunk } from '../types';

export const QUEST_PROGRESS_KEY = 'spartan_quest_progress_v1';
export interface QuestProgress { version: 1; sparks: number; completed: string[] }
export const emptyQuestProgress = (): QuestProgress => ({ version: 1, sparks: 0, completed: [] });

/** Section breaks favor sentence endings. They are checkpoints, not inferred paragraphs. */
export const questSections = (chunks: Chunk[]): number[] => {
  if (!chunks.length) return [];
  const count = chunks.length;
  const sectionCount = Math.min(4, Math.max(1, Math.ceil(count / 6)));
  const sentenceEnds = chunks.flatMap((chunk, index) => /[.!?]["'”’)]?$/.test(chunk.en.trim()) && index < count - 1 ? [index] : []);
  const ends: number[] = [];
  for (let section = 1; section < sectionCount; section++) {
    const target = Math.round(count * section / sectionCount) - 1;
    const previous = ends.at(-1) ?? -1;
    const latest = count - (sectionCount - section) - 1;
    const possible = sentenceEnds.filter(index => index > previous && index <= latest);
    const selected = possible.length
      ? possible.reduce((best, index) => Math.abs(index - target) < Math.abs(best - target) ? index : best)
      : Math.min(latest, Math.max(previous + 1, target));
    ends.push(selected);
  }
  return [...ends, count - 1];
};

export const sectionAtChunk = (ends: number[], chunkIndex: number): number => {
  const found = ends.findIndex(end => chunkIndex <= end);
  return found < 0 ? Math.max(0, ends.length - 1) : found;
};

/** A compact, stable key for cosmetic rewards; not a security or content-integrity hash. */
export const questId = (chunks: Chunk[]): string => {
  const text = chunks.map(chunk => chunk.en.trim()).join(' ');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}-${(hash >>> 0).toString(16)}`;
};

export const decodeQuestProgress = (raw: string | null): QuestProgress => {
  if (raw === null) return emptyQuestProgress();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('進行データの形式が不正です。');
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || !Number.isSafeInteger(row.sparks) || (row.sparks as number) < 0 ||
    !Array.isArray(row.completed) || row.completed.length > 500 ||
    !row.completed.every(id => typeof id === 'string' && /^[0-9]+-[0-9a-f]+$/.test(id))) {
    throw new Error('進行データの形式が不正です。');
  }
  return { version: 1, sparks: row.sparks as number, completed: [...new Set(row.completed as string[])] };
};

export const loadQuestProgress = (): { progress: QuestProgress; writable: boolean; warning: string | null } => {
  try { return { progress: decodeQuestProgress(localStorage.getItem(QUEST_PROGRESS_KEY)), writable: true, warning: null }; }
  catch { return { progress: emptyQuestProgress(), writable: false, warning: '冒険の記録を読み込めませんでした。既存の記録は上書きしません。' }; }
};

export const finishQuest = (progress: QuestProgress, id: string): { progress: QuestProgress; earned: number } => {
  if (progress.completed.includes(id)) return { progress, earned: 0 };
  const earned = 30;
  return {
    progress: { version: 1, sparks: progress.sparks + earned, completed: [...progress.completed.slice(-498), id] },
    earned,
  };
};
