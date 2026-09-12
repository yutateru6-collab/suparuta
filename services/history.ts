export const HISTORY_KEY = 'spartan_reader_history';
export interface SavedItem { id: string; text: string; wpm: number; mode: 'ai' | 'local'; timestamp: number; isFavorite: boolean }
export const decodeHistory = (raw: string | null): SavedItem[] => {
  if (raw === null) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('履歴の形式が不正です。');
  if (!data.every(row => row && typeof row.id === 'string' && typeof row.text === 'string' && typeof row.wpm === 'number' && Number.isFinite(row.wpm) && typeof row.timestamp === 'number' && Number.isFinite(row.timestamp) && typeof row.isFavorite === 'boolean' && ['ai', 'local'].includes(row.mode))) throw new Error('読み込めない履歴があります。');
  return data.map(row => ({ ...row, wpm: Math.max(70, Math.min(160, row.wpm)) }));
};
export const loadHistory = (): { items: SavedItem[]; writable: boolean; warning: string | null } => {
  try { return { items: decodeHistory(localStorage.getItem(HISTORY_KEY)), writable: true, warning: null }; }
  catch { return { items: [], writable: false, warning: '保存履歴を読み込めませんでした。既存データは上書きせず、この画面内で学習を続けます。' }; }
};
export const remember = (items: SavedItem[], next: SavedItem): SavedItem[] => {
  const existing = items.find(item => item.text.trim() === next.text.trim());
  const updated = [{ ...next, id: existing?.id ?? next.id, isFavorite: existing?.isFavorite ?? next.isFavorite }, ...items.filter(item => item.text.trim() !== next.text.trim())];
  let regular = 0;
  return updated.filter(item => item.isFavorite || regular++ < 15);
};
