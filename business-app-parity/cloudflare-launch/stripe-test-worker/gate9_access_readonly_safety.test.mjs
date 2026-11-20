// SOURCE-ONLY Cloudflare Access safety tests. No provider connection or token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root=new URL('.',import.meta.url);
const preflight=readFileSync(new URL('owner_gate9_access_readonly_preflight.ps1',root),'utf8');
const mutator=readFileSync(new URL('owner_add_exact_gate9_webhook_access_override.ps1',root),'utf8');
const actions=s=>[...s.matchAll(/Invoke-RestMethod\s+-Method\s+(Get|Post|Put|Patch|Delete)\b/gi)].map(x=>x[1].toUpperCase());
const fixedPaths=["/estimate/*","/invoice/*","/pay/*","/_next/static/*",
 "/assets/*","/fire-app-logo.png","/favicon.ico"];
function readOnlySafe(source){
 const methods=actions(source);
 assert.deepEqual(methods,['GET'],'Read-only preflight may have exactly one provider GET');
 assert.match(source,/READ_ONLY: EXACT_SEVEN/);
 assert.match(source,/READ_ONLY: EXACT_EIGHT/);
 for(const path of [...fixedPaths,'/api/payments/webhook'])
   assert.ok(source.includes("'"+path+"'"),'Preflight missing pinned path '+path);
 assert.match(source,/Sort-Object -Unique/,'Duplicate overrides must be refused');
 assert.match(source,/reusable\s+-ne\s+\$true/,'Reusable Allow policy must be enforced');
}
function noBlindRollback(source){
 assert.deepEqual(actions(source),['GET','GET','PUT','GET','GET'],
   'Only one Access PUT can occur, and the catch branch may only GET');
 const catchStart=source.indexOf('  } catch {\n    Write-Host "STOP at $stage.');
 const finallyStart=source.indexOf('  } finally {',catchStart);
 assert.ok(catchStart>0&&finallyStart>catchStart,'Expected guarded top-level catch/finally');
 const recovery=source.slice(catchStart,finallyStart);
 assert.deepEqual(actions(recovery),['GET'],'After uncertain PUT no second provider mutation is allowed');
 assert.match(recovery,/NO automatic retry or rollback/i);
 assert.match(recovery,/NEW separately reviewed and approved action/);
}
test('READ-ONLY Access preflight is pinned and incapable of changing provider state',()=>{
 readOnlySafe(preflight);
 for(const id of ['bfc00939cfb2f8dfd8581a7a7f5f1307',
 '09dbb414-997f-494f-85a5-a3a65a5a92ef','72f9cab371974bc8811da05f44976fa9'])
  assert.ok(preflight.includes("'"+id+"'")&&mutator.includes("'"+id+"'"),
   'Same exact TEST account, Access app and Worker identity');
});
test('a failed/ambiguous Access PUT cannot cause unapproved rollback PUT',()=>noBlindRollback(mutator));
test('negative controls reject an added preflight write or second rollback',()=>{
 assert.throws(()=>readOnlySafe(preflight.replace(
  'Invoke-RestMethod -Method Get','Invoke-RestMethod -Method Put')));
 assert.throws(()=>noBlindRollback(mutator.replace(
  "Write-Host 'ONE TEST Access PUT may have reached Cloudflare;",
  "Invoke-RestMethod -Method Put -Uri $uri\n      Write-Host 'ONE TEST Access PUT may have reached Cloudflare;")));
});
