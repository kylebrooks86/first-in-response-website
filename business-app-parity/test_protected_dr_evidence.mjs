/** Source-only FIRE DR accepted Acer receipts: encrypted exact 32-file archive. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {encryptDREvidenceEntries,decryptDREvidenceArchive,validateDREvidenceEntries}
 from './protected_dr_evidence.mjs';
import {restoreArchiveToNewFolder} from './owner_dr_offdevice_receipt_backup.mjs';

const DR='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const bytes=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v));
const sha=b=>createHash('sha256').update(b).digest('hex');
const lock={target:'independent-dr',uuid:DR,migrationCount:26};
const receipt={target:'independent-dr',uuid:DR,migrationCount:26,
  physicalDRReadbackVerified:true,remoteCommandReturnedSuccess:true,
  firstJobExpectedInCleanDR:'0001'};
const review={sourceEvidence:{state:'DR_PHYSICAL_SCHEMA_ACCEPTED__WORKER_NOT_DEPLOYED',
 databaseId:DR,reviewedMigrationCount:26,drWorkerDeployed:false,
 ownerApprovedDeployment:false,existingOwnerAttemptSha256:sha(bytes(lock)),
 existingOwnerReceiptSha256:sha(bytes(receipt))},
 config:{d1_databases:[{binding:'DB',database_id:DR}],
 vars:{FIRE_DR_AUTH_ENABLED:'blocked'},r2_buckets:[]}};
const migrations=Array.from({length:26},(_,i)=>{
 const filename=String(i).padStart(4,'0')+'_reviewed.sql';
 return {path:'workspace/migrations/'+filename,bytes:bytes('-- reviewed '+i+'\n')};
});
const list=[
 {path:'owner/remote-one-shot-attempt.json',bytes:bytes(lock)},
 {path:'owner/dr-physical-schema-receipt.json',bytes:bytes(receipt)},
 {path:'review/dr-compiled-physical-postinstall-reviewed.json',bytes:bytes(review)},
 {path:'workspace/READ_ME_FIRST.txt',bytes:bytes('NO remote migration or provider calls')},
 {path:'workspace/wrangler.json',bytes:bytes({d1_databases:[{binding:'DB',database_id:DR}]})},
 {path:'workspace/source-hashes.json',bytes:bytes({target:'independent-dr',
  database_id:DR,migrationCount:26,
  migrations:migrations.map(x=>({filename:x.path.split('/').at(-1),sha256:sha(x.bytes)}))})},
 ...migrations];
const passphrase='private owner DR recovery sentence > 16';
let count=0;
const check=(condition,label)=>{assert.ok(condition,label);count++;};
const blocked=(fn,label)=>{assert.throws(fn,/FIRE DR (protected evidence|off-device backup) BLOCKED:/,label);count++;};
const root=mkdtempSync(join(tmpdir(),'fire-owner-dr-protected-evidence-'));
try{
 const encoded=validateDREvidenceEntries(list);
 check(encoded.length>100,'valid 32-file record');
 const archive=encryptDREvidenceEntries(list,passphrase);
 check(archive.length>100,'encrypted archive created');
 check(!archive.includes(bytes('remote-one-shot-attempt.json')),'secret filenames encrypted');
 check(!archive.includes(bytes(DR)),'database identity hidden');
 check(!archive.includes(bytes('DR_PHYSICAL_SCHEMA_ACCEPTED')),'physical receipt details hidden');
 const again=encryptDREvidenceEntries(list,passphrase);
 check(!again.equals(archive),'randomized salt and IV');
 const recovered=decryptDREvidenceArchive(archive,passphrase);
 check(recovered.length===32,'all exactly 32 files decrypted');
 check(recovered.every(x=>list.some(y=>y.path===x.path&&x.bytes.equals(y.bytes))),
  'every byte matches original accepted record');
 blocked(()=>decryptDREvidenceArchive(archive,'a different owner passphrase > 16'),'wrong owner phrase');
 for(const offset of [0,8,16,24,35,40,44,archive.length-17,archive.length-1]){
  const damaged=Buffer.from(archive);damaged[offset]^=1;
  blocked(()=>decryptDREvidenceArchive(damaged,passphrase),'tampering at '+offset);
 }
 blocked(()=>decryptDREvidenceArchive(archive.subarray(0,archive.length-1),passphrase),
  'partial/truncated archive');
 blocked(()=>encryptDREvidenceEntries(list,'short'),'weak passphrase');
 blocked(()=>encryptDREvidenceEntries(list.slice(1),passphrase),'missing one accepted receipt');
 blocked(()=>encryptDREvidenceEntries([...list,list[0]],passphrase),'duplicate file');
 blocked(()=>encryptDREvidenceEntries([...list.slice(0,-1),{path:'../injected',bytes:bytes('evil')}],
  passphrase),'path traversal forbidden');
 blocked(()=>encryptDREvidenceEntries(list.map(x=>
  x.path.endsWith('0000_reviewed.sql')?{...x,bytes:bytes('ALTERED SQL')}:x),passphrase),
  'altered migration bytes');
 blocked(()=>encryptDREvidenceEntries(list.map(x=>
  x.path==='review/dr-compiled-physical-postinstall-reviewed.json'?
  {...x,bytes:bytes({...review,sourceEvidence:{...review.sourceEvidence,drWorkerDeployed:true}})}:x),
  passphrase),'false hosted deployment');
 blocked(()=>encryptDREvidenceEntries(list.map(x=>
  x.path==='owner/dr-physical-schema-receipt.json'?
  {...x,bytes:bytes({...receipt,uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'})}:x),
  passphrase),'NEW LIVE database impersonates DR');
 blocked(()=>encryptDREvidenceEntries(list.map(x=>
  x.path==='owner/remote-one-shot-attempt.json'?
  {...x,bytes:bytes({...lock,uuid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})}:x),
  passphrase),'unknown physical D1');
 const restored=join(root,'new-private-owner-restore');
 const result=restoreArchiveToNewFolder(archive,passphrase,restored);
 check(result.restored===32&&result.remoteOperationAttempted===false,
  'explicit isolated restore completed without a remote operation');
 check(existsSync(join(restored,'owner','dr-physical-schema-receipt.json')),
  'actual restored owner evidence is on disk');
 check(readFileSync(join(restored,'owner','dr-physical-schema-receipt.json')).equals(bytes(receipt)),
  'restored receipt exact byte equality');
 check(readFileSync(join(restored,'workspace','migrations','0000_reviewed.sql')).equals(migrations[0].bytes),
  'actual restored SQL exact byte equality');
 blocked(()=>restoreArchiveToNewFolder(archive,passphrase,restored),
  'do not overwrite previously restored files');
 const never=join(root,'never-on-disk');
 blocked(()=>restoreArchiveToNewFolder(archive,'different passphrase - invalid!',never),
  'wrong passphrase cannot create a plaintext restore folder');
 check(!existsSync(never),'failed authentication left no plaintext output');
 console.log('PASS '+count+'/'+count+
  ' protected DR 32-file AES-256-GCM private backup, exact isolated restore, tamper, wrong passphrase, SQL, D1 and source-handoff negatives; ZERO network/provider calls.');
}finally{rmSync(root,{recursive:true,force:true});}
