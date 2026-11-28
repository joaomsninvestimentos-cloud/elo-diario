import { useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { exportAll, importAll } from '../lib/db';
import type { SyncMeta } from '../lib/types';
import LockSettingsSection from './LockSettings';
import type { LockSettings } from '../lib/lock';

interface Props {
  open: boolean;
  onClose: () => void;
  meta: SyncMeta | null;
  syncing: boolean;
  onSync: () => void;
  onReload: () => void;
  lock: LockSettings | null;
  onLockChange: (settings: LockSettings | null) => void;
}

export default function SettingsSheet({
  open,
  onClose,
  meta,
  syncing,
  onSync,
  onReload,
  lock,
  onLockChange,
}: Props) {
  const { session, signOut, cloud } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!open) return null;

  const download = async () => {
    const payload = await exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elo-diario-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    try {
      const text = await file.text();
      const count = await importAll(JSON.parse(text));
      setMessage(`${count} página(s) restaurada(s).`);
      onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao restaurar o backup.');
    }
  };

  const lastSync = meta?.lastSyncedAt
    ? new Date(meta.lastSyncedAt).toLocaleString('pt-BR')
    : 'nunca';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>Conta e backup</h2>

        <section className="sheet-section">
          <h3>Conta</h3>
          <p className="muted">{session?.user.email ?? 'Sem sessão'}</p>
          <p className="muted small">
            Nuvem: {cloud ? 'configurada' : 'não configurada'} · Última sincronização: {lastSync}
          </p>
          {meta?.lastError && <p className="form-error small">Último erro: {meta.lastError}</p>}
          <div className="row-buttons">
            <button type="button" className="btn btn-ghost" onClick={onSync} disabled={syncing || !cloud}>
              {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={signOut}>
              Sair
            </button>
          </div>
        </section>

        <LockSettingsSection
          settings={lock}
          onChange={onLockChange}
          userEmail={session?.user.email}
        />

        <section className="sheet-section">
          <h3>Backup local</h3>
          <p className="muted small">
            Guarde uma cópia das suas páginas em arquivo. O arquivo não contém senha nem
            credenciais.
          </p>
          <div className="row-buttons">
            <button type="button" className="btn btn-ghost" onClick={download}>
              Exportar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Restaurar
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = '';
            }}
          />
          {message && <p className="form-info small">{message}</p>}
        </section>

        <button type="button" className="btn btn-primary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
