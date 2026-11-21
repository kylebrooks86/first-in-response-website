/** QA-master customer directory D1 batch confirmation + private owner boundary. No provider. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const routePath=process.argv[2];
assert.ok(routePath,'Pass original QA-master customers route path from PR checkout');
let mode='',principal='owner',readBatches=0,checks=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};
const safe=()=>({success:true,results:[]});
const db={async batch(statements){
  readBatches++;
  eq(statements.length,8,'customer GET keeps all eight separately checked reads');
  if(mode==='throw')throw Error('Synthetic unavailable D1');
  if(mode==='nonarray')return undefined;
  if(mode==='short')return [safe()];
  if(mode==='soft')return statements.map((_,i)=>i===6?{success:false,results:[]}:safe());
  if(mode==='missing')return statements.map((_,i)=>i===5?{success:true}:safe());
  return statements.map(safe);
}};
const getChatGPTUser=async()=>{
  if(principal==='throw')throw Error('Failed owner session');
  if(principal==='missing')return null;
  if(principal==='numeric')return {email:123};
  if(principal==='unreadable')return {get email(){throw Error('Unreadable owner email');}};
  if(principal==='other')return {email:'other@synthetic.invalid'};
  return {email:'kylebrooks8605@gmail.com'};
};
const imports={
  'cloudflare:workers':{env:{DB:db}},
  '../../chatgpt-auth':{getChatGPTUser},
  '../../../lib/invoice-state.mjs':{currentInvoice:v=>v},
  '../../../lib/customer-properties':{customerPropertiesEnabled:()=>false,propertyAssociationColumns:()=>''},
  '../../../lib/service-location':{serviceLocationsEnabled:()=>false,serviceAddressColumns:()=> 'NULL AS serviceAddress'},
  '../../../lib/new-live-clean-start.mjs':{verifyNewLiveFirstJobState:async()=>true},
  '../../../lib/refund-ledger-readiness':{refundLedgerObjectsPresent:async()=>true,refundLedgerNotReady:()=>Response.json({error:'not ready'},{status:503})},
  '../../../lib/customer-write-request-guard.mjs':{ownerBrowserWriteScope:()=>null},
  '../../../lib/customer-identity':{customerIdentityPredicate:()=>({sql:'1=0',values:[]}),customerCreationReceipt:async()=>null},
  '../../../lib/customer-contact-links':{usableCustomerPhone:()=>true,usableCustomerEmail:()=>true},
  '../../../lib/customer-numbering.mjs':{customerNumberingReady:async()=>false,customerNumberForCustomer:async()=>null,newCustomerNumberStatement:()=>null},
  '../../../lib/job-numbering.mjs':{attachedJobNumbers:async()=>new Map()}
};
const code=ts.transpileModule(readFileSync(routePath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const scope={exports:{},Response,Number,Array,String,JSON,Map,URL,crypto:globalThis.crypto,Date,process:{env:{NODE_ENV:'production'}},
  require(name){if(name in imports)return imports[name];throw Error('Unknown QA customer dependency '+name);}};
vm.runInNewContext(code,scope);
assert.equal(typeof scope.exports.GET,'function');
const verifyPrivate=(r,label)=>{
  eq(r.headers.get('cache-control'),'no-store, private',label+' private cache');
  eq(r.headers.get('vary'),'Cookie',label+' session variance');
  eq(r.headers.get('x-content-type-options'),'nosniff',label+' MIME safety');
};
for(const bad of ['missing','numeric','unreadable','other','throw']){
  principal=bad;
  const prior=readBatches;
  const r=await scope.exports.GET();
  eq(r.status,401,bad+' denied');verifyPrivate(r,bad);
  eq(readBatches,prior,bad+' no D1 batch');
}
principal='owner';
for(const failure of ['throw','nonarray','short','soft','missing']){
  mode=failure;
  const r=await scope.exports.GET();
  eq(r.status,503,failure+' nonconfirmed customer D1 batch not empty list');
  verifyPrivate(r,failure);
  const body=await r.json();
  eq('customers' in body,false,failure+' never claims complete customer records');
}
mode='';
const r=await scope.exports.GET();
eq(r.status,200,'genuinely verified empty directory may return 200');
verifyPrivate(r,'real empty');
const data=await r.json();
eq(data.customers.length,0,'empty customer directory');
eq(data.estimates.length,0,'empty estimates');
eq(data.invoices.length,0,'empty invoices');
eq(data.payments.length,0,'empty payments');
console.log('PASS '+checks+' QA-master owner customer-directory auth and eight-way D1 batch fail-closed/private ledger checks (loaded real TS route, NO HOSTED OPERATIONS)');
