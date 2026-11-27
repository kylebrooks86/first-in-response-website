/** FIRE DR private evidence backup with ACTUAL reviewed 26 SQL source files.
 * All owner receipts are synthetic-shaped and no provider/network calls occur.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareIndependentD1MigrationWorkspace} from './prepare_independent_d1_migration_workspace.mjs';
import {collectAcceptedOwnerDRFiles} from './owner_dr_offdevice_receipt_backup.mjs';
import {encryptDREvidenceEntries,decryptDREvidenceArchive}
 from './protected_dr_evidence.mjs';

const root=mkdtempSync(join(tmpdir(),'fire-protected-owner-dr-real-26-sql-'));
const owner=join(root,'owner'),review=join(root,'review');
const uuid='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const lock={
 target:'independent-dr',name:'fire-fullapp-dr-db',uuid,migrationCount:26,
 startedAt:'2026-11-13T22:00:00Z',exactSavedSourceReviewed:true,
 attemptState:'STARTED_RESULT_UNCONFIRMED',
 physicalIdentity:{target:'independent-dr',name:'fire-fullapp-dr-db',uuid,
  separateLiveName:'fire-fullapp-new-live-db',readOnlyIdentityVerified:true,
  method:'two-independent-d1-info'},
 newLiveUntouched:true,noWorkerDeploy:true,noPaidR2:true};
const receipt={
 target:'independent-dr',name:'fire-fullapp-dr-db',uuid,migrationCount:26,
 checkedAt:'2026-11-13T22:05:00Z',physicalDRReadbackVerified:true,
 remoteCommandReturnedSuccess:true,firstJobExpectedInCleanDR:'0001'};
let checks=0;
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
try{
 mkdirSync(owner);mkdirSync(review);
 const workspace=join(owner,'pinned-26-migrations-canonical-v2');
 prepareIndependentD1MigrationWorkspace('independent-dr',workspace);
 const attemptBytes=Buffer.from(JSON.stringify(lock)),receiptBytes=Buffer.from(JSON.stringify(receipt));
 writeFileSync(join(owner,'remote-one-shot-attempt.json'),attemptBytes);
 writeFileSync(join(owner,'dr-physical-schema-receipt.json'),receiptBytes);
 const report={
  sourceEvidence:{
   state:'DR_PHYSICAL_SCHEMA_ACCEPTED__WORKER_NOT_DEPLOYED',
   databaseId:uuid,reviewedMigrationCount:26,drWorkerDeployed:false,
   ownerApprovedDeployment:false,
   existingOwnerAttemptSha256:SHA(attemptBytes),
   existingOwnerReceiptSha256:SHA(receiptBytes)
  },
  config:{name:'fire-fullapp-dr',d1_databases:[{binding:'DB',database_id:uuid}],
   vars:{FIRE_DR_AUTH_ENABLED:'blocked'},r2_buckets:[]}
 };
 writeFileSync(join(review,'dr-compiled-physical-postinstall-reviewed.json'),JSON.stringify(report));
 const entries=collectAcceptedOwnerDRFiles({owner,postinstall:review});
 ok(entries.length===32,'actual reviewed 26 SQL workspace and 6 accepted record files collected');
 const pass='owner off device backup is a genuinely private long recovery phrase';
 const archive=encryptDREvidenceEntries(entries,pass);
 const contents=decryptDREvidenceArchive(archive,pass);
 ok(contents.length===32,'all reviewed 26 SQL and six real-source-shaped receipts recovered');
 const named=contents.find(x=>x.path==='workspace/migrations/0000_wise_namora.sql');
 ok(!!named,'actual first reviewed migration retained, not synthetic placeholder');
 ok(named.bytes.equals(readFileSync(join(workspace,'migrations','0000_wise_namora.sql'))),
  'source-pinned SQL byte-identical after authenticated encryption/restore');
 const savedReview=contents.find(x=>x.path==='review/dr-compiled-physical-postinstall-reviewed.json');
 ok(savedReview.bytes.equals(readFileSync(join(review,'dr-compiled-physical-postinstall-reviewed.json'))),
  'new owner Acer verified Worker receipt survives exactly');
 console.log('PASS '+checks+'/'+checks+' REAL 26 source-reviewed D1 migration bytes and previously accepted original-shaped owner DR receipts backed up and recovered in one encrypted 32-file object; ZERO provider calls.');
}finally{rmSync(root,{recursive:true,force:true});}
