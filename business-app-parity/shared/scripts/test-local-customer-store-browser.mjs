// Real Chromium IndexedDB integration; synthetic disposable profile, localhost only.
// Optional FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE and FIRE_BROWSER_TEST_EXECUTABLE select local tools.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE || 'playwright');
const source=readFileSync(new URL('../lib/local-customer-store.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const server=createServer((req,res)=>{
  if(req.url==='/store.js'){res.setHeader('Content-Type','application/javascript');res.end(js);}
  else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Synthetic storage test</title>');}
  else {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const profile=mkdtempSync(join(tmpdir(),'fire-customer-idb-'));
let context,passed=0;const remoteRequests=[];
async function launch(){
  context=await chromium.launchPersistentContext(profile,{
    executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE || undefined,
    headless:true,args:['--no-sandbox','--disable-gpu'],
  });
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){remoteRequests.push(route.request().url());return route.abort();}
    return route.continue();
  });
}
async function page(){
  const p=await context.newPage();await p.goto(origin);
  await p.evaluate(async()=>{
    window.api=await import('/store.js');
    window.customer={id:'synthetic-1',name:'Synthetic Customer',email:'test@example.invalid',phone:'',address:'Synthetic',leadSource:'test'};
    window.store=await api.openLocalCustomerStore('synthetic-owner','synthetic-target');
  });return p;
}
async function check(name,fn){await fn();passed++;console.log(`PASS: ${name}`);}
try{
  await launch();let p=await page();
  const version=context.browser()?.version() ?? await p.evaluate(()=>navigator.userAgent);
  await check('real transaction saves customer plus operation',async()=>{
    const s=await p.evaluate(async()=>{await store.save(customer,'create',0);return store.exportSnapshot();});
    assert.equal(s.customers[0].revision,1);assert.equal(s.pendingOperations.length,1);
  });
  await check('exact duplicate retry is idempotent',async()=>{
    const s=await p.evaluate(async()=>{await store.save(customer,'create',0);return store.exportSnapshot();});assert.equal(s.pendingOperations.length,1);
  });
  await check('different payload cannot reuse operation ID',async()=>{
    const error=await p.evaluate(async()=>{try{await store.save({...customer,name:'Wrong'},'create',0);}catch(e){return e.message;}});assert.match(error,/different change/);
  });
  await check('native abort after record request success rolls back both stores',async()=>{
    const result=await p.evaluate(async()=>{
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...args){const request=original.apply(this,args);if(this.name==='customers')request.addEventListener('success',()=>request.transaction.abort());return request;};
      let rejected=false;try{await store.save({...customer,name:'Interrupted'},'interrupted',1);}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}
      return {rejected,snapshot:await store.exportSnapshot()};
    });assert.equal(result.rejected,true);assert.equal(result.snapshot.customers[0].revision,1);assert.equal(result.snapshot.pendingOperations.length,1);
  });
  await check('injected quota exception aborts a real native transaction',async()=>{
    const result=await p.evaluate(async()=>{
      const original=IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add=function(...args){if(this.name==='operations')throw new DOMException('Synthetic quota fault','QuotaExceededError');return original.apply(this,args);};
      let error;try{await store.save({...customer,name:'Quota'},'quota',1);}catch(e){error=e.name;}finally{IDBObjectStore.prototype.add=original;}
      return {error,snapshot:await store.exportSnapshot()};
    });assert.equal(result.error,'QuotaExceededError');assert.equal(result.snapshot.customers[0].revision,1);assert.equal(result.snapshot.pendingOperations.length,1);
  });
  await check('retry after interruption commits once',async()=>{
    const s=await p.evaluate(async()=>{await store.save({...customer,name:'Recovered'},'interrupted',1);return store.exportSnapshot();});assert.equal(s.customers[0].revision,2);assert.equal(s.pendingOperations.length,2);
  });
  const other=await page();
  await check('two tabs serialize edits and reject stale revision',async()=>{
    const results=await Promise.all([p,other].map((tab,i)=>tab.evaluate(async i=>{try{await store.save({...customer,name:`Winner ${i}`},`race-${i}`,2);return 'saved';}catch(e){return e.message;}},i)));
    assert.equal(results.filter(x=>x==='saved').length,1);assert.equal(results.filter(x=>/latest local revision/.test(x)).length,1);
    assert.equal((await p.evaluate(()=>store.exportSnapshot())).customers[0].revision,3);
  });
  await check('account and target stores remain isolated',async()=>{
    assert.deepEqual(await p.evaluate(async()=>{
      const counts=[];for(const [a,t] of [['different-owner','synthetic-target'],['synthetic-owner','different-target']]){
        const isolated=await api.openLocalCustomerStore(a,t);counts.push((await isolated.exportSnapshot()).customers.length);isolated.close();
      }return counts;
    }),[0,0]);
  });
  await check('detached export cannot mutate native stored records',async()=>{
    assert.notEqual(await p.evaluate(async()=>{const s=await store.exportSnapshot();s.customers[0].name='Tampered';return (await store.exportSnapshot()).customers[0].name;}),'Tampered');
  });
  await check('caller mutation cannot alter a scheduled transaction',async()=>{
    assert.equal(await p.evaluate(async()=>{const input={...customer,id:'synthetic-2'};const saved=store.save(input,'second',0);input.name='Changed';return (await saved).name;}),'Synthetic Customer');
  });
  await check('records remain readable and editable with browser network offline',async()=>{
    await context.setOffline(true);
    const s=await p.evaluate(async()=>{await store.save({...customer,id:'offline-created'},'offline',0);return store.exportSnapshot();});assert.equal(s.customers.length,3);
    await context.setOffline(false);
  });
  // Close the entire browser process, retain its on-disk profile, then relaunch.
  await context.close();context=null;await launch();p=await page();
  await check('browser process restart preserves committed data and operation history',async()=>{
    const s=await p.evaluate(()=>store.exportSnapshot());assert.equal(s.customers.length,3);assert.equal(s.pendingOperations.length,5);assert.equal(s.customers.find(c=>c.id==='synthetic-1').revision,3);
  });
  await check('old exact retry after restart never rewinds later edits',async()=>{
    const result=await p.evaluate(async()=>{const receipt=await store.save(customer,'create',0);return {receipt,current:await store.exportSnapshot()};});assert.equal(result.receipt.revision,1);assert.equal(result.current.customers.find(c=>c.id==='synthetic-1').revision,3);
  });
  await check('version change closes connection and future schema is refused',async()=>{
    const result=await p.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(store.namespace,2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
      let closed=false,newer;try{await store.save(customer,'closed',3);}catch(e){closed=e.name==='InvalidStateError';}
      try{await api.openLocalCustomerStore('synthetic-owner','synthetic-target');}catch(e){newer=e.name;}
      return {closed,newer};
    });assert.equal(result.closed,true);assert.equal(result.newer,'VersionError');
  });
  await check('no external application, database or Stripe network requests',async()=>assert.deepEqual(remoteRequests,[]));
  console.log(JSON.stringify({passed,total:passed,browser:version,realIndexedDB:true,syntheticOnly:true,quotaFaultInjected:true,physicalQuotaExhaustionTested:false,appOfflineColdLaunchTested:false,iPhoneTested:false}));
}finally{
  await context?.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});
}
