import React, { useState, useEffect, useRef } from 'react';
import { METHODS, OBJECTS, SECRET_ROLES, EVIDENCES, EVENTS, ABILITIES, CHARACTERS } from '../data/gameData';
import { isUploadsUnlocked } from './uploadSecurity';

const IDB_NAME = 'CodiceCardDB_v2';
const IDB_STORE = 'card_arts';
const EVENT_NAME = 'codice_custom_card_arts_updated';

// In-memory runtime cache for lightning-fast synchronous access in components
const memoryCardArts: Record<string, string> = {};
let isIDBInitialized = false;

/* =========================================================================
   INDEXED-DB ENGINE (NO 5MB QUOTA LIMIT - SUPPORTS HUNDREDS OF HIGH-RES PNGs)
   ========================================================================= */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(IDB_NAME, 2);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromIndexedDB(): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        const map: Record<string, string> = {};
        for (const item of items) {
          if (item && item.id && item.data) {
            map[item.id] = item.data;
          }
        }
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  } catch (err) {
    console.warn('IndexedDB read fallback:', err);
    return {};
  }
}

async function saveToIndexedDB(id: string, data: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ id, data, updatedAt: Date.now() });
  } catch (err) {
    console.warn('IndexedDB write error:', err);
  }
}

async function saveBatchToIndexedDB(entries: Record<string, string>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const now = Date.now();
    for (const [id, data] of Object.entries(entries)) {
      store.put({ id, data, updatedAt: now });
    }
  } catch (err) {
    console.warn('IndexedDB batch write error:', err);
  }
}

async function deleteFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(id);
  } catch (err) {
    console.warn('IndexedDB delete error:', err);
  }
}

async function clearAllFromIndexedDB(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.clear();
  } catch (err) {
    console.warn('IndexedDB clear error:', err);
  }
}

/* =========================================================================
   SERVER SYNC & INITIALIZATION
   ========================================================================= */

// Fetch persisted cards list from Express server (/public/cards/ directory)
export async function syncCardsWithServer(): Promise<Record<string, string>> {
  try {
    const response = await fetch('/api/cards/list');
    if (response.ok) {
      const data = await response.json();
      const serverCards: Record<string, string> = data.cards || {};

      // 1. Purge any stale server URLs from memory if the server no longer has them
      for (const [key, val] of Object.entries(memoryCardArts)) {
        if (val.startsWith('/cards/') && !serverCards[key] && !serverCards[key.toUpperCase()] && !serverCards[key.toLowerCase()]) {
          delete memoryCardArts[key];
        }
      }

      // 2. Populate valid server URLs
      for (const [id, url] of Object.entries(serverCards)) {
        // Only set if we don't have a fresh local base64 upload in memory
        if (!memoryCardArts[id] || memoryCardArts[id].startsWith('/cards/')) {
          memoryCardArts[id] = url;
          const allAliases = getAliasesForCard(id);
          for (const alias of allAliases) {
            if (!memoryCardArts[alias] || memoryCardArts[alias].startsWith('/cards/')) {
              memoryCardArts[alias] = url;
            }
          }
        }
      }
      return serverCards;
    }
  } catch (err) {
    console.warn('Could not sync cards with server (offline or preview mode):', err);
  }
  return {};
}

// Mark broken image URL as failed and remove it from memory & cache so UI falls back smoothly
export function markCardArtFailed(cardIdOrUrl: string): void {
  if (!cardIdOrUrl) return;
  const clean = cardIdOrUrl.trim();
  
  // Find all keys in memoryCardArts that match or point to this URL
  let changed = false;
  for (const [k, v] of Object.entries(memoryCardArts)) {
    if (k === clean || k.toLowerCase() === clean.toLowerCase() || v === cardIdOrUrl) {
      delete memoryCardArts[k];
      deleteFromIndexedDB(k);
      changed = true;
    }
  }

  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { cardId: clean, failed: true } }));
  }
}

// Export full backup JSON of all linked cards (for transferring between computers or backups)
export async function exportCardsBackupJSON(): Promise<string> {
  // Collect all arts from memory & IDB
  const idbArts = await getAllFromIndexedDB();
  const combined: Record<string, string> = { ...idbArts };

  for (const [k, v] of Object.entries(memoryCardArts)) {
    if (v.startsWith('data:image/')) {
      combined[k] = v;
    }
  }

  // Also check if server has anything via export-bundle
  try {
    const res = await fetch('/api/cards/export-bundle');
    if (res.ok) {
      const serverBundle = await res.json();
      if (serverBundle.cards) {
        Object.assign(combined, serverBundle.cards);
      }
    }
  } catch (e) {
    // ignore
  }

  const payload = {
    appName: 'CRIMEN - O Códice de Sangue',
    version: '2.0',
    exportDate: new Date().toISOString(),
    totalCards: Object.keys(combined).length,
    cards: combined,
  };

  return JSON.stringify(payload, null, 2);
}

// Download backup JSON file directly in browser
export async function downloadCardsBackupFile(): Promise<number> {
  const jsonStr = await exportCardsBackupJSON();
  const parsed = JSON.parse(jsonStr);
  const count = parsed.totalCards || 0;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crimen-cartas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return count;
}

// Import backup JSON file and save to memory, IndexedDB and server disk
export async function importCardsBackupJSON(
  jsonData: string | Record<string, any>,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; count: number }> {
  try {
    let parsed: any;
    if (typeof jsonData === 'string') {
      parsed = JSON.parse(jsonData);
    } else {
      parsed = jsonData;
    }

    const cardsMap: Record<string, string> = parsed.cards || parsed;
    if (!cardsMap || typeof cardsMap !== 'object') {
      throw new Error('Formato de JSON inválido: chave "cards" não encontrada');
    }

    const validEntries: Record<string, string> = {};
    for (const [k, v] of Object.entries(cardsMap)) {
      if (typeof v === 'string' && (v.startsWith('data:image/') || v.startsWith('/cards/') || v.startsWith('http'))) {
        validEntries[k] = v;
      }
    }

    const count = Object.keys(validEntries).length;
    if (count === 0) {
      return { success: false, count: 0 };
    }

    await setBatchCustomCardArts(validEntries, onProgress);
    return { success: true, count };
  } catch (err) {
    console.error('Erro ao importar backup de cartas:', err);
    return { success: false, count: 0 };
  }
}

// Unified asset persistence to server (characters, cards, manual, audio, markers)
export async function persistAssetToServer(
  assetId: string,
  base64Data: string,
  fileName?: string
): Promise<{ success: boolean; url?: string; fileName?: string; cardId?: string }> {
  try {
    const isChar = assetId.startsWith('char_') || assetId.startsWith('personagem_') || assetId.startsWith('crest_') || assetId.startsWith('perso_');
    if (isChar) {
      const charRes = await persistCharacterToServer(assetId, base64Data, fileName);
      return { success: charRes.success, url: charRes.url, fileName: charRes.fileName, cardId: assetId };
    }

    const res = await fetch('/api/cards/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: assetId, base64Data, fileName }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.url) {
        memoryCardArts[assetId] = result.url;
        const allAliases = getAliasesForCard(assetId);
        for (const alias of allAliases) {
          memoryCardArts[alias] = result.url;
        }
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { cardId: assetId, url: result.url } }));
        return { success: true, url: result.url, fileName: result.fileName, cardId: result.cardId || assetId };
      }
    }
  } catch (err) {
    console.warn(`Could not persist asset ${assetId} to server:`, err);
  }
  return { success: false };
}

// Push card art to server disk (/public/cards/)
export async function persistCardToServer(cardId: string, base64Data: string, fileName?: string): Promise<boolean> {
  const res = await persistAssetToServer(cardId, base64Data, fileName);
  return res.success;
}

// Push character art to server disk (/public/characters/char_XX.png) directly without duplication
export async function persistCharacterToServer(
  characterIndexOrId: number | string,
  base64Data: string,
  fileName?: string
): Promise<{ success: boolean; url?: string; fileName?: string; slot?: number }> {
  try {
    const payload = typeof characterIndexOrId === 'number'
      ? { characterIndex: characterIndexOrId, base64Data, fileName }
      : { characterId: String(characterIndexOrId), base64Data, fileName };

    const res = await fetch('/api/characters/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.url) {
        const slot = result.slot;
        const pad = String(slot).padStart(2, '0');
        const charKey = `char_${pad}`;
        const persoKey = `personagem_${String(slot + 1).padStart(2, '0')}`;
        const numberKey = `perso_${slot + 1}`;
        const crestKey = `crest_${charKey}`;
        
        memoryCardArts[charKey] = result.url;
        memoryCardArts[persoKey] = result.url;
        memoryCardArts[numberKey] = result.url;
        memoryCardArts[crestKey] = result.url;
        if (typeof characterIndexOrId === 'string') {
          memoryCardArts[characterIndexOrId] = result.url;
          const aliases = getAliasesForCard(characterIndexOrId);
          for (const a of aliases) {
            memoryCardArts[a] = result.url;
          }
        }

        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { cardId: charKey, url: result.url } }));
        return { success: true, url: result.url, fileName: result.fileName, slot: result.slot };
      }
    }
  } catch (err) {
    console.warn(`Could not persist character to server:`, err);
  }
  return { success: false };
}

// Bulk push cards to server disk (/public/cards/)
export async function persistBatchCardsToServer(
  cards: Array<{ cardId: string; base64Data: string; fileName?: string }>
): Promise<{ success: boolean; savedCount: number }> {
  try {
    // Send in chunks of 20 to avoid extreme payload sizes while remaining super fast
    const chunkSize = 20;
    let totalSaved = 0;

    for (let i = 0; i < cards.length; i += chunkSize) {
      const chunk = cards.slice(i, i + chunkSize);
      const res = await fetch('/api/cards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: chunk }),
      });
      if (res.ok) {
        const result = await res.json();
        totalSaved += result.savedCount || chunk.length;
        if (result.saved && Array.isArray(result.saved)) {
          for (const s of result.saved) {
            memoryCardArts[s.cardId] = s.url;
            const allAliases = getAliasesForCard(s.cardId);
            for (const alias of allAliases) {
              memoryCardArts[alias] = s.url;
            }
          }
        }
      }
    }
    return { success: true, savedCount: totalSaved };
  } catch (err) {
    console.warn('Could not persist batch cards to server:', err);
    return { success: false, savedCount: 0 };
  }
}

// Initial bootstrap
if (typeof window !== 'undefined') {
  // 1. Load from IndexedDB
  getAllFromIndexedDB().then(async (idbItems) => {
    Object.assign(memoryCardArts, idbItems);
    isIDBInitialized = true;
    
    // Auto-sanitize on startup to remove corrupted numeric keys or cross-contamination
    await sanitizeCardMemoryArts();
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { initial: true } }));
    
    // 2. Load from server
    syncCardsWithServer().then(() => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { serverSync: true } }));
    });
  });
}

/* =========================================================================
   PUBLIC API METHODS
   ========================================================================= */

// Sanitize memory and IndexedDB from cross-contamination and invalid numeric keys
export async function sanitizeCardMemoryArts(): Promise<{ purgedCount: number }> {
  let purgedCount = 0;

  // 1. Remove all bare numeric keys (e.g. "01", "1", "02")
  for (const key of Object.keys(memoryCardArts)) {
    if (/^\d+$/.test(key) || /^[pc]\d{1,2}$/i.test(key)) {
      delete memoryCardArts[key];
      deleteFromIndexedDB(key);
      purgedCount++;
    }
  }

  // 2. Character keys cross-check: characters should NOT have values from other card folders
  for (let i = 0; i < 42; i++) {
    const pad = String(i).padStart(2, '0');
    const cKeys = [
      `char_${pad}`,
      `char_${i}`,
      `perso_${i + 1}`,
      `personagem_${String(i + 1).padStart(2, '0')}`,
      `char_card_personagem_${String(i + 1).padStart(2, '0')}`,
    ];
    for (const ck of cKeys) {
      const val = memoryCardArts[ck];
      if (val && (
        val.includes('/cards/metodos/') ||
        val.includes('/cards/objetos/') ||
        val.includes('/cards/evidencias/') ||
        val.includes('/cards/eventos/') ||
        val.includes('/cards/habilidades/')
      )) {
        delete memoryCardArts[ck];
        deleteFromIndexedDB(ck);
        purgedCount++;
      }
    }
  }

  // 3. Methods check: should not point to characters
  for (const m of METHODS) {
    const val = memoryCardArts[m.id];
    if (val && (val.includes('/characters/') || val.includes('/cards/personagens/') || val.includes('/personagens/'))) {
      delete memoryCardArts[m.id];
      deleteFromIndexedDB(m.id);
      purgedCount++;
    }
    const lowerVal = memoryCardArts[m.id.toLowerCase()];
    if (lowerVal && (lowerVal.includes('/characters/') || lowerVal.includes('/cards/personagens/') || lowerVal.includes('/personagens/'))) {
      delete memoryCardArts[m.id.toLowerCase()];
      deleteFromIndexedDB(m.id.toLowerCase());
      purgedCount++;
    }
  }

  // 4. Objects check: should not point to characters
  for (const o of OBJECTS) {
    const val = memoryCardArts[o.id];
    if (val && (val.includes('/characters/') || val.includes('/cards/personagens/') || val.includes('/personagens/'))) {
      delete memoryCardArts[o.id];
      deleteFromIndexedDB(o.id);
      purgedCount++;
    }
    const lowerVal = memoryCardArts[o.id.toLowerCase()];
    if (lowerVal && (lowerVal.includes('/characters/') || lowerVal.includes('/cards/personagens/') || lowerVal.includes('/personagens/'))) {
      delete memoryCardArts[o.id.toLowerCase()];
      deleteFromIndexedDB(o.id.toLowerCase());
      purgedCount++;
    }
  }

  // 5. Evidences check: should not point to characters
  for (const e of EVIDENCES) {
    const val = memoryCardArts[e.id];
    if (val && (val.includes('/characters/') || val.includes('/cards/personagens/') || val.includes('/personagens/'))) {
      delete memoryCardArts[e.id];
      deleteFromIndexedDB(e.id);
      purgedCount++;
    }
    const lowerVal = memoryCardArts[e.id.toLowerCase()];
    if (lowerVal && (lowerVal.includes('/characters/') || lowerVal.includes('/cards/personagens/') || lowerVal.includes('/personagens/'))) {
      delete memoryCardArts[e.id.toLowerCase()];
      deleteFromIndexedDB(e.id.toLowerCase());
      purgedCount++;
    }
  }

  // 6. Events check: should not point to characters or evidences
  for (const ev of EVENTS) {
    const val = memoryCardArts[ev.id];
    if (val && (val.includes('/characters/') || val.includes('/cards/personagens/') || val.includes('/cards/evidencias/'))) {
      delete memoryCardArts[ev.id];
      deleteFromIndexedDB(ev.id);
      purgedCount++;
    }
  }

  // Server purge in background
  fetch('/api/cards/sanitize', { method: 'POST' }).catch(() => {});

  return { purgedCount };
}

// Helper to generate normalized aliases strictly within the card's category
export function getAliasesForCard(cardIdentifier: string): string[] {
  if (!cardIdentifier) return [];
  const raw = cardIdentifier.trim();
  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();
  const clean = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s.]+/g, '');

  // Pure bare numbers (e.g. "01", "1") must NEVER expand across categories!
  if (/^\d+$/.test(raw)) {
    return [raw];
  }

  // 1. CHARACTER ALIASES
  const isCharCandidate =
    raw.startsWith('char_') ||
    raw.startsWith('charcard_') ||
    raw.startsWith('char_card_') ||
    raw.startsWith('crest_') ||
    raw.startsWith('perso_') ||
    raw.startsWith('personagem_') ||
    CHARACTERS.some((c) => c.id === raw || c.id === clean || `char_card_${c.id}` === raw || `crest_${c.id}` === raw);

  if (isCharCandidate) {
    const charAliases = new Set<string>([raw, lower]);
    let charObj = CHARACTERS.find(
      (c) =>
        c.id === raw ||
        c.id === lower ||
        `char_card_${c.id}` === raw ||
        `crest_${c.id}` === raw ||
        `char_${c.id}` === raw
    );

    if (!charObj) {
      const matchNum = raw.match(/^(?:char_|perso_|personagem_|crest_char_)?0*(\d{1,2})$/i);
      if (matchNum) {
        const n = parseInt(matchNum[1], 10);
        if (raw.startsWith('char_') && n >= 0 && n < CHARACTERS.length) {
          charObj = CHARACTERS[n];
        } else if (n >= 1 && n <= CHARACTERS.length) {
          charObj = CHARACTERS[n - 1];
        }
      }
    }

    if (charObj) {
      const num = charObj.number || (CHARACTERS.indexOf(charObj) + 1);
      const slot = num - 1;
      const pad = String(slot).padStart(2, '0');
      const pad1 = String(num).padStart(2, '0');

      charAliases.add(charObj.id);
      charAliases.add(`char_${pad}`);
      charAliases.add(`char_${charObj.id}`);
      charAliases.add(`char_card_${charObj.id}`);
      charAliases.add(`crest_${charObj.id}`);
      charAliases.add(`crest_char_${pad}`);
      charAliases.add(`perso_${num}`);
      charAliases.add(`personagem_${pad1}`);
      charAliases.add(`personagem_${charObj.id}`);
    }

    return Array.from(charAliases);
  }

  // 2. METHOD ALIASES (M01 to M60)
  const isMethodCandidate =
    raw.startsWith('M') ||
    raw.startsWith('m') ||
    raw.startsWith('metodo_') ||
    METHODS.some((m) => m.id === upper || m.id === lower);

  if (isMethodCandidate) {
    const methodMatch = raw.match(/^(?:m|metodo_)?0*([1-9]|[1-5][0-9]|60)$/i);
    let methodObj = METHODS.find((m) => m.id.toUpperCase() === upper || m.id.toLowerCase() === lower);
    if (!methodObj && methodMatch) {
      const num = parseInt(methodMatch[1], 10);
      const mId = `M${String(num).padStart(2, '0')}`;
      methodObj = METHODS.find((m) => m.id === mId);
    }
    if (methodObj) {
      const mAliases = new Set<string>();
      mAliases.add(methodObj.id);
      mAliases.add(methodObj.id.toLowerCase());
      mAliases.add(`metodo_${methodObj.id.toLowerCase()}`);
      const cleanName = methodObj.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      mAliases.add(cleanName);
      mAliases.add(`metodo_${cleanName}`);
      return Array.from(mAliases);
    }
  }

  // 3. OBJECT ALIASES (O01 to O64)
  const isObjectCandidate =
    raw.startsWith('O') ||
    raw.startsWith('o') ||
    raw.startsWith('objeto_') ||
    raw.startsWith('obj_') ||
    OBJECTS.some((o) => o.id === upper || o.id === lower);

  if (isObjectCandidate) {
    const objMatch = raw.match(/^(?:o|obj_|objeto_)?0*([1-9]|[1-5][0-9]|6[0-4])$/i);
    let objectObj = OBJECTS.find((o) => o.id.toUpperCase() === upper || o.id.toLowerCase() === lower);
    if (!objectObj && objMatch) {
      const num = parseInt(objMatch[1], 10);
      const oId = `O${String(num).padStart(2, '0')}`;
      objectObj = OBJECTS.find((o) => o.id === oId);
    }
    if (objectObj) {
      const oAliases = new Set<string>();
      oAliases.add(objectObj.id);
      oAliases.add(objectObj.id.toLowerCase());
      oAliases.add(`obj_${objectObj.id.toLowerCase()}`);
      oAliases.add(`objeto_${objectObj.id.toLowerCase()}`);
      const cleanName = objectObj.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      oAliases.add(cleanName);
      oAliases.add(`objeto_${cleanName}`);
      return Array.from(oAliases);
    }
  }

  // 4. EVIDENCE ALIASES (E01 to E60) - NOTE: EV IS EVENTS, NOT EVIDENCE!
  const isEvidenceCandidate =
    (raw.startsWith('E') && !raw.startsWith('EV') && !raw.startsWith('ev')) ||
    (raw.startsWith('e') && !raw.startsWith('ev')) ||
    raw.startsWith('evidencia_') ||
    EVIDENCES.some((e) => e.id === upper || e.id === lower);

  if (isEvidenceCandidate) {
    const evMatch = raw.match(/^(?:e|evidencia_)?0*([1-9]|[1-5][0-9]|60)$/i);
    let evObj = EVIDENCES.find((e) => e.id.toUpperCase() === upper || e.id.toLowerCase() === lower);
    if (!evObj && evMatch) {
      const num = parseInt(evMatch[1], 10);
      const eId = `E${String(num).padStart(2, '0')}`;
      evObj = EVIDENCES.find((e) => e.id === eId);
    }
    if (evObj) {
      const eAliases = new Set<string>();
      eAliases.add(evObj.id);
      eAliases.add(evObj.id.toLowerCase());
      eAliases.add(`evidencia_${evObj.id.toLowerCase()}`);
      const cleanTitle = evObj.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      eAliases.add(cleanTitle);
      eAliases.add(`evidencia_${cleanTitle}`);
      return Array.from(eAliases);
    }
  }

  // 5. EVENT ALIASES (EV01 to EV16)
  const isEventCandidate =
    raw.startsWith('EV') ||
    raw.startsWith('ev') ||
    raw.startsWith('evento_') ||
    EVENTS.some((ev) => ev.id === upper || ev.id === lower);

  if (isEventCandidate) {
    const eventMatch = raw.match(/^(?:ev|evento_)?0*([1-9]|1[0-6])$/i);
    let eventObj = EVENTS.find((ev) => ev.id.toUpperCase() === upper || ev.id.toLowerCase() === lower);
    if (!eventObj && eventMatch) {
      const num = parseInt(eventMatch[1], 10);
      const evId = `EV${String(num).padStart(2, '0')}`;
      eventObj = EVENTS.find((ev) => ev.id === evId);
    }
    if (eventObj) {
      const evAliases = new Set<string>();
      evAliases.add(eventObj.id);
      evAliases.add(eventObj.id.toLowerCase());
      evAliases.add(`evento_${eventObj.id.toLowerCase()}`);
      const cleanName = eventObj.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      evAliases.add(cleanName);
      evAliases.add(`evento_${cleanName}`);
      return Array.from(evAliases);
    }
  }

  // 6. ABILITY ALIASES (H01 to H12)
  const isAbilityCandidate =
    raw.startsWith('H') ||
    raw.startsWith('h') ||
    raw.startsWith('hab_') ||
    raw.startsWith('habilidade_') ||
    ABILITIES.some((ab) => ab.id === upper || ab.id === lower);

  if (isAbilityCandidate) {
    const habMatch = raw.match(/^(?:h|hab_|habilidade_)?0*([1-9]|1[0-2])$/i);
    let habObj = ABILITIES.find((ab) => ab.id.toUpperCase() === upper || ab.id.toLowerCase() === lower);
    if (!habObj && habMatch) {
      const num = parseInt(habMatch[1], 10);
      const hId = `H${String(num).padStart(2, '0')}`;
      habObj = ABILITIES.find((ab) => ab.id === hId);
    }
    if (habObj) {
      const hAliases = new Set<string>();
      hAliases.add(habObj.id);
      hAliases.add(habObj.id.toLowerCase());
      hAliases.add(`habilidade_${habObj.id.toLowerCase()}`);
      const cleanName = habObj.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      hAliases.add(cleanName);
      return Array.from(hAliases);
    }
  }

  // 7. SECRET ROLE ALIASES
  if (raw.startsWith('role_') || raw.startsWith('R0') || ['assassino', 'oraculo', 'investigador', 'cumplice', 'sabotador'].includes(clean)) {
    const rAliases = new Set<string>([raw, lower]);
    if (clean.includes('assassino') || raw === 'role_assassino' || raw === 'R01') {
      ['role_assassino', 'assassino', 'r01', 'R01'].forEach((a) => rAliases.add(a));
    } else if (clean.includes('oraculo') || raw === 'role_oraculo' || raw === 'R02') {
      ['role_oraculo', 'oraculo', 'r02', 'R02'].forEach((a) => rAliases.add(a));
    } else if (clean.includes('investigador') || raw === 'role_investigador' || raw === 'R03') {
      ['role_investigador', 'investigador', 'r03', 'R03'].forEach((a) => rAliases.add(a));
    } else if (clean.includes('cumplice') || raw === 'role_cumplice' || raw === 'R04') {
      ['role_cumplice', 'cumplice', 'r04', 'R04'].forEach((a) => rAliases.add(a));
    } else if (clean.includes('sabotador') || raw === 'role_sabotador' || raw === 'R05') {
      ['role_sabotador', 'sabotador', 'r05', 'R05'].forEach((a) => rAliases.add(a));
    }
    return Array.from(rAliases);
  }

  // 8. ORACLE MARKERS
  if (raw.startsWith('seal_') || raw.startsWith('marcador_') || raw.startsWith('selo_')) {
    const sAliases = new Set<string>([raw, lower]);
    if (clean.includes('dourado') || clean.includes('gold')) {
      ['seal_dourado', 'marcador_dourado', 'selo_dourado'].forEach((a) => sAliases.add(a));
    } else if (clean.includes('vermelho') || clean.includes('red')) {
      ['seal_vermelho', 'marcador_vermelho', 'selo_vermelho'].forEach((a) => sAliases.add(a));
    } else if (clean.includes('azul') || clean.includes('blue')) {
      ['seal_azul', 'marcador_azul', 'selo_azul'].forEach((a) => sAliases.add(a));
    } else if (clean.includes('cinza') || clean.includes('gray')) {
      ['seal_cinza', 'marcador_cinza', 'selo_cinza'].forEach((a) => sAliases.add(a));
    } else if (clean.includes('preto') || clean.includes('black')) {
      ['seal_preto', 'marcador_preto', 'selo_preto'].forEach((a) => sAliases.add(a));
    }
    return Array.from(sAliases);
  }

  // Fallback: only exact strings
  return [raw, lower];
}

// Get all custom card artworks
export function getAllCustomCardArts(): Record<string, string> {
  return { ...memoryCardArts };
}

// Get custom artwork for a specific card ID (e.g. 'M01', 'O22', 'role_assassino', 'E01')
export function getCustomCardArt(cardId?: string | string[]): string | undefined {
  if (!cardId) return undefined;
  const ids = Array.isArray(cardId) ? cardId : [cardId];

  for (const id of ids) {
    if (!id) continue;
    // 1. Direct key
    if (memoryCardArts[id]) return memoryCardArts[id];

    // 2. Lookup through all generated aliases
    const aliases = getAliasesForCard(id);
    for (const alias of aliases) {
      if (memoryCardArts[alias]) return memoryCardArts[alias];
    }
  }
  return undefined;
}

// Save a single custom card art
export function setCustomCardArt(cardId: string, dataUrl: string): void {
  const cleanId = cardId.trim();
  const allAliases = getAliasesForCard(cleanId);

  // Bind to memory cache for all aliases
  for (const alias of allAliases) {
    memoryCardArts[alias] = dataUrl;
  }

  // Save to IndexedDB (local persistence without 5MB limit)
  saveToIndexedDB(cleanId, dataUrl);

  // Dispatch UI update immediately
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { cardId: cleanId, dataUrl } }));

  // Persist to physical server files (/public/cards/)
  persistCardToServer(cleanId, dataUrl);
}

// Batch save multiple card artworks at once
export function setBatchCustomCardArts(
  newArts: Record<string, string>,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  return new Promise(async (resolve) => {
    const entries = Object.entries(newArts);
    const total = entries.length;

    // 1. Immediately update memory cache for instant UI rendering for all aliases
    for (const [id, dataUrl] of entries) {
      const allAliases = getAliasesForCard(id);
      for (const alias of allAliases) {
        memoryCardArts[alias] = dataUrl;
      }
    }

    // 2. Dispatch UI update
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { batch: true, count: total } }));

    // 3. Save to IndexedDB
    await saveBatchToIndexedDB(newArts);

    // 4. Send to server disk in background
    const serverPayload = entries.map(([cardId, base64Data]) => ({ cardId, base64Data }));
    await persistBatchCardsToServer(serverPayload);

    if (onProgress) onProgress(total, total);
    resolve();
  });
}

// Remove custom card art
export function removeCustomCardArt(cardId: string): void {
  const cleanId = cardId.trim();
  delete memoryCardArts[cleanId];
  delete memoryCardArts[cleanId.toLowerCase()];
  delete memoryCardArts[cleanId.toUpperCase()];

  deleteFromIndexedDB(cleanId);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { cardId: cleanId, deleted: true } }));

  fetch(`/api/cards/${cleanId}`, { method: 'DELETE' }).catch(() => {});
}

// Clear all custom card arts
export function clearAllCustomCardArts(): void {
  for (const key of Object.keys(memoryCardArts)) {
    delete memoryCardArts[key];
  }
  clearAllFromIndexedDB();
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { cleared: true } }));
  fetch('/api/cards/clear', { method: 'POST' }).catch(() => {});
}

// Clear a specific category directory on the server (e.g. 'personagens')
export async function clearDirectoryOnServer(category: string): Promise<boolean> {
  try {
    const res = await fetch('/api/cards/clear-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (res.ok) {
      if (category === 'personagens') {
        for (let i = 0; i < 42; i++) {
          const pad = String(i).padStart(2, '0');
          delete memoryCardArts[`char_${pad}`];
          delete memoryCardArts[`char_${i}`];
          delete memoryCardArts[`personagem_${String(i + 1).padStart(2, '0')}`];
          delete memoryCardArts[`perso_${i + 1}`];
          delete memoryCardArts[`perso${i + 1}`];
          delete memoryCardArts[`char_card_personagem_${String(i + 1).padStart(2, '0')}`];
          delete memoryCardArts[`crest_char_${pad}`];
        }
      }
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { clearedCategory: category } }));
      return true;
    }
  } catch (e) {
    console.warn('Failed to clear directory on server:', e);
  }
  return false;
}

// Query directory counts from server for each card layout folder
export async function fetchDirectoryStatuses(): Promise<Record<string, { count: number; files: string[]; path: string }>> {
  try {
    const res = await fetch('/api/cards/directories');
    if (res.ok) {
      const data = await res.json();
      return data.directories || {};
    }
  } catch (e) {
    console.warn('Failed to fetch directory statuses:', e);
  }
  return {};
}

/* =========================================================================
   CANONICAL CARD ID MATCHING ALGORITHM (60 METHODS, 64 OBJECTS, 5 SECRET ROLES)
   ========================================================================= */

export interface CardMatchResult {
  cardId: string;
  cardName: string;
  category:
    | 'metodos'
    | 'objetos'
    | 'papeis'
    | 'evidencias'
    | 'eventos'
    | 'habilidades'
    | 'personagens'
    | 'brasoes'
    | 'bordas'
    | 'cenarios'
    | 'marcadores'
    | 'manual'
    | 'audio';
}

export function matchCardIdFromFileName(fileName: string, preferredCategory?: string): CardMatchResult | null {
  // Remove extension and clean string
  const base = fileName.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  // Remove spaces, underscores, dashes, accents, and all parentheses/brackets/punctuation
  const clean = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]{}'"_~`!@#$%^&*+=|\\:;<>,.?/-\s]+/g, '');

  const normCat = preferredCategory ? preferredCategory.toLowerCase().trim() : '';

  // =========================================================================
  // CATEGORY-ISOLATED MATCHERS
  // When a category is active, NEVER match against other categories!
  // =========================================================================

  if (normCat === 'personagens') {
    // 1. Explicit slot char_00 to char_41 (0-indexed)
    const charSlotMatch = clean.match(/^char0*(\d{1,2})$/);
    if (charSlotMatch) {
      const slot = parseInt(charSlotMatch[1], 10);
      if (slot >= 0 && slot < CHARACTERS.length) {
        const c = CHARACTERS[slot];
        return { cardId: `char_card_${c.id}`, cardName: `Personagem #${slot + 1}: ${c.name}`, category: 'personagens' };
      }
    }

    // 2. 1-indexed numbers (perso_01 to perso_42, personagem_01 to personagem_42, or lone digits 01 to 42)
    const numMatch = clean.match(/^(?:perso|personagem|person|charcard|cartapersonagem|p|c)?0*([1-9]|[1-3][0-9]|4[0-2])$/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      const c = CHARACTERS[num - 1] || CHARACTERS.find((char) => char.number === num);
      if (c) {
        return { cardId: `char_card_${c.id}`, cardName: `Personagem #${num}: ${c.name}`, category: 'personagens' };
      }
    }

    // 3. Name or alias match among characters
    for (const c of CHARACTERS) {
      const cleanCName = c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean === cleanCName || clean.includes(cleanCName) || clean === c.id.replace(/_/g, '')) {
        return { cardId: `char_card_${c.id}`, cardName: `Personagem #${c.number || 1}: ${c.name}`, category: 'personagens' };
      }
    }
    return null;
  }

  if (normCat === 'metodos') {
    // 1. M01..M60 or metodo_01..metodo_60 or lone 01..60
    const mMatch = clean.match(/^(?:m|metodo|method|met)?0*([1-9]|[1-5][0-9]|60)$/);
    if (mMatch) {
      const num = parseInt(mMatch[1], 10);
      const cardId = `M${String(num).padStart(2, '0')}`;
      const method = METHODS.find((m) => m.id === cardId);
      return { cardId, cardName: method?.name || `Método ${cardId}`, category: 'metodos' };
    }
    // 2. Method name
    for (const m of METHODS) {
      const cleanMName = m.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean === cleanMName || clean.includes(cleanMName) || cleanMName.includes(clean)) {
        return { cardId: m.id, cardName: m.name, category: 'metodos' };
      }
    }
    return null;
  }

  if (normCat === 'objetos') {
    // 1. O01..O64 or objeto_01..objeto_64 or lone 01..64
    const oMatch = clean.match(/^(?:o|obj|objeto|object)?0*([1-9]|[1-5][0-9]|6[0-4])$/);
    if (oMatch) {
      const num = parseInt(oMatch[1], 10);
      const cardId = `O${String(num).padStart(2, '0')}`;
      const obj = OBJECTS.find((o) => o.id === cardId);
      return { cardId, cardName: obj?.name || `Objeto ${cardId}`, category: 'objetos' };
    }
    // 2. Object name
    for (const o of OBJECTS) {
      const cleanOName = o.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean === cleanOName || clean.includes(cleanOName) || cleanOName.includes(clean)) {
        return { cardId: o.id, cardName: o.name, category: 'objetos' };
      }
    }
    return null;
  }

  if (normCat === 'evidencias') {
    // 1. E01..E60 or evidencia_01..evidencia_60 or lone 01..60
    const eMatch = clean.match(/^(?:e|evidencia|evidence)?0*([1-9]|[1-5][0-9]|60)$/);
    if (eMatch) {
      const num = parseInt(eMatch[1], 10);
      const cardId = `E${String(num).padStart(2, '0')}`;
      const ev = EVIDENCES.find((e) => e.id === cardId);
      return { cardId, cardName: ev?.title || `Evidência ${cardId}`, category: 'evidencias' };
    }
    // 2. Evidence title
    for (const ev of EVIDENCES) {
      const cleanEvTitle = ev.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean === cleanEvTitle || clean.includes(cleanEvTitle) || cleanEvTitle.includes(clean)) {
        return { cardId: ev.id, cardName: ev.title, category: 'evidencias' };
      }
    }
    return null;
  }

  if (normCat === 'eventos') {
    // 1. EV01..EV16 or evento_01..evento_16 or lone 01..16
    const evMatch = clean.match(/^(?:ev|evento|event)?0*([1-9]|1[0-6])$/);
    if (evMatch) {
      const num = parseInt(evMatch[1], 10);
      const cardId = `EV${String(num).padStart(2, '0')}`;
      const ev = EVENTS.find((e) => e.id === cardId);
      return { cardId, cardName: ev?.name || `Evento ${cardId}`, category: 'eventos' };
    }
    for (const ev of EVENTS) {
      const cleanEvName = ev.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean === cleanEvName || clean.includes(cleanEvName) || cleanEvName.includes(clean)) {
        return { cardId: ev.id, cardName: ev.name, category: 'eventos' };
      }
    }
    return null;
  }

  if (normCat === 'habilidades') {
    const hMatch = clean.match(/^(?:h|hab|habilidade|ability)?0*([1-9]|1[0-2])$/);
    if (hMatch) {
      const num = parseInt(hMatch[1], 10);
      const cardId = `H${String(num).padStart(2, '0')}`;
      const hab = ABILITIES.find((h) => h.id === cardId);
      return { cardId, cardName: hab?.name || `Habilidade ${cardId}`, category: 'habilidades' };
    }
    for (const hab of ABILITIES) {
      const cleanHabName = hab.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean === cleanHabName || clean.includes(cleanHabName) || cleanHabName.includes(clean)) {
        return { cardId: hab.id, cardName: hab.name, category: 'habilidades' };
      }
    }
    return null;
  }

  if (normCat === 'brasoes') {
    const bMatch = clean.match(/^(?:brasao|crest|emblema|perso|p|c|char)?0*([1-9]|[1-3][0-9]|4[0-2])$/);
    if (bMatch) {
      const num = parseInt(bMatch[1], 10);
      const c = CHARACTERS[num - 1] || CHARACTERS.find((char) => char.number === num);
      if (c) {
        return { cardId: `crest_${c.id}`, cardName: `Brasão: ${c.name}`, category: 'brasoes' };
      }
    }
    for (const c of CHARACTERS) {
      const cleanCName = c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_\s.]+/g, '').toLowerCase();
      if (clean.includes(cleanCName) || clean.includes(c.id.replace(/_/g, ''))) {
        return { cardId: `crest_${c.id}`, cardName: `Brasão: ${c.name}`, category: 'brasoes' };
      }
    }
    return null;
  }

  if (normCat === 'papeis') {
    if (clean.includes('assassino') || clean === 'r01' || clean === 'r1' || clean === '1') {
      return { cardId: 'role_assassino', cardName: 'Papel Secreto: O Assassino', category: 'papeis' };
    }
    if (clean.includes('oraculo') || clean === 'r02' || clean === 'r2' || clean === '2') {
      return { cardId: 'role_oraculo', cardName: 'Papel Secreto: O Oráculo', category: 'papeis' };
    }
    if (clean.includes('investigador') || clean === 'r03' || clean === 'r3' || clean === '3') {
      return { cardId: 'role_investigador', cardName: 'Papel Secreto: O Investigador', category: 'papeis' };
    }
    if (clean.includes('cumplice') || clean === 'r04' || clean === 'r4' || clean === '4') {
      return { cardId: 'role_cumplice', cardName: 'Papel Secreto: O Cúmplice', category: 'papeis' };
    }
    if (clean.includes('sabotador') || clean === 'r05' || clean === 'r5' || clean === '5') {
      return { cardId: 'role_sabotador', cardName: 'Papel Secreto: O Sabotador', category: 'papeis' };
    }
    return null;
  }

  if (normCat === 'marcadores') {
    if (clean.includes('dourado') || clean.includes('gold') || clean.includes('amarelo') || clean === '1') {
      return { cardId: 'seal_dourado', cardName: 'Marcador Dourado', category: 'marcadores' };
    }
    if (clean.includes('vermelho') || clean.includes('red') || clean === '2') {
      return { cardId: 'seal_vermelho', cardName: 'Marcador Vermelho', category: 'marcadores' };
    }
    if (clean.includes('azul') || clean.includes('blue') || clean === '3') {
      return { cardId: 'seal_azul', cardName: 'Marcador Azul', category: 'marcadores' };
    }
    if (clean.includes('cinza') || clean.includes('gray') || clean === '4') {
      return { cardId: 'seal_cinza', cardName: 'Marcador Cinza', category: 'marcadores' };
    }
    if (clean.includes('preto') || clean.includes('black') || clean.includes('sombrio') || clean === '5') {
      return { cardId: 'seal_preto', cardName: 'Marcador Sombrio', category: 'marcadores' };
    }
    return null;
  }

  if (normCat === 'manual') {
    return { cardId: 'rules_reference', cardName: 'Manual de Regras: O Códice', category: 'manual' };
  }

  // =========================================================================
  // GLOBAL MATCHER (When preferredCategory is 'todas', 'lote', or undefined)
  // STRICT PREFIXES ONLY. No bare numbers will be matched to prevent cross-contamination!
  // =========================================================================

  // Audio
  if (clean.includes('rastronastrevas') || clean.includes('trilha1')) return { cardId: 'rastro_trevas', cardName: 'Trilha 1: Rastro nas Trevas', category: 'audio' };
  if (clean.includes('luznacupula') || clean.includes('trilha2')) return { cardId: 'a_luz_na_cupula', cardName: 'Trilha 2: A Luz na Cúpula', category: 'audio' };
  if (clean.includes('euvouachar') || clean.includes('trilha3')) return { cardId: 'eu_vou_achar', cardName: 'Trilha 3: Eu Vou Achar', category: 'audio' };
  if (clean.includes('codicedassombras') || clean.includes('trilha4')) return { cardId: 'codice_sombras', cardName: 'Trilha 4: Códice das Sombras', category: 'audio' };
  if (clean.includes('despertardracula') || clean.includes('trilha5')) return { cardId: 'despertar_dracula', cardName: 'Trilha 5: O Despertar do Conde', category: 'audio' };

  // Manual
  if (clean.includes('manualregras') || clean.includes('rulesreference') || clean.includes('codiceregras') || clean === 'manualregras') {
    return { cardId: 'rules_reference', cardName: 'Manual de Regras: O Códice', category: 'manual' };
  }

  // Borders & Scenery
  if (clean.includes('bordacarta') || clean.includes('cardborder')) return { cardId: 'custom_card_border', cardName: 'Borda de Cartas', category: 'bordas' };
  if (clean.includes('bordajogo') || clean.includes('gameborder')) return { cardId: 'custom_game_border', cardName: 'Moldura do Jogo', category: 'bordas' };
  if (clean.includes('fundosalao') || clean.includes('cenariosalao')) return { cardId: 'custom_hall_bg', cardName: 'Cenário do Salão 2D', category: 'cenarios' };

  // Crests
  if (clean.startsWith('crest') || clean.startsWith('brasao')) {
    const cMatch = clean.match(/^(?:crest|brasao)0*([1-9]|[1-3][0-9]|4[0-2])$/);
    if (cMatch) {
      const num = parseInt(cMatch[1], 10);
      const c = CHARACTERS[num - 1];
      if (c) return { cardId: `crest_${c.id}`, cardName: `Brasão: ${c.name}`, category: 'brasoes' };
    }
  }

  // Events: EV01..EV16
  const evMatch = clean.match(/^(?:ev|evento)0*([1-9]|1[0-6])$/);
  if (evMatch) {
    const num = parseInt(evMatch[1], 10);
    const cardId = `EV${String(num).padStart(2, '0')}`;
    const ev = EVENTS.find((e) => e.id === cardId);
    return { cardId, cardName: ev?.name || `Evento ${cardId}`, category: 'eventos' };
  }

  // Evidences: E01..E60 (Must have 'e' or 'evidencia' prefix, NOT EV)
  const eMatch = clean.match(/^(?:e|evidencia)0*([1-9]|[1-5][0-9]|60)$/);
  if (eMatch && !clean.startsWith('ev')) {
    const num = parseInt(eMatch[1], 10);
    const cardId = `E${String(num).padStart(2, '0')}`;
    const ev = EVIDENCES.find((e) => e.id === cardId);
    return { cardId, cardName: ev?.title || `Evidência ${cardId}`, category: 'evidencias' };
  }

  // Methods: M01..M60
  const mMatch = clean.match(/^(?:m|metodo)0*([1-9]|[1-5][0-9]|60)$/);
  if (mMatch) {
    const num = parseInt(mMatch[1], 10);
    const cardId = `M${String(num).padStart(2, '0')}`;
    const method = METHODS.find((m) => m.id === cardId);
    return { cardId, cardName: method?.name || `Método ${cardId}`, category: 'metodos' };
  }

  // Objects: O01..O64
  const oMatch = clean.match(/^(?:o|obj|objeto)0*([1-9]|[1-5][0-9]|6[0-4])$/);
  if (oMatch) {
    const num = parseInt(oMatch[1], 10);
    const cardId = `O${String(num).padStart(2, '0')}`;
    const obj = OBJECTS.find((o) => o.id === cardId);
    return { cardId, cardName: obj?.name || `Objeto ${cardId}`, category: 'objetos' };
  }

  // Abilities: H01..H12
  const hMatch = clean.match(/^(?:h|hab|habilidade)0*([1-9]|1[0-2])$/);
  if (hMatch) {
    const num = parseInt(hMatch[1], 10);
    const cardId = `H${String(num).padStart(2, '0')}`;
    const hab = ABILITIES.find((h) => h.id === cardId);
    return { cardId, cardName: hab?.name || `Habilidade ${cardId}`, category: 'habilidades' };
  }

  // Characters: char_00..char_41, perso_01..perso_42, personagem_01..personagem_42
  const charSlotMatch = clean.match(/^char0*(\d{1,2})$/);
  if (charSlotMatch) {
    const slot = parseInt(charSlotMatch[1], 10);
    if (slot >= 0 && slot < CHARACTERS.length) {
      const c = CHARACTERS[slot];
      return { cardId: `char_card_${c.id}`, cardName: `Personagem #${slot + 1}: ${c.name}`, category: 'personagens' };
    }
  }

  const persoPrefixed = clean.match(/^(?:perso|personagem)0*([1-9]|[1-3][0-9]|4[0-2])$/);
  if (persoPrefixed) {
    const num = parseInt(persoPrefixed[1], 10);
    const c = CHARACTERS[num - 1];
    if (c) {
      return { cardId: `char_card_${c.id}`, cardName: `Personagem #${num}: ${c.name}`, category: 'personagens' };
    }
  }

  // Roles: role_*, or explicit role names
  if (clean.includes('assassino') || clean === 'roleassassino') return { cardId: 'role_assassino', cardName: 'Papel Secreto: O Assassino', category: 'papeis' };
  if (clean.includes('oraculo') || clean === 'roleoraculo') return { cardId: 'role_oraculo', cardName: 'Papel Secreto: O Oráculo', category: 'papeis' };
  if (clean.includes('investigador') || clean === 'roleinvestigador') return { cardId: 'role_investigador', cardName: 'Papel Secreto: O Investigador', category: 'papeis' };
  if (clean.includes('cumplice') || clean === 'rolecumplice') return { cardId: 'role_cumplice', cardName: 'Papel Secreto: O Cúmplice', category: 'papeis' };
  if (clean.includes('sabotador') || clean === 'rolesabotador') return { cardId: 'role_sabotador', cardName: 'Papel Secreto: O Sabotador', category: 'papeis' };

  // Markers
  if (clean.includes('marcadordourado') || clean.includes('selodourado')) return { cardId: 'seal_dourado', cardName: 'Marcador Dourado', category: 'marcadores' };
  if (clean.includes('marcadorvermelho') || clean.includes('selovermelho')) return { cardId: 'seal_vermelho', cardName: 'Marcador Vermelho', category: 'marcadores' };
  if (clean.includes('marcadorazul') || clean.includes('seloazul')) return { cardId: 'seal_azul', cardName: 'Marcador Azul', category: 'marcadores' };
  if (clean.includes('marcadorcinza') || clean.includes('selocinza')) return { cardId: 'seal_cinza', cardName: 'Marcador Cinza', category: 'marcadores' };
  if (clean.includes('marcadorpreto') || clean.includes('selopreto') || clean.includes('marcadorsombrio')) return { cardId: 'seal_preto', cardName: 'Marcador Sombrio', category: 'marcadores' };

  return null;
}

/* =========================================================================
   PROMPT CARD ART UPLOAD (DOUBLE CLICK TO UPLOAD DIRECTLY)
   ========================================================================= */

export function showCardArtNotification(message: string, isError: boolean = false) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('codice_card_art_toast', {
      detail: { message, isError, timestamp: Date.now() },
    })
  );
}

export function promptCardArtUpload(
  cardId: string,
  options?: {
    name?: string;
    aliases?: string[];
    onUploaded?: (dataUrl: string) => void;
  }
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!isUploadsUnlocked()) {
      showCardArtNotification('🔒 Modo de Upload bloqueado. Ative nas Configurações com a senha de administrador.', true);
      resolve(null);
      return;
    }

    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp, image/gif, image/svg+xml';
    input.style.display = 'none';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const dataUrl = await processImageUpload(file);
        const cleanId = cardId.trim();

        setCustomCardArt(cleanId, dataUrl);

        // Also bind to any aliases if provided (e.g. char aliases or alternative IDs)
        if (options?.aliases && Array.isArray(options.aliases)) {
          for (const alias of options.aliases) {
            if (alias && alias.trim()) {
              setCustomCardArt(alias.trim(), dataUrl);
            }
          }
        }

        const label = options?.name || cleanId;
        showCardArtNotification(`⚡ Nova imagem vinculada a "${label}" com sucesso!`);

        if (options?.onUploaded) {
          options.onUploaded(dataUrl);
        }

        resolve(dataUrl);
      } catch (err) {
        console.error('Failed to process image upload:', err);
        showCardArtNotification('Erro ao processar imagem para a carta.', true);
        resolve(null);
      } finally {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

/* =========================================================================
   REACT HOOKS
   ========================================================================= */

export function useCustomCardArt(cardId?: string | string[]): string | undefined {
  const [art, setArt] = useState<string | undefined>(() => getCustomCardArt(cardId));
  const key = Array.isArray(cardId) ? cardId.filter(Boolean).join(',') : (cardId || '');

  useEffect(() => {
    setArt(getCustomCardArt(cardId));

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updatedId = customEvent.detail?.cardId;
      if (!updatedId || customEvent.detail?.batch || customEvent.detail?.cleared || customEvent.detail?.serverSync) {
        setArt(getCustomCardArt(cardId));
        return;
      }
      const ids = Array.isArray(cardId) ? cardId : [cardId];
      if (ids.some((id) => id && id.toLowerCase() === updatedId.toLowerCase())) {
        setArt(getCustomCardArt(cardId));
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(EVENT_NAME, handleUpdate);
  }, [key]);

  return art;
}

export function useAllCustomCardArts(): Record<string, string> {
  const [arts, setArts] = useState<Record<string, string>>(() => getAllCustomCardArts());

  useEffect(() => {
    const handleUpdate = () => {
      setArts(getAllCustomCardArts());
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(EVENT_NAME, handleUpdate);
  }, []);

  return arts;
}

/* =========================================================================
   IMAGE COMPRESSION & PREPROCESSING (HIGH RESOLUTION & GOTHIC CRISPNESS)
   ========================================================================= */

export async function processImageUpload(file: File): Promise<string> {
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

  // If already PNG and under 2MB, read directly to preserve 100% pure transparency, crispness, and direct PNG replacement
  if (isPng && file.size <= 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // High quality resolution for detailed gothic cards and character portraits
        const maxWidth = 1024;
        const maxHeight = 1350;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Crisp image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Always keep PNG format for PNG uploads
        if (isPng) {
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        // For non-PNGs, try WebP first for optimal size/quality, fallback to JPEG
        try {
          const webpOutput = canvas.toDataURL('image/webp', 0.90);
          if (webpOutput.startsWith('data:image/webp')) {
            resolve(webpOutput);
            return;
          }
        } catch {
          // fallback
        }
        resolve(canvas.toDataURL('image/jpeg', 0.90));
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function useDoubleTapUpload(cardId: string, cardName?: string, aliases?: string[]) {
  const lastTapRef = useRef<number>(0);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUploadsUnlocked()) {
      showCardArtNotification('🔒 Modo de Upload desativado. Ative nas Configurações com a senha de administrador.', true);
      return;
    }
    promptCardArtUpload(cardId, { name: cardName || cardId, aliases });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      e.stopPropagation();
      if (!isUploadsUnlocked()) {
        showCardArtNotification('🔒 Modo de Upload desativado. Ative nas Configurações com a senha de administrador.', true);
        return;
      }
      promptCardArtUpload(cardId, { name: cardName || cardId, aliases });
    }
    lastTapRef.current = now;
  };

  return { onDoubleClick: handleDoubleClick, onTouchEnd: handleTouchEnd };
}
