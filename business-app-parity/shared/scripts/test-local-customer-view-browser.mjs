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
modules.set('/view.js',ts.transpileModule(readFileSync(new URL('../components/local-customer-view.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const server = createServer((req, res) => {
  if (modules.has(req.url)) { res.setHeader('Content-Type', 'text/javascript'); res.end(modules.get(req.url)); }
  else if (req.url === '/') res.end('<!doctype html><title>Synthetic Customers UI test</title><main></main>');
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
  const {openLocalCustomerVault} = await import('/local-customer-vault.js');
  const {createLocalCustomerRepository} = await import('/local-customer-repository.js');
  const {mountSyntheticCustomerView} = await import('/view.js');
  window.vault = await openLocalCustomerVault('synthetic-ui','synthetic-target');
  window.repo = createLocalCustomerRepository(vault);
  window.view = mountSyntheticCustomerView(document.querySelector('main'),repo);
  window.raw = async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(vault.namespace,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const result=await new Promise((resolve,reject)=>{const tx=db.transaction('sealed','readonly');const r=tx.objectStore('sealed').getAll();tx.oncomplete=()=>resolve(JSON.stringify(r.result));tx.onabort=()=>reject(tx.error);});db.close();return result;
  };
  window.phrase = 'synthetic UI recovery phrase only';
  window.input = {id:'synthetic-1',name:'Synthetic Customer',email:'test@example.invalid',phone:'',address:'Synthetic address',leadSource:'Synthetic'};
  const customer={...input,revision:1,updatedAt:'2026-10-12T00:00:00.000Z'};
  window.archive={format:'fire-local-customers',version:1,namespace:'fire-local-customers:v1:synthetic-ui:synthetic-target',customers:[customer],pendingOperations:[{id:'synthetic-create',kind:'customer-upsert',expectedRevision:0,input,customer}]};
 }); return p;
}
async function check(name,fn){await fn();passed++;console.log(`PASS: ${name}`);}
async function unlock(p){await p.getByLabel('Test recovery phrase',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Unlock local contacts',exact:true}).click();await p.waitForFunction(()=>document.querySelector('main').dataset.localCustomerState==='ready');}
async function save(p){await p.getByLabel('Test phrase for this local save',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Save locally',exact:true}).click();}
process.exitCode=1;
try{
 await launch();let p=await setup();const version=context.browser().version();
 await check('locked UI hides contacts and never claims an empty vault',async()=>{assert.match(await p.locator('main').innerText(),/locked does not mean empty/);assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await check('unused vault unlock does not initialize storage',async()=>{await p.getByLabel('Test recovery phrase',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Unlock local contacts'}).click();await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Unlock did not complete'));assert.equal(await p.evaluate(()=>vault.hasStoredSnapshot()),false);});
 await p.evaluate(()=>vault.initialize(archive,phrase));
 await check('wrong phrase clears input and preserves locked UI',async()=>{await p.getByLabel('Test recovery phrase',{exact:true}).fill('wrong synthetic recovery phrase');await p.getByRole('button',{name:'Unlock local contacts'}).click();await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Unlock did not complete'));assert.equal(await p.getByLabel('Test recovery phrase',{exact:true}).inputValue(),'');assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await unlock(p);
 await check('unlock renders revision and pending receipts with explicit history limitation',async()=>{const text=await p.locator('main').innerText();assert.match(text,/Revision 1/);assert.match(text,/1 local operation receipts/);assert.match(text,/payments.*require a connection/);assert.ok(!text.includes('$0'));});
 await check('edit prepopulates the current contact',async()=>{await p.getByRole('button',{name:'Edit Synthetic Customer',exact:true}).click();assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Customer');});
 await check('synthetic guard rejects customer data without a write',async()=>{await p.getByLabel('Email',{exact:true}).fill('real@example.com');await save(p);assert.match(await p.locator('[data-save-status]').innerText(),/Synthetic data only/);assert.equal(await p.evaluate(()=>repo.read().customers[0].revision),1);await p.getByLabel('Email',{exact:true}).fill('test@example.invalid');});
 await check('already loaded UI saves edit offline and displays committed revision',async()=>{await context.setOffline(true);await p.getByLabel('Name',{exact:true}).fill('Synthetic Edited');await save(p);await p.waitForFunction(()=>document.querySelector('main').innerText.includes('Revision 2'));assert.match(await p.locator('[data-save-status]').innerText(),/Saved locally/);assert.equal(await p.getByLabel('Test phrase for this local save',{exact:true}).count(),0);assert.equal(await p.getByLabel('Test phrase for stored inspection',{exact:true}).inputValue(),'');await context.setOffline(false);});
 await check('create appends a synthetic contact with its local receipt',async()=>{await p.getByRole('button',{name:'Add synthetic customer'}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic New');await save(p);await p.waitForFunction(()=>document.querySelectorAll('[data-customer-id]').length===2);assert.equal(await p.evaluate(()=>repo.read().pendingOperationCount),3);});
 await check('lock clears visible contact data and detached input values',async()=>{await p.getByRole('button',{name:'Edit Synthetic Edited',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Unsaved');await p.evaluate(()=>{window.oldForm=document.querySelector('[aria-label="Local customer editor"]');window.oldInputs=[...oldForm.querySelectorAll('input')];});await p.getByRole('button',{name:'Lock local contacts'}).click();assert.equal(await p.locator('[data-customer-id]').count(),0);assert.equal(await p.evaluate(()=>oldInputs.every(x=>x.value==='')),true);});
 await unlock(p);
 await check('detached editor cannot submit after lock and unlock',async()=>{await p.evaluate(()=>{oldForm.querySelector('[name=phrase]').value=phrase;oldForm.dispatchEvent(new Event('submit',{cancelable:true}));});assert.equal(await p.evaluate(()=>repo.read().customers[0].revision),2);});
 await check('native write failure preserves records and draft, disables retry',async()=>{await p.getByRole('button',{name:'Edit Synthetic Edited',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Failed');await p.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota injection','QuotaExceededError');};});await save(p);await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Save did not complete'));assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Failed');assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);assert.equal(await p.getByLabel('Test phrase for this local save',{exact:true}).inputValue(),'');assert.equal(await p.evaluate(()=>repo.read().customers[0].revision),2);await p.evaluate(()=>{IDBObjectStore.prototype.put=originalPut;});});
 await check('failed save can inspect fresh encrypted receipts without retry or draft loss',async()=>{
  await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Inspect stored local receipts'}).click();
  await p.getByRole('region',{name:'Stored local receipt report'}).waitFor();
  assert.match(await p.getByRole('region',{name:'Stored local receipt report'}).innerText(),/No receipt for this attempt/);
  assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Failed');assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);
  assert.equal(await p.evaluate(()=>repo.read().pendingOperationCount),3);
  assert.equal(await p.getByLabel('Test phrase for stored inspection',{exact:true}).inputValue(),'');
 });
 await check('incorrect inspection phrase clears input and keeps draft and save barrier',async()=>{
  await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill('incorrect synthetic phrase only');await p.getByRole('button',{name:'Inspect stored local receipts'}).click();
  await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Stored inspection did not complete'));
  assert.equal(await p.getByRole('region',{name:'Stored local receipt report'}).count(),0);assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Failed');
  assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);assert.equal(await p.getByLabel('Test phrase for stored inspection',{exact:true}).inputValue(),'');
 });
 await p.getByRole('button',{name:'Lock local contacts'}).click();await unlock(p);
 await check('text rendering does not interpret contact markup',async()=>{await p.getByRole('button',{name:'Edit Synthetic Edited',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic <img src=x onerror="window.executed=true">');await save(p);await p.waitForFunction(()=>document.querySelector('main').innerText.includes('Revision 3'));assert.equal(await p.locator('main img').count(),0);assert.equal(await p.evaluate(()=>window.executed===true),false);});
 await check('disposal clears DOM and closes the repository',async()=>{await p.evaluate(()=>view.dispose());assert.equal(await p.locator('main').innerText(),'');assert.equal(await p.evaluate(()=>repo.read().status),'closed');});
 await p.evaluate(()=>vault.close());await context.close();await launch();p=await setup();
 await check('browser restart stays locked and retains encrypted edits after unlock',async()=>{assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock(p);assert.equal(await p.locator('[data-customer-id]').count(),2);assert.equal(await p.evaluate(()=>repo.read().customers.find(c=>c.id==='synthetic-1').revision),3);});
 await check('fresh stored inspection detects another session revision without overwriting cached edit',async()=>{
  await p.locator('[data-customer-id="synthetic-1"] button').click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Conflicting Draft');
  await p.evaluate(async()=>{const other=await vault.unlock(phrase);await other.saveCustomer({...input,name:'Synthetic Other Session'},'synthetic-other-session',3,phrase);});
  await save(p);await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Save did not complete'));
  await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Inspect stored local receipts'}).click();
  await p.getByRole('region',{name:'Stored local receipt report'}).waitFor();assert.match(await p.getByRole('region',{name:'Stored local receipt report'}).innerText(),/Stored revision changed to 4/);
  assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Conflicting Draft');assert.equal(await p.evaluate(()=>repo.read().customers.find(c=>c.id==='synthetic-1').revision),3);
  assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);
 });
 await check('explicit comparison shows stored attempted and current draft without a write',async()=>{
  const before=await p.evaluate(()=>raw());await p.getByRole('button',{name:'Review stored record against draft'}).click();
  const review=p.getByRole('region',{name:'Stored customer and draft comparison'});await review.waitFor();
  assert.equal(await review.locator('[data-comparison-field]').count(),5);
  assert.deepEqual(await review.locator('[data-comparison-field=name] dd').allTextContents(),['Synthetic Other Session','Synthetic Conflicting Draft','Synthetic Conflicting Draft']);
  assert.match(await review.locator('[data-comparison-summary]').innerText(),/1 of 5/);assert.match(await review.innerText(),/Draft expects revision 3.*Inspected stored revision 4/);
  assert.equal(await p.evaluate(()=>raw()),before);assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);
 });
 await check('editing draft invalidates comparison and keeps attempted payload separate',async()=>{
  await p.getByLabel('Name',{exact:true}).fill('Synthetic <img src=x onerror="window.executed=true">');await p.getByLabel('Email',{exact:true}).fill('changed@example.invalid');
  assert.equal(await p.getByRole('region',{name:'Stored customer and draft comparison'}).count(),0);assert.match(await p.locator('[data-comparison-notice]').innerText(),/Draft changed/);
  await p.getByRole('button',{name:'Review stored record against draft'}).click();const review=p.getByRole('region',{name:'Stored customer and draft comparison'});
  assert.deepEqual(await review.locator('[data-comparison-field=email] dd').allTextContents(),['test@example.invalid','test@example.invalid','changed@example.invalid']);
  assert.match(await review.locator('[data-comparison-summary]').innerText(),/2 of 5/);assert.equal(await review.locator('img').count(),0);assert.equal(await p.evaluate(()=>window.executed===true),false);
 });
 await check('detached review cannot publish after lock and unlock',async()=>{
  await p.evaluate(()=>{window.detachedReview=document.querySelector('[aria-label="Stored local receipt report"] button');});
  await p.getByRole('button',{name:'Lock local contacts'}).click();await unlock(p);await p.evaluate(()=>detachedReview.click());
  assert.equal(await p.getByRole('region',{name:'Stored customer and draft comparison'}).count(),0);
 });
 await check('new unsaved customer compares against absent storage without inventing blanks',async()=>{
  await p.getByRole('button',{name:'Add synthetic customer'}).click();await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Inspect stored local receipts'}).click();
  await p.getByRole('button',{name:'Review stored record against draft'}).click();const review=p.getByRole('region',{name:'Stored customer and draft comparison'});
  assert.match(await review.innerText(),/No stored record in this inspected snapshot/);
  assert.deepEqual(await review.locator('[data-comparison-field=phone] dd').allTextContents(),['No stored record','No save attempt','(blank)']);
  assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Customer');
 });
 await check('lock removes stored inspection data and draft',async()=>{await p.getByRole('button',{name:'Lock local contacts'}).click();assert.equal(await p.getByRole('region',{name:'Stored local receipt report'}).count(),0);assert.equal(await p.getByLabel('Name',{exact:true}).count(),0);});
 await p.evaluate(async()=>{
  view.dispose();const {createLocalCustomerRepository}=await import('/local-customer-repository.js');const {mountSyntheticCustomerView}=await import('/view.js');
  const wrapped={...vault,unlock:async supplied=>{const session=await vault.unlock(supplied);return {...session,saveCustomer:async(...args)=>{await session.saveCustomer(...args);throw Error('Synthetic post-commit outcome injection');}};}};
  window.repo=createLocalCustomerRepository(wrapped);window.view=mountSyntheticCustomerView(document.querySelector('main'),repo);
 });await unlock(p);
 await check('stored operation identifies committed save despite injected post-commit failure',async()=>{
  await p.getByRole('button',{name:'Edit Synthetic Other Session',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Committed Ambiguous');await save(p);
  await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Save did not complete'));
  await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill('synthetic UI recovery phrase only');await p.getByRole('button',{name:'Inspect stored local receipts'}).click();
  await p.getByRole('region',{name:'Stored local receipt report'}).waitFor();assert.match(await p.getByRole('region',{name:'Stored local receipt report'}).innerText(),/Attempted save receipt is stored at revision 5/);
  assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Committed Ambiguous');assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);
  assert.match(await p.getByRole('region',{name:'Stored local receipt report'}).innerText(),/No server acknowledgement/);
 });
 await check('matching committed values never acknowledge sync or unblock retry',async()=>{
  const before=await p.evaluate(()=>raw());await p.getByRole('button',{name:'Review stored record against draft'}).click();const review=p.getByRole('region',{name:'Stored customer and draft comparison'});
  assert.match(await review.locator('[data-comparison-summary]').innerText(),/0 of 5/);assert.match(await review.innerText(),/not server acknowledgement/);
  assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);assert.equal(await p.evaluate(()=>raw()),before);
 });
 await check('locking during inspection prevents decrypted report publication',async()=>{
  await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill('synthetic UI recovery phrase only');
  await p.evaluate(()=>{const f=document.querySelector('[aria-label="Stored receipt inspection"]');f.dispatchEvent(new Event('submit',{cancelable:true}));repo.lock();});
  await p.waitForTimeout(300);assert.equal(await p.getByRole('region',{name:'Stored local receipt report'}).count(),0);assert.equal(await p.locator('[data-customer-id]').count(),0);
 });
 await check('all requests remained inside synthetic localhost',async()=>assert.deepEqual(remote,[]));
 console.log(JSON.stringify({passed,total:passed,browserVersion:version,nativeIndexedDB:true,nativeWebCrypto:true,syntheticOnly:true,productionActivated:false,iPhoneTested:false}));process.exitCode=0;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});}
