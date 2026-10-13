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
 await check('already loaded UI saves edit offline and displays committed revision',async()=>{await context.setOffline(true);await p.getByLabel('Name',{exact:true}).fill('Synthetic Edited');await save(p);await p.waitForFunction(()=>document.querySelector('main').innerText.includes('Revision 2'));assert.match(await p.locator('[data-save-status]').innerText(),/Saved locally/);assert.equal(await p.locator('input[type=password]').count(),0);await context.setOffline(false);});
 await check('create appends a synthetic contact with its local receipt',async()=>{await p.getByRole('button',{name:'Add synthetic customer'}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic New');await save(p);await p.waitForFunction(()=>document.querySelectorAll('[data-customer-id]').length===2);assert.equal(await p.evaluate(()=>repo.read().pendingOperationCount),3);});
 await check('lock clears visible contact data and detached input values',async()=>{await p.getByRole('button',{name:'Edit Synthetic Edited',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Unsaved');await p.evaluate(()=>{window.oldForm=document.querySelector('[aria-label="Local customer editor"]');window.oldInputs=[...oldForm.querySelectorAll('input')];});await p.getByRole('button',{name:'Lock local contacts'}).click();assert.equal(await p.locator('[data-customer-id]').count(),0);assert.equal(await p.evaluate(()=>oldInputs.every(x=>x.value==='')),true);});
 await unlock(p);
 await check('detached editor cannot submit after lock and unlock',async()=>{await p.evaluate(()=>{oldForm.querySelector('[name=phrase]').value=phrase;oldForm.dispatchEvent(new Event('submit',{cancelable:true}));});assert.equal(await p.evaluate(()=>repo.read().customers[0].revision),2);});
 await check('native write failure preserves records and draft, disables retry',async()=>{await p.getByRole('button',{name:'Edit Synthetic Edited',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Failed');await p.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota injection','QuotaExceededError');};});await save(p);await p.waitForFunction(()=>document.querySelector('[data-save-status]').textContent.includes('Save did not complete'));assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Failed');assert.equal(await p.getByRole('button',{name:'Save locally',exact:true}).isDisabled(),true);assert.equal(await p.getByLabel('Test phrase for this local save',{exact:true}).inputValue(),'');assert.equal(await p.evaluate(()=>repo.read().customers[0].revision),2);await p.evaluate(()=>{IDBObjectStore.prototype.put=originalPut;});});
 await p.getByRole('button',{name:'Lock local contacts'}).click();await unlock(p);
 await check('text rendering does not interpret contact markup',async()=>{await p.getByRole('button',{name:'Edit Synthetic Edited',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic <img src=x onerror="window.executed=true">');await save(p);await p.waitForFunction(()=>document.querySelector('main').innerText.includes('Revision 3'));assert.equal(await p.locator('main img').count(),0);assert.equal(await p.evaluate(()=>window.executed===true),false);});
 await check('disposal clears DOM and closes the repository',async()=>{await p.evaluate(()=>view.dispose());assert.equal(await p.locator('main').innerText(),'');assert.equal(await p.evaluate(()=>repo.read().status),'closed');});
 await p.evaluate(()=>vault.close());await context.close();await launch();p=await setup();
 await check('browser restart stays locked and retains encrypted edits after unlock',async()=>{assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock(p);assert.equal(await p.locator('[data-customer-id]').count(),2);assert.equal(await p.evaluate(()=>repo.read().customers.find(c=>c.id==='synthetic-1').revision),3);});
 await check('all requests remained inside synthetic localhost',async()=>assert.deepEqual(remote,[]));
 console.log(JSON.stringify({passed,total:passed,browserVersion:version,nativeIndexedDB:true,nativeWebCrypto:true,syntheticOnly:true,productionActivated:false,iPhoneTested:false}));process.exitCode=0;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});}
