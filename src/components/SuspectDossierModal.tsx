import React, { useState, useEffect } from 'react';
import { Player, CardMethod, CardObject, Character } from '../types/game';
import { CHARACTERS } from '../data/gameData';
import { GothicAvatar } from './GothicAvatar';
import { MethodCard, ObjectCard, CharacterRoleCard } from './GothicCard';
import {
  X,
  Search,
  ShieldAlert,
  Sparkles,
  Flame,
  KeyRound,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  User,
  ChevronLeft,
} from 'lucide-react';
import { GameFrame } from './GameFrame';

interface SuspectDossierModalProps {
  player: Player;
  onClose: () => void;
  onSelectCard?: (player: Player, type: 'method' | 'object', card: CardMethod | CardObject) => void;
  onAccuseSuspect?: (targetPlayer: Player) => void;
  myPlayerId: string;
  canAccuse?: boolean;
}

export const SuspectDossierModal: React.FC<SuspectDossierModalProps> = ({
  player,
  onClose,
  onSelectCard,
  onAccuseSuspect,
  myPlayerId,
  canAccuse = true,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'character' | 'methods' | 'objects'>('all');

  // Support mobile back button to close modal
  useEffect(() => {
    window.history.pushState({ modal: 'suspect-dossier' }, '');
    const handlePop = () => {
      onClose();
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [onClose]);

  const char: Character | undefined = CHARACTERS.find((c) => c.id === player.characterId);
  const isMe = player.id === myPlayerId;

  const filteredMethods = player.methods.filter((m) => {
    if (filterType === 'objects' || filterType === 'character') return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return m.name.toLowerCase().includes(term) || m.category.toLowerCase().includes(term) || m.id.toLowerCase().includes(term);
  });

  const filteredObjects = player.objects.filter((o) => {
    if (filterType === 'methods' || filterType === 'character') return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.name.toLowerCase().includes(term) || o.category.toLowerCase().includes(term) || o.id.toLowerCase().includes(term);
  });

  return (
    <div
      id="suspect-dossier-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GameFrame
        variant="modal"
        className="w-full max-w-4xl bg-zinc-950/95 card-shadow rounded-2xl sm:rounded-3xl border border-amber-500/40 max-h-[94vh] shadow-2xl overflow-hidden"
        contentClassName="flex-col max-h-[94vh] p-0"
        padding="p-0"
      >
        {/* Sticky Top Navigation Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#180a06] border-b border-amber-500/40 shrink-0 shadow-md">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 hover:text-white text-xs font-serif uppercase tracking-wider font-bold transition-all active:scale-95 shadow"
            title="Voltar"
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" />
            <span>Voltar</span>
          </button>

          <span className="text-[11px] sm:text-xs font-serif tracking-[0.2em] text-red-500 font-bold uppercase truncate px-2">
            DOSSIÊ DE SUSPEITO
          </span>

          <div className="flex items-center gap-2">
            {onAccuseSuspect && canAccuse && !isMe && (
              <button
                id="dossier-accuse-btn"
                onClick={() => {
                  onClose();
                  onAccuseSuspect(player);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-900 hover:bg-red-800 text-white font-serif font-bold text-xs uppercase tracking-wider transition-all border border-red-500/60 shadow"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-200" />
                <span>Acusar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 hover:text-white text-xs font-serif uppercase tracking-wider font-bold transition-all active:scale-95 shadow"
              title="Fechar Dossiê"
            >
              <span>Fechar</span>
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Suspect Header & Info */}
        <div className="px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-white/10 shrink-0 bg-black/40">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <GothicAvatar
              characterId={player.characterId}
              avatarSeed={char?.avatarSeed}
              name={player.name}
              size="md"
              glow={true}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber-400 bg-amber-950/60 border border-amber-400/40 px-2 py-0.5 rounded-full">
                  #{player.characterId ? String(char?.number || 1).padStart(2, '0') : '01'}
                </span>
                {isMe && (
                  <span className="text-[9px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full font-bold">
                    Suas Cartas
                  </span>
                )}
                {player.isAI && (
                  <span className="text-[9px] font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded-full">
                    Investigador IA
                  </span>
                )}
                {player.hasAccused && (
                  <span className="text-[9px] font-mono uppercase bg-red-950/80 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" /> Acusação Esgotada
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide truncate mt-0.5">
                {player.name}
              </h2>
              <p className="text-xs text-zinc-400 font-sans truncate">
                {char?.name || 'Suspeito'} — <span className="text-zinc-300 italic">{char?.title || 'Convidado da Abadia'}</span>
              </p>
            </div>
          </div>

          {onAccuseSuspect && canAccuse && !isMe && (
            <button
              onClick={() => {
                onClose();
                onAccuseSuspect(player);
              }}
              className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-900 text-white font-serif font-bold text-[10px] uppercase border border-red-500/60 shadow shrink-0"
            >
              <ShieldAlert className="w-3 h-3 text-red-200" />
              <span>Acusar</span>
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 py-3 border-b border-white/10 shrink-0">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all ${
                filterType === 'all'
                  ? 'bg-amber-600/80 text-white shadow-sm border border-amber-400/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todas (8)
            </button>
            <button
              onClick={() => setFilterType('character')}
              className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'character'
                  ? 'bg-amber-900/80 text-amber-200 shadow-sm border border-amber-500/50'
                  : 'text-amber-400/70 hover:text-amber-300'
              }`}
            >
              <User className="w-3 h-3 text-amber-400" />
              Carta do Personagem
            </button>
            <button
              onClick={() => setFilterType('methods')}
              className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'methods'
                  ? 'bg-red-900/80 text-red-200 shadow-sm border border-red-500/50'
                  : 'text-red-400/70 hover:text-red-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              Métodos ({player.methods.length})
            </button>
            <button
              onClick={() => setFilterType('objects')}
              className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 ${
                filterType === 'objects'
                  ? 'bg-blue-900/80 text-blue-200 shadow-sm border border-blue-500/50'
                  : 'text-blue-400/70 hover:text-blue-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              Objetos ({player.objects.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filtrar por nome ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full glass-ui bg-black/50 border-white/10 text-xs text-zinc-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-amber-400/60 font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Grouped Cards Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {/* Character Role Card View */}
          {filterType === 'character' && (
            <div className="flex flex-col items-center justify-center p-4 space-y-3">
              <CharacterRoleCard
                role={char?.roleTag || char?.title || 'Suspeito'}
                name={char?.name || player.name}
                description={char?.bio || char?.lore || 'Suspeito investigado nos autos da abadia.'}
                avatarUrl={char?.avatarUrl}
              />
              <p className="text-xs text-zinc-400 font-serif italic text-center max-w-md">
                {char?.lore || 'Identidade e papel do suspeito na trama do Códice.'}
              </p>
            </div>
          )}
          {/* 1. Group: Métodos de Assassinato */}
          {filterType !== 'objects' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-red-900/50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                  <h3 className="text-xs sm:text-sm font-serif font-bold text-red-300 uppercase tracking-[0.18em]">
                    Métodos de Assassinato ({filteredMethods.length} cartas)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-red-400/80 uppercase">
                  Possíveis Causas Fatais
                </span>
              </div>

              {filteredMethods.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 font-serif italic border border-dashed border-white/10 rounded-xl">
                  Nenhum método corresponde à busca.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {filteredMethods.map((method) => (
                    <MethodCard
                      key={method.id}
                      method={method}
                      onClick={() => onSelectCard && onSelectCard(player, 'method', method)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Group: Objetos do Crime */}
          {filterType !== 'methods' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-blue-900/50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                  <h3 className="text-xs sm:text-sm font-serif font-bold text-blue-300 uppercase tracking-[0.18em]">
                    Objetos e Instrumentos Suspeitos ({filteredObjects.length} cartas)
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-blue-400/80 uppercase">
                  Evidências Materiais
                </span>
              </div>

              {filteredObjects.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 font-serif italic border border-dashed border-white/10 rounded-xl">
                  Nenhum objeto corresponde à busca.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {filteredObjects.map((obj) => (
                    <ObjectCard
                      key={obj.id}
                      object={obj}
                      onClick={() => onSelectCard && onSelectCard(player, 'object', obj)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with mobile accusation button & close */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-zinc-400 font-serif hidden sm:block">
            {char?.lore ? `"${char.lore.substring(0, 75)}..."` : 'Analise as 8 cartas do suspeito em relação às pistas do Oráculo.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onAccuseSuspect && canAccuse && !isMe && (
              <button
                onClick={() => {
                  onClose();
                  onAccuseSuspect(player);
                }}
                className="flex sm:hidden flex-1 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-800 hover:bg-red-700 text-white font-serif font-bold text-xs uppercase tracking-wider transition-all border border-red-500/60"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-200" />
                <span>Acusar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl glass-ui hover:border-white/30 text-zinc-300 hover:text-white font-serif text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </GameFrame>
    </div>
  );
};
