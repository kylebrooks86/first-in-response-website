/**
 * FIRE Gate9: bridge the proven full-app compiled source to the private,
 * permission-gated upload coordinator's immutable approval candidate.
 *
 * LOCAL ONLY: no REST, no provider credentials, no JSON output file, and no
 * upload. Accepts only an exact 40-hex Git SOURCE head SHA. It strips ONLY
 * the synthetic fake JWT and refuses an actual asset JWT. Never prints code.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOfflineVersionEnvelope,SYNTHETIC_ASSET_JWT}
  from './gate9_offline_version_envelope.mjs';
import {createLocalAssetManifest} from './gate9_offline_asset_manifest.mjs';
import {verifyAssetManifest,verifyInactiveProposal,proposedInactivePlan}
  from './gate9_inactive_fullapp_contract.mjs';
import {uploadApprovalDigest} from './gate9_inactive_upload_flow.mjs';

const fail=code=>{throw Error('STOP: Gate9 local release candidate ['+code+']. NO provider writes.');};
const ok=(v,c)=>{if(!v)fail(c);};

export function compileGate9ApprovalCandidate({serverDir,clientDir,sourceSha}){
  ok(typeof sourceSha==='string'&&/^[0-9a-f]{40}$/.test(sourceSha)&&
    !/^0+$/.test(sourceSha),'SOURCE_SHA');
  const {request,proof,assetCount,specialCount}=
    createOfflineVersionEnvelope(serverDir,clientDir);
  const manifest=createLocalAssetManifest(clientDir);
  verifyAssetManifest(manifest);
  ok(assetCount===Object.keys(manifest).length&&specialCount>=1,
    'SOURCE_MANIFEST');
  const body=structuredClone(request.body);
  ok(body.assets?.jwt===SYNTHETIC_ASSET_JWT &&
    Object.keys(body.assets).sort().join(',')==='config,jwt',
    'SYNTHETIC_JWT');
  // The ONLY allowed transformation: strip the nonprovider fake JWT.
  delete body.assets.jwt;
  ok(Object.keys(body.assets).join(',')==='config' &&
    Array.isArray(body.assets.config.run_worker_first)&&
    body.assets.config.run_worker_first.length===1&&
    body.assets.config.run_worker_first[0]==='/api/*','ASSET_CONFIG');
  verifyInactiveProposal({...proposedInactivePlan(),bindings:body.bindings});
  ok(body.modules.length===proof.moduleCount+specialCount &&
    body.modules.some(m=>m.name===body.main_module)&&
    body.modules.some(m=>m.name==='_headers'&&m.content_type==='text/plain'),
    'COMPLETE_MODULES');
  const candidate={sourceSha,manifest,versionBody:body};
  const candidateDigest=uploadApprovalDigest(candidate);
  ok(/^[a-f0-9]{64}$/.test(candidateDigest),'DIGEST');
  return {
    candidate,candidateDigest,
    counts:{compiledModules:body.modules.length,staticAssets:assetCount},
    noFileWritten:true,approved:false,uploaded:false,gate9Accepted:false
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    ok(process.argv.length===5,'ARGS');
    const r=compileGate9ApprovalCandidate({
      serverDir:process.argv[2],clientDir:process.argv[3],sourceSha:process.argv[4]
    });
    console.log('PASS: Exact-head TEST compiled approval candidate assembled in memory');
    console.log('SOURCE_SHA='+r.candidate.sourceSha);
    console.log('CANDIDATE_SHA256='+r.candidateDigest);
    console.log('CANDIDATE_WORKER_MODULES='+r.counts.compiledModules);
    console.log('CANDIDATE_CLIENT_ASSETS='+r.counts.staticAssets);
    console.log('FAKE_JWT_STRIPPED=TRUE; NO AUTH; NO FILE WRITE; NO UPLOAD; NO DEPLOY.');
  }catch{
    console.error('STOP: Gate9 local source candidate not verifiable. NO upload.');
    process.exitCode=1;
  }
}
