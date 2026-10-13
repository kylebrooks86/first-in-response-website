/** Inactive customer archive protection. Does not encrypt IndexedDB or unlock the app. */
import { validateLocalCustomerExport, type LocalCustomerInput, type LocalCustomerExport } from './local-customer-store';
export class LocalCustomerBackupError extends Error {
  constructor(readonly code: 'INVALID_ARCHIVE' | 'INVALID_PHRASE' | 'AUTHENTICATION_FAILED' | 'CRYPTO_UNAVAILABLE', message: string) {
    super(message); this.name = 'LocalCustomerBackupError';
  }
}
const FORMAT = 'fire-local-customers-encrypted';
const ITERATIONS = 600000;
const MAX_BYTES = 16 * 1024 * 1024;
const encoder = new TextEncoder();
type Envelope = { format: typeof FORMAT; version: 1; salt: string; iv: string; ciphertext: string };
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
function bytes(value: unknown, length?: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > (MAX_BYTES + 16) * 2 || !/^(?:[0-9a-f]{2})+$/.test(value)
    || (length !== undefined && value.length !== length * 2)) throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Invalid encrypted archive encoding.');
  return Uint8Array.from(value.match(/../g)!, byte => parseInt(byte, 16));
}
function passphrase(value: string) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 1024) throw new LocalCustomerBackupError('INVALID_PHRASE', 'Use a recovery passphrase of 16–1024 characters.');
  // Never normalize or trim: recovery must use the exact original phrase.
  return encoder.encode(value);
}
function cryptoAvailable(api: Crypto | undefined): Crypto {
  if (!api?.subtle || typeof api.getRandomValues !== 'function') throw new LocalCustomerBackupError('CRYPTO_UNAVAILABLE', 'Secure local cryptography unavailable.');
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
async function protectArchive(archive: unknown, phrase: string,
  provider: Crypto | undefined = globalThis.crypto): Promise<Envelope> {
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
async function recoverArchive<T>(value: unknown, phrase: string,
  validate: (value: unknown) => T, provider: Crypto | undefined = globalThis.crypto): Promise<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Invalid encrypted archive.');
  const envelope = value as Record<string, unknown>;
  const fields = ['format', 'version', 'salt', 'iv', 'ciphertext'];
  if (Object.keys(envelope).length !== fields.length || fields.some(field => !Object.hasOwn(envelope, field))
    || envelope.format !== FORMAT || envelope.version !== 1) throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Unsupported encrypted archive.');
  // Copy parameters before the asynchronous key derivation so caller mutations are harmless.
  const salt = bytes(envelope.salt, 16), iv = bytes(envelope.iv, 12), ciphertext = bytes(envelope.ciphertext);
  if (ciphertext.length < 16) throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Truncated encrypted archive.');
  const api = cryptoAvailable(provider), secret = await key(api, phrase, salt, 'decrypt');
  let plaintext: Uint8Array | undefined;
  try {
    try {
      plaintext = new Uint8Array(await api.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: associatedData, tagLength: 128 }, secret, ciphertext));
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'OperationError') {
        throw new LocalCustomerBackupError('CRYPTO_UNAVAILABLE', 'Local decryption failed; preserve the backup and vault.');
      }
      // AES-GCM deliberately cannot distinguish a wrong phrase from changed ciphertext.
      throw new LocalCustomerBackupError('AUTHENTICATION_FAILED', 'Backup could not be recovered; incorrect phrase or altered archive. No records changed.');
    }
    try {
      return validate(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
    } catch {
      throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Backup could not be recovered; invalid contents or account/target. No records changed.');
    }
  } finally { plaintext?.fill(0); }
}

export async function protectLocalCustomerBackup(value: unknown, namespace: string, phrase: string, provider: Crypto | undefined = globalThis.crypto) {
  return protectArchive(validateLocalCustomerExport(value, namespace), phrase, provider);
}
export async function recoverLocalCustomerBackup(value: unknown, namespace: string, phrase: string, provider: Crypto | undefined = globalThis.crypto) {
  return recoverArchive(value, phrase, payload => validateLocalCustomerExport(payload, namespace), provider);
}
export type LocalCustomerResolutionArchive = { format: 'fire-local-customer-resolution'; version: 1; namespace: string;
  operationId: string; originalDraft: LocalCustomerInput; originalExpectedRevision: number; reviewedSnapshot: LocalCustomerExport; proposed: LocalCustomerInput };
export function validateLocalCustomerResolutionArchive(value: unknown, namespace: string): LocalCustomerResolutionArchive {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid resolution archive.');
  const row = value as Record<string, unknown>;
  const fields = ['format', 'version', 'namespace', 'operationId', 'originalDraft', 'originalExpectedRevision', 'reviewedSnapshot', 'proposed'];
  if (Object.keys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key))
    || row.format !== 'fire-local-customer-resolution' || row.version !== 1 || row.namespace !== namespace
    || typeof row.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.operationId)
    || !Number.isSafeInteger(row.originalExpectedRevision) || (row.originalExpectedRevision as number) < 0
    || row.originalExpectedRevision === Number.MAX_SAFE_INTEGER) throw new Error('Invalid resolution metadata.');
  const reviewedSnapshot = validateLocalCustomerExport(row.reviewedSnapshot, namespace);
  function input(value: unknown): LocalCustomerInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid resolution contact.');
    const contact = value as LocalCustomerInput, customer = { ...contact, revision: 1, updatedAt: '2000-01-01T00:00:00.000Z' };
    return validateLocalCustomerExport({ format: 'fire-local-customers', version: 1, namespace, customers: [customer],
      pendingOperations: [{ id: 'validation-only', kind: 'customer-upsert', expectedRevision: 0, customer, input: contact }] }, namespace).pendingOperations[0].input;
  }
  const originalDraft = input(row.originalDraft), proposed = input(row.proposed);
  if (originalDraft.id !== proposed.id) throw new Error('Resolution customer identity mismatch.');
  return { format: 'fire-local-customer-resolution', version: 1, namespace, operationId: row.operationId,
    originalDraft, originalExpectedRevision: row.originalExpectedRevision as number, reviewedSnapshot, proposed };
}
export async function protectLocalCustomerResolutionArchive(value: unknown, namespace: string, phrase: string, provider: Crypto | undefined = globalThis.crypto) {
  return protectArchive(validateLocalCustomerResolutionArchive(value, namespace), phrase, provider);
}
export async function recoverLocalCustomerResolutionArchive(value: unknown, namespace: string, phrase: string, provider: Crypto | undefined = globalThis.crypto) {
  return recoverArchive(value, phrase, payload => validateLocalCustomerResolutionArchive(payload, namespace), provider);
}

export type LocalCustomerPortableBundle = { format: 'fire-local-customer-bundle'; version: 1; namespace: string;
  snapshot: LocalCustomerExport; resolutions: LocalCustomerResolutionArchive[]; resolutionOperationIds: string[] };
export function validateLocalCustomerPortableBundle(value: unknown, namespace: string): LocalCustomerPortableBundle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid customer bundle.');
  const row = value as Record<string, unknown>, fields = ['format', 'version', 'namespace', 'snapshot', 'resolutions', 'resolutionOperationIds'];
  if (Object.keys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key))
    || row.format !== 'fire-local-customer-bundle' || row.version !== 1 || row.namespace !== namespace
    || !Array.isArray(row.resolutions) || row.resolutions.length > 1000 || !Array.isArray(row.resolutionOperationIds)
    || row.resolutionOperationIds.length !== row.resolutions.length) throw new Error('Invalid customer bundle inventory.');
  const snapshot = validateLocalCustomerExport(row.snapshot, namespace);
  const operations = new Map(snapshot.pendingOperations.map(op => [op.id, op]));
  const resolutions = row.resolutions.map(value => validateLocalCustomerResolutionArchive(value, namespace));
  const ids = resolutions.map(resolution => resolution.operationId);
  if (new Set(ids).size !== ids.length || row.resolutionOperationIds.some(id => typeof id !== 'string')
    || JSON.stringify([...ids].sort()) !== JSON.stringify([...row.resolutionOperationIds].sort())) throw new Error('Incomplete or duplicate resolution inventory.');
  for (const resolution of resolutions) {
    const receipt = operations.get(resolution.operationId);
    const reviewed = resolution.reviewedSnapshot.customers.find(customer => customer.id === resolution.proposed.id);
    if (!receipt || receipt.expectedRevision !== (reviewed?.revision ?? 0)
      || JSON.stringify(receipt.input) !== JSON.stringify(resolution.proposed)) throw new Error('Resolution receipt does not match bundle snapshot.');
    for (const prior of resolution.reviewedSnapshot.pendingOperations) {
      if (JSON.stringify(operations.get(prior.id)) !== JSON.stringify(prior)) throw new Error('Resolution review history is missing or differs.');
    }
  }
  return { format: 'fire-local-customer-bundle', version: 1, namespace, snapshot, resolutions, resolutionOperationIds: ids };
}
export async function protectLocalCustomerPortableBundle(value: unknown, namespace: string, phrase: string, provider: Crypto | undefined = globalThis.crypto) {
  return protectArchive(validateLocalCustomerPortableBundle(value, namespace), phrase, provider);
}
/** Verification/decryption only; never opens storage or performs recovery. */
export async function verifyLocalCustomerPortableBundle(value: unknown, namespace: string, phrase: string, provider: Crypto | undefined = globalThis.crypto) {
  return recoverArchive(value, phrase, payload => validateLocalCustomerPortableBundle(payload, namespace), provider);
}
