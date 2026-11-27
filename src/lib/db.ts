import { openDB, type IDBPDatabase } from 'idb';
import type { Note, SyncMeta } from './types';

const DB_NAME = 'elo-diario';
const DB_VERSION = 1;

interface Schema {
  notes: Note;
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

const db = () => {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('notes')) {
          const notes = database.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('by-updated', 'updatedAt');
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
};

export const getAllNotes = async (): Promise<Note[]> => {
  const database = await db();
  const notes = await database.getAll('notes');
  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const putNote = async (note: Note): Promise<void> => {
  const database = await db();
  await database.put('notes', note);
};

export const putNotes = async (notes: Note[]): Promise<void> => {
  const database = await db();
  const tx = database.transaction('notes', 'readwrite');
  await Promise.all([...notes.map((note) => tx.store.put(note)), tx.done]);
};

export const deleteNoteLocal = async (id: string): Promise<void> => {
  const database = await db();
  await database.delete('notes', id);
};

export const getMeta = async <T>(key: string, fallback: T): Promise<T> => {
  const database = await db();
  const row = await database.get('meta', key);
  return row ? (row.value as T) : fallback;
};

export const setMeta = async (key: string, value: unknown): Promise<void> => {
  const database = await db();
  await database.put('meta', { key, value });
};

const defaultSyncMeta = (): SyncMeta => ({
  lastPulledAt: null,
  deviceId: crypto.randomUUID(),
  lastSyncedAt: null,
  lastError: null,
});

export const loadSyncMeta = async (): Promise<SyncMeta> => {
  const existing = await getMeta<SyncMeta | null>('sync', null);
  if (existing) return existing;
  const fresh = defaultSyncMeta();
  await setMeta('sync', fresh);
  return fresh;
};

export const saveSyncMeta = async (meta: SyncMeta): Promise<void> => setMeta('sync', meta);

/** Exporta tudo para um JSON de backup (sem credenciais). */
export const exportAll = async () => {
  const notes = await getAllNotes();
  return {
    app: 'elo-diario',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
  };
};

export const importAll = async (payload: unknown): Promise<number> => {
  const data = payload as { notes?: Note[] };
  if (!data || !Array.isArray(data.notes)) throw new Error('Arquivo de backup inválido.');
  const clean = data.notes.filter((note) => note && typeof note.id === 'string');
  const prepared = clean.map((note) => ({
    ...note,
    ink: Array.isArray(note.ink) ? note.ink : [],
    deleted: Boolean(note.deleted),
    dirty: true,
    serverUpdatedAt: null,
  })) as Note[];
  await putNotes(prepared);
  return prepared.length;
};
