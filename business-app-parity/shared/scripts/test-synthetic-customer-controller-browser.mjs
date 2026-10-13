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
modules.set('/view.js',ts.transpileModule(readFileSync(new URL('../components/local-customer-view.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'../lib/local-customer-backup'","'/local-customer-backup.js'"));
let controllerJS=ts.transpileModule(readFileSync(new URL('../lib/synthetic-customer-controller.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
for(const name of ['store','vault','repository'])controllerJS=controllerJS.replaceAll(`'./local-customer-${name}'`,`'/local-customer-${name}.js'`);
controllerJS=controllerJS.replaceAll("'../components/local-customer-view'","'/view.js'");modules.set('/controller.js',controllerJS);
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
async function setup(){const p=await context.newPage();await p.goto(origin);await p.evaluate(async()=>{
 window.vaultAPI=await import('/local-customer-vault.js');window.controllerAPI=await import('/controller.js');
 window.phrase='synthetic controller recovery phrase only';
 for(const account of ['synthetic-A','synthetic-B']){
  const v=await vaultAPI.openLocalCustomerVault(account,'synthetic-target');
  const input={id:'synthetic-1',name:'Synthetic '+account,email:'test@example.invalid',phone:'',address:'Synthetic',leadSource:'Synthetic'};
  const customer={...input,revision:1,updatedAt:'2026-10-13T00:00:00.000Z'};
  if(!await v.hasStoredSnapshot())await v.initialize({format:'fire-local-customers',version:1,namespace:'fire-local-customers:v1:'+account+':synthetic-target',customers:[customer],pendingOperations:[{id:'synthetic-create',kind:'customer-upsert',expectedRevision:0,input,customer}]},phrase);v.close();
 }
 window.identity=null;window.identityThrows=false;
 window.controller=controllerAPI.createSyntheticCustomerController(document.querySelector('main'),{targetId:'synthetic-target',readIdentity:()=>{if(identityThrows)throw Error('Private auth failure');return identity;},idleMs:60000});
 });return p;}
async function check(name,fn){await fn();passed++;console.log('PASS: '+name);}
async function unlock(p){await p.getByLabel('Test recovery phrase',{exact:true}).fill('synthetic controller recovery phrase only');await p.getByRole('button',{name:'Unlock local contacts'}).click();await p.waitForFunction(()=>document.querySelector('main').dataset.localCustomerState==='ready');}
async function activate(p,account='synthetic-A'){assert.equal(await p.evaluate(async account=>{identity={accountId:account,targetId:'synthetic-target'};return controller.activate();},account),true);}
process.exitCode=1;
try{
 await launch();const p=await setup();const version=context.browser().version();
 await check('missing identity refuses activation without creating a database',async()=>{const before=await p.evaluate(()=>indexedDB.databases());assert.equal(await p.evaluate(()=>controller.activate()),false);assert.deepEqual(await p.evaluate(()=>indexedDB.databases()),before);assert.equal(await p.locator('input').count(),0);});
 await check('wrong target refuses activation without creating a vault',async()=>{const before=await p.evaluate(()=>indexedDB.databases());assert.equal(await p.evaluate(()=>{identity={accountId:'synthetic-A',targetId:'different-target'};return controller.activate();}),false);assert.deepEqual(await p.evaluate(()=>indexedDB.databases()),before);});
 await check('invalid account and resolver errors fail closed',async()=>{assert.equal(await p.evaluate(()=>{identity={accountId:'owner@example.com',targetId:'synthetic-target'};return controller.activate();}),false);assert.equal(await p.evaluate(()=>{identityThrows=true;return controller.activate();}),false);assert.ok(!(await p.locator('main').innerText()).includes('Private auth failure'));await p.evaluate(()=>identityThrows=false);});
 await check('verified supplied identity mounts locked, never auto-unlocks',async()=>{await activate(p);assert.equal(await p.locator('[data-customer-id]').count(),0);assert.match(await p.locator('main').innerText(),/locked does not mean empty/);});
 await unlock(p);
 await check('account A reads only account A fixture',async()=>{const text=await p.locator('main').innerText();assert.ok(text.includes('Synthetic synthetic-A'));assert.ok(!text.includes('Synthetic synthetic-B'));});
 await check('identity switch during portable export suppresses the late download',async()=>{
  const downloads=[];const listener=d=>downloads.push(d);p.on('download',listener);
  await p.getByLabel('Test phrase for portable backup',{exact:true}).fill('synthetic controller recovery phrase only');
  await p.evaluate(()=>{document.querySelector('[aria-label="Export portable backup"]').dispatchEvent(new Event('submit',{cancelable:true}));identity={accountId:'synthetic-B',targetId:'synthetic-target'};});
  await p.waitForFunction(()=>!document.querySelector('input'));assert.deepEqual(downloads,[]);p.off('download',listener);await activate(p);await unlock(p);
 });
 await check('identity switch during portable verification suppresses the late report',async()=>{
  const buffer=await p.evaluate(async()=>{const v=await vaultAPI.openLocalCustomerVault('synthetic-A','synthetic-target');try{return JSON.stringify(await (await v.unlock(phrase)).exportPortableBundle(phrase));}finally{v.close();}});
  // The extra handle closes with a namespace lock; deliberately reopen the UI before verification.
  await activate(p);await unlock(p);
  await p.getByLabel('Portable encrypted JSON file',{exact:true}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(buffer)});
  await p.getByLabel('Test phrase for portable file verification',{exact:true}).fill('synthetic controller recovery phrase only');
  await p.evaluate(()=>{document.querySelector('[aria-label="Verify portable backup"]').dispatchEvent(new Event('submit',{cancelable:true}));identity={accountId:'synthetic-B',targetId:'synthetic-target'};});
  await p.waitForFunction(()=>!document.querySelector('input'));assert.ok(!(await p.locator('main').innerText()).includes('Verified portable bundle'));await activate(p);await unlock(p);
 });
 await check('logout refresh immediately wipes drafts and plaintext',async()=>{await p.getByRole('button',{name:'Edit Synthetic synthetic-A'}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Secret Draft');await p.evaluate(()=>{window.detached=document.querySelector('[name=name]');identity=null;controller.refreshIdentity();});assert.equal(await p.evaluate(()=>detached.value),'');assert.equal(await p.locator('input').count(),0);assert.ok(!(await p.locator('main').innerText()).includes('Secret Draft'));});
 await check('account switch opens a separate locked vault',async()=>{await activate(p,'synthetic-B');assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock(p);assert.ok((await p.locator('main').innerText()).includes('Synthetic synthetic-B'));assert.ok(!(await p.locator('main').innerText()).includes('Synthetic synthetic-A'));});
 await check('identity change before save rejects old form without writing either vault',async()=>{await p.getByRole('button',{name:'Edit Synthetic synthetic-B'}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Must Not Save');await p.getByLabel('Test phrase for this local save',{exact:true}).fill('synthetic controller recovery phrase only');await p.evaluate(()=>{identity={accountId:'synthetic-A',targetId:'synthetic-target'};document.querySelector('[aria-label="Local customer editor"]').dispatchEvent(new Event('submit',{cancelable:true}));});await p.waitForFunction(()=>!document.querySelector('input'));const result=await p.evaluate(async()=>{const v=await vaultAPI.openLocalCustomerVault('synthetic-B','synthetic-target');const s=await v.unlock(phrase);const a=s.exportSnapshot();v.close();return a;});assert.equal(result.customers[0].revision,1);assert.equal(result.pendingOperations.length,1);});
 await check('latest activation wins when vault opens overlap',async()=>{assert.equal(await p.evaluate(async()=>{identity={accountId:'synthetic-A',targetId:'synthetic-target'};const a=controller.activate();identity={accountId:'synthetic-B',targetId:'synthetic-target'};const b=controller.activate();return !(await a)&&(await b);}),true);await unlock(p);assert.ok((await p.locator('main').innerText()).includes('Synthetic synthetic-B'));});
 await check('reactivation of an active identity resets to locked without losing records',async()=>{assert.equal(await p.evaluate(()=>controller.activate()),true);assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock(p);assert.ok((await p.locator('main').innerText()).includes('Synthetic synthetic-B'));});
 await check('identity lost while opening cannot mount a late view',async()=>{assert.equal(await p.evaluate(async()=>{const pending=controller.activate();identity=null;return !(await pending);}),true);assert.match(await p.locator('main').innerText(),/Access changed/);assert.equal(await p.locator('input').count(),0);await activate(p,'synthetic-B');await unlock(p);});
 await check('logout during decryption never publishes late plaintext',async()=>{await p.getByRole('button',{name:'Lock local contacts'}).click();await p.getByLabel('Test recovery phrase',{exact:true}).fill('synthetic controller recovery phrase only');await p.evaluate(()=>{document.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));identity=null;controller.refreshIdentity();});await p.waitForFunction(()=>!document.querySelector('input'));assert.equal(await p.locator('[data-customer-id]').count(),0);await activate(p,'synthetic-B');await unlock(p);});
 await check('page exit locks and return never auto-unlocks',async()=>{await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.waitForFunction(()=>document.querySelector('main').dataset.localCustomerState==='locked');await p.evaluate(()=>dispatchEvent(new Event('pageshow')));assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock(p);});
 await check('target change revokes existing session on identity refresh',async()=>{await p.evaluate(()=>{identity.targetId='different-target';controller.refreshIdentity();});assert.equal(await p.locator('[data-customer-id]').count(),0);assert.equal(await p.locator('input').count(),0);});
 await check('idle policy locks mounted UI',async()=>{await p.evaluate(()=>{controller.dispose();controller=controllerAPI.createSyntheticCustomerController(document.querySelector('main'),{targetId:'synthetic-target',readIdentity:()=>identity,idleMs:1500});});await activate(p);await unlock(p);await p.waitForFunction(()=>document.querySelector('main').dataset.localCustomerState==='locked');assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await check('disposal during pending activation cannot remount late UI',async()=>{assert.equal(await p.evaluate(async()=>{const pending=controller.activate();controller.dispose();return !(await pending);}),true);assert.equal(await p.locator('main').innerText(),'');});
 await check('closed controller refuses activation',async()=>assert.equal(await p.evaluate(async()=>{try{await controller.activate();return false;}catch{return true;}}),true));
 await check('no external network requests',async()=>assert.deepEqual(remote,[]));
 console.log(JSON.stringify({passed,total:passed,browserVersion:version,nativeIndexedDB:true,nativeWebCrypto:true,syntheticOnly:true,serverAuthenticationVerified:false,productionActivated:false}));process.exitCode=0;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});}
