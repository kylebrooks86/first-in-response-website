// Private one-shot TEST version upload adapter. No activation endpoint.
// Caller must supply independently verified package and explicit upload approval.
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,readdirSync} from 'node:fs';
import {join,resolve,relative,sep} from 'node:path';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const WORKER='fire-stripe-test-20261101';
const PREDECESSOR='96e32262-fa33-4f04-a161-bee11f0353e2';
const DB='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const STRIPE='acct_1ULRIG7ND12rd1wI';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const SOURCE='33f24500d9b6af665c4fa1e2e1e588e92227c70e';
const API='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/workers/'+WORKER+'/versions';
const hash=x=>createHash('sha256').update(x).digest('hex');
const requireTrue=(x,reason)=>{if(!x)throw Error('G9_UPLOAD_STOP_'+reason)};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const inherited=['DB','FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET'];
const plain={FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:ORIGIN,FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'test',FIRE_STRIPE_EXPECTED_ACCOUNT_ID:STRIPE,FIRE_GATE9_PRIVATE_ACTIVATION:'owner-approved'};
export function prepareModules(root,pin){
 root=resolve(root);
 requireTrue(hex(pin),'RECEIPT_PIN');
 const bytes=readFileSync(join(root,'activation-review-receipt.json'));
 requireTrue(hash(bytes)===pin,'RECEIPT_CHANGED');
 const r=JSON.parse(bytes);
 requireTrue(r.sourceSha===SOURCE&&r.worker===WORKER&&r.d1===DB&&r.account===STRIPE&&r.rollbackVersion===PREDECESSOR,'TARGET');
 requireTrue(r.uploadAuthorized===false&&r.activationAuthorized===false&&r.providerContacted===false,'RECEIPT_STATE');
 requireTrue(Array.isArray(r.inventory)&&r.inventory.length>=80&&hash(JSON.stringify(r.inventory))===r.inventoryDigest,'INVENTORY');
 const cfgBytes=readFileSync(join(root,'activation-config.REVIEW-ONLY.json'));
 requireTrue(hash(cfgBytes)===r.configSha256,'CONFIG_HASH');
 const c=JSON.parse(cfgBytes);
 requireTrue(c.name===WORKER&&c.main==='fire-gate9-test-activation-entry.mjs'&&c.vars.FIRE_GATE9_PRIVATE_ACTIVATION==='blocked'&&c.vars.FIRE_STRIPE_MODE==='test'&&c.vars.FIRE_STRIPE_EXPECTED_ACCOUNT_ID===STRIPE&&c.vars.SITE_ORIGIN===ORIGIN&&c.vars.FIRE_ACCESS_REQUIRED==='enabled'&&c.vars.FIRE_ENV==='cloudflare-staging','CONFIG');
 requireTrue(c.d1_databases?.length===1&&c.d1_databases[0].binding==='DB'&&c.d1_databases[0].database_id===DB&&c.r2_buckets?.length===0&&c.kv_namespaces?.length===0&&c.services?.length===0&&c.routes?.length===0&&c.preview_urls===false&&c.workers_dev===false&&c.observability?.enabled===false,'ISOLATION');
 const seen=new Set(),modules=[];
 for(const row of r.inventory){
  // Accept the sealed builder's ordinary nested module filenames (including
  // bracketed/parenthesized chunk names), without permitting Windows-invalid
  // characters, traversal, ambiguous segments, or unexpected inventory paths.
  const validPath=typeof row.path==='string'&&row.path.startsWith('server/')&&row.path.length<=512&&
    !row.path.includes('..')&&!/[\\\x00-\x1f\x7f:*?"<>|]/.test(row.path)&&
    row.path.split('/').every(segment=>segment.length>0&&segment!=='.');
  requireTrue(validPath&&!seen.has(row.path),'PATH');
  seen.add(row.path);const path=join(root,row.path);
  // Reject symlinked parent directories as well as symlinked final files.
  const parts=row.path.split('/');let cursor=root;
  for(let i=0;i<parts.length;i++){
   cursor=join(cursor,parts[i]);const stat=lstatSync(cursor);
   requireTrue(!stat.isSymbolicLink()&&(i===parts.length-1?stat.isFile():stat.isDirectory()),'FILE');
  }
  const data=readFileSync(path);
  requireTrue(data.length===row.bytes&&hash(data)===row.sha256,'MODULE_HASH');
  const name=row.path.slice(7);
  const content_type=/\.m?js$/.test(name)?'application/javascript+module':/\.(json|css)$/.test(name)?'text/plain':/\.bin$/.test(name)?'application/octet-stream':null;
  requireTrue(content_type!==null,'UNSUPPORTED_MODULE');
  modules.push({name,content_type,content_base64:data.toString('base64')});
 }
 requireTrue(modules.some(m=>m.name===c.main)&&modules.some(m=>m.name==='index.js'),'ENTRY');
 return {main_module:c.main,compatibility_date:c.compatibility_date,compatibility_flags:c.compatibility_flags,modules};
}
export function buildPrivateVersionBody({packageRoot,receiptPin,restrictedKey,predecessor}){
 requireTrue(typeof restrictedKey==='string'&&/^rk_test_[A-Za-z0-9]+$/.test(restrictedKey),'TEST_KEY');
 requireTrue(predecessor?.id===PREDECESSOR&&Array.isArray(predecessor.resources?.bindings),'PREDECESSOR');
 const b=predecessor.resources.bindings;
 requireTrue(b.length===9&&new Set(b.map(x=>x.name)).size===9,'PREDECESSOR_BINDINGS');
 requireTrue(b.some(x=>x.name==='DB'&&x.type==='d1'&&x.id===DB),'D1');
 for(const name of inherited.slice(1))requireTrue(b.some(x=>x.name===name&&x.type==='secret_text'&&!Object.hasOwn(x,'text')&&!Object.hasOwn(x,'value')),'INHERITED_SECRET');
 for(const [name,value] of Object.entries({FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:ORIGIN,FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'disabled'}))requireTrue(b.some(x=>x.name===name&&x.type==='plain_text'&&x.text===value),'PREDECESSOR_VAR');
 return {...prepareModules(packageRoot,receiptPin),bindings:[...inherited.map(name=>({name,type:'inherit',version_id:PREDECESSOR})),...Object.entries(plain).map(([name,text])=>({name,type:'plain_text',text})),{name:'STRIPE_RESTRICTED_KEY',type:'secret_text',text:restrictedKey}]};
}
// No automatic execution. A version can be uploaded only through a private
// caller with fresh exact approval, current serving-state proof and persistent
// one-shot reservation. A rejected/uncertain request consumes the reservation.
export async function uploadOneInactiveTestVersion({packageRoot,receiptPin,restrictedKey,predecessor,readServingState,verifyStripeAccount,permissionGate,reserveOnce,tokenProvider,fetchImpl}){
 for(const f of [readServingState,verifyStripeAccount,permissionGate,reserveOnce,tokenProvider,fetchImpl])requireTrue(typeof f==='function','PRIVATE_INTEGRATION');
 const body=buildPrivateVersionBody({packageRoot,receiptPin,restrictedKey,predecessor});
 const state=await readServingState();
 requireTrue(state?.accountId===ACCOUNT&&state.worker===WORKER&&state.activeVersion===PREDECESSOR&&state.activePercentage===100,'SERVING_DRIFT');
 requireTrue(await verifyStripeAccount(restrictedKey)===STRIPE,'STRIPE_ACCOUNT');
 requireTrue(await permissionGate({action:'create-one-inactive-test-version',worker:WORKER,receiptPin,predecessor:PREDECESSOR})===true,'OWNER_APPROVAL');
 const token=await tokenProvider();
 requireTrue(typeof token==='string'&&token.length>10&&!/\s/.test(token),'CF_TOKEN');
 requireTrue(await reserveOnce({worker:WORKER,receiptPin})===true,'ATTEMPT_ALREADY_CONSUMED');
 let response;
 try{response=await fetchImpl(API+'?deploy=false',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});}catch{throw Error('G9_UPLOAD_STOP_NETWORK_UNCERTAIN_NO_RETRY')}
 requireTrue(response?.status>=200&&response.status<300,'HTTP_REFUSAL_NO_RETRY');
 const result=await response.json();
 requireTrue(result.success===true&&typeof result.result?.id==='string'&&/^[a-f0-9-]{36}$/.test(result.result.id)&&result.result.id!==PREDECESSOR,'RESPONSE_UNCERTAIN_NO_RETRY');
 return {newVersion:result.result.id,previousVersion:PREDECESSOR,activationPerformed:false,requiresIndependentReadback:true};
}
