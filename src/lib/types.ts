export interface StrokePoint {
  /** posição normalizada 0..1 em relação à largura/altura da página */
  x: number;
  y: number;
  /** pressão da caneta 0..1 */
  p: number;
}

export interface Stroke {
  id: string;
  color: string;
  /** espessura base em px de página (largura de referência de 800px) */
  size: number;
  points: StrokePoint[];
}

export type Ink = Stroke[];

export interface Note {
  id: string;
  title: string;
  body: string;
  ink: Ink;
  createdAt: string;
  updatedAt: string;
  /** carimbos por campo: permitem mesclar edições de aparelhos diferentes */
  titleAt: string;
  bodyAt: string;
  inkAt: string | null;
  deleted: boolean;
  /** precisa ser enviado para a nuvem */
  dirty: boolean;
  /** última versão conhecida vinda do servidor (ISO) */
  serverUpdatedAt: string | null;
}

export interface SyncMeta {
  lastPulledAt: string | null;
  deviceId: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export const emptyNote = (): Note => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    body: '',
    ink: [],
    createdAt: now,
    updatedAt: now,
    titleAt: now,
    bodyAt: now,
    inkAt: null,
    deleted: false,
    dirty: true,
    serverUpdatedAt: null,
  };
};

export const noteLabel = (note: Note): string => {
  const title = note.title.trim();
  if (title) return title;
  const body = note.body.trim().replace(/\s+/g, ' ');
  if (body) return body.slice(0, 60);
  return note.ink.length ? 'Página escrita à mão' : 'Página em branco';
};

export const notePreview = (note: Note): string => {
  if (note.title.trim() && note.body.trim()) return note.body.trim().replace(/\s+/g, ' ').slice(0, 90);
  if (!note.title.trim() && note.body.trim()) return '';
  return note.ink.length ? `${note.ink.length} traço${note.ink.length > 1 ? 's' : ''}` : '';
};
