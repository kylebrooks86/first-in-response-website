// Event-driven simulated IndexedDB. These checks are NOT browser/iPhone evidence.
import assert from 'node:assert/strict';
import {openLocalCustomerStore, localCustomerDatabaseName} from '../lib/local-customer-store.ts';
const clone = value => value === undefined ? undefined : structuredClone(value);
const tick = callback => setTimeout(callback, 0);
class SimulatedFactory {
  databases = new Map(); failWrite = false; failCommit = false; blocked = false;
  open(name, version) {
    const request = {};
    tick(() => {
      if (this.blocked) { request.onblocked?.(); }
      let state = this.databases.get(name);
      if (state && state.version > version) {request.error = new DOMException('Newer schema', 'VersionError');request.onerror?.();return;}
      const fresh = !state;
      if (!state) {state={version, stores:new Map(), tail:Promise.resolve()};this.databases.set(name,state);}
      let closed=false;
      const connection={
        version:state.version,
        objectStoreNames:{contains:n=>state.stores.has(n)},
        createObjectStore:n=>state.stores.set(n,new Map()),
        close:()=>{closed=true;},
        transaction:(names,mode)=> {
          if(closed)throw new DOMException('Closed','InvalidStateError');
          return this.transaction(state,names,mode);
        },
      };
      request.result=connection;request.transaction={db:connection};
      if(fresh)request.onupgradeneeded?.();
      request.onsuccess?.();
    });return request;
  }
  transaction(state,names,mode) {
    const queue=[];let working,ended=false;
    let release;const done=new Promise(resolve=>{release=resolve;});
    const prior=state.tail;state.tail=done;
    const finish=()=>{ended=true;release();};
    const tx={error:null,oncomplete:null,onabort:null,
      abort:()=>{if(ended)throw new Error('Inactive');finish();tick(()=>tx.onabort?.());},
      objectStore:name=>({keyPath:'id',
        get:key=>schedule(()=>clone(working.get(name).get(key))),
        getAll:()=>schedule(()=>[...working.get(name).values()].map(clone)),
        put:value=>schedule(()=>write(name,value,false)),
        add:value=>schedule(()=>write(name,value,true)),
      }),
    };
    const write=(name,value,unique)=>{
      if(mode!=='readwrite')throw new Error('Read only');
      if(this.failWrite && name==='operations'){this.failWrite=false;throw new DOMException('Full','QuotaExceededError');}
      if(unique && working.get(name).has(value.id))throw new DOMException('Duplicate','ConstraintError');
      working.get(name).set(value.id,clone(value));return value.id;
    };
    const schedule=run=>{if(ended)throw new Error('Inactive');const request={};queue.push({run,request});return request;};
    const pump=()=>tick(()=>{
      if(ended)return;
      const next=queue.shift();
      if(!next){
        if(mode==='readwrite' && this.failCommit){this.failCommit=false;tx.error=new DOMException('Disk failure','UnknownError');tx.abort();return;}
        if(mode==='readwrite')for(const name of names)state.stores.set(name,working.get(name));
        finish();tx.oncomplete?.();return;
      }
      try {next.request.result=next.run();next.request.onsuccess?.();}
      catch(error){tx.error=error;tx.abort();return;}
      pump();
    });
    prior.then(()=>{working=new Map(names.map(name=>[name,new Map([...state.stores.get(name)].map(([k,v])=>[k,clone(v)]))]));pump();});
    return tx;
  }
}
let passed=0;
async function check(name,run){await run();passed++;console.log(`PASS: ${name}`);}
const factory=new SimulatedFactory();
const customer={id:'customer-1',name:'Synthetic Customer',email:'test@example.invalid',phone:'',address:'Synthetic address',leadSource:'test'};
let store=await openLocalCustomerStore('owner-A','live',factory);
await check('create commits customer and pending operation together',async()=>{
  const record=await store.save(customer,'op-1',0);assert.equal(record.revision,1);
  const snapshot=await store.exportSnapshot();assert.equal(snapshot.customers.length,1);assert.equal(snapshot.pendingOperations.length,1);assert.equal(snapshot.pendingOperations[0].kind,'customer-upsert');
});
await check('close and reopen retains synthetic record',async()=>{store.close();store=await openLocalCustomerStore('owner-A','live',factory);assert.equal((await store.exportSnapshot()).customers[0].name,customer.name);});
await check('exact retry is idempotent',async()=>{await store.save({...customer},'op-1',0);assert.equal((await store.exportSnapshot()).pendingOperations.length,1);});
await check('reused operation ID with different payload rejects',async()=>{await assert.rejects(store.save({...customer,name:'Changed'},'op-1',0),/different change/);});
await check('existing record cannot be accidentally overwritten as new',async()=>{await assert.rejects(store.save(customer,'bad-create',0),/latest local revision/);});
await check('update advances revision and retains history',async()=>{await store.save({...customer,name:'Updated'},'op-2',1);const s=await store.exportSnapshot();assert.equal(s.customers[0].revision,2);assert.equal(s.pendingOperations.length,2);});
await check('outbox quota failure rolls back previously successful record write',async()=>{factory.failWrite=true;await assert.rejects(store.save({...customer,name:'Lost'},'quota',2),{name:'QuotaExceededError'});const s=await store.exportSnapshot();assert.equal(s.customers[0].name,'Updated');assert.equal(s.pendingOperations.length,2);});
await check('commit failure after request success never reports save success',async()=>{factory.failCommit=true;await assert.rejects(store.save({...customer,name:'Lost'},'disk',2),{name:'UnknownError'});const s=await store.exportSnapshot();assert.equal(s.customers[0].revision,2);assert.equal(s.pendingOperations.length,2);});
await check('retry after aborted operation succeeds once',async()=>{await store.save({...customer,name:'Recovered'},'quota',2);assert.equal((await store.exportSnapshot()).pendingOperations.length,3);});
await check('concurrent saves serialize and stale revision rejects',async()=>{const results=await Promise.allSettled([store.save({...customer,name:'Winner A'},'race-A',3),store.save({...customer,name:'Winner B'},'race-B',3)]);assert.deepEqual(results.map(x=>x.status),['fulfilled','rejected']);assert.equal((await store.exportSnapshot()).customers[0].revision,4);});
await check('old exact retry preserves subsequent customer edits',async()=>{const result=await store.save(customer,'op-1',0);assert.equal(result.revision,1);assert.equal((await store.exportSnapshot()).customers[0].revision,4);});
await check('account and target isolation with empty independent stores',async()=>{for(const [account,target] of [['owner-B','live'],['owner-A','doomsday'],['owner-A','staging']]){const isolated=await openLocalCustomerStore(account,target,factory);assert.equal((await isolated.exportSnapshot()).customers.length,0);isolated.close();}});
await check('unsafe namespace inputs and separator collisions reject',async()=>{for(const args of [['','live'],['a:b','live'],['owner-A','../live']])assert.throws(()=>localCustomerDatabaseName(...args));assert.notEqual(localCustomerDatabaseName('a-b','c'),localCustomerDatabaseName('a','b-c'));});
await check('malformed customer and revision never write',async()=>{for(const data of [{...customer,name:''},{...customer,phone:42},{...customer,stripeKey:'no'},{...customer,id:'bad:id'}])assert.throws(()=>store.save(data,'invalid',4));for(const revision of [-1,1.5,NaN,Number.MAX_SAFE_INTEGER])assert.throws(()=>store.save(customer,'invalid',revision));assert.equal((await store.exportSnapshot()).pendingOperations.length,4);});
await check('caller mutation cannot change queued save payload',async()=>{const input={...customer,id:'customer-2'};const pending=store.save(input,'snapshot',0);input.name='Mutated';assert.equal((await pending).name,customer.name);});
await check('export is a detached consistent snapshot, not production backup format',async()=>{const snapshot=await store.exportSnapshot();assert.equal(snapshot.format,'fire-local-customers');snapshot.customers[0].name='Tampered';snapshot.pendingOperations.length=0;assert.equal((await store.exportSnapshot()).pendingOperations.length,5);assert.notEqual((await store.exportSnapshot()).customers[0].name,'Tampered');});
await check('storage unavailable rejects without memory fallback',async()=>{await assert.rejects(openLocalCustomerStore('owner-A','offline',undefined),/unavailable/);});
await check('newer schema refused and previous data retained',async()=>{const name=localCustomerDatabaseName('owner-A','future');factory.databases.set(name,{version:2,stores:new Map(),tail:Promise.resolve()});await assert.rejects(openLocalCustomerStore('owner-A','future',factory),{name:'VersionError'});assert.equal(factory.databases.get(name).version,2);});
await check('blocked open rejects and closes eventual connection',async()=>{factory.blocked=true;await assert.rejects(openLocalCustomerStore('owner-A','blocked',factory),/blocked/);factory.blocked=false;});
await check('closed store refuses writes',async()=>{store.close();await assert.rejects(store.save(customer,'closed',4),{name:'InvalidStateError'});});
console.log(`PASS ${passed}/${passed}: SIMULATED IndexedDB event/transaction tests; no browser, iPhone, server, Stripe or app activation.`);
