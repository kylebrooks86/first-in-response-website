/**
 * FIRE Gate 6: real owner estimate/invoice share endpoints against disposable
 * native SQLite; focused ONLY on newly added ownership + CAS/readback guards.
 *
 * No host, network, customer data, Stripe, D1, R2 or device interaction.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const db=new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=OFF;
CREATE TABLE customers(id TEXT PRIMARY KEY);
CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,share_token TEXT);
CREATE TABLE invoices(id TEXT PRIMARY KEY,customer_id TEXT,estimate_id TEXT,share_token TEXT);`);

let owner=true;
let afterRead=null;
let lostAck=false;
let readCount=0,writeCount=0;
const database={
  prepare(sql){
    const statement=db.prepare(sql);
    return {bind(...values){
      return {
        async first(){
          readCount++;
          const result=statement.get(...values);
          // Simulate concurrent customer reassignment after initial SELECT.
          // The returned row still describes the PRE-race relationship.
          if(afterRead&&sql.startsWith('SELECT ')){
            const fn=afterRead;afterRead=null;fn();
          }
          return result;
        },
        async run(){
          writeCount++;
          const out=statement.run(...values);
          if(lostAck){lostAck=false;throw Error('Synthetic D1 ACK lost after committed write');}
          return {meta:{changes:out.changes}};
        }
      };
    }};
  },
};
const modules={};
for(const kind of ['estimates','invoices']){
  const route=`app/api/${kind}/[id]/share/route.ts`;
  const code=ts.transpileModule(readFileSync(route,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText;
  const exports={};
  vm.runInNewContext(code,{
    exports,
    require:name=>name==='cloudflare:workers'?{env:{DB:database}}:
      {getChatGPTUser:async()=>owner?{email:'kylebrooks8605@gmail.com'}:null},
    Response,Request,crypto:webcrypto,console,
  },{filename:route});
  assert.equal(typeof exports.POST,'function');
  modules[kind]=exports;
}
const reset=()=>{
  db.exec("DELETE FROM invoices; DELETE FROM estimates; DELETE FROM customers;");
  db.exec("INSERT INTO customers VALUES ('cust-a'),('cust-b');");
  db.exec("INSERT INTO estimates VALUES ('est-a','cust-a',NULL);");
  db.exec("INSERT INTO invoices VALUES ('inv-a','cust-a','est-a',NULL);");
  owner=true;afterRead=null;lostAck=false;readCount=0;writeCount=0;
};
const request=async(kind,id)=>{
  const response=await modules[kind].POST(
    new Request('https://qa-synthetic.invalid/api/'+kind+'/'+id+'/share',{method:'POST'}),
    {params:Promise.resolve({id})});
  return {status:response.status,body:await response.json(),headers:response.headers};
};
const token=(kind,id)=>db.prepare('SELECT share_token AS token FROM "'+kind+'" WHERE id=?').get(id)?.token;
const assertUnshared=(result,kind,id)=>{
  assert.equal(result.status,409);
  assert.equal(Object.hasOwn(result.body,'shareToken'),false);
  assert.equal(token(kind,id),null);
  assert.equal(result.headers.get('cache-control'),'private, no-store');
};
let checks=0;
const confirm=()=>{checks++;};

reset();owner=false;
let outcome=await request('estimates','est-a');
assert.equal(outcome.status,401);
outcome=await request('invoices','inv-a');
assert.equal(outcome.status,401);
assert.equal(readCount,0);assert.equal(writeCount,0);
confirm();

reset();
outcome=await request('estimates','missing-est');
assert.equal(outcome.status,404);
outcome=await request('invoices','missing-inv');
assert.equal(outcome.status,404);
assert.equal(writeCount,0);
confirm();

reset();
outcome=await request('estimates','est-a');
assert.equal(outcome.status,200);
assert.match(outcome.body.shareToken,/^[a-f0-9]{32}$/);
assert.equal(outcome.body.customerPath,'/estimate/'+outcome.body.shareToken);
assert.equal(token('estimates','est-a'),outcome.body.shareToken);
let again=await request('estimates','est-a');
assert.equal(again.body.shareToken,outcome.body.shareToken);
assert.equal(writeCount,1,'Valid repeated estimate link is not rotated');
confirm();

reset();
outcome=await request('invoices','inv-a');
assert.equal(outcome.status,200);
assert.match(outcome.body.shareToken,/^[a-f0-9]{32}$/);
assert.equal(token('invoices','inv-a'),outcome.body.shareToken);
again=await request('invoices','inv-a');
assert.equal(again.body.shareToken,outcome.body.shareToken);
assert.equal(writeCount,1,'Valid repeated invoice link is not rotated');
confirm();

reset();
db.exec("UPDATE invoices SET customer_id='cust-b',share_token='secret-old-invoice-token' WHERE id='inv-a';");
outcome=await request('invoices','inv-a');
assert.equal(outcome.status,409);
assert.equal(Object.hasOwn(outcome.body,'shareToken'),false);
assert.equal(token('invoices','inv-a'),'secret-old-invoice-token');
assert.equal(writeCount,0,'Invalid invoice must not even write');
confirm();

reset();
db.exec("UPDATE invoices SET customer_id='cust-b' WHERE id='inv-a';");
outcome=await request('invoices','inv-a');
assertUnshared(outcome,'invoices','inv-a');
assert.equal(writeCount,0);
confirm();

reset();
db.exec("UPDATE invoices SET estimate_id='missing-est' WHERE id='inv-a';");
outcome=await request('invoices','inv-a');
assertUnshared(outcome,'invoices','inv-a');
assert.equal(writeCount,0);
confirm();

reset();
db.exec("DELETE FROM customers WHERE id='cust-a';");
outcome=await request('invoices','inv-a');
assertUnshared(outcome,'invoices','inv-a');
outcome=await request('estimates','est-a');
assertUnshared(outcome,'estimates','est-a');
assert.equal(writeCount,0);
confirm();

reset();
afterRead=()=>db.exec("UPDATE invoices SET customer_id='cust-b' WHERE id='inv-a';");
outcome=await request('invoices','inv-a');
assertUnshared(outcome,'invoices','inv-a');
assert.equal(writeCount,1,'Write safely attempts conditional CAS but cannot mint invalid token');
confirm();

reset();
afterRead=()=>db.exec("UPDATE estimates SET customer_id='missing-customer' WHERE id='est-a';");
outcome=await request('estimates','est-a');
assertUnshared(outcome,'estimates','est-a');
assert.equal(writeCount,1);
confirm();

reset();lostAck=true;
outcome=await request('estimates','est-a');
assert.equal(outcome.status,200);
assert.equal(outcome.body.shareToken,token('estimates','est-a'),
  'A lost D1 ACK must read back the actual saved estimate token');
confirm();

reset();lostAck=true;
outcome=await request('invoices','inv-a');
assert.equal(outcome.status,200);
assert.equal(outcome.body.shareToken,token('invoices','inv-a'),
  'A lost D1 ACK must read back the actual saved invoice token');
confirm();

reset();
db.exec("UPDATE invoices SET customer_id='cust-b' WHERE id='inv-a';");
db.exec("UPDATE invoices SET share_token='known-old-token' WHERE id='inv-a';");
outcome=await request('invoices','inv-a');
assert.equal(outcome.status,409);
assert.equal(Object.hasOwn(outcome.body,'shareToken'),false);
assert.equal(writeCount,0);
confirm();

console.log('PASS '+checks+' new Gate6 owner share-link ownership and lost-ACK cases on disposable native SQLite. No hosted/provider writes.');
db.close();
