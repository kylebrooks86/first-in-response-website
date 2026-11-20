/** FIRE DR + NEW LIVE paired release identity review — LOCAL SOURCE ONLY.
 * Inputs are two already-compiled INERT manifests and two separately
 * owner-checked physical D1 UUIDs. No provider clients, write operations,
 * credentials, backup file mutations, deployments or payment calls.
 *
 * Example (in a private shell, after physical D1 identity review):
 * FIRE_RELEASE_PHOTO_STORAGE_MODE=owner-device-zip
 * FIRE_RELEASE_DR_D1_UUID=... FIRE_RELEASE_NEW_LIVE_D1_UUID=...
 * FIRE_RELEASE_DR_RESOURCE_ATTESTATION=owner-checked-independent-dr
 * FIRE_RELEASE_NEW_LIVE_RESOURCE_ATTESTATION=owner-checked-independent-live
 * node review_new_independent_release_pair.mjs DR_BUILT.json LIVE_BUILT.json
 *
 * A passing result NEVER proves the supplied UUIDs match actual provider
 * bindings or that recovery, auth, Stripe, or cutover is approved.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {prepareReviewedIndependentManifest,reviewIndependentReleasePair} from './prepare_new_independent_release_manifest.mjs';

const stop=reason=>{throw Error('FIRE independent pair review BLOCKED: '+reason);};
function reviewFile(target,path,databaseId,otherReleaseDatabaseId,attestation) {
 const raw=JSON.parse(readFileSync(resolve(path),'utf8'));
 return prepareReviewedIndependentManifest(target,raw,{
  databaseId,otherReleaseDatabaseId,photoStorageMode:process.env.FIRE_RELEASE_PHOTO_STORAGE_MODE,
  bucketName:process.env.FIRE_RELEASE_R2_BUCKET,
  resourceAttestation:attestation,enableAuth:false
 });
}
try{
 if(process.argv.length!==4)stop('usage: node review_new_independent_release_pair.mjs DR_BUILT_JSON LIVE_BUILT_JSON');
 if(resolve(process.argv[2])===resolve(process.argv[3]))stop('DR and NEW LIVE must use different compiled source paths');
 if(process.env.FIRE_RELEASE_ENABLE_AUTH||process.env.FIRE_RELEASE_QUICK_AUTH_MODE||
    process.env.FIRE_RELEASE_R2_BUCKET!==undefined)
  stop('no authentication activation or R2 subscription is permitted in paired source review');
 const drId=process.env.FIRE_RELEASE_DR_D1_UUID;
 const liveId=process.env.FIRE_RELEASE_NEW_LIVE_D1_UUID;
 const dr=reviewFile('independent-dr',process.argv[2],drId,liveId,
  process.env.FIRE_RELEASE_DR_RESOURCE_ATTESTATION);
 const live=reviewFile('independent-live',process.argv[3],liveId,drId,
  process.env.FIRE_RELEASE_NEW_LIVE_RESOURCE_ATTESTATION);
 const result=reviewIndependentReleasePair(dr,live);
 process.stdout.write(JSON.stringify(result)+'\n');
}catch(error){
 // Never echo file contents, provider secrets or raw CLI arguments.
 console.error(error instanceof Error?error.message:'FIRE pair review failed');
 process.exitCode=1;
}
