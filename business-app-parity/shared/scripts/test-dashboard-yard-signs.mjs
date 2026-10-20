/** Real owner-only yard sign dashboard API, with synthetic in-memory SQLite. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const observed=[];
const env={DB:{prepare(sql){observed.push(sql);return {all:async()=>({results:db.prepare(sql).all()})};}}};
function load(path,imports){
 const exports={};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];},Response});
 return exports;
}
const flags=load('lib/customer-activity-flags.ts',{});
const helper=load('lib/dashboard-yard-signs.ts',{'./customer-activity-flags':flags});
let user={email:'kylebrooks8605@gmail.com'};
const api=load('app/api/dashboard-yard-signs/route.ts',{'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user},'../../../lib/dashboard-yard-signs':helper});
let checks=0;const check=(yes,message)=>{assert.ok(yes,message);checks++;};
const insertCustomer=(id,name)=>db.prepare('INSERT INTO customers(id,name,address,created_at) VALUES(?,?,?,?)').run(id,name,'Property '+id,'2026-10-18T12:00:00Z');
const insertNote=(id,customerId,body,createdAt)=>db.prepare('INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)').run(id,customerId,body,createdAt);
const place=(day,location)=>flags.signPlacedNote(day,location);
try{
 insertCustomer('a','Amy');insertCustomer('b','Bren');insertCustomer('c','Chris');insertCustomer('d','Dana');
 insertNote('a-1','a',place('2026-10-19','Front yard'),'2026-10-19T12:00:00Z');
 insertNote('a-2','a',flags.SIGN_PICKED_UP_NOTE,'2026-10-20T13:00:00Z');
 insertNote('a-3','a',place('2026-10-28','Side gate'),'2026-10-20T14:00:00Z');
 insertNote('b-1','b',place('2026-10-20','Driveway'),'2026-10-18T12:00:00Z');
 insertNote('c-1','c',place('2026-10-24','By road'),'2026-10-19T12:00:00Z');
 insertNote('c-2','c',flags.SIGN_PICKED_UP_NOTE,'2026-10-20T12:00:00Z');
 insertNote('d-1','d','Customer talked about a yard sign and review','2026-10-20T12:00:00Z');
 insertNote('d-2','d','[FIRE FLAG] YARD_SIGN_PLACED | pickup:2026-02-30 | location:Fake','2026-10-20T12:00:01Z');
 insertNote('d-3','d',flags.REVIEW_RECEIVED_NOTE,'2026-10-20T12:00:02Z');
 const response=await api.GET(),data=await response.json();
 check(response.status===200,'Owner can read summarized sign locations');
 check(response.headers.get('cache-control')==='no-store','Dashboard pickup reads cannot be cached');
 check(data.signs.length===2,'Only real outstanding placements are returned');
 check(data.signs[0].customerId==='b'&&data.signs[0].pickupDate==='2026-10-20','Urgent pickup appears before later dates');
 check(data.signs[1].customerId==='a'&&data.signs[1].location==='Side gate'&&data.signs[1].pickupDate==='2026-10-28','New placement after pickup remains active and retains exact location');
 check(!data.signs.some(s=>s.customerId==='c'||s.customerId==='d'),'Retrieved, malformed and review-only events never generate pickup alerts');
 check(data.signs.every(s=>!('email'in s)&&!('phone'in s)&&!('body'in s)),'Summary does not export personal messaging history or notes');
 check(observed.every(sql=>/^SELECT\s/i.test(sql.trim())),'Endpoint never modifies customer notes, signs or tasks');
 const reads=observed.length;
 user=null;check((await api.GET()).status===401&&observed.length===reads,'Unauthenticated owner dashboard cannot read sign locations');
 user={email:'someone@example.invalid'};check((await api.GET()).status===401&&observed.length===reads,'Wrong owner cannot read sign locations');
 user={email:'kylebrooks8605@gmail.com'};
 insertNote('b-2','b',flags.SIGN_PICKED_UP_NOTE,'2026-10-20T15:00:00Z');
 const after=await (await api.GET()).json();
 check(after.signs.length===1&&after.signs[0].customerId==='a','Confirmed sign pickup removes it without impacting other customers');
 const broken=load('app/api/dashboard-yard-signs/route.ts',{'cloudflare:workers':{env:{DB:{prepare:()=>{throw Error('Synthetic read failure');}}}},'../../chatgpt-auth':{getChatGPTUser:async()=>user},'../../../lib/dashboard-yard-signs':helper});
 const failure=await broken.GET();
 check(failure.status===503&&(await failure.json()).error.includes('Unable to verify'),'Database failures never masquerade as zero outstanding signs');
 console.log(`PASS ${checks} read-only sign API checks; synthetic D1-compatible SQLite, owner auth, pickup lifecycle and honest error handling.`);
}finally{db.close();}
