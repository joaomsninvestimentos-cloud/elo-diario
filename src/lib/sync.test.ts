import { describe, expect, it } from 'vitest';
import { mergeNotes, planPush } from './sync';
import type { Note, Stroke } from './types';

const stroke = (id: string, x = 0.5): Stroke => ({
  id,
  color: '#000',
  size: 3,
  points: [{ x, y: 0.5, p: 0.5 }],
});

const base = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  title: 'Título',
  body: 'corpo',
  ink: [],
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  titleAt: '2026-01-01T10:00:00.000Z',
  bodyAt: '2026-01-01T10:00:00.000Z',
  inkAt: null,
  deleted: false,
  dirty: false,
  serverUpdatedAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

describe('mergeNotes', () => {
  it('devolve a versão que existir quando só um lado tem a página', () => {
    const remote = base({ title: 'remoto' });
    expect(mergeNotes(undefined, remote)).toBe(remote);
    const local = base({ title: 'local' });
    expect(mergeNotes(local, undefined)).toBe(local);
  });

  it('mantém campos iguais sem marcar como pendente', () => {
    const merged = mergeNotes(base(), base());
    expect(merged.dirty).toBe(false);
    expect(merged.title).toBe('Título');
  });

  it('não gera pingue-pongue quando a mescla iguala os dois lados', () => {
    // remoto tem texto mais novo, local tem desenho mais novo
    const local = base({
      ink: [stroke('a')],
      inkAt: '2026-01-01T12:00:00.000Z',
      dirty: true,
    });
    const remote = base({
      body: 'corpo atualizado',
      bodyAt: '2026-01-01T11:00:00.000Z',
      updatedAt: '2026-01-01T11:00:00.000Z',
      serverUpdatedAt: '2026-01-01T11:00:00.000Z',
    });

    const merged = mergeNotes(local, remote);
    // junta os dois: texto do remoto + desenho do local
    expect(merged.body).toBe('corpo atualizado');
    expect(merged.ink).toHaveLength(1);
    // resultado difere do remoto, então precisa ser enviado uma vez…
    expect(merged.dirty).toBe(true);

    // …e depois de enviado, uma nova mescla com o mesmo remoto não repete o envio
    const afterPush = base({
      ...merged,
      dirty: false,
      serverUpdatedAt: merged.updatedAt,
    });
    const settled = mergeNotes(afterPush, {
      ...remote,
      body: merged.body,
      bodyAt: merged.bodyAt,
      ink: merged.ink,
      inkAt: merged.inkAt,
      updatedAt: merged.updatedAt,
    });
    expect(settled.dirty).toBe(false);
    expect(settled.body).toBe('corpo atualizado');
    expect(settled.ink).toHaveLength(1);
  });

  it('o campo mais recente vence, campo por campo', () => {
    const local = base({
      title: 'título local',
      titleAt: '2026-01-02T09:00:00.000Z',
      body: 'corpo antigo',
      bodyAt: '2026-01-01T09:00:00.000Z',
    });
    const remote = base({
      title: 'título remoto',
      titleAt: '2026-01-01T09:00:00.000Z',
      body: 'corpo remoto novo',
      bodyAt: '2026-01-02T09:00:00.000Z',
    });

    const merged = mergeNotes(local, remote);
    expect(merged.title).toBe('título local');
    expect(merged.body).toBe('corpo remoto novo');
  });

  it('propaga exclusão para os outros aparelhos', () => {
    const local = base({ deleted: true, dirty: true });
    const remote = base();
    const merged = mergeNotes(local, remote);
    expect(merged.deleted).toBe(true);
    expect(merged.dirty).toBe(true);
  });
});

describe('planPush', () => {
  it('envia páginas novas criadas neste aparelho', () => {
    const fresh = base({ id: 'nova', dirty: true });
    const pushed = planPush([fresh], [], new Set());
    expect(pushed.map((note) => note.id)).toEqual(['nova']);
  });

  it('não envia página nova que já foi sincronizada', () => {
    const synced = base({ id: 'nova', dirty: false });
    expect(planPush([synced], [], new Set())).toHaveLength(0);
  });

  it('não reenvia página local idêntica à da nuvem', () => {
    const local = base({ dirty: false });
    const merged = base({ dirty: false });
    expect(planPush([local], [merged], new Set(['n1']))).toHaveLength(0);
  });

  it('envia exclusão feita offline de uma página que a nuvem ainda não conhece', () => {
    const trashed = base({ id: 'off', deleted: true, dirty: true });
    const pushed = planPush([trashed], [], new Set());
    expect(pushed).toHaveLength(1);
    expect(pushed[0].deleted).toBe(true);
  });
});
