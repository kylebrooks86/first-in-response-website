import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runApprovedInactiveUpload,uploadApprovalDigest} from './gate9_inactive_upload_flow.mjs';
import {WORKER,PREDECESSOR,DB_UUID,ORIGIN,INHERITED,proposedInactivePlan}
  from './gate9_inactive_fullapp_contract.mjs';
const accountId='1'.repeat(32),sourceSha='2'.repeat(40);
const newId='11111111-2222-4333-8444-555555555555';
const hashA='a'.repeat(32),hashB='b'.repeat(32);
const d=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const vars={FIRE_ACCESS_REQUIRED:'enabled',FIRE_ENV:'cloudflare-staging',
  FIRE_STRIPE_MODE:'disabled',SITE_ORIGIN:ORIGIN};
const bindings=INHERITED.map(name=>name==='DB'?{name,type:'d1',id:DB_UUID}:
  Object.hasOwn(vars,name)?{name,type:'plain_text',text:vars[name]}:{name,type:'secret_text'});
function fixture({cached=false,mutateResponse,mutateState,throwRequest=false}={}){
  let clock=1000,reads=0;
  const calls=[];
  const candidate={sourceSha,manifest:{'/a.js':{hash:hashA,size:1},'/b.css':{hash:hashB,size:1}},
    versionBody:{main_module:'index.js',compatibility_date:'2026-10-16',
      compatibility_flags:['nodejs_compat'],bindings:proposedInactivePlan().bindings,
      assets:{config:{run_worker_first:true}},modules:[
        {name:'index.js',content_type:'application/javascript+module',content_base64:'eA=='},
        {name:'_headers',content_type:'text/plain',content_base64:'eA=='}]}};
  const approval={worker:WORKER,predecessor:PREDECESSOR,dbUuid:DB_UUID,accountId,
    sourceSha,candidateDigest:uploadApprovalDigest(candidate),
    operations:'register-assets,upload-assets,create-inactive-version',expiresAt:10000000};
  const transport={
    async readState(){
      const s={accountId,worker:WORKER,version:{id:PREDECESSOR,resources:{bindings}},
        versions:[{version_id:PREDECESSOR,percentage:100}]};
      mutateState?.(s,++reads);return s;
    },
    async request(req){
      calls.push(req);
      if(throwRequest)throw Error('provider-sensitive-error-must-not-escape');
      let r=req.path.endsWith('assets-upload-session')?
        {status:200,body:{success:true,errors:null,result:{jwt:'fake.upload',buckets:cached?[]:[[hashA],[hashB]]}}}:
        req.auth==='asset-session'?{status:calls.length===3?201:200,
          body:{success:true,errors:[],result:calls.length===3?{jwt:'fake.complete'}:{}}}:
        {status:201,body:{success:true,errors:[],result:{id:newId}}};
      mutateResponse?.(r,req,calls.length,()=>{clock+=3600000;});return r;
    },
    async readVersion(id){return {id,main_module:'index.js',compatibility_date:'2026-10-16',
      compatibility_flags:['nodejs_compat'],assets:{config:{run_worker_first:true}},
      moduleDigest:d(candidate.versionBody.modules),bindings:[...bindings,{name:'ASSETS',type:'assets'}]};}
  };
  return {candidate,approval,accountId,transport,now:()=>clock,calls};
}
test('missing approval makes zero provider calls',async()=>{
  const f=fixture();delete f.approval;await assert.rejects(runApprovedInactiveUpload(f),/APPROVAL/);
  assert.equal(f.calls.length,0);
});
test('upload protocol preserves predecessor and returns redacted receipt',async()=>{
  const f=fixture();const r=await runApprovedInactiveUpload(f);
  assert.equal(f.calls.length,4);assert.equal(r.newVersionPercentage,0);
  assert.equal(r.gate9Accepted,false);assert.equal(r.assetDeliveryVerified,false);
  assert(!JSON.stringify(r).includes('fake.'));
  assert(f.calls.at(-1).path.endsWith('/versions?deploy=false'));
  assert(f.calls.slice(1,3).every(c=>c.auth==='asset-session'&&c.jwt==='fake.upload'));
  assert.equal(f.calls.at(-1).json.assets.jwt,'fake.complete');
});
test('cached assets reuse registration completion and perform no bucket writes',async()=>{
  const f=fixture({cached:true});await runApprovedInactiveUpload(f);
  assert.equal(f.calls.length,2);assert.equal(f.calls.at(-1).json.assets.jwt,'fake.upload');
});
for(const [label,mutate] of [
  ['failed upload',(r,q)=>{if(q.auth==='asset-session')r.status=500;}],
  ['missing completion',(r,q)=>{if(q.auth==='asset-session')r.status=200;}],
  ['unknown hash',(r,q)=>{if(q.path.endsWith('assets-upload-session'))r.body.result.buckets=[["c".repeat(32)]];}],
  ['duplicate hash',(r,q)=>{if(q.path.endsWith('assets-upload-session'))r.body.result.buckets=[[hashA],[hashA]];}],
  ['expired upload session',(r,q,n,expire)=>{if(q.path.endsWith('assets-upload-session'))expire();}],
  ['provider error payload',(r)=>{r.body.errors=[{code:1}];}],
])test(label+' stops before version creation',async()=>{
  const f=fixture({mutateResponse:mutate});await assert.rejects(runApprovedInactiveUpload(f),/STOP/);
  assert(!f.calls.some(q=>q.path.includes('/versions?')));
});
test('traffic changes between registration and bucket upload stop next write',async()=>{
  const f=fixture({mutateState:(s,n)=>{if(n===2)s.versions[0].percentage=50;}});
  await assert.rejects(runApprovedInactiveUpload(f),/TRAFFIC/);assert.equal(f.calls.length,1);
});
test('uncertain remote write never retries or leaks raw exception',async()=>{
  const f=fixture({throwRequest:true});await assert.rejects(runApprovedInactiveUpload(f),e=>
    /REQUEST_UNCERTAIN/.test(e.message)&&!e.message.includes('sensitive'));
  assert.equal(f.calls.length,1);
});
test('mutated candidate no longer matches approval',async()=>{
  const f=fixture();f.candidate.versionBody.modules[0].content_base64='eQ==';
  await assert.rejects(runApprovedInactiveUpload(f),/APPROVAL/);assert.equal(f.calls.length,0);
});
test('unexpected version readback fails; does not attempt rollback or another write',async()=>{
  const f=fixture();f.transport.readVersion=async()=>({id:newId,moduleDigest:'wrong'});
  await assert.rejects(runApprovedInactiveUpload(f),/VERSION_IDENTITY/);assert.equal(f.calls.length,4);
});
test('late unexpected traffic change is not reported as zero traffic success',async()=>{
  const f=fixture({mutateState:(s,n)=>{if(n===5)s.versions=[{version_id:newId,percentage:100}];}});
  await assert.rejects(runApprovedInactiveUpload(f),/TRAFFIC/);assert.equal(f.calls.length,4);
});
test('extra deploy body field is rejected before remote work',async()=>{
  const f=fixture();f.candidate.versionBody.deploy=true;
  f.approval.candidateDigest=uploadApprovalDigest(f.candidate);
  await assert.rejects(runApprovedInactiveUpload(f),/VERSION_FIELDS/);assert.equal(f.calls.length,0);
});
