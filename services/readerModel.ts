import type { Chunk } from '../types';
export interface DisplayFrame { text: string; chunk: Chunk; wordCount: number; startWord: number; chunkIndex: number }
export const makeFrames = (chunks: Chunk[], groupSize: number): DisplayFrame[] => {
  const frames: DisplayFrame[] = []; let startWord = 0;
  const size = Number.isInteger(groupSize) && groupSize >= 1 && groupSize <= 5 ? groupSize : 0;
  chunks.forEach((chunk, chunkIndex) => {
    const words = chunk.en.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const step = size || words.length;
    for (let i = 0; i < words.length; i += step) {
      const part = words.slice(i, i + step);
      frames.push({ text: size ? part.join(' ') : chunk.en, chunk, wordCount: part.length, startWord, chunkIndex });
      startWord += part.length;
    }
  });
  return frames;
};
export const frameAtWord = (frames: DisplayFrame[], offset: number): number => {
  const index = frames.findIndex(frame => offset < frame.startWord + frame.wordCount);
  return index < 0 ? Math.max(0, frames.length - 1) : index;
};
export const frameTiming = (frame: DisplayFrame | undefined, wpm: number, delaySeconds: number, showTranslation: boolean) => {
  const speed = Number.isFinite(wpm) ? Math.min(160, Math.max(70, wpm)) : 110;
  const delayMs = showTranslation && !!frame?.chunk.jp.trim() ? Math.max(0, Math.min(7, Number.isFinite(delaySeconds) ? delaySeconds : 0)) * 1000 : 0;
  const readingMs = Math.max(300, (frame?.wordCount ?? 1) / speed * 60000);
  return { delayMs, readingMs, totalMs: delayMs + readingMs };
};
