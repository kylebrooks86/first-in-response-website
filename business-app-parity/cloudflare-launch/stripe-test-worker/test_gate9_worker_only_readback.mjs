import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PREDECESSOR} from './gate9_inactive_fullapp_contract.mjs';
import {verifyWorkerOnlyReadback} from './verify_gate9_worker_only_readback.mjs';

const [folder,receiptSha256]=process.argv.slice(2);
const readJson=name=>JSON.parse(readFileSync(join(folder,name),'utf8'));
const receipt=readJson('gate9-noassets-dark-source-receipt.json');
const config=readJson('server/wrangler.json');
const versionId='7d746ffc-c894-4ae9-8040-0d0572cbe6ac';
const modules=receipt.savedInventory
  .filter(row=>/^server\/.+\.(?:js|mjs|bin)$/.test(row.path))
  .map(row=>({
    name:row.path.slice(7),
    content_type:row.path.endsWith('.bin')?'application/octet-stream':'application/javascript+module',
    content_base64:readFileSync(join(folder,row.path)).toString('base64')
  }));
const version={
  id:versionId,main_module:config.main,compatibility_date:config.compatibility_date,
  compatibility_flags:config.compatibility_flags,urls:[],modules,
  bindings:[
    {name:'DB',type:'d1',database_id:config.d1_databases[0].database_id},
    ...Object.entries(config.vars).map(([name,text])=>({name,type:'plain_text',text})),
    ...config.secrets.required.map(name=>({name,type:'secret_text'}))
  ]
};
const deployment={deployments:[{strategy:'percentage',versions:[{version_id:PREDECESSOR,percentage:100}]}]};
const envelope=result=>({success:true,errors:[],result});
const verify=(v=version,d=deployment,pin=receiptSha256)=>verifyWorkerOnlyReadback({
  folder,receiptSha256:pin,expectedVersion:versionId,versionCapture:envelope(v),deploymentCapture:envelope(d)
});
const proof=verify();
assert.equal(proof.clientAssetModulesVerified,41);
assert.equal(proof.modulesVerified,modules.length);
assert.equal(proof.candidatePercent,0);
assert.equal(proof.inputAuthenticityVerified,false);
assert.equal(proof.gate9Accepted,false);

const asset=modules.findIndex(module=>module.name===receipt.originalClientAssets[0].module);
assert.ok(asset>=0);
const changed=structuredClone(version);
const bytes=Buffer.from(changed.modules[asset].content_base64,'base64');
bytes[0]^=1;
changed.modules[asset].content_base64=bytes.toString('base64');
assert.throws(()=>verify(changed),/MODULE_BYTES/);
const wrongType=modules.map((module,index)=>index===asset?{...module,content_type:'text/plain'}:module);
assert.throws(()=>verify({...version,modules:wrongType}),/MODULE_IDENTITY/);
const duplicate=[...modules];
duplicate[asset]=modules.find((_,index)=>index!==asset);
assert.throws(()=>verify({...version,modules:duplicate}),/MODULE_IDENTITY/);
assert.throws(()=>verify({...version,modules:modules.slice(1)}),/MODULE_COUNT/);
assert.throws(()=>verify({...version,urls:['https://unused.example']}),/VERSION_URLS/);
assert.throws(()=>verify({...version,resources:{assets:{}}}),/ASSET_RESOURCE/);
assert.throws(()=>verify({...version,bindings:version.bindings.map(binding=>binding.name==='DB'
  ?{...binding,database_id:'0091f0b1-51f7-4b71-9df4-4a63cf1f922b'}:binding)}),/BINDINGS/);
assert.throws(()=>verify(version,{deployments:[{strategy:'percentage',versions:[
  {version_id:PREDECESSOR,percentage:99},{version_id:versionId,percentage:1}
]}]}),/ACTIVE_VERSION_CHANGED/);
assert.throws(()=>verify(version,deployment,'0'.repeat(64)),/independent SHA256 pin/);
console.log('PASS Worker-only TEST verifier: actual package bytes and 41 asset modules match synthetic capture, 9 negative controls rejected.');
