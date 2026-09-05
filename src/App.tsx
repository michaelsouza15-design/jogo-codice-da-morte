import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { RoomState, Player } from './types/game';
import { CHARACTERS } from './data/gameData';
import { InvestigationRoomView } from './components/InvestigationRoomView';
import { LobbyView } from './components/LobbyView';
import { NightPhaseView } from './components/NightPhaseView';
import { OracleView } from './components/OracleView';
import { AccusationModal } from './components/AccusationModal';
import { AccusationsHistoryModal } from './components/AccusationsHistoryModal';
import { CinematicRevelation } from './components/CinematicRevelation';
import { HomeScreen } from './components/HomeScreen';
import { SettingsModal } from './components/SettingsModal';
import { RoleRevealCutscene } from './components/RoleRevealCutscene';
import { soundEngine } from './utils/soundEngine';
import { voiceManager } from './utils/voiceManager';
import { Skull } from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('codice_player_name') || 'Investigador 1');
  const [selectedCharId, setSelectedCharId] = useState(() => localStorage.getItem('codice_char_id') || CHARACTERS[0].id);

  // UI States
  const [showSettings, setShowSettings] = useState(false);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [inspectCard, setInspectCard] = useState<any>(null);
  const [lastPhase, setLastPhase] = useState<string>('LOBBY');

  useEffect(() => {
    const s = io(window.location.origin, { transports: ['websocket', 'polling'] });

    s.on('joined_success', ({ playerId }) => {
      setMyPlayerId(playerId);
      voiceManager.init(s, playerId);
    });

    s.on('room_update', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);

      // Auto-trigger role reveal when transition from LOBBY or ORACULO
      if (updatedRoom.phase !== 'LOBBY' && updatedRoom.phase !== 'FIM_DE_JOGO' && lastPhase === 'LOBBY') {
        setShowRoleReveal(true);
      }
      setLastPhase(updatedRoom.phase);
    });

    s.on('error_message', (msg) => alert(msg));
    setSocket(s);
    return () => { s.disconnect(); };
  }, [lastPhase]);

  const handleSendMessage = (text: string, isWhisper?: boolean, audioData?: string) => {
    socket?.emit('send_message', { text, isWhisper, audioData });
  };

  if (!room) {
    return (
      <HomeScreen
        playerName={playerName}
        setPlayerName={(n) => { setPlayerName(n); localStorage.setItem('codice_player_name', n); }}
        selectedCharId={selectedCharId}
        setSelectedCharId={(id) => { setSelectedCharId(id); localStorage.setItem('codice_char_id', id); }}
        onQuickPlaySolo={() => socket?.emit('join_room', { roomCode: 'SOLO', playerName, characterId: selectedCharId })}
        onOpenCreateRoom={() => {
           const code = Math.random().toString(36).substring(2, 7).toUpperCase();
           socket?.emit('join_room', { roomCode: code, playerName, characterId: selectedCharId });
        }}
        onOpenJoinRoom={() => {
           const code = prompt('Digite o código da sala:');
           if (code) socket?.emit('join_room', { roomCode: code.toUpperCase(), playerName, characterId: selectedCharId });
        }}
        onOpenCharacters={() => {}}
        onOpenGrimoire={() => {}}
        onOpenCollection={() => {}}
        onOpenShop={() => {}}
        onOpenProfile={() => {}}
        onOpenNotifications={() => {}}
        onOpenSettings={() => setShowSettings(true)}
      />
    );
  }

  const me = room.players.find(p => p.id === myPlayerId);

  return (
    <div className="min-h-screen bg-black text-[#e0d8d0] relative overflow-hidden">

      {room.phase === 'LOBBY' && (
        <LobbyView
          room={room}
          myPlayerId={myPlayerId}
          onStartGame={() => socket?.emit('start_game')}
          onAddBot={() => socket?.emit('add_bot')}
          onRemoveBot={() => socket?.emit('remove_bot')}
          onUpdateCharacter={(id) => socket?.emit('update_character', { characterId: id })}
          onLeaveRoom={() => setRoom(null)}
        />
      )}

      {room.phase === 'NOITE' && (
        <NightPhaseView
          room={room}
          myPlayerId={myPlayerId}
          onConfirmChoice={(m, o) => socket?.emit('night_choice', { methodId: m, objectId: o })}
          onSuggestChoice={(m, o) => socket?.emit('suggest_night_choice', { methodId: m, objectId: o })}
        />
      )}

      {room.phase === 'ORACULO' && (
        <OracleView
          room={room}
          myPlayerId={myPlayerId}
          onFinishOraclePhase={() => socket?.emit('finish_oracle')}
          onMarkOption={(ev, opt, col, coords) => socket?.emit('oracle_mark', { evidenceId: ev, optionIdx: opt, color: col, coords })}
          onDrawEvidence={() => socket?.emit('draw_evidence')}
          onDiscardEvidence={(id) => socket?.emit('discard_evidence', { evidenceId: id })}
          onUpdateStory={(s) => socket?.emit('update_narrative', { narrative: s })}
          onAdjustTimer={(d) => socket?.emit('adjust_timer', { deltaSeconds: d })}
          onSetTimerDuration={(d) => socket?.emit('set_timer_duration', { durationSeconds: d })}
        />
      )}

      {room.phase === 'INVESTIGACAO' && (
        <InvestigationRoomView
          room={room}
          myPlayerId={myPlayerId}
          onAccuseClick={() => setShowAccuseModal(true)}
          onOpenHistory={() => setShowHistoryModal(true)}
          onOpenMenu={() => setShowSettings(true)}
          onAdvanceRound={() => socket?.emit('advance_round')}
          onDrawEvidence={() => socket?.emit('draw_evidence')}
          onDiscardEvidence={(id) => socket?.emit('discard_evidence', { evidenceId: id })}
          onSendMessage={handleSendMessage}
          onSelectPlayerCard={(p, t, c) => setInspectCard({ p, t, c })}
        />
      )}

      {room.phase === 'REVELACAO' && (
        <CinematicRevelation
          room={room}
          myPlayerId={myPlayerId}
          onRestartGame={() => socket?.emit('restart_game')}
          onReturnToMainMenu={() => setRoom(null)}
        />
      )}

      {/* OVERLAYS */}
      {showRoleReveal && me && (
        <RoleRevealCutscene player={me} room={room} onFinish={() => setShowRoleReveal(false)} />
      )}

      {showAccuseModal && (
        <AccusationModal
          room={room}
          myPlayerId={myPlayerId}
          onClose={() => setShowAccuseModal(false)}
          onConfirmAccusation={(t, m, o) => socket?.emit('make_accusation', { targetPlayerId: t, methodId: m, objectId: o })}
        />
      )}

      {showHistoryModal && (
        <AccusationsHistoryModal room={room} onClose={() => setShowHistoryModal(false)} />
      )}

      {inspectCard && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md" onClick={() => setInspectCard(null)}>
           <div className="max-w-sm w-full bg-[#0d0604] p-8 rounded-3xl border border-amber-500/40 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
              <h4 className="text-xl font-black text-white uppercase mb-2">{inspectCard.c.name}</h4>
              <p className="text-xs text-zinc-400 italic mb-6">"{inspectCard.c.description}"</p>
              <button onClick={() => setInspectCard(null)} className="w-full py-4 rounded-xl bg-amber-600 text-black font-black uppercase text-xs shadow-lg">FECHAR</button>
           </div>
        </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} isInRoom={true} onLeaveRoom={() => setRoom(null)} />
    </div>
  );
}
