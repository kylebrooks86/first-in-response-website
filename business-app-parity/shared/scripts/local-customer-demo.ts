/** Local-only, fixed synthetic customer demonstration. Never imported by app routes. */
import { openLocalCustomerVault } from '../lib/local-customer-vault';
import { LocalCustomerBackupError, protectLocalCustomerBackup, recoverLocalCustomerBackup } from '../lib/local-customer-backup';
import { localCustomerDatabaseName, type LocalCustomerExport, type LocalCustomerInput } from '../lib/local-customer-store';

const account = 'synthetic-demo-owner', target = 'synthetic-demo-target';
const input: LocalCustomerInput = { id: 'synthetic-demo-1', name: 'Synthetic Customer', email: 'demo@example.invalid', phone: '', address: 'Synthetic location', leadSource: 'synthetic' };
const allowedNames = new Set(['Synthetic Customer', 'Synthetic Updated', 'Synthetic Recovery']);
function element<T>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('Synthetic screen markup missing.');
  return found as unknown as T;
}
const records = element<HTMLElement>('records'), status = element<HTMLElement>('status');
const phrase = element<HTMLInputElement>('phrase'), savePhrase = element<HTMLInputElement>('save-phrase');
const names = element<HTMLSelectElement>('name'), customer = element<HTMLElement>('customer');
// Registration is confined to the isolated demo directory on localhost.
void (async () => {
  const indicator = element<HTMLElement>('offline-shell');
  try {
    if (!['127.0.0.1', 'localhost'].includes(location.hostname) || location.pathname !== '/synthetic-customer-demo/') throw new Error('Not isolated demo');
    const registration = await navigator.serviceWorker.register('./worker.js', { scope: './', updateViaCache: 'none' });
    if (!registration.active) await new Promise<void>((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) { reject(new Error('No shell worker')); return; }
      const state = () => { if (worker.state === 'activated') resolve(); else if (worker.state === 'redundant') reject(new Error('Shell installation failed')); };
      worker.addEventListener('statechange', state); state();
    });
    indicator.textContent = 'Offline shell ready on this browser. Storage can still be cleared or evicted.';
  } catch {
    indicator.textContent = 'Offline shell unavailable. Keep this demo online until installation succeeds.';
    element<HTMLElement>('recovery-message').textContent = 'Offline installation did not finish. Reconnect and retry loading this demo. Existing encrypted records are not deleted.';
    element<HTMLElement>('recovery').hidden = false;
  }
})();
const vault = await openLocalCustomerVault(account, target);
let session: Awaited<ReturnType<typeof vault.unlock>> | undefined;
let generation = 0, busy = false;
let uncertainOperation: string | undefined;
function clear() {
  generation++; session = undefined; busy = false;
  records.hidden = true; customer.textContent = ''; names.value = 'Synthetic Customer';
  phrase.value = ''; savePhrase.value = '';
  element<HTMLInputElement>('backup-phrase').value = ''; element<HTMLInputElement>('archive-phrase').value = '';
  element<HTMLInputElement>('archive-file').value = ''; element<HTMLInputElement>('restore-empty').checked = false;
  element<HTMLElement>('backup-result').textContent = '';
  element<HTMLElement>('vault-presence').textContent = 'Stored-vault status not checked. Locked does not mean empty.';
  status.textContent = 'Locked — unlock to retrieve synthetic records.';
  element<HTMLButtonElement>('save').disabled = false;
  element<HTMLButtonElement>('unlock').disabled = false;
}
const unsubscribe = vault.onLock(clear);
vault.enableAutoLock();
function render() {
  const row = session!.getCustomer(input.id);
  if (!row) throw new Error('Synthetic fixture missing; preserve vault.');
  customer.textContent = `${row.name} · Revision ${row.revision} · ${row.email}`;
  names.value = row.name; records.hidden = false;
}
function report(error: unknown) {
  // Generic status deliberately excludes customer/phrase values and internal errors.
  status.textContent = error instanceof Error && /snapshot changed/.test(error.message)
    ? 'Another window changed this record. Lock and unlock to review it before saving.'
    : 'Action failed. Unlock and review saved records before retrying; nothing is automatically replayed.';
}
element<HTMLFormElement>('unlock-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  let epoch = generation; const supplied = phrase.value; phrase.value = ''; busy = true;
  element<HTMLButtonElement>('unlock').disabled = true;
  try {
    let unlocked: Awaited<ReturnType<typeof vault.unlock>>;
    try { const pending = vault.unlock(supplied); epoch = generation; unlocked = await pending; }
    catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Vault not initialized')) throw error;
      const row = { ...input, revision: 1, updatedAt: '2026-10-10T00:00:00.000Z' };
      await vault.initialize({ format: 'fire-local-customers', version: 1, namespace: localCustomerDatabaseName(account, target), customers: [row], pendingOperations: [{ id: 'synthetic-demo-initialize', kind: 'customer-upsert', expectedRevision: 0, customer: row, input }] }, supplied);
      unlocked = await vault.unlock(supplied);
    }
    if (epoch !== generation) return;
    session = unlocked;
    const recovered = uncertainOperation && session.exportSnapshot().pendingOperations.some(op => op.id === uncertainOperation);
    uncertainOperation = undefined;
    render(); status.textContent = recovered ? 'Previous save receipt verified. No edit was replayed.' : 'Unlocked synthetic records. Editing works after connectivity is disabled.';
  } catch (error) { if (epoch === generation) report(error); }
  finally { if (epoch === generation) { busy = false; element<HTMLButtonElement>('unlock').disabled = false; } }
});
element<HTMLFormElement>('edit-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !session) return;
  const active = session, epoch = generation, name = names.value, supplied = savePhrase.value;
  savePhrase.value = ''; busy = true; element<HTMLButtonElement>('save').disabled = true;
  try {
    if (!allowedNames.has(name)) throw new Error('Only synthetic presets permitted.');
    const row = active.getCustomer(input.id)!;
    const operationId = `synthetic-demo-${crypto.randomUUID()}`; uncertainOperation = operationId;
    await active.saveCustomer({ ...input, name }, operationId, row.revision, supplied);
    if (epoch !== generation) return;
    uncertainOperation = undefined; render(); status.textContent = 'Encrypted synthetic edit saved on this device.';
  } catch (error) { if (epoch === generation) report(error); }
  finally { if (epoch === generation) { busy = false; element<HTMLButtonElement>('save').disabled = false; } }
});
// Customer-only synthetic archive controls. No production import or automatic replay.
const backupResult = element<HTMLElement>('backup-result');
const archiveFile = element<HTMLInputElement>('archive-file');
const archivePhrase = element<HTMLInputElement>('archive-phrase');
const backupPhrase = element<HTMLInputElement>('backup-phrase');
const namespace = localCustomerDatabaseName(account, target);
function syntheticArchive(archive: LocalCustomerExport) {
  const fixture = (row: LocalCustomerInput) => row.id === input.id && allowedNames.has(row.name)
    && (['email', 'phone', 'address', 'leadSource'] as const).every(key => row[key] === input[key]);
  if (archive.customers.length !== 1 || !fixture(archive.customers[0])
    || archive.pendingOperations.some(op => !op.id.startsWith('synthetic-demo-') || !fixture(op.input) || !fixture(op.customer))) {
    throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Synthetic archive only.');
  }
  return archive;
}
function archiveDiagnostic(error: unknown): string {
  if (error instanceof LocalCustomerBackupError) {
    switch (error.code) {
      case 'INVALID_ARCHIVE': return 'Invalid backup: use a supported synthetic customer JSON file for this demo. No records changed.';
      case 'INVALID_PHRASE': return 'Invalid phrase length: enter the exact backup phrase (16–1024 characters). No records changed.';
      case 'AUTHENTICATION_FAILED': return 'Incorrect backup phrase or altered encrypted file; these cannot be distinguished. No records changed.';
      case 'CRYPTO_UNAVAILABLE': return 'Local cryptography unavailable. Keep the vault and backup intact.';
    }
  }
  return 'File read or local cryptography failed. Keep the vault and backup intact; reselect a locally saved file.';
}
async function readArchive(file: File | undefined, supplied: string) {
  if (!file || !file.size || file.size > 2 * 1024 * 1024) throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Select one bounded synthetic archive.');
  const text = await file.text();
  let envelope: unknown;
  try { envelope = JSON.parse(text); }
  catch { throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Invalid JSON file.'); }
  return syntheticArchive(await recoverLocalCustomerBackup(envelope, namespace, supplied));
}
element<HTMLFormElement>('backup-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !session) return;
  const active = session, epoch = generation, supplied = backupPhrase.value;
  backupPhrase.value = ''; busy = true; backupResult.textContent = '';
  try {
    const snapshot = syntheticArchive(active.exportSnapshot());
    const envelope = await protectLocalCustomerBackup(snapshot, namespace, supplied);
    if (epoch !== generation || active !== session) return;
    active.exportSnapshot(); // Revalidate cross-tab/lifecycle revocation after encryption.
    const serialized = JSON.stringify(envelope);
    if (serialized.length > 2 * 1024 * 1024) throw new Error('Synthetic backup exceeds screen import limit.');
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fire-synthetic-customer-backup.json';
    records.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    backupResult.textContent = 'Encrypted download requested. Select the saved file below to verify it; download alone is not recovery.';
  } catch { if (epoch === generation) backupResult.textContent = 'Backup export failed. No records changed.'; }
  finally { if (epoch === generation) busy = false; }
});
element<HTMLButtonElement>('check-vault').addEventListener('click', async () => {
  if (busy) return;
  const epoch = generation; busy = true;
  const indicator = element<HTMLElement>('vault-presence');
  try {
    const exists = await vault.hasStoredSnapshot();
    if (epoch !== generation) return;
    indicator.textContent = exists
      ? 'Stored vault exists on this device. Recovery is blocked; no records changed. Keep this vault.'
      : 'No stored vault snapshot found on this device. Recover before Unlock; no records changed.';
  } catch { if (epoch === generation) indicator.textContent = 'Stored-vault status unavailable. Do not clear data or assume this vault is empty.'; }
  finally { if (epoch === generation) busy = false; }
});
element<HTMLFormElement>('archive-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const epoch = generation, supplied = archivePhrase.value, file = archiveFile.files?.length === 1 ? archiveFile.files[0] : undefined;
  const restoring = (event as SubmitEvent).submitter?.id === 'restore-backup';
  const confirmed = element<HTMLInputElement>('restore-empty').checked;
  archivePhrase.value = ''; busy = true; backupResult.textContent = '';
  let phase: 'confirmation' | 'status' | 'archive' | 'commit' = 'confirmation';
  try {
    if (restoring && !confirmed) throw new Error('Explicit empty-vault confirmation required.');
    if (restoring) {
      phase = 'status';
      const exists = await vault.hasStoredSnapshot();
      if (epoch !== generation) return;
      if (exists) {
        backupResult.textContent = 'Recovery blocked: vault already exists on this device. Existing records preserved; do not clear data.';
        return;
      }
    }
    phase = 'archive';
    const archive = await readArchive(file, supplied);
    if (epoch !== generation) return;
    if (restoring) {
      // initialize uses an atomic add, never put: existing vaults cannot be overwritten.
      phase = 'commit';
      await vault.initialize(archive, supplied);
      if (epoch !== generation) return;
      archiveFile.value = ''; element<HTMLInputElement>('restore-empty').checked = false;
      backupResult.textContent = 'Recovered into an empty synthetic vault. Unlock above to inspect saved records. Nothing was replayed.';
    } else {
      backupResult.textContent = `Backup verified: synthetic customer revision ${archive.customers[0].revision}; ${archive.pendingOperations.length} operation receipts. No records changed.`;
    }
  } catch (error) { if (epoch === generation) backupResult.textContent = restoring
    ? ({
      confirmation: 'Recovery failed: check the empty-vault confirmation. No records changed.',
      status: 'Recovery failed: stored-vault status unavailable. Do not clear data or assume this vault is empty.',
      archive: 'Recovery failed: backup verification failed. ' + archiveDiagnostic(error),
      commit: 'Recovery failed: file verified, but storage commit did not complete. Check stored-vault status before retrying; existing records preserved.'
    }[phase])
    : 'Backup verification failed. ' + archiveDiagnostic(error); }
  finally { if (epoch === generation) busy = false; }
});
element<HTMLButtonElement>('lock').addEventListener('click', () => { try { vault.lock(); } catch { clear(); status.textContent = 'Lock coordination failed. Close other demo windows.'; } });
window.addEventListener('pagehide', () => { clear(); });
window.addEventListener('beforeunload', () => { clear(); unsubscribe(); vault.close(); }, { once: true });
