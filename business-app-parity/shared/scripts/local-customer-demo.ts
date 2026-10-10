/** Local-only, fixed synthetic customer demonstration. Never imported by app routes. */
import { openLocalCustomerVault } from '../lib/local-customer-vault';
import { localCustomerDatabaseName, type LocalCustomerInput } from '../lib/local-customer-store';

const account = 'synthetic-demo-owner', target = 'synthetic-demo-target';
const fixedPhrase = 'synthetic demo recovery phrase only';
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
const vault = await openLocalCustomerVault(account, target);
let session: Awaited<ReturnType<typeof vault.unlock>> | undefined;
let generation = 0, busy = false;
let uncertainOperation: string | undefined;
function clear() {
  generation++; session = undefined; busy = false;
  records.hidden = true; customer.textContent = ''; names.value = 'Synthetic Customer';
  phrase.value = ''; savePhrase.value = ''; status.textContent = 'Locked — unlock to retrieve synthetic records.';
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
    if (supplied !== fixedPhrase) throw new Error('Synthetic phrase mismatch.');
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
element<HTMLButtonElement>('lock').addEventListener('click', () => { try { vault.lock(); } catch { clear(); status.textContent = 'Lock coordination failed. Close other demo windows.'; } });
window.addEventListener('pagehide', () => { clear(); });
window.addEventListener('beforeunload', () => { clear(); unsubscribe(); vault.close(); }, { once: true });
