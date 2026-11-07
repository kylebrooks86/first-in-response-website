/** Standalone synthetic screen only. No Business App route imports. */
import { openLocalCustomerVault } from '../lib/local-customer-vault';
import { createSyntheticCustomerController } from '../lib/synthetic-customer-controller';

const accountId = 'synthetic-screen-preview', targetId = 'synthetic-screen-only-v1';
const root = document.querySelector<HTMLElement>('#customers')!;
const form = document.querySelector<HTMLFormElement>('#fixture')!;
const phrase = document.querySelector<HTMLInputElement>('#fixture-phrase')!;
const status = document.querySelector<HTMLElement>('#setup-status')!;
const submit = form.querySelector<HTMLButtonElement>('button')!;
const theme = document.querySelector<HTMLButtonElement>('#theme')!;
const controller = createSyntheticCustomerController(root, { targetId, readIdentity: () => ({ accountId, targetId }) });
let busy = false;
theme.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.textContent = dark ? 'Switch to light mode' : 'Switch to dark mode';
});
async function inspect() {
  let vault: Awaited<ReturnType<typeof openLocalCustomerVault>> | undefined;
  try {
    vault = await openLocalCustomerVault(accountId, targetId);
    const occupied = await vault.hasStoredSnapshot();
    form.hidden = occupied;
    status.textContent = occupied ? 'A test vault exists in this preview. Unlock it below; creation will not replace it.'
      : 'No stored snapshot in this preview namespace. Create a test vault explicitly to try contact editing.';
  } catch { status.textContent = 'Preview storage unavailable. Preserve existing vaults and backups.'; form.hidden = true; }
  finally { vault?.close(); }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); const supplied = phrase.value; phrase.value = '';
  if (busy || form.hidden) return;
  busy = true; submit.disabled = true;
  let vault: Awaited<ReturnType<typeof openLocalCustomerVault>> | undefined;
  try {
    vault = await openLocalCustomerVault(accountId, targetId);
    // Atomic initialization rejects occupied snapshots even if advisory status was stale.
    await vault.initialize({ format: 'fire-local-customers', version: 1,
      namespace: `fire-local-customers:v1:${accountId}:${targetId}`, customers: [], pendingOperations: [] }, supplied);
    status.textContent = 'Empty synthetic test vault created. Enter the same test phrase below to unlock.';
    form.hidden = true; await controller.activate();
  } catch { status.textContent = 'Test vault creation did not complete or a vault already exists. Nothing was overwritten.'; }
  finally { vault?.close(); busy = false; submit.disabled = false; }
});
await inspect(); await controller.activate();
