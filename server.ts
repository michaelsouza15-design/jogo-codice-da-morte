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
// High limit for JSON bodies to support bulk upload of all 129+ cards at once
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Health check endpoint at the very top for container ingress / Cloud Run health checks
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms ? rooms.size : 0 });
});

// Dedicated card layout categories requested by user
export const CARD_CATEGORIES = [
  'personagens',
  'objetos',
  'metodos',
  'eventos',
  'habilidades',
  'marcadores',
  'manual_regras',
  'evidencias',
  'papeis_secretos',
] as const;

export type CardCategory = typeof CARD_CATEGORIES[number];

export const CARD_LAYOUT_DIRS: Record<CardCategory, string> = {
  personagens: path.join(process.cwd(), 'public', 'cards', 'personagens'),
  objetos: path.join(process.cwd(), 'public', 'cards', 'objetos'),
  metodos: path.join(process.cwd(), 'public', 'cards', 'metodos'),
  eventos: path.join(process.cwd(), 'public', 'cards', 'eventos'),
  habilidades: path.join(process.cwd(), 'public', 'cards', 'habilidades'),
  marcadores: path.join(process.cwd(), 'public', 'cards', 'marcadores'),
  manual_regras: path.join(process.cwd(), 'public', 'cards', 'manual_regras'),
  evidencias: path.join(process.cwd(), 'public', 'cards', 'evidencias'),
  papeis_secretos: path.join(process.cwd(), 'public', 'cards', 'papeis_secretos'),
};

export const PUBLIC_ROOT_DIRS: Record<CardCategory, string> = {
  personagens: path.join(process.cwd(), 'public', 'personagens'),
  objetos: path.join(process.cwd(), 'public', 'objetos'),
  metodos: path.join(process.cwd(), 'public', 'metodos'),
  eventos: path.join(process.cwd(), 'public', 'eventos'),
  habilidades: path.join(process.cwd(), 'public', 'habilidades'),
  marcadores: path.join(process.cwd(), 'public', 'marcadores'),
  manual_regras: path.join(process.cwd(), 'public', 'manual_regras'),
  evidencias: path.join(process.cwd(), 'public', 'evidencias'),
  papeis_secretos: path.join(process.cwd(), 'public', 'papeis_secretos'),
};

// Ensure all dedicated layout directories exist on server startup
for (const cat of CARD_CATEGORIES) {
  if (!fs.existsSync(CARD_LAYOUT_DIRS[cat])) {
    fs.mkdirSync(CARD_LAYOUT_DIRS[cat], { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_ROOT_DIRS[cat])) {
    fs.mkdirSync(PUBLIC_ROOT_DIRS[cat], { recursive: true });
  }
}

// Ensure public/audio, public/characters, and public/cards directories exist and are served statically
const audioDir = path.join(process.cwd(), 'public', 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}
app.use('/audio', express.static(audioDir));
const distAudioDir = path.join(process.cwd(), 'dist', 'audio');
if (fs.existsSync(distAudioDir)) {
  app.use('/audio', express.static(distAudioDir));
}

const charDir = path.join(process.cwd(), 'public', 'characters');
if (!fs.existsSync(charDir)) {
  fs.mkdirSync(charDir, { recursive: true });
}
app.use('/characters', express.static(charDir));
const distCharDir = path.join(process.cwd(), 'dist', 'characters');
if (fs.existsSync(distCharDir)) {
  app.use('/characters', express.static(distCharDir));
}

// Serve all dedicated layout folders statically
for (const cat of CARD_CATEGORIES) {
  app.use(`/cards/${cat}`, express.static(CARD_LAYOUT_DIRS[cat]));
  app.use(`/${cat}`, express.static(PUBLIC_ROOT_DIRS[cat]));
  const distCat = path.join(process.cwd(), 'dist', 'cards', cat);
  if (fs.existsSync(distCat)) {
    app.use(`/cards/${cat}`, express.static(distCat));
  }
  const distRootCat = path.join(process.cwd(), 'dist', cat);
  if (fs.existsSync(distRootCat)) {
    app.use(`/${cat}`, express.static(distRootCat));
  }
}

const cardsDir = path.join(process.cwd(), 'public', 'cards');
if (!fs.existsSync(cardsDir)) {
  fs.mkdirSync(cardsDir, { recursive: true });
}
const distCardsDir = path.join(process.cwd(), 'dist', 'cards');

// Load alias map if available
let cardAliasMap: Record<string, string> = {};
const aliasMapPath = path.join(cardsDir, 'alias_map.json');
try {
  if (fs.existsSync(aliasMapPath)) {
    cardAliasMap = JSON.parse(fs.readFileSync(aliasMapPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not load card alias map:', e);
}

// Custom /cards handler with intelligent format fallback (.png, .webp, .jpg), layout subfolders, alias map, and case-insensitivity
app.get('/cards/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  if (!fileName || fileName.includes('..')) {
    return res.status(404).send('Invalid file name');
  }

  // Compile comprehensive list of search directories including all dedicated layout folders
  const searchDirs: string[] = [cardsDir];
  for (const cat of CARD_CATEGORIES) {
    searchDirs.push(CARD_LAYOUT_DIRS[cat]);
    searchDirs.push(PUBLIC_ROOT_DIRS[cat]);
  }
  searchDirs.push(charDir);
  if (fs.existsSync(distCardsDir)) searchDirs.push(distCardsDir);
  if (fs.existsSync(distCharDir)) searchDirs.push(distCharDir);

  // 1. Direct file check across all card layout folders
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const directPath = path.join(dir, fileName);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return res.sendFile(directPath);
    }
  }

  // 2. Extension-agnostic check (.png, .webp, .jpg, .jpeg, .svg)
  const ext = path.extname(fileName);
  const baseName = ext ? path.basename(fileName, ext) : fileName;
  const commonExtensions = ['.png', '.webp', '.jpg', '.jpeg', '.svg'];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const testExt of commonExtensions) {
      const candidate = path.join(dir, `${baseName}${testExt}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return res.sendFile(candidate);
      }
      const lowerCandidate = path.join(dir, `${baseName.toLowerCase()}${testExt}`);
      if (fs.existsSync(lowerCandidate) && fs.statSync(lowerCandidate).isFile()) {
        return res.sendFile(lowerCandidate);
      }
      const upperCandidate = path.join(dir, `${baseName.toUpperCase()}${testExt}`);
      if (fs.existsSync(upperCandidate) && fs.statSync(upperCandidate).isFile()) {
        return res.sendFile(upperCandidate);
      }
    }
  }

  // 3. Alias map lookup (ONLY if target file exists on disk)
  const cleanKey = baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '');
  const target = cardAliasMap[fileName] ||
    cardAliasMap[fileName.toLowerCase()] ||
    cardAliasMap[fileName.toUpperCase()] ||
    cardAliasMap[baseName] ||
    cardAliasMap[baseName.toLowerCase()] ||
    cardAliasMap[baseName.toUpperCase()] ||
    cardAliasMap[cleanKey];

  if (target) {
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const aliasPath = path.join(dir, target);
      if (fs.existsSync(aliasPath) && fs.statSync(aliasPath).isFile()) {
        return res.sendFile(aliasPath);
      }
      // Target extension fallback
      const targetBase = path.basename(target, path.extname(target));
      for (const testExt of commonExtensions) {
        const targetCandidate = path.join(dir, `${targetBase}${testExt}`);
        if (fs.existsSync(targetCandidate) && fs.statSync(targetCandidate).isFile()) {
          return res.sendFile(targetCandidate);
        }
      }
    }
  }

  // DO NOT fall through to SPA index.html for missing card images!
  return res.status(404).send('Card image not found');
});
app.use('/cards', express.static(cardsDir));
if (fs.existsSync(distCardsDir)) {
  app.use('/cards', express.static(distCardsDir));
}

const framesDir = path.join(process.cwd(), 'public', 'frames');
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}
app.use('/frames', express.static(framesDir));
const distFramesDir = path.join(process.cwd(), 'dist', 'frames');
if (fs.existsSync(distFramesDir)) {
  app.use('/frames', express.static(distFramesDir));
}

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  },
});

// Helper to get or create manifest for cards
const cardManifestPath = path.join(cardsDir, 'manifest.json');
function getCardsManifest(): Record<string, { fileName: string; cardId: string; updatedAt: number }> {
  try {
    if (fs.existsSync(cardManifestPath)) {
      return JSON.parse(fs.readFileSync(cardManifestPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading cards manifest:', err);
  }
  return {};
}

function saveCardsManifest(manifest: Record<string, { fileName: string; cardId: string; updatedAt: number }>) {
  try {
    fs.writeFileSync(cardManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving cards manifest:', err);
  }
}

// REST API to list all server-persisted card artworks
app.get('/api/cards/list', (req, res) => {
  try {
    const manifest = getCardsManifest();
    const result: Record<string, string> = {};
    
    // Scan physical files in public/cards/ and dist/cards/ (only true existing files)
    const scanCardsDir = (dir: string) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file === 'manifest.json' || file === 'alias_map.json' || file.startsWith('.')) continue;
          const ext = path.extname(file).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
            const cardId = path.basename(file, ext);
            const stat = fs.statSync(path.join(dir, file));
            result[cardId] = `/cards/${file}?v=${stat.mtimeMs}`;
            result[cardId.toUpperCase()] = `/cards/${file}?v=${stat.mtimeMs}`;
            result[cardId.toLowerCase()] = `/cards/${file}?v=${stat.mtimeMs}`;
          }
        }
      }
    };

    scanCardsDir(cardsDir);
    if (fs.existsSync(distCardsDir)) {
      scanCardsDir(distCardsDir);
    }

    // Scan all dedicated layout directories
    for (const cat of CARD_CATEGORIES) {
      const scanCatDir = (dir: string, category: string, isPublicRoot: boolean = false) => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            if (file === 'manifest.json' || file === 'alias_map.json' || file.startsWith('.')) continue;
            const ext = path.extname(file).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
              const cardId = path.basename(file, ext);
              const stat = fs.statSync(path.join(dir, file));
              // If it's in public root, URL is /category/file, else /cards/category/file
              const assetUrl = isPublicRoot
                ? `/${category}/${file}?v=${stat.mtimeMs}`
                : `/cards/${category}/${file}?v=${stat.mtimeMs}`;
              result[cardId] = assetUrl;
              result[cardId.toUpperCase()] = assetUrl;
              result[cardId.toLowerCase()] = assetUrl;
            }
          }
        }
      };

      scanCatDir(CARD_LAYOUT_DIRS[cat], cat, false);
      scanCatDir(PUBLIC_ROOT_DIRS[cat], cat, true);
      const distCat = path.join(process.cwd(), 'dist', 'cards', cat);
      if (fs.existsSync(distCat)) scanCatDir(distCat, cat, false);
      const distRootCat = path.join(process.cwd(), 'dist', cat);
      if (fs.existsSync(distRootCat)) scanCatDir(distRootCat, cat, true);
    }

    // Scan physical characters in public/characters/ and dist/characters/
    const scanCharDir = (dir: string) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const ext = path.extname(file).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            const base = path.basename(file, ext);
            const stat = fs.statSync(path.join(dir, file));
            const charUrl = `/characters/${file}?v=${stat.mtimeMs}`;
            result[base] = charUrl;
            result[base.toLowerCase()] = charUrl;
            result[base.toUpperCase()] = charUrl;
            const numMatch = base.match(/\d+/);
            if (numMatch) {
              const slot = parseInt(numMatch[0], 10);
              const padSlot = String(slot).padStart(2, '0');
              const padNum = String(slot + 1).padStart(2, '0');
              result[`char_${padSlot}`] = charUrl;
              result[`char_${slot}`] = charUrl;
              result[`personagem_${padNum}`] = charUrl;
              result[`personagem_${slot + 1}`] = charUrl;
              result[`char_card_personagem_${padNum}`] = charUrl;
              result[`crest_personagem_${padNum}`] = charUrl;
              result[`perso_${slot + 1}`] = charUrl;
              result[`perso${slot + 1}`] = charUrl;
              result[`p${padNum}`] = charUrl;
              result[`c${padNum}`] = charUrl;
            }
          }
        }
      }
    };
    scanCharDir(charDir);
    if (fs.existsSync(distCharDir)) {
      scanCharDir(distCharDir);
    }

    // Merge with alias map ONLY if the canonical file actually exists on disk
    for (const [alias, canonical] of Object.entries(cardAliasMap)) {
      const canonicalPath = path.join(cardsDir, canonical);
      const distCanonicalPath = path.join(distCardsDir, canonical);
      const exists = fs.existsSync(canonicalPath) || (fs.existsSync(distCardsDir) && fs.existsSync(distCanonicalPath));
      if (exists) {
        const stat = fs.existsSync(canonicalPath) ? fs.statSync(canonicalPath) : fs.statSync(distCanonicalPath);
        const aliasClean = alias.replace(/\.[^/.]+$/, '');
        if (!result[aliasClean]) {
          result[aliasClean] = `/cards/${canonical}?v=${stat.mtimeMs}`;
          result[aliasClean.toUpperCase()] = `/cards/${canonical}?v=${stat.mtimeMs}`;
          result[aliasClean.toLowerCase()] = `/cards/${canonical}?v=${stat.mtimeMs}`;
        }
      }
    }

    // Merge with manifest ONLY if physical file exists
    for (const [id, info] of Object.entries(manifest)) {
      if (fs.existsSync(path.join(cardsDir, info.fileName)) || (fs.existsSync(distCardsDir) && fs.existsSync(path.join(distCardsDir, info.fileName)))) {
        result[id] = `/cards/${info.fileName}?v=${info.updatedAt}`;
      }
    }

    // Real distinct physical cards stats
    const physicalCards = new Set<string>();
    for (const k of Object.keys(result)) {
      physicalCards.add(k.toUpperCase());
    }
    const methodsCount = Array.from(physicalCards).filter(k => /^M\d{2}$/i.test(k)).length;
    const objectsCount = Array.from(physicalCards).filter(k => /^O\d{2}$/i.test(k)).length;
    const rolesCount = Array.from(physicalCards).filter(k => k.startsWith('ROLE_') || /^R0[1-5]$/i.test(k)).length;
    const markersCount = Array.from(physicalCards).filter(k => k.startsWith('SEAL_') || k.startsWith('MARCADOR_')).length;

    res.json({
      cards: result,
      stats: {
        total: physicalCards.size,
        methodsCount,
        objectsCount,
        rolesCount,
        markersCount,
      },
    });
  } catch (err: unknown) {
    console.error('Error listing cards:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Export all physical card artworks as a single JSON bundle for backup
app.get('/api/cards/export-bundle', (req, res) => {
  try {
    const bundle: Record<string, string> = {};
    const searchDirs = [cardsDir];
    if (fs.existsSync(distCardsDir)) searchDirs.push(distCardsDir);

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === 'manifest.json' || file === 'alias_map.json' || file.startsWith('.')) continue;
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
          const cardId = path.basename(file, ext);
          const buffer = fs.readFileSync(path.join(dir, file));
          const mime = ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/png';
          bundle[cardId] = `data:${mime};base64,${buffer.toString('base64')}`;
        }
      }
    }

    res.json({
      success: true,
      count: Object.keys(bundle).length,
      cards: bundle,
    });
  } catch (err: unknown) {
    console.error('Error exporting card bundle:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Endpoint to inspect card category directories count and files
app.get('/api/cards/directories', (req, res) => {
  try {
    const summary: Record<string, { count: number; files: string[]; path: string }> = {};
    for (const cat of CARD_CATEGORIES) {
      const dir = CARD_LAYOUT_DIRS[cat];
      let files: string[] = [];
      if (fs.existsSync(dir)) {
        files = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
      }
      summary[cat] = {
        count: files.length,
        files,
        path: `public/cards/${cat}`,
      };
    }
    res.json({ success: true, directories: summary });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Endpoint to clear/reset a specific directory (e.g. 'personagens')
app.post('/api/cards/clear-directory', (req, res) => {
  try {
    const { category } = req.body;
    if (!category || !CARD_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Categoria inválida. Categorias permitidas: ${CARD_CATEGORIES.join(', ')}` });
    }

    const targetDir = CARD_LAYOUT_DIRS[category as CardCategory];
    const rootDir = PUBLIC_ROOT_DIRS[category as CardCategory];
    let removedCount = 0;

    const clearFolder = (dir: string) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          try {
            fs.unlinkSync(path.join(dir, file));
            removedCount++;
          } catch (e) {}
        }
      }
    };

    clearFolder(targetDir);
    clearFolder(rootDir);

    if (category === 'personagens') {
      // Also clear characters folder and aliases
      clearFolder(charDir);
      const distCharDir = path.join(process.cwd(), 'dist', 'characters');
      clearFolder(distCharDir);
      for (let i = 0; i < 42; i++) {
        const pad = String(i).padStart(2, '0');
        delete cardAliasMap[`char_${pad}`];
        delete cardAliasMap[`char_${i}`];
        delete cardAliasMap[`personagem_${String(i + 1).padStart(2, '0')}`];
        delete cardAliasMap[`perso_${i + 1}`];
      }
      try {
        fs.writeFileSync(aliasMapPath, JSON.stringify(cardAliasMap, null, 2), 'utf8');
      } catch (e) {}
    }

    res.json({
      success: true,
      message: `Pasta ${category} limpa com sucesso.`,
      removedCount,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Character slot matcher for 42 characters (slots 0..41, numbers 1..42)
const CHARACTER_SLOT_NAMES: Record<number, string[]> = {
  0: ['perita forense', 'perita', 'rafael', 'char_00', '01'],
  1: ['advogada', 'lia', 'char_01', '02'],
  2: ['jornalista', 'reporter', 'bruno', 'char_02', '03'],
  3: ['medico', 'clinico', 'sofia', 'char_03', '04'],
  4: ['enfermeira', 'marcus', 'char_04', '05'],
  5: ['seguranca', 'elena', 'char_05', '06'],
  6: ['hacker', 'lucas', 'char_06', '07'],
  7: ['analista de dados', 'analista', 'clara', 'char_07', '08'],
  8: ['psicologo', 'gabriel', 'char_08', '09'],
  9: ['criminalista', 'isabela', 'char_09', '10'],
  10: ['detetive particular', 'felipe', 'char_10', '11'],
  11: ['detetive', 'camila', 'char_11', '12'],
  12: ['policial', 'rodrigo', 'char_12', '13'],
  13: ['fotografa', 'juliana', 'char_13', '14'],
  14: ['arquivista', 'antonio', 'char_14', '15'],
  15: ['historiadora', 'beatriz', 'char_15', '16'],
  16: ['professor', 'henrique', 'char_16', '17'],
  17: ['perita digital', 'marina', 'char_17', '18'],
  18: ['juiz', 'arthur', 'char_18', '19'],
  19: ['promotora', 'valentina', 'char_19', '20'],
  20: ['jornalista investigativo', 'luciano', 'char_20', '21'],
  21: ['especialista em perfis', 'profiler', 'helena', 'char_21', '22'],
  22: ['relojoeiro', 'roberto', 'char_22', '23'],
  23: ['curadora', 'daniela', 'char_23', '24'],
  24: ['artista', 'tiago', 'char_24', '25'],
  25: ['musico', 'larissa', 'char_25', '26'],
  26: ['atriz', 'andre', 'char_26', '27'],
  27: ['empresario', 'patricia', 'char_27', '28'],
  28: ['empresaria', 'marcos', 'char_28', '29'],
  29: ['chef', 'cozinheiro', 'renata', 'char_29', '30'],
  30: ['governanta', 'gustavo', 'char_30', '31'],
  31: ['motorista', 'aline', 'char_31', '32'],
  32: ['arquiteta', 'marcelo', 'char_32', '33'],
  33: ['engenheiro', 'sabrina', 'char_33', '34'],
  34: ['medica legista', 'legista', 'rodrigo_m', 'char_34', '35'],
  35: ['sociologo', 'vanessa', 'char_35', '36'],
  36: ['investigadora particular', 'caio', 'char_36', '37'],
  37: ['colecionador', 'julio', 'char_37', '38'],
  38: ['herdeira', 'clarice', 'char_38', '39'],
  39: ['reitor', 'eduardo', 'char_39', '40'],
  40: ['investidora', 'herdeira das sombras', 'paula', 'char_40', '41'],
  41: ['estranho', 'leonardo', 'char_41', '42'],
};

function resolveCharacterSlot(identifier?: string, fileName?: string): number | null {
  const rawCombined = `${identifier || ''} ${fileName || ''}`.trim();
  const combined = rawCombined.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Strict guard: Never interpret methods, objects, roles, evidences, events, abilities, or markers as characters
  if (
    /^(?:m|metodo)0*([1-9]|[1-5][0-9]|60)(?:[^a-z0-9]|$)/i.test(combined) ||
    /^(?:o|obj|objeto)0*([1-9]|[1-5][0-9]|6[0-4])(?:[^a-z0-9]|$)/i.test(combined) ||
    /^(?:r0[1-5]|role_|papel[1-5])(?:[^a-z0-9]|$)/i.test(combined) ||
    /^(?:e|evidencia)0*([1-9]|[1-5][0-9]|60)(?:[^a-z0-9]|$)/i.test(combined) ||
    /^(?:ev|evento)0*([1-9]|1[0-6])(?:[^a-z0-9]|$)/i.test(combined) ||
    /^(?:h|hab|habilidade)0*([1-9]|1[0-2])(?:[^a-z0-9]|$)/i.test(combined) ||
    /^(?:seal_|marcador[1-5]|selo[1-5])/i.test(combined) ||
    combined.includes('manual_regras') ||
    combined.includes('rules_reference') ||
    combined.includes('codice_regras')
  ) {
    return null;
  }
  
  // 1. Direct match with char_XX (00 to 41)
  const charMatch = combined.match(/\bchar_?0*([0-9]{1,2})\b/);
  if (charMatch) {
    const num = parseInt(charMatch[1], 10);
    if (num >= 0 && num <= 41) return num;
  }

  // 2. Direct match with personagem_XX or persoXX (01 to 42, or 00 to 41)
  const persoMatch = combined.match(/\b(?:personagem|perso|suspeito|charcard)[-_ ]?0*([0-9]{1,2})\b/);
  if (persoMatch) {
    const num = parseInt(persoMatch[1], 10);
    if (num >= 1 && num <= 42) return num - 1;
    if (num === 0) return 0;
  }

  // 3. Match leading number in filename ONLY if character indicators are present
  const leadingNumMatch = combined.match(/(?:^|[^0-9])0?([1-9]|[1-3][0-9]|4[0-2])[-_ .]/);
  if (leadingNumMatch && (combined.includes('char') || combined.includes('personagem') || combined.includes('perso') || combined.includes('suspeito') || combined.includes('perita') || combined.includes('advogada') || combined.includes('jornalista') || combined.includes('investigad'))) {
    const num = parseInt(leadingNumMatch[1], 10);
    if (num >= 1 && num <= 42) return num - 1;
  }

  // 4. Match by role names / aliases with strict word-boundary matching
  for (let slot = 0; slot < 42; slot++) {
    const aliases = CHARACTER_SLOT_NAMES[slot];
    if (aliases) {
      for (const alias of aliases) {
        const cleanAlias = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const escaped = cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
        if (regex.test(combined)) {
          return slot;
        }
      }
    }
  }

  return null;
}

function saveCharacterDirect(slotIndex: number, buffer: Buffer) {
  const pad = String(slotIndex).padStart(2, '0');
  const persoNum = String(slotIndex + 1).padStart(2, '0');
  const targetFileName = `char_${pad}.png`;
  const persoFileName = `perso_${slotIndex + 1}.png`;

  // 1. Save to dedicated layout folder: public/cards/personagens/
  const cardPersonagemPath = path.join(CARD_LAYOUT_DIRS.personagens, targetFileName);
  const cardPersoPath = path.join(CARD_LAYOUT_DIRS.personagens, persoFileName);
  fs.writeFileSync(cardPersonagemPath, buffer);
  fs.writeFileSync(cardPersoPath, buffer);

  // 2. Save to public/personagens/
  const rootPersonagemPath = path.join(PUBLIC_ROOT_DIRS.personagens, targetFileName);
  const rootPersoPath = path.join(PUBLIC_ROOT_DIRS.personagens, persoFileName);
  fs.writeFileSync(rootPersonagemPath, buffer);
  fs.writeFileSync(rootPersoPath, buffer);

  // 3. Save to public/characters/ for game avatar engine
  const targetPath = path.join(charDir, targetFileName);
  fs.writeFileSync(targetPath, buffer);

  // 4. Dist mirrors if dist exists
  if (fs.existsSync(distCharDir)) {
    try {
      fs.writeFileSync(path.join(distCharDir, targetFileName), buffer);
      const distCardsPersoDir = path.join(process.cwd(), 'dist', 'cards', 'personagens');
      if (fs.existsSync(distCardsPersoDir)) {
        fs.writeFileSync(path.join(distCardsPersoDir, targetFileName), buffer);
        fs.writeFileSync(path.join(distCardsPersoDir, persoFileName), buffer);
      }
      const distRootPersoDir = path.join(process.cwd(), 'dist', 'personagens');
      if (fs.existsSync(distRootPersoDir)) {
        fs.writeFileSync(path.join(distRootPersoDir, targetFileName), buffer);
        fs.writeFileSync(path.join(distRootPersoDir, persoFileName), buffer);
      }
    } catch (e) {
      console.warn('Could not write character to dist:', e);
    }
  }

  // Remove duplicate/obsolete files (jpg, jpeg, webp) for this slot to eliminate bloat
  const extsToRemove = ['.jpg', '.jpeg', '.webp'];
  for (const ext of extsToRemove) {
    const oldPublic = path.join(charDir, `char_${pad}${ext}`);
    if (fs.existsSync(oldPublic)) {
      try { fs.unlinkSync(oldPublic); } catch (e) {}
    }
    if (fs.existsSync(distCharDir)) {
      const oldDist = path.join(distCharDir, `char_${pad}${ext}`);
      if (fs.existsSync(oldDist)) {
        try { fs.unlinkSync(oldDist); } catch (e) {}
      }
    }
  }

  // Also remove duplicate files from cardsDir if they were mistakenly saved there before
  const potentialCardDuplicates = [
    `char_${pad}.png`,
    `char_${pad}.jpg`,
    `char_${pad}.webp`,
    `char_${pad}.jpeg`,
    `char_card_char_${pad}.png`,
    `char_card_char_${pad}.jpg`,
    `personagem_${persoNum}.png`,
    `personagem_${persoNum}.jpg`,
    `char_card_personagem_${persoNum}.png`,
    `char_card_personagem_${persoNum}.jpg`,
    `crest_personagem_${persoNum}.png`,
    `perso_${slotIndex + 1}.png`,
    `perso_${persoNum}.png`,
  ];
  for (const dupName of potentialCardDuplicates) {
    const dupPath = path.join(cardsDir, dupName);
    if (fs.existsSync(dupPath)) {
      try { fs.unlinkSync(dupPath); } catch (e) {}
    }
    if (fs.existsSync(distCardsDir)) {
      const dupDist = path.join(distCardsDir, dupName);
      if (fs.existsSync(dupDist)) {
        try { fs.unlinkSync(dupDist); } catch (e) {}
      }
    }
  }

  const now = Date.now();
  const charUrl = `/characters/${targetFileName}?v=${now}`;
  
  // Register in alias map & manifest so any query or database sync uses this exact canonical PNG
  const charAliases = [
    `char_${pad}`,
    `char_${slotIndex}`,
    `personagem_${persoNum}`,
    `personagem_${slotIndex + 1}`,
    `char_card_personagem_${persoNum}`,
    `crest_personagem_${persoNum}`,
    `crest_char_${pad}`,
    `perso_${slotIndex + 1}`,
    `perso${slotIndex + 1}`,
  ];

  const manifest = getCardsManifest();
  for (const a of charAliases) {
    cardAliasMap[a] = `../characters/${targetFileName}`;
    cardAliasMap[a.toLowerCase()] = `../characters/${targetFileName}`;
    cardAliasMap[a.toUpperCase()] = `../characters/${targetFileName}`;
    manifest[a] = { fileName: targetFileName, cardId: `char_${pad}`, updatedAt: now };
  }
  saveCardsManifest(manifest);
  try {
    fs.writeFileSync(aliasMapPath, JSON.stringify(cardAliasMap, null, 2), 'utf8');
    if (fs.existsSync(distCardsDir)) {
      fs.writeFileSync(path.join(distCardsDir, 'alias_map.json'), JSON.stringify(cardAliasMap, null, 2), 'utf8');
      fs.writeFileSync(path.join(distCardsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    }
  } catch (e) {}

  console.log(`[Characters Server] Saved character #${slotIndex + 1} (${targetFileName}) to public/cards/personagens/, public/personagens/, and public/characters/ (${(buffer.length / 1024).toFixed(1)} KB)`);
  
  return {
    success: true,
    slot: slotIndex,
    number: slotIndex + 1,
    characterId: `personagem_${persoNum}`,
    fileName: targetFileName,
    url: charUrl,
    replaced: true,
  };
}

// Unified card, rule manual, marker, audio, and character replacement without duplication
function saveCardDirect(cardId: string, buffer: Buffer, fileName?: string): any {
  const cleanId = cardId.trim();

  // 1. If it's a character, route directly to saveCharacterDirect
  const charSlot = resolveCharacterSlot(cleanId, fileName);
  if (charSlot !== null) {
    return saveCharacterDirect(charSlot, buffer);
  }

  // 2. Audio track handling
  const cleanLower = cleanId.toLowerCase();
  const fileLower = (fileName || '').toLowerCase();
  if (
    fileLower.endsWith('.mp3') ||
    cleanLower.includes('rastro') ||
    cleanLower.includes('cupula') ||
    cleanLower.includes('eu_vou_achar') ||
    cleanLower.includes('codice_sombras') ||
    cleanLower.includes('dracula')
  ) {
    let trackKey = 'rastro_trevas';
    let targetFileName = 'rastro_nas_trevas.mp3';
    if (cleanLower.includes('cupula') || fileLower.includes('cupula')) {
      trackKey = 'a_luz_na_cupula';
      targetFileName = 'a_luz_na_cupula.mp3';
    } else if (cleanLower.includes('achar') || fileLower.includes('achar')) {
      trackKey = 'eu_vou_achar';
      targetFileName = 'eu_vou_achar.mp3';
    } else if (cleanLower.includes('sombras') || fileLower.includes('sombras')) {
      trackKey = 'codice_sombras';
      targetFileName = 'codice_das_sombras.mp3';
    } else if (cleanLower.includes('dracula') || fileLower.includes('dracula')) {
      trackKey = 'despertar_dracula';
      targetFileName = 'despertar_dracula.mp3';
    }
    const audioFilePath = path.join(audioDir, targetFileName);
    fs.writeFileSync(audioFilePath, buffer);
    if (fs.existsSync(distAudioDir)) {
      try {
        fs.writeFileSync(path.join(distAudioDir, targetFileName), buffer);
      } catch (e) {}
    }
    const now = Date.now();
    return {
      success: true,
      cardId: trackKey,
      fileName: targetFileName,
      url: `/audio/${targetFileName}?v=${now}`,
      replaced: true,
    };
  }

  // 3. Resolve canonical card ID and dedicated layout folder
  let canonicalId = cleanId;
  let layoutCategory: CardCategory | null = null;
  const aliasesToMap: string[] = [cleanId, cleanId.toLowerCase(), cleanId.toUpperCase()];

  // Rules manual
  if (
    cleanLower === 'rules_reference' ||
    cleanLower.includes('manual_regras') ||
    cleanLower.includes('codice_regras') ||
    cleanLower.includes('reference_card') ||
    cleanLower.includes('regras') ||
    cleanLower.includes('manual')
  ) {
    canonicalId = 'rules_reference';
    layoutCategory = 'manual_regras';
    aliasesToMap.push('rules_reference', 'codice_regras', 'manual_regras', 'reference_card', 'codice_manual', 'manual', 'regras', 'carta_regras');
  }
  // Methods (M01 to M60)
  else if (/^(?:m|metodo)0*([1-9]|[1-5][0-9]|60)$/i.test(cleanId)) {
    const m = cleanId.match(/^(?:m|metodo)0*([1-9]|[1-5][0-9]|60)$/i);
    if (m) {
      canonicalId = `M${String(parseInt(m[1], 10)).padStart(2, '0')}`;
      layoutCategory = 'metodos';
      aliasesToMap.push(canonicalId, canonicalId.toLowerCase(), `metodo_${canonicalId.toLowerCase()}`, `metodo_${m[1]}`);
    }
  }
  // Objects (O01 to O64)
  else if (/^(?:o|obj|objeto)0*([1-9]|[1-5][0-9]|6[0-4])$/i.test(cleanId)) {
    const o = cleanId.match(/^(?:o|obj|objeto)0*([1-9]|[1-5][0-9]|6[0-4])$/i);
    if (o) {
      canonicalId = `O${String(parseInt(o[1], 10)).padStart(2, '0')}`;
      layoutCategory = 'objetos';
      aliasesToMap.push(canonicalId, canonicalId.toLowerCase(), `obj_${canonicalId.toLowerCase()}`, `objeto_${canonicalId.toLowerCase()}`, `objeto_${o[1]}`);
    }
  }
  // Evidences (E01 to E60)
  else if (/^(?:e|evidencia)0*([1-9]|[1-5][0-9]|60)$/i.test(cleanId)) {
    const eMatch = cleanId.match(/^(?:e|evidencia)0*([1-9]|[1-5][0-9]|60)$/i);
    if (eMatch) {
      canonicalId = `E${String(parseInt(eMatch[1], 10)).padStart(2, '0')}`;
      layoutCategory = 'evidencias';
      aliasesToMap.push(canonicalId, canonicalId.toLowerCase(), `evidencia_${canonicalId.toLowerCase()}`);
    }
  }
  // Events (EV01 to EV16)
  else if (/^(?:ev|evento)0*([1-9]|1[0-6])$/i.test(cleanId)) {
    const evMatch = cleanId.match(/^(?:ev|evento)0*([1-9]|1[0-6])$/i);
    if (evMatch) {
      canonicalId = `EV${String(parseInt(evMatch[1], 10)).padStart(2, '0')}`;
      layoutCategory = 'eventos';
      aliasesToMap.push(canonicalId, canonicalId.toLowerCase(), `evento_${canonicalId.toLowerCase()}`);
    }
  }
  // Abilities (H01 to H12)
  else if (/^(?:h|hab|habilidade)0*([1-9]|1[0-2])$/i.test(cleanId)) {
    const hMatch = cleanId.match(/^(?:h|hab|habilidade)0*([1-9]|1[0-2])$/i);
    if (hMatch) {
      canonicalId = `H${String(parseInt(hMatch[1], 10)).padStart(2, '0')}`;
      layoutCategory = 'habilidades';
      aliasesToMap.push(canonicalId, canonicalId.toLowerCase(), `habilidade_${canonicalId.toLowerCase()}`);
    }
  }
  // Roles
  else if (cleanLower.includes('assassino') || cleanLower === 'r01') {
    canonicalId = 'role_assassino';
    layoutCategory = 'papeis_secretos';
    aliasesToMap.push('role_assassino', 'assassino', 'r01', 'R01', 'murderer');
  } else if (cleanLower.includes('oraculo') || cleanLower === 'r02') {
    canonicalId = 'role_oraculo';
    layoutCategory = 'papeis_secretos';
    aliasesToMap.push('role_oraculo', 'oraculo', 'r02', 'R02', 'oracle');
  } else if (cleanLower.includes('investigador') || cleanLower === 'r03') {
    canonicalId = 'role_investigador';
    layoutCategory = 'papeis_secretos';
    aliasesToMap.push('role_investigador', 'investigador', 'r03', 'R03', 'investigator');
  } else if (cleanLower.includes('cumplice') || cleanLower === 'r04') {
    canonicalId = 'role_cumplice';
    layoutCategory = 'papeis_secretos';
    aliasesToMap.push('role_cumplice', 'cumplice', 'r04', 'R04', 'accomplice');
  } else if (cleanLower.includes('sabotador') || cleanLower === 'r05') {
    canonicalId = 'role_sabotador';
    layoutCategory = 'papeis_secretos';
    aliasesToMap.push('role_sabotador', 'sabotador', 'r05', 'R05', 'saboteur');
  }
  // Wax Seals / Markers
  else if (cleanLower.includes('dourado') || cleanLower.includes('ouro') || cleanLower === 'marcador1' || cleanLower === 'marcador_1') {
    canonicalId = 'seal_dourado';
    layoutCategory = 'marcadores';
    aliasesToMap.push('seal_dourado', 'marcador_dourado', 'marcador1', 'marcador_1', 'dourado');
  } else if (cleanLower.includes('vermelho') || cleanLower.includes('rubi') || cleanLower === 'marcador2' || cleanLower === 'marcador_2') {
    canonicalId = 'seal_vermelho';
    layoutCategory = 'marcadores';
    aliasesToMap.push('seal_vermelho', 'marcador_vermelho', 'marcador2', 'marcador_2', 'vermelho');
  } else if (cleanLower.includes('azul') || cleanLower === 'marcador3' || cleanLower === 'marcador_3') {
    canonicalId = 'seal_azul';
    layoutCategory = 'marcadores';
    aliasesToMap.push('seal_azul', 'marcador_azul', 'marcador3', 'marcador_3', 'azul');
  } else if (cleanLower.includes('cinza') || cleanLower.includes('prata') || cleanLower === 'marcador4' || cleanLower === 'marcador_4') {
    canonicalId = 'seal_cinza';
    layoutCategory = 'marcadores';
    aliasesToMap.push('seal_cinza', 'marcador_cinza', 'marcador4', 'marcador_4', 'cinza');
  } else if (cleanLower.includes('preto') || cleanLower.includes('sombrio') || cleanLower === 'marcador5' || cleanLower === 'marcador_5') {
    canonicalId = 'seal_preto';
    layoutCategory = 'marcadores';
    aliasesToMap.push('seal_preto', 'marcador_preto', 'marcador5', 'marcador_5', 'preto');
  }

  // 4. Overwrite physical PNG file in both public/cards/ AND the dedicated layout folder
  const targetFileName = `${canonicalId}.png`;
  const targetPath = path.join(cardsDir, targetFileName);
  fs.writeFileSync(targetPath, buffer);

  if (layoutCategory && CARD_LAYOUT_DIRS[layoutCategory]) {
    const layoutPath = path.join(CARD_LAYOUT_DIRS[layoutCategory], targetFileName);
    fs.writeFileSync(layoutPath, buffer);
    const rootLayoutPath = path.join(PUBLIC_ROOT_DIRS[layoutCategory], targetFileName);
    fs.writeFileSync(rootLayoutPath, buffer);
  }

  if (fs.existsSync(distCardsDir)) {
    try {
      fs.writeFileSync(path.join(distCardsDir, targetFileName), buffer);
      if (layoutCategory) {
        const distLayout = path.join(process.cwd(), 'dist', 'cards', layoutCategory);
        if (fs.existsSync(distLayout)) {
          fs.writeFileSync(path.join(distLayout, targetFileName), buffer);
        }
        const distRootLayout = path.join(process.cwd(), 'dist', layoutCategory);
        if (fs.existsSync(distRootLayout)) {
          fs.writeFileSync(path.join(distRootLayout, targetFileName), buffer);
        }
      }
    } catch (e) {
      console.warn('Could not write to distCardsDir:', e);
    }
  }

  // 5. Remove any duplicate formats or casing variations on disk
  const formatsToRemove = ['.webp', '.jpg', '.jpeg', '.svg'];
  for (const fmt of formatsToRemove) {
    const oldPublic = path.join(cardsDir, `${canonicalId}${fmt}`);
    if (fs.existsSync(oldPublic)) {
      try {
        fs.unlinkSync(oldPublic);
      } catch (e) {}
    }
    if (fs.existsSync(distCardsDir)) {
      const oldDist = path.join(distCardsDir, `${canonicalId}${fmt}`);
      if (fs.existsSync(oldDist)) {
        try {
          fs.unlinkSync(oldDist);
        } catch (e) {}
      }
    }
  }
  // Also remove lowercase duplicates if canonicalId is uppercase
  if (canonicalId.toLowerCase() !== canonicalId) {
    const lowerP = path.join(cardsDir, `${canonicalId.toLowerCase()}.png`);
    if (fs.existsSync(lowerP)) {
      try {
        fs.unlinkSync(lowerP);
      } catch (e) {}
    }
  }

  // 6. Overwrite cardAliasMap and manifest
  const now = Date.now();
  for (const alias of aliasesToMap) {
    const cleanK = alias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '');
    cardAliasMap[alias] = targetFileName;
    cardAliasMap[alias.toLowerCase()] = targetFileName;
    cardAliasMap[alias.toUpperCase()] = targetFileName;
    cardAliasMap[cleanK] = targetFileName;
  }
  cardAliasMap[targetFileName] = targetFileName;

  const manifest = getCardsManifest();
  manifest[canonicalId] = { fileName: targetFileName, cardId: canonicalId, updatedAt: now };
  manifest[canonicalId.toLowerCase()] = { fileName: targetFileName, cardId: canonicalId, updatedAt: now };
  manifest[canonicalId.toUpperCase()] = { fileName: targetFileName, cardId: canonicalId, updatedAt: now };
  for (const a of aliasesToMap) {
    manifest[a] = { fileName: targetFileName, cardId: canonicalId, updatedAt: now };
  }
  saveCardsManifest(manifest);

  try {
    fs.writeFileSync(aliasMapPath, JSON.stringify(cardAliasMap, null, 2), 'utf8');
    if (fs.existsSync(distCardsDir)) {
      fs.writeFileSync(path.join(distCardsDir, 'alias_map.json'), JSON.stringify(cardAliasMap, null, 2), 'utf8');
      fs.writeFileSync(path.join(distCardsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('Could not write alias map/manifest:', e);
  }

  const categoryMsg = layoutCategory ? ` (folder: ${layoutCategory})` : '';
  console.log(`[Cards Server] Replaced card art '${canonicalId}' (${targetFileName})${categoryMsg} directly without duplication (${(buffer.length / 1024).toFixed(1)} KB)`);

  const primaryUrl = layoutCategory ? `/cards/${layoutCategory}/${targetFileName}?v=${now}` : `/cards/${targetFileName}?v=${now}`;

  return {
    success: true,
    cardId: canonicalId,
    category: layoutCategory || 'outros',
    fileName: targetFileName,
    url: primaryUrl,
    replaced: true,
  };
}

// REST API to upload or replace a character PNG directly (/public/characters/char_XX.png)
app.post('/api/characters/upload', (req, res) => {
  try {
    const { characterIndex, characterId, base64Data, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data é obrigatório' });
    }

    let slot: number | null = null;
    if (typeof characterIndex === 'number' && characterIndex >= 0 && characterIndex < 42) {
      slot = characterIndex;
    } else {
      slot = resolveCharacterSlot(characterId, fileName);
    }

    if (slot === null) {
      return res.status(400).json({ error: 'Não foi possível identificar o personagem (1 a 42)' });
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = saveCharacterDirect(slot, buffer);
    res.json(result);
  } catch (err: unknown) {
    console.error('Error saving character art:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to bulk upload or replace character PNGs directly
app.post('/api/characters/bulk', (req, res) => {
  try {
    const { characters } = req.body;
    if (!characters || !Array.isArray(characters) || characters.length === 0) {
      return res.status(400).json({ error: 'Lista de personagens inválida ou vazia' });
    }

    const saved: any[] = [];
    for (const item of characters) {
      const { characterIndex, characterId, base64Data, fileName } = item;
      if (!base64Data) continue;

      let slot: number | null = null;
      if (typeof characterIndex === 'number' && characterIndex >= 0 && characterIndex < 42) {
        slot = characterIndex;
      } else {
        slot = resolveCharacterSlot(characterId, fileName);
      }

      if (slot !== null) {
        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        saved.push(saveCharacterDirect(slot, buffer));
      }
    }

    res.json({ success: true, count: saved.length, characters: saved });
  } catch (err: unknown) {
    console.error('Error in bulk character upload:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to upload single card permanently to server disk (/public/cards/)
app.post('/api/cards/upload', (req, res) => {
  try {
    const { cardId, base64Data, fileName } = req.body;
    if (!cardId || !base64Data) {
      return res.status(400).json({ error: 'cardId e base64Data são obrigatórios' });
    }

    const cleanId = cardId.trim();
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = saveCardDirect(cleanId, buffer, fileName);
    res.json(result);
  } catch (err: unknown) {
    console.error('Error saving card art:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to bulk upload cards permanently to server disk (/public/cards/)
app.post('/api/cards/bulk', (req, res) => {
  try {
    const { cards } = req.body;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Lista de cartas inválida ou vazia' });
    }

    const saved: any[] = [];
    for (const item of cards) {
      const { cardId, base64Data, fileName } = item;
      if (!cardId || !base64Data) continue;

      const cleanId = cardId.trim();
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      const result = saveCardDirect(cleanId, buffer, fileName);
      saved.push(result);
    }

    console.log(`[Cards Server] Bulk processed ${saved.length} items without duplication`);
    res.json({
      success: true,
      savedCount: saved.length,
      saved,
    });
  } catch (err: unknown) {
    console.error('Error in bulk card upload:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to delete a custom card from server
app.delete('/api/cards/:cardId', (req, res) => {
  try {
    const { cardId } = req.params;
    if (!cardId) return res.status(400).json({ error: 'cardId obrigatório' });

    const extensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    let removed = false;
    for (const ext of extensions) {
      const p = path.join(cardsDir, `${cardId}${ext}`);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        removed = true;
      }
    }

    const manifest = getCardsManifest();
    delete manifest[cardId];
    saveCardsManifest(manifest);

    res.json({ success: true, removed });
  } catch (err: unknown) {
    console.error('Error deleting card:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to list and upload game frames
app.get('/api/frames/list', (req, res) => {
  try {
    const result: Record<string, string> = {};
    if (fs.existsSync(framesDir)) {
      const files = fs.readdirSync(framesDir);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
          const frameId = path.basename(file, ext);
          const stat = fs.statSync(path.join(framesDir, file));
          result[frameId] = `/frames/${file}?v=${stat.mtimeMs}`;
        }
      }
    }
    res.json({ frames: result });
  } catch (err: unknown) {
    console.error('Error listing frames:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/frames/upload', (req, res) => {
  try {
    const { frameId, base64Data, fileName } = req.body;
    if (!frameId || !base64Data) {
      return res.status(400).json({ error: 'frameId e base64Data são obrigatórios' });
    }

    const cleanId = frameId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z0-9+]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    let ext = '.png';
    if (base64Data.startsWith('data:image/webp')) ext = '.webp';
    else if (base64Data.startsWith('data:image/jpeg') || base64Data.startsWith('data:image/jpg')) ext = '.jpg';
    else if (base64Data.startsWith('data:image/svg+xml')) ext = '.svg';

    const targetFileName = `${cleanId}${ext}`;
    const targetPath = path.join(framesDir, targetFileName);
    fs.writeFileSync(targetPath, buffer);

    console.log(`[Frames Server] Saved frame for ${cleanId} to ${targetPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    res.json({
      success: true,
      frameId: cleanId,
      url: `/frames/${targetFileName}?v=${Date.now()}`,
    });
  } catch (err: unknown) {
    console.error('Error uploading frame:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to clear all custom cards
app.post('/api/cards/clear', (req, res) => {
  try {
    if (fs.existsSync(cardsDir)) {
      const files = fs.readdirSync(cardsDir);
      for (const file of files) {
        if (file === 'manifest.json' || file.startsWith('.')) continue;
        fs.unlinkSync(path.join(cardsDir, file));
      }
    }
    saveCardsManifest({});
    res.json({ success: true });
  } catch (err: unknown) {
    console.error('Error clearing cards:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API to sanitize and purge any cross-contaminated card entries
app.post('/api/cards/sanitize', (req, res) => {
  try {
    let purgedCount = 0;
    const manifest = getCardsManifest();

    // 1. Sanitize cardAliasMap
    for (const key of Object.keys(cardAliasMap)) {
      // Remove bare numeric keys
      if (/^\d+$/.test(key)) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }
      // Remove p01..p42 or c01..c42
      if (/^[pc]\d{1,2}$/i.test(key)) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }

      const target = cardAliasMap[key] || '';
      // Character key pointing to cards folder
      const isCharKey = /^(?:char_|personagem_|perso_|crest_)/i.test(key);
      if (isCharKey && (target.includes('/cards/metodos/') || target.includes('/cards/objetos/') || target.includes('/cards/evidencias/') || target.includes('/cards/eventos/'))) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }

      // Method key pointing to characters
      const isMethodKey = /^(?:m\d{1,2}|metodo_)/i.test(key);
      if (isMethodKey && (target.includes('/characters/') || target.includes('/cards/personagens/') || target.includes('/personagens/'))) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }

      // Object key pointing to characters
      const isObjKey = /^(?:o\d{1,2}|obj_|objeto_)/i.test(key);
      if (isObjKey && (target.includes('/characters/') || target.includes('/cards/personagens/') || target.includes('/personagens/'))) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }

      // Evidence key pointing to characters
      const isEvKey = /^(?:e\d{1,2}|evidencia_)/i.test(key) && !/^ev\d{1,2}/i.test(key);
      if (isEvKey && (target.includes('/characters/') || target.includes('/cards/personagens/') || target.includes('/personagens/'))) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }

      // Event key pointing to characters or evidences
      const isEventKey = /^(?:ev\d{1,2}|evento_)/i.test(key);
      if (isEventKey && (target.includes('/characters/') || target.includes('/cards/personagens/') || target.includes('/cards/evidencias/'))) {
        delete cardAliasMap[key];
        purgedCount++;
        continue;
      }
    }

    // 2. Sanitize manifest
    for (const key of Object.keys(manifest)) {
      if (/^\d+$/.test(key) || /^[pc]\d{1,2}$/i.test(key)) {
        delete manifest[key];
        purgedCount++;
      }
    }

    saveCardsManifest(manifest);
    try {
      fs.writeFileSync(aliasMapPath, JSON.stringify(cardAliasMap, null, 2), 'utf8');
      if (fs.existsSync(distCardsDir)) {
        fs.writeFileSync(path.join(distCardsDir, 'alias_map.json'), JSON.stringify(cardAliasMap, null, 2), 'utf8');
        fs.writeFileSync(path.join(distCardsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      }
    } catch (e) {}

    console.log(`[Cards Server] Sanitized alias map and manifest. Purged ${purgedCount} invalid/cross-contaminated entries.`);
    res.json({ success: true, purgedCount });
  } catch (err: unknown) {
    console.error('Error sanitizing cards:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// In-memory room store
const rooms = new Map<string, RoomState>();
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

// Broadcast sanitized room state to all clients in the room
function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const socketsInRoom = io.sockets.adapter.rooms.get(roomCode);
  if (!socketsInRoom) return;

  for (const socketId of socketsInRoom) {
    const mapping = socketToPlayer.get(socketId);
    if (mapping) {
      const sanitized = sanitizeRoomForPlayer(room, mapping.playerId);
      io.to(socketId).emit('room_update', sanitized);
    }
  }
}

// REST API to check available native audio tracks (up to 5 soundtrack slots)
app.get('/api/tracks/status', (req, res) => {
  const checkTrack = (fileName: string) => {
    return fs.existsSync(path.join(audioDir, fileName)) || fs.existsSync(path.join(distAudioDir, fileName));
  };

  const tracks = {
    rastro_trevas: checkTrack('rastro_nas_trevas.mp3'),
    a_luz_na_cupula: checkTrack('a_luz_na_cupula.mp3'),
    eu_vou_achar: checkTrack('eu_vou_achar.mp3'),
    codice_sombras: checkTrack('codice_das_sombras.mp3'),
    despertar_dracula: checkTrack('despertar_dracula.mp3'),
  };
  res.json({ tracks, total: Object.values(tracks).filter(Boolean).length });
});

// REST API to upload native MP3 track permanently to server disk (/public/audio/) for published version
app.post('/api/tracks/upload', (req, res) => {
  try {
    const { trackId, base64Data } = req.body;
    if (!trackId || !base64Data) {
      return res.status(400).json({ error: 'Parâmetros trackId e base64Data são obrigatórios' });
    }

    const trackFileNames: Record<string, string> = {
      rastro_trevas: 'rastro_nas_trevas.mp3',
      a_luz_na_cupula: 'a_luz_na_cupula.mp3',
      eu_vou_achar: 'eu_vou_achar.mp3',
      codice_sombras: 'codice_das_sombras.mp3',
      despertar_dracula: 'despertar_dracula.mp3',
    };

    const targetFileName = trackFileNames[trackId] || `${trackId}.mp3`;
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filePath = path.join(audioDir, targetFileName);
    const cleanBase64 = base64Data
      .replace(/^data:audio\/[a-z0-9+]+;base64,/, '')
      .replace(/^data:application\/octet-stream;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(filePath, buffer);

    console.log(`[Audio Server] Saved native soundtrack track '${trackId}' to ${filePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    res.json({
      success: true,
      trackId,
      fileName: targetFileName,
      path: `/audio/${targetFileName}?v=${Date.now()}`,
    });
  } catch (err: unknown) {
    console.error('Error saving audio file:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// REST API for health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

// REST API for atmospheric story generator using Gemini (server-side)
app.post('/api/story', async (req, res) => {
  const { methodName, objectName, characterName } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        story: `Nas sombras da ala leste da biblioteca, a vítima foi encontrada sem vida junto aos tomos antigos. A cena do crime guarda indícios perturbadores ligados a ${methodName || 'um método oculto'} e vestígios de ${objectName || 'um objeto suspeito'}.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Você é o narrador gótico e misterioso do jogo de dedução "O Códice da Morte".
Crie um parágrafo curto (2 a 3 frases no máximo), atmosférico e sombrio em português, descrevendo a descoberta do corpo na biblioteca ancestral de uma abadia, com chuva e velas tremeluzentes.
Mencione sutilmente pistas sobre o método "${methodName}" e o objeto "${objectName}", sem revelar quem é o assassino.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const storyText = response.text || '';
    res.json({ story: storyText.trim() });
  } catch (error) {
    console.error('Error generating story with Gemini:', error);
    res.json({
      story: `Nas sombras da ala leste da biblioteca, a vítima foi encontrada sem vida junto aos tomos antigos. A cena do crime guarda indícios perturbadores ligados a ${methodName || 'um método oculto'}.`,
    });
  }
});

// Socket.io Game Events
io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join or Create Room
  socket.on(
    'join_room',
    ({
      roomCode,
      playerName,
      characterId,
      roomSettings,
      roomName,
      gameMode,
    }: {
      roomCode: string;
      playerName: string;
      characterId?: string;
      roomSettings?: any;
      roomName?: string;
      gameMode?: string;
    }) => {
      let room = rooms.get(roomCode);
      let playerId = `p_${socket.id.substring(0, 6)}`;

      if (!room) {
        room = createNewRoom(roomCode, playerName, characterId);
        if (roomSettings) {
          room.settings = { ...room.settings, ...roomSettings };
          if (roomSettings.maxRounds) {
            room.maxRounds = roomSettings.maxRounds;
          }
        }
        if (roomName) room.roomName = roomName;
        if (gameMode) room.gameMode = gameMode;
        // Do not auto-populate room investigators, let host add them manually
        // room = populateLobbyInvestigators(room, room.settings.maxPlayers || 10);
        playerId = room.players[0].id;
        rooms.set(roomCode, room);
      } else {
      // Find existing or add player
      const existing = room.players.find((p) => p.name === playerName);
      if (existing && !existing.isAI) {
        playerId = existing.id;
      } else if (room.phase === 'LOBBY') {
        const char = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[room.players.length % CHARACTERS.length];
        const newPlayer: Player = {
          id: playerId,
          name: playerName || `Investigador ${room.players.length + 1}`,
          characterId: char.id,
          isHost: false,
          isReady: true,
          isAI: false,
          seatNumber: room.players.length,
          methods: [],
          objects: [],
          ability: { id: 'H01', name: 'Observação', effect: 'Habilidade padrão' },
          abilityUsed: false,
          hasAccused: false,
        };

        // If lobby was populated with AI placeholders, replace the first AI bot with the joining human player
        const aiBotIndex = room.players.findIndex((p) => p.isAI);
        if (aiBotIndex !== -1 && room.players.length >= (room.settings.maxPlayers || 10)) {
          newPlayer.seatNumber = room.players[aiBotIndex].seatNumber;
          room.players[aiBotIndex] = newPlayer;
        } else {
          room.players.push(newPlayer);
        }
      }
    }

    socket.join(roomCode);
    socketToPlayer.set(socket.id, { roomCode, playerId });
    socket.emit('joined_success', { playerId, roomCode });
    broadcastRoom(roomCode);
  });

  // Update Selected Character
  socket.on('update_character', ({ characterId }: { characterId: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'LOBBY') return;

    const player = room.players.find((p) => p.id === mapping.playerId);
    if (player) {
      player.characterId = characterId;
      broadcastRoom(mapping.roomCode);
    }
  });

  // Add AI Bot
  socket.on('add_bot', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'LOBBY') return;

    if (room.players.length < room.settings.maxPlayers) {
      const updated = fillWithAIBots(room, room.players.length + 1);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    }
  });

  // Remove AI Bot
  socket.on('remove_bot', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'LOBBY') return;

    const lastBotIndex = [...room.players].reverse().findIndex((p) => p.isAI);
    if (lastBotIndex !== -1) {
      const realIndex = room.players.length - 1 - lastBotIndex;
      room.players.splice(realIndex, 1);
      broadcastRoom(mapping.roomCode);
    }
  });

  // Update Room Settings
  socket.on('update_settings', ({ settings }: { settings: any }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'LOBBY') return;

    room.settings = { ...room.settings, ...settings };
    if (settings.designatedOraclePlayerId !== undefined) {
      room.designatedOraclePlayerId = settings.designatedOraclePlayerId;
    }
    broadcastRoom(mapping.roomCode);
  });

  // Designate Oracle in Lobby
  socket.on('designate_oracle', ({ playerId }: { playerId: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'LOBBY') return;

    room.designatedOraclePlayerId = playerId || undefined;
    broadcastRoom(mapping.roomCode);
  });

  // Start Game (Card distribution & Night Phase)
  socket.on('start_game', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'LOBBY') return;

    try {
      const updated = startGameDistribution(room);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message || 'Erro ao iniciar partida.');
    }
  });

  // Killer Night Choice
  socket.on('night_choice', ({ methodId, objectId }: { methodId: string; objectId: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'NOITE') return;

    try {
      const updated = handleNightChoice(room, mapping.playerId, methodId, objectId);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Accomplice Night Suggestion
  socket.on('suggest_night_choice', ({ methodId, objectId }: { methodId?: string; objectId?: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'NOITE') return;

    const sender = room.players.find((p) => p.id === mapping.playerId);
    if (!sender || sender.role !== 'cumplice') return;

    room.nightSuggestion = {
      methodId,
      objectId,
      suggestedByPlayerId: sender.id,
      suggestedByPlayerName: sender.name,
    };
    if (room.secretSolution) {
      room.secretSolution.suggestedMethodId = methodId;
      room.secretSolution.suggestedObjectId = objectId;
      room.secretSolution.suggestedByPlayerName = sender.name;
    }

    broadcastRoom(mapping.roomCode);
  });

  // Oracle Marker placement
  socket.on(
    'oracle_mark',
    ({
      evidenceId,
      optionIdx,
      color,
      coords,
      markerX,
      markerY,
    }: {
      evidenceId: string;
      optionIdx: number;
      color: MarkerColor;
      coords?: { x: number; y: number };
      markerX?: number;
      markerY?: number;
    }) => {
      const mapping = socketToPlayer.get(socket.id);
      if (!mapping) return;
      const room = rooms.get(mapping.roomCode);
      if (!room || room.phase !== 'ORACULO') return;

      try {
        const finalCoords = coords || (markerX !== undefined && markerY !== undefined ? { x: markerX, y: markerY } : undefined);
        const updated = handleOracleMark(room, evidenceId, optionIdx, color, finalCoords);
        rooms.set(mapping.roomCode, updated);
        broadcastRoom(mapping.roomCode);
      } catch (err: any) {
        socket.emit('error_message', err.message);
      }
    }
  );

  // Oracle Seal and Start Investigation
  socket.on('finish_oracle', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room || room.phase !== 'ORACULO') return;

    const updated = finishOraclePhase(room);
    rooms.set(mapping.roomCode, updated);
    broadcastRoom(mapping.roomCode);
  });

  // Make Judicial Accusation
  socket.on('make_accusation', ({ targetPlayerId, methodId, objectId }: { targetPlayerId: string; methodId: string; objectId: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleAccusation(room, mapping.playerId, targetPlayerId, methodId, objectId);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Oracle Updates Crime Narrative / Diary
  socket.on('update_narrative', ({ narrative }: { narrative: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleUpdateStoryNarrative(room, mapping.playerId, narrative);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Use Unique Ability
  socket.on(
    'use_ability',
    ({
      abilityId,
      extraPayload,
    }: {
      abilityId: string;
      extraPayload?: {
        targetEvidenceId?: string;
        targetPlayerId?: string;
        newOptionIndex?: number;
        question?: string;
        keywords?: string;
        itemNames?: string[];
      };
    }) => {
      const mapping = socketToPlayer.get(socket.id);
      if (!mapping) return;
      const room = rooms.get(mapping.roomCode);
      if (!room) return;

      try {
        const updated = handleAbilityUse(room, mapping.playerId, abilityId, extraPayload);
        rooms.set(mapping.roomCode, updated);
        broadcastRoom(mapping.roomCode);

        // If Observador (H06), send private observation confirmation to the user
        if (abilityId === 'H06' && extraPayload?.targetPlayerId) {
          const target = updated.players.find((p) => p.id === extraPayload.targetPlayerId);
          if (target) {
            const isKillerOrAccomplice = target.role === 'assassino' || target.role === 'cumplice';
            const secretObservation = isKillerOrAccomplice
              ? `🩸 Revelação: ${target.name} carrega a marca do crime e conspira nas sombras!`
              : `🕊️ Revelação: ${target.name} parece inocente das artimanhas do Códice.`;
            socket.emit('ability_observation_result', {
              targetName: target.name,
              observation: secretObservation,
            });
          }
        }
      } catch (err: any) {
        socket.emit('error_message', err.message);
      }
    }
  );

  // Oracle Draws Random Event (100% random)
  socket.on('draw_event', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleDrawRandomEvent(room);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Oracle Draws New Evidence Card
  socket.on('draw_evidence', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleDrawNewEvidence(room);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Oracle Adds Specific Evidence Card (from 60 Catalog)
  socket.on('add_evidence', ({ evidenceId }: { evidenceId: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleAddSpecificEvidence(room, evidenceId);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Oracle Discards Evidence Card
  socket.on('discard_evidence', ({ evidenceId }: { evidenceId: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleDiscardEvidence(room, evidenceId);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Advance Round (Oracles or discussion end)
  socket.on('advance_round', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    try {
      const updated = handleAdvanceRound(room);
      rooms.set(mapping.roomCode, updated);
      broadcastRoom(mapping.roomCode);
    } catch (err: any) {
      socket.emit('error_message', err.message);
    }
  });

  // Adjust Conversation / Investigation Timer (+30s or -30s)
  socket.on('adjust_timer', ({ deltaSeconds }: { deltaSeconds: number }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    room.phaseTimerRemaining = Math.max(0, room.phaseTimerRemaining + deltaSeconds);
    room.phaseTimerActive = room.phaseTimerRemaining > 0;
    const player = room.players.find((p) => p.id === mapping.playerId);
    const sign = deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`;

    room.logs.push({
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: `⏳ Tempo de discussão ajustado em [${sign}] por ${player?.name || 'Oráculo'}.`,
      type: 'system',
    });

    broadcastRoom(mapping.roomCode);
  });

  // Set Timer Duration Preset (e.g. 120s, 180s, 240s, 300s, 0)
  socket.on('set_timer_duration', ({ durationSeconds }: { durationSeconds: number }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    room.settings.discussionTimerSeconds = durationSeconds;
    if (room.phase === 'INVESTIGACAO') {
      room.phaseTimerRemaining = durationSeconds;
      room.phaseTimerActive = durationSeconds > 0;
    }
    broadcastRoom(mapping.roomCode);
  });

  // Toggle Timer Active state (pause/resume)
  socket.on('toggle_timer', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    room.phaseTimerActive = !room.phaseTimerActive;
    broadcastRoom(mapping.roomCode);
  });

  // Chat Message
  socket.on('send_message', ({ text, isWhisper }: { text: string; isWhisper?: boolean }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    const sender = room.players.find((p) => p.id === mapping.playerId);
    if (!sender) return;

    // Security validation: only killer and accomplice can send secret whispers
    const isConspirator = sender.role === 'assassino' || sender.role === 'cumplice';
    const effectiveIsWhisper = Boolean(isWhisper && isConspirator);

    room.messages.push({
      id: `msg_${Date.now()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: effectiveIsWhisper ? sender.role : undefined,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWhisper: effectiveIsWhisper,
    });

    broadcastRoom(mapping.roomCode);
  });

  // Real-Time Voice Audio Streaming between players
  socket.on('voice_audio_chunk', ({ audioData, mimeType }: { audioData: string; mimeType?: string }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room罕 = rooms.get(mapping.roomCode);
    if (!room罕) return;
    const sender = room罕.players.find((p) => p.id === mapping.playerId);
    if (!sender) return;

    // Relay audio chunk to all other players in this room
    socket.to(mapping.roomCode).emit('voice_audio_chunk', {
      senderId: sender.id,
      senderName: sender.name,
      characterId: sender.characterId,
      audioData,
      mimeType: mimeType || 'audio/webm',
    });
  });

  // Real-Time Voice Speaking & Mute Status Broadcasting
  socket.on('voice_speaking_state', ({ isSpeaking, volume }: { isSpeaking: boolean; volume?: number }) => {
    const mapping罕 = socketToPlayer.get(socket.id);
    if (!mapping罕) return;
    socket.to(mapping罕.roomCode).emit('voice_speaking_state', {
      playerId: mapping罕.playerId,
      isSpeaking,
      volume: volume || 0,
    });
  });

  socket.on('voice_mic_status', ({ isMuted }: { isMuted: boolean }) => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    socket.to(mapping.roomCode).emit('voice_mic_status', {
      playerId: mapping.playerId,
      isMuted,
    });
  });

  // Restart Game
  socket.on('restart_game', () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;
    const room = rooms.get(mapping.roomCode);
    if (!room) return;

    room.phase = 'LOBBY';
    room.winner = undefined;
    room.lastAccusation = undefined;
    room.secretSolution = undefined;
    room.players.forEach((p) => {
      p.methods = [];
      p.objects = [];
      p.role = undefined;
      p.hasAccused = false;
      p.abilityUsed = false;
    });

    broadcastRoom(mapping.roomCode);
  });

  socket.on('disconnect', () => {
    socketToPlayer.delete(socket.id);
  });
});

// 1-second server timer countdown for active investigation rooms
setInterval(() => {
  for (const [roomCode, room] of rooms.entries()) {
    let stateChanged = false;

    // Countdown active event duration if an event is in effect
    if (room.activeEvent && (room.activeEvent.remainingSeconds || 0) > 0) {
      room.activeEvent.remainingSeconds = (room.activeEvent.remainingSeconds || 0) - 1;
      stateChanged = true;
      if (room.activeEvent.remainingSeconds === 0) {
        const finished = handleFinishActiveEvent(room);
        room.evidencesOnTable = finished.evidencesOnTable;
        room.activeEvent = null;
        room.logs = finished.logs;
      }
    }

    // Countdown active ability duration if an ability was activated
    if (room.activeAbility && (room.activeAbility.remainingSeconds || 0) > 0) {
      room.activeAbility.remainingSeconds = (room.activeAbility.remainingSeconds || 0) - 1;
      stateChanged = true;
      if (room.activeAbility.remainingSeconds === 0) {
        room.logs.push({
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `✨ O efeito da habilidade [${room.activeAbility.ability.name}] invocada por ${room.activeAbility.userName} foi concluído.`,
          type: 'ability',
        });
        room.activeAbility = null;
      }
    }

    if (room.phase === 'INVESTIGACAO' && room.phaseTimerActive && room.phaseTimerRemaining > 0) {
      room.phaseTimerRemaining -= 1;
      stateChanged = true;
      if (room.phaseTimerRemaining === 0) {
        room.phaseTimerActive = false;
        
        // If Oracle is an AI Bot, auto-advance round and generate new evidence
        const oraclePlayer = room.players.find((p) => p.role === 'oraculo');
        if (oraclePlayer?.isAI) {
          const advanced = handleAdvanceRound(room);
          rooms.set(roomCode, advanced);
          broadcastRoom(roomCode);
          continue;
        } else {
          room.logs.push({
            id: `log_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `⏳ O tempo limite de discussão encerrou! Façam suas acusações formais ou o Oráculo pode conceder mais tempo (+30s / +1 min).`,
            type: 'system',
          });
          broadcastRoom(roomCode);
          continue;
        }
      }
    }

    if (stateChanged) {
      broadcastRoom(roomCode);
    }
  }
}, 1000);

// Periodic AI Bot simulation loop (for Oracle turns, dialogues & realistic accusations)
setInterval(() => {
  for (const [roomCode, room] of rooms.entries()) {
    // 1. If phase is ORACULO and Oracle is AI, auto-process Oracle marks and draw evidence
    if (room.phase === 'ORACULO') {
      const oraclePlayer = room.players.find((p) => p.role === 'oraculo');
      if (oraclePlayer?.isAI) {
        const withOracle = autoProcessBotOracleNextRound(room);
        rooms.set(roomCode, withOracle);
        broadcastRoom(roomCode);
        continue;
      }
    }

    // 2. If phase is NOITE and Killer is AI, auto-select method & object
    if (room.phase === 'NOITE') {
      const killerPlayer = room.players.find((p) => p.role === 'assassino');
      if (killerPlayer?.isAI && killerPlayer.methods.length > 0 && killerPlayer.objects.length > 0) {
        const randMethod = killerPlayer.methods[Math.floor(Math.random() * killerPlayer.methods.length)];
        const randObject = killerPlayer.objects[Math.floor(Math.random() * killerPlayer.objects.length)];
        const afterNight = handleNightChoice(room, killerPlayer.id, randMethod.id, randObject.id);
        rooms.set(roomCode, afterNight);
        broadcastRoom(roomCode);
        continue;
      }
    }

    if (room.phase !== 'INVESTIGACAO') continue;
    const aiBots = room.players.filter((p) => p.isAI);
    if (aiBots.length === 0) continue;

    // 3. Bot Dialogue chance (~18% per 3s tick -> average ~16s)
    if (Math.random() < 0.18) {
      const withDialogue = generateAIBotDialogue(room);
      if (withDialogue) {
        rooms.set(roomCode, withDialogue);
        broadcastRoom(roomCode);
      }
    }

    // 4. Bot Accusation chance (~6% per 3s tick when eligible bots exist -> average ~50s)
    if (Math.random() < 0.06) {
      const withAccusation = performAIBotAccusation(room);
      if (withAccusation) {
        rooms.set(roomCode, withAccusation);
        broadcastRoom(roomCode);
      }
    }
  }
}, 3000);

// Vite middleware setup
async function startApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const publicPath = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`O Códice da Morte running on port ${PORT}`);
  });
}

startApp();
