import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Chunk } from '../types';
import { Play, Pause, RotateCcw, CheckCircle, Settings2, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { SpeedSelector } from './SpeedSelector';
import { makeFrames, frameAtWord, frameTiming } from '../services/readerModel';
interface ReaderCanvasProps { chunks: Chunk[]; wpm: number; onFinish: () => void; onReset: () => void; notice?: string }
type RevealMode = 'fade' | 'flash' | 'blur' | 'zoom';
export const ReaderCanvas: React.FC<ReaderCanvasProps> = ({ chunks, wpm, onFinish, onReset, notice }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [revealMode, setRevealMode] = useState<RevealMode>('fade');
  const [wordGroupSize, setWordGroupSize] = useState(0);
  const [dynamicWpm, setDynamicWpm] = useState(wpm);
  const [translationDelay, setTranslationDelay] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const frames = useMemo(() => makeFrames(chunks, wordGroupSize), [chunks, wordGroupSize]);
  const currentFrame = frames[frameIndex];
  const hasTranslation = chunks.some(chunk => chunk.jp.trim());
  const { delayMs, totalMs } = frameTiming(currentFrame, dynamicWpm, translationDelay, showTranslation);
  const resetClock = useCallback(() => { elapsedRef.current = 0; setElapsedMs(0); }, []);
  const jumpToFrame = useCallback((index: number) => { setIsPlaying(false); setIsFinished(false); setFrameIndex(Math.max(0, Math.min(frames.length - 1, index))); resetClock(); }, [frames.length, resetClock]);
  const finish = useCallback(() => { setIsPlaying(false); setIsFinished(true); onFinish(); }, [onFinish]);
  const nextFrame = useCallback(() => { if (frameIndex + 1 < frames.length) jumpToFrame(frameIndex + 1); else finish(); }, [frameIndex, frames.length, jumpToFrame, finish]);
  const restart = useCallback(() => { jumpToFrame(0); }, [jumpToFrame]);
  const togglePlay = useCallback(() => {
    if (!frames.length) return;
    if (isFinished) { setFrameIndex(0); setIsFinished(false); resetClock(); }
    setIsPlaying(playing => !playing);
  }, [isFinished, frames.length, resetClock]);
  // One clock drives translation and advancement; pauses preserve elapsed time.
  useEffect(() => {
    if (!isPlaying || !currentFrame || isFinished) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      elapsedRef.current += Math.max(0, now - last); last = now; setElapsedMs(elapsedRef.current);
      if (elapsedRef.current >= totalMs) { resetClock(); if (frameIndex + 1 < frames.length) setFrameIndex(frameIndex + 1); else finish(); }
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, currentFrame, isFinished, totalMs, frameIndex, frames.length, finish, resetClock]);
  useEffect(() => {
    const handleHidden = () => { if (document.hidden) setIsPlaying(false); };
    document.addEventListener('visibilitychange', handleHidden);
    return () => document.removeEventListener('visibilitychange', handleHidden);
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
      if (isSettingsOpen || isReviewOpen) return;
      if (event.code === 'Escape') { event.preventDefault(); onReset(); return; }
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      // Space activates a focused native button/link; do not double-trigger it.
      if (event.code === 'Space' && target?.closest('button,a')) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.code === 'ArrowLeft') { event.preventDefault(); jumpToFrame(frameIndex - 1); }
      if (event.code === 'ArrowRight') { event.preventDefault(); nextFrame(); }
      if (event.code === 'KeyR') { event.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [isSettingsOpen, isReviewOpen, frameIndex, jumpToFrame, nextFrame, togglePlay, onReset, restart]);
  const setGroupSize = (size: number) => {
    const word = currentFrame?.startWord ?? 0; const nextFrames = makeFrames(chunks, size);
    setWordGroupSize(size); setFrameIndex(frameAtWord(nextFrames, word)); setIsPlaying(false); setIsFinished(false); resetClock();
  };
  const changeTranslation = () => { setShowTranslation(value => !value); resetClock(); };
  const changeDelay = (delay: number) => { setTranslationDelay(delay); if (delay > 0) setShowTranslation(true); resetClock(); };
  const progress = isFinished ? 100 : frames.length ? (frameIndex + Math.min(1, elapsedMs / totalMs)) / frames.length * 100 : 0;
  if (!currentFrame) return <main className="p-6 text-white"><p role="alert">表示できる英文がありません。</p><Button onClick={onReset}>入力に戻る</Button></main>;
  return <div className="reader-shell bg-spartan-black text-white">
    <div role="progressbar" aria-label="読書の進み具合" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="h-1 shrink-0 bg-gray-800"><div className="h-full bg-spartan-neon" style={{ width: `${progress}%` }} /></div>
    <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
      <button className="control px-3" onClick={onReset}>入力に戻る</button>
      <div className="flex flex-wrap items-center gap-2">{hasTranslation && <>
        <button onClick={changeTranslation} aria-pressed={showTranslation} className="control px-3">日本語訳: {showTranslation ? 'ON' : 'OFF'}</button>
        <button onClick={() => changeDelay(translationDelay === 0 ? 2 : translationDelay === 7 ? 0 : translationDelay + 1)} className="control px-3">翻訳遅延: {translationDelay > 0 ? `${translationDelay}秒` : 'なし'}</button>
      </>}<span className="text-sm text-gray-300 tabular-nums" data-testid="frame-counter">{isFinished ? frames.length : frameIndex + 1} / {frames.length}</span></div>
    </header>
    {notice && <p className="px-4 pt-3 text-sm text-amber-200" role="status">{notice}</p>}
    <main className="reader-stage w-full max-w-5xl mx-auto text-center px-5 py-6 flex flex-col items-center justify-center gap-6">
      {isFinished ? <section className="space-y-5"><CheckCircle className="mx-auto text-spartan-neon" size={44} /><h1 className="text-3xl sm:text-4xl font-bold">トレーニング完了！</h1><p className="text-gray-300">読み終えた英文を振り返り、理解を確かめましょう。</p></section> : <>
        {currentFrame.chunk.speaker && <p className="text-spartan-neon text-base">{currentFrame.chunk.speaker}</p>}
        <h1 lang="en" data-testid="reader-text" key={`${frameIndex}-${wordGroupSize}-${revealMode}`} className={`reader-text w-full font-bold tracking-tight text-3xl sm:text-4xl lg:text-5xl leading-snug ${isPlaying ? `animate-reveal-${revealMode}` : ''}`}>{currentFrame.text}</h1>
        {hasTranslation && <div className="w-full min-h-16">{showTranslation && elapsedMs >= delayMs && <div data-testid="translation">{wordGroupSize > 0 && <p className="text-xs text-gray-400 mb-2">元のチャンク全体の訳</p>}<p lang="ja" className="text-xl sm:text-2xl leading-relaxed text-gray-200 break-words">{currentFrame.chunk.jp}</p></div>}</div>}
      </>}
    </main>
    <footer className="reader-controls px-4 pt-4 pb-5 border-t border-gray-800 shrink-0"><div className="max-w-2xl mx-auto space-y-3">
      {isFinished ? <Button variant="neon" onClick={restart}><RotateCcw size={20} />もう一度読む</Button> : <div className="flex items-center gap-2"><button className="control w-12 shrink-0" disabled={frameIndex === 0} onClick={() => jumpToFrame(frameIndex - 1)} aria-label="前のチャンク"><ArrowLeft /></button><Button variant="neon" onClick={togglePlay} className="flex-1 text-lg !px-3">{isPlaying ? <><Pause size={20} />一時停止</> : <><Play size={20} />{frameIndex === 0 ? 'スタート' : '再開'}</>}</Button><button className="control w-12 shrink-0" onClick={nextFrame} aria-label="次のチャンク"><ArrowRight /></button></div>}
      <div className="flex justify-center gap-3 flex-wrap"><button className="control px-4 gap-2" onClick={() => { setIsPlaying(false); setIsSettingsOpen(true); }}><Settings2 size={18} />表示・動作設定</button><button className="control px-4 gap-2" onClick={() => { setIsPlaying(false); setIsReviewOpen(true); }}><BookOpen size={18} />チャンク復習リスト</button></div>
      <p className="hidden sm:block text-center text-xs text-gray-400">Space: 再生・停止 ／ ← →: 前後へ ／ R: 最初へ ／ Esc: 入力に戻る</p>
    </div></footer>
    <Dialog open={isSettingsOpen} title="表示・動作設定" onClose={() => setIsSettingsOpen(false)}>
      <SpeedSelector selectedWpm={dynamicWpm} onSelect={value => { setDynamicWpm(value); resetClock(); }} />
      <fieldset className="space-y-2"><legend className="mb-2">表示単位</legend><div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{[0,1,2,3,4,5].map(size => <button className="control px-2" key={size} aria-pressed={wordGroupSize === size} onClick={() => setGroupSize(size)}>{size ? `${size}語` : 'チャンク'}</button>)}</div></fieldset>
      {hasTranslation && <fieldset className="space-y-2"><legend className="mb-2">日本語訳</legend><button className="control px-3" onClick={changeTranslation} aria-pressed={showTranslation}>訳を表示: {showTranslation ? 'ON' : 'OFF'}</button><div className="flex flex-wrap gap-2">{[0,2,3,4,5,6,7].map(delay => <button key={delay} className="control px-3" aria-pressed={translationDelay === delay} onClick={() => changeDelay(delay)}>{delay ? `${delay}秒` : '即時'}</button>)}</div><p className="text-sm text-gray-300">遅延は再生開始から数えます。訳がOFF、または訳のないチャンクには追加の待ち時間はありません。</p></fieldset>}
      <fieldset><legend className="mb-2">表示アニメーション</legend><div className="flex flex-wrap gap-2">{(['fade','flash','blur','zoom'] as const).map(mode => <button key={mode} onClick={() => setRevealMode(mode)} className="control px-3" aria-pressed={mode === revealMode}>{mode}</button>)}</div></fieldset>
      <p className="text-sm text-gray-300">表示単位を変えても、読んでいた単語を含む位置を保ちます。</p>
    </Dialog>
    <Dialog open={isReviewOpen} title={`チャンクふりかえり（全${frames.length}件）`} onClose={() => setIsReviewOpen(false)}>
      <p className="text-sm text-gray-300">選んだ位置で一時停止します。再開ボタンで続きを読めます。</p><div className="space-y-3" data-testid="review-rows">{isReviewOpen && frames.map((frame, index) => <button key={index} className="w-full text-left p-4 bg-spartan-black rounded-xl border border-gray-700 hover:border-spartan-neon space-y-2" onClick={() => { jumpToFrame(index); setIsReviewOpen(false); }}><p className="text-xs text-spartan-neon">{index + 1}</p><p lang="en" className="text-lg break-words">{frame.text}</p>{frame.chunk.jp && <p className="text-base text-gray-300 break-words">{wordGroupSize > 0 ? '元チャンクの訳：' : ''}{frame.chunk.jp}</p>}</button>)}</div>
    </Dialog>
  </div>;
};
