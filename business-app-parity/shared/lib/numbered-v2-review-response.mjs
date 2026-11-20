/** FIRE numbered v2 owner-review HTTP reader, source-only and read-only.
 * This reader separates a truthful partial core-export response from an
 * arbitrary JSON response BEFORE any encrypted file is offered to an owner.
 * No credentials, provider writes, R2, Stripe, or persistent browser storage.
 */
import {validateNumberedCoreRecordsV2} from './numbered-records-v2-preflight.mjs';

export const MAX_NUMBERED_REVIEW_HTTP_BYTES=5_500_000;
const responseKeys=['format','version','completeBackup','recoveryAuthorized',
 'photoBytesIncluded','offDeviceCustodyVerified','warning','coreSnapshot'];
const refused=reason=>{throw Error('FIRE numbered core review response blocked: '+reason);};
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const owned=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);

/** Only a status-200, JSON, private/no-store, exact *incomplete* owner review
 * from the existing route can be transformed into a numbered v2 file source.
 * Even this is not proof of the responding physical D1 resource or of photos.
 */
export async function readOwnerNumberedCoreReviewResponse(response){
 if(!(response instanceof Response)||response.status!==200||!response.ok||response.redirected)
  refused('review response was not a successful direct owner response');
 const type=response.headers.get('content-type')||'';
 if(!/^application\/json(?:\s*;|\s*$)/i.test(type))
  refused('review response is not JSON');
 const cache=response.headers.get('cache-control')||'';
 if(!/(?:^|,)\s*private\b/i.test(cache)||!/(?:^|,)\s*no-store\b/i.test(cache))
  refused('private no-store response protection is missing');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]{0,7})$/.test(declared)||
     Number(declared)>MAX_NUMBERED_REVIEW_HTTP_BYTES))
  refused('declared response exceeds reviewed size or is malformed');
 if(!response.body)refused('no complete response stream');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let bytes=0,content='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(!ArrayBuffer.isView(value)||Object.prototype.toString.call(value)!=='[object Uint8Array]')
    refused('response did not contain a byte stream');
   bytes+=value.byteLength;
   if(bytes>MAX_NUMBERED_REVIEW_HTTP_BYTES)
    refused('response exceeded reviewed size before parsing');
   content+=decoder.decode(value,{stream:true});
  }
  if(!bytes)refused('empty response');
  // A compressed HTTP body is transparently decompressed by fetch, and its
  // Content-Length can describe compressed wire bytes rather than decoded
  // stream bytes. Enforce the actual decoded limit, but only compare lengths
  // when the server sent an uncompressed body.
  if(declared!==null&&!response.headers.has('content-encoding')&&bytes!==Number(declared))
   refused('uncompressed response body length differs');
  content+=decoder.decode();
  let payload;
  try{payload=JSON.parse(content);}catch{refused('malformed JSON or UTF-8');}
  if(!isObject(payload)||Object.keys(payload).length!==responseKeys.length||
     responseKeys.some(k=>!owned(payload,k))||
     payload.format!=='fire-numbered-core-export-review'||payload.version!==1||
     payload.completeBackup!==false||payload.recoveryAuthorized!==false||
     payload.photoBytesIncluded!==false||payload.offDeviceCustodyVerified!==false||
     typeof payload.warning!=='string'||!payload.warning.includes('NOT a complete')||
     payload.warning.length>1500||!isObject(payload.coreSnapshot))
    refused('not the complete, truthful CORE-ONLY review envelope');
  try{validateNumberedCoreRecordsV2(payload.coreSnapshot);}
  catch{refused('numbered business records, refund ledger, or immutable high-water invalid');}
  return payload.coreSnapshot;
 }catch(error){
  if(error instanceof Error&&error.message.startsWith('FIRE numbered core review response blocked:'))
   throw error;
  refused('response stream could not be safely read');
 }finally{
  try{await reader.cancel();}catch{/* Finished or canceled. */}
  try{reader.releaseLock();}catch{/* Released by stream. */}
 }
}
