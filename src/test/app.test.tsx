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
