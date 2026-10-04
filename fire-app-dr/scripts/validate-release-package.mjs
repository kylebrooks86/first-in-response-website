import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
const zip=process.argv[2];
if(!zip) throw new Error('Usage: node scripts/validate-release-package.mjs <release.zip>');
const required=['CURRENT_VERSION.json','FIRE_UNIFIED_RELEASE.json','SHARED_CORE_MANIFEST.json','CURRENT_PARITY_AUDIT.md','PARITY_EVIDENCE_MANIFEST.json','STRICT_PARITY_MATRIX.md','LIVE_MASTER_PARITY_CHECKLIST.md','UNIFIED_RELEASE_PACKAGE.json','PARITY_CAPTURE_QUEUE.md','PARITY_COMPARISON_QUEUE.md','PARITY_PROGRESS.json','fixtures/strict-parity-records.json','fixtures/strict-parity-photos.zip','scripts/preflight-independent.mjs','scripts/release-readiness.mjs','scripts/register-parity-evidence.mjs','scripts/compare-parity-evidence.mjs','scripts/build-parity-progress.mjs','RELEASE_EVIDENCE_SEAL.json','scripts/build-release-evidence-seal.mjs','scripts/validate-release-evidence-seal.mjs','RELEASE_PACKAGE_POLICY.json','scripts/build-release-package.mjs','scripts/validate-current-recovery-docs.mjs','scripts/validate-restore-verification.mjs'];
const listing=execFileSync('unzip',['-Z1',path.resolve(zip)],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
const policy=JSON.parse(execFileSync('unzip',['-p',path.resolve(zip),'RELEASE_PACKAGE_POLICY.json'],{encoding:'utf8'}));
const keepCurrent=new Set(policy.keep_current_versioned_artifacts||[]);
const versioned=(policy.exclude_top_level_versioned_patterns||[]).map((pattern)=>new RegExp(pattern));
const staleVersioned=listing.filter((rel)=>{
  if(rel.includes('/'))return false;
  return versioned.some((rx)=>rx.test(rel))&&!keepCurrent.has(rel);
});
if(staleVersioned.length)throw new Error(`Release package contains stale top-level versioned artifacts: ${staleVersioned.join(', ')}`);

for(const requiredPath of required){if(!listing.includes(requiredPath))throw new Error(`Release package missing required file: ${requiredPath}`);}
const readZip=(rel)=>execFileSync('unzip',['-p',path.resolve(zip),rel],{encoding:null,maxBuffer:64*1024*1024});
const evidence=JSON.parse(readZip('PARITY_EVIDENCE_MANIFEST.json').toString('utf8'));
const seal=JSON.parse(readZip('RELEASE_EVIDENCE_SEAL.json').toString('utf8'));
const unified=JSON.parse(readZip('FIRE_UNIFIED_RELEASE.json').toString('utf8'));
const currentVersion=JSON.parse(readZip('CURRENT_VERSION.json').toString('utf8'));
const sharedManifest=JSON.parse(readZip('SHARED_CORE_MANIFEST.json').toString('utf8'));
const unifiedPackage=JSON.parse(readZip('UNIFIED_RELEASE_PACKAGE.json').toString('utf8'));
const readText=(rel)=>readZip(rel).toString('utf8');
const docReadme=readText('README.md');
const docGoNoGo=readText('GO_NO_GO.md');
const docSecurity=readText('SECURITY_AND_RECOVERY_STATUS.md');
const docDeployment=readText('INDEPENDENT_DEPLOYMENT.md');
const docAcceptance=readText('STAGING_ACCEPTANCE_TEST.md');

const releases=[unified.fire_release,currentVersion.fire_release,sharedManifest.fire_release,unifiedPackage.fire_release,evidence.fire_release];
if(new Set(releases).size!==1)throw new Error(`Release package version disagreement: ${releases.join(', ')}`);
const packageRelease=unified.fire_release;
if(!docReadme.includes(`FIRE App ${packageRelease}`))throw new Error('Release package README release is stale');
if(!docGoNoGo.includes(`FIRE App ${packageRelease}`))throw new Error('Release package GO_NO_GO release is stale');
if(!docDeployment.includes(`release candidate ${packageRelease}`))throw new Error('Release package deployment runbook release is stale');
if(!docSecurity.includes('21 contiguous migrations: 0000 through 0020'))throw new Error('Release package security/recovery migration range is stale');
if(!docAcceptance.includes('intentional owner exception'))throw new Error('Release package staging acceptance is missing the approved scheduling exception');
for(const [name,text] of [['README',docReadme],['GO_NO_GO',docGoNoGo],['SECURITY',docSecurity],['DEPLOYMENT',docDeployment],['ACCEPTANCE',docAcceptance]]){
  if(/npm\s+run\s+parity:evidence:intake/i.test(text))throw new Error(`Release package ${name} contains disabled parity evidence intake command`);
}
if(/live-v49|v29\+/i.test(docAcceptance))throw new Error('Release package staging acceptance contains obsolete parity/schedule version labels');
if(/cannot be scheduled before the full 50% deposit|remains unschedulable until the full required 50% deposit/i.test(docAcceptance))
  throw new Error('Release package staging acceptance contains obsolete no-exception scheduling guidance');

const fingerprints=[
  unified.shared_core_fingerprint_sha256,
  currentVersion.shared_core_fingerprint_sha256,
  sharedManifest.shared_core_fingerprint_sha256,
  unifiedPackage.shared_core_fingerprint_sha256,
  evidence.shared_core_fingerprint_sha256
];
if(fingerprints.some((value)=>!/^[a-f0-9]{64}$/.test(String(value||'')))||new Set(fingerprints).size!==1)
  throw new Error(`Release package shared-core fingerprint disagreement.`);

let evidenceFiles=0;
for(const entry of evidence.entries||[]){
  for(const item of Array.isArray(entry.evidence)?entry.evidence:[]){
    evidenceFiles++;
    const rel=String(item.file||'');
    if(!rel||!listing.includes(rel))throw new Error(`Release package missing parity evidence file: ${rel||'(blank)'}`);
    const bytes=readZip(rel);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(digest!==item.sha256)throw new Error(`Release package parity evidence hash mismatch: ${rel}`);
    if(bytes.length!==Number(item.bytes))throw new Error(`Release package parity evidence size mismatch: ${rel}`);
  }
}
if(evidenceFiles!==Number(evidence.evidence_file_count))throw new Error(`Release package evidence count mismatch: ${evidenceFiles} files vs manifest ${evidence.evidence_file_count}`);
const sealHasher=crypto.createHash('sha256');
let sealCount=0;
for(const item of seal.sealed_files||[]){
  const rel=String(item.path||'');
  if(!rel||!listing.includes(rel))throw new Error(`Release package sealed file missing: ${rel||'(blank)'}`);
  const bytes=readZip(rel);
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  if(digest!==item.sha256)throw new Error(`Release package sealed file hash mismatch: ${rel}`);
  if(bytes.length!==Number(item.bytes))throw new Error(`Release package sealed file size mismatch: ${rel}`);
  sealHasher.update(rel);sealHasher.update('\0');sealHasher.update(digest);sealHasher.update('\0');sealHasher.update(String(bytes.length));sealHasher.update('\n');
  sealCount++;
}
if(sealCount!==Number(seal.sealed_file_count)||sealHasher.digest('hex')!==seal.seal_sha256)throw new Error('Release package evidence seal digest/count mismatch');
if(seal.fire_release!==unified.fire_release||seal.shared_core_fingerprint_sha256!==unified.shared_core_fingerprint_sha256)throw new Error('Release package evidence seal release/fingerprint mismatch');

console.log(`Release package completeness PASS: ${required.length}/${required.length} required recovery/parity assets present; ${evidenceFiles} parity evidence files SHA256-verified.`);
console.log(`Release package binding PASS: release ${unified.fire_release}; shared-core fingerprint ${unified.shared_core_fingerprint_sha256}`);
console.log(`Release evidence seal PASS: ${sealCount} sealed files; ${seal.seal_sha256}`);
console.log(`Canonical package hygiene PASS: no stale top-level versioned release artifacts.`);
console.log(`Current recovery-doc freshness PASS: README, GO/NO-GO, security, deployment, and staging acceptance are aligned to ${unified.fire_release}.`);
