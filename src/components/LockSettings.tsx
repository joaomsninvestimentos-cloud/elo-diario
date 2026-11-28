import { useEffect, useState } from 'react';
import {
  biometricAvailable,
  createLock,
  disableLock,
  enrollBiometric,
  isValidPin,
  removeBiometric,
  type LockSettings as Settings,
} from '../lib/lock';

interface Props {
  settings: Settings | null;
  onChange: (settings: Settings | null) => void;
  userEmail?: string;
}

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Só ao fechar' },
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
];

export default function LockSettingsSection({ settings, onChange, userEmail }: Props) {
  const [step, setStep] = useState<'idle' | 'create' | 'confirm'>('idle');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [autoLock, setAutoLock] = useState(settings?.autoLockMinutes ?? 5);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);

  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const reset = () => {
    setStep('idle');
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const begin = () => {
    setMessage(null);
    setError(null);
    setStep('create');
  };

  const finishCreate = async () => {
    if (!isValidPin(pin)) {
      setError('Use de 4 a 8 dígitos.');
      return;
    }
    if (pin !== confirmPin) {
      setError('Os PINs não são iguais.');
      setConfirmPin('');
      return;
    }
    setBusy(true);
    try {
      const created = await createLock(pin, autoLock);
      onChange(created);
      reset();
      setMessage('Bloqueio ativado. Peça o PIN na próxima vez que abrir o app.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ativar.');
    } finally {
      setBusy(false);
    }
  };

  const toggleBiometric = async () => {
    if (!settings) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (settings.biometricId) {
        onChange(await removeBiometric(settings));
        setMessage('Biometria removida. O PIN continua valendo.');
      } else {
        onChange(await enrollBiometric(settings, userEmail ?? ''));
        setMessage('Biometria cadastrada neste aparelho.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A biometria não foi cadastrada.');
    } finally {
      setBusy(false);
    }
  };

  const changeAutoLock = async (minutes: number) => {
    setAutoLock(minutes);
    if (settings) onChange({ ...settings, autoLockMinutes: minutes });
  };

  const turnOff = async () => {
    if (!window.confirm('Desligar o bloqueio por PIN? O diário voltará a abrir direto.')) return;
    await disableLock();
    onChange(null);
    setMessage('Bloqueio desligado.');
    reset();
  };

  if (step !== 'idle') {
    return (
      <div className="lock-setup">
        <h3>{step === 'create' ? 'Criar PIN' : 'Confirmar PIN'}</h3>
        <p className="muted small">
          {step === 'create'
            ? 'Escolha de 4 a 8 dígitos. Anote em local seguro — sem o PIN, o acesso é refeito pelo login.'
            : 'Digite o mesmo PIN novamente.'}
        </p>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={step === 'create' ? pin : confirmPin}
          maxLength={8}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '');
            if (step === 'create') setPin(digits);
            else setConfirmPin(digits);
          }}
          placeholder="••••"
          autoFocus
        />
        {error && <p className="form-error small">{error}</p>}
        <div className="row-buttons">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              if (step === 'create') {
                if (!isValidPin(pin)) {
                  setError('Use de 4 a 8 dígitos.');
                  return;
                }
                setError(null);
                setStep('confirm');
              } else {
                finishCreate();
              }
            }}
          >
            {step === 'create' ? 'Continuar' : busy ? 'Salvando…' : 'Ativar bloqueio'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="sheet-section">
      <h3>Bloqueio do app</h3>

      {!settings ? (
        <>
          <p className="muted small">
            Peça um PIN (e biometria, se o aparelho tiver) para abrir o diário. O PIN não é
            guardado: só um resumo criptográfico dele.
          </p>
          <button type="button" className="btn btn-primary" onClick={begin}>
            Ativar bloqueio
          </button>
        </>
      ) : (
        <>
          <p className="muted small">Bloqueio ativo.</p>
          <label className="lock-row">
            Travar depois de
            <select
              value={settings.autoLockMinutes}
              onChange={(event) => changeAutoLock(Number(event.target.value))}
            >
              {AUTO_LOCK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {bio && (
            <button type="button" className="btn btn-ghost" onClick={toggleBiometric} disabled={busy}>
              {settings.biometricId ? 'Remover biometria' : 'Cadastrar biometria deste aparelho'}
            </button>
          )}
          <div className="row-buttons">
            <button type="button" className="btn btn-ghost" onClick={begin}>
              Trocar PIN
            </button>
            <button type="button" className="btn btn-ghost" onClick={turnOff}>
              Desligar
            </button>
          </div>
        </>
      )}

      {error && <p className="form-error small">{error}</p>}
      {message && <p className="form-info small">{message}</p>}
    </section>
  );
}
