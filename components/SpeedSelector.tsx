import React from 'react';
import { Minus, Plus, Gauge } from 'lucide-react';
interface SpeedSelectorProps { selectedWpm: number; onSelect: (wpm: number) => void }
export const SpeedSelector: React.FC<SpeedSelectorProps> = ({ selectedWpm, onSelect }) => {
  const presets = [{label:'ゆっくり (70)',value:70},{label:'標準 (110)',value:110},{label:'高速 (160)',value:160}];
  return <div className="bg-spartan-gray/50 border border-gray-800 p-4 rounded-xl space-y-4 w-full">
    <div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-300 flex items-center gap-1.5"><Gauge size={16} className="text-spartan-neon" />表示速度 (WPM)</span><span className="text-2xl font-black text-spartan-neon font-mono">{selectedWpm}</span></div>
    <div className="flex items-center gap-3"><button type="button" onClick={()=>onSelect(Math.max(70,selectedWpm-10))} disabled={selectedWpm<=70} className="control w-11 shrink-0" title="速度を10下げる（遅くする）"><Minus size={18}/></button><div className="flex-1 px-1"><input type="range" aria-label="表示速度（WPM）" min={70} max={160} step={10} value={selectedWpm} onChange={e=>onSelect(Number(e.target.value))} className="w-full h-2.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-spartan-neon"/><div className="flex justify-between text-xs text-gray-400 mt-1"><span>70</span><span>110</span><span>160</span></div></div><button type="button" onClick={()=>onSelect(Math.min(160,selectedWpm+10))} disabled={selectedWpm>=160} className="control w-11 shrink-0" title="速度を10上げる（速くする）"><Plus size={18}/></button></div>
    <div className="grid grid-cols-3 gap-2">{presets.map(preset=><button key={preset.value} type="button" onClick={()=>onSelect(preset.value)} aria-pressed={selectedWpm===preset.value} className="control min-h-11 px-2 text-xs">{preset.label}</button>)}</div>
  </div>;
};
