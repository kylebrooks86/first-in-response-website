/** Source-only real owner GET handler test, no provider, real data or fetch. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('app/api/backup/numbered-v2/route.ts','utf8');
assert.ok(!/export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/.test(src),'No remote restore/write endpoint can be exposed');
let js=src.slice(src.indexOf('const ownerEmail='))
 .replaceAll('status:number','status')
 .replaceAll('message:string','message')
 .replace('env as typeof env & {FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE?:string;FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE?:string}','env')
 .replace('export async function GET()','async function GET()');
assert.ok(js.includes('async function GET()'));
let count=0,fullCount=0,providerRequests=0,authEmail=null,enabled='',fullEnabled='',property=false,location=false,throwCapture=false;
const source={format:'fire-numbered-core-records-snapshot',version:2,tables:{customers:[{id:'synthetic'}]}};
const ctx={
 Response,
 env:{DB:{marker:'synthetic-db'},get FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE(){return enabled},get FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE(){return fullEnabled}},
 getChatGPTUser:async()=>authEmail===null?null:{email:authEmail},
 captureNumberedCoreV2ReadOnly:async db=>{count++;assert.equal(db,ctx.env.DB);if(throwCapture)throw new Error('Sensitive synthetic private failure');return source},
 serviceLocationsEnabled:()=>location,
 customerPropertiesEnabled:()=>property,
 captureCompleteReviewedD1RecordsReadOnly:async (db,flags)=>{
  fullCount++;assert.equal(db,ctx.env.DB);
  assert.deepEqual({customerProperties:flags.customerProperties,serviceLocations:flags.serviceLocations},
   {customerProperties:property,serviceLocations:location});
  if(throwCapture)throw Error('Private source-read error must never leak');
  return {format:'fire-full-d1-records-review',version:1,allReviewedRecordTablesIncluded:true,
   completeBackup:false,offDeviceCustodyVerified:false,photoBytesIncluded:false,
   core:source,supplemental:{tables:{auth_rate_limits:[],d1_migrations:[]}}};
 }
};
vm.runInNewContext(js+'\nthis.handler=GET;',ctx);
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
const response=async()=>await ctx.handler();
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{providerRequests++;throw new Error('No external calls authorized')};
try{
 let res=await response();
 eq(res.status,401,'Unauthenticated GET refused');
 eq(res.headers.get('cache-control'),'private, no-store','Denied response is private no-store');
 eq(count,0,'No database export on unauthorized request');
 authEmail='someone@example.com';enabled='owner-review-only';
 eq((await response()).status,401,'Nonowner cannot read candidate');
 eq(count,0,'Nonowner never reaches core data');
 authEmail='kylebrooks8605@gmail.com';enabled='';
 eq((await response()).status,404,'Owner cannot export without exact separate flag');
 eq(count,0,'Default-disabled candidate never accesses D1');
 enabled='owner-review-only';property=true;
 eq((await response()).status,409,'Property schema requires expanded archive contract');
 eq(count,0,'Property schema refuses pre-export');
 property=false;location=true;
 eq((await response()).status,409,'Service location schema also blocked');
 eq(count,0,'Service location refuses pre-export');
 location=false;
 res=await response();
 eq(res.status,200,'Approved review-only owner can capture core records');
 eq(res.headers.get('cache-control'),'private, no-store','Core record response cannot be cached');
 eq(res.headers.get('x-content-type-options'),'nosniff','Sensitive export response disables content sniffing');
 assert.match(res.headers.get('content-disposition')??'',/NOT-FULL-BACKUP/);checks++;
 const data=await res.json();
 eq(data.completeBackup,false,'Review export cannot declare itself complete backup');
 eq(data.recoveryAuthorized,false,'Review export cannot enable recovery');
 eq(data.photoBytesIncluded,false,'Core database rows never claim photo bytes');
 eq(data.offDeviceCustodyVerified,false,'No owner backup custody is invented');
 eq(data.coreSnapshot,source,'Original exact core snapshot preserved in nested review payload');
 eq(data.format,'fire-numbered-core-export-review','Envelope differs from true v2 core archive');
 eq(count,1,'Only authorized owner triggers one database snapshot');
 // New complete-records review requires its OWN explicit separate flag;
 // the old core flag can NEVER make the larger private export accessible.
 enabled='';fullEnabled='owner-review-only';
 property=false;location=false;
 res=await response();
 eq(res.status,200,'Explicitly authorized owner gets expanded transactional record review');
 eq(res.headers.get('cache-control'),'private, no-store','Expanded private data never cached');
 assert.match(res.headers.get('content-disposition')??'',/NOT-PROTECTED-BACKUP/);checks++;
 const full=await res.json();
 eq(full.format,'fire-complete-d1-records-owner-review','Complete source review has its own distinct output contract');
 eq(full.completeBackup,false,'Full D1 records without original photos and encryption are not a backup');
 eq(full.recoveryAuthorized,false,'Full read-only source does not authorize restore or release');
 eq(full.reviewedRecords.allReviewedRecordTablesIncluded,true,'Expanded result includes reviewed supplementary records');
 eq(fullCount,1,'Separate explicit flag performs exactly one expanded review read');
 property=true;location=true;
 res=await response();
 eq(res.status,200,'Property and service-location tables are delegated for reviewed full capture');
 eq(fullCount,2,'Both optional flags pass to complete-coverage capture');
 property=false;location=false;
 throwCapture=true;res=await response();
 eq(res.status,503,'Complete-read errors fail without returning partial customer data');
 assert.ok(!(await res.text()).includes('Private source-read error'));checks++;
 fullEnabled='';enabled='owner-review-only';
 throwCapture=true;
 res=await response();
 eq(res.status,503,'Database corruption or error blocks export');
 const body=await res.text();
 assert.ok(!body.includes('Sensitive synthetic private failure'));checks++;
 eq(providerRequests,0,'No network or provider actions used in tests');
 console.log('PASS '+checks+'/'+checks+' disabled default, owner-auth, no optional-schema omissions, truthful incomplete backup, confidential fail-closed owner export. NO HOSTED WRITES.');
}finally{globalThis.fetch=originalFetch;}
