import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {assertNewLiveFirstJobState,verifyNewLiveFirstJobState} from '../lib/new-live-clean-start.mjs';
const empty={customers:0,estimates:0,numberedCustomers:0,numberedJobs:0,jobLinks:0,customerSequence:0,jobSequence:0,invalidCustomers:0,invalidJobLinks:0};
assert.equal(assertNewLiveFirstJobState(empty),true);
assert.equal(assertNewLiveFirstJobState({...empty,customers:1,numberedCustomers:1,customerSequence:1}),true,
 'Saving a real customer before the first job must not block Job #0001');
assert.equal(assertNewLiveFirstJobState({...empty,customers:2,numberedCustomers:2,customerSequence:2,estimates:1,numberedJobs:1,jobLinks:1,jobSequence:1}),true);
for(const invalid of [
 {...empty,jobSequence:8},
 {...empty,numberedJobs:1,jobSequence:1},
 {...empty,jobLinks:1},
 {...empty,customers:1},
 {...empty,invalidCustomers:1},
 {...empty,invalidJobLinks:1},
 {...empty,numberedCustomers:1,customerSequence:1},
 {...empty,estimates:1},
 {...empty,estimates:2,numberedJobs:1,jobSequence:0},
 {...empty,customers:-1},
 {...empty,jobSequence:1.5},
 {...empty,jobSequence:'0'},
 null
])assert.throws(()=>assertNewLiveFirstJobState(invalid),/NEW LIVE/);
let sql='';
const db={prepare(query){sql=query;return {first:async()=>empty}}};
assert.equal(await verifyNewLiveFirstJobState(db),true);
assert.match(sql,/sqlite_sequence/);
assert.match(sql,/fire_job_estimate_links/);
assert.match(sql,/fire_customer_numbers/);
assert.match(sql,/e.customer_id<>root.customer_id/);
assert.match(sql,/LEFT JOIN fire_customer_numbers/);
const route=readFileSync(new URL('../app/api/estimates/route.ts',import.meta.url),'utf8');
assert.match(route,/FIRE_NEW_LIVE_CLEAN_START/);
assert.match(route,/await verifyNewLiveFirstJobState\(env.DB\)/);
assert.match(route,/!jobNumberFlag\|\|!customerNumberFlag/);
assert.ok(route.indexOf('await verifyNewLiveFirstJobState(env.DB)')<route.indexOf('const statements=[]'));
const customer=readFileSync(new URL('../app/api/customers/route.ts',import.meta.url),'utf8');
assert.match(customer,/recoveredAfterUncertainSave:true/);
assert.match(customer,/customerCreationReceipt\(env.DB,recoveryRequestId\)/);
assert.match(customer,/saveUncertain:true,requestId:recoveryRequestId/);
assert.match(customer,/FIRE_NEW_LIVE_CLEAN_START/);
assert.match(customer,/FIRE_CUSTOMER_NUMBERS_CANDIDATE/);
const customerPost=customer.slice(customer.indexOf('export async function POST'));
const customerGet=customer.slice(customer.indexOf('export async function GET'),customer.indexOf('export async function POST'));
assert.match(customerPost,/FIRE_CUSTOMER_NUMBERS_CANDIDATE/,'POST must refuse unnumbered NEW LIVE customers');
assert.ok(customerPost.indexOf('FIRE_CUSTOMER_NUMBERS_CANDIDATE')<customerPost.indexOf('const insertStatement='),
  'NEW LIVE flag checked before customer INSERT');
assert.doesNotMatch(customerGet,/NEW LIVE customer numbering is not enabled/,'Read-only GET must not substitute for POST guard');
assert.match(customer,/await verifyNewLiveFirstJobState\(env.DB\)/);
assert.ok(customer.indexOf('await verifyNewLiveFirstJobState(env.DB)')<customer.indexOf('const insertStatement='));
assert.match(customer,/if\(numbered&&!customerNumber\)/);
assert.match(customer,/if\(numbered&&!customerNumber\)throw Error/);
const communications=readFileSync(new URL('../app/api/customer-messages/route.ts',import.meta.url),'utf8');
assert.match(communications,/recoveredAfterUncertainPreparation:true/);
assert.match(communications,/recoveredAfterUncertainConfirmation:true/);
assert.match(communications,/deliveryConfirmed:false/);
assert.match(communications,/confirmationSource:'owner'/);
assert.match(communications,/ownerConfirmedSent:!op.cancelled/);
assert.match(communications,/deliveryConfirmed:false,confirmationSource:'owner'/);
assert.match(communications,/receipt\.template!==op.template\|\|receipt\.body!==expectedBody/);
assert.match(communications,/\.bind\(op.estimateId,op.customerId\)\.first/);
assert.doesNotMatch(communications,/deliveryConfirmed:!op.cancelled/);
assert.match(communications,/estimateStatus:estimate\?\.status,ownerConfirmedSent:true/);
assert.match(communications,/message:receipt,cancelled:true,ownerConfirmedSent:false/);
assert.match(communications,/saveUncertain:true/);
assert.match(communications,/uncertainOperation\.template!=='review'/);
assert.match(communications,/customer_messages WHERE id=\? AND customer_id=\? AND channel=\?/);
// Exercise the actual private NEW LIVE read-only route (not a mocked response).
// All identities, flags and D1 inspection below are synthetic; no hosted calls.
const cleanSource=readFileSync(new URL('../app/api/release/new-live-clean-start/route.ts',import.meta.url),'utf8');
// This independent NEW LIVE CI job has no npm installation. Load the exact
// production route by removing ONLY three audited imports and two TS-only
// annotations; fail if its shape changes rather than installing dependencies.
assert.equal([...cleanSource.matchAll(/^import [^\n]+;$/gm)].length,3,
 'Only the three reviewed production dependencies may be replaced');
assert.match(cleanSource,/const fail=\(status:number,message:string\)/);
assert.match(cleanSource,/const flags=env as typeof env & \{[\s\S]*?\};/);
assert.match(cleanSource,/export async function GET\(\)/);
const cleanJs=cleanSource
 .replace(/^import [^\n]+;$/gm,'')
 .replace('const fail=(status:number,message:string)','const fail=(status,message)')
 .replace(/const flags=env as typeof env & \{[\s\S]*?\};/,'const flags=env;')
 .replace('export async function GET()','async function GET()')+
 '\nexports.GET=GET;\n';
let cleanUser=null,cleanReads=0,cleanFailure=false;
const cleanEnv={DB:{},FIRE_ENV:'new-live-prelaunch',FIRE_NEW_LIVE_CLEAN_START:'required'};
const cleanRoute={};
vm.runInNewContext(cleanJs,{
 exports:cleanRoute,Response,env:cleanEnv,
 getChatGPTUser:async()=>{
  if(cleanUser==='throw')throw Error('Synthetic principal unavailable');
  return cleanUser;
 },
 inspectNewLiveFirstJobCleanStart:async()=>{
  cleanReads++;
  if(cleanFailure)throw Error('Synthetic D1 unavailable');
  return {firstJobNumberExpected:'0001',tableRecordsAllEmpty:true};
 }
},{filename:'new-live-clean-start/route.ts'});
const privateClean=(response,status)=>{
 assert.equal(response.status,status);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('vary'),'Cookie','Never share owner-only first-job D1 evidence between sessions');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
};
privateClean(await cleanRoute.GET(),401);
assert.equal(cleanReads,0,'Anonymous first-job readback must not inspect D1');
cleanUser={};
privateClean(await cleanRoute.GET(),401);
cleanUser={email:'nonowner@example.invalid'};
privateClean(await cleanRoute.GET(),401);
assert.equal(cleanReads,0,'Invalid owner identity never reads release schema');
cleanUser={email:'kylebrooks8605@gmail.com'};
cleanEnv.FIRE_ENV='staging';
privateClean(await cleanRoute.GET(),404);
assert.equal(cleanReads,0,'STAGING cannot inspect NEW LIVE clean-start');
cleanEnv.FIRE_ENV='new-live-prelaunch';
const checked=await cleanRoute.GET();
privateClean(checked,200);
const inspectedProof=await checked.json();
assert.equal(inspectedProof.firstJobNumberExpected,'0001');
assert.equal(inspectedProof.readOnly,true);
assert.equal(inspectedProof.releaseApproved,false);
assert.equal(inspectedProof.providerIdentityVerified,false);
assert.equal(inspectedProof.orderedMigrationsVerified,false);
assert.equal(cleanReads,1,'Only correct authenticated release target can inspect');
cleanFailure=true;
privateClean(await cleanRoute.GET(),409);
assert.equal(cleanReads,2,'D1 failure cannot become a success receipt');
cleanUser='throw';
privateClean(await cleanRoute.GET(),401);
assert.equal(cleanReads,2,'Identity failure never inspects D1');
console.log('PASS: NEW LIVE clean-start actual-route 401/404/200/409, session-private response headers, no release approval or provider write');
console.log('PASS: NEW LIVE numbering, customer save and communication uncertain-ACK recovery contracts');
