import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.'),db=new DatabaseSync(':memory:');
const files=readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort();
const migration=files.find(f=>f.endsWith('_stripe_provider_uniqueness.sql'));
assert.ok(migration);
for(const file of files.filter(f=>f!==migration))db.exec(readFileSync(root+'/drizzle/'+file,'utf8'));
db.exec("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic','now'); INSERT INTO estimates(id,customer_id,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e','c',10000,10000,5000,'now')");
const insert=(id,provider,type='balance',amount=10000)=>db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,'e',?,?,'paid',?,'now')").run(id,type,amount,provider);
insert('a','cs_collision');insert('b','cs_collision');
const snapshot=JSON.stringify(db.prepare('SELECT * FROM payments ORDER BY id').all());
assert.equal(db.prepare(readFileSync(root+'/scripts/stripe-ledger-preflight.sql','utf8').split(';')[0]).all().length,1);
assert.throws(()=>db.exec(readFileSync(root+'/drizzle/'+migration,'utf8')),/UNIQUE/);
assert.equal(JSON.stringify(db.prepare('SELECT * FROM payments ORDER BY id').all()),snapshot);
// Only the disposable fixture is changed to exercise a collision-free upgrade.
db.prepare("UPDATE payments SET provider_id='cs_other' WHERE id='b'").run();
db.exec(readFileSync(root+'/drizzle/'+migration,'utf8'));
for(const [id,provider,type,amount] of [['d','cs_collision','balance',10000],['t','cs_collision:tip','Tip',1000],['r','refund:a:request','Refund',-100]]){
 if(id!=='d')insert(id,provider,type,amount);
 assert.throws(()=>insert(id+'-duplicate',provider,type,amount),/UNIQUE/);
}
insert('manual-a','manual-reference','Cash App');insert('manual-b','manual-reference','Cash App');
assert.equal(db.prepare("SELECT COUNT(*) n FROM payments WHERE provider_id='manual-reference'").get().n,2);
console.log('PASS: collision preflight detects history; migration aborts without changing rows; clean upgrade enforces principal/tip/refund uniqueness; unrelated manual references remain compatible.');
