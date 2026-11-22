import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 ACCOUNT_ID,TARGETS,evaluateHostedBindings,captureHostedBindingNames
} from './owner_g4_hosted_binding_names_readonly.mjs';

const success=result=>({success:true,errors:[],result});
const secretValue='DO_NOT_PRINT_FAKE_SECRET_VALUE';
const bindings=target=>{
 const x=TARGETS[target];
 return [
  {name:'DB',type:'d1',database_id:x.database},
  ...x.secrets.map(name=>({name,type:'secret_text',text:secretValue})),
  {name:'FIRE_ENV',type:'plain_text',text:'DO_NOT_PRINT_RUNTIME_VALUE'}
 ];
};
const response=target=>success({bindings:bindings(target)});
const script=fileURLToPath(new URL('./owner_g4_hosted_binding_names_readonly.mjs',import.meta.url));
const noProvider=JSON.parse(execFileSync(process.execPath,[script],{
 encoding:'utf8',env:{...process.env,CI:'true',CLOUDFLARE_API_TOKEN:secretValue}
}));
assert.equal(noProvider.providerContacted,false);
assert.equal(noProvider.gate4Accepted,false);
console.log('PASS offline default never loads credentials or calls Cloudflare');

const calls=[];
const mock=async (_token,path)=>{
 calls.push(path);
 const target=Object.keys(TARGETS).find(t=>path.endsWith('/workers/scripts/'+TARGETS[t].worker+'/settings'));
 assert.ok(target);
 return response(target);
};
const received=await captureHostedBindingNames({token:'synthetic-owner-token-value-0000000',request:mock});
assert.deepEqual(received.targets.map(t=>t.target),['qa','staging','dr','new-live']);
assert.equal(received.providerReadbackVerified,false);
assert.equal(received.noSecretValuesOutput,true);
assert.equal(received.cloudflareWrites,false);
assert.equal(received.gate4Accepted,false);
assert.equal(received.servingWorkerVersionProof,false);
assert.ok(received.targets.every(t=>t.expectedDBIdentityMatches&&t.expectedAuthSecretTypesValid));
assert.equal(calls.length,4);
assert.deepEqual(new Set(calls),new Set(Object.values(TARGETS).map(x=>
 '/client/v4/accounts/'+ACCOUNT_ID+'/workers/scripts/'+x.worker+'/settings')));
assert.ok(calls.every(c=>!c.includes('/secrets')&&!c.includes('/d1')&&!c.includes('/routes')));
const serialized=JSON.stringify(received);
assert.ok(!serialized.includes(secretValue));
assert.ok(!serialized.includes('DO_NOT_PRINT_RUNTIME_VALUE'));
assert.ok(!serialized.includes(TARGETS.qa.database));
assert.ok(!serialized.includes('synthetic-owner-token'));
console.log('PASS exactly four fixed account GET settings paths; no secret/token/value/database ID in receipt');

for(const [target,settings] of Object.entries(TARGETS)){
 const p=evaluateHostedBindings(target,response(target));
 assert.equal(p.worker,settings.worker);
 assert.equal(p.expectedDBIdentityMatches,true);
 assert.deepEqual(Object.values(p.expectedAuthSecretNamePresence),[true,true]);
 assert.equal(p.r2BindingCount,0);
 assert.equal(p.wrongTargetAuthSecretCount,0);
 assert.equal(p.unexpectedPaymentCredentialBindings,0);
 assert.equal(p.servingVersionSettingsVerified,false);
 assert.equal(p.effectiveCloudflareAccessVerified,false);
 assert.equal(p.gate4Accepted,false);
}
console.log('PASS four distinct D1 and authentication-name expectations, no serving-version overclaim');

const staging=response('staging');
staging.result.bindings=staging.result.bindings.filter(b=>b.name!=='FIRE_ADMIN_PASSWORD_HASH');
staging.result.bindings.push({name:'STRIPE_SECRET_KEY',type:'secret_text',text:secretValue});
staging.result.bindings.push({name:'BUCKET',type:'r2_bucket',bucket_name:'NO_COST_SERVICE_ASSUMED'});
staging.result.bindings.push({name:'FIRE_QA_PASSWORD_HASH',type:'secret_text',text:secretValue});
const discrep=evaluateHostedBindings('staging',staging);
assert.equal(discrep.expectedAuthSecretNamePresence.FIRE_ADMIN_PASSWORD_HASH,false);
assert.equal(discrep.unexpectedPaymentCredentialBindings,1);
assert.equal(discrep.r2BindingCount,1);
assert.equal(discrep.wrongTargetAuthSecretCount,1);
assert.equal(discrep.expectedDBIdentityMatches,true);
assert.ok(!JSON.stringify(discrep).includes('NO_COST_SERVICE_ASSUMED'));
console.log('PASS existing reported STAGING wrong/missing auth name, stray Stripe and prohibited R2 flagged');

const legacy=response('dr');
legacy.result.bindings[0]={name:'DB',type:'d1',id:TARGETS.dr.database};
assert.equal(evaluateHostedBindings('dr',legacy).expectedDBIdentityMatches,true);
legacy.result.bindings[0].database_id=TARGETS.qa.database;
assert.equal(evaluateHostedBindings('dr',legacy).expectedDBIdentityMatches,false);
console.log('PASS deprecated D1 id supported; conflicting physical database ID not certified');

const wrong=response('new-live');
wrong.result.bindings[0].database_id=TARGETS.dr.database;
assert.equal(evaluateHostedBindings('new-live',wrong).expectedDBIdentityMatches,false);
wrong.result.bindings[1].type='plain_text';
assert.equal(evaluateHostedBindings('new-live',wrong).expectedAuthSecretTypesValid,false);
assert.equal(evaluateHostedBindings('new-live',wrong).expectedAuthSecretNamePresence.FIRE_NEW_LIVE_PASSWORD_HASH,false);
console.log('PASS cross-bound D1 and plaintext auth variable cannot be mistaken for secret binding');

for(const invalid of [
 null,{},success({}),success({bindings:null}),
 {...success({bindings:[]}),success:false},
 {...success({bindings:[]}),errors:[{code:1000}]},
 {...success({bindings:[]}),errors:'unexpected'},
 success({bindings:[{name:'DB',type:'d1'}, {name:'DB',type:'d1'}]}),
 success({bindings:[{name:'BAD\nSECRET',type:'secret_text'}]}),
 success({bindings:[{name:'GOOD',type:43}]}),
 success({bindings:Array.from({length:121},(_,i)=>({name:'B'+i,type:'plain_text'}))})
]){
 assert.throws(()=>evaluateHostedBindings('staging',invalid),/READ-ONLY STOP/);
}
assert.throws(()=>evaluateHostedBindings('unknown',response('dr')),/READ-ONLY STOP/);
await assert.rejects(captureHostedBindingNames({token:'short',request:mock}),/READ-ONLY STOP/);
await assert.rejects(captureHostedBindingNames({token:'synthetic owner token with spaces',request:mock}),/READ-ONLY STOP/);
console.log('PASS malformed provider wrapper, duplicate names and invalid input fail closed');

let requestCounter=0;
await assert.rejects(captureHostedBindingNames({token:'synthetic-owner-token-value-0000000',
 request:async(token,path)=>{
  requestCounter++;
  if(requestCounter===3)throw Error('INJECTED PROVIDER DETAIL '+secretValue);
  return mock(token,path);
 }
}),/INJECTED PROVIDER DETAIL/);
// Tests inject exceptions directly. The owner CLI handles and sanitizes them.
const cli=execFileSync(process.execPath,[script],{encoding:'utf8'});
assert.ok(!cli.includes(secretValue));
console.log('PASS provider exception cannot create completed receipt; owner CLI prints only sanitized STOP');
console.log('TOTAL G4 hosted binding-name evidence contract PASS (offline, no network)');
