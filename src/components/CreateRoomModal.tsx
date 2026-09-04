import React, { useState } from 'react';
import { X, Shield, Sparkles } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import codiceMorteLivroImg from '../assets/images/codice_morte_livro_1787918785943.jpg';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCreate: (config: {
    roomName: string;
    gameMode: 'CASUAL' | 'COMPETITIVO' | 'HISTÓRIA' | 'PERSONALIZADO';
    maxPlayers: number;
    roundDuration: number;
    maxRounds: number;
    difficulty: 'FÁCIL' | 'NORMAL' | 'DIFÍCIL' | 'ESPECIALISTA';
    botAccuracy: number;
    oracleSelection: 'random' | 'host' | 'custom';
    hasAccomplice: boolean;
    hasSaboteur: boolean;
    allowEvents?: boolean;
    allowAbilities?: boolean;
  }) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onConfirmCreate,
}) => {
  const [roomName, setRoomName] = useState('Investigação Sombria');
  const [gameMode, setGameMode] = useState<'CASUAL' | 'COMPETITIVO' | 'HISTÓRIA' | 'PERSONALIZADO'>('CASUAL');
  const [playerCount, setPlayerCount] = useState<number>(10);
  const [roundDuration, setRoundDuration] = useState<number>(60);
  const [roundsCount, setRoundsCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<'FÁCIL' | 'NORMAL' | 'DIFÍCIL' | 'ESPECIALISTA'>('NORMAL');
  const [botAccuracy, setBotAccuracy] = useState<number>(20);
  const [oracleSelection, setOracleSelection] = useState<'random' | 'host' | 'custom'>('random');
  const [hasAccomplice, setHasAccomplice] = useState<boolean>(true);
  const [hasSaboteur, setHasSaboteur] = useState<boolean>(false);
  const [allowEvents, setAllowEvents] = useState<boolean>(true);
  const [allowAbilities, setAllowAbilities] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleCreate = () => {
    soundEngine.playVictory();
    onConfirmCreate({
      roomName: roomName.trim() || 'Investigação Sombria',
      gameMode,
      maxPlayers: playerCount,
      roundDuration,
      maxRounds: roundsCount,
      difficulty,
      botAccuracy,
      oracleSelection,
      hasAccomplice,
      hasSaboteur,
      allowEvents,
      allowAbilities,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in text-[#e8dfd8] overflow-hidden select-none">
      {/* Modal Container with Custom Gothic Background Artwork */}
      <div 
        className="relative w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl border-2 border-amber-600/50 shadow-[0_0_50px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[96vh]"
        style={{
          backgroundImage: `url(${codiceMorteLivroImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark Vignette Overlay to ensure perfect contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90 pointer-events-none z-0" />
        <div className="absolute inset-0 border border-amber-500/20 rounded-2xl sm:rounded-3xl pointer-events-none z-0" />

        {/* Close Button Top Right */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/70 text-zinc-400 hover:text-amber-200 border border-white/10 hover:border-amber-500/50 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content Body */}
        <div className="relative z-10 p-3.5 sm:p-5 flex flex-col space-y-2 sm:space-y-2.5 overflow-y-auto max-h-[88vh] custom-scrollbar">
          {/* 1. NOME DA SALA */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
              NOME DA SALA
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nome da sala..."
              maxLength={26}
              className="w-full bg-[#0d0707]/90 border border-amber-600/40 rounded-xl px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-serif text-amber-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500/50 shadow-inner tracking-wider"
            />
          </div>

          {/* 2. MODO DE JOGO */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
              MODO DE JOGO
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['CASUAL', 'COMPETITIVO', 'HISTÓRIA'] as const).map((mode) => {
                const isSelected = gameMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setGameMode(mode);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-serif font-bold tracking-wider uppercase transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-100 shadow-[0_0_12px_rgba(220,38,38,0.4)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 mt-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setGameMode('PERSONALIZADO');
                }}
                className={`py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-serif font-bold tracking-widest uppercase transition-all border ${
                  gameMode === 'PERSONALIZADO'
                    ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-100 shadow-[0_0_12px_rgba(220,38,38,0.4)]'
                    : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                }`}
              >
                PERSONALIZADO
              </button>
            </div>
          </div>

          {/* 3. Nº DE JOGADORES */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
              Nº DE JOGADORES
            </label>
            <div className="grid grid-cols-7 gap-1">
              {[4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isSelected = playerCount === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setPlayerCount(num);
                    }}
                    className={`py-1.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-200 shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. DURAÇÃO DA RODADA */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
              DURAÇÃO DA RODADA
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[30, 60, 90, 120].map((dur) => {
                const isSelected = roundDuration === dur;
                return (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setRoundDuration(dur);
                    }}
                    className={`py-1.5 rounded-xl text-[11px] sm:text-xs font-mono font-bold transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-200 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {dur}s
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. NÚMERO DE RODADAS (Requested feature) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
                NÚMERO DE RODADAS
              </label>
              <span className="text-[9px] font-mono text-amber-400/70">
                {roundsCount} {roundsCount === 1 ? 'Rodada' : 'Rodadas'}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((r) => {
                const isSelected = roundsCount === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setRoundsCount(r);
                    }}
                    className={`py-1 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-200 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {r} {r === 1 ? 'R' : 'Rds'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. DIFICULDADE (IA) */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
              DIFICULDADE (IA)
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['FÁCIL', 'NORMAL', 'DIFÍCIL', 'ESPECIALISTA'] as const).map((dif) => {
                const isSelected = difficulty === dif;
                return (
                  <button
                    key={dif}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setDifficulty(dif);
                    }}
                    className={`py-1.5 px-0.5 rounded-xl text-[9px] sm:text-[11px] font-serif font-bold tracking-wider uppercase transition-all border truncate ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-200 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {dif}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. PRECISÃO DE ACERTO DOS BOTS (Requested) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 block">
                TAXA DE ACERTO DOS BOTS
              </label>
              <span className="text-[9px] font-mono text-amber-400/80">
                {botAccuracy}% de chance
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { val: 10, label: '10% (Baixa)' },
                { val: 20, label: '20% (Padrão)' },
                { val: 35, label: '35% (Média)' },
                { val: 50, label: '50% (Alta)' },
              ].map((opt) => {
                const isSelected = botAccuracy === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setBotAccuracy(opt.val);
                    }}
                    className={`py-1.5 px-0.5 rounded-xl text-[9px] sm:text-[11px] font-mono font-bold tracking-wider uppercase transition-all border truncate ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-200 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. PAPEL DO ORÁCULO / NARRADOR */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-serif font-bold uppercase tracking-[0.18em] text-amber-300/90 flex items-center justify-between">
              <span>ORÁCULO / NARRADOR</span>
              <span className="text-[9px] font-mono text-amber-400/80 font-normal">
                {oracleSelection === 'random' ? 'Sorteio aleatório' : oracleSelection === 'host' ? 'Você será o Oráculo' : 'Escolher no Lobby'}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'random', label: '🎲 ALEATÓRIO' },
                { id: 'host', label: '👑 EU (HOST)' },
                { id: 'custom', label: '🎯 NO LOBBY' },
              ].map((opt) => {
                const isSelected = oracleSelection === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setOracleSelection(opt.id as any);
                    }}
                    className={`py-1.5 px-1 rounded-xl text-[9px] sm:text-[11px] font-serif font-bold tracking-wider uppercase transition-all border truncate ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#7a1414] to-[#450a0a] border-red-500/90 text-amber-200 shadow-[0_0_10px_rgba(220,38,38,0.4)]'
                        : 'bg-[#120b0b]/80 border-amber-900/40 text-zinc-400 hover:text-amber-200 hover:border-amber-500/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 9. PAPÉIS ESPECIAIS: CÚMPLICE & SABOTADOR */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Cúmplice Toggle */}
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-serif font-bold uppercase tracking-wider text-purple-300 flex items-center justify-between">
                <span>CÚMPLICE</span>
                <span className="text-[8px] font-mono text-purple-400">{hasAccomplice ? 'ATIVO' : 'DESATIVADO'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setHasAccomplice(true);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    hasAccomplice
                      ? 'bg-gradient-to-b from-purple-900 to-purple-950 border-purple-400 text-purple-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setHasAccomplice(false);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    !hasAccomplice
                      ? 'bg-zinc-800 border-zinc-500 text-zinc-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>

            {/* Sabotador Toggle */}
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-serif font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                <span>SABOTADOR</span>
                <span className="text-[8px] font-mono text-amber-500">{hasSaboteur ? 'ATIVO' : 'DESATIVADO'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setHasSaboteur(true);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    hasSaboteur
                      ? 'bg-gradient-to-b from-amber-800 to-amber-950 border-amber-400 text-amber-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setHasSaboteur(false);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    !hasSaboteur
                      ? 'bg-zinc-800 border-zinc-500 text-zinc-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>
          </div>

          {/* 10. REGRAS EXTRAS: EVENTOS & HABILIDADES */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {/* Eventos Toggle */}
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-serif font-bold uppercase tracking-wider text-orange-400 flex items-center justify-between">
                <span>EVENTOS</span>
                <span className="text-[8px] font-mono text-orange-400">{allowEvents ? 'ATIVO' : 'DESATIVADO'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setAllowEvents(true);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    allowEvents
                      ? 'bg-gradient-to-b from-orange-800 to-orange-950 border-orange-400 text-orange-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setAllowEvents(false);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    !allowEvents
                      ? 'bg-zinc-800 border-zinc-500 text-zinc-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>

            {/* Habilidades Toggle */}
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-serif font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                <span>HABILIDADES</span>
                <span className="text-[8px] font-mono text-emerald-400">{allowAbilities ? 'ATIVO' : 'DESATIVADO'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setAllowAbilities(true);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    allowAbilities
                      ? 'bg-gradient-to-b from-emerald-800 to-emerald-950 border-emerald-400 text-emerald-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  SIM
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setAllowAbilities(false);
                  }}
                  className={`py-1 rounded-lg text-[9px] sm:text-[10px] font-serif font-bold tracking-wider transition-all border ${
                    !allowAbilities
                      ? 'bg-zinc-800 border-zinc-500 text-zinc-200 shadow-sm'
                      : 'bg-black/60 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  NÃO
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Action: CRIAR SALA */}
          <div className="pt-2 sm:pt-3">
            <button
              onClick={handleCreate}
              className="w-full py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#6b1313] via-[#480909] to-[#240404] hover:from-[#851616] hover:to-[#380707] border-2 border-red-500/70 hover:border-amber-400 text-amber-100 font-serif font-black text-sm sm:text-base uppercase tracking-[0.22em] shadow-[0_4px_20px_rgba(107,19,19,0.7)] transition-all transform hover:scale-[1.01] active:scale-[0.98]"
            >
              CRIAR SALA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
