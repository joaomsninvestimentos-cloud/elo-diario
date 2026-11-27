import { supabase, TABLE, cloudConfigured } from './supabase';
import { getAllNotes, putNotes, loadSyncMeta, saveSyncMeta } from './db';
import type { Note } from './types';

interface RemoteNote {
  id: string;
  user_id: string;
  title: string;
  body: string;
  ink: Note['ink'];
  created_at: string;
  updated_at: string;
  title_at: string;
  body_at: string;
  ink_at: string | null;
  deleted: boolean;
}

const toRemote = (note: Note, userId: string) => ({
  id: note.id,
  user_id: userId,
  title: note.title,
  body: note.body,
  ink: note.ink,
  created_at: note.createdAt,
  updated_at: note.updatedAt,
  title_at: note.titleAt,
  body_at: note.bodyAt,
  ink_at: note.inkAt,
  deleted: note.deleted,
});

const fromRemote = (row: RemoteNote): Note => ({
  id: row.id,
  title: row.title ?? '',
  body: row.body ?? '',
  ink: Array.isArray(row.ink) ? row.ink : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  titleAt: row.title_at ?? row.updated_at,
  bodyAt: row.body_at ?? row.updated_at,
  inkAt: row.ink_at ?? null,
  deleted: Boolean(row.deleted),
  dirty: false,
  serverUpdatedAt: row.updated_at,
});

/** maior carimbo entre dois campos (usado para o updated_at do registro) */
const newest = (...dates: (string | null)[]): string =>
  dates.filter(Boolean).sort().at(-1) as string;

/** comparação estrutural do desenho (arrays vindos do banco nunca têm a mesma referência) */
const sameInk = (a: Note['ink'], b: Note['ink']): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Mescla local + remoto campo a campo.
 * O campo com carimbo mais recente vence — assim, editar o texto no celular
 * e desenhar no tablet no mesmo minuto não perde nenhum dos dois.
 */
export const mergeNotes = (local: Note | undefined, remote: Note | undefined): Note => {
  if (!local) return remote!;
  if (!remote) return local;

  const pickField = <K extends 'title' | 'body' | 'ink'>(
    field: K,
    atField: 'titleAt' | 'bodyAt' | 'inkAt',
  ) => {
    const localAt = local[atField] ?? '';
    const remoteAt = remote[atField] ?? '';
    const source = remoteAt > localAt ? remote : local;
    return { value: source[field] as Note[K], at: (source[atField] ?? '') as string };
  };

  const title = pickField('title', 'titleAt');
  const body = pickField('body', 'bodyAt');
  const ink = pickField('ink', 'inkAt');

  // `differsFromRemote` é o único motivo para reenviar: se o resultado da mescla
  // já é o que está na nuvem, não há nada a empurrar (evita pingue-pongue entre aparelhos).
  const differsFromRemote =
    title.value !== remote.title ||
    body.value !== remote.body ||
    !sameInk(ink.value, remote.ink) ||
    local.deleted !== remote.deleted;

  return {
    id: local.id,
    title: title.value,
    body: body.value,
    ink: ink.value,
    createdAt: local.createdAt < remote.createdAt ? local.createdAt : remote.createdAt,
    updatedAt: newest(title.at, body.at, ink.at, local.updatedAt, remote.updatedAt),
    titleAt: title.at,
    bodyAt: body.at,
    inkAt: ink.at,
    deleted: local.deleted || remote.deleted,
    dirty: differsFromRemote,
    serverUpdatedAt: remote.updatedAt,
  };
};

/**
 * Decide o que enviar para a nuvem:
 * - páginas mescladas que divergem do servidor (campo mais novo de cada lado);
 * - páginas que só existem neste aparelho (inclusive excluídas offline, para a
 *   exclusão chegar aos outros aparelhos).
 */
export const planPush = (locals: Note[], merged: Note[], remoteIds: Set<string>): Note[] => {
  const onlyLocal = locals.filter((note) => !remoteIds.has(note.id) && note.dirty);
  return [...merged.filter((note) => note.dirty), ...onlyLocal];
};

export interface SyncResult {
  pushed: number;
  pulled: number;
  skipped: boolean;
  error?: string;
}

export const syncNow = async (userId: string): Promise<SyncResult> => {
  if (!cloudConfigured || !supabase) {
    return { pushed: 0, pulled: 0, skipped: true, error: 'Nuvem não configurada.' };
  }

  const meta = await loadSyncMeta();
  try {
    const locals = await getAllNotes();

    const { data, error: pullError } = await supabase.from(TABLE).select('*').eq('user_id', userId);
    if (pullError) throw pullError;

    const remoteRows = (data ?? []) as RemoteNote[];
    const localMap = new Map(locals.map((note) => [note.id, note]));
    const remoteIds = new Set(remoteRows.map((row) => row.id));

    const merged: Note[] = remoteRows.map((row) =>
      mergeNotes(localMap.get(row.id), fromRemote(row)),
    );
    if (merged.length) await putNotes(merged);

    const toPush = planPush(locals, merged, remoteIds);
    if (toPush.length) {
      const { error } = await supabase
        .from(TABLE)
        .upsert(toPush.map((note) => toRemote(note, userId)), { onConflict: 'id' });
      if (error) throw error;
      await putNotes(toPush.map((note) => ({ ...note, dirty: false, serverUpdatedAt: note.updatedAt })));
    }

    const now = new Date().toISOString();
    await saveSyncMeta({ ...meta, lastPulledAt: now, lastSyncedAt: now, lastError: null });
    return { pushed: toPush.length, pulled: merged.length, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveSyncMeta({ ...meta, lastError: message });
    return { pushed: 0, pulled: 0, skipped: false, error: message };
  }
};
