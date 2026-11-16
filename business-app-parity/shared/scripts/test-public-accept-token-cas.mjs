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
let signerExpression;
function findSigner(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='signedName'&&node.initializer)
    signerExpression=node.initializer.getText(ast);
  ts.forEachChild(node,findSigner);
}
findSigner(ast);
assert.ok(signerExpression,'The real public signature parser has a signedName expression');
assert.equal(evalSql(signerExpression,{body:{signedName:'  Synthetic Signer  '}}),'Synthetic Signer',
 'Ordinary typed customer signature remains trimmed and valid');
for(const malformed of [{},[],4,true,null]){
  assert.equal(evalSql(signerExpression,{body:{signedName:malformed}}),'',
   'Non-text JSON cannot stringify into a valid legal signature');
}
assert.doesNotMatch(signerExpression,/String\(/,
 'No object-to-string coercion in customer signature evidence');
const normal=evalSql(update[0].query,{exceptionPending:false});
const guarded=evalSql(update[0].query,{exceptionPending:true});
const readback=evalSql(current[0].query,{});
for(const query of [normal,guarded]){
  assert.match(query,/WHERE id=\? AND share_token=\? AND accepted_at IS NULL/,
    'Approval update must check the same saved token inside the mutation');
  assert.match(query,/total_cents=subtotal_cents-discount_cents/,
    'Approval must reconcile its discount-adjusted total atomically');
  assert.match(query,/subtotal_cents=.*COALESCE\(SUM\(ei\.total_cents\),-1\)/s,
    'Approval must reconcile saved itemized service lines atomically');
}
assert.match(readback,/FROM estimates WHERE id=\? AND share_token=\?/,
 'A stale token cannot recover an already accepted signature');
// The already-approved fast path must NOT return stale signedName/signedAt
// from its first SELECT after a bearer link has been revoked.
const alreadyApproved=source.indexOf('if(estimate.acceptedAt){');
const approvalExit=source.indexOf('if(!["draft","sent"].includes(estimate.status))',alreadyApproved);
assert.ok(alreadyApproved>0&&approvalExit>alreadyApproved,
 'Already-approved token handling must have a dedicated branch');
const approvedBlock=source.slice(alreadyApproved,approvalExit);
assert.match(approvedBlock,/const current=await confirmedAcceptance\(\)/,
 'Already-approved receipt must issue a new token-bound query');
assert.match(approvedBlock,/if\(!current\?\.acceptedAt\)return Response\.json\(/,
 'Revoked token must fail rather than exposing a stale signature');
assert.doesNotMatch(approvedBlock,/acceptedAt:estimate\.acceptedAt|signedName:estimate\.signedName/,
 'Old initial estimate row must not supply already-approved signature details');
// Execute the real production receipt-matching function, not a test clone.
// A thrown D1.batch may happen AFTER the signature was saved; only the
// exact same timestamp/name/permission and still-current bearer token can
// turn that unknown ACK into a reliable customer-facing success receipt.
const helper=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='matchesCurrentSubmission');
assert.ok(helper,'Lost D1 batch-ACK recovery uses an explicit exact-submission check');
const sandbox={exports:{}};
vm.runInNewContext(ts.transpileModule(helper.getText(ast)+'\nexports.match=matchesCurrentSubmission;',
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
const matchesCurrentSubmission=sandbox.exports.match;
const batchStart=source.indexOf('const [accepted]=await env.DB.batch([');
const batchCatch=source.indexOf('}catch{',batchStart);
const uncertainEnd=source.indexOf('if(!acceptedChanges)',batchCatch);
assert.ok(batchStart>0&&batchCatch>batchStart&&uncertainEnd>batchCatch,
 'A thrown D1 batch ACK must have a dedicated fail-closed response path');
const lostAckPath=source.slice(batchCatch,uncertainEnd);
assert.equal((lostAckPath.match(/confirmedAcceptance\(\)/g)||[]).length,1,
 'Lost ACK may perform only one current-token readback');
assert.match(lostAckPath,/matchesCurrentSubmission\(current,now,signedName,photoRelease\)/,
 'Uncertain ACK cannot accept any older or different signature as this submission');
assert.match(lostAckPath,/saveUncertain:true[\s\S]*?status:503/,
 'Unknown or revoked readback must return 503 saveUncertain, not false success');
assert.doesNotMatch(lostAckPath,/env\.DB\.batch|UPDATE estimates|INSERT INTO notifications/,
 'Lost acknowledgment must not repeat either signed write or notification');
assert.match(lostAckPath,/Cache-Control["']?:["']no-store["']/,
 'Signature readback must be private and uncacheable');
let checks=14;
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
  // Real SQLite idempotent-signature scenario: a share link was valid at the
  // initial SELECT, then got revoked before the already-approved response.
  insert.run('charlie','charlie-original');
  db.prepare("UPDATE estimates SET status='approved',accepted_at=?,signed_name=?,signed_at=?,photo_release=? WHERE id=?")
    .run('2026-11-08T01:00:00.000Z','Synthetic Charlie','2026-11-08T01:00:00.000Z','no','charlie');
  const item=db.prepare('INSERT INTO estimate_items (id,estimate_id,name,quantity,total_cents) VALUES(?,?,?,1,20000)');
  item.run('ia','alpha','Synthetic Alpha');item.run('ib','bravo','Synthetic Bravo');
  const mutate=db.prepare(normal),read=db.prepare(readback);
  const firstApprovedRead=read.get('charlie','charlie-original');
  assert.equal(firstApprovedRead.signedName,'Synthetic Charlie',
   'Initial already-approved read has fictional saved signature');
  db.prepare('UPDATE estimates SET share_token=? WHERE id=?')
    .run('charlie-rotated','charlie');
  assert.equal(read.get('charlie','charlie-original'),undefined,
   'Already-approved reply MUST recheck the token after revocation');
  assert.equal(read.get('charlie','charlie-rotated').signedName,'Synthetic Charlie',
   'Replacement link retains safe accepted-signature idempotence');
  checks+=3;
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
  // Use the actual signing UPDATE extracted above, not a duplicated mock.
  // The same bearer token must not approve inconsistent saved quote math.
  insert.run('delta','delta-original');
  item.run('id','delta','Synthetic Line Mismatch');
  db.prepare("UPDATE estimate_items SET total_cents=15000 WHERE id='id'").run();
  assert.equal(attempt('delta','delta-original'),0,
    'Current share token cannot sign a quote whose line sum differs from subtotal');
  assert.equal(db.prepare("SELECT accepted_at FROM estimates WHERE id='delta'").get().accepted_at,null,
    'Bad line-sum quote remains unsigned');
  insert.run('echo','echo-original');
  item.run('ie','echo','Synthetic Discounted Service');
  db.prepare("UPDATE estimates SET discount_cents=3000 WHERE id='echo'").run();
  assert.equal(attempt('echo','echo-original'),0,
    'Discounted quote cannot retain the undiscounted original total');
  assert.equal(db.prepare("SELECT accepted_at FROM estimates WHERE id='echo'").get().accepted_at,null,
    'Bad discounted quote remains unsigned');
  db.prepare("UPDATE estimates SET total_cents=17000,deposit_cents=8500 WHERE id='echo'").run();
  assert.equal(attempt('echo','echo-original'),1,
    'Correctly discounted quote still signs and records agreement');
  assert.equal(db.prepare("SELECT accepted_at FROM estimates WHERE id='echo'").get().accepted_at,
    '2026-11-08T00:00:00.000Z','Correctly reconciled signature is committed');
  checks+=13;
  // Actual persisted write, simulated thrown response: recover that exact
  // write without running a second SQL UPDATE or revealing other signatures.
  insert.run('foxtrot','foxtrot-original');
  item.run('ifoxtrot','foxtrot','Synthetic Lost ACK Service');
  assert.equal(attempt('foxtrot','foxtrot-original'),1);
  const saved=read.get('foxtrot','foxtrot-original');
  const moment='2026-11-08T00:00:00.000Z';
  assert.equal(matchesCurrentSubmission(saved,moment,'Synthetic Signature','no'),true,
   'Same saved signature is safe to confirm after a lost batch ACK');
  for(const [modified,label] of [
   [{status:'superseded'},'later superseded quote'],
   [{acceptedAt:'2026-11-08T00:00:01.000Z'},'different acceptance time'],
   [{signedAt:'2026-11-08T00:00:01.000Z'},'different signing time'],
   [{signedName:'Other Signer'},'different signed customer'],
   [{photoRelease:'yes'},'different photo permission']]){
    assert.equal(matchesCurrentSubmission({...saved,...modified},moment,'Synthetic Signature','no'),false,
      'Must not misidentify '+label+' as this submission');
  }
  db.prepare('UPDATE estimates SET share_token=? WHERE id=?').run('foxtrot-revoked','foxtrot');
  assert.equal(matchesCurrentSubmission(read.get('foxtrot','foxtrot-original')??null,moment,'Synthetic Signature','no'),false,
   'Token revoked before readback never yields a customer signature');
  checks+=8;
  console.log('PASS '+checks+' actual source+native SQLite token-CAS, item pricing, discounts, signed-name types and lost-ACK checks; no hosted traffic, credentials or records.');
}finally{db.close();}
