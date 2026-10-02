export interface Chunk {
  en: string;
  jp: string;
  speaker?: string | null;
}

export interface ReadingSample {
  id: string;
  title: string;
  englishTitle: string;
  description: string;
  category: string;
  wordCount: number;
  sourceText: string;
  chunks: Chunk[];
  sources: { title: string; url: string }[];
}

export enum WPM {
  SLOW = 70,
  NORMAL = 110,
  FAST = 160,
}

export type AppState = 'INPUT' | 'PROCESSING' | 'READING' | 'RESULT';

export interface ReadingConfig {
  wpm: number;
  text: string;
}
