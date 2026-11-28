import { getMeta, setMeta } from './db';

const LOCK_KEY = 'lock';
const ITERATIONS = 210_000;

export interface LockSettings {
  enabled: boolean;
  /** salt e hash do PIN (PBKDF2-SHA256); o PIN em si nunca é guardado */
  salt: string;
  hash: string;
  iterations: number;
  /** id da credencial biométrica (WebAuthn), quando cadastrada */
  biometricId: string | null;
  /** minutos sem uso até travar de novo; 0 = só ao fechar o app */
  autoLockMinutes: number;
}

const encoder = new TextEncoder();

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string): ArrayBuffer => {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
};

const toBase64Url = (buffer: ArrayBuffer): string =>
  toBase64(buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (value: string): ArrayBuffer =>
  fromBase64(
    value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='),
  );

export const deriveHash = async (pin: string, salt: string, iterations = ITERATIONS): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toBase64(bits);
};

/** comparação de tempo constante para não vazar o hash por tempo de resposta */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const loadLock = async (): Promise<LockSettings | null> =>
  getMeta<LockSettings | null>(LOCK_KEY, null);

export const saveLock = async (settings: LockSettings): Promise<void> =>
  setMeta(LOCK_KEY, settings);

export const isValidPin = (pin: string): boolean => /^\d{4,8}$/.test(pin);

export const createLock = async (pin: string, autoLockMinutes = 5): Promise<LockSettings> => {
  if (!isValidPin(pin)) throw new Error('O PIN precisa ter de 4 a 8 dígitos.');
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await deriveHash(pin, salt, ITERATIONS);
  const settings: LockSettings = {
    enabled: true,
    salt,
    hash,
    iterations: ITERATIONS,
    biometricId: null,
    autoLockMinutes,
  };
  await saveLock(settings);
  return settings;
};

export const verifyPin = async (pin: string, settings: LockSettings): Promise<boolean> => {
  const hash = await deriveHash(pin, settings.salt, settings.iterations);
  return safeEqual(hash, settings.hash);
};

export const disableLock = async (): Promise<void> => setMeta(LOCK_KEY, null);

// ---------------------------------------------------------------------------
// Biometria (WebAuthn) — funciona como atalho de desbloqueio no próprio aparelho
// ---------------------------------------------------------------------------

export const biometricAvailable = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

const randomChallenge = () => crypto.getRandomValues(new Uint8Array(32)).buffer;

export const enrollBiometric = async (
  settings: LockSettings,
  userName: string,
): Promise<LockSettings> => {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Elo Diário', id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: userName || 'elo-diario',
        displayName: userName || 'Elo Diário',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Não foi possível cadastrar a biometria.');
  const updated: LockSettings = { ...settings, biometricId: toBase64Url(credential.rawId) };
  await saveLock(updated);
  return updated;
};

export const unlockWithBiometric = async (settings: LockSettings): Promise<boolean> => {
  if (!settings.biometricId) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        timeout: 60_000,
        userVerification: 'required',
        rpId: window.location.hostname,
        allowCredentials: [
          { type: 'public-key', id: fromBase64Url(settings.biometricId), transports: ['internal'] },
        ],
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
};

export const removeBiometric = async (settings: LockSettings): Promise<LockSettings> => {
  const updated: LockSettings = { ...settings, biometricId: null };
  await saveLock(updated);
  return updated;
};
