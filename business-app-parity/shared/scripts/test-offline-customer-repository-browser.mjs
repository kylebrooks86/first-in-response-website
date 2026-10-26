/** Real Chromium IndexedDB; disposable account identities and synthetic records only.
 * Does not mount online APIs, activate sync, register a worker, or read customer data.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const entry="import{openOfflineCustomerRepository}from'./lib/offline-customer-repository';window.openLocalCustomerDrafts=openOfflineCustomerRepository;";
const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',tsconfig:resolve('tsconfig.json')});
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else {res.setHeader('content-type','text/html');res.end('<!doctype html><title>Synthetic offline customer repository</title><script type="module" src="/bundle.js"></script>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,count=0;
const check=(v,name)=>{assert.ok(v,name);count++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();const origin='http://127.0.0.1:'+server.address().port;
 const outside=[];await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(outside.push(r.request().url()),r.abort()));
 await page.goto(origin);await page.waitForFunction(()=>Boolean(window.openLocalCustomerDrafts));
 const initial=await page.evaluate(async()=>{
  const open=window.openLocalCustomerDrafts;
  const store=await open({target:'live',accountKey:'synthetic_owner_A1'});
  const record=await store.createCustomer({name:'Synthetic Tulsa Customer',phone:'918 555 0100',address:'123 Test Street, Tulsa'},'synthetic_op_create_001');
  const again=await store.createCustomer({name:'Synthetic Tulsa Customer',phone:'918 555 0100',address:'123 Test Street, Tulsa'},'synthetic_op_create_001');
  const duplicateId=record.id===again.id&&record.revision===again.revision;
  const edited=await store.updateCustomer(record.id,{...record,name:'Synthetic Owasso Customer'},record.revision,'synthetic_op_update_001');
  const againUpdated=await store.updateCustomer(record.id,{...record,name:'Synthetic Owasso Customer'},record.revision,'synthetic_op_update_001');
  let staleRefused=false,changedOperationRefused=false;
  try{await store.updateCustomer(record.id,{...record,name:'Invalid stale edit'},record.revision,'synthetic_op_update_002');}catch{staleRefused=true;}
  try{await store.createCustomer({name:'Different customer'},'synthetic_op_create_001');}catch{changedOperationRefused=true;}
  const rows=await store.listCustomers(),pending=await store.listPending(),exported=await store.exportSnapshot();
  store.close();
  return {duplicateId,editReplay:edited.revision===againUpdated.revision,staleRefused,changedOperationRefused,rows,pending,exported};
 });
 check(initial.duplicateId&&initial.editReplay,'Exact retried operations return stable receipts without duplicating customers or drafts');
 check(initial.staleRefused&&initial.changedOperationRefused,'Concurrent stale revisions and reused IDs with changed input fail closed');
 check(initial.rows.length===1&&initial.rows[0].name==='Synthetic Owasso Customer','Actual edit replaces one customer without losing original identity');
 check(initial.pending.length===2&&initial.pending.every(p=>p.customerId===initial.rows[0].id),'Create and update each have one durable outbox entry');
 check(initial.exported.serverConfirmed===false&&initial.exported.encrypted===false&&initial.exported.pending.length===2&&initial.exported.receipts.length===2,'Consistent export includes unsynced drafts and replay receipts and clearly marks plaintext prototype');
 const restoredContext=await browser.newContext();const restoredPage=await restoredContext.newPage();await restoredPage.goto(origin);await restoredPage.waitForFunction(()=>Boolean(window.openLocalCustomerDrafts));
 const recovered=await restoredPage.evaluate(async snapshot=>{
  const open=window.openLocalCustomerDrafts,store=await open({target:'live',accountKey:'synthetic_owner_A1'});
  const result=await store.restoreSnapshot(snapshot),customers=await store.listCustomers(),pending=await store.listPending();
  const replay=await store.createCustomer({name:'Synthetic Tulsa Customer',phone:'918 555 0100',address:'123 Test Street, Tulsa'},'synthetic_op_create_001');
  const again=await store.updateCustomer(replay.id,{...replay,name:'Synthetic Owasso Customer'},replay.revision,'synthetic_op_update_001');
  let duplicateDenied=false;try{await store.restoreSnapshot(snapshot);}catch{duplicateDenied=true;}
  store.close();
  const other=await open({target:'qa',accountKey:'synthetic_owner_A1'});
  let crossTargetDenied=false;try{await other.restoreSnapshot(snapshot);}catch{crossTargetDenied=true;}
  const otherRows=await other.listCustomers();other.close();
  return {result,customers,pending,replay,again,duplicateDenied,crossTargetDenied,otherRows};
 },initial.exported);
 check(recovered.result.customers===1&&recovered.result.pending===2&&recovered.customers[0].revision===initial.rows[0].revision,'Clean browser profile restores exact customer revision and both unsynced operations');
 check(recovered.replay.id===initial.rows[0].id&&recovered.again.revision===initial.rows[0].revision&&recovered.pending.length===2,'Restored receipts preserve stable retry semantics without duplicate pending writes');
 check(recovered.duplicateDenied&&recovered.crossTargetDenied&&recovered.otherRows.length===0,'Restore refuses nonempty database and wrong target identity without changing records');
 const rejected=await restoredPage.evaluate(async snapshot=>{
  const repo=await window.openLocalCustomerDrafts({target:'live',accountKey:'synthetic_owner_C3'});let corrupt=false;
  const invalid=structuredClone(snapshot);invalid.namespace=repo.namespace;invalid.pending[0].customerId='synthetic_broken_other';
  try{await repo.restoreSnapshot(invalid);}catch{corrupt=true;}
  const empty=(await repo.listCustomers()).length===0&&(await repo.listPending()).length===0;repo.close();return {corrupt,empty};
 },initial.exported);
 check(rejected.corrupt&&rejected.empty,'Corrupted pending operation fails validation before any IndexedDB write');
 const rollback=await restoredPage.evaluate(async snapshot=>{
  const repo=await window.openLocalCustomerDrafts({target:'live',accountKey:'synthetic_owner_D4'});
  const translated=structuredClone(snapshot);translated.namespace=repo.namespace;
  const original=IDBObjectStore.prototype.add;let interrupted=false;
  IDBObjectStore.prototype.add=function(row,...args){if(this.name==='outbox')throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,row,...args);};
  try{await repo.restoreSnapshot(translated);}catch{interrupted=true;}finally{IDBObjectStore.prototype.add=original;}
  const unchanged=(await repo.listCustomers()).length===0&&(await repo.listPending()).length===0;repo.close();return{interrupted,unchanged};
 },initial.exported);
 check(rollback.interrupted&&rollback.unchanged,'Injected restore quota failure atomically rolls back imported customers, receipts and outbox');
 await restoredContext.close();
 await page.reload();await page.waitForFunction(()=>Boolean(window.openLocalCustomerDrafts));
 const reopened=await page.evaluate(async()=>{
  const open=window.openLocalCustomerDrafts;
  const a=await open({target:'live',accountKey:'synthetic_owner_A1'});
  const keep=await a.listCustomers(),pending=await a.listPending();
  const b=await open({target:'staging',accountKey:'synthetic_owner_A1'});
  const c=await open({target:'live',accountKey:'synthetic_owner_B2'});
  const isolated=(await b.listCustomers()).length===0&&(await c.listCustomers()).length===0&&(await b.listPending()).length===0&&(await c.listPending()).length===0;
  a.close();b.close();c.close();
  return {keep,pending,isolated};
 });
 check(reopened.keep.length===1&&reopened.pending.length===2&&reopened.keep[0].id===initial.rows[0].id,'Full Chromium reload retains committed local customer and pending operations');
 check(reopened.isolated,'Different target or account namespaces cannot access the original store');
 const failure=await page.evaluate(async()=>{
  const db=await window.openLocalCustomerDrafts({target:'live',accountKey:'synthetic_owner_A1'});
  const before=await db.exportSnapshot();
  const original=IDBObjectStore.prototype.add;let interrupted=false;
  IDBObjectStore.prototype.add=function(v,...args){if(this.name==='outbox'){throw new DOMException('Synthetic quota error','QuotaExceededError');}return original.call(this,v,...args);};
  try{await db.createCustomer({name:'Synthetic denied write'},'synthetic_op_denied_001');}catch{interrupted=true;}
  finally{IDBObjectStore.prototype.add=original;}
  const after=await db.exportSnapshot();
  db.close();return{interrupted,stable:JSON.stringify(before)===JSON.stringify(after)};
 });
 check(failure.interrupted&&failure.stable,'Injected outbox quota failure aborts entire transaction and preserves prior customers and receipts');
 const concurrent=await page.evaluate(async()=>{
  const owner={target:'qa',accountKey:'synthetic_owner_A1'};
  const a=await window.openLocalCustomerDrafts(owner),b=await window.openLocalCustomerDrafts(owner);
  const answers=await Promise.all([a.createCustomer({name:'Synthetic double-tap'},'synthetic_op_double_001'),b.createCustomer({name:'Synthetic double-tap'},'synthetic_op_double_001')]);
  const list=await a.listCustomers(),pending=await b.listPending();a.close();b.close();
  return {sameId:answers[0].id===answers[1].id,customers:list.length,pending:pending.length};
 });
 check(concurrent.sameId&&concurrent.customers===1&&concurrent.pending===1,'Concurrent IndexedDB windows serialize the same operation once');
 const invalid=await page.evaluate(async()=>{
  let rejected=0;for(const input of [{target:'live',accountKey:'a'},{target:'invalid',accountKey:'synthetic_owner_A1'}])try{await window.openLocalCustomerDrafts(input)}catch{rejected++;}
  return rejected;
 });
 check(invalid===2,'Missing/invalid account or target identities are rejected before opening stores');
 check(outside.length===0,'No external network requests or server writes');
 console.log('PASS '+count+' synthetic real-Chromium IndexedDB customer-repository checks: reload, namespace isolation, concurrent double-taps and atomic quota rollback. No app activation.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
