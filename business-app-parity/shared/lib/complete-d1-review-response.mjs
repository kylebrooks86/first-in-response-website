/** Source-only strict owner browser reader for FULL database record review.
 * No password, auth token, customer data or plaintext file is persisted.
 * Recognizes only the separately opted-in, no-store owner-only response.
 * Never treat this response as a FULL FIRE BACKUP: original photos are absent.
 */
import {validateCompleteReviewedD1Archive}
 from './protected-complete-d1-records.mjs';

export const MAX_COMPLETE_D1_REVIEW_HTTP_BYTES=5_500_000;
const expected=['format','version','completeBackup','recoveryAuthorized',
 'offDeviceCustodyVerified','photoBytesIncluded','warning','reviewedRecords'];
const stop=why=>{throw Error('FIRE complete D1 owner review blocked: '+why);};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export async function readOwnerCompleteD1ReviewResponse(response){
 if(!(response instanceof Response)||response.status!==200||!response.ok||
    response.redirected)stop('successful direct owner-only download required');
 if(!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')||''))
  stop('source is not a private JSON response');
 const cache=response.headers.get('cache-control')||'';
 if(!/(?:^|,)\s*private\b/i.test(cache)||!/(?:^|,)\s*no-store\b/i.test(cache))
  stop('missing private no-store control');
 const disposition=response.headers.get('content-disposition')||'';
 if(!/NOT-PROTECTED-BACKUP\.json/.test(disposition))
  stop('response does not carry the explicit unprotected review label');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]{0,7})$/.test(declared)||
    Number(declared)>MAX_COMPLETE_D1_REVIEW_HTTP_BYTES))
  stop('declared complete review size is unsafe');
 if(!response.body)stop('empty or missing source stream');
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
 let bytes=0,content='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))stop('source stream must provide exact bytes');
   bytes+=value.byteLength;
   if(bytes>MAX_COMPLETE_D1_REVIEW_HTTP_BYTES)
    stop('full source exceeds maximum review payload');
   content+=decoder.decode(value,{stream:true});
  }
  if(bytes===0)stop('source stream was empty');
  if(declared!==null&&!response.headers.has('content-encoding')&&
     Number(declared)!==bytes)stop('uncompressed source was truncated');
  content+=decoder.decode();
  let payload;
  try{payload=JSON.parse(content);}catch{stop('source JSON was malformed');}
  if(!record(payload)||Object.keys(payload).length!==expected.length||
     expected.some(k=>!Object.prototype.hasOwnProperty.call(payload,k))||
     payload.format!=='fire-complete-d1-records-owner-review'||
     payload.version!==1||payload.completeBackup!==false||
     payload.recoveryAuthorized!==false||
     payload.offDeviceCustodyVerified!==false||payload.photoBytesIncluded!==false||
     typeof payload.warning!=='string'||payload.warning.length>1500||
     !payload.warning.includes('NOT A PROTECTED OR COMPLETE BACKUP'))
   stop('source review is not an explicit UNPROTECTED database-only review');
  try{
   // Keep the validated ORIGINAL envelope: the owner encryption function
   // requires its format, version and every explicit fail-closed source flag.
   // Returning the validator's reduced {core,extra,...} summary here would
   // make the real GET -> encrypt button fail despite isolated crypto tests.
   validateCompleteReviewedD1Archive(payload.reviewedRecords);
   return Object.freeze(payload.reviewedRecords);
  }catch{stop('complete source rows, schema, financial and migration integrity invalid');}
 }catch(e){
  if(e instanceof Error&&e.message.startsWith('FIRE complete D1 owner review blocked:'))
   throw e;
  stop('source was interrupted or untrusted');
 }finally{
  try{await reader.cancel();}catch{}
  try{reader.releaseLock();}catch{}
 }
}
