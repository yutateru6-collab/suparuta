import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { parseReadingInput } from '../services/localParser';

export const ChunkPreview: React.FC<{ text: string; onApply: (text: string) => void }> = ({ text, onApply }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [structured, setStructured] = useState(false);
  const [error, setError] = useState('');
  const preview = () => {
    setError('');
    try {
      const { chunks } = parseReadingInput(text);
      const json = chunks.some(chunk => chunk.jp || chunk.speaker);
      setStructured(json);
      setDraft(json ? JSON.stringify(chunks, null, 2) : chunks.map(chunk => chunk.en).join('\n'));
      setOpen(true);
    } catch (err) { setError(err instanceof Error ? err.message : '分割を確認できませんでした。'); }
  };
  const apply = () => {
    try {
      const input = structured ? draft : JSON.stringify(draft.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
      const { chunks } = parseReadingInput(input);
      if (!chunks.length) throw new Error('英文を入力してください。');
      onApply(JSON.stringify(chunks, null, 2)); setOpen(false); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : '分割を適用できませんでした。'); }
  };
  return <div className="chunk-preview">
    <button type="button" className="control px-3" disabled={!text.trim()} onClick={preview}>分割プレビュー・調整</button>
    {!open && error && <p role="alert">{error}</p>}
    <Dialog open={open} title="分割プレビュー" onClose={() => setOpen(false)}>
      <p>{structured ? 'JSONのenとjpが同じ範囲を指すように調整してください。話者も保持されます。' : '1行が1チャンクです。改行を追加・削除して、意味のまとまりを調整してください。'}</p>
      <p>自動分割は簡易ルールです。12語は目安で、構文や訳の正確さは保証しません。</p>
      <textarea aria-label="分割を調整" value={draft} onChange={event => setDraft(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button type="button" className="control px-3" onClick={apply}>この分割を入力に反映</button>
    </Dialog>
  </div>;
};
