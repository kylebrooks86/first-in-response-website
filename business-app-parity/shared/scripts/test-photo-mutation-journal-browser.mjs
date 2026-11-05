/** Actual IndexedDB + Web Locks, concurrent tabs, terminated tab and reopened
 * persistent Chromium profile. Synthetic localhost only; no hosted mutations. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
if(!process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||!process.env.FIRE_BROWSER_TEST_EXECUTABLE)throw Error('Pinned Chromium runner required');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE);
const root=resolve(new URL('..',import.meta.url).pathname);
const build=await esbuild.build({stdin:{contents:`
 import * as journal from './lib/photo-mutation-journal';
 import {addOfflinePhoto,listOfflinePhotos} from './lib/local-photo-vault';
 window.fixture={...journal,addOfflinePhoto,listOfflinePhotos};
 `,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(build.outputFiles[0].text);}
 else{res.setHeader('content-type','text/html');res.end('<title>Synthetic photo safety</title><script type="module" src="/bundle.js"></script>');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const profile=mkdtempSync(join(tmpdir(),'fire-photo-journal-'));
let context,checks=0;const outside=[],errors=[];
const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS: '+label);};
const launch=async()=>{
 const ctx=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 await ctx.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort();}return route.continue();});
 return ctx;
};
const open=async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.waitForFunction(()=>Boolean(window.fixture));return p;};
try{
 context=await launch();let page=await open(),other=await open();
 check(await page.evaluate(async()=>await fixture.readPhotoMutationAttempt()===null),'Empty journal inspected without initializing photos');
 const receipt=await page.evaluate(async()=>{
  try{await fixture.runPhotoMutation('add','synthetic-A',async()=>{
   await fixture.addOfflinePhoto('synthetic-A','before','Synthetic interrupted image',new File(['original image bytes'],'original.png',{type:'image/png'}));
   throw Error('Synthetic lost acknowledgement');
  });}catch{}
  return {pending:await fixture.readPhotoMutationAttempt(),rows:(await fixture.listOfflinePhotos()).length};
 });
 check(receipt.rows===1&&receipt.pending?.kind==='add','Lost acknowledgement retains committed image and durable interruption receipt');
 check(Object.keys(receipt.pending).sort().join(',')==='customerId,id,kind,startedAt','Journal excludes image bytes, filenames, contacts and credentials');
 check(await other.evaluate(async()=>{let calls=0;try{await fixture.runPhotoMutation('delete','synthetic-A',async()=>calls++);}catch{}return calls===0;}),'Other tab cannot perform a new mutation while interrupted receipt exists');
 await page.reload();await page.waitForFunction(()=>Boolean(window.fixture));
 check((await page.evaluate(()=>fixture.readPhotoMutationAttempt())).id===receipt.pending.id,'Reload retains same interrupted operation identity');
 check(await page.evaluate(async()=>{try{await fixture.reviewPhotoMutation('synthetic-B',async()=>{});return false;}catch{return true;}}),'Different customer cannot acknowledge another customer’s interrupted operation');
 check(await page.evaluate(async()=>{try{await fixture.reviewPhotoMutation('synthetic-A',async()=>{throw Error('Synthetic read failure');});return false;}catch{return true;}}),'Failed gallery read cannot produce a review receipt');
 check((await page.evaluate(()=>fixture.readPhotoMutationAttempt())).id===receipt.pending.id,'Failed review preserves durable interruption receipt');
 let reviewed=await page.evaluate(()=>fixture.reviewPhotoMutation('synthetic-A',()=>fixture.listOfflinePhotos()));
 check(reviewed===receipt.pending.id,'Successful read-only review binds acknowledgement to exact interrupted operation');
 check(await page.evaluate(async()=>{try{await fixture.acknowledgePhotoMutation('00000000-0000-0000-0000-000000000000');return false;}catch{return true;}}),'Forged or stale acknowledgement cannot remove active receipt');
 await page.evaluate(id=>fixture.acknowledgePhotoMutation(id),reviewed);
 check(await page.evaluate(async()=>await fixture.readPhotoMutationAttempt()===null),'Explicit exact acknowledgement enables future deliberate changes');
 const result=await page.evaluate(()=>fixture.runPhotoMutation('add','synthetic-A',async()=>42));
 check(result===42&&await page.evaluate(async()=>await fixture.readPhotoMutationAttempt()===null),'Confirmed mutation clears only its own receipt after callback completion');
 // Hold a real Web Lock over the mutation. Reading a receipt is permitted;
 // acknowledgement and a second mutation must fail without queuing/retrying.
 await page.evaluate(()=>{
  window.held=fixture.runPhotoMutation('restore','synthetic-A',async()=>{
   window.started=true;await new Promise(resolve=>{window.finish=resolve;});
  }).catch(error=>{window.heldError=error.message;});
 });
 await page.waitForFunction(()=>window.started===true);
 const live=await other.evaluate(async()=>{
  const id=(await fixture.readPhotoMutationAttempt()).id;let writes=0,reviewReads=0;
  const failures=[];
  for(const action of [()=>fixture.runPhotoMutation('add','synthetic-A',async()=>writes++),()=>fixture.reviewPhotoMutation('synthetic-A',async()=>reviewReads++),()=>fixture.acknowledgePhotoMutation(id)]){
   try{await action();failures.push(false);}catch{failures.push(true);}
  }
  return {writes,reviewReads,failures};
 });
 check(live.writes===0&&live.reviewReads===0&&live.failures.every(Boolean),'Active mutation prevents concurrent mutation, review and premature acknowledgement across tabs');
 await page.close();
 // Closing a tab and querying lock state do not provide a release barrier on
 // every Chromium version. Queue a native read-only barrier, then let its
 // release settle before testing the deliberately non-queuing product API.
 await other.evaluate(async()=>{
  const name=(await indexedDB.databases()).find(x=>x.name.startsWith('fire-photo-mutation-')).name+'-exclusive';
  await navigator.locks.request(name,()=>undefined);
  await new Promise(requestAnimationFrame);
 });
 reviewed=await other.evaluate(()=>fixture.reviewPhotoMutation('synthetic-A',()=>fixture.listOfflinePhotos()));
 check(typeof reviewed==='string','Closing active tab releases Web Lock but preserves interruption receipt');
 await other.evaluate(id=>fixture.acknowledgePhotoMutation(id),reviewed);
 // Two simultaneous attempts: only one callback can enter; no waiting replay.
 const race=await other.evaluate(async()=>{
  let entered=0,release;
  const first=fixture.runPhotoMutation('delete','synthetic-A',async()=>{entered++;await new Promise(r=>{release=r;});});
  while(!release)await new Promise(r=>setTimeout(r,0));
  let rejected=false;try{await fixture.runPhotoMutation('add','synthetic-A',async()=>entered++);}catch{rejected=true;}
  release();await first;return {entered,rejected};
 });
 check(race.entered===1&&race.rejected,'Concurrent deliberate actions enter exactly one callback without automatic replay');
 await other.evaluate(async()=>{try{await fixture.runPhotoMutation('delete','synthetic-A',async()=>{throw Error('Synthetic interrupted deletion');});}catch{}});
 const beforeRestart=await other.evaluate(()=>fixture.readPhotoMutationAttempt());
 await context.close();context=await launch();page=await open();
 const afterRestart=await page.evaluate(async()=>({pending:await fixture.readPhotoMutationAttempt(),photos:await fixture.listOfflinePhotos()}));
 check(afterRestart.pending.id===beforeRestart.id&&afterRestart.photos.length===1,'Entire Chromium process restart retains interruption receipt and original image');
 check(await page.evaluate(async()=>{let calls=0;try{await fixture.runPhotoMutation('add','synthetic-A',async()=>calls++);}catch{}return calls===0;}),'Cold browser restart cannot bypass pause and duplicate an interrupted operation');
 reviewed=await page.evaluate(()=>fixture.reviewPhotoMutation('synthetic-A',()=>fixture.listOfflinePhotos()));
 await page.evaluate(id=>fixture.acknowledgePhotoMutation(id),reviewed);
 // Successful review is invalid after a newer interrupted action.
 await page.evaluate(async()=>{try{await fixture.runPhotoMutation('restore','synthetic-A',async()=>{throw Error('New interruption');});}catch{}});
 check(await page.evaluate(async id=>{try{await fixture.acknowledgePhotoMutation(id);return false;}catch{return true;}},reviewed),'Old review cannot clear a newer interrupted attempt');
 check(await page.evaluate(async()=>{
  const original=indexedDB.open;indexedDB.open=()=>{throw Error('Synthetic storage denial');};let entered=0;
  try{await fixture.runPhotoMutation('add','synthetic-A',async()=>entered++);}catch{}finally{indexedDB.open=original;}
  return entered===0;
 }),'Unavailable safety storage blocks callback before any photo changes');
 check(await page.evaluate(async()=>{
  const own=Object.getOwnPropertyDescriptor(navigator,'locks');Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});let entered=0;
  try{await fixture.runPhotoMutation('add','synthetic-A',async()=>entered++);}catch{}finally{if(own)Object.defineProperty(navigator,'locks',own);else delete navigator.locks;}
  return entered===0;
 }),'Unsupported cross-tab lock API fails closed instead of weakening concurrency checks');
 reviewed=await page.evaluate(()=>fixture.reviewPhotoMutation('synthetic-A',()=>fixture.listOfflinePhotos()));
 await page.evaluate(id=>fixture.acknowledgePhotoMutation(id),reviewed);
 check(await page.evaluate(async()=>{
  const add=IDBObjectStore.prototype.add;let entered=0;
  IDBObjectStore.prototype.add=function(...args){if(this.name==='attempts')throw new DOMException('Synthetic journal quota','QuotaExceededError');return add.apply(this,args);};
  try{await fixture.runPhotoMutation('add','synthetic-A',async()=>entered++);}catch{}finally{IDBObjectStore.prototype.add=add;}
  return entered===0&&await fixture.readPhotoMutationAttempt()===null;
 }),'Journal quota rejection rolls back before callback without uncaught transaction errors');
 check(await page.evaluate(async()=>{
  const remove=IDBObjectStore.prototype.delete;let failed=false;
  IDBObjectStore.prototype.delete=function(...args){if(this.name==='attempts')throw Error('Synthetic receipt clear failure');return remove.apply(this,args);};
  try{await fixture.runPhotoMutation('add','synthetic-A',()=>fixture.addOfflinePhoto('synthetic-A','after','Verified bytes',new File(['second original'],'second.png',{type:'image/png'})));}catch{failed=true;}finally{IDBObjectStore.prototype.delete=remove;}
  return failed&&(await fixture.listOfflinePhotos()).length===2&&(await fixture.readPhotoMutationAttempt())?.kind==='add';
 }),'Post-save receipt-clear failure retains both verified images and durable review guard');
 reviewed=await page.evaluate(()=>fixture.reviewPhotoMutation('synthetic-A',()=>fixture.listOfflinePhotos()));
 await page.evaluate(id=>fixture.acknowledgePhotoMutation(id),reviewed);
 check(await page.evaluate(async()=>{
  const dbs=await indexedDB.databases(),name=dbs.find(x=>x.name.startsWith('fire-photo-mutation-')).name;
  await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>{const db=r.result,tx=db.transaction('attempts','readwrite');tx.objectStore('attempts').put({id:'corrupted'},'pending');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});
  let called=0,rejected=false;
  try{await fixture.readPhotoMutationAttempt();}catch{rejected=true;}
  try{await fixture.runPhotoMutation('add','synthetic-A',async()=>called++);}catch{}
  try{await fixture.acknowledgePhotoMutation(null);}catch{}
  return rejected&&called===0;
 }),'Corrupted interruption receipt is preserved and cannot silently enable mutations');
 check(outside.length===0&&errors.length===0,'Zero external requests or uncaught browser errors');
 console.log('PASS '+checks+' durable photo mutation browser checks');
}finally{if(context)await context.close();await new Promise(r=>server.close(r));rmSync(profile,{recursive:true,force:true});}
