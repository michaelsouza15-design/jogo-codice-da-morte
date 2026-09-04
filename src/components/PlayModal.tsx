import React, { useState } from 'react';
import { Play, X, Users, Smartphone, Globe, Sparkles, Key, Bot, Shield, ChevronRight } from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

interface PlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSoloGame: () => void;
  onStartPassAndPlay: () => void;
  onHostOnlineRoom: () => void;
  onJoinRoom: (code: string) => void;
  roomCodeInput: string;
  setRoomCodeInput: (code: string) => void;
  mode?: 'all' | 'create' | 'join';
}

export const PlayModal: React.FC<PlayModalProps> = ({
  isOpen,
  onClose,
  onStartSoloGame,
  onStartPassAndPlay,
  onHostOnlineRoom,
  onJoinRoom,
  roomCodeInput,
  setRoomCodeInput,
  mode = 'all',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in text-[#e8dfd8]">
      <div className="bg-gradient-to-b from-[#180e0e] via-[#0f0808] to-black border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl shadow-black max-h-[90vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shadow-md">
              <Play className="w-5 h-5 fill-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-black text-amber-200 uppercase tracking-widest">
                {mode === 'create' ? 'CRIAR SALA' : mode === 'join' ? 'PARTIDA RÁPIDA' : 'MODOS DE JOGO'}
              </h2>
              <p className="text-[10px] sm:text-xs text-amber-400/80 font-serif">
                Escolha como deseja desvendar o Códice da Morte
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/10 hover:border-amber-400/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Stack */}
        <div className="space-y-3 overflow-y-auto">
          {/* 1. Solo Bot Game */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
              onStartSoloGame();
            }}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-black hover:from-amber-950/60 hover:to-zinc-900 border border-amber-500/40 hover:border-amber-400/80 transition-all flex items-center justify-between group shadow-md text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-serif font-bold text-amber-200 group-hover:text-amber-100 block">
                  Jogar Solo com Bots IA
                </span>
                <span className="text-[10px] text-zinc-400 block font-sans">
                  Partida instantânea com 6 investigadores inteligentes
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-1" />
          </button>

          {/* 2. Pass and Play Local Mode */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
              onStartPassAndPlay();
            }}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#5c1313] via-[#3d0a0a] to-black hover:from-[#731919] hover:to-zinc-900 border border-red-500/60 hover:border-red-400 transition-all flex items-center justify-between group shadow-md text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/50 flex items-center justify-center text-red-300 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-serif font-bold text-red-200 group-hover:text-red-100 block">
                  Sala Local (Passar o Celular)
                </span>
                <span className="text-[10px] text-zinc-300/80 block font-sans">
                  Jogue presencialmente com amigos em um único aparelho
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-red-300 transition-transform group-hover:translate-x-1" />
          </button>

          {/* 3. Online Private Room */}
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
              onHostOnlineRoom();
            }}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-black hover:from-amber-950/60 hover:to-zinc-900 border border-amber-500/40 hover:border-amber-400/80 transition-all flex items-center justify-between group shadow-md text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-serif font-bold text-amber-200 group-hover:text-amber-100 block">
                  Criar Sala Online Privada
                </span>
                <span className="text-[10px] text-zinc-400 block font-sans">
                  Gere um código ou QR Code para convidar amigos à distância
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-transform group-hover:translate-x-1" />
          </button>

          {/* 4. Join with Code */}
          <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-2">
            <span className="text-xs font-serif font-bold text-amber-200 block">
              Entrar em Sala com Código
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={5}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Ex: X7K9P"
                className="flex-1 bg-zinc-900/90 border border-white/15 text-xs text-amber-200 rounded-xl px-3 py-2 font-mono uppercase tracking-widest focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => {
                  soundEngine.playClick();
                  if (roomCodeInput.trim()) {
                    onClose();
                    onJoinRoom(roomCodeInput.trim().toUpperCase());
                  }
                }}
                disabled={!roomCodeInput.trim()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-serif font-bold text-xs uppercase tracking-wider transition-all"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
