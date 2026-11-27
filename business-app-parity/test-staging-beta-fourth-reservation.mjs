import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync,unlinkSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFourthReservation} from './staging_beta_fourth_reservation.mjs';
import {PIN} from './staging_beta_version_binding_contract.mjs';
import {CONSENT,RECEIPT,runOwnerInactiveOnce} from './owner_staging_beta_private_fourth.mjs';
import {CONSENT as OLD} from './owner_staging_beta_private_once.mjs';
const old=['g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock'];
const next='g404-new-inactive-version-attempt-20261126-dedicated-token.lock';
const intent={workerId:PIN.workerId,predecessor:PIN.version,activation:false,stripeMode:'disabled',receiptPin:RECEIPT};
const root=mkdtempSync(join(tmpdir(),'fire-fourth-test-'));
try {
 assert.notEqual(CONSENT,OLD);
 for (const n of old) {
  assert.throws(()=>createFourthReservation(root),/HISTORY/);
  writeFileSync(join(root,n),'historical-'+n,{flag:'wx'});
 }
 const reserve=createFourthReservation(root);
 const competing=createFourthReservation(root);
 for(const change of [{activation:true},{stripeMode:'live'},{workerId:'wrong'},{predecessor:'wrong'},{receiptPin:'bad'}]){
  assert.throws(()=>reserve({...intent,...change}),/INTENT/);
  assert.equal(existsSync(join(root,next)),false);
 }
 assert.equal(reserve(intent),true);
 assert.throws(()=>competing(intent),/RESERVATION_NO_RETRY/);
 assert.throws(()=>createFourthReservation(root),/FOURTH_ALREADY_SPENT/);
 assert.equal(JSON.parse(readFileSync(join(root,next),'utf8')).noRetry,true);
 for(const n of old)assert.equal(readFileSync(join(root,n),'utf8'),'historical-'+n);
 const ps=readFileSync(new URL('./owner_staging_beta_private_fourth.ps1',import.meta.url),'utf8');
 for(const n of [...old,next,CONSENT])assert.ok(ps.includes(n));
 assert.ok(ps.includes('owner_staging_beta_private_fourth.mjs'));
 assert.ok(ps.includes('HISTORY_LINK'));
 assert.ok(!/Remove-Item|Set-Content|Clear-Content/.test(ps));
 let calls=0;
 await assert.rejects(runOwnerInactiveOnce({folder:root,privateDir:root,token:'x'.repeat(30),adminHash:'a'.repeat(64),consent:OLD,fetchImpl:async()=>{calls++;throw Error('unexpected')}}),/OWNER_WINDOWS|NEW_OWNER_CONSENT/);
 assert.equal(calls,0);
 console.log('PASS fourth operator historical locks, exclusive reservation, invalid intent, consent and offline boundary');
}finally{rmSync(root,{recursive:true,force:true})}
