import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './lib/auth';
import { getAllNotes, putNote, loadSyncMeta, saveSyncMeta } from './lib/db';
import { emptyNote, type Note, type SyncMeta } from './lib/types';
import { syncNow } from './lib/sync';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import EditorScreen from './screens/EditorScreen';
import SettingsSheet from './components/SettingsSheet';
import LockScreen from './screens/LockScreen';
import { loadLock, disableLock, type LockSettings } from './lib/lock';

type View = { name: 'home' } | { name: 'editor'; id: string };

export default function App() {
  const { session, loading, cloud, signOut } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [meta, setMeta] = useState<SyncMeta | null>(null);
  const [view, setView] = useState<View>({ name: 'home' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lock, setLock] = useState<LockSettings | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockReady, setLockReady] = useState(false);
  const syncTimer = useRef<number | null>(null);
  const revision = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  /**
   * Relê o banco local. Uma leitura que começou antes de uma gravação mais nova
   * é descartada (senão uma página recém-criada "sumiria" da tela).
   */
  const refresh = useCallback(async () => {
    const stamp = ++revision.current;
    const [stored, storedMeta] = await Promise.all([getAllNotes(), loadSyncMeta()]);
    if (stamp !== revision.current) return;
    setNotes(stored);
    setMeta(storedMeta);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // carrega a configuração de bloqueio antes de mostrar qualquer conteúdo
  useEffect(() => {
    loadLock().then((stored) => {
      setLock(stored);
      setLocked(Boolean(stored?.enabled));
      setLockReady(true);
    });
  }, []);

  /**
   * Trava o app ao voltar do segundo plano depois do tempo configurado.
   * "Só ao fechar" (0) trava em toda saída do app.
   */
  useEffect(() => {
    const onVisibility = () => {
      if (!lock?.enabled) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      const limit = lock.autoLockMinutes * 60_000;
      if (lock.autoLockMinutes === 0 || away >= limit) setLocked(true);
      hiddenAt.current = null;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lock]);

  // escuta o botão voltar do Android
  useEffect(() => {
    const onPop = () => setView({ name: 'home' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const runSync = useCallback(async () => {
    if (!session?.user.id || !cloud) return;
    setSyncing(true);
    setLastResult(null);
    const result = await syncNow(session.user.id);
    await refresh();
    setSyncing(false);
    if (result.error) setLastResult(`erro: ${result.error}`);
    else setLastResult(`${result.pushed} enviada(s), ${result.pulled} recebida(s)`);
  }, [session, cloud, refresh]);

  // sincroniza ao abrir, ao voltar o foco e a cada 60s enquanto o app estiver visível
  useEffect(() => {
    if (!session || !cloud) return;
    runSync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', runSync);
    syncTimer.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') runSync();
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', runSync);
      if (syncTimer.current) window.clearInterval(syncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, cloud]);

  const saveNote = useCallback(
    async (note: Note) => {
      revision.current += 1;
      await putNote({ ...note, dirty: true });
      setNotes((prev) => {
        const rest = prev.filter((item) => item.id !== note.id);
        return [note, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
      const current = await loadSyncMeta();
      await saveSyncMeta({ ...current, lastError: null });
    },
    [],
  );

  const createNote = useCallback(async () => {
    const note = emptyNote();
    revision.current += 1;
    await putNote(note);
    setNotes((prev) => [note, ...prev]);
    setView({ name: 'editor', id: note.id });
    window.history.pushState({ note }, '');
  }, []);

  const openNote = (id: string) => {
    setView({ name: 'editor', id });
    window.history.pushState({ id }, '');
  };

  const deleteNote = async (id: string) => {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    const now = new Date().toISOString();
    const trashed: Note = { ...note, deleted: true, dirty: true, updatedAt: now };
    revision.current += 1;
    await putNote(trashed);
    setNotes((prev) => prev.filter((item) => item.id !== id));
    setView({ name: 'home' });
    window.history.back();
  };

  if (loading || !lockReady) {
    return (
      <div className="boot-screen">
        <span className="brand-mark">é</span>
        <p>Carregando…</p>
      </div>
    );
  }

  if (locked && lock) {
    return (
      <LockScreen
        settings={lock}
        onUnlock={() => setLocked(false)}
        onForgot={async () => {
          // sem o PIN, o acesso é refeito: desliga o bloqueio e pede o login de novo
          if (
            !window.confirm(
              'Sem o PIN, o bloqueio será desligado e você entrará de novo na sua conta. Continuar?',
            )
          ) {
            return;
          }
          await disableLock();
          setLock(null);
          setLocked(false);
          // refaz o acesso pela conta (quando há nuvem configurada)
          if (cloud) await signOut();
        }}
      />
    );
  }

  if (cloud && !session) return <LoginScreen />;

  const activeNote =
    view.name === 'editor' ? notes.find((item) => item.id === view.id) ?? null : null;

  return (
    <div className="app-shell">
      {view.name === 'editor' && activeNote ? (
        <EditorScreen
          key={activeNote.id}
          note={activeNote}
          onSave={saveNote}
          onBack={() => {
            setView({ name: 'home' });
            window.history.back();
            if (cloud) runSync();
          }}
          onDelete={deleteNote}
        />
      ) : (
        <HomeScreen
          notes={notes.filter((note) => !note.deleted)}
          meta={meta}
          syncing={syncing}
          cloud={cloud}
          lastResult={lastResult}
          onOpen={openNote}
          onCreate={createNote}
          onSync={runSync}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        meta={meta}
        syncing={syncing}
        onSync={runSync}
        onReload={refresh}
        lock={lock}
        onLockChange={(next) => {
          setLock(next);
          if (!next) setLocked(false);
        }}
      />
    </div>
  );
}
