import React, { useState, useEffect } from 'react';
import { getCharacterById } from '../data/gameData';
import { GothicAvatar } from './GothicAvatar';
import { soundEngine } from '../utils/soundEngine';
import {
  loadProgression,
  getXpRequiredForLevel,
  PlayerProgression,
} from '../utils/progression';
import codiceMorteLivroImg from '../assets/images/codice_morte_livro_1787918785943.jpg';
import codiceEmblemaCaveiraImg from '../assets/images/codice_emblema_caveira_1787918811337.jpg';
import {
  Play,
  Users,
  Zap,
  BookOpen,
  Layers,
  Bell,
  Gift,
  Settings,
  Home,
  User,
  ShoppingBag,
} from 'lucide-react';

interface HomeScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  selectedCharId: string;
  setSelectedCharId: (id: string) => void;
  onQuickPlaySolo: () => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  onOpenCharacters: () => void;
  onOpenGrimoire: () => void;
  onOpenCollection: () => void;
  onOpenShop: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  playerName,
  selectedCharId,
  onQuickPlaySolo,
  onOpenCreateRoom,
  onOpenJoinRoom,
  onOpenCharacters,
  onOpenGrimoire,
  onOpenCollection,
  onOpenShop,
  onOpenProfile,
  onOpenNotifications,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'lobby' | 'colecao' | 'grimorio' | 'perfil' | 'loja'>('lobby');
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const currentChar = getCharacterById(selectedCharId);

  useEffect(() => {
    const handleUpdate = () => setProgression(loadProgression());
    window.addEventListener('codice_progression_updated', handleUpdate);
    return () => window.removeEventListener('codice_progression_updated', handleUpdate);
  }, []);

  const reqXp = getXpRequiredForLevel(progression.level);
  const xpPercent = Math.min(100, Math.max(0, Math.round((progression.xp / reqXp) * 100)));

  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center text-[#e8dfd8] overflow-hidden select-none bg-black">

      {/* Background - Original Gothic Study */}
      <div className="absolute inset-0 z-0">
        <img
          src={codiceMorteLivroImg}
          alt="Gothic Library"
          className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-125 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
      </div>

      {/* TOP BAR: FIXED PROFILE & ICONS (MATCHES STABLE VERSION) */}
      <header className="relative z-30 w-full px-6 pt-6 flex items-center justify-between shrink-0">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-3 p-1 pr-5 rounded-full bg-black/60 border-2 border-amber-600/40 backdrop-blur-md cursor-pointer hover:border-amber-400 transition-all shadow-lg"
        >
           <div className="relative w-11 h-11 sm:w-13 sm:h-13">
              <div className="w-full h-full rounded-full border-2 border-amber-500/60 overflow-hidden bg-black/80">
                <GothicAvatar characterId={selectedCharId} name={playerName} size="xs" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-600 border border-black flex items-center justify-center text-[7.5px] font-black text-black">★</div>
           </div>
           <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">{playerName || 'Detetive'}</span>
              <div className="flex items-center gap-1.5 mt-1">
                 <span className="text-[8px] font-mono font-bold text-amber-500">NÍVEL {progression.level}</span>
                 <div className="w-20 h-1.5 rounded-full bg-zinc-900 border border-white/5 overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-200 transition-all duration-1000" style={{ width: `${xpPercent}%` }} />
                 </div>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3">
           <button onClick={onOpenNotifications} className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-amber-400 relative backdrop-blur-sm"><Bell className="w-5 h-5" /></button>
           <button onClick={onOpenSettings} className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-zinc-300 backdrop-blur-sm"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      {/* CENTRAL LOGO: NO BOX, FLOATING ON BOOK */}
      <div className="relative z-20 flex flex-col items-center justify-center gap-2 my-auto animate-float-slow">
         <div className="w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-amber-600/10 blur-[50px] rounded-full animate-pulse" />
            <img src={codiceEmblemaCaveiraImg} className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]" alt="Emblem" />
         </div>
         <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-black tracking-[0.22em] text-white uppercase drop-shadow-2xl">CÓDICE <span className="text-red-600">DA</span> MORTE</h1>
            <p className="text-[10px] sm:text-xs font-mono tracking-[0.4em] text-amber-500 uppercase font-bold opacity-80">Mistério do Oráculo</p>
         </div>
      </div>

      {/* ACTIONS: ORIGINAL VERTICAL MENU */}
      <main className="relative z-20 w-full max-w-sm px-8 flex flex-col gap-2.5 mb-24 shrink-0">
         <button onClick={onQuickPlaySolo} className="w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-red-800 to-red-950 border-2 border-amber-400 text-white font-black text-sm uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Play className="w-5 h-5 fill-white" /> JOGAR
         </button>
         <button onClick={onOpenCreateRoom} className="w-full py-3 rounded-xl bg-black/80 border border-amber-900/60 flex flex-col items-center hover:border-amber-500/40 active:scale-98 transition-all">
            <span className="text-xs font-black text-amber-100 uppercase tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5 text-amber-500" /> CRIAR SALA</span>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-tighter mt-1 opacity-60">Reúna os investigadores</span>
         </button>
         <button onClick={onOpenJoinRoom} className="w-full py-3 rounded-xl bg-black/80 border border-amber-900/60 flex flex-col items-center hover:border-amber-500/40 active:scale-98 transition-all">
            <span className="text-xs font-black text-amber-100 uppercase tracking-widest flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-500" /> PARTIDA RÁPIDA</span>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-tighter mt-1 opacity-60">Entre em uma sala aleatória</span>
         </button>
         <button onClick={onOpenCharacters} className="w-full py-3 rounded-xl bg-black/80 border border-amber-900/60 flex flex-col items-center hover:border-amber-500/40 active:scale-98 transition-all">
            <span className="text-xs font-black text-amber-100 uppercase tracking-widest flex items-center gap-2"><User className="w-3.5 h-3.5 text-amber-500" /> PERSONAGENS</span>
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-tighter mt-1 opacity-60">42 Investigadores & Arte</span>
         </button>
      </main>

      {/* NAVIGATION: SAFE FOR MOBILE */}
      <footer className="absolute bottom-0 left-0 right-0 z-40 p-4 pb-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-md mx-auto h-16 rounded-[2rem] bg-zinc-950/95 backdrop-blur-2xl border border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.9)] flex items-center justify-around px-2">
           <button onClick={() => setActiveTab('lobby')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'lobby' ? 'text-amber-400 bg-amber-950/20 py-2 rounded-2xl' : 'text-zinc-500'}`}><Home className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Lobby</span></button>
           <button onClick={() => onOpenCollection()} className="flex flex-col items-center gap-1 text-zinc-500 flex-1 transition-all hover:text-amber-200"><Layers className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Coleção</span></button>
           <button onClick={() => onOpenProfile()} className="flex flex-col items-center gap-1 text-zinc-500 flex-1 transition-all hover:text-amber-200"><User className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Perfil</span></button>
           <button onClick={() => onOpenShop()} className="flex flex-col items-center gap-1 text-zinc-500 flex-1 transition-all hover:text-amber-200"><ShoppingBag className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Loja</span></button>
        </div>
      </footer>
    </div>
  );
};
