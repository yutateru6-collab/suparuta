import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Upload, Cpu, History, Star, Trash2, Gauge, ArrowRight, Sparkles, FileText } from 'lucide-react';
import { type Chunk, type AppState } from './types';
import { parseReadingInput, getPromptSource } from './services/localParser';
import { buildChunkPrompt } from './services/chunkPrompt';
import { loadHistory, remember, HISTORY_KEY, type SavedItem } from './services/history';
import { ReaderCanvas } from './components/ReaderCanvas';
import { QuestReader } from './components/QuestReader';
import { QuestMascot } from './components/QuestMascot';
import { SpeedSelector } from './components/SpeedSelector';
import { Button } from './components/Button';
import { loadQuestProgress } from './services/quest';
import reviewedSample from './public/libraries-of-things.reviewed.json';
import { ChunkPreview } from './components/ChunkPreview';
import { useStoredState } from './services/useStoredState';
import { DRAFT_KEY, SETTINGS_KEY, SESSION_KEY, decodeDraft, decodeSettings, decodeSession, defaultSettings, type ViewedRange } from './services/readingState';

const AI_SITES = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
  { name: 'Claude', url: 'https://claude.ai/' },
] as const;

const App: React.FC = () => {
  const [experience,setExperience]=useState<'quest'|'classic'>(()=>{
    try{return localStorage.getItem('spartan_reader_experience')==='classic'?'classic':'quest';}catch{return 'quest';}
  });
  const [appState,setAppState]=useState<AppState>('INPUT');
  const [inputText,setInputText,draftWarning]=useStoredState(DRAFT_KEY,decodeDraft,'');
  const [settings,setSettings,settingsWarning]=useStoredState(SETTINGS_KEY,decodeSettings,defaultSettings());
  const [session,setSession,sessionWarning]=useStoredState(SESSION_KEY,decodeSession,null);
  const [resumePosition,setResumePosition]=useState<{wordOffset:number;viewed:ViewedRange[]}>({wordOffset:0,viewed:[]});
  const wpm=settings.wpm;
  const setWpm=(value:number)=>setSettings(previous=>({...previous,wpm:value}));
  const [chunks,setChunks]=useState<Chunk[]>([]);
  const [isLoading,setIsLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [copiedPrompt,setCopiedPrompt]=useState(false);
  const [isDragging,setIsDragging]=useState(false);
  const [isSpeedOpen,setIsSpeedOpen]=useState(true);
  const [isHistoryOpen,setIsHistoryOpen]=useState(false);
  const [initialHistory]=useState(loadHistory);
  const [questSummary,setQuestSummary]=useState(loadQuestProgress);
  const [savedItems,setSavedItems]=useState<SavedItem[]>(initialHistory.items);
  const [storageWarning,setStorageWarning]=useState(initialHistory.warning);
  const [historyDirty,setHistoryDirty]=useState(false);
  const [readerNotice,setReaderNotice]=useState('');
  const [promptFallback,setPromptFallback]=useState('');
  const fileInputRef=useRef<HTMLInputElement>(null);
  const copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const selectExperience=(next:'quest'|'classic')=>{
    setExperience(next);
    try{localStorage.setItem('spartan_reader_experience',next);}catch{/* The choice still works for this session. */}
  };
  useEffect(()=>()=>{if(copyTimer.current)clearTimeout(copyTimer.current);},[]);
  useEffect(()=>{
    if(!historyDirty||!initialHistory.writable)return;
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(savedItems));}
    catch{setStorageWarning('履歴を保存できませんでした。今回の学習は続けられますが、この画面を閉じると新しい履歴は失われます。');}
  },[savedItems,historyDirty,initialHistory.writable]);
  const copyAIPrompt=async()=>{
    setCopiedPrompt(false);setError(null);setPromptFallback('');let prompt='';
    try{
      prompt=buildChunkPrompt(getPromptSource(inputText));
      await navigator.clipboard.writeText(prompt);setCopiedPrompt(true);
      if(copyTimer.current)clearTimeout(copyTimer.current);
      copyTimer.current=setTimeout(()=>setCopiedPrompt(false),2000);
    }catch(err){
      if(prompt){setPromptFallback(prompt);setError('コピーが許可されませんでした。表示されたプロンプトを選択してコピーしてください。');}
      else setError(err instanceof Error?err.message:'プロンプトを作成できませんでした。');
    }
  };
  const handleFile=(file:File)=>{
    if(!/\.(json|txt)$/i.test(file.name)){setError('JSONまたはTXTファイルを選んでください。');return;}
    if(file.size>1024*1024){setError('ファイルが大きすぎます。1MB以下に分けてください。');return;}
    const reader=new FileReader();
    reader.onload=()=>{if(typeof reader.result==='string'){setInputText(reader.result);setError(null);}};
    reader.onerror=()=>setError('ファイルを読み込めませんでした。');reader.readAsText(file);
  };
  const handleProcess=()=>{
    if(!inputText.trim()){setError('英文を入力してください。');return;}
    setIsLoading(true);setError(null);setAppState('PROCESSING');
    try{
      const parsed=parseReadingInput(inputText);
      if(!parsed.chunks.length)throw new Error('表示できる英文がありません。');
      setReaderNotice(parsed.warnings.join(' '));
      setHistoryDirty(true);
      setSavedItems(prev=>remember(prev,{id:crypto.randomUUID(),text:inputText.trim(),wpm,mode:'local',timestamp:Date.now(),isFavorite:false}));
      setChunks(parsed.chunks);setAppState('READING');
      setResumePosition({wordOffset:0,viewed:[]});
      setSession({version:1,text:inputText,chunks:parsed.chunks,wordOffset:0,viewed:[],experience});
    }catch(err){setError(err instanceof Error?err.message:'入力を読み込めませんでした。');setAppState('INPUT');}
    finally{setIsLoading(false);}
  };
  const handleReset=useCallback(()=>{setAppState('INPUT');setChunks([]);setQuestSummary(loadQuestProgress());},[]);
  const handleFinish=useCallback(()=>setAppState('RESULT'),[]);
  const savePosition=useCallback((wordOffset:number,viewed:ViewedRange[])=>{
    setSession(previous=>previous?{...previous,wordOffset,viewed}:null);
  },[setSession]);
  const resumeReading=()=>{
    if(!session)return;
    setChunks(session.chunks);selectExperience(session.experience);
    setResumePosition({wordOffset:session.wordOffset,viewed:session.viewed});
    setReaderNotice('保存した位置から再開しました。');setAppState('READING');
  };
  const persistenceWarning=[draftWarning,settingsWarning,sessionWarning].filter(Boolean).join(' ');
  const savedControls=<div className="saved-reading-controls">
    {session&&<button type="button" className="control px-3" onClick={resumeReading}>前回の続きから読む</button>}
    <p>入力と学習設定はこの端末に自動保存されます。</p>
    {persistenceWarning&&<p role="status">{persistenceWarning}</p>}
  </div>;
  const loadSavedItem=(item:SavedItem)=>{setInputText(item.text);setWpm(item.wpm);setError(null);};
  const preview=(text:string)=>{try{return getPromptSource(text).slice(0,70);}catch{return text.slice(0,70);}};
  if(appState==='READING'||appState==='RESULT')return experience==='quest'
    ? <QuestReader chunks={chunks} settings={settings} onSettingsChange={setSettings} initialPosition={resumePosition} onPosition={savePosition} onFinish={handleFinish} onReset={handleReset} notice={[readerNotice,storageWarning,persistenceWarning].filter(Boolean).join(' ')}/>
    : <ReaderCanvas chunks={chunks} settings={settings} onSettingsChange={setSettings} initialPosition={resumePosition} onPosition={savePosition} onFinish={handleFinish} onReset={handleReset} notice={[readerNotice,storageWarning,persistenceWarning].filter(Boolean).join(' ')}/>;
  if(experience==='quest'){
    const record=questSummary;
    return <div className="quest-shell quest-home">
      <div className="quest-home-wrap">
        <header className="quest-home-header"><div className="quest-logo"><span className="quest-logo-mark">✦</span><span>SPARTAN <strong>QUEST</strong></span></div><button className="quest-classic-switch" onClick={()=>selectExperience('classic')}>クラシック表示に切り替える</button></header>
        <main>
          <section className="quest-hero">
            <div className="quest-hero-copy"><p className="quest-eyebrow">READING ADVENTURE · 英文読解</p><h1>英文を読んで、<br/><span>ことばの冒険へ。</span></h1><p className="quest-hero-description">意味のまとまりを一つずつ読んで、キャラと一緒にゴールを目指そう。読み切った英文が、あなたの冒険になる。</p><div className="quest-hero-tags"><span>✦ 自分の英文で遊べる</span><span>✦ 和訳付き教材にも対応</span></div></div>
            <div className="quest-hero-art" aria-hidden="true"><span className="quest-float quest-float-one">A</span><span className="quest-float quest-float-two">✦</span><span className="quest-float quest-float-three">GO!</span><div className="quest-hero-ring"><QuestMascot mood="happy" size="large" /></div><div className="quest-hero-ground" /></div>
          </section>
          <section className="quest-dashboard" aria-label="冒険の記録"><div><span className="quest-dash-icon">✦</span><p><strong>{record.progress.sparks}</strong><small>きらめき</small></p></div><div><span className="quest-dash-icon">★</span><p><strong>{record.progress.completed.length}</strong><small>クリアした英文</small></p></div><p className="quest-dashboard-caption">はじめの冒険を<br/>スタートしよう！</p></section>
          {record.warning&&<p role="status" className="quest-notice">{record.warning}</p>}
          <section className="quest-compose" aria-labelledby="quest-compose-title">
            <div className="quest-compose-title"><div><p className="quest-eyebrow">NEW MISSION</p><h2 id="quest-compose-title">英文をセット</h2><p>英文を貼るだけでスタート。JSON教材なら、和訳も一緒に表示できます。</p></div><span className="quest-compose-step">01 / 02</span></div>
            <label htmlFor="reading-input" className="quest-label"><FileText size={19}/> 英文テキスト</label>
            {savedControls}
            <div className={`quest-input-wrap ${isDragging?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)} onDrop={e=>{e.preventDefault();setIsDragging(false);if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);}}>
              <textarea id="reading-input" value={inputText} onChange={e=>setInputText(e.target.value)} disabled={isLoading} placeholder={'ここに英文を貼り付けよう！\n\n例：In many cities, libraries are changing their role...'} />
            </div>
            <div className="quest-input-actions"><button onClick={()=>fileInputRef.current?.click()}><Upload size={17}/> ファイルを選ぶ</button><input type="file" ref={fileInputRef} accept=".json,.txt" className="hidden" onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0]);e.target.value='';}}/><button onClick={()=>{setInputText(JSON.stringify(reviewedSample,null,2));setError(null);}}><Sparkles size={17}/> 校閲済みサンプルを入れる</button></div>
            <p className="quest-input-help">通常の英文は端末内の簡易ルールで分割し、和訳は付きません。意味チャンクと和訳を正確に使うには、確認済みのJSON教材を入力してください。</p>
            <ChunkPreview text={inputText} onApply={setInputText}/>
            <details className="quest-ai-tools"><summary><Cpu size={18}/> 和訳付き教材を作るためのプロンプト</summary><div><p>英文を入力してプロンプトをコピーし、外部AIでJSONを作成します。生成された英文の抜けと和訳は必ず確認してください。</p><button onClick={copyAIPrompt} className="quest-secondary">{copiedPrompt?'コピー完了！ ✓':'プロンプトコピー'}</button><div className="quest-ai-links">{AI_SITES.map(site=><a key={site.name} href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`${site.name}を開く`}>{site.name} ↗</a>)}</div></div></details>
            {promptFallback&&<textarea aria-label="手動コピー用プロンプト" readOnly value={promptFallback} onFocus={e=>e.currentTarget.select()} className="quest-prompt-fallback"/>}
            <div className="quest-start-settings"><div><p className="quest-eyebrow">SPEED</p><h3>読む速さ <strong>{wpm} WPM</strong></h3></div><SpeedSelector selectedWpm={wpm} onSelect={setWpm} variant="quest"/></div>
            {storageWarning&&<p role="status" className="quest-notice">{storageWarning}</p>}
            {error&&<p role="alert" className="quest-error">{error}</p>}
            <button className="quest-primary quest-start-button" onClick={handleProcess} disabled={!inputText.trim()||isLoading}>{isLoading?'準備中...':<>冒険をはじめる <ArrowRight size={23}/></>}</button>
          </section>
          {savedItems.length>0&&<section className="quest-history"><button onClick={()=>setIsHistoryOpen(!isHistoryOpen)} aria-expanded={isHistoryOpen}><History size={20}/> これまでの英文 ({savedItems.length}) <span>{isHistoryOpen?'閉じる':'開く'}</span></button>{isHistoryOpen&&<div className="quest-history-list">{savedItems.map(item=><div key={item.id}><button className="quest-history-item" onClick={()=>loadSavedItem(item)}><strong>{preview(item.text)}</strong><small>{item.wpm} WPM · {new Date(item.timestamp).toLocaleDateString('ja-JP')}</small></button><button aria-label={item.isFavorite?'お気に入りを解除':'お気に入りに登録'} aria-pressed={item.isFavorite} onClick={()=>{setHistoryDirty(true);setSavedItems(prev=>prev.map(row=>row.id===item.id?{...row,isFavorite:!row.isFavorite}:row));}}><Star size={19} fill={item.isFavorite?'currentColor':'none'}/></button><button aria-label="履歴を削除" onClick={()=>{setHistoryDirty(true);setSavedItems(prev=>prev.filter(row=>row.id!==item.id));}}><Trash2 size={19}/></button></div>)}</div>}</section>}
        </main><footer className="quest-home-footer">SPARTAN QUEST · 英文を、前から読める力に。</footer>
      </div>
    </div>;
  }
  return <div className="min-h-screen bg-spartan-black text-white px-4 py-8 sm:p-8 flex flex-col items-center justify-center font-sans"><div className="max-w-3xl w-full space-y-7">
    <button type="button" className="control px-4 text-sm mx-auto" onClick={()=>selectExperience('quest')}>✦ クエスト表示に切り替える</button>
    <header className="text-center space-y-3"><h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">SPARTAN <span className="text-spartan-neon">READER</span></h1><p className="text-gray-300">英文を前から、意味のまとまりごとに読む。</p></header>
    <section className="space-y-3">
      {savedControls}
      <div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor="reading-input" className="font-bold text-gray-200 flex items-center gap-2"><BookOpen size={18} className="text-spartan-neon"/>英文テキスト</label><div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>fileInputRef.current?.click()} className="control px-3 gap-2 text-sm"><Upload size={16}/>ファイル選択</button>
        <input type="file" ref={fileInputRef} accept=".json,.txt" className="hidden" onChange={e=>{if(e.target.files?.[0])handleFile(e.target.files[0]);e.target.value='';}}/>
        <button type="button" onClick={copyAIPrompt} className="control px-3 gap-2 text-sm"><Cpu size={16}/>{copiedPrompt?'コピー完了！ ✓':'プロンプトコピー'}</button>
        {AI_SITES.map(site=><a key={site.name} href={site.url} target="_blank" rel="noopener noreferrer" className="control px-3 text-sm" aria-label={`${site.name}を開く`}>{site.name}</a>)}
      </div></div>
      <div onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)} onDrop={e=>{e.preventDefault();setIsDragging(false);if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);}} className={`rounded-xl border-2 ${isDragging?'border-spartan-neon':'border-gray-700'} bg-spartan-gray`}>
        <textarea id="reading-input" value={inputText} onChange={e=>setInputText(e.target.value)} disabled={isLoading} placeholder="英文、または和訳付きJSONを貼り付けてください。JSON・TXTファイルも読み込めます。" className="w-full h-56 sm:h-64 bg-transparent p-4 rounded-xl text-lg text-white placeholder-gray-400 resize-y"/>
      </div>
      <button type="button" className="control px-3 text-sm" onClick={()=>{setInputText(JSON.stringify(reviewedSample,null,2));setError(null);}}>校閲済みサンプルを入れる</button>
      <p className="text-sm text-gray-300">通常の英文は簡易分割のみ。和訳付きで読むにはJSONを入力してください。</p>
      <ChunkPreview text={inputText} onApply={setInputText}/>
      {promptFallback&&<textarea aria-label="手動コピー用プロンプト" readOnly value={promptFallback} onFocus={e=>e.currentTarget.select()} className="w-full h-48 p-3 bg-spartan-gray text-white border border-gray-600 rounded-xl"/>}
    </section>
    <section className="rounded-xl border border-gray-700 overflow-hidden"><button type="button" onClick={()=>setIsSpeedOpen(!isSpeedOpen)} aria-expanded={isSpeedOpen} className="w-full px-4 py-3 flex justify-between gap-3 text-gray-200"><span className="flex items-center gap-2"><Gauge size={18}/>表示速度 ({wpm} WPM)</span><span>{isSpeedOpen?'閉じる':'開く'}</span></button>{isSpeedOpen&&<div className="p-3"><SpeedSelector selectedWpm={wpm} onSelect={setWpm}/></div>}</section>
    {savedItems.length>0&&<section className="rounded-xl border border-gray-700 overflow-hidden"><button type="button" onClick={()=>setIsHistoryOpen(!isHistoryOpen)} aria-expanded={isHistoryOpen} className="w-full px-4 py-3 flex justify-between gap-3 text-gray-200"><span className="flex items-center gap-2"><History size={18}/>学習履歴とお気に入り ({savedItems.length})</span><span>{isHistoryOpen?'閉じる':'開く'}</span></button>{isHistoryOpen&&<div className="p-3 space-y-2 max-h-80 overflow-y-auto">{savedItems.map(item=><div key={item.id} className="flex gap-2 items-center p-2 rounded-xl bg-spartan-gray">
      <button type="button" onClick={()=>loadSavedItem(item)} className="min-w-0 flex-1 text-left p-2"><p className="truncate text-base">{preview(item.text)}</p><p className="text-xs text-gray-300 mt-1">{item.wpm} WPM · {new Date(item.timestamp).toLocaleDateString('ja-JP')}</p></button>
      <button type="button" aria-label={item.isFavorite?'お気に入りを解除':'お気に入りに登録'} aria-pressed={item.isFavorite} className="control w-11 shrink-0" onClick={()=>{setHistoryDirty(true);setSavedItems(prev=>prev.map(row=>row.id===item.id?{...row,isFavorite:!row.isFavorite}:row));}}><Star size={18} fill={item.isFavorite?'currentColor':'none'}/></button>
      <button type="button" aria-label="履歴を削除" className="control w-11 shrink-0" onClick={()=>{setHistoryDirty(true);setSavedItems(prev=>prev.filter(row=>row.id!==item.id));}}><Trash2 size={18}/></button>
    </div>)}</div>}</section>}
    {storageWarning&&<p role="status" className="text-amber-200 text-sm">{storageWarning}</p>}
    {error&&<div role="alert" className="bg-spartan-red/10 border border-spartan-red/50 text-spartan-red p-4 rounded-lg">{error}</div>}
    <Button variant="neon" onClick={handleProcess} isLoading={isLoading} disabled={!inputText.trim()}>{isLoading?'処理中...':'チャンク読みを開始'}</Button>
  </div></div>;
};
export default App;
