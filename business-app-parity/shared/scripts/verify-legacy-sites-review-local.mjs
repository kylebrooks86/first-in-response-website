/**
 * FIRE Gate 7: verify an owner-held legacy Sites records review entirely OFFLINE.
 *
 * Only reads one local JSON file into memory and invokes the existing actual
 * disposable :memory: SQLite round-trip. Does not connect to Sites/Cloudflare,
 * access credentials, save customer files, publish, migrate, or restore a host.
 *
 * A passed result is ONLY internally consistent records/schema verification.
 * It is NOT a full LIVE database/photo backup, source-binding attestation,
 * a same-instant snapshot, a hosted rollback drill, or Gate 7 acceptance.
 */
import {constants as fsConstants,openSync,closeSync,fstatSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rehearseLegacySitesReviewToDisposableMemory}
  from './rehearse-legacy-sites-review-in-memory.mjs';

const MAX_PRIVATE_INPUT_BYTES=8_000_000;
const CLI=fileURLToPath(import.meta.url);
const block=()=>{throw Error('PRIVATE_LEGACY_REVIEW_NOT_VERIFIED');};

export function verifyLocalLegacyReviewBytes(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.byteLength===0||bytes.byteLength>MAX_PRIVATE_INPUT_BYTES)
    block();
  let input;
  try{input=JSON.parse(bytes.toString('utf8'));}
  catch{block();}
  let proof;
  try{proof=rehearseLegacySitesReviewToDisposableMemory(input);}
  catch{block();}
  if(proof?.disposableInMemoryRoundTripVerified!==true||
    proof.actualRemoteRestorePerformed!==false||
    proof.sourceD1UuidVerified!==false||
    proof.photoBytesRestored!==false||
    proof.releaseGate7Accepted!==false||
    !Number.isSafeInteger(proof.recreatedTables)||proof.recreatedTables<1||
    !Number.isSafeInteger(proof.recoveredRecordCount)||proof.recoveredRecordCount<0||
    !Number.isSafeInteger(proof.recreatedSchemaObjects)||
    proof.recreatedSchemaObjects<proof.recreatedTables)block();
  // Intentionally never return raw rows, object keys, source filenames, SQL,
  // customer identifiers, text from user input or a provider-looking success.
  return Object.freeze({
    result:'PASS_OFFLINE_LEGACY_RECORDS_DISPOSABLE_ROUNDTRIP',
    verifiedSchemaObjects:proof.recreatedSchemaObjects,
    verifiedTables:proof.recreatedTables,
    verifiedRows:proof.recoveredRecordCount,
    customerDataPrinted:false,localFilesWritten:false,
    privateInputBytesUsedOnce:true,
    connectedToCloudflare:false,connectedToSites:false,
    sourceDatabaseIdentityVerified:false,
    migrationJournalProviderVerified:false,
    uploadedPhotoBytesVerified:false,
    independentPhotoArchivePaired:false,
    sameInstantProviderSnapshotVerified:false,
    targetBoundRollbackVerified:false,
    hostedDataRestored:false,
    gate7Accepted:false,gate10Accepted:false,
    liveReleaseAuthorized:false
  });
}

function readPrivateBoundedFile(filename){
  let fd;
  try{
    const flags=fsConstants.O_RDONLY |
      (fsConstants.O_NOFOLLOW||0) | (fsConstants.O_NONBLOCK||0);
    fd=openSync(filename,flags);
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>MAX_PRIVATE_INPUT_BYTES)block();
    const bytes=readFileSync(fd);
    if(bytes.byteLength!==stat.size||bytes.byteLength>MAX_PRIVATE_INPUT_BYTES)block();
    return bytes;
  }catch{block();}
  finally{if(fd!==undefined)closeSync(fd);}
}

if(process.argv[1]&&resolve(process.argv[1])===CLI){
  try{
    if(process.argv.length!==3||!process.argv[2]||process.argv[2].startsWith('--'))block();
    const output=verifyLocalLegacyReviewBytes(readPrivateBoundedFile(process.argv[2]));
    process.stdout.write(JSON.stringify(output,null,2)+'\n');
  }catch{
    // Never forward JSON content, DB values, private paths or raw parse errors.
    process.stderr.write('STOP: FIRE Gate7 private legacy review could not be verified. No hosted action.\n');
    process.exitCode=1;
  }
}
