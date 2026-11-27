import { useMemo } from 'react';
import type { Note } from '../lib/types';
import { noteLabel, notePreview } from '../lib/types';
import { inkToDataUrl } from '../lib/ink';

interface Props {
  note: Note;
  onClick: () => void;
}

const formatDate = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export default function NoteCard({ note, onClick }: Props) {
  const thumbnail = useMemo(() => inkToDataUrl(note.ink, 240, 320), [note.ink]);
  const preview = notePreview(note);

  return (
    <button type="button" className="note-card" onClick={onClick}>
      <div className="note-card-head">
        <span className="note-date">{formatDate(note.updatedAt)}</span>
        {note.dirty && <span className="dot-dirty" title="Ainda não sincronizado" />}
      </div>
      <h3 className="note-title">{noteLabel(note)}</h3>
      {preview && <p className="note-preview">{preview}</p>}
      {thumbnail && <img className="note-thumb" src={thumbnail} alt="" loading="lazy" />}
    </button>
  );
}
