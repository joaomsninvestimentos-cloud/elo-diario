import { useCallback, useEffect, useState } from 'react';
import {
  biometricAvailable,
  unlockWithBiometric,
  verifyPin,
  type LockSettings,
} from '../lib/lock';

interface Props {
  settings: LockSettings;
  onUnlock: () => void;
  onForgot: () => void;
}

export default function LockScreen({ settings, onUnlock, onForgot }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [canBiometric, setCanBiometric] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    biometricAvailable().then((ok) => setCanBiometric(ok && Boolean(settings.biometricId)));
  }, [settings.biometricId]);

  const locked = attempts >= 5;

  const tryBiometric = useCallback(async () => {
    if (!settings.biometricId) return;
    setBusy(true);
    const ok = await unlockWithBiometric(settings);
    setBusy(false);
    if (ok) onUnlock();
    else setError('Biometria não confirmada. Use o PIN.');
  }, [settings, onUnlock]);

  // tenta a biometria assim que a tela de bloqueio aparece
  useEffect(() => {
    if (settings.biometricId) {
      biometricAvailable().then((ok) => {
        if (ok) tryBiometric();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value: string) => {
    if (busy || locked) return;
    setBusy(true);
    const ok = await verifyPin(value, settings);
    setBusy(false);
    if (ok) {
      onUnlock();
      return;
    }
    setPin('');
    setAttempts((count) => count + 1);
    setError('PIN incorreto.');
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  };

  const press = (digit: string) => {
    if (locked) return;
    setError(null);
    // o tamanho do PIN não fica guardado (só o hash), então a confirmação é no ✓
    setPin(`${pin}${digit}`.slice(0, 8));
  };

  const dots = Array.from({ length: Math.max(pin.length, 4) });

  return (
    <div className="lock-screen">
      <div className={shake ? 'lock-card shake' : 'lock-card'}>
        <span className="brand-mark">é</span>
        <h1>Elo Diário</h1>
        <p className="muted small">
          {locked ? 'Muitas tentativas. Feche o app e abra de novo.' : 'Digite seu PIN para entrar.'}
        </p>

        <div className="pin-dots" aria-label={`${pin.length} dígitos digitados`}>
          {dots.map((_, index) => (
            <span key={index} className={index < pin.length ? 'pin-dot filled' : 'pin-dot'} />
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button key={digit} type="button" className="pin-key" onClick={() => press(digit)}>
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="pin-key pin-key-ghost"
            onClick={() => setPin((value) => value.slice(0, -1))}
            aria-label="Apagar"
          >
            ⌫
          </button>
          <button type="button" className="pin-key" onClick={() => press('0')}>
            0
          </button>
          <button
            type="button"
            className="pin-key pin-key-ok"
            onClick={() => submit(pin)}
            disabled={pin.length < 4 || busy || locked}
            aria-label="Entrar"
          >
            ✓
          </button>
        </div>

        {canBiometric && (
          <button type="button" className="btn btn-ghost" onClick={tryBiometric} disabled={busy || locked}>
            Usar biometria
          </button>
        )}
        <button type="button" className="link-button" onClick={onForgot}>
          Esqueci o PIN
        </button>
      </div>
    </div>
  );
}
