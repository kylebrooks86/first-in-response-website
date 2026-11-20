/** Gate 6 — prove change-request receipt lookups obey the CURRENT bearer
 * share token, even when it rotates after a public request begins.
 * All SQL comes from the actual committed API route. In-memory SQLite only.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root=resolve(process.argv[2]||'.');
const route='app/api/public/estimates/[token]/change-request/route.ts';
const source=readFileSync(resolve(root,route),'utf8');
const ast=ts.createSourceFile(route,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const statements=[];
const visit=node=>{
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
     node.expression.name.text==='bind'&&ts.isCallExpression(node.expression.expression)){
    const p=node.expression.expression;
    if(ts.isPropertyAccessExpression(p.expression)&&p.expression.name.text==='prepare'&&p.arguments[0]){
      statements.push({source:p.arguments[0].getText(ast),args:node.arguments.map(x=>x.getText(ast))});
    }
  }
  ts.forEachChild(node,visit);
};
visit(ast);
const one=(match,label)=>{
  const found=statements.filter(s=>s.source.includes(match));
  assert.equal(found.length,1,'Exactly one actual route SQL statement: '+label);
  return found[0];
};
const id=one('WHERE r.id=? AND e.share_token=?','idempotent receipt');
const open=one('WHERE r.estimate_id=? AND r.customer_id=?','same-message open request');
const insert=one('INSERT INTO estimate_change_requests','conditional insertion');
const notice=one('INSERT INTO notifications','paired notification');
assert.deepEqual(id.args,['requestId','token']);
assert.deepEqual(open.args,['estimate.id','estimate.customerId','message','token']);
assert.deepEqual(insert.args,['requestId','message','now','estimate.id','token','requestId','message']);
assert.deepEqual(notice.args,[
  "'change:'+requestId",'`${estimate.customer} requested an estimate change`','requestId',
  'estimate.id','estimate.customerId','message','now',"'change:'+requestId"
]);
const sql=statement=>vm.runInNewContext('('+statement.source+')',{}, {timeout:1000});
const byId=sql(id),byOpen=sql(open),write=sql(insert),notify=sql(notice);
assert.match(byId,/JOIN estimates e ON e.id=r.estimate_id AND e.customer_id=r.customer_id/);
assert.match(byId,/r.id=\? AND e.share_token=\?/);
assert.match(byOpen,/r.status='open' AND e.share_token=\?/);
assert.match(write,/e.id=\? AND e.share_token=\? AND e.accepted_at IS NULL/);

let checks=8;
const db=new DatabaseSync(':memory:');
try{
  db.exec(`CREATE TABLE estimates(
    id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,share_token TEXT NOT NULL,
    accepted_at TEXT,status TEXT NOT NULL
  );
  CREATE TABLE estimate_change_requests(
    id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,customer_id TEXT NOT NULL,
    message TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL
  );
  CREATE TABLE notifications(
    id TEXT PRIMARY KEY,type TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,
    customer_id TEXT,estimate_id TEXT,created_at TEXT NOT NULL
  );`);
  const newEstimate=db.prepare("INSERT INTO estimates(id,customer_id,share_token,status) VALUES(?,?,?,'sent')");
  newEstimate.run('alpha','customer-a','alpha-first');
  newEstimate.run('bravo','customer-b','bravo-first');
  const newRequest=db.prepare("INSERT INTO estimate_change_requests(id,estimate_id,customer_id,message,status,created_at) VALUES(?,?,?,?,'open',?)");
  newRequest.run('a-original','alpha','customer-a','Synthetic driveway request','t0');
  newRequest.run('b-original','bravo','customer-b','Synthetic driveway request','t0');
  const readId=db.prepare(byId),readOpen=db.prepare(byOpen),save=db.prepare(write),saveNotice=db.prepare(notify);
  const read=(key,token)=>readId.get(key,token);
  const find=(estimate,customer,message,token)=>readOpen.get(estimate,customer,message,token);
  const record=(key,estimate,token,message,customer)=>
    ({inserted:save.run(key,message,'t1',estimate,token,key,message).changes,
      notified:saveNotice.run('change:'+key,customer+' requested an estimate change',
        key,estimate,customer,message,'t1','change:'+key).changes});
  assert.equal(read('a-original','alpha-first').customerId,'customer-a');
  assert.equal(find('alpha','customer-a','Synthetic driveway request','alpha-first').id,'a-original');
  assert.equal(read('b-original','alpha-first'),undefined,'A token cannot recover a B receipt');
  assert.equal(read('a-original','bravo-first'),undefined,'B token cannot recover an A receipt');
  checks+=4;
  db.prepare('UPDATE estimates SET share_token=? WHERE id=?').run('alpha-rotated','alpha');
  assert.equal(read('a-original','alpha-first'),undefined,'Revoked token cannot read previous requestId');
  assert.equal(find('alpha','customer-a','Synthetic driveway request','alpha-first'),undefined,
    'Revoked token cannot recover prior open request');
  assert.equal(read('a-original','alpha-rotated').estimateId,'alpha',
    'Replacement token can read its own valid receipt');
  assert.equal(record('a-stale','alpha','alpha-first','Synthetic stale request','customer-a').inserted,0);
  assert.equal(read('a-stale','alpha-first'),undefined);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE id='change:a-stale'").get().n,0,
    'Revoked token cannot create notification');
  checks+=6;
  const legit=record('a-next','alpha','alpha-rotated','Synthetic revised work','customer-a');
  assert.deepEqual(legit,{inserted:1,notified:1});
  assert.equal(read('a-next','alpha-rotated').message,'Synthetic revised work');
  assert.equal(find('alpha','customer-a','Synthetic revised work','alpha-rotated').id,'a-next');
  assert.deepEqual(record('a-next','alpha','alpha-rotated','Synthetic revised work','customer-a'),
    {inserted:0,notified:0},'Retry cannot create duplicate request or owner alert');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM estimate_change_requests WHERE id='a-next'").get().n,1);
  checks+=5;
  // A second revocation applies to saved receipt readbacks as well.
  db.prepare('UPDATE estimates SET share_token=? WHERE id=?').run('alpha-final','alpha');
  assert.equal(read('a-next','alpha-rotated'),undefined);
  assert.equal(find('alpha','customer-a','Synthetic revised work','alpha-rotated'),undefined);
  assert.equal(read('a-next','alpha-final').customerId,'customer-a');
  assert.equal(read('b-original','bravo-first').customerId,'customer-b');
  checks+=4;
  console.log('PASS '+checks+' actual-source/native SQLite Gate 6 change-request token revocation, no cross-customer receipt, no stale owner notification and idempotency checks. No hosted/provider reads or writes.');
}finally{db.close();}
