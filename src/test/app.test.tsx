import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { AuthProvider } from '../lib/auth';

const renderApp = () =>
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );

describe('App sem nuvem configurada (modo local)', () => {
  it('abre direto no diário e não pede login', async () => {
    renderApp();
    expect(await screen.findByText('Elo Diário')).toBeTruthy();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
  });

  it('cria uma página, aceita texto e guarda para sincronizar depois', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByText('Nova página'));

    // editor aberto
    const title = await screen.findByLabelText('Título da página');
    await user.type(title, 'Primeiro dia');
    expect((title as HTMLInputElement).value).toBe('Primeiro dia');

    await user.click(screen.getByText('Texto'));
    const body = screen.getByPlaceholderText('Escreva aqui o texto do diário…');
    await user.type(body, 'Hoje comecei o diário.');
    expect((body as HTMLTextAreaElement).value).toBe('Hoje comecei o diário.');

    // volta para a lista e a página aparece salva
    await user.click(screen.getByLabelText('Voltar'));
    expect(await screen.findByText('Primeiro dia')).toBeTruthy();
  });

  it('mostra o aviso de modo local quando a nuvem não está configurada', async () => {
    renderApp();
    expect(await screen.findByText(/Modo local/)).toBeTruthy();
  });
});

describe('bloqueio por PIN', () => {
  it('pede o PIN antes de mostrar o diário e libera com o PIN certo', async () => {
    const { createLock } = await import('../lib/lock');
    await createLock('1357', 5);
    const user = userEvent.setup();
    renderApp();

    // a lista só aparece depois do PIN
    expect(await screen.findByText(/Digite seu PIN/)).toBeTruthy();
    expect(screen.queryByText('Nova página')).toBeNull();

    for (const digit of ['1', '3', '5', '7']) {
      await user.click(screen.getByRole('button', { name: digit }));
    }
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Nova página')).toBeTruthy();
  });

  it('não libera com o PIN errado', async () => {
    const { createLock } = await import('../lib/lock');
    await createLock('2468', 5);
    const user = userEvent.setup();
    renderApp();

    await screen.findByText(/Digite seu PIN/);
    for (const digit of ['9', '9', '9', '9']) {
      await user.click(screen.getByRole('button', { name: digit }));
    }
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('PIN incorreto.')).toBeTruthy();
    expect(screen.queryByText('Nova página')).toBeNull();
  });

  it('sem bloqueio configurado abre direto no diário', async () => {
    const { disableLock } = await import('../lib/lock');
    await disableLock();
    renderApp();
    expect(await screen.findByText('Nova página')).toBeTruthy();
    expect(screen.queryByText(/Digite seu PIN/)).toBeNull();
  });
});
