/** Full SOURCE-only integration: actual protected owner GET route -> strict
 * HTTP response reader -> native WebCrypto CORE file -> selected-file readback.
 * Uses only synthetic records and Node VM mocks; NO Cloudflare/real data.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from '../lib/numbered-records-v2-preflight.mjs';
import {readOwnerNumberedCoreReviewResponse,MAX_NUMBERED_REVIEW_HTTP_BYTES}
 from '../lib/numbered-v2-review-response.mjs';
import {prepareNumberedV2OwnerFile,verifySavedNumberedV2OwnerFile}
 from '../lib/numbered-v2-owner-file-custody.mjs';

let n=0,readCount=0,providerWrites=0;
const pass=(condition,label)=>{assert.ok(condition,label);n++};
const fail=async(input,label)=>{await assert.rejects(input,/blocked/,label);n++};
const date='2026-11-15T00:00:00.000Z';
const fakeSnapshot=()=>{
 const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES].map(t=>[t,[]]));
 tables.customers=[{id:'synthetic-c1',name:'Synthetic FIRE Customer',email:'test@example.invalid',address:'Synthetic',created_at:date}];
 tables.estimates=[{id:'synthetic-e1',customer_id:'synthetic-c1',status:'draft',total_cents:46000,created_at:date}];
 tables.fire_customer_numbers=[{customer_number:7,customer_id:'synthetic-c1',created_at:date}];
 tables.fire_job_numbers=[{job_number:11,root_estimate_id:'synthetic-e1',created_at:date}];
 tables.fire_job_estimate_links=[{estimate_id:'synthetic-e1',job_number:11}];
 return {format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables,
  rowCounts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),
  highWater:{customer:12,job:19}};
};
const snapshot=fakeSnapshot(),original=JSON.stringify(snapshot);
const rawRoute=readFileSync('app/api/backup/numbered-v2/route.ts','utf8');
pass(!/export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/.test(rawRoute),
 'Core review endpoint cannot make provider writes');
const js=rawRoute.slice(rawRoute.indexOf('const ownerEmail='))
 .replaceAll('status:number','status').replaceAll('message:string','message')
 .replace('env as typeof env & {FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE?:string}','env')
 .replace('export async function GET()','async function GET()');
let owner=null,flag='',property=false,location=false;
const ctx={Response,env:{DB:{testOnly:true},get FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE(){return flag;}},
 getChatGPTUser:async()=>owner?{email:owner}:null,
 captureNumberedCoreV2ReadOnly:async db=>{assert.equal(db,ctx.env.DB);readCount++;return snapshot;},
 customerPropertiesEnabled:()=>property,serviceLocationsEnabled:()=>location
};
vm.runInNewContext(js+'\nthis.ownerReviewHandler=GET;',ctx);
const handler=()=>ctx.ownerReviewHandler();
const phrase='Synthetic FIRE source-only protection passphrase 2026';
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{providerWrites++;throw Error('Provider/network call prohibited');};
try{
 await fail(readOwnerNumberedCoreReviewResponse(await handler()),
  'Anonymous owner core review response 401 blocks before touching D1');
 pass(readCount===0,'No anonymous D1 read');
 owner='notowner@example.invalid';flag='owner-review-only';
 await fail(readOwnerNumberedCoreReviewResponse(await handler()),
  'Different identity receives no private snapshot');
 pass(readCount===0,'No nonowner D1 read');
 owner='kylebrooks8605@gmail.com';flag='';
 await fail(readOwnerNumberedCoreReviewResponse(await handler()),
  'Explicitly disabled owner route is not usable');
 pass(readCount===0,'Default-off flag prevents D1 source read');
 flag='owner-review-only';property=true;
 await fail(readOwnerNumberedCoreReviewResponse(await handler()),
  'Optional property records cannot be silently omitted');
 property=false;location=true;
 await fail(readOwnerNumberedCoreReviewResponse(await handler()),
  'Optional location records cannot be silently omitted');
 location=false;
 const realResponse=await handler();
 pass(realResponse.status===200,'Real owner-only review handler emitted HTTP 200');
 const fileSource=await readOwnerNumberedCoreReviewResponse(realResponse);
 pass(JSON.stringify(fileSource)===original,
  'Actual endpoint response envelope and strict streamed parser preserve ALL 23 tables');
 const prepared=await prepareNumberedV2OwnerFile(fileSource,phrase,phrase,new Date(date));
 const independentSaved=new Blob([await prepared.blob.arrayBuffer()],{type:'application/octet-stream'});
 const receipt=await verifySavedNumberedV2OwnerFile(prepared,independentSaved,phrase);
 pass(receipt.selectedSavedFileByteIdentical&&receipt.savedFileAuthenticatedAndCoreValidated&&
  receipt.gate7Accepted===false&&receipt.independentOffDeviceCustodyVerified===false,
  'Verified user-selected encrypted file matches actual parsed owner route data without Gate7 promotion');
 pass(readCount===1&&JSON.stringify(snapshot)===original&&providerWrites===0,
  'Exactly one read, no provider write and no synthetic source mutation');

 const body=JSON.stringify({format:'fire-numbered-core-export-review',version:1,
  completeBackup:false,recoveryAuthorized:false,photoBytesIncluded:false,
  offDeviceCustodyVerified:false,
  warning:'CORE DATABASE RECORDS ONLY. This is NOT a complete FIRE app backup.',
  coreSnapshot:snapshot});
 const response=(content=body,extra={})=>new Response(content,{status:200,headers:{
  'content-type':'application/json','cache-control':'private, no-store',...extra}});
 for(const [name,overrides] of [
  ['claim complete backup',{completeBackup:true}],
  ['claim photo bytes',{photoBytesIncluded:true}],
  ['claim recovery authorization',{recoveryAuthorized:true}],
  ['claim offdevice custody',{offDeviceCustodyVerified:true}],
  ['invent extra feature table',{unexpected:'supplied'}],
  ['omit required warning',{warning:undefined}],
  ['corrupt numbering',{coreSnapshot:{...snapshot,highWater:{customer:0,job:19}}}],
  ['lose refund table',{coreSnapshot:{...snapshot,tables:{...snapshot.tables,payment_refunds:undefined}}}]
 ]){
  const parsed=JSON.parse(body);
  for(const [k,v] of Object.entries(overrides)){
   if(v===undefined)delete parsed[k];else parsed[k]=v;
  }
  await fail(readOwnerNumberedCoreReviewResponse(response(JSON.stringify(parsed))),
   name+' must fail before encrypted file preparation');
 }
 await fail(readOwnerNumberedCoreReviewResponse(response(body,{'cache-control':'public, max-age=300'})),
  'Cacheable records cannot be accepted');
 await fail(readOwnerNumberedCoreReviewResponse(response(body,{'content-type':'text/html'})),
  'Mislabelled HTML is not an approved records source');
 await fail(readOwnerNumberedCoreReviewResponse(response(body,{'content-length':'5500001'})),
  'Declared body above cap blocks before reading');
 await fail(readOwnerNumberedCoreReviewResponse(response(body,{'content-length':'11'})),
  'Uncompressed truncated Content-Length mismatch fails closed');
 await fail(readOwnerNumberedCoreReviewResponse(response(body+' ',{'content-length':'1'})),
  'Extra data versus declared Content-Length fails closed');
 await fail(readOwnerNumberedCoreReviewResponse(response('not valid JSON')),
  'Malformed JSON fails without decrypting');
 await fail(readOwnerNumberedCoreReviewResponse(response(new Uint8Array([0xff,0xfe,0xfd]))),
  'Invalid byte stream UTF-8 is rejected');
 await fail(readOwnerNumberedCoreReviewResponse(response(' '.repeat(MAX_NUMBERED_REVIEW_HTTP_BYTES+1))),
  'Actual decoded stream exceeding cap blocks even without Content-Length');
 // Network Content-Length can describe compressed bytes, whereas Response
 // body is transparently decompressed by fetch. Reject decoded overflow, not
 // correct gzip responses whose decoded text is longer than wire size.
 const compressedView=response(body,{'content-length':'120','content-encoding':'gzip'});
 const compressedParsed=await readOwnerNumberedCoreReviewResponse(compressedView);
 pass(JSON.stringify(compressedParsed)===original,
  'Compressed transport length mismatch does not invalidate exact decoded reviewed payload');
 const interrupted=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(body.slice(0,85)));c.error(Error('synthetic interrupted stream'));}});
 await fail(readOwnerNumberedCoreReviewResponse(response(interrupted)),
  'Interrupted download cannot produce a backup');
 pass(JSON.stringify(snapshot)===original&&providerWrites===0,
  'All failure cases preserved original fake customer data and performed zero provider writes');
 console.log('PASS '+n+'/'+n+' actual owner GET/strict-stream/AES-256-GCM/saved-byte readback integration cases (SOURCE ONLY).');
}finally{globalThis.fetch=originalFetch;}
