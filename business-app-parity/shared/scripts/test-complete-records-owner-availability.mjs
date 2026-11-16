/** Verify ACTUAL owner capability GET and no-default-UI behavior without
 * external provider, hosted D1, customer records or browser credentials.
 * No permission is enabled here, and no deployment is performed.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {completeRecordsOwnerReviewAllowed}
 from '../lib/complete-records-owner-availability.mjs';

let checks=0,network=0;
const pass=(value,label)=>{assert.ok(value,label);checks++;};
const owner={email:'kylebrooks8605@gmail.com'};
const enabled={FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE:'owner-review-only'};
pass(completeRecordsOwnerReviewAllowed(owner,enabled),'Exact owner and separate opt-in accepted');
for(const [label,identity,flags] of [
 ['anonymous',null,enabled],
 ['nonowner',{email:'other@example.invalid'},enabled],
 ['missing email',{},enabled],
 ['mismatched email',{email:'kylebrooks86@gmail.com'},enabled],
 ['missing feature flag',owner,{}],
 ['core-only flag',owner,{FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE:'owner-review-only'}],
 ['disabled string',owner,{FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE:'blocked'}],
 ['other exact flag',owner,{FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE:'true'}],
 ['missing env',owner,null]
]){
 pass(!completeRecordsOwnerReviewAllowed(identity,flags),label+' cannot expose full recovery');
}
const route=readFileSync('app/api/backup/review-capability/route.ts','utf8');
pass(!/export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/.test(route),
 'Owner capability has no write handler');
pass(!/\.DB\b|\bwrangler\b|https?:\/\/|stripe\.com/.test(route),
 'Capability does not inspect D1 or call Cloudflare/Stripe');
let code=route.slice(route.indexOf('const safeHeaders='));
pass(code.startsWith('const safeHeaders='),'Route has a strict no-store implementation');
code=code.replace('export async function GET()','async function GET()');
let currentUser=null,flag='',throwAuth=false,reads=0;
const context={Response,
 env:{get FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE(){return flag;}},
 completeRecordsOwnerReviewAllowed,
 getChatGPTUser:async()=>{reads++;if(throwAuth)throw Error('private auth failure');return currentUser;}
};
vm.runInNewContext(code+'\nthis.ownerCapability=GET;',context);
const call=()=>context.ownerCapability();
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{network++;throw Error('provider request forbidden');};
try{
 for(const [label,user,value,expected] of [
  ['anonymous',null,'owner-review-only',404],
  ['nonowner',{email:'not-owner@example.invalid'},'owner-review-only',404],
  ['owner off',owner,'blocked',404],
  ['owner wrong flag',owner,'true',404],
  ['owner exact flag',owner,'owner-review-only',200]
 ]){
  currentUser=user;flag=value;
  const result=await call();
  pass(result.status===expected,label+' exact HTTP status');
  pass(result.headers.get('cache-control')==='private, no-store',
   label+' cannot be cached');
  pass(result.headers.get('x-content-type-options')==='nosniff',
   label+' cannot sniff');
  const data=await result.json();
  if(expected===200){
   pass(data.format==='fire-complete-records-owner-review-capability'&&
    data.version===1&&data.reviewEnabled===true&&
    data.completeBackup===false&&data.gate7Accepted===false,
    'Granted capability claims no completed backup or accepted release gate');
   pass(Object.keys(data).length===5,'No customer identifiers or secrets in capability');
  }else pass(data.error==='Not found'&&data.reviewEnabled===undefined,
   label+' does not disclose owner capability');
 }
 throwAuth=true;
 const failClosed=await call();
 pass(failClosed.status===404,'Authentication exception fails closed');
 pass(!(await failClosed.text()).includes('private auth failure'),
  'Provider-auth exception is not leaked');
 pass(network===0,'No external provider requests');
 const dashboard=readFileSync('app/dashboard.tsx','utf8');
 const widget=readFileSync('components/owner-complete-recovery-availability.tsx','utf8');
 const records=readFileSync('components/complete-d1-records-review.tsx','utf8');
 const pair=readFileSync('components/protected-pair-owner-review.tsx','utf8');
 pass(dashboard.includes('<OwnerCompleteRecoveryAvailability/>')&&
  dashboard.includes('<NumberedCoreRecordsReview reviewEnabled={false}/>'),
  'Dashboard preserves core UI default OFF and mounts only gated new workflow');
 pass(!dashboard.includes('<CompleteD1RecordsReview reviewEnabled={true}/>')&&
  !dashboard.includes('<ProtectedPairOwnerReview reviewEnabled={true}/>'),
  'Neither complete or photo-pair control is unconditionally enabled');
 pass(widget.includes('useState(false)')&&
  widget.includes('if(!allowed)return null')&&
  widget.includes("fetch('/api/backup/review-capability'")&&
  widget.includes("credentials:'same-origin'")&&
  widget.includes("cache:'no-store'")&&
  widget.includes("redirect:'error'")&&
  widget.includes("controller.abort()"),
  'UI invisible by default; exact same-origin, no-store owner GET, abort on unmount');
 pass(widget.includes('payload.reviewEnabled===true')&&
  widget.includes('payload.completeBackup===false')&&
  widget.includes('payload.gate7Accepted===false')&&
  widget.includes('<CompleteD1RecordsReview reviewEnabled={allowed}/>')&&
  widget.includes('<ProtectedPairOwnerReview reviewEnabled={allowed}/>'),
  'Both controls require separately authenticated affirmative capability');
 pass(records.includes('if(!reviewEnabled)return null')&&
  pair.includes('if(!reviewEnabled)return null'),
  'Actual records and photo controls still fail invisible when disabled');
 console.log('PASS '+checks+'/'+checks+
  ' full records/photo owner review availability: default OFF, exact owner+flag, private GET, no D1, UI remains hidden. SOURCE ONLY.');
}finally{globalThis.fetch=originalFetch;}
