/**
 * FIRE Gate 9: owner-Acer private CLI for ONE previously approved inactive TEST
 * Worker version. Not a deploy, activation, Stripe, D1 SQL, secrets or Access CLI.
 *
 * PREVIEW: --preflight --source <40hex> --digest <64hex> --build <local-dir>
 * EXECUTE: --execute   --source <40hex> --digest <64hex> --build <local-dir>
 *
 * Permission is DENIED until the owner types the exact local confirmation.
 * No account token, asset JWT, module contents or raw Cloudflare JSON is
 * printed/stored in GitHub/chat/logs. Never run this script in public CI.
 *
 * The compiled local directory is generated from the reviewed repo HEAD by
 * materialize-stripe-test.py, TypeScript typecheck, and Vinext build. Its
 * wrangler.json intentionally contains a fake D1 ID: that config MUST NOT
 * be uploaded. Only the approved candidate's exactly nine immutable inherited
 * predecessor bindings and new ASSETS binding are in the version payload.
 */
import {spawnSync} from 'node:child_process';
import {dirname,resolve,join,relative,sep} from 'node:path';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {compileGate9ApprovalCandidate} from './gate9_compiled_candidate.mjs';
import {readExistingWranglerToken} from './owner_gate9_private_readonly.mjs';
import {createPinnedFireGate9PrivateTransport,FIRE_CF_ACCOUNT_ID}
  from './gate9_pinned_private_target.mjs';
import {runApprovedInactiveUpload} from './gate9_inactive_upload_flow.mjs';
import {WORKER,PREDECESSOR,DB_UUID} from './gate9_inactive_fullapp_contract.mjs';

const fail=c=>{throw Error('STOP: Gate9 owner private inactive operation ['+c+']; no automatic retry.');};
const need=(v,c)=>{if(!v)fail(c);};
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const EXPECTED_TEXT='AUTHORIZE TEST INACTIVE VERSION ONLY';
const scriptRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');

export function parseGate9OwnerArgs(args){
  need(Array.isArray(args)&&args.length===7,'ARGS');
  const [mode,sFlag,sourceSha,dFlag,expectedDigest,bFlag,buildDir]=args;
  need((mode==='--preflight'||mode==='--execute')&&
    sFlag==='--source'&&SHA.test(sourceSha)&&!/^0+$/.test(sourceSha)&&
    dFlag==='--digest'&&DIGEST.test(expectedDigest)&&
    bFlag==='--build'&&typeof buildDir==='string'&&buildDir.length>0,
    'ARGS_OR_PINS');
  return {mode,sourceSha,expectedDigest,buildDir};
}
export function ownerLocalGitHead(root=scriptRoot){
  const git=(args)=>{
    const r=spawnSync('git',['-C',root,...args],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:12000,
      maxBuffer:1000000,windowsHide:true
    });
    need(!r.error&&r.status===0,'GIT_SOURCE');
    return r.stdout.trim();
  };
  // Existing owner worktree must not have uncommitted tracked source edits.
  git(['diff','HEAD','--quiet','--','business-app-parity/cloudflare-launch']);
  return git(['rev-parse','HEAD']);
}
export function ownerGate9Candidate({sourceSha,expectedDigest,buildDir,
  getHead=ownerLocalGitHead}){
  need(getHead()===sourceSha,'SOURCE_SHA_CHANGED');
  const build=realpathSync(resolve(buildDir));
  const repo=realpathSync(scriptRoot);
  need(build!==repo&&!build.startsWith(repo+sep) &&
    !repo.startsWith(build+sep),'BUILD_MUST_BE_OUTSIDE_REPO');
  const serverDir=join(build,'dist','server');
  const clientDir=join(build,'dist','client');
  const out=compileGate9ApprovalCandidate({serverDir,clientDir,sourceSha});
  need(out.candidateDigest===expectedDigest,'APPROVAL_DIGEST_CHANGED');
  // Current reviewed complete QA-master app builds exactly 191 server modules
  // and 41 static assets. Preserve fail-closed exact counts: any further app
  // change needs NEW source-build evidence and explicit review, never a range.
  need(out.counts.compiledModules===191&&out.counts.staticAssets===41,
    'FULL_APP_COMPILED_COUNT');
  return {out,serverDir,clientDir};
}
export async function executeOwnerGate9Inactive({
  sourceSha,expectedDigest,buildDir,
  getHead=ownerLocalGitHead,
  getToken=readExistingWranglerToken,
  fetchImpl=fetch,
  confirmText,
  clock=()=>Date.now()
}){
  need(confirmText===EXPECTED_TEXT,'OWNER_INTERACTIVE_CONFIRMATION');
  const first=ownerGate9Candidate({sourceSha,expectedDigest,buildDir,getHead});
  let privateToken;
  try{
    privateToken=await getToken();
    need(typeof privateToken==='string'&&privateToken.length>10&&
      privateToken.length<4096&&!/\s/.test(privateToken),'PRIVATE_AUTH');
    const transport=createPinnedFireGate9PrivateTransport({
      tokenProvider:async()=>privateToken,
      fetchImpl,
      clientDir:first.clientDir,
      approvedManifest:first.out.candidate.manifest,
      timeoutMs:60000,
      // Fresh private approval/same compiled bytes before EVERY potential POST.
      // Absence of exact matching approval means NO write.
      permissionGate:async({accountId,worker})=>{
        need(accountId===FIRE_CF_ACCOUNT_ID&&worker===WORKER,'TARGET');
        ownerGate9Candidate({sourceSha,expectedDigest,buildDir,getHead});
        return true;
      }
    });
    const approval={
      worker:WORKER,accountId:FIRE_CF_ACCOUNT_ID,
      predecessor:PREDECESSOR,dbUuid:DB_UUID,sourceSha,
      candidateDigest:expectedDigest,
      operations:'register-assets,upload-assets,create-inactive-version',
      expiresAt:clock()+50*60*1000
    };
    const receipt=await runApprovedInactiveUpload({
      candidate:first.out.candidate,approval,accountId:FIRE_CF_ACCOUNT_ID,
      transport,now:clock
    });
    need(receipt.activePredecessor===PREDECESSOR&&
      receipt.activePercentage===100&&receipt.newVersionPercentage===0,
      'POST_UPLOAD_TRAFFIC');
    return receipt;
  }finally{
    privateToken=undefined;
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let args;
  try{
    args=parseGate9OwnerArgs(process.argv.slice(2));
    const pre=ownerGate9Candidate(args);
    console.log('PASS: Local Gate9 compiled TEST candidate matches approved exact source and digest.');
    console.log('SOURCE_SHA='+args.sourceSha);
    console.log('APPROVED_CANDIDATE_SHA256='+pre.out.candidateDigest);
    console.log('WORKER_MODULES='+pre.out.counts.compiledModules+
      '; ASSETS='+pre.out.counts.staticAssets+
      '; ACTIVE_PREDECESSOR_PIN='+PREDECESSOR);
    if(args.mode==='--preflight'){
      console.log('PREFLIGHT_ONLY=TRUE; NO AUTH, NO PROVIDER POST, NO UPLOAD OR DEPLOY.');
    } else {
      console.log('ACTION: TEST assets registration/upload + ONE inactive version only; 0% new traffic.');
      const rl=createInterface({input:stdin,output:stdout});
      let typed;
      try{typed=await rl.question('Type "'+EXPECTED_TEXT+'" to proceed: ');}
      finally{rl.close();}
      const receipt=await executeOwnerGate9Inactive({...args,confirmText:typed});
      console.log('PASS: Guarded inactive TEST Cloudflare version receipt and independent GET readback.');
      console.log(JSON.stringify(receipt,null,2));
      console.log('NO active deployment, Stripe, Access, database, secrets or LIVE changes.');
    }
  }catch(e){
    const message=e instanceof Error&&/^STOP: Gate9 (?:owner private inactive operation|local release candidate|inactive upload|guarded TEST Cloudflare transport|Cloudflare READ ONLY) \[[A-Z0-9_]+\]/.test(e.message)?e.message:
      'STOP: Gate9 private TEST inactive operation [UNVERIFIED]; no automatic retry.';
    console.error(message);
    process.exitCode=1;
  }
}
