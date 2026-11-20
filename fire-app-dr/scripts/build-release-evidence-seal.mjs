import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const authoritative=[
  "CURRENT_VERSION.json",
  "FIRE_UNIFIED_RELEASE.json",
  "SHARED_CORE_MANIFEST.json",
  "UNIFIED_RELEASE_PACKAGE.json",
  "PARITY_EVIDENCE_MANIFEST.json",
  "STRICT_PARITY_MATRIX.md",
  "LIVE_MASTER_PARITY_CHECKLIST.md",
  "CURRENT_PARITY_AUDIT.md",
  "PARITY_CAPTURE_QUEUE.md",
  "PARITY_COMPARISON_QUEUE.md",
  "PARITY_PROGRESS.json",
  "RELEASE_PACKAGE_POLICY.json",
  "README.md",
  "GO_NO_GO.md",
  "SECURITY_AND_RECOVERY_STATUS.md",
  "INDEPENDENT_DEPLOYMENT.md",
  "STAGING_ACCEPTANCE_TEST.md",
  "scripts/validate-current-recovery-docs.mjs",
  "scripts/validate-restore-verification.mjs"
];

const sha=(bytes)=>crypto.createHash("sha256").update(bytes).digest("hex");
const files=[];
for(const rel of authoritative){
  const abs=path.join(root,rel);
  if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error(`Missing seal input: ${rel}`);
  const bytes=fs.readFileSync(abs);
  files.push({path:rel,sha256:sha(bytes),bytes:bytes.length});
}

const evidence=JSON.parse(fs.readFileSync(path.join(root,"PARITY_EVIDENCE_MANIFEST.json"),"utf8"));
for(const entry of evidence.entries||[]){
  for(const item of entry.evidence||[]){
    const rel=String(item.file||"");
    const abs=path.join(root,rel);
    if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error(`Missing parity evidence for seal: ${rel}`);
    const bytes=fs.readFileSync(abs);
    const digest=sha(bytes);
    if(digest!==item.sha256)throw new Error(`Parity evidence hash mismatch before seal: ${rel}`);
    files.push({path:rel,sha256:digest,bytes:bytes.length});
  }
}
files.sort((a,b)=>a.path.localeCompare(b.path));
const h=crypto.createHash("sha256");
for(const item of files){
  h.update(item.path); h.update("\0"); h.update(item.sha256); h.update("\0"); h.update(String(item.bytes)); h.update("\n");
}
const current=JSON.parse(fs.readFileSync(path.join(root,"CURRENT_VERSION.json"),"utf8"));
const seal={
  schema:"fire-release-evidence-seal-v1",
  fire_release:current.fire_release,
  package_version:current.package_version,
  shared_core_fingerprint_sha256:current.shared_core_fingerprint_sha256,
  sealed_file_count:files.length,
  sealed_files:files,
  seal_sha256:h.digest("hex")
};
fs.writeFileSync(path.join(root,"RELEASE_EVIDENCE_SEAL.json"),JSON.stringify(seal,null,2)+"\n");
console.log(`PASS  Release evidence seal built: ${seal.sealed_file_count} files; ${seal.seal_sha256}`);
