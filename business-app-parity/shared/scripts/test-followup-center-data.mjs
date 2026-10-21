/** Actual owner-only follow-up GET SQL, synthetic SQLite; no hosted reads or writes. */
import assert from'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';import{DatabaseSync}from'node:sqlite';import vm from'node:vm';import ts from'typescript';
const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this;},async all(){return{results:db.prepare(sql).all(...this.args)};}}}};let user={email:'kylebrooks8605@gmail.com'};
function load(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>{assert.ok(name in imports,'Unexpected import '+name);return imports[name];},Response,URL,atob,btoa,Date});return exports;}
const location=load('lib/service-location.ts',{}),api=load('app/api/followups/route.ts',{'../../../lib/service-location':location,'cloudflare:workers':{env:{DB}},'../../chatgpt-auth':{getChatGPTUser:async()=>user}});
try{
 db.exec("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic customer','2026-10-01T12:00:00Z'),('other','Synthetic other','2026-10-01T12:00:00Z');INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e','c','sent',10000,10000,5000,'2026-10-01T12:00:00Z'),('other-e','other','sent',10000,10000,5000,'2026-10-01T12:00:00Z')");
 const put=db.prepare('INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)');
 put.run('prepared','c','e','email_prepared','invoice','PRIVATE BODY MUST NOT LEAK','2026-10-18T12:00:00Z');
 put.run('copied','c','e','copy','invoice','PRIVATE BODY MUST NOT LEAK','2026-10-19T12:00:00Z');
 let result=await(await api.GET(new Request('https://example.invalid/api/followups'))).json();assert.equal(result.estimates.find(e=>e.id==='e').lastInvoiceSentAt,null,'Preparing/copying invoice never confirms send');
 put.run('confirmed','c','e','email_confirmed','invoice','PRIVATE BODY MUST NOT LEAK','2026-10-17T12:00:00Z');
 put.run('other','other','other-e','text_confirmed','invoice','PRIVATE OTHER BODY','2026-10-20T12:00:00Z');
 // Even an inconsistent legacy message relation must not leak another customer's status.
 put.run('wrong-link','other','e','text_confirmed','invoice','PRIVATE WRONG BODY','2026-10-21T12:00:00Z');
 const snapshot=JSON.stringify(db.prepare('SELECT * FROM customer_messages ORDER BY id').all());
 const response=await api.GET(new Request('https://example.invalid/api/followups'));assert.equal(response.status,200);result=await response.json();assert.equal(result.estimates.find(e=>e.id==='e').lastInvoiceSentAt,'2026-10-17T12:00:00Z');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(db.prepare('SELECT * FROM customer_messages ORDER BY id').all()),snapshot);
 assert.equal((await api.GET(new Request('https://example.invalid/api/followups?limit=51'))).status,400);user=null;assert.equal((await api.GET(new Request('https://example.invalid/api/followups'))).status,401);user={email:'other@example.invalid'};assert.equal((await api.GET(new Request('https://example.invalid/api/followups'))).status,401);
 console.log('PASS: owner-only exact-customer invoice-send metadata, preparation/copy exclusions, inconsistent legacy relationship isolation, private-body restraint, read-only SQL and unauthorized/invalid request refusal.');
}finally{db.close();}
