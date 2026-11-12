import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const sealPath=path.join(root,"RELEASE_EVIDENCE_SEAL.json");
if(!fs.existsSync(sealPath))throw new Error("Missing RELEASE_EVIDENCE_SEAL.json");
const seal=JSON.parse(fs.readFileSync(sealPath,"utf8"));
if(seal.schema!=="fire-release-evidence-seal-v1")throw new Error("Unsupported release evidence seal schema");
const current=JSON.parse(fs.readFileSync(path.join(root,"CURRENT_VERSION.json"),"utf8"));
if(seal.fire_release!==current.fire_release||seal.package_version!==current.package_version)
  throw new Error("Release evidence seal version mismatch");
if(seal.shared_core_fingerprint_sha256!==current.shared_core_fingerprint_sha256)
  throw new Error("Release evidence seal shared-core fingerprint mismatch");

const sha=(bytes)=>crypto.createHash("sha256").update(bytes).digest("hex");
const h=crypto.createHash("sha256");
let count=0;
for(const item of seal.sealed_files||[]){
  const rel=String(item.path||"");
  if(!rel||path.isAbsolute(rel)||rel.includes(".."))throw new Error(`Unsafe seal path: ${rel}`);
  const abs=path.join(root,rel);
  if(!fs.existsSync(abs)||!fs.statSync(abs).isFile())throw new Error(`Sealed file missing: ${rel}`);
  const bytes=fs.readFileSync(abs);
  const digest=sha(bytes);
  if(digest!==item.sha256)throw new Error(`Sealed file hash mismatch: ${rel}`);
  if(bytes.length!==Number(item.bytes))throw new Error(`Sealed file size mismatch: ${rel}`);
  h.update(rel); h.update("\0"); h.update(digest); h.update("\0"); h.update(String(bytes.length)); h.update("\n");
  count++;
}
if(count!==Number(seal.sealed_file_count))throw new Error(`Release evidence seal count mismatch: ${count} vs ${seal.sealed_file_count}`);
const digest=h.digest("hex");
if(digest!==seal.seal_sha256)throw new Error("Release evidence seal digest mismatch");
console.log(`PASS  Release evidence seal validated: ${count} files; ${digest}`);
