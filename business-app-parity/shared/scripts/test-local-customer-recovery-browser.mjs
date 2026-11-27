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
const modules = new Map();
for (const [url, file] of [['/store.js','local-customer-store'],['/backup.js','local-customer-backup']]) {
  const source=readFileSync(new URL(`../lib/${file}.ts`,import.meta.url),'utf8');
  modules.set(url,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'./local-customer-store'", "'/store.js'"));
}
const server=createServer((req,res)=>{
  if(modules.has(req.url)){res.setHeader('Content-Type','application/javascript');res.end(modules.get(req.url));}
  else if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Synthetic encrypted recovery test</title>');}
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
    window.api=await import('/store.js'); window.backups=await import('/backup.js'); window.phrase='synthetic browser recovery phrase only';
    window.customer={id:'synthetic-1',name:'Synthetic Customer',email:'test@example.invalid',phone:'',address:'Synthetic',leadSource:'test'};
    window.store=await api.openLocalCustomerStore('synthetic-owner','synthetic-target');
  });return p;
}
async function check(name,fn){await fn();passed++;console.log(`PASS: ${name}`);}
process.exitCode = 1; // Fail closed if the runner exits before the completion summary.
try {
  await launch(); let p=await page();
  const version=context.browser()?.version() ?? await p.evaluate(()=>navigator.userAgent);
  const fixture=await p.evaluate(async()=>{
    await store.save(customer,'baseline',0);const baseline=await store.exportSnapshot();
    await store.save({...customer,id:'recover-2'},'recovery-create',0);
    await store.save({...customer,id:'recover-2',name:'Recovered latest'},'recovery-edit',1);
    await store.save({...customer,id:'recover-3'},'recovery-third',0);
    const archive=await store.exportSnapshot();
    const envelope=await backups.protectLocalCustomerBackup(archive,store.namespace,phrase);
    store.close();await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(baseline.namespace);req.onsuccess=resolve;req.onerror=()=>reject(req.error);});
    window.store=await api.openLocalCustomerStore('synthetic-owner','synthetic-target');await store.restoreSnapshot(baseline);
    return {baseline,archive,envelope};
  });
  await check('native browser crypto protects customer archive without plaintext fields',async()=>{
    const text=JSON.stringify(fixture.envelope);assert.ok(!text.includes('Synthetic Customer'));assert.ok(!text.includes('test@example.invalid'));assert.ok(!text.includes(fixture.archive.namespace));
  });
  await check('native browser decrypts exact full revision history',async()=>assert.deepEqual(await p.evaluate(envelope=>backups.recoverLocalCustomerBackup(envelope,store.namespace,phrase),fixture.envelope),fixture.archive));
  async function failureCase(name,envelope,wrongPhrase=false,wrongNamespace=false){
    await check(name,async()=>{
      const result=await p.evaluate(async({envelope,wrongPhrase,wrongNamespace})=>{
        const before=await store.exportSnapshot();const original=IDBObjectStore.prototype.add;let writes=0;
        IDBObjectStore.prototype.add=function(...args){writes++;return original.apply(this,args);};
        let rejected=false;
        try { const recovered=await backups.recoverLocalCustomerBackup(envelope,wrongNamespace?'fire-local-customers:v1:wrong:target':store.namespace,wrongPhrase?'incorrect recovery phrase only':phrase);await store.restoreSnapshot(recovered); }
        catch {rejected=true;}finally{IDBObjectStore.prototype.add=original;}
        return {rejected,writes,unchanged:JSON.stringify(await store.exportSnapshot())===JSON.stringify(before)};
      },{envelope,wrongPhrase,wrongNamespace});assert.deepEqual(result,{rejected:true,writes:0,unchanged:true});
    });
  }
  await failureCase('wrong passphrase causes zero native database writes',fixture.envelope,true);
  await failureCase('wrong account/target causes zero native database writes',fixture.envelope,false,true);
  for(const field of ['salt','iv','ciphertext']) {
    const bad=structuredClone(fixture.envelope);bad[field]=(bad[field][0]==='0'?'1':'0')+bad[field].slice(1);
    await failureCase(`tampered ${field} leaves existing records unchanged`,bad);
  }
  for(const [name,bad] of [['future version',{...fixture.envelope,version:2}],['extra fields',{...fixture.envelope,extra:1}],['short nonce',{...fixture.envelope,iv:'00'}],['truncated data',{...fixture.envelope,ciphertext:'00'}],['null archive',null]]) await failureCase(`malformed ${name} causes zero writes`,bad);
  await check('authenticated ciphertext with invalid customer schema fails before restore',async()=>{
    const forged=await p.evaluate(async(envelope)=>{
      const decode=hex=>Uint8Array.from(hex.match(/../g),byte=>parseInt(byte,16));
      const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(phrase),'PBKDF2',false,['deriveKey']);
      const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(envelope.salt),iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:new TextEncoder().encode('fire-local-customers-encrypted:v1:PBKDF2-SHA256:600000:AES-256-GCM'),tagLength:128},key,new TextEncoder().encode(JSON.stringify({format:'fire-local-customers',version:1,namespace:store.namespace,customers:[{id:'bad'}],pendingOperations:[]})));
      return {...envelope,ciphertext:Array.from(new Uint8Array(encrypted),byte=>byte.toString(16).padStart(2,'0')).join('')};
    },fixture.envelope);
    const result=await p.evaluate(async forged=>{const before=await store.exportSnapshot();const original=IDBObjectStore.prototype.add;let writes=0;IDBObjectStore.prototype.add=function(...args){writes++;return original.apply(this,args);};let rejected=false;try{const v=await backups.recoverLocalCustomerBackup(forged,store.namespace,phrase);await store.restoreSnapshot(v);}catch{rejected=true;}finally{IDBObjectStore.prototype.add=original;}return {rejected,writes,unchanged:JSON.stringify(await store.exportSnapshot())===JSON.stringify(before)};},forged);
    assert.deepEqual(result,{rejected:true,writes:0,unchanged:true});
    assert.deepEqual(await p.evaluate(()=>store.exportSnapshot()),fixture.baseline);
  });
  await check('native abort after decrypted import begins rolls back both stores',async()=>{
    const result=await p.evaluate(async envelope=>{
      const recovered=await backups.recoverLocalCustomerBackup(envelope,store.namespace,phrase);const before=await store.exportSnapshot();const original=IDBObjectStore.prototype.add;let added=0;
      IDBObjectStore.prototype.add=function(...args){const req=original.apply(this,args);if(this.name==='customers'&&++added===1)req.addEventListener('success',()=>req.transaction.abort());return req;};
      let rejected=false;try{await store.restoreSnapshot(recovered);}catch{rejected=true;}finally{IDBObjectStore.prototype.add=original;}
      return {rejected,unchanged:JSON.stringify(await store.exportSnapshot())===JSON.stringify(before)};
    },fixture.envelope);assert.deepEqual(result,{rejected:true,unchanged:true});
  });
  await context.setOffline(true);
  await check('offline retry decrypts and atomically restores missing records',async()=>{
    const result=await p.evaluate(async envelope=>{const recovered=await backups.recoverLocalCustomerBackup(envelope,store.namespace,phrase);return store.restoreSnapshot(recovered);},fixture.envelope);assert.deepEqual(result,{insertedCustomers:2,insertedOperations:3});
    assert.deepEqual(await p.evaluate(()=>store.exportSnapshot()),fixture.archive);
  });
  await check('offline repeated encrypted recovery is a no-op',async()=>assert.deepEqual(await p.evaluate(async envelope=>store.restoreSnapshot(await backups.recoverLocalCustomerBackup(envelope,store.namespace,phrase)),fixture.envelope),{insertedCustomers:0,insertedOperations:0}));
  await context.setOffline(false);await context.close();context=null;await launch();p=await page();await context.setOffline(true);
  await check('graceful browser restart retains recovered records and history offline',async()=>assert.deepEqual(await p.evaluate(()=>store.exportSnapshot()),fixture.archive));
  await check('encrypted recovery still works offline after browser restart',async()=>assert.deepEqual(await p.evaluate(async envelope=>store.restoreSnapshot(await backups.recoverLocalCustomerBackup(envelope,store.namespace,phrase)),fixture.envelope),{insertedCustomers:0,insertedOperations:0}));
  await check('recovered archive cannot rewind newer edits',async()=>{
    const result=await p.evaluate(async envelope=>{await store.save({...customer,id:'recover-2',name:'Newer retained'},'new-edit',2);const before=await store.exportSnapshot();let rejected=false;try{await store.restoreSnapshot(await backups.recoverLocalCustomerBackup(envelope,store.namespace,phrase));}catch{rejected=true;}return {rejected,unchanged:JSON.stringify(await store.exportSnapshot())===JSON.stringify(before)};},fixture.envelope);assert.deepEqual(result,{rejected:true,unchanged:true});
  });
  await check('no external app, database or Stripe requests',async()=>assert.deepEqual(remoteRequests,[]));
  console.log(JSON.stringify({passed,total:passed,browser:version,nativeWebCrypto:true,realIndexedDB:true,syntheticOnly:true,offlineRecoveryTested:true,gracefulRestartTested:true,appOfflineColdLaunchTested:false,iPhoneTested:false}));
  process.exitCode = 0;
} finally { await context?.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true}); }
