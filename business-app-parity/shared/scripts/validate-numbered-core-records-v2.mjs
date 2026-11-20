/** FIRE source-only owner-private numbered records v2 verifier.
 * Accepts a bounded, locally supplied JSON *copy* from the photo-pair planner.
 * Prints no customer values, archive path, SQL, photo identifiers or secrets.
 * No provider/backup/restore/database access and does NOT approve v2 release.
 */
import {open,stat} from 'node:fs/promises';
import {validateNumberedCoreRecordsV2} from '../lib/numbered-records-v2-preflight.mjs';
import {verifySignedAgreementDigests} from '../lib/deposit-agreement-backup.mjs';

const limit=5_000_000;
async function run(){
 if(process.argv.length!==3)throw Error('ONE_PRIVATE_FILE_REQUIRED');
 const path=process.argv[2];
 const info=await stat(path);
 if(!info.isFile()||info.size<2||info.size>limit)throw Error('INVALID_FILE_SIZE');
 const f=await open(path,'r');
 let text;
 try{
  const stable=await f.stat();
  if(!stable.isFile()||stable.size!==info.size)throw Error('FILE_CHANGED');
  text=await f.readFile({encoding:'utf8'});
  const after=await f.stat();
  if(after.size!==stable.size||after.mtimeMs!==stable.mtimeMs)throw Error('FILE_CHANGED');
 }finally{await f.close();}
 const payload=JSON.parse(text);
 const counts=validateNumberedCoreRecordsV2(payload);
 const digestError=await verifySignedAgreementDigests(payload.tables);
 if(digestError)throw Error('SIGNED_AGREEMENT_DIGEST');
 // The payload is only a *proposed* complete core records archive; storage
 // objects, optional feature schemas and local-device vault are NOT covered.
 process.stdout.write(JSON.stringify({
   valid:true,kind:'numbered-v2-core',version:2,
   coreTables:counts.coreTables,identityTables:counts.identityTables,
   customerCount:counts.customers,estimateCount:counts.estimates,
   customerNumberCount:counts.customerNumbers,
   jobNumberCount:counts.jobNumbers,
   photoMetadataCount:payload.tables.customer_photos.length,
   signedAgreementDigestsVerified:true,
   recoveryExecutionAuthorized:false,
   independentSourceRowCountsVerified:false,
   photoBytesVerified:false,hostedWritesPerformed:false
 })+'\n');
}
try{await run();}
catch{
 // Intentionally never emit the raw parser/validation error, filename,
 // financial value, identity, document digest or original JSON.
 process.stderr.write('BLOCKED: FIRE numbered core v2 archive cannot be independently verified here.\n');
 process.exitCode=1;
}
