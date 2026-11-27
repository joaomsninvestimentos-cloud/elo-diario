import { useMemo, useState } from 'react';
import NoteCard from '../components/NoteCard';
import type { Note, SyncMeta } from '../lib/types';

interface Props {
  notes: Note[];
  meta: SyncMeta | null;
  syncing: boolean;
  cloud: boolean;
  lastResult: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onSync: () => void;
  onSettings: () => void;
}

export default function HomeScreen({
  notes,
  meta,
  syncing,
  cloud,
  lastResult,
  onOpen,
  onCreate,
  onSync,
  onSettings,
}: Props) {
  const [query, setQuery] = useState('');

  const searchable = (note: Note) =>
    `${note.title} ${note.body}`.toLowerCase().includes(query.trim().toLowerCase());

  const { today, older } = useMemo(() => {
    const visible = notes.filter(searchable).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      today: visible.filter((note) => new Date(note.updatedAt) >= todayStart),
      older: visible.filter((note) => new Date(note.updatedAt) < todayStart),
    };
  }, [notes, query]);

  const pending = notes.filter((note) => note.dirty).length;

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <p className="home-eyebrow">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1>Elo Diário</h1>
        </div>
        <button type="button" className="icon-button" onClick={onSettings} aria-label="Ajustes">
          ⚙
        </button>
      </header>

      <div className="search-row">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar no diário…"
        />
        <button
          type="button"
          className={syncing ? 'sync-button syncing' : 'sync-button'}
          onClick={onSync}
          disabled={syncing || !cloud}
          aria-label="Sincronizar"
        >
          {syncing ? '↻' : '⟳'}
        </button>
      </div>

      <p className="sync-line">
        {!cloud
          ? 'Modo local — configure a nuvem para sincronizar.'
          : syncing
            ? 'Sincronizando…'
            : pending
              ? `${pending} página(s) aguardando envio.`
              : meta?.lastSyncedAt
                ? `Tudo sincronizado · ${new Date(meta.lastSyncedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Pronto para sincronizar.'}
        {lastResult && ` · ${lastResult}`}
      </p>

      <div className="note-grid">
        <button type="button" className="new-note-card" onClick={onCreate}>
          <span>+</span>
          <p>Nova página</p>
        </button>
        {today.map((note) => (
          <NoteCard key={note.id} note={note} onClick={() => onOpen(note.id)} />
        ))}
      </div>

      {older.length > 0 && (
        <>
          <h2 className="section-title">Antes</h2>
          <div className="note-grid">
            {older.map((note) => (
              <NoteCard key={note.id} note={note} onClick={() => onOpen(note.id)} />
            ))}
          </div>
        </>
      )}

      {!notes.length && (
        <div className="empty-state">
          <p>Nenhuma página ainda.</p>
          <p className="muted small">
            Toque em “Nova página” e use a caneta ou o dedo para começar a escrever.
          </p>
        </div>
      )}
    </div>
  );
}
