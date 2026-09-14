import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decryptEnvelope, decryptFile, encryptEnvelope } from '../scripts/royalchain-bundle-crypto.js';

const key = Buffer.from('a deliberately long temporary test passphrase');
const otherKey = Buffer.from('a different deliberately long test passphrase');

describe('Royal Chain authenticated bundle envelope', () => {
  it('round-trips with AES-256-GCM', () => {
    const plaintext = Buffer.from('private tar payload bytes');
    expect(decryptEnvelope(encryptEnvelope(plaintext, key), key)).toEqual(plaintext);
  });

  it.each([
    ['header', 0],
    ['ciphertext', 16 + 16 + 12 + 1],
    ['tag', -1],
  ])('rejects tampered %s', (_label, position) => {
    const envelope = encryptEnvelope(Buffer.from('payload'), key);
    const index = position < 0 ? envelope.length + position : position;
    envelope[index] = envelope[index]! ^ 0x01;
    expect(() => decryptEnvelope(envelope, key)).toThrow();
  });

  it('rejects a wrong key and truncation', () => {
    const envelope = encryptEnvelope(Buffer.from('payload'), key);
    expect(() => decryptEnvelope(envelope, otherKey)).toThrow();
    expect(() => decryptEnvelope(envelope.subarray(0, -1), key)).toThrow();
  });

  it('writes no plaintext when authenticated decryption fails', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'royalchain-crypto-'));
    const envelopePath = path.join(directory, 'bundle.enc');
    const outputPath = path.join(directory, 'payload.tar.gz');
    const keyPath = path.join(directory, 'key');
    await writeFile(envelopePath, encryptEnvelope(Buffer.from('secret payload'), key));
    await writeFile(keyPath, otherKey);
    await expect(decryptFile(envelopePath, outputPath, keyPath)).rejects.toThrow('private bundle decryption failed');
    await expect(access(outputPath)).rejects.toThrow();
    await writeFile(keyPath, key);
    await decryptFile(envelopePath, outputPath, keyPath);
    expect(await readFile(outputPath, 'utf8')).toBe('secret payload');
  });
});
