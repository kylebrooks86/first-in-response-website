/** Opt-in Customers boundary. Inactive until a reviewed UI explicitly supplies a vault. */
import { verifyLocalCustomerRecoveryArchive, type LocalCustomerRecoveryFormat } from './local-customer-backup';
import type { openLocalCustomerVault } from './local-customer-vault';
import type { LocalCustomer, LocalCustomerInput } from './local-customer-store';

type Vault = Awaited<ReturnType<typeof openLocalCustomerVault>>;
type Session = Awaited<ReturnType<Vault['unlock']>>;
type Phase = 'locked' | 'unlocking' | 'ready' | 'unavailable' | 'closed';
type SaveState = 'idle' | 'saving' | 'saved-locally' | 'needs-inspection';
export type LocalCustomerDirectory =
  | { status: 'ready'; customers: LocalCustomer[]; pendingOperationCount: number; saveState: SaveState; jobHistory: 'connection-required' }
  | { status: Exclude<Phase, 'ready'>; customers: null; pendingOperationCount: null; saveState: 'idle'; jobHistory: 'connection-required' };

export class LocalCustomerRepositoryError extends Error {
  constructor(public readonly code: 'CLOSED' | 'BUSY' | 'LOCKED' | 'UNLOCK_FAILED' | 'SAVE_FAILED' | 'INSPECTION_FAILED' | 'INTERRUPTED') {
    super(code); this.name = 'LocalCustomerRepositoryError';
  }
}

/** No fetch, localStorage, initialization, restore, financial totals or sync decisions here. */
export function createLocalCustomerRepository(vault: Vault) {
  let session: Session | undefined, phase: Phase = 'locked', saveState: SaveState = 'idle';
  let generation = 0, busy = false;
  const listeners = new Set<(state: LocalCustomerDirectory) => void>();
  function read(): LocalCustomerDirectory {
    if (phase === 'ready' && session) {
      try {
        const snapshot = session.exportSnapshot(); // Rechecks vault lifecycle/cross-tab revocation.
        return { status: 'ready', customers: snapshot.customers, pendingOperationCount: snapshot.pendingOperations.length,
          saveState, jobHistory: 'connection-required' };
      } catch {
        session = undefined;
        // A synchronous cross-tab check may already have emitted locked/closed.
        if (phase === 'ready') phase = 'unavailable';
        saveState = 'idle';
      }
    }
    return { status: phase === 'ready' ? 'unavailable' : phase, customers: null,
      pendingOperationCount: null, saveState: 'idle', jobHistory: 'connection-required' };
  }
  function notify() {
    const state = read();
    for (const listener of listeners) {
      try { listener(structuredClone(state)); } catch { /* UI errors cannot prevent lock/data protection. */ }
    }
  }
  function invalidate(next: Phase) {
    generation++; session = undefined; phase = next; saveState = 'idle'; busy = false; notify();
  }
  const unsubscribeLock = vault.onLock(() => { if (phase !== 'closed') invalidate('locked'); });
  function start() {
    if (phase === 'closed') throw new LocalCustomerRepositoryError('CLOSED');
    if (busy) throw new LocalCustomerRepositoryError('BUSY');
    busy = true; return generation;
  }
  return {
    read,
    subscribe(listener: (state: LocalCustomerDirectory) => void) {
      if (phase === 'closed') throw new LocalCustomerRepositoryError('CLOSED');
      if (typeof listener !== 'function') throw new TypeError('Invalid customer state listener.');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    async unlock(phrase: string): Promise<LocalCustomerDirectory> {
      if (phase === 'ready') throw new LocalCustomerRepositoryError('BUSY'); // Lock before replacing a live session.
      const epoch = start(); session = undefined; phase = 'unlocking'; saveState = 'idle'; notify();
      try {
        const opened = await vault.unlock(phrase); // Never seeds an empty destination.
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        session = opened; phase = 'ready'; notify();
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        return read();
      } catch (error) {
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        session = undefined; phase = 'locked'; notify();
        throw new LocalCustomerRepositoryError('UNLOCK_FAILED');
      } finally { if (epoch === generation) busy = false; }
    },
    async save(input: LocalCustomerInput, operationId: string, expectedRevision: number, phrase: string): Promise<LocalCustomerDirectory> {
      const epoch = start();
      try {
        if (read().status !== 'ready' || !session) throw new LocalCustomerRepositoryError('LOCKED');
        const active = session;
        const captured = structuredClone(input); // Caller edits cannot change a queued encryption operation.
        saveState = 'saving'; notify();
        await active.saveCustomer(captured, operationId, expectedRevision, phrase);
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        saveState = 'saved-locally';
        const view = read();
        if (view.status !== 'ready') throw new LocalCustomerRepositoryError('INTERRUPTED');
        notify();
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        return view; // Current snapshot, not an older idempotent operation receipt.
      } catch (error) {
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        if (error instanceof LocalCustomerRepositoryError && error.code === 'LOCKED') throw error;
        saveState = 'needs-inspection'; notify();
        // Failed/ambiguous saves never promise that nothing committed and never retry automatically.
        throw new LocalCustomerRepositoryError('SAVE_FAILED');
      } finally { if (epoch === generation) busy = false; }
    },
    async recoverPortableBackup(envelope: unknown, phrase: string, confirmed: boolean, format: LocalCustomerRecoveryFormat = 'portable-bundle') {
      const epoch = start();
      try {
        if (phase !== 'locked' || session) throw new LocalCustomerRepositoryError('BUSY');
        if (confirmed !== true) throw new Error('Explicit recovery confirmation required.');
        const result = await vault.recoverPortableBundleIntoEmptyVault(structuredClone(envelope), phrase, format);
        if (epoch !== generation || read().status !== 'locked') throw new LocalCustomerRepositoryError('INTERRUPTED');
        return result; // Recovery stays locked; no automatic unlock or retry.
      } finally { if (epoch === generation) busy = false; }
    },
    async inspectPortableDestination(envelope: unknown, phrase: string, format: LocalCustomerRecoveryFormat = 'portable-bundle') {
      const epoch = start();
      try {
        if (phase !== 'locked' || session) throw new LocalCustomerRepositoryError('BUSY');
        const result = await vault.inspectPortableBundleDestination(structuredClone(envelope), phrase, format);
        if (epoch !== generation || read().status !== 'locked') throw new LocalCustomerRepositoryError('INTERRUPTED');
        return result;
      } finally { if (epoch === generation) busy = false; }
    },
    async exportPortableBackup(phrase: string) {
      const epoch = start();
      try {
        if (read().status !== 'ready' || !session) throw new LocalCustomerRepositoryError('LOCKED');
        const envelope = await session.exportPortableBundle(phrase);
        if (epoch !== generation || read().status !== 'ready') throw new LocalCustomerRepositoryError('INTERRUPTED');
        return envelope;
      } finally { if (epoch === generation) busy = false; }
    },
    async verifyPortableBackup(envelope: unknown, phrase: string, format: LocalCustomerRecoveryFormat = 'portable-bundle') {
      const epoch = start();
      try {
        if (read().status !== 'ready' || !session) throw new LocalCustomerRepositoryError('LOCKED');
        const namespace = session.exportSnapshot().namespace;
        const { bundle } = await verifyLocalCustomerRecoveryArchive(structuredClone(envelope), namespace, phrase, format);
        if (epoch !== generation || read().status !== 'ready') throw new LocalCustomerRepositoryError('INTERRUPTED');
        return { format, customerCount: bundle.snapshot.customers.length, receiptCount: bundle.snapshot.pendingOperations.length,
          resolutionArchiveCount: bundle.resolutions.length, recoveryPerformed: false as const };
      } finally { if (epoch === generation) busy = false; }
    },
    async inspectStored(phrase: string) {
      const epoch = start();
      try {
        if (read().status !== 'ready' || !session) throw new LocalCustomerRepositoryError('LOCKED');
        const stored = await session.inspectStoredSnapshot(phrase);
        if (epoch !== generation || read().status !== 'ready') throw new LocalCustomerRepositoryError('INTERRUPTED');
        return { customers: stored.customers, operations: stored.pendingOperations, acknowledgement: 'not-sent' as const };
      } catch (error) {
        if (epoch !== generation) throw new LocalCustomerRepositoryError('INTERRUPTED');
        if (error instanceof LocalCustomerRepositoryError) throw error;
        throw new LocalCustomerRepositoryError('INSPECTION_FAILED');
      } finally { if (epoch === generation) busy = false; }
    },
    lock() {
      if (phase === 'closed') return;
      try { vault.lock(); } finally { if (phase !== 'locked') invalidate('locked'); }
    },
    dispose() {
      if (phase === 'closed') return;
      try { vault.lock(); } catch { /* Vault revokes sessions before attempting coordination. */ }
      invalidate('closed'); unsubscribeLock(); listeners.clear();
    },
  };
}
