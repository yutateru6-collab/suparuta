import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Gift, Languages, Pause, Play, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import type { Chunk } from '../types';
import { makeFrames, frameAtWord, frameTiming } from '../services/readerModel';
import { finishQuest, loadQuestProgress, QUEST_PROGRESS_KEY, questId, questSections, sectionAtChunk } from '../services/quest';
import { Dialog } from './Dialog';
import { QuestMascot } from './QuestMascot';
import { SpeedSelector } from './SpeedSelector';

interface Props { chunks: Chunk[]; wpm: number; onFinish: () => void; onReset: () => void; notice?: string }
type RevealMode = 'fade' | 'flash' | 'blur' | 'zoom';
const PARTICLES = Array.from({ length: 14 }, (_, index) => index);

export const QuestReader: React.FC<Props> = ({ chunks, wpm, onFinish, onReset, notice }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationDelay, setTranslationDelay] = useState(0);
  const [dynamicWpm, setDynamicWpm] = useState(wpm);
  const [wordGroupSize, setWordGroupSize] = useState(0);
  const [revealMode, setRevealMode] = useState<RevealMode>('fade');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkpoint, setCheckpoint] = useState<number | null>(null);
  const [clearedCheckpoints, setClearedCheckpoints] = useState<Set<number>>(() => new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [initialProgress] = useState(loadQuestProgress);
  const [questProgress, setQuestProgress] = useState(initialProgress.progress);
  const [storageWarning, setStorageWarning] = useState(initialProgress.warning);
  const [earned, setEarned] = useState(0);
  const elapsedRef = useRef(0);
  const resumeAfterCheckpoint = useRef(false);
  const checkpointButton = useRef<HTMLButtonElement>(null);
  const frames = useMemo(() => makeFrames(chunks, wordGroupSize), [chunks, wordGroupSize]);
  const sectionEnds = useMemo(() => questSections(chunks), [chunks]);
  const missionId = useMemo(() => questId(chunks), [chunks]);
  const frame = frames[frameIndex];
  const hasTranslation = chunks.some(chunk => chunk.jp.trim());
  const { delayMs, totalMs } = frameTiming(frame, dynamicWpm, translationDelay, showTranslation);
  const section = sectionAtChunk(sectionEnds, frame?.chunkIndex ?? 0);
  const progress = isFinished ? 100 : frames.length ? (frameIndex + Math.min(1, elapsedMs / totalMs)) / frames.length * 100 : 0;
  const resetClock = useCallback(() => { elapsedRef.current = 0; setElapsedMs(0); }, []);

  const finish = useCallback(() => {
    setIsPlaying(false); setIsFinished(true); resetClock();
    const result = finishQuest(questProgress, missionId);
    setEarned(result.earned);
    if (result.earned) {
      setQuestProgress(result.progress);
      if (initialProgress.writable) {
        try { localStorage.setItem(QUEST_PROGRESS_KEY, JSON.stringify(result.progress)); }
        catch { setStorageWarning('今回の冒険の記録を保存できませんでした。読書は続けられます。'); }
      }
    }
    onFinish();
  }, [questProgress, missionId, initialProgress.writable, onFinish, resetClock]);

  const jumpToFrame = useCallback((index: number) => {
    setIsPlaying(false); setIsFinished(false); setCheckpoint(null);
    setFrameIndex(Math.max(0, Math.min(frames.length - 1, index))); resetClock();
  }, [frames.length, resetClock]);

  const advance = useCallback((fromPlayback = false) => {
    if (frameIndex + 1 >= frames.length) { finish(); return; }
    const next = frames[frameIndex + 1];
    if (frame && next.chunkIndex > frame.chunkIndex && sectionEnds[section] === frame.chunkIndex &&
      section < sectionEnds.length - 1 && !clearedCheckpoints.has(section)) {
      resumeAfterCheckpoint.current = fromPlayback;
      setIsPlaying(false); setCheckpoint(section); resetClock();
      return;
    }
    setFrameIndex(frameIndex + 1); resetClock();
  }, [frameIndex, frames, frame, sectionEnds, section, clearedCheckpoints, finish, resetClock]);

  const continueCheckpoint = () => {
    if (checkpoint === null) return;
    setClearedCheckpoints(previous => new Set(previous).add(checkpoint));
    setCheckpoint(null); setFrameIndex(index => Math.min(frames.length - 1, index + 1));
    resetClock(); setIsPlaying(resumeAfterCheckpoint.current);
  };

  useEffect(() => { if (checkpoint !== null) checkpointButton.current?.focus(); }, [checkpoint]);
  useEffect(() => {
    if (!isPlaying || !frame || isFinished || checkpoint !== null) return;
    let animation = 0; let last = performance.now();
    const tick = (now: number) => {
      elapsedRef.current += Math.max(0, now - last); last = now;
      setElapsedMs(elapsedRef.current);
      if (elapsedRef.current >= totalMs) advance(true);
      else animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [isPlaying, frame, isFinished, checkpoint, totalMs, advance]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) setIsPlaying(false); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  const restart = useCallback(() => {
    jumpToFrame(0); setClearedCheckpoints(new Set()); setEarned(0);
  }, [jumpToFrame]);
  const togglePlay = useCallback(() => {
    if (!frames.length || checkpoint !== null) return;
    if (isFinished) { restart(); setIsPlaying(true); }
    else setIsPlaying(value => !value);
  }, [frames.length, checkpoint, isFinished, restart]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat || settingsOpen || reviewOpen || checkpoint !== null) return;
      if (event.code === 'Escape') { event.preventDefault(); onReset(); return; }
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      if (event.code === 'Space' && target?.closest('button,a')) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (event.code === 'ArrowLeft') { event.preventDefault(); jumpToFrame(frameIndex - 1); }
      if (event.code === 'ArrowRight') { event.preventDefault(); advance(false); }
      if (event.code === 'KeyR') { event.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [settingsOpen, reviewOpen, checkpoint, frameIndex, onReset, togglePlay, jumpToFrame, advance, restart]);

  const setGroupSize = (size: number) => {
    const word = frame?.startWord ?? 0;
    setWordGroupSize(size); setFrameIndex(frameAtWord(makeFrames(chunks, size), word));
    setIsPlaying(false); setCheckpoint(null); setIsFinished(false); resetClock();
  };
  const changeDelay = (seconds: number) => {
    setTranslationDelay(seconds); if (seconds > 0) setShowTranslation(true); resetClock();
  };
  if (!frame) return <main className="p-6"><p role="alert">表示できる英文がありません。</p><button onClick={onReset}>入力に戻る</button></main>;

  return <div className="quest-shell quest-reader-shell">
    <div className="quest-reader-wrap">
      <header className="quest-reader-top">
        <button className="quest-back" onClick={onReset}>← 入力に戻る</button>
        <span className="quest-mini-brand">SPARTAN <strong>QUEST</strong></span>
        <span className="quest-spark-count" aria-label={`きらめき ${questProgress.sparks} 個`}><Sparkles size={17} /> {questProgress.sparks}</span>
      </header>
      <section className="quest-route" aria-label="冒険の進み具合">
        <div className="quest-route-heading"><span>READING ADVENTURE</span><strong>{isFinished ? 'ゴール！' : `ステージ ${section + 1} / ${sectionEnds.length}`}</strong></div>
        <div className="quest-route-track" role="progressbar" aria-label="読書の進み具合" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="quest-route-fill" style={{ width: `${progress}%` }} />
          <span className="quest-route-runner" style={{ left: `${Math.min(97, Math.max(3, progress))}%` }}><QuestMascot mood={isFinished ? 'happy' : isPlaying ? 'reading' : 'ready'} /></span>
          {sectionEnds.slice(0, -1).map((end, index) => <span key={end} className={`quest-route-stop ${section > index || isFinished ? 'is-done' : ''}`} style={{ left: `${(end + 1) / chunks.length * 100}%` }} aria-hidden="true">★</span>)}
        </div>
        <div className="quest-route-caption"><span>START</span><span>GOAL ✦</span></div>
      </section>
      {[notice, storageWarning].filter(Boolean).map(message => <p key={message} className="quest-notice" role="status">{message}</p>)}
      <main className="quest-reader-main">
        {checkpoint !== null ? <section className="quest-event-card" aria-labelledby="checkpoint-title" data-testid="quest-checkpoint">
          <div className="quest-particles" aria-hidden="true">{PARTICLES.map(i => <i key={i} style={{ '--piece': i } as React.CSSProperties} />)}</div>
          <div className="quest-treasure" aria-hidden="true"><Gift size={31}/><span>★</span></div>
          <QuestMascot mood="happy" size="large" />
          <p className="quest-eyebrow">CHECKPOINT {checkpoint + 1}</p>
          <h1 id="checkpoint-title">ここまで読めた！</h1>
          <p>星を見つけたよ。意味があやふやなら、少し戻って読み直そう。</p>
          <div className="quest-event-actions"><button ref={checkpointButton} className="quest-primary" onClick={continueCheckpoint}>つづきを読む <ArrowRight size={20} /></button><button className="quest-secondary" onClick={() => jumpToFrame(Math.max(0, frameIndex - 2))}>少し戻る</button></div>
        </section> : isFinished ? <section className="quest-event-card quest-finish" aria-labelledby="finish-title" data-testid="quest-finish">
          <div className="quest-particles" aria-hidden="true">{PARTICLES.map(i => <i key={i} style={{ '--piece': i } as React.CSSProperties} />)}</div>
          <QuestMascot mood="happy" size="large" />
          <p className="quest-eyebrow">MISSION CLEAR!</p>
          <h1 id="finish-title">読書の冒険、クリア！</h1>
          <p>{earned ? `初回クリアで、きらめき +${earned}！` : 'この英文はクリア済み。読み直しも大切な冒険！'}</p>
          <p className="quest-small-note">この報酬は読了の記録です。英文の理解度を採点したものではありません。</p>
          <div className="quest-event-actions"><button className="quest-primary" onClick={restart}><RotateCcw size={19} /> もう一度読む</button><button className="quest-secondary" onClick={onReset}>別の英文へ</button></div>
        </section> : <section className="quest-reading-card" aria-label="英文表示">
          <div className="quest-card-top"><span className="quest-card-chip">✦ ことばの道</span><span className="quest-frame-count" data-testid="quest-frame-counter">{frameIndex + 1} / {frames.length}</span></div>
          <div className="quest-reading-content">
            {frame.chunk.speaker && <p className="quest-speaker">{frame.chunk.speaker}</p>}
            <h1 lang="en" data-testid="quest-reader-text" key={`${frameIndex}-${wordGroupSize}-${revealMode}`} className={`quest-english ${isPlaying ? `animate-reveal-${revealMode}` : ''}`}>{frame.text}</h1>
            {hasTranslation && <div className="quest-translation-slot">{showTranslation && elapsedMs >= delayMs && <div data-testid="quest-translation" className="quest-translation">{wordGroupSize > 0 && <small>元のチャンク全体の訳</small>}<p lang="ja">{frame.chunk.jp}</p></div>}</div>}
          </div>
          <div className="quest-card-bottom"><span>読んで、少しずつ進もう</span><span aria-hidden="true">✦ ✦ ✦</span></div>
        </section>}
      </main>
      <footer className="quest-reader-footer">
        {checkpoint === null && !isFinished && <div className="quest-playback">
          <button aria-label="前のチャンク" className="quest-step" disabled={frameIndex === 0} onClick={() => jumpToFrame(frameIndex - 1)}><ArrowLeft /></button>
          <button className="quest-primary quest-play" onClick={togglePlay}>{isPlaying ? <><Pause size={21} /> 一時停止</> : <><Play size={21} /> {frameIndex === 0 ? 'スタート' : '再開'}</>}</button>
          <button aria-label="次のチャンク" className="quest-step" onClick={() => advance(false)}><ArrowRight /></button>
        </div>}
        <div className="quest-reader-tools">
          {hasTranslation && <button className="quest-tool" aria-pressed={showTranslation} onClick={() => { setShowTranslation(value => !value); resetClock(); }}><Languages size={16} /> 日本語訳 {showTranslation ? 'ON' : 'OFF'}</button>}
          <button className="quest-tool" onClick={() => { setIsPlaying(false); setSettingsOpen(true); }}><Settings2 size={17} /> 表示設定</button>
          <button className="quest-tool" onClick={() => { setIsPlaying(false); setReviewOpen(true); }}><BookOpen size={17} /> 復習リスト</button>
        </div>
      </footer>
    </div>
    <Dialog open={settingsOpen} title="冒険の表示設定" onClose={() => setSettingsOpen(false)}>
      <SpeedSelector selectedWpm={dynamicWpm} onSelect={value => { setDynamicWpm(value); resetClock(); }} variant="quest" />
      <fieldset><legend>表示単位</legend><div className="quest-options">{[0, 1, 2, 3, 4, 5].map(size => <button className="quest-option" key={size} aria-pressed={wordGroupSize === size} onClick={() => setGroupSize(size)}>{size ? `${size}語` : 'チャンク'}</button>)}</div></fieldset>
      {hasTranslation && <fieldset><legend>日本語訳の遅延</legend><div className="quest-options">{[0, 2, 3, 4, 5, 6, 7].map(seconds => <button className="quest-option" key={seconds} aria-pressed={translationDelay === seconds} onClick={() => changeDelay(seconds)}>{seconds ? `${seconds}秒` : 'なし'}</button>)}</div><p className="quest-small-note">訳を表示している時だけ、再生中に遅延を数えます。</p></fieldset>}
      <fieldset><legend>登場アニメーション</legend><div className="quest-options">{(['fade', 'flash', 'blur', 'zoom'] as const).map(mode => <button className="quest-option" key={mode} aria-pressed={revealMode === mode} onClick={() => setRevealMode(mode)}>{mode}</button>)}</div></fieldset>
    </Dialog>
    <Dialog open={reviewOpen} title="チャンク復習リスト" onClose={() => setReviewOpen(false)}>
      <p>選んだ位置で一時停止します。</p><div className="quest-review-list">{reviewOpen && frames.map((item, index) => <button key={index} onClick={() => { jumpToFrame(index); setReviewOpen(false); }}><strong>{index + 1}</strong><span lang="en">{item.text}</span>{item.chunk.jp && <small lang="ja">{wordGroupSize ? '元チャンクの訳：' : ''}{item.chunk.jp}</small>}</button>)}</div>
    </Dialog>
  </div>;
};
