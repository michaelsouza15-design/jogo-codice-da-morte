import React, { useState, useEffect } from 'react';
import { soundEngine } from '../utils/soundEngine';
import { Sliders, X, Sun, Moon, Zap, Volume2, Info, LogOut, ShieldAlert } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInRoom?: boolean;
  onLeaveRoom?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isInRoom = false, onLeaveRoom }) => {
  const [activeTab, setActiveTab] = useState<'VISUAL' | 'AUDIO'>('VISUAL');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('codice_theme') as any) || 'dark');
  const [contrast, setContrast] = useState<number>(() => parseInt(localStorage.getItem('codice_contrast') || '100'));
  const [musicVol, setMusicVol] = useState(0.45);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    document.documentElement.style.filter = `contrast(${contrast}%)`;
    if (theme === 'light') document.body.classList.add('theme-light');
    else document.body.classList.remove('theme-light');
    localStorage.setItem('codice_theme', theme);
    localStorage.setItem('codice_contrast', contrast.toString());
  }, [contrast, theme]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-gradient-to-b from-[#1a0c08] to-[#0a0504] border-2 border-amber-900/60 rounded-[2.5rem] flex flex-col shadow-2xl relative overflow-hidden">

        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500/40 flex items-center justify-center"><Sliders className="w-6 h-6 text-amber-500" /></div>
             <h2 className="text-lg font-black text-white uppercase tracking-widest">Ajustes</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>

        <div className="flex p-1 gap-1 bg-black/40 border-b border-white/5 shrink-0">
           {(['VISUAL', 'AUDIO'] as const).map(t => (
             <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-amber-600 text-black shadow-lg' : 'text-zinc-500'}`}>{t}</button>
           ))}
        </div>

        <div className="p-6 space-y-6">
           {activeTab === 'VISUAL' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                   <div className="flex items-center gap-3">
                      {theme === 'dark' ? <Moon className="w-5 h-5 text-amber-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                      <span className="text-xs font-bold text-white uppercase">{theme === 'dark' ? 'Modo Gótico' : 'Modo Claro'}</span>
                   </div>
                   <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); soundEngine.playClick(); }} className="px-4 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-400 text-[10px] font-black uppercase">Mudar</button>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between px-1"><span className="text-xs font-black text-amber-200 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4" /> Contraste</span><span className="font-mono text-xs text-amber-500 font-bold">{contrast}%</span></div>
                   <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
             </div>
           )}

           {activeTab === 'AUDIO' && (
             <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between text-[10px] font-black text-amber-500 uppercase px-1"><span>Volume Geral</span> <span>{Math.round(musicVol * 100)}%</span></div>
                <input type="range" min="0" max="1" step="0.05" value={musicVol} onChange={(e) => { setMusicVol(parseFloat(e.target.value)); soundEngine.setMusicVolume(parseFloat(e.target.value)); }} className="w-full accent-amber-500" />
             </div>
           )}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20 flex flex-col gap-3">
           {isInRoom && (
             <button onClick={() => setConfirmLeave(true)} className="w-full py-3.5 rounded-2xl bg-red-950 text-red-400 border border-red-900 font-black text-xs uppercase hover:bg-red-900 hover:text-white transition-all">Sair da Partida</button>
           )}
           <button onClick={onClose} className="w-full py-4 rounded-2xl bg-amber-600 text-black font-black text-xs uppercase tracking-widest shadow-lg">Fechar</button>
        </div>

        {confirmLeave && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-8 text-center space-y-6">
             <div className="w-14 h-14 rounded-2xl bg-red-950 border border-red-500 flex items-center justify-center"><ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" /></div>
             <h3 className="text-lg font-black text-white uppercase">Abandonar o Códice?</h3>
             <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmLeave(false)} className="flex-1 py-4 rounded-2xl bg-zinc-900 text-white font-black uppercase text-xs">Ficar</button>
                <button onClick={() => { soundEngine.playClick(); onLeaveRoom?.(); onClose(); }} className="flex-1 py-4 rounded-2xl bg-red-700 text-white font-black uppercase text-xs">Sair</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
