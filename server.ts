import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  createNewRoom,
  fillWithAIBots,
  populateLobbyInvestigators,
  startGameDistribution,
  handleNightChoice,
  handleOracleMark,
  finishOraclePhase,
  handleAccusation,
  handleAbilityUse,
  handleDrawRandomEvent,
  handleDrawNewEvidence,
  handleAddSpecificEvidence,
  handleDiscardEvidence,
  handleAdvanceRound,
  autoProcessBotOracleNextRound,
  autoMarkOracleAI,
  handleUpdateStoryNarrative,
  generateAIBotDialogue,
  performAIBotAccusation,
  sanitizeRoomForPlayer,
  handleFinishActiveEvent,
} from './src/engine/gameLogic';
import { RoomState, MarkerColor, Player } from './src/types/game';
import { CHARACTERS } from './src/data/gameData';

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Serve static files
const audioDir = path.join(process.cwd(), 'public', 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
app.use('/audio', express.static(audioDir));

const charDir = path.join(process.cwd(), 'public', 'characters');
if (!fs.existsSync(charDir)) fs.mkdirSync(charDir, { recursive: true });
app.use('/characters', express.static(charDir));

const cardsDir = path.join(process.cwd(), 'public', 'cards');
if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });
app.use('/cards', express.static(cardsDir));

// Load official Grimoire truth data
let grimoireData: any = null;
const grimoirePath = path.join(process.cwd(), 'src', 'data', 'grimorio_oraculo_game.json');
try {
  if (fs.existsSync(grimoirePath)) {
    grimoireData = JSON.parse(fs.readFileSync(grimoirePath, 'utf8'));
    console.log(`[Grimoire] Loaded ${Object.keys(grimoireData.codices || {}).length} official combinations.`);
  }
} catch (e) {
  console.warn('Could not load official grimoire JSON:', e);
}

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

const rooms = new Map<string, RoomState>();
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const socketsInRoom = io.sockets.adapter.rooms.get(roomCode);
  if (!socketsInRoom) return;

  for (const socketId of socketsInRoom) {
    const mapping = socketToPlayer.get(socketId);
    if (mapping) {
      const sanitized = sanitizeRoomForPlayer(room, mapping.playerId);
      // Populate official truth for Oracle
      const me = room.players.find(p => p.id === mapping.playerId);
      if (me?.role === 'oraculo' && grimoireData && room.secretSolution?.methodId && room.secretSolution?.objectId) {
         const key = `${room.secretSolution.objectId}-${room.secretSolution.methodId}`;
         const entry = grimoireData.codices?.[key];
         if (entry) {
            sanitized.officialTruth = {
               verdade: entry.verdade_do_codice,
               notas: entry.nota_ao_oraculo,
               historiaOriginal: entry.historia_original,
               paginaPdf: entry.pagina_pdf
            };
         }
      }
      io.to(socketId).emit('room_update', sanitized);
    }
  }
}

async function handleAIBotDialogueAsync(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== 'INVESTIGACAO') return;

  const aiBots = room.players.filter((p) => p.isAI && p.role !== 'oraculo');
  if (aiBots.length === 0) return;

  const bot = aiBots[Math.floor(Math.random() * aiBots.length)];
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const withDialogue = generateAIBotDialogue(room);
    if (withDialogue) { rooms.set(roomCode, withDialogue); broadcastRoom(roomCode); }
    return;
  }

  try {
    const ai = new GoogleGenAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chatHistory = room.messages.slice(-15).map(m => `${m.senderName}: ${m.text}`).join('\n');
    const markedEvidences = room.evidencesOnTable
      .filter(e => e.markedOptionIndex !== undefined)
      .map(e => `[${e.title}: ${e.options[e.markedOptionIndex!]}]`)
      .join(', ');

    let officialTruth = "";
    if (grimoireData && room.secretSolution?.methodId && room.secretSolution?.objectId) {
      const key = `${room.secretSolution.objectId}-${room.secretSolution.methodId}`;
      const entry = grimoireData.codices?.[key];
      if (entry) officialTruth = `A solução real é: ${entry.verdade_do_codice}.`;
    }

    const prompt = `Você é o bot "${bot.name}" (Papel: ${bot.role || 'Investigador'}) no jogo "O Códice da Morte".
O jogo é um mistério gótico. Pistas marcadas: ${markedEvidences}.
${officialTruth ? `CONTEXTO SECRETO: ${officialTruth}` : ""}
Histórico de chat:
${chatHistory}

Sua tarefa: Comente sobre a investigação de forma curta (1 frase).
- Se for Investigador: Reaja ao chat ou pistas.
- Se for Assassino/Cúmplice: Tente desviar a suspeita sutilmente.
Responda apenas em Português. Seed: ${Math.random()}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (text) {
      room.messages.push({
        id: `msg_bot_${Date.now()}`,
        senderId: bot.id,
        senderName: bot.name,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      broadcastRoom(roomCode);
    }
  } catch (error) {
    console.error('Error AI:', error);
  }
}

app.post('/api/story', async (req, res) => {
  const { methodName, objectName, methodId, objectId, methodDesc, objectDesc } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.json({ story: "Nas sombras da abadia, um crime ocorreu..." });

    const ai = new GoogleGenAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let grimoireContext = "";
    if (grimoireData && methodId && objectId) {
      const key = `${objectId}-${methodId}`;
      const entry = grimoireData.codices?.[key];
      if (entry) grimoireContext = `Verdade: ${entry.verdade_do_codice}. Nota: ${entry.nota_ao_oraculo}.`;
    }

    const prompt = `Você é o narrador gótico de "O Códice da Morte".
Crie um parágrafo (3 frases) atmosférico descrevendo a cena do crime.
Método: ${methodName}. Objeto: ${objectName}.
${grimoireContext ? `CONTEXTO OFICIAL: ${grimoireContext}` : ""}
Estilo Edgar Allan Poe. Não revele o culpado. Português apenas. Seed: ${Math.random()}`;

    const result = await model.generateContent(prompt);
    res.json({ story: result.response.text().trim() });
  } catch (error) {
    res.json({ story: "A escuridão esconde os detalhes do crime..." });
  }
});

io.on('connection', (socket: Socket) => {
  socket.on('join_room', ({ roomCode, playerName, characterId, roomSettings }) => {
    let room = rooms.get(roomCode);
    let playerId = `p_${socket.id.substring(0, 6)}`;

    if (!room) {
      room = createNewRoom(roomCode, playerName, characterId);
      if (roomSettings) room.settings = { ...room.settings, ...roomSettings };
      rooms.set(roomCode, room);
    } else {
      const existing = room.players.find(p => p.name === playerName);
      if (existing) playerId = existing.id;
      else {
         const char = CHARACTERS.find(c => c.id === characterId) || CHARACTERS[room.players.length % CHARACTERS.length];
         room.players.push({
           id: playerId, name: playerName, characterId: char.id, isHost: false, isReady: true, isAI: false,
           seatNumber: room.players.length, methods: [], objects: [], ability: ABILITIES[0], abilityUsed: false, hasAccused: false
         });
      }
    }
    socket.join(roomCode);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.emit('joined_success', { playerId, roomCode });
    broadcastRoom(roomCode);
  });

  socket.on('send_message', ({ text, isWhisper, audioData }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    const sender = room?.players.find(p => p.id === mapping.playerId);
    if (!room || !sender) return;

    const isConspirator = sender.role === 'assassino' || sender.role === 'cumplice';
    const effectiveIsWhisper = Boolean(isWhisper && isConspirator);

    room.messages.push({
      id: `msg_${Date.now()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: effectiveIsWhisper ? sender.role : undefined,
      text: text || '',
      audioData: audioData, // Base64 audio
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWhisper: effectiveIsWhisper,
    });
    broadcastRoom(mapping.roomCode);
  });

  socket.on('add_bot', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room && room.players.length < 12) {
        rooms.set(mapping.roomCode, fillWithAIBots(room, room.players.length + 1));
        broadcastRoom(mapping.roomCode);
      }
    }
  });

  socket.on('remove_bot', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) {
        const lastBotIdx = [...room.players].reverse().findIndex(p => p.isAI);
        if (lastBotIdx !== -1) {
          room.players.splice(room.players.length - 1 - lastBotIdx, 1);
          broadcastRoom(mapping.roomCode);
        }
      }
    }
  });

  socket.on('start_game', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, startGameDistribution(room)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('night_choice', ({ methodId, objectId }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, handleNightChoice(room, mapping.playerId, methodId, objectId)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('oracle_mark', ({ evidenceId, optionIdx, color, coords }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, handleOracleMark(room, evidenceId, optionIdx, color, coords)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('finish_oracle', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, finishOraclePhase(room)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('advance_round', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, handleAdvanceRound(room)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('discard_evidence', ({ evidenceId }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, handleDiscardEvidence(room, evidenceId)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('draw_evidence', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      if (room) { rooms.set(mapping.roomCode, handleDrawNewEvidence(room)); broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('update_character', ({ characterId }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (mapping) {
      const room = rooms.get(mapping.roomCode);
      const player = room?.players.find(p => p.id === mapping.playerId);
      if (player) { player.characterId = characterId; broadcastRoom(mapping.roomCode); }
    }
  });

  socket.on('disconnect', () => { socketToPlayer.delete(socket.id); });
});

setInterval(() => {
  for (const [code, room] of rooms.entries()) {
    if (room.phase === 'INVESTIGACAO' && room.phaseTimerActive && room.phaseTimerRemaining > 0) {
      room.phaseTimerRemaining -= 1;
      if (room.phaseTimerRemaining === 0) room.phaseTimerActive = false;
      broadcastRoom(code);
    }
  }
}, 1000);

setInterval(() => {
  for (const [code, room] of rooms.entries()) {
    if (room.phase === 'INVESTIGACAO' && Math.random() < 0.15) handleAIBotDialogueAsync(code);
  }
}, 5000);

async function startApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  server.listen(PORT, '0.0.0.0', () => console.log(`Running on port ${PORT}`));
}
startApp();
