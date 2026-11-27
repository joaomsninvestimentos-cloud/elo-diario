import { useState } from 'react';
import { useAuth } from '../lib/auth';

export default function LoginScreen() {
  const { signIn, signUp, cloud } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirm } = await signUp(email.trim(), password);
        if (needsConfirm) {
          setInfo('Conta criada. Abra o e-mail de confirmação para ativar o acesso.');
          setMode('in');
        } else {
          setInfo('Conta criada e conectada.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">é</span>
          <div>
            <h1>Elo Diário</h1>
            <p>Seu diário, no celular e no tablet.</p>
          </div>
        </div>

        {!cloud && (
          <div className="banner banner-warn">
            A nuvem ainda não está configurada. Crie o arquivo <code>.env</code> com
            <code> VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> — veja o README.
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          <label>
            E-mail
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="voce@exemplo.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              placeholder="mínimo 6 caracteres"
            />
          </label>

          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy || !cloud}>
            {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'in' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
}
