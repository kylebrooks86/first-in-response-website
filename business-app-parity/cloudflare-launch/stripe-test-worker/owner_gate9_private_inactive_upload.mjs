/**
 * Offline preflight for the historical Gate 9 TEST version upload path.
 * The previous one-shot provider attempt is spent. This command only
 * verifies source and build pins and cannot obtain credentials or upload.
 *
 * node owner_gate9_private_inactive_upload.mjs --preflight --source <40hex>
 *   --digest <64hex> --build <local-dir>
 */
import {spawnSync} from 'node:child_process';
import {dirname,resolve,join,relative,sep} from 'node:path';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {compileGate9ApprovalCandidate} from './gate9_compiled_candidate.mjs';
import {PREDECESSOR} from './gate9_inactive_fullapp_contract.mjs';

const fail=c=>{throw Error('STOP: Gate9 owner private inactive operation ['+c+']; no automatic retry.');};
const need=(v,c)=>{if(!v)fail(c);};
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const scriptRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');

export function parseGate9OwnerArgs(args){
  need(Array.isArray(args),'ARGS');
  need(args[0]!=='--execute','LEGACY_UPLOAD_ATTEMPT_SPENT');
  need(args.length===7,'ARGS');
  const [mode,sFlag,sourceSha,dFlag,expectedDigest,bFlag,buildDir]=args;
  need(mode==='--preflight'&&
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
  // Independently observed exact-head LOCAL TEST build 44204404693 now has
  // 194 compiled modules / 41 assets: the new server-side customer contact
  // validation adds one module. This is ONLY an offline structural count.
  // Keep the count EXACT (not a range), plus source SHA and full candidate
  // SHA256 equality. No owner consent to a new provider POST is inferred.
  // Historical one-shot consent and the failed provider POST remain spent.
  // This preflight cannot upload, create a version, deploy or change payments.
  need(out.counts.compiledModules===194&&out.counts.staticAssets===41,
    'FULL_APP_COMPILED_COUNT');
  return {out,serverDir,clientDir};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=parseGate9OwnerArgs(process.argv.slice(2));
    const pre=ownerGate9Candidate(args);
    console.log('PASS: Local Gate9 compiled TEST candidate matches approved exact source and digest.');
    console.log('SOURCE_SHA='+args.sourceSha);
    console.log('APPROVED_CANDIDATE_SHA256='+pre.out.candidateDigest);
    console.log('WORKER_MODULES='+pre.out.counts.compiledModules+
      '; ASSETS='+pre.out.counts.staticAssets+
      '; ACTIVE_PREDECESSOR_PIN='+PREDECESSOR);
    console.log('PREFLIGHT_ONLY=TRUE; NO AUTH, NO PROVIDER POST, NO UPLOAD OR DEPLOY.');
  }catch(e){
    const message=e instanceof Error&&/^STOP: Gate9 (?:owner private inactive operation|local release candidate) \[[A-Z0-9_]+\]/.test(e.message)?e.message:
      'STOP: Gate9 private TEST inactive operation [UNVERIFIED]; no automatic retry.';
    console.error(message);
    process.exitCode=1;
  }
}
