/** Inactive customer archive protection. Does not encrypt IndexedDB or unlock the app. */
import { validateLocalCustomerExport, type LocalCustomerExport } from './local-customer-store';
const FORMAT = 'fire-local-customers-encrypted';
const ITERATIONS = 600000;
const MAX_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();
type Envelope = { format: typeof FORMAT; version: 1; salt: string; iv: string; ciphertext: string };
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
function bytes(value: unknown, length?: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > (MAX_BYTES + 16) * 2 || !/^(?:[0-9a-f]{2})+$/.test(value)
    || (length !== undefined && value.length !== length * 2)) throw new Error('Invalid encrypted archive encoding.');
  return Uint8Array.from(value.match(/../g)!, byte => parseInt(byte, 16));
}
function passphrase(value: string) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 1024) throw new Error('Use a recovery passphrase of 16–1024 characters.');
  // Never normalize or trim: recovery must use the exact original phrase.
  return encoder.encode(value);
}
function cryptoAvailable(api: Crypto | undefined): Crypto {
  if (!api?.subtle || typeof api.getRandomValues !== 'function') throw new Error('Secure local cryptography unavailable.');
  return api;
}
async function key(api: Crypto, phrase: string, salt: Uint8Array<ArrayBuffer>, usage: 'encrypt' | 'decrypt') {
  const materialBytes = passphrase(phrase);
  try {
    const material = await api.subtle.importKey('raw', materialBytes, 'PBKDF2', false, ['deriveKey']);
    return await api.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material,
      { name: 'AES-GCM', length: 256 }, false, [usage]);
  } finally { materialBytes.fill(0); }
}
const associatedData = encoder.encode(`${FORMAT}:v1:PBKDF2-SHA256:${ITERATIONS}:AES-256-GCM`);
export async function protectLocalCustomerBackup(value: unknown, namespace: string, phrase: string,
  provider: Crypto | undefined = globalThis.crypto): Promise<Envelope> {
  const archive = validateLocalCustomerExport(value, namespace);
  const plaintext = encoder.encode(JSON.stringify(archive));
  try {
    if (plaintext.length > MAX_BYTES) throw new Error('Customer archive exceeds protection size limit.');
    passphrase(phrase).fill(0);
    const api = cryptoAvailable(provider);
    const salt = api.getRandomValues(new Uint8Array(16)), iv = api.getRandomValues(new Uint8Array(12));
    const secret = await key(api, phrase, salt, 'encrypt');
    const encrypted = await api.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: associatedData, tagLength: 128 }, secret, plaintext);
    return { format: FORMAT, version: 1, salt: hex(salt), iv: hex(iv), ciphertext: hex(new Uint8Array(encrypted)) };
  } finally { plaintext.fill(0); }
}
export async function recoverLocalCustomerBackup(value: unknown, namespace: string, phrase: string,
  provider: Crypto | undefined = globalThis.crypto): Promise<LocalCustomerExport> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid encrypted archive.');
  const envelope = value as Record<string, unknown>;
  const fields = ['format', 'version', 'salt', 'iv', 'ciphertext'];
  if (Object.keys(envelope).length !== fields.length || fields.some(field => !Object.hasOwn(envelope, field))
    || envelope.format !== FORMAT || envelope.version !== 1) throw new Error('Unsupported encrypted archive.');
  // Copy parameters before the asynchronous key derivation so caller mutations are harmless.
  const salt = bytes(envelope.salt, 16), iv = bytes(envelope.iv, 12), ciphertext = bytes(envelope.ciphertext);
  if (ciphertext.length < 16) throw new Error('Truncated encrypted archive.');
  const api = cryptoAvailable(provider), secret = await key(api, phrase, salt, 'decrypt');
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = new Uint8Array(await api.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: associatedData, tagLength: 128 }, secret, ciphertext));
    return validateLocalCustomerExport(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)), namespace);
  } catch { throw new Error('Backup could not be recovered; check the passphrase, archive and account/target. No records changed.'); }
  finally { plaintext?.fill(0); }
}
