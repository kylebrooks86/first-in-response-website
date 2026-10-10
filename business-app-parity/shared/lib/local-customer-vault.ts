/** Inactive encrypted snapshot foundation; no UI, plaintext migration or automatic sync. */
import { localCustomerDatabaseName, type LocalCustomerExport } from './local-customer-store';
import { protectLocalCustomerBackup, recoverLocalCustomerBackup } from './local-customer-backup';

export async function openLocalCustomerVault(account: string, target: string,
  factory: IDBFactory | undefined = globalThis.indexedDB, provider: Crypto | undefined = globalThis.crypto) {
  const customerNamespace = localCustomerDatabaseName(account, target);
  const namespace = customerNamespace.replace('fire-local-customers:v1:', 'fire-local-customer-vault:v1:');
  if (!factory) throw new Error('Encrypted local storage unavailable.');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let abandoned = false;
    const request = factory.open(namespace, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sealed', { keyPath: 'id' });
    request.onblocked = () => { abandoned = true; reject(new Error('Encrypted storage blocked; close other windows.')); };
    request.onerror = () => reject(request.error ?? new Error('Encrypted storage could not open.'));
    request.onsuccess = () => {
      const connection = request.result;
      if (abandoned) { connection.close(); return; }
      if (connection.objectStoreNames.length !== 1 || !connection.objectStoreNames.contains('sealed')
        || connection.transaction('sealed').objectStore('sealed').keyPath !== 'id') {
        connection.close(); reject(new Error('Encrypted storage schema mismatch; preserve data.')); return;
      }
      resolve(connection);
    };
  });
  let generation = 0, closed = false;
  const sessions = new Set<() => void>();
  const initializations = new Set<IDBTransaction>();
  function lock() {
    generation++;
    for (const revoke of sessions) revoke();
    sessions.clear();
    for (const tx of initializations) { try { tx.abort(); } catch { /* Already complete; never erase committed data. */ } }
  }
  function close() { lock(); closed = true; db.close(); }
  function check(epoch: number) {
    if (closed || epoch !== generation) throw new Error('Vault locked or closed; unlock again.');
  }
  db.onversionchange = close;
  return {
    namespace,
    lock,
    close,
    async initialize(value: unknown, phrase: string): Promise<void> {
      const epoch = generation; check(epoch);
      // Encryption/validation completes before any write transaction is opened.
      const envelope = await protectLocalCustomerBackup(value, customerNamespace, phrase, provider);
      check(epoch);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sealed', 'readwrite'); initializations.add(tx);
        tx.oncomplete = () => { initializations.delete(tx); resolve(); };
        tx.onabort = () => { initializations.delete(tx); reject(tx.error ?? new Error('Vault initialization aborted; no snapshot committed.')); };
        // add, never put: existing snapshots cannot be overwritten, even across tabs.
        try { tx.objectStore('sealed').add({ id: 'snapshot', version: 1, envelope }); }
        catch (error) { tx.abort(); reject(error); }
      });
    },
    async unlock(phrase: string) {
      const epoch = generation; check(epoch);
      const sealed = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('sealed', 'readonly');
        const request = tx.objectStore('sealed').get('snapshot');
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error ?? new Error('Vault read aborted.'));
      });
      check(epoch);
      if (!sealed || typeof sealed !== 'object' || Array.isArray(sealed)) throw new Error('Vault not initialized; recover from an owner-held backup.');
      const row = sealed as Record<string, unknown>;
      if (Object.keys(row).length !== 3 || row.id !== 'snapshot' || row.version !== 1 || !Object.hasOwn(row, 'envelope')) throw new Error('Invalid vault snapshot; preserve data.');
      let snapshot: LocalCustomerExport | undefined = await recoverLocalCustomerBackup(row.envelope, customerNamespace, phrase, provider);
      check(epoch); // Lock/close during derivation must not publish an unlocked session.
      const revoke = () => { snapshot = undefined; sessions.delete(revoke); };
      sessions.add(revoke);
      function current() {
        check(epoch);
        if (!snapshot) throw new Error('Customer session locked.');
        return snapshot;
      }
      return {
        lock: revoke,
        getCustomer(id: string) {
          if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid customer ID.');
          return structuredClone(current().customers.find(row => row.id === id) ?? null);
        },
        listCustomers: () => structuredClone(current().customers),
        exportSnapshot: () => structuredClone(current()),
      };
    },
  };
}
