/** SOURCE-only guard: safe v2 review UI cannot silently replace approved
 * QA master or enable an incomplete backup. No browser, provider or customer.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const business=readFileSync('app/dashboard.tsx','utf8');
const ui=readFileSync('components/numbered-core-records-review.tsx','utf8');
const lib=readFileSync('lib/numbered-v2-owner-file-custody.mjs','utf8');
const responseReader=readFileSync('lib/numbered-v2-review-response.mjs','utf8');
let n=0;
const check=(v,why)=>{assert.ok(v,why);n++};
check(business.includes('import {NumberedCoreRecordsReview} from "../components/numbered-core-records-review";'),
 'Business page source compiles owner review component alongside QA master');
check(business.includes('<NumberedCoreRecordsReview reviewEnabled={false}/>'),
 'The reviewed UI is categorically DISABLED in all environments until explicit owner authorization');
check(!business.includes('<NumberedCoreRecordsReview reviewEnabled={true}/>'),
 'No production or QA opt-in enabled by source');
check(ui.includes('if(!reviewEnabled)return null'),
 'No incomplete recovery UI appears with default-off authorization');
check(ui.includes("fetch('/api/backup/numbered-v2'")&&ui.includes("method:'GET'")&&
 ui.includes("credentials:'same-origin'")&&ui.includes("cache:'no-store'"),
 'Only the owner-only, review-gated, no-cache GET can load the v2 source');
check(responseReader.includes("payload.completeBackup!==false")&&
 responseReader.includes("payload.recoveryAuthorized!==false")&&
 responseReader.includes("payload.photoBytesIncluded!==false")&&
 responseReader.includes("payload.offDeviceCustodyVerified!==false"),
 'A modified API that pretends to be a complete or authorized backup is refused');
check(ui.includes('readOwnerNumberedCoreReviewResponse(response)')&&
 responseReader.includes('MAX_NUMBERED_REVIEW_HTTP_BYTES=5_500_000')&&
 responseReader.includes("new TextDecoder('utf-8',{fatal:true})")&&
 responseReader.includes('validateNumberedCoreRecordsV2(payload.coreSnapshot)'),
 'Owner browser only parses bounded, strict UTF8 read-only responses');
check(ui.includes('prepareNumberedV2OwnerFile(source,passphrase,confirmPassphrase)')&&
 ui.includes('clearSecrets()')&&ui.includes('setPrepared(null)'),
 'Client-side passphrase encryption clears fields and invalidates previous file on a new attempt');
check(ui.includes('navigator.share({files:[file]')&&
 ui.includes('URL.createObjectURL(prepared.blob)')&&ui.includes('Verify selected SAVED file'),
 'iPhone Files/share and download options require a separate saved-file readback');
check(ui.includes('verifySavedNumberedV2OwnerFile(prepared,file,passphrase)')&&
 ui.includes('selectedSavedFileByteIdentical')&&ui.includes('savedFileAuthenticatedAndCoreValidated'),
 'Chosen saved file is reauthenticated and compared with exact prepared ciphertext');
check(ui.includes('remoteWritesPerformed')===false&&
 !/localStorage|sessionStorage|indexedDB|R2_BUCKET|stripe\.com|\bwrangler\b/i.test(ui),
 'No direct record-write, payment, R2 or browser-storage operations in owner component');
check(lib.includes('independentOffDeviceCustodyVerified:false')&&lib.includes('gate7Accepted:false')&&
 ui.includes('This does NOT prove off-device custody'),
 'Even successful selected file readback does not promote physical recovery gate');
check(ui.includes('Some photos')===false&&ui.includes('optional tables')&&ui.includes('photo bytes'),
 'Missing photo and supplemental-table coverage remains explicit');
console.log('PASS '+n+'/'+n+' source-only owner backup UI gates: review OFF, protected save/readback, no release or provider change.');
