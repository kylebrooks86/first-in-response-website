/** Isolated synthetic Customers UI; opt-in DOM mount, mounted only by explicitly gated development routes. */
import type { createLocalCustomerRepository } from '../lib/local-customer-repository';
import { LocalCustomerBackupError } from '../lib/local-customer-backup';
import type { LocalCustomer, LocalCustomerInput } from '../lib/local-customer-store';
type Repository = ReturnType<typeof createLocalCustomerRepository>;
type ContactField = 'name' | 'email' | 'phone' | 'address' | 'leadSource';
type Comparison = { choices: Partial<Record<ContactField, 'stored' | 'draft'>>; verification: 'unchecked' | 'checking' | 'unchanged' | 'changed' | 'failed'; stored: LocalCustomer | null; draft: LocalCustomerInput; attempted?: LocalCustomerInput; expectedRevision: number };
type Draft = { input: LocalCustomerInput; expectedRevision: number; attempt?: { operationId: string; input: LocalCustomerInput } };

export function mountSyntheticCustomerView(root: HTMLElement, repository: Repository) {
  let draft: Draft | undefined, disposed = false, generation = 0, renderGeneration = 0, message = '', inspecting = false;
  let backupBusy = false, backupMessage = '';
  let comparison: Comparison | undefined;
  let inspection: Awaited<ReturnType<Repository['inspectStored']>> | undefined;
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
    const node = document.createElement(tag); node.textContent = text; return node;
  }
  // appendChild avoids the Cloudflare HTMLRewriter Element.append global overload.
  function append(parent: Node, ...children: Node[]) { children.forEach(child => parent.appendChild(child)); }
  function wipeInputs() { root.querySelectorAll('input').forEach(input => { input.value = ''; }); }
  function button(text: string, run: () => void) {
    const node = element('button', text); node.type = 'button'; node.addEventListener('click', run); return node;
  }
  function phraseField(form: HTMLFormElement, labelText: string) {
    const label = element('label', labelText), input = element('input'); input.type = 'password';
    input.name = 'phrase'; input.autocomplete = 'off'; input.minLength = 16; input.maxLength = 1024; input.required = true;
    append(label, input); append(form, label); return input;
  }
  function render(state = repository.read()) {
    if (disposed) return;
    const rendered = ++renderGeneration;
    if (['locked', 'unavailable', 'closed'].includes(state.status)) {
      generation++; backupBusy = false; backupMessage = ''; draft = undefined; message = ''; inspection = undefined; comparison = undefined; inspecting = false;
    }
    wipeInputs(); root.replaceChildren(); root.dataset.localCustomerState = state.status;
    const header = element('header'); header.className = 'customers-head';
    append(header, element('p', 'Customer records'), element('h1', 'Customers'));
    append(header, element('p', 'Isolated synthetic preview. Contact records only; no server sync or financial actions.'));
    append(root, header);
    const status = element('p'); status.setAttribute('role', 'status'); status.dataset.saveStatus = '';
    const history = element('p', 'Estimates, invoices, payments, notes and photos require a connection and a separately verified integration.');
    history.dataset.jobHistory = 'connection-required'; append(root, status, history);
    if (state.status !== 'ready') {
      status.textContent = state.status === 'unlocking' ? 'Unlocking local contacts…' : state.status === 'locked'
        ? 'Locked. Stored contacts are hidden; locked does not mean empty.' : 'Local contacts unavailable. Preserve your vault and backup.';
      if (state.status === 'closed') return;
      const form = element('form'), phrase = phraseField(form, 'Test recovery phrase');
      const submit = element('button', 'Unlock local contacts'); submit.type = 'submit'; submit.disabled = state.status === 'unlocking';
      phrase.disabled = submit.disabled; append(form, submit); append(root, form);
      form.addEventListener('submit', async event => {
        event.preventDefault(); const supplied = phrase.value; phrase.value = '';
        if (disposed || rendered !== renderGeneration || state.status === 'unlocking') return;
        try { await repository.unlock(supplied); }
        catch { if (!disposed) { render(); const s = root.querySelector<HTMLElement>('[data-save-status]'); if (s) s.textContent = 'Unlock did not complete. Check your phrase; no new vault was created.'; } }
      });
      return;
    }
    status.textContent = message || (state.saveState === 'saving' ? 'Saving encrypted contacts…'
      : state.saveState === 'saved-locally' ? 'Saved locally. Not sent to a server.'
      : state.saveState === 'needs-inspection' ? 'Save outcome uncertain. Inspect stored local receipts; retry remains blocked.' : 'Local contacts unlocked.');
    const pending = element('p', `${state.pendingOperationCount} local operation receipts retained; none acknowledged by a server.`);
    append(root, pending, button('Lock local contacts', () => { repository.lock(); }));
    const backup = element('section'); backup.setAttribute('aria-label', 'Portable encrypted customer backup');
    append(backup, element('h2', 'Encrypted customer backup'), element('p', 'Includes saved contacts, revisions, receipts and stored resolution draft archives. A current unsaved edit is not yet archived and is not included. Export and verification never save or discard it. Keep the original backup.'));
    const backupStatus = element('p', backupBusy ? 'Processing encrypted backup…' : backupMessage || 'Verify a downloaded portable bundle without changing records. Recovery controls remain disabled.');
    backupStatus.setAttribute('role', 'status'); backupStatus.dataset.backupStatus = ''; append(backup, backupStatus);
    const exportForm = element('form'); exportForm.setAttribute('aria-label', 'Export portable backup');
    const exportPhrase = phraseField(exportForm, 'Test phrase for portable backup');
    const exportButton = element('button', 'Download encrypted customer bundle'); exportButton.type = 'submit';
    const blocked = backupBusy || inspecting || state.saveState === 'saving';
    exportPhrase.disabled = exportButton.disabled = blocked; append(exportForm, exportButton); append(backup, exportForm);
    const verifyForm = element('form'); verifyForm.setAttribute('aria-label', 'Verify portable backup');
    const fileLabel = element('label', 'Portable encrypted JSON file'), file = element('input');
    file.type = 'file'; file.accept = '.json,application/json'; file.required = true; file.disabled = blocked;
    append(fileLabel, file); append(verifyForm, fileLabel);
    const verifyPhrase = phraseField(verifyForm, 'Test phrase for portable file verification');
    const verifyButton = element('button', 'Verify portable bundle without changes'); verifyButton.type = 'submit';
    verifyPhrase.disabled = verifyButton.disabled = blocked; append(verifyForm, verifyButton); append(backup, verifyForm); append(root, backup);
    function backupFailure(error: unknown) {
      return error instanceof LocalCustomerBackupError && error.code === 'AUTHENTICATION_FAILED'
        ? 'Verification failed: incorrect phrase or altered encrypted file. No records changed.'
        : error instanceof LocalCustomerBackupError && error.code === 'INVALID_ARCHIVE'
        ? 'Invalid portable bundle or incorrect account/app target. Original backup and records are preserved.'
        : 'Backup operation did not complete. Check the phrase, file and storage. No save or recovery was attempted.';
    }
    exportForm.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = exportPhrase.value; exportPhrase.value = '';
      if (disposed || rendered !== renderGeneration || blocked || repository.read().status !== 'ready') return;
      const epoch = generation; backupBusy = true; backupMessage = ''; render();
      try {
        const envelope = await repository.exportPortableBackup(supplied);
        if (disposed || epoch !== generation || repository.read().status !== 'ready') return;
        const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = element('a'); link.href = url;
        link.download = `fire-customer-bundle-${crypto.randomUUID()}.json`;
        document.body.appendChild(link);
        try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        backupMessage = 'Encrypted download prepared. Confirm the file was saved, then select it below to verify. Current unsaved edits are not included. No records changed.';
      } catch (error) { if (!disposed && epoch === generation) backupMessage = backupFailure(error); }
      finally { if (!disposed && epoch === generation) { backupBusy = false; render(); } }
    });
    verifyForm.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = verifyPhrase.value, selectedFile = file.files?.[0]; verifyPhrase.value = ''; file.value = '';
      if (disposed || rendered !== renderGeneration || blocked || !selectedFile || repository.read().status !== 'ready') return;
      const epoch = generation; backupBusy = true; backupMessage = ''; render();
      try {
        // The 16 MiB protected plaintext becomes hex ciphertext plus a small JSON header.
        if (selectedFile.size > 34 * 1024 * 1024) throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'File exceeds bundle limit.');
        let envelope: unknown;
        try { envelope = JSON.parse(await selectedFile.text()); } catch { throw new LocalCustomerBackupError('INVALID_ARCHIVE', 'Invalid JSON file.'); }
        if (disposed || epoch !== generation || repository.read().status !== 'ready') return;
        const result = await repository.verifyPortableBackup(envelope, supplied);
        if (disposed || epoch !== generation || repository.read().status !== 'ready') return;
        backupMessage = `Verified portable bundle: ${result.customerCount} customers, ${result.receiptCount} receipts and ${result.resolutionArchiveCount} resolution draft archives. Verification only; no restoration or record changes.`;
      } catch (error) { if (!disposed && epoch === generation) backupMessage = backupFailure(error); }
      finally { if (!disposed && epoch === generation) { backupBusy = false; render(); } }
    });
    const inspectionForm = element('form'); inspectionForm.setAttribute('aria-label', 'Stored receipt inspection');
    const inspectionPhrase = phraseField(inspectionForm, 'Test phrase for stored inspection');
    const inspect = element('button', 'Inspect stored local receipts'); inspect.type = 'submit';
    inspect.disabled = inspecting || backupBusy || state.saveState === 'saving'; inspectionPhrase.disabled = inspect.disabled;
    append(inspectionForm, inspect); append(root, inspectionForm);
    const inspectionStatus = element('p', inspecting ? 'Reading encrypted storage…' : 'Inspection is a point-in-time read. It never retries a save or acknowledges server sync.');
    inspectionStatus.setAttribute('role', 'status'); inspectionStatus.dataset.inspectionStatus = ''; append(root, inspectionStatus);
    if (inspection) {
      const report = element('section'); report.setAttribute('aria-label', 'Stored local receipt report');
      append(report, element('h2', 'Stored local receipts'), element('p', `${inspection.operations.length} stored receipts. No server acknowledgement. This read does not refresh the editing session.`));
      const attempted = draft?.attempt;
      if (attempted) {
        const receipt = inspection.operations.find(op => op.id === attempted.operationId);
        const latest = inspection.customers.find(row => row.id === attempted.input.id);
        const exact = receipt && receipt.expectedRevision === draft!.expectedRevision && (['id', 'name', 'email', 'phone', 'address', 'leadSource'] as const).every(key => receipt.input[key] === attempted.input[key]);
        const result = exact ? `Attempted save receipt is stored at revision ${receipt.customer.revision}. Latest stored revision: ${latest?.revision ?? 'absent'}.`
          : receipt ? 'Operation receipt differs from this attempted change. Preserve the draft; do not retry.'
          : latest && latest.revision !== draft!.expectedRevision ? `No receipt for this attempt. Stored revision changed to ${latest.revision}; preserve the draft and review the conflict.`
          : 'No receipt for this attempt in the inspected snapshot. Draft retained; retry remains blocked.';
        append(report, element('p', result));
      }
      if (draft) append(report, button('Review stored record against draft', () => {
        if (disposed || rendered !== renderGeneration || inspecting || backupBusy || repository.read().status !== 'ready') return;
        const stored = inspection!.customers.find(row => row.id === draft!.input.id) ?? null;
        comparison = { choices: {}, verification: 'unchecked', stored: structuredClone(stored), draft: structuredClone(draft!.input),
          attempted: draft!.attempt ? structuredClone(draft!.attempt.input) : undefined, expectedRevision: draft!.expectedRevision };
        render();
      }));
      const notice = element('p', 'Review is read-only. Storage may change after inspection; inspect again for a newer snapshot.');
      notice.dataset.comparisonNotice = ''; append(report, notice);
      const receipts = element('ul'); receipts.setAttribute('aria-label', 'Stored operation receipts');
      if (inspection.operations.length > 50) append(report, element('p', 'Showing the last 50 retained receipts.'));
      for (const op of inspection.operations.slice(-50)) append(receipts, element('li', `${op.id} · ${op.customer.name} · revision ${op.customer.revision} · ${op.customer.updatedAt}`));
      append(report, receipts); append(root, report);
    }
    if (comparison && inspection && draft) {
      const review = element('section'); review.className = 'customer-comparison'; review.setAttribute('aria-label', 'Stored customer and draft comparison');
      append(review, element('h2', 'Stored customer and retained draft'), element('p', `Draft expects revision ${comparison.expectedRevision}. ${comparison.stored ? `Inspected stored revision ${comparison.stored.revision}.` : 'No stored record in this inspected snapshot.'}`),
        element('p', 'No values are applied. Review does not merge, discard, overwrite or retry. A matching value is not server acknowledgement.'));
      let differences = 0;
      for (const [key, title] of [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['leadSource', 'Lead source']] as const) {
        const row = element('section'); row.dataset.comparisonField = key;
        const matches = comparison.stored !== null && comparison.stored[key] === comparison.draft[key];
        if (!matches) differences++;
        append(row, element('h3', title), element('p', comparison.stored === null ? 'No stored value to compare' : matches ? 'Current draft matches stored value' : 'Current draft differs from stored value'));
        const values = element('dl');
        for (const [label, value] of [['Stored at inspection', comparison.stored?.[key] ?? null], ['Attempted save', comparison.attempted?.[key] ?? null], ['Current retained draft', comparison.draft[key]]] as const) {
          const pair = element('div'); append(pair, element('dt', label), element('dd', value === null ? label === 'Attempted save' ? 'No save attempt' : 'No stored record' : value === '' ? '(blank)' : value)); append(values, pair);
        }
        append(row, values);
        for (const source of ['stored', 'draft'] as const) {
          const choice = button(`Use ${source === 'stored' ? 'stored' : 'draft'} ${title}`, () => {
            if (disposed || rendered !== renderGeneration || inspecting || backupBusy || repository.read().status !== 'ready' || !comparison || (source === 'stored' && comparison.stored === null)) return;
            comparison.choices[key] = source; comparison.verification = 'unchecked'; render();
          });
          choice.disabled = inspecting || backupBusy || (source === 'stored' && comparison.stored === null);
          choice.setAttribute('aria-pressed', String(comparison.choices[key] === source)); append(row, choice);
        }
        append(review, row);
      }
      const summary = element('p', comparison.stored === null ? 'Stored record absent at inspection. All draft values remain retained.' : `${differences} of 5 current draft fields differ from the inspected stored record.`);
      const keys: ContactField[] = ['name', 'email', 'phone', 'address', 'leadSource'];
      const selected = keys.filter(key => comparison!.choices[key]).length;
      append(review, element('p', `${selected} of 5 field sources selected. Choices only build a separate proposal; the original draft remains unchanged.`));
      if (selected === 5) {
        const proposal = element('section'); proposal.setAttribute('aria-label', 'Proposed customer resolution');
        append(proposal, element('h3', 'Proposed resolution · not saved'));
        const proposed = element('dl');
        for (const key of keys) {
          const value = comparison.choices[key] === 'stored' ? comparison.stored![key] : comparison.draft[key];
          const title = ({ name: 'Name', email: 'Email', phone: 'Phone', address: 'Address', leadSource: 'Lead source' } as const)[key];
          const pair = element('div'); pair.dataset.proposedField = key; append(pair, element('dt', title), element('dd', value === '' ? '(blank)' : value)); append(proposed, pair);
        }
        append(proposal, proposed); append(review, proposal);
      }
      const verifyForm = element('form'); verifyForm.setAttribute('aria-label', 'Resolution freshness check');
      const verifyPhrase = phraseField(verifyForm, 'Test phrase for resolution recheck');
      const verify = element('button', 'Recheck stored snapshot for proposal'); verify.type = 'submit'; verify.disabled = inspecting || backupBusy || selected !== 5; verifyPhrase.disabled = verify.disabled;
      append(verifyForm, verify); append(review, verifyForm);
      const verified = element('p', comparison.verification === 'checking' ? 'Rechecking encrypted storage…'
        : comparison.verification === 'unchanged' ? 'Stored snapshot matches the reviewed inspection at this recheck. Proposal remains unsaved. This is a point-in-time check, not a save.'
        : comparison.verification === 'changed' ? 'Stored snapshot changed since inspection. Inspect again and review before proceeding. Original draft and proposal are retained; nothing was saved.'
        : comparison.verification === 'failed' ? 'Recheck did not complete. Check phrase and storage. Original draft and proposal are retained; nothing was saved.'
        : 'Proposal has not been rechecked. Storage can change after any check; any future save must verify it has not changed.');
      verified.setAttribute('role', 'status'); verified.dataset.resolutionStatus = ''; append(review, verified);
      verifyForm.addEventListener('submit', async event => {
        event.preventDefault(); const supplied = verifyPhrase.value; verifyPhrase.value = '';
        if (disposed || rendered !== renderGeneration || inspecting || backupBusy || selected !== 5 || !comparison || !inspection) return;
        const epoch = generation, captured = comparison, baseline = JSON.stringify(inspection);
        inspecting = true; captured.verification = 'checking'; render();
        try {
          const stored = await repository.inspectStored(supplied);
          if (disposed || epoch !== generation || comparison !== captured) return;
          captured.verification = JSON.stringify(stored) === baseline ? 'unchanged' : 'changed';
        } catch {
          if (disposed || epoch !== generation || comparison !== captured) return;
          captured.verification = 'failed';
        } finally { if (!disposed && epoch === generation) { inspecting = false; render(); } }
      });
      summary.setAttribute('role', 'status'); summary.dataset.comparisonSummary = ''; append(review, summary); append(root, review);
    }
    inspectionForm.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = inspectionPhrase.value; inspectionPhrase.value = '';
      if (disposed || rendered !== renderGeneration || inspecting || backupBusy || state.saveState === 'saving') return;
      const epoch = generation; inspecting = true; inspection = undefined; comparison = undefined; message = ''; render();
      try {
        const stored = await repository.inspectStored(supplied);
        if (disposed || epoch !== generation) return;
        inspection = stored;
      } catch {
        if (disposed || epoch !== generation) return;
        message = 'Stored inspection did not complete. Check the phrase and storage; draft retained and no save retried.';
      } finally { if (!disposed && epoch === generation) { inspecting = false; render(); } }
    });
    const list = element('ul'); list.setAttribute('aria-label', 'Local customers');
    for (const customer of state.customers) {
      const row = element('li'); row.dataset.customerId = customer.id;
      append(row, element('strong', customer.name), element('p', `${customer.email} · ${customer.address}`), element('p', `Revision ${customer.revision}`));
      const edit = button(`Edit ${customer.name}`, () => {
        draft = { input: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone,
          address: customer.address, leadSource: customer.leadSource }, expectedRevision: customer.revision }; message = ''; inspection = undefined; comparison = undefined; render();
      }); edit.disabled = inspecting || backupBusy || state.saveState === 'saving' || state.saveState === 'needs-inspection'; append(row, edit); append(list, row);
    }
    append(root, list);
    if (state.customers.length === 0) append(root, element('p', 'No local contacts in this unlocked vault.'));
    const add = button('Add synthetic customer', () => {
      draft = { input: { id: crypto.randomUUID(), name: 'Synthetic Customer', email: 'test@example.invalid', phone: '', address: 'Synthetic address', leadSource: 'Synthetic' }, expectedRevision: 0 };
      message = ''; inspection = undefined; comparison = undefined; render();
    }); add.disabled = inspecting || backupBusy || state.saveState === 'saving' || state.saveState === 'needs-inspection'; append(root, add);
    if (!draft) return;
    const capturedDraft = draft, form = element('form'); form.setAttribute('aria-label', 'Local customer editor');
    for (const [key, title] of [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['leadSource', 'Lead source']] as const) {
      const label = element('label', title), field = element('input'); field.name = key; field.value = capturedDraft.input[key];
      field.maxLength = 4096; field.required = key === 'name'; field.disabled = inspecting || backupBusy || state.saveState === 'saving';
      field.addEventListener('input', () => { capturedDraft.input[key] = field.value; if (comparison) { comparison = undefined; root.querySelector('[aria-label="Stored customer and draft comparison"]')?.remove(); const notice = root.querySelector<HTMLElement>('[data-comparison-notice]'); if (notice) notice.textContent = 'Draft changed. Review again to compare the current values; nothing was saved.'; } }); append(label, field); append(form, label);
    }
    const phrase = phraseField(form, 'Test phrase for this local save'); phrase.disabled = inspecting || backupBusy || state.saveState === 'saving';
    const save = element('button', 'Save locally'); save.type = 'submit'; save.disabled = inspecting || backupBusy || state.saveState === 'saving' || state.saveState === 'needs-inspection'; append(form, save);
    const cancel = button('Cancel edit', () => { draft = undefined; message = ''; inspection = undefined; comparison = undefined; render(); });
    cancel.disabled = inspecting || backupBusy || state.saveState === 'saving'; append(form, cancel); append(root, form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = phrase.value; phrase.value = '';
      if (disposed || rendered !== renderGeneration || inspecting || backupBusy || state.saveState === 'saving' || state.saveState === 'needs-inspection') return;
      const input = structuredClone(capturedDraft.input), epoch = generation;
      if (!input.name.startsWith('Synthetic ') || (input.email && !/^[^@\s]+@example\.invalid$/.test(input.email))
        || input.phone !== '' || !input.address.startsWith('Synthetic') || input.leadSource !== 'Synthetic') {
        message = 'Synthetic data only: use a Synthetic name/address, example.invalid email, blank phone and Synthetic lead source.'; render(); return;
      }
      message = ''; inspection = undefined; comparison = undefined;
      capturedDraft.attempt = { operationId: crypto.randomUUID(), input };
      try {
        await repository.save(input, capturedDraft.attempt.operationId, capturedDraft.expectedRevision, supplied);
        if (disposed || epoch !== generation) return;
        draft = undefined; message = 'Saved locally. Not sent to a server.'; render();
      } catch {
        if (disposed || epoch !== generation) return;
        message = 'Save did not complete normally. It may already be stored. Keep your draft and inspect stored receipts; no automatic retry was made.'; render();
      }
    });
  }
  const unsubscribe = repository.subscribe(state => render(state)); render();
  return {
    refresh: () => render(),
    dispose() {
      if (disposed) return;
      repository.dispose(); disposed = true; generation++; backupBusy = false; backupMessage = ''; draft = undefined; message = ''; inspection = undefined; comparison = undefined; inspecting = false;
      unsubscribe(); wipeInputs(); root.replaceChildren(); delete root.dataset.localCustomerState;
    },
  };
}
