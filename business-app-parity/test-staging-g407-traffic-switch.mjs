import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PIN} from './staging_g407_upload_body.mjs';
import {HISTORY,READY_LOCK} from './owner_staging_g407_traffic_switch.mjs';
import {TARGET,CONSENT,LOCK,BASE,activate,reserveTraffic} from './owner_staging_g407_traffic_switch.mjs';
const newDeployment='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const bindings=[
 {name:'DB',type:'d1',id:PIN.db},
 ...['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ADMIN_PASSWORD_HASH'].map(name=>({name,type:'secret_text'})),
 ...Object.entries({FIRE_ENV:'staging',SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev',FIRE_STAGING_PRIVATE_ACTIVATION:'owner-approved',FIRE_STRIPE_MODE:'disabled'}).map(([name,text])=>({name,type:'plain_text',text}))
];
function scenario({drift=false,denial=false,wrongBinding=false,refusal=false,postDrift=false,postDenial=false}={}){
 let posts=0,reserves=0,probes=0,gets=0;
 const prev={id:PIN.deployment,versions:[{version_id:PIN.version,percentage:100}]};
 const next={id:newDeployment,versions:[{version_id:TARGET,percentage:100}]};
 const wrap=result=>Response.json({success:true,result});
 const opts={token:'synthetic-token-not-real-12345',consent:CONSENT,reserve:()=>{reserves++},fetchImpl:async(url,init)=>{
  if(url==='https://fire-app-independent-staging.kyle-bfc.workers.dev/'){
   probes++;assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.ok(!init.headers);
   return denial||(posts&&postDenial)?new Response(null,{status:200}):new Response(null,{status:302,headers:{location:'https://synthetic.cloudflareaccess.com/cdn-cgi/access/login/test'}});
  }
  assert.ok(url.startsWith(BASE+'/'));assert.ok(!url.includes('force'));
  if(init.method==='POST'){
   posts++;assert.equal(reserves,1);assert.equal(url,BASE+'/deployments');assert.deepEqual(JSON.parse(init.body),{strategy:'percentage',versions:[{version_id:TARGET,percentage:100}]});
   return refusal?new Response(null,{status:403}):wrap(next);
  }
  assert.equal(init.method,'GET');
  if(url.endsWith('/subdomain'))return wrap({enabled:true,previews_enabled:false});
  if(url.endsWith('/deployments?page=1&per_page=1')){
   gets++;return wrap({deployments:[drift?{...prev,id:newDeployment}:posts&&!postDrift?next:prev]});
  }
  if(url.endsWith('/versions/'+TARGET))return wrap({id:TARGET,resources:{bindings:wrongBinding?bindings.map(b=>b.name==='FIRE_STRIPE_MODE'?{...b,text:'live'}:b):bindings}});
  if(url.endsWith('/versions/'+PIN.version))return wrap({id:PIN.version});
  throw Error('unexpected endpoint');
 }};
 return {opts,counts:()=>({posts,reserves,probes,gets})};
}
for(const [scenarioOpts,pattern] of [[{drift:true},/PREDECESSOR_DRIFT/],[{denial:true},/ACCESS_CHALLENGE_REQUIRED/],[{wrongBinding:true},/VARIABLE/]]){
 const s=scenario(scenarioOpts);await assert.rejects(activate(s.opts),pattern);assert.equal(s.counts().posts,0);assert.equal(s.counts().reserves,0);
}
const noConsent=scenario();await assert.rejects(activate({...noConsent.opts,consent:'OLD'}),/CONSENT/);assert.deepEqual(noConsent.counts(),{posts:0,reserves:0,probes:0,gets:0});
for(const [scenarioOpts,pattern] of [[{refusal:true},/PROVIDER_HTTP_NO_RETRY/],[{postDrift:true},/DEPLOYMENT_READBACK_NO_RETRY/],[{postDenial:true},/ACCESS_CHALLENGE_REQUIRED/]]){
 const s=scenario(scenarioOpts);await assert.rejects(activate(s.opts),pattern);assert.equal(s.counts().posts,1);assert.equal(s.counts().reserves,1);
}
const s=scenario();const result=await activate(s.opts);assert.equal(result.servingVersion,TARGET);assert.equal(result.rollbackVersion,PIN.version);assert.deepEqual(s.counts(),{posts:1,reserves:1,probes:2,gets:3});
const root=mkdtempSync(join(tmpdir(),'fire-traffic-'));
try{
 assert.throws(()=>reserveTraffic(root),/HISTORY/);
 for(const n of [...HISTORY,READY_LOCK])writeFileSync(join(root,n),'history',{flag:'wx'});
 const a=reserveTraffic(root),b=reserveTraffic(root);a();assert.throws(b,/RESERVATION_NO_RETRY/);assert.throws(()=>reserveTraffic(root),/SPENT/);
 assert.ok(existsSync(join(root,LOCK)));for(const n of [...HISTORY,READY_LOCK])assert.equal(readFileSync(join(root,n),'utf8'),'history');
}finally{rmSync(root,{recursive:true,force:true})}
console.log('PASS exact traffic target, no force, pre/post Access challenge, refusal/drift controls, rollback presence and exclusive lock');
