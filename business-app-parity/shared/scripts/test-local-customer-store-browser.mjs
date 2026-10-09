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
  await check('read by ID returns latest revision; missing ID is explicitly null',async()=>{
    const result=await p.evaluate(async()=>({found:await store.getCustomer('synthetic-1'),missing:await store.getCustomer('missing')}));
    assert.equal(result.found.revision,3);assert.equal(result.missing,null);
  });
  await check('list is complete and detached from persisted records',async()=>{
    const result=await p.evaluate(async()=>{const rows=await store.listCustomers();rows[0].name='Mutation';return {count:rows.length,stored:await store.listCustomers()};});
    assert.equal(result.count,3);assert.ok(result.stored.every(r=>r.name!=='Mutation'));
  });
  await check('retrieval is account and target isolated',async()=>{
    assert.deepEqual(await p.evaluate(async()=>{const other=await api.openLocalCustomerStore('other-owner','synthetic-target');const result=[await other.getCustomer('synthetic-1'),(await other.listCustomers()).length];other.close();return result;}),[null,0]);
  });
  await check('retrieval works with browser networking offline',async()=>{
    await context.setOffline(true);assert.equal(await p.evaluate(async()=> (await store.getCustomer('offline-created')).name),'Synthetic Customer');assert.equal(await p.evaluate(async()=> (await store.listCustomers()).length),3);await context.setOffline(false);
  });
  await check('native read abort rejects rather than returning missing/zero data',async()=>{
    const result=await p.evaluate(async()=>{const original=IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.get=function(...args){const req=original.apply(this,args);req.addEventListener('success',()=>req.transaction.abort());return req;};
      try{await store.getCustomer('synthetic-1');return false;}catch{return true;}finally{IDBObjectStore.prototype.get=original;}
    });assert.equal(result,true);
  });
  await check('native list abort rejects and preserves data',async()=>{
    const result=await p.evaluate(async()=>{const original=IDBObjectStore.prototype.getAll;
      IDBObjectStore.prototype.getAll=function(...args){const req=original.apply(this,args);req.addEventListener('success',()=>req.transaction.abort());return req;};
      try{await store.listCustomers();return false;}catch{return true;}finally{IDBObjectStore.prototype.getAll=original;}
    });assert.equal(result,true);assert.equal(await p.evaluate(async()=> (await store.listCustomers()).length),3);
  });
  await check('repeated valid preflight is detached and does not change native records',async()=>{
    const result=await p.evaluate(async()=>{const before=await store.exportSnapshot();const one=api.validateLocalCustomerExport(before,store.namespace);const two=api.validateLocalCustomerExport(before,store.namespace);one.customers[0].name='Changed';return {same:JSON.stringify(two)===JSON.stringify(before),unchanged:JSON.stringify(await store.exportSnapshot())===JSON.stringify(before)};});assert.deepEqual(result,{same:true,unchanged:true});
  });
  const invalidFixtures=[
    ['null root',v=>null],['wrong format',v=>({...v,format:'production'})],['future version',v=>({...v,version:2})],
    ['string version',v=>({...v,version:'1'})],['other namespace',v=>({...v,namespace:'fire-local-customers:v1:other:target'})],
    ['unknown root field',v=>({...v,secret:'no'})],['missing collection',v=>{delete v.customers;return v;}],
    ['malformed customers',v=>({...v,customers:{}})],['malformed operations',v=>({...v,pendingOperations:null})],
    ['duplicate customers',v=>({...v,customers:[...v.customers,v.customers[0]]})],
    ['duplicate operations',v=>({...v,pendingOperations:[...v.pendingOperations,v.pendingOperations[0]]})],
    ['bad customer ID',v=>{v.customers[0].id='bad:id';return v;}],['empty name',v=>{v.customers[0].name='';return v;}],
    ['unknown customer field',v=>{v.customers[0].unexpected=true;return v;}],['missing customer field',v=>{delete v.customers[0].email;return v;}],
    ['zero revision',v=>{v.customers[0].revision=0;return v;}],['fractional revision',v=>{v.customers[0].revision=1.5;return v;}],
    ['unsafe revision',v=>{v.customers[0].revision=Number.MAX_SAFE_INTEGER+1;return v;}],
    ['bad timestamp',v=>{v.customers[0].updatedAt='yesterday';return v;}],['unknown operation field',v=>{v.pendingOperations[0].extra=1;return v;}],
    ['bad operation ID',v=>{v.pendingOperations[0].id='';return v;}],['financial operation forbidden',v=>{v.pendingOperations[0].kind='stripe-refund';return v;}],
    ['negative expected revision',v=>{v.pendingOperations[0].expectedRevision=-1;return v;}],
    ['wrong expected revision',v=>{v.pendingOperations[0].expectedRevision=500;return v;}],
    ['missing customer relationship',v=>{v.customers=v.customers.slice(1);return v;}],
    ['mismatched operation input',v=>{v.pendingOperations[0].input.name='Wrong';return v;}],
    ['extra operation input field',v=>{v.pendingOperations[0].input.extra=1;return v;}],
    ['missing history',v=>{v.pendingOperations.pop();return v;}],
    ['duplicate history revision',v=>{const op=structuredClone(v.pendingOperations[0]);op.id='duplicate-revision';v.pendingOperations.push(op);return v;}],
    ['current/history payload mismatch',v=>{v.customers[0].name='Wrong';return v;}],
    ['oversized customers',v=>({...v,customers:Array(10001).fill(v.customers[0])})],
  ];
  for(const [name,mutate] of invalidFixtures){
    await check(`backup rejects ${name} without writes`,async()=>{
      const backup=await p.evaluate(()=>store.exportSnapshot());const bad=mutate(structuredClone(backup));
      const result=await p.evaluate(async bad=>{const before=await store.exportSnapshot();let rejected=false;try{api.validateLocalCustomerExport(bad,store.namespace);}catch{rejected=true;}return {rejected,unchanged:JSON.stringify(await store.exportSnapshot())===JSON.stringify(before)};},bad);assert.deepEqual(result,{rejected:true,unchanged:true});
    });
  }
  await check('empty same-namespace backup is valid but has no restoration side effects',async()=>{
    const result=await p.evaluate(async()=>{const empty=api.validateLocalCustomerExport({format:'fire-local-customers',version:1,namespace:store.namespace,customers:[],pendingOperations:[]},store.namespace);return {empty:empty.customers.length,current:(await store.listCustomers()).length};});assert.deepEqual(result,{empty:0,current:3});
  });
  await check('invalid read ID rejects before touching native records',async()=>{
    assert.equal(await p.evaluate(()=>{try{store.getCustomer('bad:id');return false;}catch{return true;}}),true);
  });
  await check('malformed native row fails closed during retrieval',async()=>{
    const result=await p.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(store.namespace,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('customers','readwrite');tx.objectStore('customers').put({id:'corrupt-row',name:'Bad'});tx.oncomplete=resolve;tx.onabort=reject;});db.close();
      let get=false,list=false;try{await store.getCustomer('corrupt-row');}catch{get=true;}try{await store.listCustomers();}catch{list=true;}return {get,list};
    });assert.deepEqual(result,{get:true,list:true});
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
