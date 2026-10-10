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
for (const [url, file] of [['/store.js','local-customer-store'],['/backup.js','local-customer-backup'],['/vault.js','local-customer-vault']]) {
  const source=readFileSync(new URL(`../lib/${file}.ts`,import.meta.url),'utf8');
  modules.set(url,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("'./local-customer-store'", "'/store.js'").replace("'./local-customer-backup'", "'/backup.js'"));
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
    window.vaultApi=await import('/vault.js'); window.vault=await vaultApi.openLocalCustomerVault('synthetic-owner','synthetic-target'); const row={...customer,revision:1,updatedAt:'2026-10-10T00:00:00.000Z'}; window.archive={format:'fire-local-customers',version:1,namespace:api.localCustomerDatabaseName('synthetic-owner','synthetic-target'),customers:[row],pendingOperations:[{id:'synthetic-operation',kind:'customer-upsert',expectedRevision:0,customer:row,input:customer}]}; window.rawVault=async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(vault.namespace,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('sealed');const req=tx.objectStore('sealed').getAll();tx.oncomplete=()=>resolve(req.result);tx.onabort=()=>reject(tx.error);});db.close();return rows;};
  });return p;
}
async function check(name,fn){await fn();passed++;console.log(`PASS: ${name}`);}
process.exitCode=1;
try {
  await launch();let p=await page();const version=context.browser()?.version() ?? await p.evaluate(()=>navigator.userAgent);
  await check('uninitialized vault fails closed instead of returning empty business data',async()=>{
    assert.equal(await p.evaluate(async()=>{try{await vault.unlock(phrase);return false;}catch{return (await rawVault()).length===0;}}),true);
  });
  await check('invalid customer archive fails before storage writes',async()=>{
    assert.equal(await p.evaluate(async()=>{try{await vault.initialize({...archive,customers:[]},phrase);return false;}catch{return (await rawVault()).length===0;}}),true);
  });
  await check('weak passphrase cannot initialize vault',async()=>{
    assert.equal(await p.evaluate(async()=>{try{await vault.initialize(archive,'short');return false;}catch{return (await rawVault()).length===0;}}),true);
  });
  await check('wrong namespace cannot initialize vault',async()=>{
    assert.equal(await p.evaluate(async()=>{try{await vault.initialize({...archive,namespace:'fire-local-customers:v1:other:target'},phrase);return false;}catch{return (await rawVault()).length===0;}}),true);
  });
  await check('interrupted native initialization commits no encrypted snapshot',async()=>{
    assert.equal(await p.evaluate(async()=>{const original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(...args){const req=original.apply(this,args);req.addEventListener('success',()=>req.transaction.abort());return req;};let rejected=false;try{await vault.initialize(archive,phrase);}catch{rejected=true;}finally{IDBObjectStore.prototype.add=original;}return rejected&&(await rawVault()).length===0;}),true);
  });
  await check('quota fault preserves uninitialized state',async()=>{
    assert.equal(await p.evaluate(async()=>{const original=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(){throw new DOMException('Injected quota','QuotaExceededError');};let rejected=false;try{await vault.initialize(archive,phrase);}catch{rejected=true;}finally{IDBObjectStore.prototype.add=original;}return rejected&&(await rawVault()).length===0;}),true);
  });
  await check('locking during asynchronous encryption prevents initialization',async()=>{
    assert.equal(await p.evaluate(async()=>{const pending=vault.initialize(archive,phrase);vault.lock();let rejected=false;try{await pending;}catch{rejected=true;}return rejected&&(await rawVault()).length===0;}),true);
  });
  await check('retry commits only encrypted customer snapshot',async()=>{
    const rows=await p.evaluate(async()=>{await vault.initialize(archive,phrase);return rawVault();});assert.equal(rows.length,1);assert.equal(rows[0].id,'snapshot');
    const text=JSON.stringify(rows);for(const plaintext of ['Synthetic Customer','test@example.invalid','synthetic-operation','synthetic browser recovery phrase only'])assert.ok(!text.includes(plaintext));
  });
  await check('unlock exposes validated detached records only to its session',async()=>{
    const result=await p.evaluate(async()=>{window.session=await vault.unlock(phrase);const rows=session.listCustomers();rows[0].name='Mutated';return {name:session.getCustomer('synthetic-1').name,revision:session.getCustomer('synthetic-1').revision,missing:session.getCustomer('missing'),records:session.exportSnapshot().customers.length};});assert.deepEqual(result,{name:'Synthetic Customer',revision:1,missing:null,records:1});
  });
  await check('wrong passphrase rejects and preserves encrypted bytes',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());try{await vault.unlock('wrong synthetic recovery phrase');return false;}catch{return JSON.stringify(await rawVault())===before;}}),true);
  });
  await check('reinitialization cannot overwrite existing snapshot',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());try{await vault.initialize(archive,'different valid recovery phrase');return false;}catch{return JSON.stringify(await rawVault())===before;}}),true);
  });
  await check('explicit session lock blocks all future getters and export',async()=>{
    assert.equal(await p.evaluate(()=>{session.lock();let failures=0;for(const read of [()=>session.getCustomer('synthetic-1'),()=>session.listCustomers(),()=>session.exportSnapshot()])try{read();}catch{failures++;}return failures;}),3);
  });
  await check('vault lock revokes every outstanding session',async()=>{
    assert.equal(await p.evaluate(async()=>{const one=await vault.unlock(phrase),two=await vault.unlock(phrase);vault.lock();let failures=0;for(const s of [one,two])try{s.listCustomers();}catch{failures++;}return failures;}),2);
  });
  await check('lock during key derivation cannot publish a late unlocked session',async()=>{
    assert.equal(await p.evaluate(async()=>{const original=SubtleCrypto.prototype.deriveKey;let started,release;const reached=new Promise(resolve=>{started=resolve;});const gate=new Promise(resolve=>{release=resolve;});SubtleCrypto.prototype.deriveKey=async function(...args){started();await gate;return original.apply(this,args);};try{const pending=vault.unlock(phrase);await reached;vault.lock();release();try{await pending;return false;}catch{return true;}}finally{SubtleCrypto.prototype.deriveKey=original;}}),true);
  });
  await check('account and target remain isolated',async()=>{
    assert.deepEqual(await p.evaluate(async()=>{const result=[];for(const [account,target] of [['other','synthetic-target'],['synthetic-owner','other']]){const isolated=await vaultApi.openLocalCustomerVault(account,target);try{await isolated.unlock(phrase);result.push(false);}catch{result.push(true);}isolated.close();}return result;}),[true,true]);
  });
  await check('two-tab initialization race has one winner without overwrite',async()=>{
    const other=await page();const results=await Promise.all([p,other].map(tab=>tab.evaluate(async()=>{const v=await vaultApi.openLocalCustomerVault('race-owner','race-target');const backup={...archive,namespace:api.localCustomerDatabaseName('race-owner','race-target')};try{await v.initialize(backup,phrase);return true;}catch{return false;}finally{v.close();}})));assert.equal(results.filter(Boolean).length,1);await other.close();
  });
  await context.setOffline(true);
  await check('unlock and read work offline with a locked vault',async()=>{
    assert.equal(await p.evaluate(async()=>{const s=await vault.unlock(phrase);const name=s.getCustomer('synthetic-1').name;s.lock();return name;}),'Synthetic Customer');
  });
  await context.setOffline(false);await context.close();context=null;await launch();p=await page();await context.setOffline(true);
  await check('graceful browser restart retains encrypted storage and offline unlock',async()=>{
    assert.equal(await p.evaluate(async()=>{const s=await vault.unlock(phrase);const name=s.listCustomers()[0].name;s.lock();return name;}),'Synthetic Customer');assert.equal((await p.evaluate(()=>rawVault())).length,1);
  });
  await context.setOffline(false);
  await p.evaluate(async()=>{window.editor=await vault.unlock(phrase);});
  await check('wrong phrase cannot rewrite encrypted customer data',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());try{await editor.saveCustomer({...customer,name:'Wrong'},'wrong-phrase-edit',1,'incorrect recovery phrase');return false;}catch{return JSON.stringify(await rawVault())===before&&editor.getCustomer(customer.id).revision===1;}}),true);
  });
  await check('invalid fields and stale customer revision reject without writes',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());let failures=0;for(const [input,op,rev] of [[{...customer,extra:true},'extra',1],[{...customer,name:''},'empty',1],[customer,'bad:id',1],[customer,'bad-rev',0]])try{await editor.saveCustomer(input,op,rev,phrase);}catch{failures++;}return failures===4&&JSON.stringify(await rawVault())===before;}),true);
  });
  await check('aborted native ciphertext replacement preserves disk and session revision',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const req=original.apply(this,args);req.addEventListener('success',()=>req.transaction.abort());return req;};let rejected=false;try{await editor.saveCustomer({...customer,name:'Interrupted'},'interrupted-edit',1,phrase);}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}return rejected&&JSON.stringify(await rawVault())===before&&editor.getCustomer(customer.id).revision===1;}),true);
  });
  await check('quota failure preserves prior encrypted snapshot',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Injected quota','QuotaExceededError');};let rejected=false;try{await editor.saveCustomer({...customer,name:'Quota'},'quota-edit',1,phrase);}catch{rejected=true;}finally{IDBObjectStore.prototype.put=original;}return rejected&&JSON.stringify(await rawVault())===before;}),true);
  });
  await check('session lock during encryption cancels pending replacement',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());const original=SubtleCrypto.prototype.encrypt;let reached,release;const started=new Promise(resolve=>{reached=resolve;}),gate=new Promise(resolve=>{release=resolve;});SubtleCrypto.prototype.encrypt=async function(...args){reached();await gate;return original.apply(this,args);};try{const pending=editor.saveCustomer({...customer,name:'Locked'},'locked-edit',1,phrase);await started;editor.lock();release();try{await pending;return false;}catch{return JSON.stringify(await rawVault())===before;}}finally{SubtleCrypto.prototype.encrypt=original;}}),true);
  });
  await p.evaluate(async()=>{window.editor=await vault.unlock(phrase);});
  await context.setOffline(true);
  await check('offline successful edit advances customer/history only after commit',async()=>{
    const result=await p.evaluate(async()=>{const saved=await editor.saveCustomer({...customer,name:'Edited offline'},'committed-edit',1,phrase);return {saved:saved.name,revision:editor.getCustomer(customer.id).revision,operations:editor.exportSnapshot().pendingOperations.length};});assert.deepEqual(result,{saved:'Edited offline',revision:2,operations:2});
  });
  await check('exact duplicate write retry leaves ciphertext unchanged',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());const result=await editor.saveCustomer({...customer,name:'Edited offline'},'committed-edit',1,phrase);return result.revision===2&&JSON.stringify(await rawVault())===before;}),true);
  });
  await check('operation ID cannot be reused for a different encrypted change',async()=>{
    assert.equal(await p.evaluate(async()=>{const before=JSON.stringify(await rawVault());try{await editor.saveCustomer({...customer,name:'Different'},'committed-edit',1,phrase);return false;}catch{return JSON.stringify(await rawVault())===before;}}),true);
  });
  await check('old operation retry never rewinds newer encrypted edits',async()=>{
    assert.equal(await p.evaluate(async()=>{await editor.saveCustomer({...customer,name:'Newer retained'},'newer-edit',2,phrase);const before=JSON.stringify(await rawVault());const old=await editor.saveCustomer({...customer,name:'Edited offline'},'committed-edit',1,phrase);return old.revision===2&&editor.getCustomer(customer.id).revision===3&&JSON.stringify(await rawVault())===before;}),true);
  });
  await check('caller mutation cannot alter a scheduled encrypted customer create',async()=>{
    assert.equal(await p.evaluate(async()=>{const input={...customer,id:'created-encrypted'};const pending=editor.saveCustomer(input,'encrypted-create',0,phrase);input.name='Mutated';return (await pending).name;}),'Synthetic Customer');
  });
  await context.setOffline(false);
  await check('two-tab edits compare-and-swap with exactly one winner',async()=>{
    const other=await page();for(const tab of [p,other])await tab.evaluate(async()=>{window.raceEditor=await vault.unlock(phrase);});
    const results=await Promise.all([p,other].map((tab,i)=>tab.evaluate(async i=>{try{await raceEditor.saveCustomer({...customer,name:`Race ${i}`},`race-edit-${i}`,3,phrase);return 'saved';}catch(e){return e.message;}},i)));assert.equal(results.filter(r=>r==='saved').length,1);assert.equal(results.filter(r=>/snapshot changed/.test(r)).length,1);await other.close();
  });
  await check('stale encrypted snapshot cannot lose unrelated newer customers',async()=>{
    assert.equal(await p.evaluate(async()=>{const stale=await vault.unlock(phrase),writer=await vault.unlock(phrase);await writer.saveCustomer({...customer,id:'newer-customer'},'newer-create',0,phrase);const before=JSON.stringify(await rawVault());let rejected=false;try{await stale.saveCustomer({...customer,id:'stale-customer'},'stale-create',0,phrase);}catch{rejected=true;}return rejected&&JSON.stringify(await rawVault())===before;}),true);
  });
  await check('raw persisted edits remain ciphertext without customer plaintext',async()=>{
    const text=JSON.stringify(await p.evaluate(()=>rawVault()));for(const secret of ['Edited offline','Newer retained','newer-customer','created-encrypted','test@example.invalid'])assert.ok(!text.includes(secret));
  });
  await context.close();context=null;await launch();p=await page();await context.setOffline(true);
  await check('encrypted edits and operation history survive graceful restart',async()=>{
    const result=await p.evaluate(async()=>{const s=await vault.unlock(phrase);const rows=s.listCustomers();return {count:rows.length,revision:s.getCustomer(customer.id).revision,operations:s.exportSnapshot().pendingOperations.length};});assert.deepEqual(result,{count:3,revision:4,operations:6});
  });
  await context.setOffline(false);
  const peer=await page();
  for(const tab of [p,peer])await tab.evaluate(async()=>{
    window.vault.close();window.vault=await vaultApi.openLocalCustomerVault('lock-owner','lock-target');
    window.lockArchive={...archive,namespace:api.localCustomerDatabaseName('lock-owner','lock-target')};
    try{await vault.initialize(lockArchive,phrase);}catch{}
    window.lockSession=await vault.unlock(phrase);
  });
  await check('cross-tab vault lock revokes all peer reads and writes',async()=>{
    const before=await peer.evaluate(async()=>JSON.stringify(await rawVault()));await p.evaluate(()=>vault.lock());
    await peer.waitForFunction(()=>{try{lockSession.listCustomers();return false;}catch{return true;}});
    assert.equal(await peer.evaluate(async()=>{let blocked=0;for(const read of [()=>lockSession.getCustomer(customer.id),()=>lockSession.listCustomers(),()=>lockSession.exportSnapshot()])try{read();}catch{blocked++;}try{await lockSession.saveCustomer(customer,'revoked-write',1,phrase);}catch{blocked++;}return blocked;}),4);
    assert.equal(await peer.evaluate(async()=>JSON.stringify(await rawVault())),before);
  });
  await check('token check blocks reads before any queued lock notification',async()=>{
    assert.equal(await peer.evaluate(async()=>{window.lockSession=await vault.unlock(phrase);localStorage.setItem(vault.namespace+':lock',crypto.randomUUID());try{lockSession.listCustomers();return false;}catch{return true;}}),true);
  });
  await check('cross-tab session lock is scoped to its account and target',async()=>{
    assert.equal(await peer.evaluate(async()=>{const isolated=await vaultApi.openLocalCustomerVault('unrelated-owner','lock-target');const data={...archive,namespace:api.localCustomerDatabaseName('unrelated-owner','lock-target')};await isolated.initialize(data,phrase);window.unrelated=isolated;window.unrelatedSession=await isolated.unlock(phrase);window.lockSession=await vault.unlock(phrase);lockSession.lock();return unrelatedSession.getCustomer(customer.id).revision;}),1);
    await p.evaluate(async()=>{window.lockSession=await vault.unlock(phrase);});await peer.evaluate(()=>lockSession.lock());
    await p.waitForFunction(()=>{try{lockSession.listCustomers();return false;}catch{return true;}});
  });
  await check('remote lock prevents late unlock during native key derivation',async()=>{
    await peer.evaluate(()=>{const original=SubtleCrypto.prototype.deriveKey;window.cryptoOriginal=original;window.started=false;window.cryptoGate=new Promise(resolve=>{window.releaseCrypto=resolve;});SubtleCrypto.prototype.deriveKey=async function(...args){window.started=true;await cryptoGate;return original.apply(this,args);};window.lateUnlock=vault.unlock(phrase).then(()=>false,()=>true);});
    await peer.waitForFunction(()=>window.started);await p.evaluate(()=>vault.lock());
    assert.equal(await peer.evaluate(async()=>{releaseCrypto();try{return await lateUnlock;}finally{SubtleCrypto.prototype.deriveKey=cryptoOriginal;}}),true);
  });
  await check('remote lock during encryption cancels replacement and preserves bytes',async()=>{
    const before=await peer.evaluate(async()=>JSON.stringify(await rawVault()));
    await peer.evaluate(async()=>{window.lockSession=await vault.unlock(phrase);const original=SubtleCrypto.prototype.encrypt;window.cryptoOriginal=original;window.started=false;window.cryptoGate=new Promise(resolve=>{window.releaseCrypto=resolve;});SubtleCrypto.prototype.encrypt=async function(...args){window.started=true;await cryptoGate;return original.apply(this,args);};window.lateSave=lockSession.saveCustomer({...customer,name:'Remote locked'},'remote-encrypt',1,phrase).then(()=>false,()=>true);});
    await peer.waitForFunction(()=>window.started);await p.evaluate(()=>vault.lock());
    assert.equal(await peer.evaluate(async()=>{releaseCrypto();try{return await lateSave;}finally{SubtleCrypto.prototype.encrypt=cryptoOriginal;}}),true);
    assert.equal(await peer.evaluate(async()=>JSON.stringify(await rawVault())),before);
  });
  await check('remote lock aborts a native pending write after put success',async()=>{
    const before=await peer.evaluate(async()=>JSON.stringify(await rawVault()));
    await peer.evaluate(async()=>{window.lockSession=await vault.unlock(phrase);const original=IDBObjectStore.prototype.put;window.originalPut=original;window.putReached=false;IDBObjectStore.prototype.put=function(...args){const req=original.apply(this,args);req.addEventListener('success',()=>{window.putReached=true;const keepAlive=()=>{try{const r=req.transaction.objectStore('sealed').get('snapshot');r.onsuccess=keepAlive;}catch{}};keepAlive();});return req;};window.pendingSave=lockSession.saveCustomer({...customer,name:'Pending locked'},'remote-pending',1,phrase).then(()=>false,()=>true);});
    await peer.waitForFunction(()=>window.putReached);await p.evaluate(()=>vault.lock());
    assert.equal(await peer.evaluate(async()=>{try{return await pendingSave;}finally{IDBObjectStore.prototype.put=originalPut;}}),true);
    assert.equal(await peer.evaluate(async()=>JSON.stringify(await rawVault())),before);
  });
  await check('lock after commit rejects acknowledgment but preserves operation receipt',async()=>{
    assert.equal(await peer.evaluate(async()=>{window.lockSession=await vault.unlock(phrase);const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(args[1]==='readwrite')tx.addEventListener('complete',()=>vault.lock(),{once:true});return tx;};let rejected=false;try{await lockSession.saveCustomer({...customer,name:'Committed before lock'},'ambiguous-edit',1,phrase);}catch{rejected=true;}finally{IDBDatabase.prototype.transaction=original;}window.recoveredSession=await vault.unlock(phrase);const receipt=recoveredSession.exportSnapshot().pendingOperations.find(op=>op.id==='ambiguous-edit');return rejected&&receipt.customer.revision===2&&recoveredSession.getCustomer(customer.id).name==='Committed before lock';}),true);
  });
  await check('verified ambiguous-save retry never duplicates or rewinds records',async()=>{
    assert.equal(await peer.evaluate(async()=>{const before=JSON.stringify(await rawVault());const recovered=await recoveredSession.saveCustomer({...customer,name:'Committed before lock'},'ambiguous-edit',1,phrase);if(recovered.revision!==2||JSON.stringify(await rawVault())!==before)return false;await recoveredSession.saveCustomer({...customer,name:'Retained after recovery'},'post-recovery-edit',2,phrase);const newer=JSON.stringify(await rawVault());const old=await recoveredSession.saveCustomer({...customer,name:'Committed before lock'},'ambiguous-edit',1,phrase);const exportData=recoveredSession.exportSnapshot();return old.revision===2&&recoveredSession.getCustomer(customer.id).revision===3&&exportData.customers.length===1&&exportData.pendingOperations.length===3&&JSON.stringify(await rawVault())===newer;}),true);
  });
  await check('same-document handles observe session lock synchronously',async()=>{
    assert.equal(await peer.evaluate(async()=>{const second=await vaultApi.openLocalCustomerVault('lock-owner','lock-target');const firstSession=await vault.unlock(phrase),secondSession=await second.unlock(phrase);firstSession.lock();try{secondSession.listCustomers();return false;}catch{return true;}finally{second.close();}}),true);
  });
  await check('delayed notification cannot revoke a newly unlocked session',async()=>{
    assert.equal(await peer.evaluate(async()=>{window.freshSession=await vault.unlock(phrase);const c=new BroadcastChannel(vault.namespace+':lock');c.postMessage('locked');await new Promise(resolve=>setTimeout(resolve,30));c.close();return freshSession.getCustomer(customer.id).revision;}),3);
  });
  await check('storage coordination remains safe without BroadcastChannel',async()=>{
    await peer.evaluate(async()=>{const original=window.BroadcastChannel;window.BroadcastChannel=class{constructor(){throw new Error('Unavailable broadcast');}};try{window.fallbackVault=await vaultApi.openLocalCustomerVault('lock-owner','lock-target');window.fallbackSession=await fallbackVault.unlock(phrase);}finally{window.BroadcastChannel=original;}});
    await p.evaluate(()=>vault.lock());await peer.waitForFunction(()=>{try{fallbackSession.listCustomers();return false;}catch{return true;}});await peer.evaluate(()=>fallbackVault.close());
  });
  await check('unavailable coordination storage fails closed before vault use',async()=>{
    assert.equal(await p.evaluate(async()=>{try{await vaultApi.openLocalCustomerVault('blocked-owner','blocked-target',indexedDB,crypto,{setItem(){throw new DOMException('Injected unavailable storage','SecurityError');}});return false;}catch{return true;}}),true);
  });
  await peer.evaluate(()=>{unrelated.close();vault.close();});await peer.close();
  await p.evaluate(async()=>{vault.close();window.vault=await vaultApi.openLocalCustomerVault('synthetic-owner','synthetic-target');});
  await check('ciphertext tampering fails closed without replacing stored snapshot',async()=>{
    const result=await p.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open(vault.namespace,1);r.onsuccess=()=>resolve(r.result);});await new Promise((resolve,reject)=>{const tx=db.transaction('sealed','readwrite');const store=tx.objectStore('sealed');const req=store.get('snapshot');req.onsuccess=()=>{const row=req.result;row.envelope.ciphertext=(row.envelope.ciphertext[0]==='0'?'1':'0')+row.envelope.ciphertext.slice(1);store.put(row);};tx.oncomplete=resolve;tx.onabort=reject;});db.close();const before=JSON.stringify(await rawVault());try{await vault.unlock(phrase);return false;}catch{return JSON.stringify(await rawVault())===before;}});assert.equal(result,true);
  });
  await check('close revokes access and prevents reopening through stale handle',async()=>{
    assert.equal(await p.evaluate(async()=>{vault.close();try{await vault.unlock(phrase);return false;}catch{return true;}}),true);
  });
  await check('no external app, database or Stripe requests',async()=>assert.deepEqual(remoteRequests,[]));
  console.log(JSON.stringify({passed,total:passed,browser:version,nativeWebCrypto:true,realIndexedDB:true,syntheticOnly:true,encryptedAtRestSnapshotTested:true,appOfflineColdLaunchTested:false,iPhoneTested:false}));process.exitCode=0;
}finally{await context?.close();await new Promise(resolve=>server.close(resolve));rmSync(profile,{recursive:true,force:true});}
