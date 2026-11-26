// Integrates the existing sealed full-app inline-asset package with exact-version bindings.
// Pure request construction: no HTTP, token access, disk writes or deployment.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,extname} from 'node:path';
import {reviewPinnedStagingVersion} from './cloudflare-launch/stripe-test-worker/review_staging_pinned_version_contract.mjs';
import {buildStagingBindings} from './staging_beta_version_binding_contract.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=(x,stage)=>{if(!x)throw Error('STAGING_FULLAPP_BODY_STOP_'+stage)};
export function prepareStagingFullAppBody({folder,receiptPin,workerId,serving,predecessor,adminHash}){
 need(typeof receiptPin==='string'&&/^[a-f0-9]{64}$/.test(receiptPin),'PIN');
 const root=resolve(folder),review=reviewPinnedStagingVersion(root,receiptPin);
 need(review.source==='4cccaa0277b839ebd1b5cbcfe4282a7d3872cbf3'&&review.receiptSha256===receiptPin,'SOURCE');
 need(review.unresolvedAuxiliary.length===0,'UNCLASSIFIED_MODULE');
 const bytes=readFileSync(join(root,'staging-noassets-dark-source-receipt.json'));
 need(hash(bytes)===receiptPin,'RECEIPT_CHANGED');
 const receipt=JSON.parse(bytes);
 const rows=receipt.savedInventory.filter(x=>x.path.startsWith('server/')&&x.path!=='server/wrangler.json');
 const modules=rows.map(row=>{
  const name=row.path.slice(7),ext=extname(name).toLowerCase();
  need(/^[A-Za-z0-9_./@+~-]+$/.test(name)&&name.split('/').every(x=>x&&x!=='.'&&x!=='..'),'NAME');
  const data=readFileSync(join(root,row.path));
  need(data.length===row.bytes&&hash(data)===row.sha256,'BYTES');
  const content_type=ext==='.js'||ext==='.mjs'?'application/javascript+module':ext==='.wasm'?'application/wasm':/^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(name)?'application/octet-stream':null;
  need(content_type!==null,'MIME');
  return {name,content_type,content_base64:data.toString('base64')};
 });
 const d=review.bodyDescriptor;
 need(modules.length===d.modulesCount&&modules.some(x=>x.name===d.main_module),'MODULE_SCOPE');
 need(modules.filter(x=>x.content_type==='application/octet-stream').length===receipt.clientCount,'CLIENT_SCOPE');
 const bindings=buildStagingBindings({workerId,serving,predecessor,adminHash});
 return {main_module:d.main_module,compatibility_date:d.compatibility_date,compatibility_flags:d.compatibility_flags,bindings,modules};
}
// Do not transmit until independent package provenance, module classification,
// provider request-size limits and fresh exact owner approval are resolved.
