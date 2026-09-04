import React, { useState, useEffect } from 'react';
import { CHARACTERS, getCharacterById } from '../data/gameData';
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
  Skull,
  Play,
  Users,
  Zap,
  BookOpen,
  Sparkles,
  Layers,
  ShoppingBag,
  Bell,
  Gift,
  Settings,
  Home,
  User,
  Sword,
  Shield,
  Sun,
  Moon,
  ChevronRight,
} from 'lucide-react';

interface HomeScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  selectedCharId: string;
  setSelectedCharId: (id: string) => void;
  onQuickPlaySolo: () => void;
  onOpenCreateRoom: () => void;
  onOpenJoinRoom: () => void;
  onOpenPassAndPlay: () => void;
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
  onOpenPassAndPlay,
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
    const handleUpdate = () => {
      setProgression(loadProgression());
    };
    window.addEventListener('codice_progression_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('codice_progression_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const reqXp = getXpRequiredForLevel(progression.level);
  const xpPercent = Math.min(100, Math.max(0, Math.round((progression.xp / reqXp) * 100)));

  const handleTabClick = (tab: 'lobby' | 'colecao' | 'grimorio' | 'perfil' | 'loja') => {
    soundEngine.playClick();
    setActiveTab(tab);
    if (tab === 'colecao') onOpenCollection();
    else if (tab === 'grimorio') onOpenGrimoire();
    else if (tab === 'perfil') onOpenProfile();
    else if (tab === 'loja') onOpenShop();
  };

  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col justify-between items-center text-[#e8dfd8] overflow-hidden select-none px-2 py-1.5 sm:py-2 pt-safe pb-safe">
      {/* Background: O Códice da Morte (Livro Ancestral e Caveira na Biblioteca) */}
      <div className="fixed inset-0 z-0 bg-[#070404] overflow-hidden pointer-events-none">
        <img
          src={codiceMorteLivroImg}
          alt="O Códice da Morte - Livro Ancestral e Caveira"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105 filter brightness-85 contrast-110"
          referrerPolicy="no-referrer"
        />
        {/* Cinematic Vignette Overlay */}
        <div className="absolute inset-0 bg-radial-gradient from-amber-950/20 via-black/50 to-black/80 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/60 z-10" />

        {/* Ambient floating flame particles */}
        <div className="absolute inset-0 pointer-events-none opacity-60 z-10">
          <div className="absolute bottom-10 left-1/4 w-72 h-72 rounded-full bg-amber-600/15 blur-3xl animate-pulse" />
          <div className="absolute top-20 right-1/4 w-80 h-80 rounded-full bg-red-950/25 blur-3xl" />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TOP STATUS BAR */}
      {/* ------------------------------------------------------------- */}
      <header className="relative z-30 w-full max-w-xs sm:max-w-sm px-2 pt-2.5 sm:pt-3 flex items-center justify-between shrink-0">
        {/* Profile Pill (Left) */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenProfile();
          }}
          className="flex items-center gap-2 p-1 pr-3 rounded-full bg-gradient-to-r from-black/85 to-zinc-900/70 border border-amber-500/40 hover:border-amber-400 shadow-lg shadow-black/80 transition-all group backdrop-blur-md"
        >
          <div className="relative">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-amber-400/80 overflow-hidden shadow-inner bg-zinc-950 flex items-center justify-center">
              <GothicAvatar
                characterId={selectedCharId}
                avatarSeed={currentChar.avatarSeed}
                name={currentChar.name}
                size="xs"
                glow={false}
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border border-black flex items-center justify-center text-[7px] font-bold text-black font-mono">
              ★
            </div>
          </div>
          <div className="text-left">
            <div className="text-[11px] sm:text-xs font-serif font-bold text-amber-200 group-hover:text-amber-100 transition-colors flex items-center gap-1 leading-tight">
              {playerName || 'Drácula'}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] sm:text-[9px] font-mono tracking-widest text-amber-400/90 font-bold uppercase">
                NÍVEL {progression.level}
              </span>
              <div className="w-10 sm:w-12 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>
        </button>

        {/* Top Right Quick Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Notification Bell */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenNotifications();
            }}
            className="relative w-8 h-8 rounded-full bg-black/60 border border-amber-500/30 hover:border-amber-400/70 flex items-center justify-center text-amber-300 hover:text-amber-100 transition-all shadow-md backdrop-blur-sm"
            title="Novidades e Notificações"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 border border-black animate-pulse" />
          </button>

          {/* Rewards / Gift */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenShop();
            }}
            className="w-8 h-8 rounded-full bg-black/60 border border-amber-500/30 hover:border-amber-400/70 flex items-center justify-center text-amber-300 hover:text-amber-100 transition-all shadow-md backdrop-blur-sm"
            title="Recompensas Diárias"
          >
            <Gift className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenSettings();
            }}
            className="w-8 h-8 rounded-full bg-black/60 border border-amber-500/30 hover:border-amber-400/70 flex items-center justify-center text-zinc-300 hover:text-amber-200 transition-all shadow-md backdrop-blur-sm"
            title="Configurações & Áudio"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* CENTER LOGO & GOTHIC SEAL (O CÓDICE DA MORTE) */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-20 flex flex-col items-center justify-center my-auto shrink-0">
        {/* Glowing backdrop halo */}
        <div className="relative flex flex-col items-center justify-center">
          <div className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-amber-500/25 blur-3xl animate-pulse pointer-events-none" />
          
          {/* Gothic Game Emblem: O Códice da Morte (Grimório e Caveira) */}
          <div className="relative flex flex-col items-center justify-center group cursor-pointer">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden ring-2 ring-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.35)] transition-transform hover:scale-105 duration-300 bg-black/80 flex items-center justify-center">
              <img
                src={codiceEmblemaCaveiraImg}
                alt="CÓDICE DA MORTE - Grimório e Caveira"
                className="w-full h-full object-cover filter contrast-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 rounded-2xl border border-amber-400/40 pointer-events-none" />
            </div>

            <div className="mt-1.5 sm:mt-2 text-center">
              <h1 className="text-lg sm:text-xl md:text-2xl font-serif font-black tracking-[0.22em] text-amber-200 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                CÓDICE DA MORTE
              </h1>
              <span className="text-[8px] sm:text-[9px] font-mono tracking-[0.3em] text-amber-500/90 uppercase font-semibold">
                MISTÉRIO & DEDUÇÃO
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FLOATING VERTICAL MENU BUTTONS */}
      {/* ------------------------------------------------------------- */}
      <main className="relative z-20 w-full max-w-xs sm:max-w-sm px-3 flex flex-col gap-1.5 sm:gap-2 my-auto shrink-0">
        {/* 1. JOGAR (Primary Highlighted Ruby/Crimson Button) */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onQuickPlaySolo();
          }}
          className="group relative w-full py-2.5 sm:py-3 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#7a1414] via-[#520d0d] to-[#2e0505] hover:from-[#941919] hover:to-[#3b0808] border-2 border-amber-400/80 hover:border-amber-300 shadow-[0_4px_16px_rgba(122,20,20,0.6)] text-white font-serif font-black text-xs sm:text-sm uppercase tracking-[0.25em] transition-all transform hover:scale-[1.01] active:scale-[0.98] overflow-hidden flex items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Play className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
          <span>JOGAR</span>
        </button>

        {/* 2. CRIAR SALA */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenCreateRoom();
          }}
          className="group relative w-full py-2 sm:py-2.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black hover:bg-zinc-850 border border-amber-500/40 hover:border-amber-400/80 shadow-md text-amber-100 font-serif font-bold text-xs sm:text-xs uppercase tracking-[0.2em] transition-all transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Users className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-300" />
          <span>CRIAR SALA</span>
        </button>

        {/* 3. PARTIDA RÁPIDA / ENTRAR COM CÓDIGO */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenJoinRoom();
          }}
          className="group relative w-full py-2 sm:py-2.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black hover:bg-zinc-850 border border-amber-500/40 hover:border-amber-400/80 shadow-md text-amber-100 font-serif font-bold text-xs sm:text-xs uppercase tracking-[0.2em] transition-all transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-300" />
          <span>PARTIDA RÁPIDA</span>
        </button>

        {/* 4. PERSONAGENS (42 INVESTIGADORES) */}
        <button
          id="btn-home-characters"
          onClick={() => {
            soundEngine.playClick();
            onOpenCharacters();
          }}
          className="group relative w-full py-1.5 sm:py-2 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black hover:bg-zinc-850 border border-amber-500/40 hover:border-amber-400/80 shadow-md text-center transition-all transform hover:scale-[1.01] active:scale-[0.98] flex flex-col items-center justify-center"
        >
          <div className="flex items-center gap-1.5 text-amber-100 font-serif font-bold text-xs uppercase tracking-[0.2em]">
            <User className="w-3 h-3 text-amber-400/80 group-hover:text-amber-300" />
            <span>PERSONAGENS</span>
          </div>
          <span className="text-[8px] sm:text-[9px] font-serif text-amber-400/70 tracking-widest uppercase">
            42 INVESTIGADORES & ARTE
          </span>
        </button>

        {/* 5. GRIMÓRIO (HISTÓRIAS DO DRÁCULA) */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenGrimoire();
          }}
          className="group relative w-full py-1.5 sm:py-2 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black hover:bg-zinc-850 border border-amber-500/40 hover:border-amber-400/80 shadow-md text-center transition-all transform hover:scale-[1.01] active:scale-[0.98] flex flex-col items-center justify-center"
        >
          <div className="flex items-center gap-1.5 text-amber-100 font-serif font-bold text-xs uppercase tracking-[0.2em]">
            <BookOpen className="w-3 h-3 text-amber-400/80 group-hover:text-amber-300" />
            <span>GRIMÓRIO</span>
          </div>
          <span className="text-[8px] sm:text-[9px] font-serif text-amber-400/70 tracking-widest uppercase">
            HISTÓRIAS DO DRÁCULA
          </span>
        </button>

        {/* 6. COLEÇÃO (CARTAS E ITENS) */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenCollection();
          }}
          className="group relative w-full py-1.5 sm:py-2 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-black hover:bg-zinc-850 border border-amber-500/40 hover:border-amber-400/80 shadow-md text-center transition-all transform hover:scale-[1.01] active:scale-[0.98] flex flex-col items-center justify-center"
        >
          <div className="flex items-center gap-1.5 text-amber-100 font-serif font-bold text-xs uppercase tracking-[0.2em]">
            <Layers className="w-3 h-3 text-amber-400/80 group-hover:text-amber-300" />
            <span>COLEÇÃO</span>
          </div>
          <span className="text-[8px] sm:text-[9px] font-serif text-amber-400/70 tracking-widest uppercase">
            CARTAS E ITENS
          </span>
        </button>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM FLOATING DOCK (NAVIGATION BAR) */}
      {/* ------------------------------------------------------------- */}
      <nav className="relative z-30 w-full max-w-xs sm:max-w-sm shrink-0 mb-1 px-1">
        <div className="p-1 rounded-2xl sm:rounded-3xl bg-black/85 backdrop-blur-xl border border-amber-500/40 shadow-2xl shadow-black flex items-center justify-around gap-1">
          {/* LOBBY (Active Home) */}
          <button
            onClick={() => handleTabClick('lobby')}
            className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'lobby'
                ? 'bg-gradient-to-b from-red-950/80 to-amber-950/60 border border-red-500/60 text-amber-200 shadow-md'
                : 'text-zinc-400 hover:text-amber-200'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="text-[8px] font-serif font-bold tracking-wider uppercase mt-0.5">
              LOBBY
            </span>
          </button>

          {/* COLEÇÃO */}
          <button
            onClick={() => handleTabClick('colecao')}
            className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'colecao'
                ? 'bg-gradient-to-b from-red-950/80 to-amber-950/60 border border-red-500/60 text-amber-200 shadow-md'
                : 'text-zinc-400 hover:text-amber-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[8px] font-serif font-bold tracking-wider uppercase mt-0.5">
              COLEÇÃO
            </span>
          </button>

          {/* GRIMÓRIO */}
          <button
            onClick={() => handleTabClick('grimorio')}
            className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'grimorio'
                ? 'bg-gradient-to-b from-red-950/80 to-amber-950/60 border border-red-500/60 text-amber-200 shadow-md'
                : 'text-zinc-400 hover:text-amber-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-[8px] font-serif font-bold tracking-wider uppercase mt-0.5">
              GRIMÓRIO
            </span>
          </button>

          {/* PERFIL */}
          <button
            onClick={() => handleTabClick('perfil')}
            className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'perfil'
                ? 'bg-gradient-to-b from-red-950/80 to-amber-950/60 border border-red-500/60 text-amber-200 shadow-md'
                : 'text-zinc-400 hover:text-amber-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="text-[8px] font-serif font-bold tracking-wider uppercase mt-0.5">
              PERFIL
            </span>
          </button>

          {/* LOJA */}
          <button
            onClick={() => handleTabClick('loja')}
            className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
              activeTab === 'loja'
                ? 'bg-gradient-to-b from-red-950/80 to-amber-950/60 border border-red-500/60 text-amber-200 shadow-md'
                : 'text-zinc-400 hover:text-amber-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="text-[8px] font-serif font-bold tracking-wider uppercase mt-0.5">
              LOJA
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};
