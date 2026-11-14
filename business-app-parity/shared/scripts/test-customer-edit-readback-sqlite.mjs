/** Gate 6: invoke the actual customer PATCH route against disposable native
 * SQLite, including ambiguous D1 acknowledgements. No hosted DB or customer.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
  address TEXT, lead_source TEXT, created_at TEXT NOT NULL
);
INSERT INTO customers VALUES
 ('first','Original','first@example.invalid','9185550100','123 Synthetic','Referral','2026-10-29'),
 ('other','Other','other@example.invalid','9185550101','555 Synthetic','Google','2026-10-29');`);
let user={email:'kylebrooks8605@gmail.com'},writes=0,readbacks=0;
let skipUpdate=false,throwAfterCommit=false,loseReadback=false,distortReadback=false,deleteAfterUpdate=false;
let concurrentContactClaim=null; // Inject another owner's write between preflight and UPDATE.
let concurrentSameCustomerEdit=false; // Another tab updates this SAME customer immediately before guarded write.
function prep(sql){
 return {sql,params:[],bind(...params){return {...this,params}},
  async first(){
   if(sql.startsWith('SELECT id,name,COALESCE(')){
    readbacks++;
    if(loseReadback){loseReadback=false;throw Error('Synthetic D1 SELECT unavailable');}
   }
   const saved=db.prepare(sql).get(...this.params)??null;
   if(sql.startsWith('SELECT id,name,COALESCE(')&&distortReadback&&saved){
    distortReadback=false;return {...saved,address:'Stale synthetic reply'};
   }
   return saved;
  },
  async all(){return {results:db.prepare(sql).all(...this.params)};},
  async run(){
   assert.ok(sql.startsWith('UPDATE customers SET'),'Only customer updates allowed');
   writes++;
   if(skipUpdate){skipUpdate=false;return {success:true,meta:{changes:0}};}
   if(concurrentContactClaim){
     const type=concurrentContactClaim;concurrentContactClaim=null;
     if(type==='email')db.prepare("UPDATE customers SET email=? WHERE id='other'").run(this.params[1]);
     if(type==='phone')db.prepare("UPDATE customers SET phone=? WHERE id='other'").run('9185550198');
     if(type==='name-address')db.prepare("UPDATE customers SET name='Concurrent Home',address='750 Shared Street' WHERE id='other'").run();
   }
   if(concurrentSameCustomerEdit){
     concurrentSameCustomerEdit=false;
     db.prepare("UPDATE customers SET name='Newer Tab Contact' WHERE id='first'").run();
   }
   const changes=db.prepare(sql).run(...this.params).changes;
   if(deleteAfterUpdate){deleteAfterUpdate=false;db.prepare('DELETE FROM customers WHERE id=?').run(this.params[5]);}
   if(throwAfterCommit){throwAfterCommit=false;throw Error('Synthetic D1 post-commit ACK lost');}
   return {success:true,meta:{changes:Number(changes)}};
  }
 };
}
const env={DB:{prepare:prep}},load=createRouteFixtureLoader(process.cwd(),env,()=>user);
const {PATCH}=load('app/api/customers/route.ts');
const customer=()=>db.prepare('SELECT id,name,email,phone,address,lead_source AS leadSource,created_at AS createdAt FROM customers WHERE id=?').get('first');
const request=(fields)=>new Request('https://synthetic.invalid/api/customers',{
 method:'PATCH',headers:{'content-type':'application/json'},
 body:JSON.stringify({id:'first',...customer(),...fields,
   expected:Object.fromEntries(['name','email','phone','address','leadSource']
     .map(key=>[key,customer()[key]??'']))})
});
const patch=fields=>PATCH(request(fields)),checks=[];
async function expect(status,fields,label){
 const response=await patch(fields);
 assert.equal(response.status,status,label);
 if(status===503){const payload=await response.json();assert.equal(payload.saveUncertain,true,label+' uncertainty indicator');}
 checks.push(label);return response;
}
try{
 user=null;const beforeAuth=writes;await expect(401,{name:'Unauthorized'},'Anonymous blocked');assert.equal(writes,beforeAuth);
 user={email:'outsider@example.invalid'};await expect(401,{name:'Wrong owner'},'Nonowner blocked');assert.equal(writes,beforeAuth);
 user={email:'kylebrooks8605@gmail.com'};
 await expect(400,{email:'not an email'},'Invalid email blocked');
 await expect(409,{email:'other@example.invalid'},'Duplicate email blocked');
 await expect(409,{phone:'9185550101'},'Duplicate phone blocked');
 await expect(409,{name:'  other ',address:'  555 Synthetic  '},'Duplicate name and address blocked with whitespace/case normalized');
 assert.equal(customer().name,'Original','Blocked identity edit preserved original customer');
 // Two customers can edit different records concurrently. Duplicate preflight
 // sees the older contact, then another edit claims the same email/phone before
 // the guarded SQL UPDATE. The actual SQLite write must atomically refuse it.
 concurrentContactClaim='email';
 const emailRace=await patch({email:'race-claimed@example.invalid'});
 assert.equal(emailRace.status,409,'Concurrent email claim blocks customer save at SQL boundary');
 assert.equal((await emailRace.json()).saveUncertain,true,'Concurrent email race returns an actionable unconfirmed save');
 assert.equal(customer().email,'first@example.invalid','Email race preserves original customer');
 assert.equal(db.prepare("SELECT email FROM customers WHERE id='other'").get().email,'race-claimed@example.invalid');
 db.prepare("UPDATE customers SET email='other@example.invalid' WHERE id='other'").run();
 checks.push('Atomic conflict on concurrent email claim');
 concurrentContactClaim='phone';
 const phoneRace=await patch({phone:'+1 (918) 555-0198'});
 assert.equal(phoneRace.status,409,'Concurrent normalized phone claim blocks customer save at SQL boundary');
 assert.equal((await phoneRace.json()).saveUncertain,true,'Concurrent phone race returns an unconfirmed save');
 assert.equal(customer().phone,'9185550100','Phone race preserves original customer');
 assert.equal(db.prepare("SELECT phone FROM customers WHERE id='other'").get().phone,'9185550198');
 db.prepare("UPDATE customers SET phone='9185550101' WHERE id='other'").run();
 checks.push('Atomic conflict on concurrent +1/10-digit phone claim');
 concurrentContactClaim='name-address';
 const nameAddressRace=await patch({name:'Concurrent Home',address:'750 Shared Street'});
 assert.equal(nameAddressRace.status,409,'Concurrent name/address claim blocked at SQLite UPDATE boundary');
 assert.equal((await nameAddressRace.json()).saveUncertain,true,'Concurrent identity conflict asks for authoritative refresh');
 assert.equal(customer().name,'Original','Race must not overwrite original customer identity');
 assert.equal(db.prepare("SELECT name FROM customers WHERE id='other'").get().name,'Concurrent Home');
 db.prepare("UPDATE customers SET name='Other',address='555 Synthetic' WHERE id='other'").run();
 checks.push('Atomic conflict on concurrent name and address claim');
 const saved=await expect(200,{name:'Updated Name',address:'New Synthetic Address'},'Exact persisted edit confirmed');
 assert.equal((await saved.json()).customer.name,'Updated Name');
 assert.equal(customer().address,'New Synthetic Address');
 await expect(200,{name:'Updated Name'},'No-op save remains safe');
 // A saved contact opened in two different owner tabs must be compared at
 // the actual SQLite UPDATE boundary. An earlier tab may not overwrite the
 // newer owner's contact, even when no duplicate customer ID is involved.
 const staleRequest=request({address:'Stale Tab Address'});
 const fresh=await patch({name:'Latest Owner Contact'});
 assert.equal(fresh.status,200,'More recent owner contact edit committed');
 const stale=await PATCH(staleRequest);
 assert.equal(stale.status,409,'Stale original snapshot rejects overwrite');
 const staleBody=await stale.json();
 assert.equal(staleBody.staleCustomer,true,'Stale owner gets explicit conflict response');
 assert.equal(staleBody.saveUncertain,true,'No blind retry on an unconfirmed old edit');
 assert.equal(customer().name,'Latest Owner Contact','Fresh contact survives older-tab save');
 assert.equal(customer().address,'New Synthetic Address','Stale tab address did not overwrite saved value');
 checks.push('Original customer snapshot prevents stale two-tab contact overwrite');
 // A TOCTOU edit between initial identity preflight and UPDATE is blocked by
 // the SQL WHERE condition, not only by comparing two earlier GET results.
 concurrentSameCustomerEdit=true;
 const raced=await patch({address:'Attempted Racing Address'});
 assert.equal(raced.status,409,'Concurrent edit before SQL UPDATE is refused');
 assert.equal((await raced.json()).staleCustomer,true,'Actual race detected from D1 readback');
 assert.equal(customer().name,'Newer Tab Contact','Concurrent owner name preserved');
 assert.equal(customer().address,'New Synthetic Address','Other tab cannot overwrite address');
 checks.push('Actual concurrent same-customer race at SQLite write boundary');
 // Later explicitly refreshed snapshot may safely save a different field.
 const refreshed=await patch({address:'Reviewed New Address'});
 assert.equal(refreshed.status,200,'Latest-source deliberate new save is allowed');
 assert.equal(customer().name,'Newer Tab Contact','Updated contact stays intact after refreshed edit');
 assert.equal(customer().address,'Reviewed New Address');
 checks.push('Refreshed source can save without dropping another tab changes');
 const malformed=await PATCH(new Request('https://synthetic.invalid/api/customers',{
  method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({
    id:'first',name:'Bad Snapshot',expected:{name:'Only the Name'}
  })
 }));
 assert.equal(malformed.status,400,'Incomplete original contact snapshot refused');
 assert.equal(customer().name,'Newer Tab Contact','Invalid snapshot did not modify customer');
 checks.push('Malformed optimistic original snapshot refused without writes');

 skipUpdate=true;
 await expect(503,{name:'Not Actually Written'},'Nonthrowing zero-change D1 update rejected');
 assert.equal(customer().name,'Newer Tab Contact','Synthetic no-op must retain the latest competing owner edit');
 distortReadback=true;
 await expect(503,{address:'Real DB New Address'},'Misleading stale D1 SELECT blocked');
 assert.equal(customer().address,'Real DB New Address');
 const readCount=readbacks;
 throwAfterCommit=true;
 const confirmed=await expect(200,{name:'Confirmed Despite Lost ACK'},'Post-commit lost ACK recovered from actual SQLite');
 assert.equal((await confirmed.json()).customer.name,customer().name);
 assert.ok(readbacks>readCount);
 loseReadback=true;
 await expect(503,{name:'Committed But Read Unavailable'},'Readback failure cannot claim success');
 assert.equal(customer().name,'Committed But Read Unavailable');
 await expect(200,{email:'',phone:'',address:''},'Clearing optional fields persisted as empty strings');
 assert.equal(customer().phone,null);assert.equal(customer().email,null);
 deleteAfterUpdate=true;
 await expect(503,{name:'Deleted After Update'},'Concurrent missing customer cannot report success');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customers WHERE id=?').get('first').n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customers WHERE id=?').get('other').n,1);
 console.log('PASS '+checks.length+'/'+checks.length+': actual owner-authenticated customer PATCH on native SQLite; exact field persistence, nullable clears, stale/zero-write result, lost ACK and missing readback fail closed or recover; no real customers/provider.');
} finally{db.close();}
