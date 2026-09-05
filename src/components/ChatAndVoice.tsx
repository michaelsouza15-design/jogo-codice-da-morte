import React, { useState, useRef, useEffect } from 'react';
import { RoomState } from '../types/game';
import { GothicAvatar } from './GothicAvatar';
import { soundEngine } from '../utils/soundEngine';
import { MessageSquare, Mic, Send, Play, Square } from 'lucide-react';

interface ChatAndVoiceProps {
  room: RoomState;
  myPlayerId: string;
  onSendMessage: (text: string, isWhisper?: boolean, audioData?: string) => void;
}

export const ChatAndVoice: React.FC<ChatAndVoiceProps> = ({ room, myPlayerId, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'accusations' | 'logs'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [room.messages, activeTab]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => onSendMessage('', false, reader.result as string);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
      soundEngine.playClick();
    } catch (err) { alert('Microfone bloqueado.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      soundEngine.playClick();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const playAudio = (base64: string) => {
    const audio = new Audio(base64);
    audio.play().catch(e => console.error(e));
  };

  return (
    <div className="glass-ui rounded-3xl border-white/10 flex flex-col h-[480px] overflow-hidden bg-black/60 backdrop-blur-xl shadow-2xl">
      <div className="flex border-b border-white/10 bg-black/40">
        {(['chat', 'accusations', 'logs'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'text-amber-400 bg-amber-950/20' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t}
          </button>
        ))}
      </div>

      <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 no-scrollbar">
        {activeTab === 'chat' && room.messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.senderId === myPlayerId ? 'flex-row-reverse' : ''}`}>
            <GothicAvatar characterId={room.players.find(p => p.id === msg.senderId)?.characterId} name={msg.senderName} size="xs" />
            <div className={`p-3 rounded-2xl max-w-[80%] text-xs ${msg.senderId === myPlayerId ? 'bg-amber-900/40 text-amber-100' : 'bg-white/5 text-zinc-300 border border-white/5 shadow-sm'}`}>
              <div className="font-bold text-amber-500 text-[10px] mb-1">{msg.senderName}</div>
              {msg.audioData ? (
                <button onClick={() => playAudio(msg.audioData!)} className="flex items-center gap-2 bg-amber-600 px-3 py-1.5 rounded-lg text-black font-black text-[10px] shadow-lg">
                  <Play className="w-3.5 h-3.5 fill-black" /> OUVIR ÁUDIO
                </button>
              ) : (
                <p className="leading-relaxed">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-white/10 bg-black/80 flex items-center gap-2">
        <button type="button" onClick={isRecording ? stopRecording : startRecording} className={`p-3 rounded-xl border transition-all ${isRecording ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-zinc-800 border-white/10 text-amber-500 hover:border-amber-400'}`}>
          {isRecording ? <Square className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
        </button>
        {isRecording ? ( <div className="flex-1 text-red-400 font-mono text-xs animate-pulse font-bold uppercase">Gravando: {recordingTime}s...</div> ) : (
          <form onSubmit={handleSend} className="flex-1 flex gap-2">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Mensagem..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none text-white font-serif" />
            <button type="submit" disabled={!inputText.trim()} className="p-3 rounded-xl bg-amber-600 text-black shadow-lg disabled:opacity-30 active:scale-95 transition-all"><Send className="w-4 h-4" /></button>
          </form>
        )}
      </div>
    </div>
  );
};
