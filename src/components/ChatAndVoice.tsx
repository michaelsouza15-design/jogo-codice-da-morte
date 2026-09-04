import React, { useState, useRef, useEffect } from 'react';
import { RoomState } from '../types/game';
import { CHARACTERS } from '../data/gameData';
import { GothicAvatar } from './GothicAvatar';
import { voiceManager, VoiceParticipant } from '../utils/voiceManager';
import { soundEngine } from '../utils/soundEngine';
import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Flame,
  FileText,
  CheckCircle2,
  XCircle,
  Volume2,
  Radio,
  Activity,
} from 'lucide-react';

interface ChatAndVoiceProps {
  room: RoomState;
  myPlayerId: string;
  onSendMessage: (text: string) => void;
  onOpenAccusationsModal?: () => void;
}

export const ChatAndVoice: React.FC<ChatAndVoiceProps> = ({
  room,
  myPlayerId,
  onSendMessage,
  onOpenAccusationsModal,
}) => {
  const [inputText, setInputText] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [participants, setParticipants] = useState<Map<string, VoiceParticipant>>(new Map());
  const [activeTab, setActiveTab] = useState<'chat' | 'accusations' | 'voice' | 'logs'>('chat');
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const userSentMessageRef = useRef<boolean>(false);

  const myPlayer = room.players.find((p) => p.id === myPlayerId);
  const isOracle = myPlayer?.role === 'oraculo';
  const accusations = room.accusationHistory || [];

  // Listen to voiceManager state
  useEffect(() => {
    setIsMicActive(voiceManager.getIsMicActive());

    const unsubParticipants = voiceManager.onParticipantsChange((updatedMap) => {
      setParticipants(updatedMap);
    });

    const unsubSpeaking = voiceManager.onLocalSpeaking((speaking, vol) => {
      setIsSpeakingLocal(speaking);
      setLocalVolume(vol);
    });

    const unsubMic = voiceManager.onMicStatus((muted) => {
      setIsMicActive(!muted);
    });

    return () => {
      unsubParticipants();
      unsubSpeaking();
      unsubMic();
    };
  }, []);

  const [micNotice, setMicNotice] = useState<string | null>(null);

  const handleToggleMic = async () => {
    soundEngine.playClick();
    if (!isMicActive) {
      const granted = await voiceManager.startMicrophone();
      if (granted) {
        setIsMicActive(true);
        setMicNotice('Microfone ativado! Fale agora para testar a captação.');
        setTimeout(() => setMicNotice(null), 4000);
      } else {
        setMicNotice('Permissão de microfone não concedida ou bloqueada pelo navegador.');
        setTimeout(() => setMicNotice(null), 5000);
      }
    } else {
      voiceManager.mute();
      setIsMicActive(false);
      setMicNotice('Microfone desligado.');
      setTimeout(() => setMicNotice(null), 2500);
    }
  };

  // Safely scroll ONLY the inner chat box without moving the window/page
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollContainerRef.current) {
      const el = chatScrollContainerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom || userSentMessageRef.current) {
        el.scrollTop = el.scrollHeight;
        userSentMessageRef.current = false;
      }
    }
  }, [room.messages, activeTab]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (isOracle && room.phase === 'INVESTIGACAO') {
      alert('O Oráculo está sob voto de silêncio místico durante a investigação!');
      return;
    }
    userSentMessageRef.current = true;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleQuickChip = (chipText: string) => {
    if (isOracle && room.phase === 'INVESTIGACAO') return;
    userSentMessageRef.current = true;
    onSendMessage(chipText);
  };

  return (
    <div id="game-chat-box" className="glass-ui card-shadow rounded-3xl border-white/10 flex flex-col h-[460px] overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {/* Chat Escrito */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 text-xs font-serif font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'chat'
                ? 'glass-ui-amber border-amber-400/80 text-amber-200 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat ({room.messages.length})</span>
          </button>

          {/* Registro de Acusações */}
          <button
            onClick={() => setActiveTab('accusations')}
            className={`flex items-center gap-1.5 text-xs font-serif font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'accusations'
                ? 'glass-ui-red border-red-400/80 text-red-200 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Acusações ({accusations.length})</span>
          </button>

          {/* Canal de Voz */}
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 text-xs font-serif font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'voice'
                ? 'glass-ui-blue border-blue-400/80 text-blue-200 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Voz {isMicActive && '🎙️'}</span>
          </button>

          {/* Logs */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 text-xs font-serif font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'logs'
                ? 'glass-ui-amber border-amber-400/80 text-amber-200 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Logs</span>
          </button>
        </div>

        {/* Quick Voice Mic Toggle Button with live indicator */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-serif transition-all border shrink-0 ${
            isMicActive
              ? isSpeakingLocal
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/40 animate-pulse'
                : 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200 shadow-sm'
              : 'bg-black/60 text-zinc-300 border-amber-500/40 hover:text-white hover:border-amber-400'
          }`}
          title={isMicActive ? 'Microfone Ativo (Clique para Desligar / Mutar)' : 'Microfone Desligado (Clique para Ligar)'}
        >
          {isMicActive ? (
            <>
              <Mic className={`w-3.5 h-3.5 ${isSpeakingLocal ? 'text-white' : 'text-emerald-400'}`} />
              <span className="text-[10px] font-bold uppercase font-mono tracking-wider">
                {isSpeakingLocal ? 'FALANDO' : 'MIC ON'}
              </span>
            </>
          ) : (
            <>
              <MicOff className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] font-bold uppercase font-mono tracking-wider text-amber-300">LIGAR MIC</span>
            </>
          )}
        </button>
      </div>

      {/* Main Tab View */}
      <div ref={chatScrollContainerRef} className="flex-1 p-3.5 overflow-y-auto space-y-3">
        {/* TAB 1: CHAT ESCRITO */}
        {activeTab === 'chat' && (
          <div className="space-y-3">
            {room.messages.map((msg) => {
              const isMe = msg.senderId === myPlayerId;
              const senderPlayer = room.players.find((p) => p.id === msg.senderId);
              const senderChar = CHARACTERS.find((c) => c.id === senderPlayer?.characterId);

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <GothicAvatar
                    characterId={senderPlayer?.characterId}
                    avatarSeed={senderChar?.avatarSeed}
                    name={msg.senderName}
                    size="xs"
                  />
                  <div
                    className={`p-3 rounded-2xl max-w-[80%] text-xs leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-br from-amber-600/30 to-amber-900/40 border border-amber-500/40 text-amber-100 rounded-tr-none'
                        : 'glass-ui bg-black/40 border-white/10 text-zinc-200 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-serif font-bold text-[11px] text-amber-300">
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400 opacity-60">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="break-words font-sans">{msg.text}</p>
                  </div>
                </div>
              );
            })}

            {room.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 font-serif">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">Nenhuma mensagem ainda no salão.</p>
                <p className="text-[10px] opacity-70">Utilize o chat de voz ou envie mensagens escritas para deduzir o crime.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACUSAÇÕES FORMAIS */}
        {activeTab === 'accusations' && (
          <div className="space-y-3">
            {accusations.map((acc, index) => {
              const accUser = room.players.find((p) => p.id === acc.accuserId);
              const targetUser = room.players.find((p) => p.id === acc.targetPlayerId);

              return (
                <div
                  key={index}
                  className={`p-3 rounded-2xl border text-xs font-serif space-y-2 ${
                    acc.isCorrect
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/40 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      {acc.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span>
                        {accUser?.name || 'Investigador'} acusou {targetUser?.name || 'Suspeito'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono opacity-75">{acc.timestamp}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/5 font-sans">
                    <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30">
                      <div className="text-[9px] font-mono font-bold text-red-300 uppercase flex items-center gap-1">
                        <Flame className="w-3 h-3 text-red-400" /> Método
                      </div>
                      <span className="font-bold text-red-100 block truncate">{acc.methodName}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-500/30">
                      <div className="text-[9px] font-mono font-bold text-blue-300 uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3 text-blue-400" /> Objeto
                      </div>
                      <span className="font-bold text-blue-100 block truncate">{acc.objectName}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {accusations.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 font-serif">
                <ShieldAlert className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">Nenhuma acusação judicial registrada.</p>
                <p className="text-[10px] opacity-70">Jogadores podem acusar a qualquer momento durante a fase de investigação.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CANAL DE VOZ REAL-TIME */}
        {activeTab === 'voice' && (
          <div className="space-y-3.5">
            <div className="p-4 rounded-2xl glass-ui-blue border-blue-400/40 text-blue-200 text-xs font-serif leading-relaxed flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${isMicActive ? 'bg-emerald-900/60 border border-emerald-400/60' : 'bg-black/40 border border-white/10'}`}>
                  <Radio className={`w-5 h-5 ${isMicActive ? 'text-emerald-400 animate-pulse' : 'text-blue-400'}`} />
                </div>
                <div>
                  <span className="font-bold block uppercase tracking-wider text-amber-200">
                    Canal de Áudio em Tempo Real
                  </span>
                  <span className="text-[11px] text-zinc-300">
                    {isMicActive
                      ? isSpeakingLocal
                        ? '🟢 Você está falando agora (todos na sala ouvem)...'
                        : '🎙️ Seu microfone está ativo e transmitindo.'
                      : '🔇 Seu microfone está desligado. Clique no botão ao lado para falar.'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleToggleMic}
                className={`px-4 py-2 rounded-xl font-serif text-xs font-bold border transition-all active:scale-95 flex items-center gap-2 shrink-0 ${
                  isMicActive
                    ? 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 border-red-400 text-white shadow-md'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 border-emerald-300 text-white shadow-md'
                }`}
              >
                {isMicActive ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Silenciar Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Ligar Microfone</span>
                  </>
                )}
              </button>
            </div>

            {/* Local Audio Spectrum Bar */}
            {isMicActive && (
              <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-300 uppercase">Captação da sua voz:</span>
                </div>
                <div className="flex-1 max-w-xs h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75"
                    style={{ width: `${Math.max(5, localVolume)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Investigadores Conectados ({room.players.length}):
              </span>
              <span className="text-[9px] font-serif text-amber-300/80 italic">
                Áudio espacial ativado
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {room.players.map((p) => {
                const char = CHARACTERS.find((c) => c.id === p.characterId);
                const isMe = p.id === myPlayerId;
                const participantData = participants.get(p.id);
                const isSpeaking = isMe ? isSpeakingLocal : Boolean(participantData?.isSpeaking);
                const isMuted = isMe ? !isMicActive : Boolean(participantData?.isMuted);

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isSpeaking
                        ? 'bg-emerald-950/40 border-emerald-400 shadow-md shadow-emerald-950/80'
                        : isMe
                        ? 'bg-amber-950/30 border-amber-500/30'
                        : 'bg-black/40 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative">
                        <GothicAvatar
                          characterId={p.characterId}
                          avatarSeed={char?.avatarSeed}
                          name={p.name}
                          size="xs"
                          glow={isSpeaking}
                        />
                        {isSpeaking && (
                          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black animate-ping" />
                        )}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-serif font-bold text-zinc-200 block truncate flex items-center gap-1">
                          <span>{p.name}</span>
                          {isMe && <span className="text-amber-400 font-mono text-[9px]">(Você)</span>}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-serif block truncate">
                          {p.role === 'oraculo' ? 'Oráculo Sagrado' : char?.title || 'Investigador'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSpeaking ? (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-400 text-emerald-300 text-[10px] font-mono shadow-sm">
                          <Mic className="w-3 h-3 text-emerald-400 animate-bounce" />
                          <span className="font-bold">FALANDO</span>
                        </div>
                      ) : isMuted ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-500 text-[10px] font-mono">
                          <MicOff className="w-3 h-3" />
                          <span>Mudo</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-950/50 border border-blue-500/30 text-blue-300 text-[10px] font-mono">
                          <Volume2 className="w-3 h-3 text-blue-400" />
                          <span>Ouvindo</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: LOGS / REGISTRO COMPLETO */}
        {activeTab === 'logs' && (
          <div className="space-y-2">
            {room.logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl glass-ui border-white/10 text-[11px] font-mono text-zinc-300 flex items-start gap-2.5"
              >
                <span className="text-zinc-500 shrink-0 opacity-75">{log.timestamp}</span>
                <span className="leading-snug">{log.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick deduction chips in Chat Tab */}
      {activeTab === 'chat' && !isOracle && (
        <div className="px-3 py-1.5 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-black/20">
          <button
            type="button"
            onClick={() => handleQuickChip('🔴 Atenção aos marcadores de perigo!')}
            className="px-2.5 py-1 rounded-lg text-[10px] font-serif bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 whitespace-nowrap"
          >
            🔴 Atenção ao perigo
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('🔍 Examinem as cartas deste suspeito!')}
            className="px-2.5 py-1 rounded-lg text-[10px] font-serif bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 whitespace-nowrap"
          >
            🔍 Examinem as cartas
          </button>
          <button
            type="button"
            onClick={() => handleQuickChip('🔵 Qual objeto encaixa com a pista azul?')}
            className="px-2.5 py-1 rounded-lg text-[10px] font-serif bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 whitespace-nowrap"
          >
            🔵 Dúvida no Objeto
          </button>
        </div>
      )}

      {/* Mic Status Feedback Notice */}
      {micNotice && (
        <div className="px-3 py-1.5 bg-black/90 border-t border-amber-500/30 flex items-center justify-between text-[11px] font-serif text-amber-200">
          <span className="flex items-center gap-1.5">
            {isMicActive ? <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <MicOff className="w-3.5 h-3.5 text-zinc-400" />}
            {micNotice}
          </span>
          <button
            type="button"
            onClick={() => setMicNotice(null)}
            className="text-zinc-400 hover:text-white text-xs px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <form onSubmit={handleSend} className="p-2.5 sm:p-3 border-t border-white/10 flex items-center gap-2 bg-black/50">
        {/* Dedicated Microfone Toggle Button inside Chat */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={`p-2.5 rounded-xl border flex items-center justify-center transition-all shrink-0 active:scale-95 ${
            isMicActive
              ? isSpeakingLocal
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-md animate-pulse'
                : 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
              : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-amber-300 hover:border-amber-500/50'
          }`}
          title={isMicActive ? 'Microfone Ativo (Clique para Desligar / Mutar)' : 'Ligar Microfone de Voz'}
        >
          {isMicActive ? (
            <Mic className={`w-4 h-4 ${isSpeakingLocal ? 'text-white' : 'text-emerald-400'}`} />
          ) : (
            <MicOff className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isOracle && room.phase === 'INVESTIGACAO'
              ? 'Oráculo em silêncio sagrado...'
              : isMicActive
              ? 'Mic ativo. Digite sua mensagem...'
              : 'Digite sua mensagem ou ligue o mic...'
          }
          disabled={isOracle && room.phase === 'INVESTIGACAO'}
          className="flex-1 glass-ui bg-black/60 border-white/10 text-xs text-zinc-100 placeholder-zinc-500 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-400/60"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 border border-amber-400/40 disabled:opacity-40 text-white transition-colors"
          title="Enviar Mensagem Escrita"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
