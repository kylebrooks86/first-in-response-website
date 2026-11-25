/** Exact STAGING beta version request review. No provider, credential or writes.
 * Cloudflare beta /workers/workers/{worker_id}/versions accepts JSON modules,
 * and inherit.version_id pins a particular version. Legacy multipart does not.
 * This is a deliberately non-sendable descriptor: no token, account, worker ID,
 * secret value, upload URL, request transport, or deployment functionality.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyStagingNoAssetsDarkSource} from './prepare_staging_noassets_dark_source.mjs';
const PIN='61c456accc7d1a447382df1d7173081f221f139bcdb8ed9eb44e3b01214bd3cf';
const SOURCE='4d1c4a74587c8145d6cbae14daf193865b976c47';
const CURRENT='4cccaa0277b839ebd1b5cbcfe4282a7d3872cbf3';
const SERVING='7838d0ea-be89-49c6-9984-d3b021082d72';
const DEPLOYMENT='10215e59-2ff0-485c-92f6-11d7f0405060';
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(x,reason)=>{if(!x)throw Error('STAGING VERSION REVIEW STOP ['+reason+']');};
export function reviewPinnedStagingVersion(folder,currentReceiptPin){
 const current=currentReceiptPin!==undefined;
 need(!current||/^[a-f0-9]{64}$/.test(currentReceiptPin),'CURRENT_RECEIPT_PIN');
 const root=resolve(folder);
 const proof=verifyStagingNoAssetsDarkSource(root,current?currentReceiptPin:PIN);
 need(proof.sourceSha===(current?CURRENT:SOURCE)&&proof.receiptPinVerified&&
      (current?(proof.serverModules>=80&&proof.clientAssets>=30):(proof.filesVerified===245&&proof.serverModules===197&&proof.clientAssets===42)),'OWNER_PIN');
 const r=JSON.parse(readFileSync(join(root,'staging-noassets-dark-source-receipt.json'),'utf8'));
 const c=JSON.parse(readFileSync(join(root,'server','wrangler.json'),'utf8'));
 need(c.name==='fire-app-independent-staging'&&c.main==='fire-staging-noassets-entry.mjs'&&
      c.d1_databases.length===1&&c.d1_databases[0].database_id==='afb2c05a-d794-4a9a-b580-924ce01c26ad'&&
      c.vars.FIRE_STRIPE_MODE==='disabled'&&c.vars.FIRE_STAGING_PRIVATE_ACTIVATION==='blocked'&&
      c.preview_urls===false&&c.r2_buckets.length===0,'TARGET');
 const rows=r.savedInventory.filter(x=>x.path.startsWith('server/')&&x.path!=='server/wrangler.json');
 const modules=[],unclassified=[];
 const seen=new Set();
 for(const row of rows){
   const name=row.path.slice(7);
   need(/^[A-Za-z0-9_./@+~-]+$/.test(name)&&!name.split('/').some(p=>!p||p==='.'||p==='..')&&!seen.has(name),'MODULE_NAME');
   seen.add(name);
   const bytes=readFileSync(join(root,row.path));
   need(bytes.length===row.bytes&&sha(bytes)===row.sha256,'MODULE_CHANGED');
   // Only unambiguous Worker module types. Auxiliary CSS/JSON/CJS need
   // separate runtime classification, not an automatic upload or omission.
   const ext=extname(name).toLowerCase();
   const type=ext==='.js'||ext==='.mjs'?'application/javascript+module':
              ext==='.wasm'?'application/wasm':
              /^fire-inline-assets\/asset-[0-9]{3}-[a-f0-9]{16}\.bin$/.test(name)?'application/octet-stream':null;
   if(!type){unclassified.push({name,bytes:row.bytes,sha256:row.sha256});continue;}
   // Verify base64 projection losslessly, but never persist raw request modules.
   const encoded=bytes.toString('base64');
   need(sha(Buffer.from(encoded,'base64'))===row.sha256,'BASE64');
   modules.push({name,content_type:type,bytes:row.bytes,sha256:row.sha256,base64Chars:encoded.length});
 }
 need(modules.some(x=>x.name===c.main)&&modules.filter(x=>x.content_type==='application/octet-stream').length===proof.clientAssets,'RUNTIME_SCOPE');
 const bindings=[
  {type:'d1',name:'DB',id:c.d1_databases[0].database_id},
  ...Object.entries(c.vars).map(([name,text])=>({type:'plain_text',name,text})),
  ...['FIRE_SESSION_SECRET','STRIPE_SECRET_KEY'].map(name=>({type:'inherit',name,version_id:SERVING})),
  {type:'secret_text',name:'FIRE_ADMIN_PASSWORD_HASH',valueSource:'owner-local DPAPI; deliberately absent'}
 ];
 need(new Set(bindings.map(b=>b.name)).size===bindings.length,'DUPLICATE_BINDING');
 return {status:'STAGING_PINNED_VERSION_CONTRACT_REVIEW_ONLY',source:proof.sourceSha,receiptSha256:proof.receiptSha256,
  worker:c.name,predecessorDeployment:DEPLOYMENT,inheritOnlyFrom:SERVING,
  apiContract:'beta version-create JSON; exact version inheritance; never script PUT or deploy',
  bodyDescriptor:{main_module:c.main,compatibility_date:c.compatibility_date,
    compatibility_flags:c.compatibility_flags,bindings,observability:c.observability,
    modulesCount:modules.length,moduleInventorySha256:sha(JSON.stringify(modules)),
    base64Chars:modules.reduce((s,m)=>s+m.base64Chars,0)},
  unresolvedAuxiliary:unclassified,accountWorkerIdMappingVerified:false,
  sourceBuildProvenanceIndependentlyVerified:false,privateAdminHashRead:false,
  providerContacted:false,uploadAuthorized:false,requestSendable:false,
  activationAuthorized:false,gate4Accepted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{need(process.argv.length===3||process.argv.length===4,'ARGS');console.log(JSON.stringify(reviewPinnedStagingVersion(process.argv[2],process.argv[3]),null,2));}
 catch(e){console.error(/^STAGING VERSION REVIEW STOP \[[A-Z_]+\]$/.test(e.message)?e.message:'STAGING VERSION REVIEW STOP [PACKAGE_OR_INPUT]');process.exitCode=1;}
}
