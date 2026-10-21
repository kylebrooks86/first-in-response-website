import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
/** Native synthetic D1 race tests: never send an actual customer message. */
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let owner={email:'kylebrooks8605@gmail.com'},calls=0;
const env={DB:{prepare(sql){calls++;const s=db.prepare(sql);return{bind(...params){return{first:async()=>s.get(...params)??null,run:async()=>({meta:{changes:s.run(...params).changes}})}}}}}};
function load(path,deps){const exports={};const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(js,{exports,require:name=>{if(!(name in deps))throw Error('Unexpected import '+name);return deps[name]},Response,Date});return exports;}
const timing=load('lib/follow-up-timing.ts',{});
const route=load('app/api/followup-actions/route.ts',{'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>owner},'../../../lib/follow-up-timing':timing});
const stamp=n=>new Date(Date.now()-n*86400000).toISOString();
const key=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
function job(id){
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,'Synthetic '+id,stamp(10));
 db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)').run('e-'+id,'c-'+id,'sent',10000,10000,5000,stamp(10));
 db.prepare('INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)').run('sent-'+id,'c-'+id,'e-'+id,'text_confirmed','estimate','Synthetic sent proof',stamp(4));
}
const req=(id,action,n)=>new Request('https://example.invalid/api/followup-actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:'c-'+id,estimateId:'e-'+id,action,operationId:key(n)})});
const count=n=>db.prepare('SELECT COUNT(*) AS total FROM customer_messages WHERE id=?').get('followup-action:'+key(n)).total;
let assertions=0;const check=(yes,what)=>{assert.ok(yes,what);assertions++;};
try{
 job('double');
 const both=await Promise.all([route.POST(req('double','contacted',1)),route.POST(req('double','contacted',1))]);
 check(both.map(r=>r.status).sort().join(',')==='200,201','Two matching concurrent writes yield one save and one replay');
 const receipts=await Promise.all(both.map(r=>r.json()));
 check(receipts.every(r=>r.action==='contacted'&&r.createdAt===receipts[0].createdAt),'Both callers recover the identical saved receipt');
 check(count(1)===1,'Exactly one contact row');
 const replay=await route.POST(req('double','contacted',1));check(replay.status===200&&(await replay.json()).createdAt===receipts[0].createdAt,'Delayed retry does not create a new receipt');
 check(count(1)===1,'Still one contact after retry');
 check((await route.POST(req('double','snooze',1))).status===409,'Reused operation cannot change type');
 job('conflict');
 const conflict=await Promise.all([route.POST(req('conflict','snooze',2)),route.POST(req('conflict','contacted',2))]);
 check(conflict.map(r=>r.status).sort().join(',')==='201,409','Same operation with competing actions has one winner');
 check(count(2)===1,'Competing action writes one event');
 job('snooze');
 const pair=await Promise.all([route.POST(req('snooze','snooze',3)),route.POST(req('snooze','snooze',3))]);
 check(pair.map(r=>r.status).sort().join(',')==='200,201','Snooze double-submit yields one save and one replay');
 const p=await Promise.all(pair.map(r=>r.json()));check(Boolean(p[0].snoozeUntil)&&p[0].snoozeUntil===p[1].snoozeUntil,'Persisted snooze date matches');
 check(count(3)===1,'One saved snooze event');
 owner=null;const n=calls;check((await route.POST(req('double','contacted',4))).status===401&&calls===n,'Unauthenticated write blocked');
 owner={email:'other@example.invalid'};check((await route.POST(req('double','contacted',4))).status===401&&calls===n,'Other owner blocked');
 console.log('PASS '+assertions+' synthetic native SQLite owner follow-up concurrent saves and conflicting action guards.');
}finally{db.close();}
