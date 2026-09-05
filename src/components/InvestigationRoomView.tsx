import React, { useState, useEffect } from 'react';
import { RoomState, Player, CardMethod, CardObject, CardEvidence } from '../types/game';
import { MARKER_INFOS, METHODS, OBJECTS } from '../data/gameData';
import { GothicAvatar } from './GothicAvatar';
import { CharacterToken2D } from './CharacterToken2D';
import { MethodCard, ObjectCard, EvidenceCard } from './GothicCard';
import { HiddenRightSideMenu } from './HiddenRightSideMenu';
import { GameFrame } from './GameFrame';
import { soundEngine } from '../utils/soundEngine';
import { Skull, Search, BookOpen, Clock, Menu, EyeOff, X, PlusCircle, Archive, Trash2, Users } from 'lucide-react';
import { voiceManager } from '../utils/voiceManager';
import gothicHallBg from '../assets/images/gothic_hall_investigation_1788010723428.jpg';

interface InvestigationRoomViewProps {
  room: RoomState;
  myPlayerId: string;
  onSelectPlayerCard?: (player: Player, cardType: 'method' | 'object', card: CardMethod | CardObject) => void;
  onAccuseClick?: () => void;
  onOpenHistory?: () => void;
  onOpenRules?: () => void;
  onOpenSettings?: () => void;
  onOpenMenu?: () => void;
  onAdvanceRound?: () => void;
  onDrawEvidence?: () => void;
  onDiscardEvidence?: (evidenceId: string) => void;
  onOpenDiscarded?: () => void;
}

export const InvestigationRoomView: React.FC<InvestigationRoomViewProps> = ({
  room, myPlayerId, onSelectPlayerCard, onAccuseClick, onOpenHistory, onOpenRules, onOpenSettings, onOpenMenu, onAdvanceRound, onDrawEvidence, onDiscardEvidence, onOpenDiscarded
}) => {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(myPlayerId);
  const [activeFloatingModal, setActiveFloatingModal] = useState<'narrativa' | 'evidencias' | 'cartas' | null>(null);
  const [selectedPlayerForDossier, setSelectedPlayerForDossier] = useState<Player | null>(null);
  const [isPlayersPanelCollapsed, setIsPlayersPanelCollapsed] = useState<boolean>(false);
  const [zoomedEvidence, setZoomedEvidence] = useState<CardEvidence | null>(null);

  // Safety: Ensure critical data exists
  if (!room || !room.players) return <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4"><Skull className="w-12 h-12 text-amber-900 animate-pulse" /><p className="font-serif italic text-amber-500 uppercase tracking-widest text-[10px]">Restaurando a Sala...</p></div>;

  const myPlayer = room.players.find(p => p.id === myPlayerId);
  if (!myPlayer) return null;
  const isOracle = myPlayer.role === 'oraculo';

  useEffect(() => { voiceManager.joinMeshAsListener(); }, []);

  const timerSecs = room.phaseTimerRemaining ?? 0;
  const formattedTimer = `${Math.floor(timerSecs / 60)}:${(timerSecs % 60).toString().padStart(2, '0')}`;

  return (
    <div className="relative w-full flex flex-col bg-transparent text-[#e0d8d0] select-none space-y-3.5 pb-20 animate-fade-in">

      {/* 1. HEADER */}
      <div className="relative z-20 py-2.5 px-4 flex flex-col items-center justify-center text-center rounded-2xl bg-black/75 backdrop-blur-xl border border-amber-500/20 shadow-lg">
        <h2 className="font-serif text-[10px] font-bold text-amber-200 tracking-[0.2em] uppercase opacity-80 leading-none">SALA DE INVESTIGAÇÃO</h2>
        <div className="flex items-center gap-3 mt-2">
           <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black border border-amber-500/40 text-amber-300">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-widest">{formattedTimer}</span>
           </div>
           {isOracle && onAdvanceRound && (
             <button onClick={() => { soundEngine.playClick(); onAdvanceRound(); }} className="px-4 py-1 rounded-xl bg-amber-600 text-black font-black text-[9px] uppercase shadow-lg active:scale-95 transition-all">AVANÇAR RODADA</button>
           )}
        </div>
      </div>

      {/* 2. MAIN STAGE (STABLE 2D) */}
      <GameFrame variant="screen" padding="p-0" className="relative rounded-3xl overflow-hidden shadow-2xl border border-amber-900/30 min-h-[460px]">
        <div className="absolute inset-0 z-0">
          <img src={gothicHallBg} className="w-full h-full object-cover opacity-80" alt="" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
        </div>

        {/* Players Sidebar */}
        <aside className={`absolute left-0 top-0 bottom-0 z-20 transition-all duration-300 bg-black/80 backdrop-blur-md border-r border-amber-500/20 flex flex-col ${isPlayersPanelCollapsed ? 'w-0 overflow-hidden border-none' : 'w-56 p-3'}`}>
           <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Investigadores</span>
              <button onClick={() => setIsPlayersPanelCollapsed(true)} className="p-1 hover:text-white transition-colors"><EyeOff className="w-4 h-4 text-zinc-500" /></button>
           </div>
           <div className="space-y-1.5 overflow-y-auto no-scrollbar flex-1">
              {room.players.map(p => (
                <div key={p.id} onClick={() => { setSelectedPlayerForDossier(p); setActiveFloatingModal('cartas'); }} className={`p-2 rounded-xl border transition-all cursor-pointer ${p.id === myPlayerId ? 'bg-amber-950/40 border-amber-500/50' : 'bg-black/40 border-white/5 hover:border-amber-500/30'}`}>
                   <div className="flex items-center gap-2">
                      <GothicAvatar characterId={p.characterId} name={p.name} size="xs" />
                      <span className="text-[11px] font-bold truncate text-zinc-200">{p.name}</span>
                   </div>
                </div>
              ))}
           </div>
        </aside>

        {/* 2D Area */}
        <div className="relative z-10 w-full h-full flex items-center justify-center p-4">
           {isPlayersPanelCollapsed && (
             <button onClick={() => setIsPlayersPanelCollapsed(false)} className="absolute left-4 top-4 z-30 p-2.5 rounded-full bg-black/80 border border-amber-500/50 text-amber-400 shadow-lg animate-pulse"><Users className="w-5 h-5" /></button>
           )}
           <div className="flex flex-wrap items-center justify-center gap-6 max-w-4xl">
              {room.players.map((p, idx) => (
                <CharacterToken2D
                  key={p.id}
                  player={p}
                  seatNumber={idx + 1}
                  isMe={p.id === myPlayerId}
                  onClick={() => {
                    soundEngine.playCardFlip();
                    setSelectedPlayerForDossier(p);
                    setActiveFloatingModal('cartas');
                  }}
                />
              ))}
           </div>
        </div>

        {/* Right Menu */}
        <HiddenRightSideMenu
          onOpenNarrative={() => setActiveFloatingModal('narrativa')}
          onOpenEvidence={() => setActiveFloatingModal('evidencias')}
          onOpenChat={() => {}}
          onOpenCards={() => { setSelectedPlayerForDossier(myPlayer); setActiveFloatingModal('cartas'); }}
          onOpenRules={onOpenRules}
          hasUnreadNarrative={true}
        />
      </GameFrame>

      {/* 3. FOOTER NARRATIVE */}
      <section className="relative z-20 p-4 rounded-3xl bg-black/85 border border-amber-900/40 backdrop-blur-xl flex items-center justify-between gap-4 shadow-xl mx-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-red-950 border border-red-500 flex items-center justify-center shadow-lg shrink-0"><BookOpen className="w-5 h-5 text-amber-300" /></div>
          <div className="min-w-0">
            <h3 className="text-[10px] font-black text-amber-300 uppercase tracking-widest leading-none">Crônica do Oráculo</h3>
            <p className="text-[10px] text-zinc-400 italic line-clamp-1 mt-1">"{room.storyNarrative || 'O mistério se revela...'}"</p>
          </div>
        </div>
        <button onClick={() => setActiveFloatingModal('narrativa')} className="px-4 py-2 rounded-lg bg-red-900 text-white text-[9px] font-black uppercase tracking-widest border border-red-500 shadow-lg active:scale-95 transition-all">VER MAIS</button>
      </section>

      {/* MODALS */}
      {activeFloatingModal === 'evidencias' && (
        <div className="fixed inset-0 z-[100] bg-black/98 p-4 sm:p-6 animate-fade-in flex flex-col overflow-hidden">
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center border-b border-amber-900/40 pb-3 mb-6 shrink-0 text-amber-500">
               <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">EVIDÊNCIAS DA MESA</h2>
               <button onClick={() => setActiveFloatingModal(null)}><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {isOracle && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-amber-950/20 rounded-3xl border border-amber-500/20 shadow-inner mb-6">
                  <button onClick={onDrawEvidence} className="py-3 rounded-xl bg-amber-600 text-black font-black text-xs uppercase active:scale-95 transition-all shadow-lg"><PlusCircle className="w-4 h-4 inline-block mr-2" /> NOVA PISTA</button>
                  <button onClick={onOpenDiscarded} className="py-3 rounded-xl bg-zinc-800 text-zinc-300 font-black text-xs uppercase border border-white/5 active:scale-95 transition-all shadow-lg"><Archive className="w-4 h-4 inline-block mr-2" /> ARQUIVO MORTO</button>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {room.evidencesOnTable.map(ev => {
                  const isMarked = ev.markedOptionIndex !== undefined;
                  const marker = isMarked && ev.markedColor ? MARKER_INFOS[ev.markedColor] : null;
                  return (
                    <div key={ev.id} className="relative group">
                      <div onClick={() => setZoomedEvidence(ev)} className={`p-4 rounded-2xl border transition-all cursor-pointer min-h-[140px] flex flex-col justify-between ${isMarked ? 'bg-amber-950/30 border-amber-500 shadow-lg shadow-amber-950' : 'bg-black/60 border-white/10'}`}>
                         <div className="flex justify-between items-start">
                            <span className="text-[9px] font-mono text-amber-500/60 font-bold">{ev.id}</span>
                            {isMarked && <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: marker?.hex }} />}
                         </div>
                         <span className="text-xs font-black text-white uppercase block leading-tight mb-2 h-10 overflow-hidden line-clamp-2">{ev.title}</span>
                         {isMarked && <p className="text-[9px] text-amber-400 font-bold italic line-clamp-1 border-t border-white/5 pt-2">"{ev.options[ev.markedOptionIndex!]}"</p>}
                      </div>
                      {isOracle && ev.id !== 'E01' && ev.id !== 'E02' && (
                        <button onClick={(e) => { e.stopPropagation(); onDiscardEvidence?.(ev.id); soundEngine.playClick(); }} className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-red-600 border-2 border-black flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all z-50 animate-pulse">
                           <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setActiveFloatingModal(null)} className="w-full py-4 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase tracking-widest mt-6 border border-white/10">FECHAR</button>
          </div>
        </div>
      )}

      {activeFloatingModal === 'cartas' && selectedPlayerForDossier && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fade-in overflow-hidden">
           <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-amber-900/40 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <GothicAvatar characterId={selectedPlayerForDossier.characterId} name={selectedPlayerForDossier.name} size="sm" />
                  <div>
                     <h2 className="text-lg font-black text-white uppercase tracking-tight">{selectedPlayerForDossier.name}</h2>
                     <span className="text-[9px] font-mono text-amber-500 uppercase tracking-widest opacity-70">{selectedPlayerForDossier.role || 'Suspeito'}</span>
                  </div>
                </div>
                <button onClick={() => setActiveFloatingModal(null)} className="p-2 rounded-full bg-white/5"><X className="w-6 h-6 text-zinc-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto py-6 space-y-8 no-scrollbar pb-10">
                 <div className="p-5 rounded-3xl bg-black/40 border border-amber-900/30 shadow-xl">
                    <h3 className="text-xs font-black text-amber-200 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 uppercase">Objetos</h3>
                    <div className="grid grid-cols-4 gap-2.5">
                       {(selectedPlayerForDossier.objects?.length ? selectedPlayerForDossier.objects : OBJECTS.slice(0, 4)).map(obj => (<div key={obj.id} className="scale-90 sm:scale-100 transition-transform"><ObjectCard object={obj} size="sm" /></div>))}
                    </div>
                 </div>
                 <div className="p-5 rounded-3xl bg-black/40 border border-red-900/30 shadow-xl">
                    <h3 className="text-xs font-black text-red-200 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 uppercase">Métodos</h3>
                    <div className="grid grid-cols-4 gap-2.5">
                       {(selectedPlayerForDossier.methods?.length ? selectedPlayerForDossier.methods : METHODS.slice(0, 4)).map(meth => (<div key={meth.id} className="scale-90 sm:scale-100 transition-transform"><MethodCard method={meth} size="sm" /></div>))}
                    </div>
                 </div>
              </div>
              <div className="flex gap-2 shrink-0 mt-4 mb-4">
                 {selectedPlayerForDossier.id !== myPlayerId && !isOracle && (
                   <button onClick={() => { soundEngine.playDramaticSting(); onAccuseSuspect?.(selectedPlayerForDossier); setActiveFloatingModal(null); }} className="flex-1 py-4 rounded-2xl bg-red-900 text-white font-black text-xs uppercase border border-red-500 shadow-xl animate-pulse">ACUSAR</button>
                 )}
                 <button onClick={() => setActiveFloatingModal(null)} className="px-8 py-4 rounded-2xl bg-zinc-900 text-zinc-400 font-black text-xs uppercase border border-white/5 shadow-lg active:scale-95 transition-all">VOLTAR</button>
              </div>
           </div>
        </div>
      )}

      {zoomedEvidence && (
        <div className="fixed inset-0 z-[130] bg-black/98 flex items-center justify-center p-4 animate-fade-in" onClick={() => setZoomedEvidence(null)}>
           <div className="max-w-xs w-full scale-110 drop-shadow-[0_0_40px_rgba(0,0,0,0.9)]" onClick={e => e.stopPropagation()}>
              <EvidenceCard evidence={zoomedEvidence} isOracleInteractive={false} />
              <button onClick={() => setZoomedEvidence(null)} className="w-full py-3 rounded-2xl bg-zinc-800 text-white font-black text-xs mt-6 uppercase border border-white/10 active:scale-95 transition-all shadow-xl">FECHAR</button>
           </div>
        </div>
      )}
    </div>
  );
};
