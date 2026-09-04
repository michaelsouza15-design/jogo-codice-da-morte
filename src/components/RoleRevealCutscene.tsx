import React, { useState, useEffect } from 'react';
import { Player, RoomState } from '../types/game';
import { CHARACTERS } from '../data/gameData';
import { GothicAvatar } from './GothicAvatar';
import { soundEngine } from '../utils/soundEngine';
import { useCustomCardArt } from '../utils/customCardArt';
import {
  Skull,
  Eye,
  Search,
  ShieldAlert,
  Flame,
  Sparkles,
  ChevronRight,
  Shield,
  HelpCircle,
  Zap,
  Lock,
  Maximize2,
  Image as ImageIcon,
} from 'lucide-react';
import { GameFrame } from './GameFrame';

interface RoleRevealCutsceneProps {
  player: Player;
  room: RoomState;
  onFinish: () => void;
}

export const RoleRevealCutscene: React.FC<RoleRevealCutsceneProps> = ({
  player,
  room,
  onFinish,
}) => {
  const [animationStep, setAnimationStep] = useState<number>(0);
  const [showFullArt, setShowFullArt] = useState<boolean>(false);

  const character = CHARACTERS.find((c) => c.id === player.characterId) || CHARACTERS[0];
  const role = player.role || 'investigador';

  // Check if custom art was linked for this role or character
  const customRoleArt = useCustomCardArt([`role_${role}`, role]);
  const customCharArt = useCustomCardArt([character.id, ...(character.aliases || [])]);

  useEffect(() => {
    // Sound effect on start
    soundEngine.playCathedralBell();

    const t1 = setTimeout(() => {
      setAnimationStep(1);
      soundEngine.playEventStinger();
    }, 900);

    const t2 = setTimeout(() => {
      setAnimationStep(2);
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const getRoleConfig = () => {
    switch (role) {
      case 'assassino':
        return {
          title: 'O ASSASSINO',
          sub: 'O executor nas sombras da biblioteca',
          badgeClass: 'bg-red-950/90 border-red-500 text-red-100 shadow-red-900/60 shadow-lg',
          glowClass: 'from-red-600/30 via-red-900/20 to-transparent',
          icon: <Skull className="w-10 h-10 text-red-400 animate-pulse" />,
          accentColor: '#ef4444',
          description:
            'Você consumou o crime mortal no silêncio dos arquivos ancestrais. Você deve escolher 1 Método e 1 Objeto entre os seus pertences para forjar a cena do crime.',
          objective:
            'Mantenha sua identidade em sigilo absoluto. Confunda as deduções e evite ser desmascarado até o final da 3ª Rodada.',
          tip: 'Não tente defender suas cartas de forma óbvia. Aponte pistas de outros jogadores e semeie dúvidas sutis!',
        };
      case 'oraculo':
        return {
          title: 'O ORÁCULO SAGRADO',
          sub: 'A testemunha onisciente do crime',
          badgeClass: 'bg-purple-950/90 border-purple-500 text-purple-100 shadow-purple-900/60 shadow-lg',
          glowClass: 'from-purple-600/30 via-purple-900/20 to-transparent',
          icon: <Eye className="w-10 h-10 text-purple-400 animate-pulse" />,
          accentColor: '#a855f7',
          description:
            'Você testemunhou os ecos do crime através do Códice! Você conhece o Assassino, o Método e o Objeto exatos.',
          objective:
            'Posicione os marcadores nas tábuas de evidência para guiar os Investigadores até a verdade, sem jamais falar ou gesticular a resposta diretamente.',
          tip: 'Use marcadores de maior precisão nas tábuas que mais delimitam o método e o objeto do crime.',
        };
      case 'cumplice':
        return {
          title: 'O CÚMPLICE',
          sub: 'O aliado oculto da conspiração',
          badgeClass: 'bg-emerald-950/90 border-emerald-500 text-emerald-100 shadow-emerald-900/60 shadow-lg',
          glowClass: 'from-emerald-600/30 via-emerald-900/20 to-transparent',
          icon: <ShieldAlert className="w-10 h-10 text-emerald-400 animate-pulse" />,
          accentColor: '#10b981',
          description:
            'Você ajudou a planejar o crime e conhece a identidade do Assassino e o método/objeto escolhidos.',
          objective:
            'Proteja o Assassino durante as discussões e acusações. Desvie as pistas e conduza as suspeitas para outros investigadores inocentes.',
          tip: 'Aja como um investigador comum e faça perguntas que induzam os outros a acusarem suspeitos errados.',
        };
      case 'sabotador':
        return {
          title: 'O SABOTADOR',
          sub: 'O agente do caos nas sombras',
          badgeClass: 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-amber-900/60 shadow-lg',
          glowClass: 'from-amber-600/30 via-amber-900/20 to-transparent',
          icon: <Flame className="w-10 h-10 text-amber-400 animate-pulse" />,
          accentColor: '#f59e0b',
          description:
            'Você opera com segredos próprios. Seus interesses não se alinham com a verdade do tribunal.',
          objective:
            'Crie discórdia e caos entre os investigadores para que a verdade permaneça enterrada nos tomos proibidos.',
          tip: 'Proponha teorias conspiratórias convincentes e questione as interpretações dos marcadores do Oráculo.',
        };
      case 'investigador':
      default:
        return {
          title: 'O INVESTIGADOR',
          sub: 'A mente dedutiva do tribunal',
          badgeClass: 'bg-blue-950/90 border-blue-500 text-blue-100 shadow-blue-900/60 shadow-lg',
          glowClass: 'from-blue-600/30 via-blue-900/20 to-transparent',
          icon: <Search className="w-10 h-10 text-blue-400 animate-pulse" />,
          accentColor: '#3b82f6',
          description:
            'Você é um perito convocado para desvendar o assassinato ocorrido na biblioteca proibida.',
          objective:
            'Examine com atenção os marcadores do Oráculo, cruze os métodos e objetos de cada suspeito e acuse o culpado exato antes do fim das 3 rodadas.',
          tip: 'Analise as 4 cartas de Método e 4 de Objeto de cada jogador na sala e cruze com as pistas do Oráculo.',
        };
    }
  };

  const config = getRoleConfig();

  return (
    <div
      id="role-reveal-cutscene"
      className="fixed inset-0 z-50 bg-[#060302]/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 sm:p-4 text-[#e0d8d0] overflow-y-auto animate-fade-in"
    >
      {/* Background Atmosphere Glow */}
      <div
        className={`fixed inset-0 bg-gradient-to-b ${config.glowClass} pointer-events-none transition-opacity duration-1000 opacity-60`}
      />

      <GameFrame
        variant="screen"
        className="w-full max-w-2xl min-h-[92vh] max-h-[96vh] my-auto bg-black/80 rounded-3xl border border-amber-500/30 overflow-hidden shadow-2xl"
        contentClassName="items-center justify-between overflow-y-auto"
        padding="p-6 sm:p-10"
      >
        {/* Top Banner */}
        <div className="relative z-10 w-full max-w-xl text-center pt-2 space-y-1.5 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-mono uppercase tracking-[0.25em]">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>CÓDICE DA MORTE • REVELAÇÃO DE IDENTIDADE</span>
          </div>
          <h1 className="text-xs sm:text-sm font-serif italic text-zinc-400">
            "O destino foi selado. Conheça o seu papel no mistério ancestral..."
          </h1>
        </div>

        {/* Main Dramatic Role Card or Custom Role Card Artwork */}
        <div className="relative z-10 w-full max-w-lg my-auto py-4">
          {customRoleArt ? (
            /* ============================================================ */
            /* WHEN CUSTOM ROLE ART IS LINKED: DISPLAY THE ARTWORK DIRECTLY */
            /* ============================================================ */
            <div
              className={`w-full glass-ui card-shadow rounded-3xl border-2 p-4 sm:p-6 flex flex-col items-center text-center relative overflow-hidden transition-all duration-700 ${
                animationStep >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-80'
              } ${config.badgeClass}`}
            >
              {/* Corner accents */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-400/60" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-400/60" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-400/60" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-400/60" />

              {/* Custom Role Badge Header */}
              <div className="flex items-center justify-between w-full pb-2 mb-3 border-b border-white/10">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  CARTA DE IDENTIDADE REVELADA
                </span>
                <span
                  className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full shadow-inner"
                  style={{ backgroundColor: `${config.accentColor}25`, color: config.accentColor, borderColor: `${config.accentColor}60` }}
                >
                  {config.title}
                </span>
              </div>

              {/* Character & Player Reference (Above Card) */}
              <div className="mb-2 text-center">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">
                  {character.title}
                </span>
                <h2 className="text-sm sm:text-base font-serif font-black text-amber-100">
                  {player.name} ({character.name})
                </h2>
              </div>

              {/* Custom Role Image (Pure High Definition Artwork without overlapping text) */}
              <div className="relative w-full max-w-[260px] sm:max-w-[290px] aspect-[2/3.1] rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-2xl shadow-black ring-2 ring-amber-400/30 group">
                <img
                  src={customRoleArt}
                  alt={config.title}
                  className="w-full h-full object-cover select-none"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 border border-white/15 rounded-2xl pointer-events-none" />
              </div>

              {/* Objective Summary under the linked card */}
              <div className="w-full mt-4 space-y-2 text-left bg-black/70 p-3.5 rounded-2xl border border-white/10 text-xs">
                <div className="flex items-center gap-1.5 font-bold font-serif text-amber-300 text-xs uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sua Missão Secreta:</span>
                </div>
                <p className="text-zinc-200 leading-relaxed font-sans text-xs">
                  {config.objective}
                </p>
              </div>

              {/* Security Note */}
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Mantenha sua tela em sigilo dos outros jogadores</span>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* STANDARD GOTHIC DIV DISPLAY WHEN NO CUSTOM ART IS ATTACHED */
            /* ============================================================ */
            <div
              className={`w-full glass-ui card-shadow rounded-3xl border-2 p-5 sm:p-7 flex flex-col items-center text-center relative overflow-hidden transition-all duration-700 ${
                animationStep >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-80'
              } ${config.badgeClass}`}
            >
              {/* Subtle Corner Accents */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-amber-400/60" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-amber-400/60" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-amber-400/60" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-amber-400/60" />

              {/* Character Avatar + Role Icon */}
              <div className="relative mb-3">
                <div className="relative">
                  <GothicAvatar
                    avatarSeed={character.avatarSeed}
                    avatarBg={character.avatarBg}
                    size="lg"
                    glowColor={character.accentColor}
                    showOrnament
                  />
                  <div className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-black/90 border border-white/20 shadow-xl">
                    {config.icon}
                  </div>
                </div>
              </div>

              {/* Character Name & Title */}
              <div className="space-y-0.5 mb-3">
                <span className="text-[10px] sm:text-xs font-mono text-zinc-300 uppercase tracking-widest">
                  {character.title}
                </span>
                <h2 className="text-lg sm:text-xl font-serif font-black text-white">
                  {player.name} ({character.name})
                </h2>
              </div>

              {/* Role Badge (Large and dramatic) */}
              <div className="w-full py-2.5 px-4 rounded-2xl bg-black/70 border border-white/20 mb-4 shadow-inner">
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-400 block mb-0.5">
                  SEU PAPEL SECRETO NESTA PARTIDA:
                </span>
                <h3
                  className="text-2xl sm:text-3xl font-serif font-black tracking-[0.2em] uppercase"
                  style={{ color: config.accentColor }}
                >
                  {config.title}
                </h3>
                <span className="text-[11px] font-serif italic text-zinc-300 block mt-0.5">
                  {config.sub}
                </span>
              </div>

              {/* Objective Box */}
              <div className="w-full space-y-2.5 text-left bg-black/50 p-3.5 sm:p-4 rounded-2xl border border-white/10 text-xs sm:text-sm mb-4">
                <div>
                  <div className="flex items-center gap-1.5 font-bold font-serif text-amber-300 text-xs uppercase tracking-wider mb-1">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sua Missão Secreta:</span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed font-sans text-xs">
                    {config.objective}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5 font-bold font-serif text-zinc-300 text-[11px] uppercase tracking-wider mb-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dica Tática:</span>
                  </div>
                  <p className="text-zinc-300/90 leading-relaxed font-sans text-[11px] italic">
                    {config.tip}
                  </p>
                </div>

                {player.ability && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex items-center gap-1.5 font-bold font-serif text-purple-300 text-[11px] uppercase tracking-wider mb-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Habilidade Especial: {player.ability.name}</span>
                    </div>
                    <p className="text-zinc-300 text-[11px]">{player.ability.effect}</p>
                  </div>
                )}
              </div>

              {/* Security Note */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Mantenha sua tela em sigilo dos outros jogadores</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Confirmation Button */}
        <div className="relative z-10 w-full max-w-sm pb-2 animate-fade-in">
          <button
            onClick={() => {
              soundEngine.playClick();
              onFinish();
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-black font-serif font-black text-xs sm:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-amber-950/80 active:scale-95 transition-all group cursor-pointer"
          >
            <span>ENTENDI MEU PAPEL • INICIAR JOGO</span>
            <ChevronRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </GameFrame>
    </div>
  );
};

