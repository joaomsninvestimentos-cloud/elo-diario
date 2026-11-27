import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InkCanvas from '../components/InkCanvas';
import type { Note, Stroke } from '../lib/types';
import { noteLabel } from '../lib/types';
import { PEN_COLORS, PEN_SIZES, inkToDataUrl } from '../lib/ink';
import { extractText } from '../lib/ocr';

interface Props {
  note: Note;
  onSave: (note: Note) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
}

type Tab = 'text' | 'ink';

export default function EditorScreen({ note, onSave, onBack, onDelete }: Props) {
  const [draft, setDraft] = useState<Note>(note);
  const [tab, setTab] = useState<Tab>('ink');
  const [penOnly, setPenOnly] = useState(true);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [title, setTitle] = useState(note.title);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const titleRef = useRef(title);
  const onSaveRef = useRef(onSave);
  const pendingRef = useRef(false);
  const savedAtRef = useRef(Date.now());
  const savedTimerRef = useRef<number | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  draftRef.current = draft;
  titleRef.current = title;
  onSaveRef.current = onSave;

  /** grava o rascunho no aparelho (e um pouco depois na nuvem) se algo mudou */
  const flush = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    const current = draftRef.current;
    onSaveRef.current({ ...current, title: titleRef.current, dirty: true });
    savedAtRef.current = Date.now();
    setSavedFlash(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedFlash(false), 1400);
  }, []);

  const touch = useCallback(() => {
    pendingRef.current = true;
  }, []);

  // salva ao sair da tela (voltar, trocar de aba do Android, fechar)
  useEffect(
    () => () => {
      if (pendingRef.current) {
        pendingRef.current = false;
        onSaveRef.current({ ...draftRef.current, title: titleRef.current, dirty: true });
      }
    },
    [],
  );

  // salva 700 ms depois da última alteração
  useEffect(() => {
    if (!pendingRef.current) return;
    const timer = window.setTimeout(flush, 700);
    return () => window.clearTimeout(timer);
  }, [draft, title, flush]);

  // aproveita a saída do app para gravar o que estiver pendente
  useEffect(() => {
    const onHide = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  const updateInk = (ink: Stroke[]) => {
    const now = new Date().toISOString();
    touch();
    setDraft((prev) => ({ ...prev, ink, inkAt: now, updatedAt: now, dirty: true }));
  };

  const undo = () => {
    const ink = draft.ink.slice(0, -1);
    updateInk(ink);
  };

  const clearPage = () => {
    if (!draft.ink.length) return;
    if (!window.confirm('Apagar todo o desenho desta página?')) return;
    updateInk([]);
  };

  const runOcr = async () => {
    if (!draft.ink.length) return;
    setOcrBusy(true);
    setOcrProgress(0);
    setOcrMessage(null);
    try {
      const text = await extractText(draft.ink, setOcrProgress);
      const now = new Date().toISOString();
      touch();
      setDraft((prev) => {
        const body = prev.body.trim() ? `${prev.body.trim()}\n\n${text}` : text;
        return { ...prev, body, bodyAt: now, updatedAt: now, dirty: true };
      });
      setTab('text');
      setOcrMessage(text ? 'Texto reconhecido e adicionado ao diário.' : 'Não encontrei texto legível.');
    } catch (error) {
      setOcrMessage(
        error instanceof Error
          ? `Falha ao reconhecer: ${error.message}`
          : 'Falha ao reconhecer o texto.',
      );
    } finally {
      setOcrBusy(false);
    }
  };

  const header = useMemo(() => noteLabel({ ...draft, title }), [draft, title]);

  return (
    <div className="editor">
      <header className="editor-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            flush();
            onBack();
          }}
          aria-label="Voltar"
        >
          ←
        </button>
        <div className="editor-title-wrap">
          <input
            className="editor-title"
            value={title}
            onChange={(event) => {
              touch();
              setTitle(event.target.value);
            }}
            placeholder={header === 'Página em branco' ? 'Título da página' : 'Título'}
            aria-label="Título da página"
          />
          <span className={savedFlash ? 'editor-sub saved' : 'editor-sub'}>
            {savedFlash
              ? 'salvo'
              : new Date(draft.updatedAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            if (window.confirm('Mover esta página para a lixeira?')) onDelete(draft.id);
          }}
          aria-label="Excluir"
        >
          🗑
        </button>
      </header>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'ink' ? 'tab active' : 'tab'}
          onClick={() => setTab('ink')}
        >
          Escrever
        </button>
        <button
          type="button"
          className={tab === 'text' ? 'tab active' : 'tab'}
          onClick={() => setTab('text')}
        >
          Texto
        </button>
      </div>

      {tab === 'ink' ? (
        <>
          <div className="canvas-wrap">
            <InkCanvas
              ink={draft.ink}
              onChange={updateInk}
              color={color}
              size={tool === 'eraser' ? 12 : size}
              tool={tool}
              penOnly={penOnly}
            />
            <div className="page-lines" aria-hidden />
          </div>

          <div className="pen-bar">
            <div className="pen-group">
              {PEN_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={color === option ? 'swatch active' : 'swatch'}
                  style={{ background: option }}
                  onClick={() => {
                    setColor(option);
                    setTool('pen');
                  }}
                  aria-label={`Cor ${option}`}
                />
              ))}
            </div>
            <div className="pen-group">
              {PEN_SIZES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={size === option && tool === 'pen' ? 'size-pill active' : 'size-pill'}
                  onClick={() => {
                    setSize(option);
                    setTool('pen');
                  }}
                  aria-label={`Espessura ${option}`}
                >
                  <span style={{ width: option * 2 + 2, height: option * 2 + 2 }} />
                </button>
              ))}
            </div>
            <div className="pen-group pen-actions">
              <button
                type="button"
                className={tool === 'eraser' ? 'tool-button active' : 'tool-button'}
                onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
              >
                Borracha
              </button>
              <button type="button" className="tool-button" onClick={undo} disabled={!draft.ink.length}>
                Desfazer
              </button>
              <button type="button" className="tool-button" onClick={clearPage} disabled={!draft.ink.length}>
                Limpar
              </button>
              <button
                type="button"
                className={penOnly ? 'tool-button active' : 'tool-button'}
                onClick={() => setPenOnly((value) => !value)}
                title="Ignorar o toque do dedo e aceitar só a caneta"
              >
                Só caneta
              </button>
              <button
                type="button"
                className="tool-button tool-ocr"
                onClick={runOcr}
                disabled={ocrBusy || !draft.ink.length}
              >
                {ocrBusy ? `${Math.round(ocrProgress * 100)}%` : 'Virar texto'}
              </button>
            </div>
          </div>
          {ocrMessage && <p className="ocr-message">{ocrMessage}</p>}
        </>
      ) : (
        <div className="text-wrap">
          <textarea
            className="body-input"
            value={draft.body}
            placeholder="Escreva aqui o texto do diário…"
            onChange={(event) => {
              const now = new Date().toISOString();
              touch();
              setDraft((prev) => ({
                ...prev,
                body: event.target.value,
                bodyAt: now,
                updatedAt: now,
                dirty: true,
              }));
            }}
          />
          {draft.ink.length > 0 && (
            <button type="button" className="btn btn-ghost ocr-inline" onClick={runOcr} disabled={ocrBusy}>
              {ocrBusy
                ? `Reconhecendo escrita… ${Math.round(ocrProgress * 100)}%`
                : 'Reconhecer a escrita à mão desta página'}
            </button>
          )}
          {ocrMessage && <p className="ocr-message">{ocrMessage}</p>}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const url = inkToDataUrl(draft.ink, 1200, 1600);
              if (!url) return;
              const link = document.createElement('a');
              link.href = url;
              link.download = `pagina-${draft.id.slice(0, 8)}.png`;
              link.click();
            }}
            disabled={!draft.ink.length}
          >
            Salvar desenho como imagem
          </button>
        </div>
      )}
    </div>
  );
}
