const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require(process.env.FIRE_G607_TS);

const source=fs.readFileSync(
 'business-app-parity/shared/app/api/backup/numbered-v2/route.ts','utf8'
);

let checks=0,reads=0,user=null,authError=false,dbError=false;
let options;
const env={DB:{}};

const equal=(actual,expected,label)=>{
 assert.deepEqual(actual,expected,label);
 checks++;
};

const modules={
 'cloudflare:workers':{env},
 '../../../chatgpt-auth':{
  getChatGPTUser:async()=>{
   if(authError)throw Error('synthetic private authentication error');
   return user;
  }
 },
 '../../../../lib/numbered-v2-d1-snapshot.mjs':{
  captureNumberedCoreV2ReadOnly:async()=>{
   reads++;
   if(dbError)throw Error('synthetic private database error');
   return {synthetic:true};
  }
 },
 '../../../../lib/complete-d1-records-review.mjs':{
  captureCompleteReviewedD1RecordsReadOnly:async(db,flags)=>{
   reads++;
   options=flags;
   if(dbError)throw Error('synthetic private database error');
   return {synthetic:true};
  }
 },
 '../../../../lib/service-location':{
  serviceLocationsEnabled:flags=>flags.syntheticLocations===true
 },
 '../../../../lib/customer-properties':{
  customerPropertiesEnabled:flags=>flags.syntheticProperties===true
 }
};

const compiled=ts.transpileModule(source,{
 compilerOptions:{
  module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022
 }
}).outputText;

const context={
 exports:{},
 Response,
 require:name=>{
  assert.ok(Object.hasOwn(modules,name),'Unexpected dependency: '+name);
  return modules[name];
 }
};

vm.runInNewContext(compiled,context);

const GET=context.exports.GET;
const owner={
 email:'kylebrooks8605@gmail.com'
};

async function call(label,status,expectedReads){
 const before=reads;
 const response=await GET();
 const body=await response.json();

 equal(response.status,status,label);
 equal(reads-before,expectedReads,label+' database access');
 equal(response.headers.get('cache-control'),'private, no-store');
 equal(response.headers.get('x-content-type-options'),'nosniff');
 equal(body.completeBackup,false);

 if(status!==200){
  equal(body.reviewedRecords,undefined);
  equal(body.coreSnapshot,undefined);
  equal(JSON.stringify(body).includes('synthetic private'),false);
 }

 console.log('PASS: '+label);
 return body;
}

(async()=>{
 env.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE='owner-review-only';

 await call('Anonymous denied',401,0);

 user={email:'nonowner@example.invalid'};
 await call('Authenticated nonowner denied',401,0);

 user={email:123};
 await call('Malformed identity denied',401,0);

 authError=true;
 await call('Authentication exception denied',401,0);
 authError=false;

 user=owner;
 delete env.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE;

 await call('Owner without opt-in denied',404,0);

 env.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE='true';
 await call('Incorrect feature flag denied',404,0);

 env.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE='owner-review-only';

 const full=await call('Authorized complete records export',200,1);

 equal(options.sessionEnabled,true);
 equal(full.recoveryAuthorized,false);
 equal(full.photoBytesIncluded,false);
 equal(full.offDeviceCustodyVerified,false);

 dbError=true;
 await call('Complete export database failure',503,1);
 dbError=false;

 delete env.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE;
 env.FIRE_NUMBERED_V2_CORE_EXPORT_CANDIDATE='owner-review-only';

 const core=await call('Authorized historical core export',200,1);
 equal(core.recoveryAuthorized,false);

 env.syntheticProperties=true;
 await call('Incomplete property export blocked',409,0);

 env.syntheticProperties=false;
 env.syntheticLocations=true;
 await call('Incomplete service-location export blocked',409,0);

 env.syntheticLocations=false;
 dbError=true;
 await call('Core export database failure',503,1);

 for(const method of ['POST','PUT','PATCH','DELETE']){
  equal(context.exports[method],undefined);
 }

 console.log('G607 ACTUAL BACKUP ROUTE PASS: '+checks+'/'+checks);
})().catch(error=>{
 console.error(error);
 process.exitCode=1;
});