/** Isolated synthetic Customers UI; opt-in DOM mount, never imported by app routes. */
import type { createLocalCustomerRepository } from '../lib/local-customer-repository';
import type { LocalCustomerInput } from '../lib/local-customer-store';
type Repository = ReturnType<typeof createLocalCustomerRepository>;
type Draft = { input: LocalCustomerInput; expectedRevision: number };

export function mountSyntheticCustomerView(root: HTMLElement, repository: Repository) {
  let draft: Draft | undefined, disposed = false, generation = 0, renderGeneration = 0, message = '';
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
    const node = document.createElement(tag); node.textContent = text; return node;
  }
  function wipeInputs() { root.querySelectorAll('input').forEach(input => { input.value = ''; }); }
  function button(text: string, run: () => void) {
    const node = element('button', text); node.type = 'button'; node.addEventListener('click', run); return node;
  }
  function phraseField(form: HTMLFormElement, labelText: string) {
    const label = element('label', labelText), input = element('input'); input.type = 'password';
    input.name = 'phrase'; input.autocomplete = 'off'; input.minLength = 16; input.maxLength = 1024; input.required = true;
    label.append(input); form.append(label); return input;
  }
  function render(state = repository.read()) {
    if (disposed) return;
    const rendered = ++renderGeneration;
    if (['locked', 'unavailable', 'closed'].includes(state.status)) {
      generation++; draft = undefined; message = '';
    }
    wipeInputs(); root.replaceChildren(); root.dataset.localCustomerState = state.status;
    const header = element('header'); header.className = 'customers-head';
    header.append(element('p', 'Customer records'), element('h1', 'Customers'));
    header.append(element('p', 'Isolated synthetic preview. Contact records only; no server sync or financial actions.'));
    root.append(header);
    const status = element('p'); status.setAttribute('role', 'status'); status.dataset.saveStatus = '';
    const history = element('p', 'Estimates, invoices, payments, notes and photos require a connection and a separately verified integration.');
    history.dataset.jobHistory = 'connection-required'; root.append(status, history);
    if (state.status !== 'ready') {
      status.textContent = state.status === 'unlocking' ? 'Unlocking local contacts…' : state.status === 'locked'
        ? 'Locked. Stored contacts are hidden; locked does not mean empty.' : 'Local contacts unavailable. Preserve your vault and backup.';
      if (state.status === 'closed') return;
      const form = element('form'), phrase = phraseField(form, 'Test recovery phrase');
      const submit = element('button', 'Unlock local contacts'); submit.type = 'submit'; submit.disabled = state.status === 'unlocking';
      phrase.disabled = submit.disabled; form.append(submit); root.append(form);
      form.addEventListener('submit', async event => {
        event.preventDefault(); const supplied = phrase.value; phrase.value = '';
        if (disposed || rendered !== renderGeneration || state.status === 'unlocking') return;
        try { await repository.unlock(supplied); }
        catch { if (!disposed) { render(); const s = root.querySelector<HTMLElement>('[data-save-status]'); if (s) s.textContent = 'Unlock did not complete. Check your phrase; no new vault was created.'; } }
      });
      return;
    }
    status.textContent = message || (state.saveState === 'saving' ? 'Saving encrypted contacts…'
      : state.saveState === 'saved-locally' ? 'Saved locally. Server sync pending.'
      : state.saveState === 'needs-inspection' ? 'Save did not complete. Inspect current records before retrying.' : 'Local contacts unlocked.');
    const pending = element('p', `${state.pendingOperationCount} local operation receipts retained; none acknowledged by a server.`);
    root.append(pending, button('Lock local contacts', () => { repository.lock(); }));
    const list = element('ul'); list.setAttribute('aria-label', 'Local customers');
    for (const customer of state.customers) {
      const row = element('li'); row.dataset.customerId = customer.id;
      row.append(element('strong', customer.name), element('p', `${customer.email} · ${customer.address}`), element('p', `Revision ${customer.revision}`));
      const edit = button(`Edit ${customer.name}`, () => {
        draft = { input: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone,
          address: customer.address, leadSource: customer.leadSource }, expectedRevision: customer.revision }; message = ''; render();
      }); edit.disabled = state.saveState === 'saving' || state.saveState === 'needs-inspection'; row.append(edit); list.append(row);
    }
    root.append(list);
    if (state.customers.length === 0) root.append(element('p', 'No local contacts in this unlocked vault.'));
    const add = button('Add synthetic customer', () => {
      draft = { input: { id: crypto.randomUUID(), name: 'Synthetic Customer', email: 'test@example.invalid', phone: '', address: 'Synthetic address', leadSource: 'Synthetic' }, expectedRevision: 0 };
      message = ''; render();
    }); add.disabled = state.saveState === 'saving' || state.saveState === 'needs-inspection'; root.append(add);
    if (!draft) return;
    const capturedDraft = draft, form = element('form'); form.setAttribute('aria-label', 'Local customer editor');
    for (const [key, title] of [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['leadSource', 'Lead source']] as const) {
      const label = element('label', title), field = element('input'); field.name = key; field.value = capturedDraft.input[key];
      field.maxLength = 4096; field.required = key === 'name'; field.disabled = state.saveState === 'saving';
      field.addEventListener('input', () => { capturedDraft.input[key] = field.value; }); label.append(field); form.append(label);
    }
    const phrase = phraseField(form, 'Test phrase for this local save'); phrase.disabled = state.saveState === 'saving';
    const save = element('button', 'Save locally'); save.type = 'submit'; save.disabled = state.saveState === 'saving' || state.saveState === 'needs-inspection'; form.append(save);
    const cancel = button('Cancel edit', () => { draft = undefined; message = ''; render(); });
    cancel.disabled = state.saveState === 'saving'; form.append(cancel); root.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); const supplied = phrase.value; phrase.value = '';
      if (disposed || rendered !== renderGeneration || state.saveState === 'saving' || state.saveState === 'needs-inspection') return;
      const input = structuredClone(capturedDraft.input), epoch = generation;
      if (!input.name.startsWith('Synthetic ') || (input.email && !/^[^@\s]+@example\.invalid$/.test(input.email))
        || input.phone !== '' || !input.address.startsWith('Synthetic') || input.leadSource !== 'Synthetic') {
        message = 'Synthetic data only: use a Synthetic name/address, example.invalid email, blank phone and Synthetic lead source.'; render(); return;
      }
      message = '';
      try {
        await repository.save(input, crypto.randomUUID(), capturedDraft.expectedRevision, supplied);
        if (disposed || epoch !== generation) return;
        draft = undefined; message = 'Saved locally. Server sync pending.'; render();
      } catch {
        if (disposed || epoch !== generation) return;
        message = 'Save did not complete. Keep your draft and inspect current records; no automatic retry was made.'; render();
      }
    });
  }
  const unsubscribe = repository.subscribe(state => render(state)); render();
  return {
    refresh: () => render(),
    dispose() {
      if (disposed) return;
      repository.dispose(); disposed = true; generation++; draft = undefined; message = '';
      unsubscribe(); wipeInputs(); root.replaceChildren(); delete root.dataset.localCustomerState;
    },
  };
}
