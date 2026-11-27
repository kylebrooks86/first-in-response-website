/**
 * Verify privately saved Cloudflare GET responses against the sealed Worker-only TEST candidate.
 * Reads local files only. Authenticate and capture separately through the approved owner process.
 * Outputs counts and identifiers only, never module bytes, bindings, secrets or route URLs.
 */
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {extname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  deployedVersionFromApi, normalizedBindings, normalizeWorkerCompatibilityDate,
  unwrap, verifyNoAssetResource
} from './gate9_cloudflare_readonly_adapter.mjs';
import {DB_UUID,PREDECESSOR,WORKER} from './gate9_inactive_fullapp_contract.mjs';
import {verifyGate9NoAssetsDarkSource} from './prepare_gate9_noassets_dark_source.mjs';

const RECEIPT='gate9-noassets-dark-source-receipt.json';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const TYPES=new Map([
  ['.js','application/javascript+module'],
  ['.mjs','application/javascript+module'],
  ['.bin','application/octet-stream']
]);
const need=(value,code)=>{if(!value)throw Error('FIRE_GATE9_WORKER_ONLY_'+code);};
const orderByName=rows=>[...rows].sort((a,b)=>a.name.localeCompare(b.name,'en'));
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

function readJson(path,maxBytes=32_000_000){
  const stat=statSync(path);
  need(stat.isFile()&&stat.size>0&&stat.size<=maxBytes,'INPUT_SIZE');
  const bytes=readFileSync(path);
  need(bytes.length===stat.size,'INPUT_CHANGED');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

export function verifyWorkerOnlyReadback({folder,receiptSha256,expectedVersion,versionCapture,deploymentCapture}){
  need(typeof receiptSha256==='string'&&HASH.test(receiptSha256),'RECEIPT_PIN');
  need(typeof expectedVersion==='string'&&UUID.test(expectedVersion)&&expectedVersion!==PREDECESSOR,'VERSION_PIN');
  const source=verifyGate9NoAssetsDarkSource(folder,receiptSha256);
  const receipt=readJson(join(folder,RECEIPT),3_000_000);
  const config=readJson(join(folder,'server/wrangler.json'),100_000);

  deployedVersionFromApi(deploymentCapture);
  const version=unwrap(versionCapture);
  need(version.id===expectedVersion&&version.main_module===config.main,'VERSION_ENTRY');
  need(normalizeWorkerCompatibilityDate(version.compatibility_date)===config.compatibility_date&&
    Array.isArray(version.compatibility_flags)&&
    same([...version.compatibility_flags].sort(),[...config.compatibility_flags].sort()),'COMPATIBILITY');
  need(Array.isArray(version.urls)&&version.urls.length===0,'VERSION_URLS');
  verifyNoAssetResource(version);
  const expectedBindings=[
    {name:'DB',type:'d1',id:DB_UUID},
    ...Object.entries(config.vars).map(([name,value])=>({name,type:'plain_text',text:value})),
    ...config.secrets.required.map(name=>({name,type:'secret_text'}))
  ];
  need(same(orderByName(normalizedBindings(version)),orderByName(expectedBindings)),'BINDINGS');

  // Match the reviewed ESModule rule and Wrangler's default binary Data rule.
  const expected=new Map();
  for(const row of receipt.savedInventory){
    const type=TYPES.get(extname(row.path));
    if(row.path.startsWith('server/')&&type)expected.set(row.path.slice(7),{...row,type});
  }
  need(expected.has(config.main)&&receipt.originalClientAssets.every(asset=>expected.has(asset.module)),'INVENTORY');
  need(Array.isArray(version.modules)&&version.modules.length===expected.size,'MODULE_COUNT');
  for(const module of version.modules){
    const row=expected.get(module?.name);
    need(row&&module.content_type===row.type&&typeof module.content_base64==='string'&&
      module.content_base64.length===4*Math.ceil(row.bytes/3),'MODULE_IDENTITY');
    const bytes=Buffer.from(module.content_base64,'base64');
    need(bytes.length===row.bytes&&bytes.toString('base64')===module.content_base64&&
      createHash('sha256').update(bytes).digest('hex')===row.sha256,'MODULE_BYTES');
    expected.delete(module.name);
  }
  need(expected.size===0,'MISSING_MODULES');
  return {worker:WORKER,sourceSha:source.sourceSha,versionId:expectedVersion,
    predecessorId:PREDECESSOR,predecessorPercent:100,candidatePercent:0,
    modulesVerified:version.modules.length,clientAssetModulesVerified:source.clientAssets,
    inputAuthenticityVerified:false,providerContacted:false,gate9Accepted:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const [folder,receiptSha256,expectedVersion,versionPath,deploymentPath]=process.argv.slice(2);
    need(process.argv.length===7,'USAGE_FOLDER_PIN_VERSIONID_VERSION_JSON_DEPLOYMENT_JSON');
    console.log(JSON.stringify(verifyWorkerOnlyReadback({folder,receiptSha256,expectedVersion,
      versionCapture:readJson(versionPath),deploymentCapture:readJson(deploymentPath,1_000_000)})));
  }catch(error){
    const code=error instanceof Error&&error.message.match(/^FIRE_GATE9_WORKER_ONLY_[A-Z0-9_]+$/)?.[0];
    console.error(code||'FIRE_GATE9_WORKER_ONLY_EVIDENCE_REJECTED');
    process.exitCode=1;
  }
}
