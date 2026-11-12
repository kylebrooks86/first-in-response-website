/** Confirm the owner-private paired v2 validator checks the actual bytes of
 * signed deposit exceptions, not merely a plausible-looking SHA-256 field.
 * Synthetic test data and disposable temp files only. Never use owner files.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 validateNumberedCoreRecordsV2} from '../lib/numbered-records-v2-preflight.mjs';
import {agreementDigest} from '../lib/deposit-agreement-commitment.mjs';

let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const event='synthetic-signed-event-001',estimate='synthetic-estimate-001',customer='synthetic-customer-001';
const ts='2026-10-21T12:00:00Z';
const version='deposit-exception-v1:'+event;
const text='Synthetic signed agreement text that preserves the full required scope and financial terms for private verification only.';
const scope=JSON.stringify([['item-1','House wash','Synthetic siding cleaning',1,'job',10000]]);
const digest=await agreementDigest({eventId:event,totalCents:10000,depositCents:0,mode:'waive',scope,terms:text});
const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES].map(t=>[t,[]]));
tables.customers.push({id:customer,created_at:ts,name:'Synthetic Test Customer'});
tables.estimates.push({id:estimate,customer_id:customer,created_at:ts,status:'approved',
 total_cents:10000,deposit_cents:0,contract_version:version+':sha256:'+digest,
 signed_name:'Synthetic Signer',photo_release:'no',accepted_at:ts,signed_at:ts});
tables.fire_customer_numbers.push({customer_id:customer,customer_number:17,created_at:ts});
tables.fire_job_numbers.push({root_estimate_id:estimate,job_number:9,created_at:ts});
tables.fire_job_estimate_links.push({estimate_id:estimate,job_number:9});
tables.deposit_policy_events.push({
 id:event,estimate_id:estimate,confirmation_id:'synthetic-confirmation',
 actor_email:'synthetic-owner@example.invalid',mode:'waive',
 previous_total_cents:10000,previous_deposit_cents:5000,new_deposit_cents:0,
 paid_principal_cents:0,percent_basis_points:null,schedule_before_collection:0,
 previous_contract_version:null,updated_contract_version:version,
 previous_signed_at:null,requires_customer_reapproval:0,reason:null,created_at:ts
});
tables.deposit_agreement_snapshots.push({
 event_id:event,estimate_id:estimate,document_version:version,
 document_digest:digest,total_cents:10000,deposit_cents:0,mode:'waive',
 scope_json:scope,agreement_text:text,signed_name:'Synthetic Signer',
 photo_release:'no',signed_at:ts,accepted_at:ts
});
const snapshot={
 format:'fire-numbered-core-records-snapshot',version:2,
 allTablesComplete:true,truncated:false,tables,
 rowCounts:Object.fromEntries(Object.entries(tables).map(([name,rows])=>[name,rows.length])),
 highWater:{customer:27,job:13}
};
const directory=mkdtempSync(join(tmpdir(),'fire-numbered-signed-only-'));
const filename=join(directory,'synthetic-numbered-signed.json');
const checkCli=(archive,expected,reason)=>{
 writeFileSync(filename,JSON.stringify(archive),{mode:0o600});
 const run=spawnSync(process.execPath,['scripts/validate-numbered-core-records-v2.mjs',filename],
  {encoding:'utf8',timeout:15000,env:{...process.env,CLOUDFLARE_CF_FETCH_ENABLED:'false'}});
 assert.equal(run.status,expected?0:1,reason+' '+String(run.stderr).slice(0,200));
 check((run.status===0)===expected,reason);
 const all=run.stdout+run.stderr;
 for(const forbidden of [filename,customer,estimate,event,'Synthetic Signer',text,digest]){
  check(!all.includes(forbidden),'CLI must not expose source identity, path, content or digest');
 }
 if(expected){
  const summary=JSON.parse(run.stdout);
  check(summary.signedAgreementDigestsVerified===true&&summary.recoveryExecutionAuthorized===false,
    'Successful v2 signed verification confirms digest without authorizing recovery');
 }else{
  check(run.stdout.trim()===''&&run.stderr.includes('BLOCKED:'),
    'Invalid signed document emits generic failure without original values');
 }
};
try{
 check(validateNumberedCoreRecordsV2(snapshot).jobNumbers===1,'Original signed fixture is a valid numbered core archive');
 checkCli(snapshot,true,'Authentic signed deposit waiver snapshot validates');
 const modified=structuredClone(snapshot);
 modified.tables.deposit_agreement_snapshots[0].agreement_text=text+' Tampered after customer signature.';
 // Everything still appears structurally valid. Only independent SHA-256
 // reconstruction can catch this silent loss of legal document integrity.
 check(validateNumberedCoreRecordsV2(modified).jobNumbers===1,
  'Structural validation alone does not claim signed agreement digest proof');
 checkCli(modified,false,'Modified signed terms must be cryptographically rejected');
 const scopeChange=structuredClone(snapshot);
 scopeChange.tables.deposit_agreement_snapshots[0].scope_json=
  JSON.stringify([['item-1','House wash','Synthetic siding cleaning changed',1,'job',10000]]);
 check(validateNumberedCoreRecordsV2(scopeChange).jobNumbers===1,
  'Syntactically valid but changed original scope still needs a digest check');
 checkCli(scopeChange,false,'Modified original service scope must be rejected');
 const omitted=structuredClone(snapshot);
 omitted.tables.deposit_agreement_snapshots[0].document_digest='0'.repeat(64);
 omitted.tables.estimates[0].contract_version=version+':sha256:'+'0'.repeat(64);
 checkCli(omitted,false,'Forged matching-looking receipt and hash must not pass');
 const noNumbers=structuredClone(snapshot);
 noNumbers.tables.fire_customer_numbers.length=0;
 noNumbers.rowCounts.fire_customer_numbers=0;
 checkCli(noNumbers,false,'Missing immutable Customer # must never pass');
 const untrusted=structuredClone(snapshot);
 untrusted.highWater.job=8;
 checkCli(untrusted,false,'Reused permanent Job # cannot be accepted');
 console.log('PASS '+checks+' local signed-deposit digest, complete numbered identities, safe error output checks; NO PROVIDER OR DB ACCESS.');
}finally{rmSync(directory,{recursive:true,force:true});}
