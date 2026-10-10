/** Inactive encrypted snapshot foundation; no UI, plaintext migration or automatic sync. */
import { localCustomerDatabaseName, validateLocalCustomerExport, type LocalCustomerExport, type LocalCustomerInput, type LocalCustomer } from './local-customer-store';
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
      let sealedIdentity = JSON.stringify(sealed);
      const pendingWrites = new Set<IDBTransaction>();
      const revoke = () => {
        snapshot = undefined; sessions.delete(revoke);
        for (const tx of pendingWrites) { try { tx.abort(); } catch { /* May already be committed. */ } }
      };
      sessions.add(revoke);
      function current() {
        check(epoch);
        if (!snapshot) throw new Error('Customer session locked.');
        return snapshot;
      }
      return {
        lock: revoke,
        async saveCustomer(input: LocalCustomerInput, operationId: string, expectedRevision: number, recoveryPhrase: string): Promise<LocalCustomer> {
          const archive = structuredClone(current());
          const expectedIdentity = sealedIdentity;
          const fields = ['id', 'name', 'email', 'phone', 'address', 'leadSource'] as const;
          if (!input || typeof input !== 'object' || Object.keys(input).length !== fields.length
            || fields.some(field => !Object.hasOwn(input, field))) throw new Error('Invalid customer input.');
          const customer = Object.fromEntries(fields.map(field => [field, input[field]])) as LocalCustomerInput;
          if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(operationId)
            || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision === Number.MAX_SAFE_INTEGER) throw new Error('Invalid operation/revision.');
          const previous = archive.pendingOperations.find(op => op.id === operationId);
          let result: LocalCustomer;
          if (previous) {
            if (previous.expectedRevision !== expectedRevision || JSON.stringify(previous.input) !== JSON.stringify(customer)) throw new Error('Operation ID already used for a different change.');
            result = previous.customer;
          } else {
            const old = archive.customers.find(row => row.id === customer.id);
            if ((old?.revision ?? 0) !== expectedRevision) throw new Error('Customer revision changed; review the latest record.');
            result = { ...customer, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
            archive.customers = archive.customers.filter(row => row.id !== customer.id).concat(result);
            archive.pendingOperations.push({ id: operationId, kind: 'customer-upsert', expectedRevision, customer: result, input: customer });
          }
          validateLocalCustomerExport(archive, customerNamespace);
          // Require the recovery phrase for each write; never retain it on a session.
          // This also prevents silently replacing ciphertext encrypted under another phrase.
          await recoverLocalCustomerBackup(JSON.parse(expectedIdentity).envelope, customerNamespace, recoveryPhrase, provider);
          current();
          const replacement = previous ? undefined : { id: 'snapshot', version: 1,
            envelope: await protectLocalCustomerBackup(archive, customerNamespace, recoveryPhrase, provider) };
          current();
          return new Promise<LocalCustomer>((resolve, reject) => {
            let failure: unknown;
            const tx = db.transaction('sealed', 'readwrite');
            initializations.add(tx); pendingWrites.add(tx);
            const finish = () => { initializations.delete(tx); pendingWrites.delete(tx); };
            tx.onabort = () => { finish(); reject(failure ?? tx.error ?? new Error('Encrypted customer save aborted; re-unlock and inspect before retry.')); };
            tx.oncomplete = () => {
              finish();
              try {
                current();
                if (replacement) { snapshot = archive; sealedIdentity = JSON.stringify(replacement); }
                resolve(structuredClone(result));
              } catch (error) { reject(error); }
            };
            const store = tx.objectStore('sealed'), request = store.get('snapshot');
            request.onsuccess = () => {
              try {
                current();
                if (JSON.stringify(request.result) !== expectedIdentity) throw new Error('Encrypted snapshot changed; unlock again before saving.');
                if (replacement) store.put(replacement);
              } catch (error) { failure = error; tx.abort(); }
            };
          });
        },
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
