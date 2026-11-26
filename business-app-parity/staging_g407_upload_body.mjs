// Offline body construction for the Nov26 G4-07 candidate. No transport.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {reviewPinnedStagingVersion} from './cloudflare-launch/stripe-test-worker/review_staging_g407_nov26.mjs';
import {reviewStagingFreeWorkerBundleBudget} from './staging_beta_free_bundle_budget.mjs';
export const PIN=Object.freeze({worker:'fire-app-independent-staging',workerId:'34478b20ffef45138ec3b41fa578ec5b',version:'c5b8dfe1-9ed4-4f60-ae84-eb4e1914e9ab',deployment:'a0c127ea-6ac1-440f-9117-54ac22227452',db:'afb2c05a-d794-4a9a-b580-924ce01c26ad',receipt:'cfcac038ebfd61e2becfb246d924563176014d66b7c6aee5ce240bb0c0950b45',inventory:'7881e57bc95cf043e1b6acd7c7738e2d934b4a5fd25b47965a8e62fc9326adfe'});
const need=(x,c)=>{if(!x)throw Error('G407_STOP_'+c)};
const hash=x=>createHash('sha256').update(x).digest('hex');
export function verifyBindings(v,mode){
 need(v?.id===PIN.version||mode==='new','VERSION');
 const b=v?.resources?.bindings;
 need(Array.isArray(b)&&b.length===8&&new Set(b.map(x=>x.name)).size===8,'BINDINGS');
 const get=n=>b.find(x=>x.name===n);
 const db=get('DB');
 need(db?.type==='d1'&&(db.database_id??db.id)===PIN.db&&(!db.database_id||!db.id||db.database_id===db.id),'DB');
 for(const n of ['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY','FIRE_ADMIN_PASSWORD_HASH']){
  const x=get(n);need(x?.type==='secret_text'&&!Object.hasOwn(x,'text')&&!Object.hasOwn(x,'value'),'SECRET');
 }
 for(const [n,t] of Object.entries({FIRE_ENV:'staging',SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev',FIRE_STRIPE_MODE:'disabled',FIRE_STAGING_PRIVATE_ACTIVATION:mode==='new'?'blocked':'owner-approved'})){
  const x=get(n);need(x?.type==='plain_text'&&x.text===t,'VARIABLE');
 }
 return true;
}
export function prepareBody(folder,predecessor){
 verifyBindings(predecessor,'old');
 const root=resolve(folder),review=reviewPinnedStagingVersion(root,PIN.receipt),d=review.bodyDescriptor;
 need(review.unresolvedAuxiliary.length===0&&d.modulesCount===242&&d.moduleInventorySha256===PIN.inventory,'INVENTORY');
 const receipt=readFileSync(join(root,'staging-noassets-dark-source-receipt.json'));
 need(hash(receipt)===PIN.receipt,'RECEIPT');
 const rows=JSON.parse(receipt).savedInventory.filter(x=>x.path.startsWith('server/')&&x.path!=='server/wrangler.json');
 reviewStagingFreeWorkerBundleBudget(rows);
 const inventory=[],modules=[];
 for(const row of rows){
  const name=row.path.slice(7);
  need(/^[A-Za-z0-9_./@+~-]+$/.test(name)&&name.split('/').every(p=>p&&p!=='.'&&p!=='..'),'PATH');
  const data=readFileSync(join(root,row.path));
  need(data.length===row.bytes&&hash(data)===row.sha256,'BYTES');
  const type=/\\.m?js$/.test(name)?'application/javascript+module':/\\.wasm$/.test(name)?'application/wasm':/\\.(css|json)$/.test(name)?'text/plain':/^fire-inline-assets\\/asset-[0-9]{3}-[a-f0-9]{16}\\.bin$/.test(name)?'application/octet-stream':null;
  need(type,'TYPE');
  const content_base64=data.toString('base64');
  inventory.push({name,content_type:type,bytes:row.bytes,sha256:row.sha256,base64Chars:content_base64.length});
  modules.push({name,content_type:type,content_base64});
 }
 need(hash(JSON.stringify(inventory))===PIN.inventory,'BODY_INVENTORY');
 return {main_module:d.main_module,compatibility_date:d.compatibility_date,compatibility_flags:d.compatibility_flags,bindings:d.bindings,modules};
}
