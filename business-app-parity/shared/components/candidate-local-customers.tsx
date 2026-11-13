'use client';
import { useEffect, useRef, useState } from 'react';
import { createSyntheticCustomerController, type LocalCustomerIdentity } from '../lib/synthetic-customer-controller';
import { openLocalCustomerVault } from '../lib/local-customer-vault';
import '../synthetic-customers-preview/preview.css';

/** Candidate-only contacts panel. No online sources, automatic seed, restore or sync. */
export function CandidateLocalCustomers({ identity }: { identity: LocalCustomerIdentity | null }) {
  const root = useRef<HTMLElement>(null), current = useRef(identity), generation = useRef(0);
  const initializer = useRef<Awaited<ReturnType<typeof openLocalCustomerVault>> | null>(null);
  const controller = useRef<ReturnType<typeof createSyntheticCustomerController> | null>(null);
  const [phrase, setPhrase] = useState(''), [status, setStatus] = useState('Checking synthetic vault…');
  const [occupied, setOccupied] = useState(true), [busy, setBusy] = useState(false), [dark, setDark] = useState(false);
  current.current = identity;
  useEffect(() => {
    const epoch = ++generation.current; setPhrase(''); setOccupied(true); setBusy(false);
    if (!identity || !identity.accountId.startsWith('synthetic-') || !identity.targetId.startsWith('synthetic-') || !root.current) { setStatus('Local contacts locked. Verified candidate identity required.'); return; }
    const active = createSyntheticCustomerController(root.current, { targetId: identity.targetId, readIdentity: () => current.current, reviewedResolutionEnabled: true });
    controller.current = active; void active.activate();
    const workspace = root.current;
    const recovered = () => { if (epoch === generation.current) { setOccupied(true); setStatus('Synthetic bundle recovered. Vault stays locked; unlock below to inspect.'); } };
    workspace.addEventListener('fire-local-vault-recovered', recovered);
    void (async () => {
      let vault: Awaited<ReturnType<typeof openLocalCustomerVault>> | undefined;
      try {
        vault = await openLocalCustomerVault(identity.accountId, identity.targetId);
        const exists = await vault.hasStoredSnapshot();
        if (epoch !== generation.current) return;
        setOccupied(exists); setStatus(exists ? 'Synthetic vault exists. Unlock below; records are preserved.' : 'No synthetic snapshot. Create a separate empty test vault explicitly.');
      } catch { if (epoch === generation.current) setStatus('Storage unavailable. Preserve your vault and backup.'); }
      finally { vault?.close(); }
    })();
    return () => { workspace.removeEventListener('fire-local-vault-recovered', recovered); generation.current++; initializer.current?.close(); initializer.current = null; active.dispose(); controller.current = null; };
  }, [identity?.accountId, identity?.targetId]);
  async function createFixture(event: React.FormEvent) {
    event.preventDefault(); const supplied = phrase; setPhrase('');
    const captured = current.current, epoch = generation.current;
    if (!captured || busy || occupied) return; setBusy(true);
    let vault: Awaited<ReturnType<typeof openLocalCustomerVault>> | undefined;
    try {
      vault = await openLocalCustomerVault(captured.accountId, captured.targetId);
      if (epoch !== generation.current) return; initializer.current = vault;
      await vault.initialize({ format: 'fire-local-customers', version: 1,
        namespace: `fire-local-customers:v1:${captured.accountId}:${captured.targetId}`, customers: [], pendingOperations: [] }, supplied);
      if (epoch !== generation.current) return;
      setOccupied(true); setStatus('Empty synthetic vault created. Enter the same test phrase below to unlock.'); await controller.current?.activate();
    } catch { if (epoch === generation.current) setStatus('Creation did not complete or the vault exists. Nothing was overwritten.'); }
    finally { vault?.close(); if (initializer.current === vault) initializer.current = null; if (epoch === generation.current) setBusy(false); }
  }
  return <div className="fire-synthetic-preview" data-theme={dark ? 'dark' : 'light'}>
    <header className="preview-topbar candidate-topbar"><a className="brand" href="/">FIRE · Home</a><button type="button" onClick={() => window.history.back()}>Back</button><button type="button" onClick={() => setDark(!dark)}>Switch to {dark ? 'light' : 'dark'} mode</button></header>
    <main className="preview-shell"><section className="preview-notice"><strong>Offline Customers · synthetic candidate</strong><p>Separate development contacts. Online customers, estimates, invoices and payments remain in their existing workflows.</p></section>
      <section className="setup-card"><h2>Local test vault</h2><p role="status">{status}</p>{identity && !occupied && <form onSubmit={createFixture}><label>New test phrase<input type="password" minLength={16} maxLength={1024} required autoComplete="off" value={phrase} onChange={e => setPhrase(e.target.value)}/></label><button type="submit" disabled={busy}>Create empty synthetic test vault</button></form>}</section>
      <section className="customer-workspace" ref={root} aria-label="Offline candidate Customers"/>
    </main>
  </div>;
}
