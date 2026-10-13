/** Opt-in synthetic controller. Identity must come from a separately verified auth adapter. */
import { openLocalCustomerVault } from './local-customer-vault';
import { localCustomerDatabaseName } from './local-customer-store';
import { createLocalCustomerRepository } from './local-customer-repository';
import { mountSyntheticCustomerView } from '../components/local-customer-view';

export type LocalCustomerIdentity = { accountId: string; targetId: string };
type Repository = ReturnType<typeof createLocalCustomerRepository>;
type Vault = Awaited<ReturnType<typeof openLocalCustomerVault>>;
type Active = { identity: LocalCustomerIdentity; vault: Vault; repository: Repository;
  view?: ReturnType<typeof mountSyntheticCustomerView> };

/** No identity inference, authentication, vault seeding, restore or transport. */
export function createSyntheticCustomerController(root: HTMLElement, options: {
  targetId: string; readIdentity: () => LocalCustomerIdentity | null; idleMs?: number;
}) {
  // Copy config so callers cannot silently retarget an active controller.
  const targetId = options.targetId, readIdentity = options.readIdentity, idleMs = options.idleMs ?? 300_000;
  localCustomerDatabaseName('synthetic-config-check', targetId);
  if (typeof readIdentity !== 'function' || !Number.isSafeInteger(idleMs) || idleMs < 50 || idleMs > 86_400_000)
    throw new Error('Invalid local controller configuration.');
  let active: Active | undefined, generation = 0, disposed = false;
  function identity(): LocalCustomerIdentity | null {
    try {
      const value = readIdentity();
      if (!value || Object.keys(value).length !== 2 || value.targetId !== targetId) return null;
      localCustomerDatabaseName(value.accountId, value.targetId);
      return { accountId: value.accountId, targetId: value.targetId };
    } catch { return null; }
  }
  function same(a: LocalCustomerIdentity | null, b: LocalCustomerIdentity) {
    return a?.accountId === b.accountId && a.targetId === b.targetId;
  }
  function clear() {
    const previous = active; active = undefined;
    if (previous) { try { if (previous.view) previous.view.dispose(); else previous.repository.dispose(); } finally { previous.vault.close(); } }
    root.querySelectorAll('input').forEach(input => { input.value = ''; }); root.replaceChildren();
    delete root.dataset.localCustomerState;
  }
  function status(text: string) {
    if (disposed) return;
    const node = document.createElement('p'); node.setAttribute('role', 'status'); node.textContent = text;
    root.replaceChildren(node);
  }
  function guard(captured: LocalCustomerIdentity) {
    if (disposed || !active) return false; // Teardown notifications cannot invalidate a newer activation.
    if (!same(identity(), captured)) {
      generation++; clear(); status('Access changed. Local contacts locked; no automatic unlock or recovery.'); return false;
    }
    return true;
  }
  async function activate() {
    if (disposed) throw new Error('Controller closed.');
    clear(); const epoch = ++generation; const captured = identity();
    if (!captured) { status('Verified account and matching app target required. Local contacts remain locked.'); return false; }
    status('Opening encrypted local contacts…');
    let vault: Vault | undefined, repository: Repository | undefined;
    try {
      vault = await openLocalCustomerVault(captured.accountId, captured.targetId);
      if (disposed || epoch !== generation || !same(identity(), captured)) {
        vault.close();
        if (!disposed && epoch === generation) status('Access changed. Local contacts remain locked.');
        return false;
      }
      vault.enableAutoLock(idleMs); repository = createLocalCustomerRepository(vault);
      const raw = repository;
      const guarded: Repository = {
        read: () => { guard(captured); return raw.read(); },
        subscribe: listener => raw.subscribe(state => { if (guard(captured)) listener(state); }),
        unlock: phrase => { if (!guard(captured)) return Promise.reject(new Error('Access changed.')); return raw.unlock(phrase); },
        save: (...args) => { if (!guard(captured)) return Promise.reject(new Error('Access changed.')); return raw.save(...args); },
        inspectStored: phrase => { if (!guard(captured)) return Promise.reject(new Error('Access changed.')); return raw.inspectStored(phrase); },
        inspectPortableDestination: async (envelope, phrase) => {
          if (!guard(captured)) throw new Error('Access changed.');
          const result = await raw.inspectPortableDestination(envelope, phrase);
          if (!guard(captured)) throw new Error('Access changed.');
          return result;
        },
        exportPortableBackup: async phrase => {
          if (!guard(captured)) throw new Error('Access changed.');
          const result = await raw.exportPortableBackup(phrase);
          if (!guard(captured)) throw new Error('Access changed.');
          return result;
        },
        verifyPortableBackup: async (envelope, phrase) => {
          if (!guard(captured)) throw new Error('Access changed.');
          const result = await raw.verifyPortableBackup(envelope, phrase);
          if (!guard(captured)) throw new Error('Access changed.');
          return result;
        },
        lock: () => { if (guard(captured)) raw.lock(); },
        dispose: () => raw.dispose(),
      };
      // Establish the active identity before initial rendering calls guarded.read().
      active = { identity: captured, vault, repository: raw, view: undefined };
      const view = mountSyntheticCustomerView(root, guarded); active.view = view;
      return true;
    } catch {
      repository?.dispose(); vault?.close();
      if (!disposed && epoch === generation) { active = undefined; clear(); status('Local contacts unavailable. Preserve existing vaults and backups.'); }
      return false;
    }
  }
  return {
    activate,
    refreshIdentity() {
      if (active) guard(active.identity); // Caller must invoke immediately on logout/account/target change.
    },
    dispose() { if (disposed) return; disposed = true; generation++; clear(); },
  };
}
