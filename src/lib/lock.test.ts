import { describe, expect, it } from 'vitest';
import { createLock, disableLock, isValidPin, loadLock, verifyPin } from './lock';

describe('PIN de bloqueio', () => {
  it('aceita de 4 a 8 dígitos e rejeita o resto', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('confere o PIN correto e recusa o errado', async () => {
    const settings = await createLock('4821', 5);
    expect(await verifyPin('4821', settings)).toBe(true);
    expect(await verifyPin('4822', settings)).toBe(false);
    expect(await verifyPin('04821', settings)).toBe(false);
  });

  it('nunca guarda o PIN em texto puro', async () => {
    const settings = await createLock('9137', 5);
    const serialized = JSON.stringify(settings);
    expect(serialized).not.toContain('9137');
    expect(settings.salt.length).toBeGreaterThan(10);
    expect(settings.hash.length).toBeGreaterThan(20);
  });

  it('usa salts diferentes para o mesmo PIN (contra tabelas prontas)', async () => {
    const a = await createLock('1111', 5);
    const b = await createLock('1111', 5);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPin('1111', a)).toBe(true);
    expect(await verifyPin('1111', b)).toBe(true);
  });

  it('recusa PIN fora do formato', async () => {
    await expect(createLock('12', 5)).rejects.toThrow(/4 a 8 dígitos/);
    await expect(createLock('abcd', 5)).rejects.toThrow();
  });

  it('persiste a configuração e pode ser desligado', async () => {
    const settings = await createLock('2468', 15);
    const stored = await loadLock();
    expect(stored?.enabled).toBe(true);
    expect(stored?.autoLockMinutes).toBe(15);
    expect(await verifyPin('2468', stored!)).toBe(true);
    void settings;

    await disableLock();
    expect(await loadLock()).toBeNull();
  });
});
