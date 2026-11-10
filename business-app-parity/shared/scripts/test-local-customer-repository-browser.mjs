// New opt-in repository boundary: native Chromium IndexedDB/WebCrypto, synthetic localhost only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url), ts = require('typescript');
const { chromium } = require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE || 'playwright');
const modules = new Map();
for (const name of ['store', 'backup', 'vault', 'repository']) {
  let js = ts.transpileModule(readFileSync(new URL(`../lib/local-customer-${name}.ts`, import.meta.url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const module of ['store', 'backup', 'vault']) js = js.replaceAll(`'./local-customer-${module}'`, `'/local-customer-${module}.js'`);
  modules.set(`/local-customer-${name}.js`, js);
}
const server = createServer((req, res) => {
  if (modules.has(req.url)) { res.setHeader('Content-Type', 'text/javascript'); res.end(modules.get(req.url)); }
  else if (req.url === '/') res.end('<!doctype html><title>Synthetic repository test</title>');
  else { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, profile = mkdtempSync(join(tmpdir(), 'fire-repository-'));
let context, passed = 0; const remote = [];
async function launch() {
  context = await chromium.launchPersistentContext(profile, { executablePath: process.env.FIRE_BROWSER_TEST_EXECUTABLE || undefined,
    headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) { remote.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
}
async function setup() {
  const p = await context.newPage(); await p.goto(origin);
  await p.evaluate(async () => {
    const { openLocalCustomerVault } = await import('/local-customer-vault.js');
    window.repositoryAPI = await import('/local-customer-repository.js');
    window.vaultAPI = { openLocalCustomerVault };
    window.vault = await openLocalCustomerVault('synthetic-repository', 'synthetic-target');
    window.repo = repositoryAPI.createLocalCustomerRepository(vault);
    window.phrase = 'synthetic repository recovery phrase only';
    window.input = { id: 'synthetic-1', name: 'Synthetic Customer', email: 'test@example.invalid', phone: '', address: 'Synthetic', leadSource: 'test' };
    const customer = { ...input, revision: 1, updatedAt: '2026-10-12T00:00:00.000Z' };
    window.archive = { format: 'fire-local-customers', version: 1, namespace: 'fire-local-customers:v1:synthetic-repository:synthetic-target',
      customers: [customer], pendingOperations: [{ id: 'synthetic-create', kind: 'customer-upsert', expectedRevision: 0, input, customer }] };
    window.raw = async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(vault.namespace, 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const rows = await new Promise((resolve, reject) => { const tx = db.transaction('sealed'); const r = tx.objectStore('sealed').getAll(); tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error); });
      db.close(); return JSON.stringify(rows);
    };
  }); return p;
}
async function check(name, fn) { await fn(); passed++; console.log(`PASS: ${name}`); }
process.exitCode = 1;
try {
  await launch(); let p = await setup(); const version = context.browser().version();
  await check('locked directory has unknown contacts/count, never fake empty or financial zero', async () => {
    assert.deepEqual(await p.evaluate(() => repo.read()), { status: 'locked', customers: null, pendingOperationCount: null, saveState: 'idle', jobHistory: 'connection-required' });
  });
  await check('unlocking an unused destination never seeds a vault', async () => {
    assert.equal(await p.evaluate(async () => { try { await repo.unlock(phrase); return false; } catch (e) { return e.code === 'UNLOCK_FAILED' && !(await vault.hasStoredSnapshot()); } }), true);
  });
  await p.evaluate(async () => { await vault.initialize(archive, phrase); await repo.unlock(phrase); });
  await check('ready directory exposes contacts and retained local operation count only', async () => {
    const s = await p.evaluate(() => repo.read()); assert.equal(s.status, 'ready'); assert.equal(s.customers[0].revision, 1); assert.equal(s.pendingOperationCount, 1); assert.equal(s.jobHistory, 'connection-required'); assert.ok(!('paidTotal' in s.customers[0]));
  });
  await check('returned contact objects cannot mutate the vault', async () => {
    assert.equal(await p.evaluate(() => { repo.read().customers[0].name = 'Mutated'; return repo.read().customers[0].name; }), 'Synthetic Customer');
  });
  await check('subscriber errors and mutations cannot affect another subscriber', async () => {
    assert.equal(await p.evaluate(async () => { const a = repo.subscribe(s => { if (s.customers) s.customers[0].name = 'Mutated'; throw Error('UI error'); }); let observed; const b = repo.subscribe(s => { observed = s.customers?.[0].name; }); await repo.save({ ...input, name: 'Synthetic Revision 2' }, 'synthetic-edit-2', 1, phrase); a(); b(); return observed; }), 'Synthetic Revision 2');
  });
  await check('completed save returns committed revision and pending receipt', async () => {
    const s = await p.evaluate(() => repo.read()); assert.equal(s.saveState, 'saved-locally'); assert.equal(s.customers[0].revision, 2); assert.equal(s.pendingOperationCount, 2);
  });
  await check('idempotent older operation retry cannot regress displayed current revision', async () => {
    const s = await p.evaluate(async () => { await repo.save({ ...input, name: 'Synthetic Revision 3' }, 'synthetic-edit-3', 2, phrase); return repo.save({ ...input, name: 'Synthetic Revision 2' }, 'synthetic-edit-2', 1, phrase); });
    assert.equal(s.customers[0].revision, 3); assert.equal(s.pendingOperationCount, 3);
  });
  await check('stale revision save rejects without overwriting newer ciphertext', async () => {
    assert.equal(await p.evaluate(async () => { const before = await raw(); try { await repo.save(input, 'stale', 1, phrase); return false; } catch (e) { return e.code === 'SAVE_FAILED' && repo.read().saveState === 'needs-inspection' && before === await raw(); } }), true);
  });
  await check('stored inspection leaves ciphertext and failure barrier unchanged',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw();const stored=await repo.inspectStored(phrase);stored.customers[0].name='Mutation';return before===await raw()&&stored.operations.length===3&&repo.read().saveState==='needs-inspection'&&repo.read().customers[0].name!=='Mutation';}),true);
  });
  await check('wrong inspection phrase exposes no report and never writes',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw();try{await repo.inspectStored('incorrect synthetic inspection phrase');return false;}catch(e){return e.code==='INSPECTION_FAILED'&&before===await raw()&&repo.read().saveState==='needs-inspection';}}),true);
  });
  await check('wrong write phrase preserves records and exposes no secret/error detail', async () => {
    assert.equal(await p.evaluate(async () => { const before = await raw(); try { await repo.save(input, 'wrong-phrase', 3, 'incorrect synthetic write phrase'); return false; } catch (e) { return e.message === 'SAVE_FAILED' && before === await raw(); } }), true);
  });
  await check('native transaction abort never reports saved locally', async () => {
    assert.equal(await p.evaluate(async () => { const before = await raw(), original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { const r = original.apply(this, args); r.addEventListener('success', () => r.transaction.abort()); return r; }; try { await repo.save(input, 'aborted', 3, phrase); return false; } catch { return before === await raw() && repo.read().saveState === 'needs-inspection'; } finally { IDBObjectStore.prototype.put = original; } }), true);
  });
  await check('concurrent writes are rejected instead of queued or retried', async () => {
    assert.equal(await p.evaluate(async () => { const one = repo.save({ ...input, name: 'Synthetic Revision 4' }, 'synthetic-edit-4', 3, phrase); let busy = false; try { await repo.save(input, 'concurrent', 3, phrase); } catch (e) { busy = e.code === 'BUSY'; } await one; return busy && repo.read().customers[0].revision === 4; }), true);
  });
  await check('vault lock revokes contacts immediately and emits cleared state', async () => {
    assert.equal(await p.evaluate(() => { let seen; const off = repo.subscribe(s => { seen = s; }); vault.lock(); off(); return repo.read().status === 'locked' && seen.customers === null && seen.pendingOperationCount === null; }), true);
  });
  await check('locked save is rejected and never decrypts or seeds', async () => {
    assert.equal(await p.evaluate(async () => { const before = await raw(); try { await repo.save(input, 'locked', 4, phrase); return false; } catch (e) { return e.code === 'LOCKED' && before === await raw(); } }), true);
  });
  await check('wrong unlock phrase preserves ciphertext and sanitizes errors', async () => {
    assert.equal(await p.evaluate(async () => { const before = await raw(); try { await repo.unlock('incorrect synthetic unlock phrase'); return false; } catch (e) { return e.code === 'UNLOCK_FAILED' && repo.read().customers === null && before === await raw(); } }), true);
  });
  await check('lock during unlock cannot publish a late ready state', async () => {
    assert.equal(await p.evaluate(async () => { const pending = repo.unlock(phrase); vault.lock(); try { await pending; return false; } catch (e) { return e.code === 'INTERRUPTED' && repo.read().status === 'locked'; } }), true);
  });
  await check('lock during encryption cannot publish late saved state', async () => {
    assert.equal(await p.evaluate(async () => { await repo.unlock(phrase); const before = await raw(); const pending = repo.save(input, 'late', 4, phrase); vault.lock(); try { await pending; return false; } catch (e) { return e.code === 'INTERRUPTED' && repo.read().customers === null && before === await raw(); } }), true);
  });
  await check('caller mutation after save starts cannot alter committed payload', async () => {
    assert.equal(await p.evaluate(async () => { await repo.unlock(phrase); const copy = { ...input, name: 'Synthetic Revision 5' }; const pending = repo.save(copy, 'synthetic-edit-5', 4, phrase); copy.name = 'Tampered'; const s = await pending; return s.customers[0].name === 'Synthetic Revision 5'; }), true);
  });
  await check('disposal clears subscribers and refuses future operations', async () => {
    assert.equal(await p.evaluate(async () => { repo.dispose(); let rejected = 0; for (const fn of [() => repo.unlock(phrase), () => repo.save(input, 'disposed', 5, phrase)]) try { await fn(); } catch (e) { if (e.code === 'CLOSED') rejected++; } repo.dispose(); return rejected === 2 && repo.read().status === 'closed' && repo.read().customers === null; }), true);
  });
  await p.evaluate(() => vault.close()); await context.close(); await launch(); p = await setup();
  await check('reopening real IndexedDB retains committed contact and receipts', async () => {
    const s = await p.evaluate(() => repo.unlock(phrase)); assert.equal(s.customers[0].revision, 5); assert.equal(s.pendingOperationCount, 5);
  });
  await check('different target repository cannot unlock another target vault', async () => {
    assert.equal(await p.evaluate(async () => { const other = await vaultAPI.openLocalCustomerVault('synthetic-repository', 'other-target'); const isolated = repositoryAPI.createLocalCustomerRepository(other); try { await isolated.unlock(phrase); return false; } catch { const safe = !(await other.hasStoredSnapshot()) && isolated.read().customers === null; isolated.dispose(); other.close(); return safe; } }), true);
  });
  await check('native ciphertext contains no contact plaintext', async () => {
    const bytes = await p.evaluate(() => raw()); assert.ok(!bytes.includes('Synthetic Revision 5')); assert.ok(!bytes.includes('test@example.invalid'));
  });
  await check('quota fault preserves committed snapshot and reports inspection required', async () => {
    assert.equal(await p.evaluate(async () => { const before = await raw(), original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Synthetic quota', 'QuotaExceededError'); }; try { await repo.save(input, 'quota', 5, phrase); return false; } catch { return before === await raw() && repo.read().saveState === 'needs-inspection'; } finally { IDBObjectStore.prototype.put = original; } }), true);
  });
  await check('cross-tab synchronous lock token check hides contacts before events arrive', async () => {
    assert.equal(await p.evaluate(async () => { const other = await vaultAPI.openLocalCustomerVault('synthetic-repository', 'synthetic-target'); other.lock(); const s = repo.read(); other.close(); return s.status === 'locked' && s.customers === null; }), true);
  });
  await check('subscriber lock on unlock notification cannot return late plaintext', async () => {
    assert.equal(await p.evaluate(async () => { const off = repo.subscribe(s => { if (s.status === 'ready') repo.lock(); }); try { await repo.unlock(phrase); return false; } catch (e) { return e.code === 'INTERRUPTED' && repo.read().customers === null; } finally { off(); } }), true);
  });
  await check('subscriber lock after committed save prevents plaintext return but preserves commit', async () => {
    assert.equal(await p.evaluate(async () => { await repo.unlock(phrase); const off = repo.subscribe(s => { if (s.saveState === 'saved-locally') repo.lock(); }); let interrupted = false; try { await repo.save({ ...input, name: 'Synthetic Revision 6' }, 'synthetic-edit-6', 5, phrase); } catch (e) { interrupted = e.code === 'INTERRUPTED' && repo.read().customers === null; } finally { off(); } const view = await repo.unlock(phrase); return interrupted && view.customers[0].revision === 6 && view.pendingOperationCount === 6; }), true);
  });
  await check('repository portable export and verification preserve save state and ciphertext',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw(),state=repo.read().saveState;window.bundle=await repo.exportPortableBackup(phrase);const result=await repo.verifyPortableBackup(bundle,phrase);return result.customerCount===1&&result.receiptCount===6&&result.resolutionArchiveCount===0&&!result.recoveryPerformed&&before===await raw()&&repo.read().saveState===state;}),true);
  });
  await check('portable verification rejects wrong account and target without changing either vault',async()=>{
    assert.equal(await p.evaluate(async()=>{for(const [account,target] of [['synthetic-other-account','synthetic-target'],['synthetic-repository','synthetic-other-target']]){const other=await vaultAPI.openLocalCustomerVault(account,target);await other.initialize({format:'fire-local-customers',version:1,namespace:`fire-local-customers:v1:${account}:${target}`,customers:[],pendingOperations:[]},phrase);const r=repositoryAPI.createLocalCustomerRepository(other);await r.unlock(phrase);try{await r.verifyPortableBackup(bundle,phrase);return false;}catch(e){if(e.code!=='INVALID_ARCHIVE'||r.read().customers.length!==0)return false;}finally{r.dispose();other.close();}}return true;}),true);
  });
  await check('portable export blocks competing save rather than queuing it',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw(),pending=repo.exportPortableBackup(phrase);let busy=false;try{await repo.save(input,'blocked-export-save',6,phrase);}catch(e){busy=e.code==='BUSY';}await pending;return busy&&before===await raw();}),true);
  });
  await check('lock during portable verification prevents late result publication',async()=>{
    assert.equal(await p.evaluate(async()=>{const pending=repo.verifyPortableBackup(bundle,phrase);repo.lock();try{await pending;return false;}catch(e){return e.code==='INTERRUPTED'&&repo.read().customers===null;}}),true);
  });
  await check('locked repository refuses portable operations',async()=>{
    assert.equal(await p.evaluate(async()=>{let rejected=0;for(const run of [()=>repo.exportPortableBackup(phrase),()=>repo.verifyPortableBackup(bundle,phrase)])try{await run();}catch(e){if(e.code==='LOCKED')rejected++;}return rejected===2;}),true);
  });
  await check('locked portable preflight rejects occupied storage without writes',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw();try{await repo.inspectPortableDestination(bundle,phrase);return false;}catch(e){return e.code==='DESTINATION_OCCUPIED'&&before===await raw()&&repo.read().status==='locked';}}),true);
  });
  await check('lock during destination preflight prevents a late result',async()=>{
    assert.equal(await p.evaluate(async()=>{const pending=repo.inspectPortableDestination(bundle,phrase);repo.lock();try{await pending;return false;}catch{return repo.read().customers===null;}}),true);
  });
  await check('repository requires deliberate recovery confirmation and never overwrites occupied vault',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw();let rejected=0;for(const confirmed of [false,true])try{await repo.recoverPortableBackup(bundle,phrase,confirmed);}catch{rejected++;}return rejected===2&&before===await raw()&&repo.read().status==='locked';}),true);
  });
  await p.evaluate(async()=>{await repo.unlock(phrase);const stored=await repo.inspectStored(phrase);window.reviewed={format:'fire-local-customer-resolution',version:1,namespace:archive.namespace,operationId:'repository-resolution-7',originalDraft:{...input,name:'Synthetic Original Retained Draft'},originalExpectedRevision:6,reviewedSnapshot:{format:'fire-local-customers',version:1,namespace:archive.namespace,customers:stored.customers,pendingOperations:stored.operations},proposed:{...input,name:'Synthetic Reviewed Resolution'}};});
  await check('reviewed resolution requires explicit confirmation without changing save state',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw(),state=repo.read().saveState;try{await repo.saveReviewedResolution(reviewed,phrase,false);return false;}catch(e){return e.code==='CONFIRMATION_REQUIRED'&&before===await raw()&&repo.read().saveState===state;}}),true);
  });
  await check('reviewed repository save archives original draft and preserves prior receipts atomically',async()=>{
    assert.equal(await p.evaluate(async()=>{const r=await repo.saveReviewedResolution(reviewed,phrase,true),original=await repo.inspectResolutionArchive(reviewed.operationId,phrase);return r.customers[0].revision===7&&r.pendingOperationCount===7&&r.saveState==='saved-locally'&&original.originalDraft.name==='Synthetic Original Retained Draft'&&original.reviewedSnapshot.customers[0].revision===6&&original.reviewedSnapshot.pendingOperations.length===6;}),true);
  });
  await check('stale reviewed resolution refuses writes and requires inspection rather than retry',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw();try{await repo.saveReviewedResolution({...reviewed,operationId:'stale-review'},phrase,true);return false;}catch(e){return e.code==='SAVE_FAILED'&&before===await raw()&&repo.read().saveState==='needs-inspection';}}),true);
  });
  await check('portable backup includes the repository resolution archive and all history without writes',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw();window.resolutionBundle=await repo.exportPortableBackup(phrase);const v=await repo.verifyPortableBackup(resolutionBundle,phrase);return before===await raw()&&v.customerCount===1&&v.receiptCount===7&&v.resolutionArchiveCount===1;}),true);
  });
  await check('archive quota failure rolls back reviewed customer replacement and requires inspection',async()=>{
    assert.equal(await p.evaluate(async()=>{const stored=await repo.inspectStored(phrase),before=await raw(),next={...reviewed,operationId:'quota-review',originalExpectedRevision:7,reviewedSnapshot:{format:'fire-local-customers',version:1,namespace:archive.namespace,customers:stored.customers,pendingOperations:stored.operations}},original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(){throw new DOMException('Synthetic archive quota','QuotaExceededError');};try{await repo.saveReviewedResolution(next,phrase,true);return false;}catch(e){return e.code==='SAVE_FAILED'&&before===await raw()&&repo.read().saveState==='needs-inspection'&&repo.read().customers[0].revision===7;}finally{IDBObjectStore.prototype.add=original;}}),true);
  });
  await check('lock during archive inspection prevents late plaintext and preserves storage',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=await raw(),pending=repo.inspectResolutionArchive(reviewed.operationId,phrase);repo.lock();try{await pending;return false;}catch(e){return e.code==='INTERRUPTED'&&repo.read().customers===null&&before===await raw();}}),true);
  });
  await check('lock during reviewed save aborts writes and returns no late success',async()=>{
    assert.equal(await p.evaluate(async()=>{await repo.unlock(phrase);const stored=await repo.inspectStored(phrase),before=await raw(),next={...reviewed,operationId:'locked-review',originalExpectedRevision:7,reviewedSnapshot:{format:'fire-local-customers',version:1,namespace:archive.namespace,customers:stored.customers,pendingOperations:stored.operations}};const pending=repo.saveReviewedResolution(next,phrase,true);repo.lock();try{await pending;return false;}catch(e){return e.code==='INTERRUPTED'&&before===await raw()&&repo.read().customers===null;}}),true);
  });
  await check('reviewed-save backup recovers original draft and receipts into an empty isolated browser',async()=>{
    const envelope=await p.evaluate(()=>resolutionBundle),isolated=await context.browser().newContext();try{
      await isolated.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const q=await isolated.newPage();await q.goto(origin);
      assert.equal(await q.evaluate(async envelope=>{const {openLocalCustomerVault}=await import('/local-customer-vault.js'),{createLocalCustomerRepository}=await import('/local-customer-repository.js');const v=await openLocalCustomerVault('synthetic-repository','synthetic-target'),r=createLocalCustomerRepository(v),phrase='synthetic repository recovery phrase only';try{await r.recoverPortableBackup(envelope,phrase,true);if(r.read().status!=='locked')return false;const state=await r.unlock(phrase),original=await r.inspectResolutionArchive('repository-resolution-7',phrase),again=await r.exportPortableBackup(phrase),verified=await r.verifyPortableBackup(again,phrase);return state.customers[0].revision===7&&state.pendingOperationCount===7&&original.originalDraft.name==='Synthetic Original Retained Draft'&&original.reviewedSnapshot.pendingOperations.length===6&&verified.resolutionArchiveCount===1;}finally{r.dispose();v.close();}},envelope),true);
    }finally{await isolated.close();}
  });
  await check('all requests stayed inside synthetic localhost origin', async () => assert.deepEqual(remote, []));
  console.log(JSON.stringify({ passed, total: passed, browserVersion: version, nativeIndexedDB: true, nativeWebCrypto: true,
    syntheticOnly: true, uiActivated: false, serverSync: false, iPhoneTested: false })); process.exitCode = 0;
} finally { if (context) await context.close(); await new Promise(resolve => server.close(resolve)); rmSync(profile, { recursive: true, force: true }); }
