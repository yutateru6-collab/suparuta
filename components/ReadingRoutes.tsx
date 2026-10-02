import React, { useState } from 'react';
import { BookOpen, Copy, PencilLine } from 'lucide-react';
import type { ReadingSample } from '../types';

interface Props { samples: ReadingSample[]; createTools: React.ReactNode }

export const ReadingRoutes: React.FC<Props> = ({ samples, createTools }) => {
  const [route, setRoute] = useState<'sample' | 'create'>('sample');
  const [sampleId, setSampleId] = useState(samples[0]?.id ?? '');
  const [copyResult, setCopyResult] = useState<{ id: string; ok: boolean } | null>(null);
  const sample = samples.find(item => item.id === sampleId) ?? samples[0];
  const json = sample ? JSON.stringify(sample.chunks, null, 2) : '';
  const copied = copyResult?.id === sample?.id && copyResult?.ok;
  const copyFailed = copyResult?.id === sample?.id && !copyResult?.ok;
  const copySample = async () => {
    if (!sample) return;
    const id = sample.id;
    try { await navigator.clipboard.writeText(json); setCopyResult({ id, ok: true }); }
    catch { setCopyResult({ id, ok: false }); }
  };

  return <section className="quest-reading-routes" aria-labelledby="reading-routes-title">
    <p className="quest-eyebrow">CHOOSE YOUR NEXT READ</p>
    <h2 id="reading-routes-title">今日は、どこから始める？</h2>
    <div className="quest-route-choices" aria-label="教材の準備方法">
      <button type="button" aria-pressed={route === 'sample'} onClick={() => setRoute('sample')}><BookOpen size={22}/><span><strong>サンプルを試す</strong><small>和訳付きの雑学を選ぶ</small></span></button>
      <button type="button" aria-pressed={route === 'create'} onClick={() => setRoute('create')}><PencilLine size={22}/><span><strong>自分の英文で作る</strong><small>好きな英文を教材にする</small></span></button>
    </div>
    {route === 'sample' ? <div className="quest-sample-panel">
      <p>① 雑学を選ぶ → ② JSONをコピー → ③ 下の入力欄に貼り付けてスタート。</p>
      <label htmlFor="reading-sample">読んでみたい雑学</label>
      <select id="reading-sample" value={sample?.id ?? ''} onChange={event => { setSampleId(event.target.value); setCopyResult(null); }}>
        {samples.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      {sample && <>
        <div className="quest-sample-heading"><div><h3>{sample.title}</h3><p>{sample.description}</p></div><span>{sample.category} · {sample.wordCount}語</span></div>
        <div className="quest-sample-preview" aria-label="英文と和訳のプレビュー">
          <small>{sample.chunks.length}チャンクのうち、最初の表示</small>
          <p lang="en">{sample.chunks[0].en}</p><p lang="ja">{sample.chunks[0].jp}</p>
        </div>
        <div className="quest-sample-actions"><button type="button" className="quest-primary" onClick={copySample}><Copy size={18}/>{copied ? 'JSONをコピーしました' : 'サンプルJSONをコピー'}</button><a href="#reading-input" className="quest-secondary" onClick={() => document.getElementById('reading-input')?.focus()}>入力欄へ</a></div>
        {copied && <p role="status">下の「英文テキスト」に貼り付けて、「冒険をはじめる」を押してください。</p>}
        {copyFailed && <p role="alert">コピーを利用できませんでした。下のJSONを選択して手動でコピーしてください。</p>}
        <details className="quest-sample-json" open={copyFailed || undefined}><summary>JSONを表示・手動でコピー</summary><textarea aria-label="サンプルJSON" readOnly value={json} onFocus={event => event.currentTarget.select()} spellCheck={false}/></details>
        <details className="quest-sample-all"><summary>全チャンクの英文・和訳を確認</summary><ol>{sample.chunks.map((chunk, index) => <li key={index}><p lang="en">{chunk.en}</p><p lang="ja">{chunk.jp}</p></li>)}</ol></details>
        <p className="quest-small-note">プレビューはチャンク単位です。読書画面では保存済みの表示設定を引き継ぎます。「日本語訳」をONにすると訳を表示でき、表示単位や訳の遅延は「表示設定」で変更できます。</p>
        <details className="quest-sample-sources"><summary>この雑学の参考資料</summary><ul>{sample.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>)}</ul></details>
      </>}
    </div> : <div className="quest-create-panel">
      <h3>好きな英文を、和訳付きの教材に。</h3>
      <ol><li>下の入力欄に、読みたい英文を貼り付ける。</li><li>変換プロンプトをコピーし、利用中の外部AIへ貼り付ける。</li><li>出力されたJSONの英文・和訳を確認して、入力欄へ貼り戻す。</li><li>「冒険をはじめる」で読む。</li></ol>
      <p>このアプリは自動でAIに送信しません。外部AIはご自身の利用条件で使います。生成結果には誤りがあり得るため、原文の抜けや和訳の対応を確認してください。</p>
      {createTools}
      <p className="quest-small-note">英文だけでも読めます。その場合は端末内で簡易分割し、和訳は付きません。</p>
    </div>}
  </section>;
};
