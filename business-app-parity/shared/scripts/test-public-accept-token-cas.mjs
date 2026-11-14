/** Gate 6: prove public estimate approval rechecks its bearer share token
 * atomically, including lost-ACK receipt readback. Local SQLite only.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root=resolve(process.argv[2]||'.');
const path='app/api/public/estimates/[token]/accept/route.ts';
const source=readFileSync(resolve(root,path),'utf8');
const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const statements=[];
function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
     node.expression.name.text==='bind'&&ts.isCallExpression(node.expression.expression)){
    const prepare=node.expression.expression;
    if(ts.isPropertyAccessExpression(prepare.expression)&&prepare.expression.name.text==='prepare'&&
      prepare.arguments[0])statements.push({
        query:prepare.arguments[0].getText(ast),
        bindings:node.arguments.map(x=>x.getText(ast))
      });
  }
  ts.forEachChild(node,visit);
}
visit(ast);
const update=statements.filter(x=>x.query.includes("UPDATE estimates SET status='approved'"));
const current=statements.filter(x=>x.query.includes('SELECT accepted_at AS acceptedAt,status,signed_name AS signedName'));
assert.equal(update.length,1,'Exactly one actual public approval UPDATE is parsed');
assert.equal(current.length,1,'Exactly one actual concurrent-approval readback is parsed');
assert.deepEqual(update[0].bindings,[
  'now','signedName','now','photoRelease','estimate.id','token'
], 'The UPDATE binds the current share token after the saved estimate ID');
assert.deepEqual(current[0].bindings,['estimate.id','token'],
  'Readback cannot disclose a newly rotated/revoked share token');
const evalSql=(value,scope)=>vm.runInNewContext('('+value+')',scope,{timeout:1000});
const normal=evalSql(update[0].query,{exceptionPending:false});
const guarded=evalSql(update[0].query,{exceptionPending:true});
const readback=evalSql(current[0].query,{});
for(const query of [normal,guarded]){
  assert.match(query,/WHERE id=\? AND share_token=\? AND accepted_at IS NULL/,
    'Approval update must check the same saved token inside the mutation');
}
assert.match(readback,/FROM estimates WHERE id=\? AND share_token=\?/,
 'A stale token cannot recover an already accepted signature');
let checks=5;
const db=new DatabaseSync(':memory:');
try{
  db.exec(`CREATE TABLE estimates(
    id TEXT PRIMARY KEY,share_token TEXT NOT NULL,status TEXT NOT NULL,
    accepted_at TEXT,signed_name TEXT,signed_at TEXT,photo_release TEXT,
    contract_version TEXT,subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL,total_cents INTEGER NOT NULL,
    deposit_cents INTEGER NOT NULL
  );
  CREATE TABLE estimate_items(
    id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL,name TEXT NOT NULL,
    quantity INTEGER NOT NULL,total_cents INTEGER NOT NULL
  );`);
  const insert=db.prepare(`INSERT INTO estimates
    (id,share_token,status,subtotal_cents,discount_cents,total_cents,deposit_cents)
    VALUES(?,?,'draft',20000,0,20000,10000)`);
  insert.run('alpha','alpha-original');insert.run('bravo','bravo-original');
  const item=db.prepare('INSERT INTO estimate_items (id,estimate_id,name,quantity,total_cents) VALUES(?,?,?,1,20000)');
  item.run('ia','alpha','Synthetic Alpha');item.run('ib','bravo','Synthetic Bravo');
  const mutate=db.prepare(normal),read=db.prepare(readback);
  const attempt=(id,token)=>mutate.run('2026-11-08T00:00:00.000Z','Synthetic Signature',
    '2026-11-08T00:00:00.000Z','no',id,token).changes;
  // Simulate token revocation after an initial read but before the UPDATE.
  db.prepare('UPDATE estimates SET share_token=? WHERE id=?')
    .run('alpha-rotated','alpha');
  assert.equal(attempt('alpha','alpha-original'),0,'Revoked alpha token has zero writes');
  assert.equal(read.get('alpha','alpha-original'),undefined,
    'Retry readback with revoked token reveals no signature');
  assert.equal(attempt('bravo','alpha-original'),0,
    'Alpha token cannot update distinct Bravo estimate by ID');
  assert.equal(db.prepare('SELECT accepted_at FROM estimates WHERE id=?').get('bravo').accepted_at,
    null,'Bravo remains unsigned after cross-record token attempt');
  assert.equal(attempt('alpha','alpha-rotated'),1,'Replacement alpha token signs only its own estimate');
  assert.equal(read.get('alpha','alpha-rotated').signedName,'Synthetic Signature',
    'Only the current share token can confirm the saved receipt');
  assert.equal(read.get('alpha','alpha-original'),undefined,
    'Old token cannot read receipt even after a newer token signs');
  assert.equal(attempt('alpha','alpha-rotated'),0,
    'Repeated signed update cannot modify an accepted estimate');
  checks+=8;
  console.log('PASS '+checks+' actual source+native SQLite token-CAS and lost-ACK readback checks; no hosted traffic, credentials or records.');
}finally{db.close();}
