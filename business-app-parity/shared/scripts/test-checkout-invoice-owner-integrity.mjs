/** FIRE checkout integrity — source-derived SQL, disposable native SQLite ONLY.
 * Ensures an invoice associated with a DIFFERENT customer cannot determine
 * a payment amount, create a checkout reservation, or pass post-Stripe review.
 * No real Stripe, hosted QA, D1, money, or cloud credentials are used.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root=resolve(process.argv[2]||'.');
const file='app/api/payments/checkout/route.ts';
const source=readFileSync(resolve(root,file),'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const queries=[];
function walk(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
    node.expression.name.text==='prepare'&&node.arguments.length===1){
    const sourceLiteral=node.arguments[0];
    if(ts.isNoSubstitutionTemplateLiteral(sourceLiteral)||ts.isStringLiteral(sourceLiteral)){
      const sql=vm.runInNewContext('('+sourceLiteral.getText(ast)+')',{}, {timeout:1000});
      queries.push(sql);
    }
  }
  ts.forEachChild(node,walk);
}
walk(ast);
const one=(needle,label)=>{
  const matches=queries.filter(s=>s.includes(needle));
  assert.equal(matches.length,1,'Actual source must have exactly one '+label+' SQL query');
  return matches[0];
};
const initial=one('FROM estimates e JOIN customers c ON c.id=e.customer_id',
  'initial customer checkout');
const after=one('FROM estimates e WHERE e.id=?','post-Stripe amount revalidation');
const reserve=one("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at)",
  'atomic checkout reservation');
for(const sql of [initial,after]){
  assert.match(sql,/inv\.estimate_id=e\.id AND inv\.customer_id=e\.customer_id/);
  assert.match(sql,/inv\.customer_id IS NOT e\.customer_id/);
  assert.match(sql,/AS invoiceOwnershipMismatch/);
}
assert.match(reserve,/NOT EXISTS\(SELECT 1 FROM invoices inv WHERE inv\.estimate_id=estimates\.id AND inv\.customer_id IS NOT estimates\.customer_id\)/);
assert.ok(source.indexOf('if(Number(row.invoiceOwnershipMismatch)!==0)')>=0&&
 source.indexOf('if(Number(row.invoiceOwnershipMismatch)!==0)')<
 source.indexOf('await fetch("https://api.stripe.com/v1/checkout/sessions"'),
 'Mismatch must stop BEFORE calling Stripe');
assert.match(source,/Number\(current\.invoiceOwnershipMismatch\)!==0/);
for(const p of ['app/estimate/[token]/page.tsx','app/pay/[id]/page.tsx']){
  const text=readFileSync(resolve(root,p),'utf8');
  assert.match(text,/inv\.estimate_id=e\.id AND inv\.customer_id=e\.customer_id/);
  assert.match(text,/inv\.customer_id IS NOT e\.customer_id/);
  assert.match(text,/Number\(row\.invoiceOwnershipMismatch\)===0/);
}

const db=new DatabaseSync(':memory:');
let n=12;
try{
  db.exec(`CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT);
  CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,share_token TEXT,status TEXT,
    accepted_at TEXT,signed_at TEXT,deposit_cents INTEGER,total_cents INTEGER);
  CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,total_cents INTEGER);
  CREATE TABLE estimate_items(estimate_id TEXT,name TEXT);
  CREATE TABLE payments(estimate_id TEXT,amount_cents INTEGER,status TEXT,type TEXT);
  CREATE TABLE notifications(estimate_id TEXT,type TEXT,resolved_at TEXT);
  CREATE TABLE payment_checkout_sessions(id TEXT,estimate_id TEXT,type TEXT,
    amount_cents INTEGER,status TEXT,created_at TEXT);`);
  db.prepare('INSERT INTO customers(id,name) VALUES(?,?)').run('ca','Synthetic Alpha');
  db.prepare('INSERT INTO customers(id,name) VALUES(?,?)').run('cb','Synthetic Bravo');
  const addEstimate=db.prepare("INSERT INTO estimates(id,customer_id,share_token,status,accepted_at,signed_at,deposit_cents,total_cents) VALUES(?,?,?,'completed','now','now',10000,20000)");
  addEstimate.run('ea','ca','alpha-token');addEstimate.run('eb','cb','bravo-token');
  db.prepare("INSERT INTO estimate_items(estimate_id,name) VALUES('ea','Synthetic Cleaning')").run();
  db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents) VALUES('ia','ea','cb',77777)").run();
  db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents) VALUES('ib','eb','cb',24000)").run();
  const initialStmt=db.prepare(initial),afterStmt=db.prepare(after);
  let a=initialStmt.get('alpha-token'),b=initialStmt.get('bravo-token');
  assert.equal(a.customer,'Synthetic Alpha');
  assert.equal(a.totalCents,20000,'Never use another customer invoice total of 77777');
  assert.equal(a.invoiceOwnershipMismatch,1,'Untrusted invoice linkage must be visible as a blocker');
  assert.equal(b.customer,'Synthetic Bravo');assert.equal(b.totalCents,24000);
  assert.equal(b.invoiceOwnershipMismatch,0);
  let follow=afterStmt.get('ea');
  assert.equal(follow.totalCents,20000);assert.equal(follow.invoiceOwnershipMismatch,1);
  let reserveStmt=db.prepare(reserve);
  assert.equal(reserveStmt.run('synthetic-lock-mismatch','ea','balance',10000,'now','ea','ea').changes,0,
    'Atomic reservation must not create a checkout lock for wrong-customer invoice');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payment_checkout_sessions").get().count,0);
  n+=9;
  // Legitimate invoice relationship must preserve normal amount and reservation.
  db.prepare("UPDATE invoices SET customer_id='ca',total_cents=26000 WHERE id='ia'").run();
  a=initialStmt.get('alpha-token');follow=afterStmt.get('ea');
  assert.equal(a.totalCents,26000);assert.equal(a.invoiceOwnershipMismatch,0);
  assert.equal(follow.totalCents,26000);assert.equal(follow.invoiceOwnershipMismatch,0);
  assert.equal(reserveStmt.run('synthetic-legitimate-lock','ea','balance',16000,'now','ea','ea').changes,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM payment_checkout_sessions").get().count,1);
  n+=6;
  console.log('PASS '+n+' source/SQLite FIRE public checkout invoice-customer ownership checks. No provider calls, real customers or remote data.');
}finally{db.close();}
