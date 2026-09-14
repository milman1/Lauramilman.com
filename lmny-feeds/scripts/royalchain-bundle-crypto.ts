import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MAGIC = Buffer.from('LMNYRCB1', 'ascii');
const VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 16;
const KEY_BYTES = 32;
const MAX_PAYLOAD_BYTES = 100 * 1024 * 1024;
const SCRYPT_OPTIONS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function keyFromPassphrase(passphrase: Buffer, salt: Buffer): Buffer {
  if (passphrase.length < 16 || passphrase.length > 4096) throw new Error('invalid bundle key');
  return scryptSync(passphrase, salt, KEY_BYTES, SCRYPT_OPTIONS);
}

function makeHeader(ciphertextLength: number, salt: Buffer, iv: Buffer): Buffer {
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || !Number.isSafeInteger(ciphertextLength) || ciphertextLength < 0 || ciphertextLength > MAX_PAYLOAD_BYTES) throw new Error('invalid bundle envelope');
  const header = Buffer.alloc(HEADER_BYTES);
  MAGIC.copy(header, 0);
  header.writeUInt8(VERSION, 8);
  header.writeUInt8(SALT_BYTES, 9);
  header.writeUInt8(IV_BYTES, 10);
  header.writeUInt8(TAG_BYTES, 11);
  header.writeUInt32BE(ciphertextLength, 12);
  return Buffer.concat([header, salt, iv]);
}

function parseEnvelope(envelope: Buffer): { aad: Buffer; salt: Buffer; iv: Buffer; ciphertext: Buffer; tag: Buffer } {
  if (envelope.length < HEADER_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES) throw new Error('invalid bundle envelope');
  const header = envelope.subarray(0, HEADER_BYTES);
  if (!header.subarray(0, MAGIC.length).equals(MAGIC) || header.readUInt8(8) !== VERSION || header.readUInt8(9) !== SALT_BYTES || header.readUInt8(10) !== IV_BYTES || header.readUInt8(11) !== TAG_BYTES) throw new Error('invalid bundle envelope');
  const ciphertextLength = header.readUInt32BE(12);
  if (ciphertextLength > MAX_PAYLOAD_BYTES) throw new Error('invalid bundle envelope');
  const aadLength = HEADER_BYTES + SALT_BYTES + IV_BYTES;
  const expectedLength = aadLength + ciphertextLength + TAG_BYTES;
  if (envelope.length !== expectedLength) throw new Error('invalid bundle envelope');
  return { aad: envelope.subarray(0, aadLength), salt: envelope.subarray(HEADER_BYTES, aadLength - IV_BYTES), iv: envelope.subarray(aadLength - IV_BYTES, aadLength), ciphertext: envelope.subarray(aadLength, aadLength + ciphertextLength), tag: envelope.subarray(aadLength + ciphertextLength) };
}

export function encryptEnvelope(plaintext: Buffer, passphrase: Buffer): Buffer {
  if (plaintext.length > MAX_PAYLOAD_BYTES) throw new Error('bundle payload is too large');
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = keyFromPassphrase(passphrase, salt);
  // GCM ciphertext length equals plaintext length, so the authenticated header
  // can be constructed before encryption and included as AAD.
  const aad = makeHeader(plaintext.length, salt, iv);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([aad, ciphertext, tag]);
}

export function decryptEnvelope(envelope: Buffer, passphrase: Buffer): Buffer {
  const parsed = parseEnvelope(envelope);
  const key = keyFromPassphrase(passphrase, parsed.salt);
  const decipher = createDecipheriv('aes-256-gcm', key, parsed.iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(parsed.aad);
  decipher.setAuthTag(parsed.tag);
  // Do not expose or write update() output until final() authenticates the
  // complete ciphertext and tag.
  const plaintext = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]);
  if (plaintext.length > MAX_PAYLOAD_BYTES) throw new Error('bundle payload is too large');
  return plaintext;
}

async function argument(name: string): Promise<string> {
  const value = process.argv.slice(3).find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!value) throw new Error('missing bundle crypto argument');
  return value;
}

export async function encryptFile(inputPath: string, outputPath: string, keyPath: string): Promise<void> {
  const [plaintext, passphrase] = await Promise.all([readFile(inputPath), readFile(keyPath)]);
  await writeFile(outputPath, encryptEnvelope(plaintext, passphrase), { mode: 0o600 });
}

export async function decryptFile(inputPath: string, outputPath: string, keyPath: string): Promise<void> {
  await rm(outputPath, { force: true });
  try {
    const [envelope, passphrase] = await Promise.all([readFile(inputPath), readFile(keyPath)]);
    const plaintext = decryptEnvelope(envelope, passphrase);
    await writeFile(outputPath, plaintext, { mode: 0o600 });
  } catch {
    await rm(outputPath, { force: true });
    throw new Error('private bundle decryption failed');
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  const input = await argument('input');
  const output = await argument('output');
  const key = await argument('key-file');
  if (mode === 'encrypt') await encryptFile(input, output, key);
  else if (mode === 'decrypt') await decryptFile(input, output, key);
  else throw new Error('bundle crypto mode must be encrypt or decrypt');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('private bundle crypto operation failed');
    process.exitCode = 1;
  });
}
