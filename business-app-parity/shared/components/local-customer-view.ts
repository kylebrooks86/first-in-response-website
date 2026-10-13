/** Isolated synthetic Customers UI; opt-in DOM mount, mounted only by explicitly gated development routes. */
import type { createLocalCustomerRepository } from '../lib/local-customer-repository';
import type { LocalCustomerInput } from '../lib/local-customer-store';
type Repository = ReturnType<typeof createLocalCustomerRepository>;
type Draft = { input: LocalCustomerInput; expectedRevision: number; attempt?: { operationId: string; input: LocalCustomerInput } };

export function mountSyntheticCustomerView(root: HTMLElement, repository: Repository) {
  let draft: Draft | undefined, disposed = false, generation = 0, renderGeneration = 0, message = '', inspecting = false;
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
      generation++; draft = undefined; message = ''; inspection = undefined; inspecting = false;
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
    const inspectionForm = element('form'); inspectionForm.setAttribute('aria-label', 'Stored receipt inspection');
    const inspectionPhrase = phraseField(inspectionForm, 'Test phrase for stored inspection');
    const inspect = element('button', 'Inspect stored local receipts'); inspect.type = 'submit';
    inspect.disabled = inspecting || state.saveState === 'saving'; inspectionPhrase.disabled = inspect.disabled;
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
      const receipts = element('ul'); receipts.setAttribute('aria-label', 'Stored operation receipts');
      if (inspection.operations.length > 50) append(report, element('p', 'Showing the last 50 retained receipts.'));
      for (const op of inspection.operations.slice(-50)) append(receipts, element('li', `${op.id} · ${op.customer.name} · revision ${op.customer.revision} · ${op.customer.updatedAt}`));
      append(report, receipts); append(root, report);
    }
    inspectionForm.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = inspectionPhrase.value; inspectionPhrase.value = '';
      if (disposed || rendered !== renderGeneration || inspecting || state.saveState === 'saving') return;
      const epoch = generation; inspecting = true; inspection = undefined; message = ''; render();
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
          address: customer.address, leadSource: customer.leadSource }, expectedRevision: customer.revision }; message = ''; inspection = undefined; render();
      }); edit.disabled = inspecting || state.saveState === 'saving' || state.saveState === 'needs-inspection'; append(row, edit); append(list, row);
    }
    append(root, list);
    if (state.customers.length === 0) append(root, element('p', 'No local contacts in this unlocked vault.'));
    const add = button('Add synthetic customer', () => {
      draft = { input: { id: crypto.randomUUID(), name: 'Synthetic Customer', email: 'test@example.invalid', phone: '', address: 'Synthetic address', leadSource: 'Synthetic' }, expectedRevision: 0 };
      message = ''; inspection = undefined; render();
    }); add.disabled = inspecting || state.saveState === 'saving' || state.saveState === 'needs-inspection'; append(root, add);
    if (!draft) return;
    const capturedDraft = draft, form = element('form'); form.setAttribute('aria-label', 'Local customer editor');
    for (const [key, title] of [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['leadSource', 'Lead source']] as const) {
      const label = element('label', title), field = element('input'); field.name = key; field.value = capturedDraft.input[key];
      field.maxLength = 4096; field.required = key === 'name'; field.disabled = inspecting || state.saveState === 'saving';
      field.addEventListener('input', () => { capturedDraft.input[key] = field.value; }); append(label, field); append(form, label);
    }
    const phrase = phraseField(form, 'Test phrase for this local save'); phrase.disabled = inspecting || state.saveState === 'saving';
    const save = element('button', 'Save locally'); save.type = 'submit'; save.disabled = inspecting || state.saveState === 'saving' || state.saveState === 'needs-inspection'; append(form, save);
    const cancel = button('Cancel edit', () => { draft = undefined; message = ''; inspection = undefined; render(); });
    cancel.disabled = inspecting || state.saveState === 'saving'; append(form, cancel); append(root, form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = phrase.value; phrase.value = '';
      if (disposed || rendered !== renderGeneration || inspecting || state.saveState === 'saving' || state.saveState === 'needs-inspection') return;
      const input = structuredClone(capturedDraft.input), epoch = generation;
      if (!input.name.startsWith('Synthetic ') || (input.email && !/^[^@\s]+@example\.invalid$/.test(input.email))
        || input.phone !== '' || !input.address.startsWith('Synthetic') || input.leadSource !== 'Synthetic') {
        message = 'Synthetic data only: use a Synthetic name/address, example.invalid email, blank phone and Synthetic lead source.'; render(); return;
      }
      message = ''; inspection = undefined;
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
      repository.dispose(); disposed = true; generation++; draft = undefined; message = ''; inspection = undefined; inspecting = false;
      unsubscribe(); wipeInputs(); root.replaceChildren(); delete root.dataset.localCustomerState;
    },
  };
}
