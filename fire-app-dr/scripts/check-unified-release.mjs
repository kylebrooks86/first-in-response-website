import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'FIRE_UNIFIED_RELEASE.json'),'utf8'));
const hash=crypto.createHash('sha256');
for(const item of manifest.shared_core_files){
  const full=path.join(root,item.path);
  if(!fs.existsSync(full)) throw new Error(`Missing shared-core file: ${item.path}`);
  const bytes=fs.readFileSync(full);
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  if(actual!==item.sha256) throw new Error(`Shared-core drift: ${item.path}`);
  hash.update(item.path); hash.update('\0'); hash.update(actual); hash.update('\n');
}
const fingerprint=hash.digest('hex');
if(fingerprint!==manifest.shared_core_fingerprint_sha256) throw new Error(`Shared-core fingerprint mismatch: ${fingerprint}`);
console.log(`FIRE unified release ${manifest.fire_release}: shared-core fingerprint OK (${manifest.shared_core_file_count} files)`);
console.log(manifest.shared_core_fingerprint_sha256);
