/*
FIRE Calculator shared-core synchronization verifier.
Usage:
  node calculator/tests/verify-shared-core.js <staging-root>
    Validates one candidate root against its own SHARED_CORE_MANIFEST.json.
  node calculator/tests/verify-shared-core.js <production-root> <dr-root>
    Validates both roots and requires identical release + fingerprint.
No external packages required.
*/
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

function die(msg){console.error('SYNC FAIL:',msg);process.exit(1)}
function readJson(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){die(`Cannot read ${p}: ${e.message}`)}}
function gitBlobSha(buf){return crypto.createHash('sha1').update(Buffer.from(`blob ${buf.length}\0`)).update(buf).digest('hex')}
function manifestFor(root){return readJson(path.join(root,'SHARED_CORE_MANIFEST.json'))}
function loadedCoreFiles(root){
  const loaderPath=path.join(root,'full-v18.js');
  if(!fs.existsSync(loaderPath))die(`${root}: missing full-v18.js loader`);
  const loader=fs.readFileSync(loaderPath,'utf8');
  const refs=[...loader.matchAll(/['"`](\.\/[^'"`?]+\.(?:js|css))(?:\?v=\d+)?['"`]/g)].map(m=>m[1].replace(/^\.\//,''));
  return [...new Set(['full-v18.js',...refs])];
}
function validateLoadedFilesAreGoverned(root,manifest){
  const governed=new Set(Object.keys(manifest.shared_core_files||{}).map(rel=>rel.startsWith('calculator/')?rel.slice('calculator/'.length):rel));
  const missing=loadedCoreFiles(root).filter(rel=>!governed.has(rel));
  if(missing.length)die(`${root}: loader executes ungoverned shared-core file(s): ${missing.join(', ')}`);
}
function validateRoot(root,manifest){
  validateLoadedFilesAreGoverned(root,manifest);
  const rows=[];
  for(const [rel,expected] of Object.entries(manifest.shared_core_files||{})){
    const normalized=rel.startsWith('calculator/')?rel.slice('calculator/'.length):rel;
    const file=path.join(root,normalized);
    if(!fs.existsSync(file))die(`${root}: missing shared-core file ${normalized}`);
    const actual=gitBlobSha(fs.readFileSync(file));
    if(actual!==expected)die(`${root}: ${normalized} blob SHA differs. expected ${expected}, got ${actual}`);
    rows.push(`${rel}:${actual}`);
  }
  const fingerprint=crypto.createHash('sha256').update(rows.sort().join('\n')).digest('hex');
  if(fingerprint!==manifest.shared_core_fingerprint)die(`${root}: fingerprint differs. expected ${manifest.shared_core_fingerprint}, got ${fingerprint}`);
  return fingerprint;
}

const roots=process.argv.slice(2);
if(roots.length===1){
  const root=roots[0],manifest=manifestFor(root),fingerprint=validateRoot(root,manifest);
  console.log(`STAGING CORE PASS: ${manifest.product} ${manifest.release}`);
  console.log(`shared-core fingerprint ${fingerprint}`);
  console.log(`loader governance ${loadedCoreFiles(root).length} shared modules verified`);
  process.exit(0);
}
if(roots.length!==2){console.error('Usage: node verify-shared-core.js <staging-root> OR <production-root> <dr-root>');process.exit(2)}
const [prodRoot,drRoot]=roots,pm=manifestFor(prodRoot),dm=manifestFor(drRoot);
if(pm.release!==dm.release)die(`release mismatch: production ${pm.release}, DR ${dm.release}`);
if(pm.shared_core_fingerprint!==dm.shared_core_fingerprint)die(`manifest fingerprint mismatch: production ${pm.shared_core_fingerprint}, DR ${dm.shared_core_fingerprint}`);
const pf=validateRoot(prodRoot,pm),df=validateRoot(drRoot,dm);
if(pf!==df)die(`calculated fingerprints differ: production ${pf}, DR ${df}`);
console.log(`SYNC PASS: ${pm.product} ${pm.release}`);
console.log(`shared-core fingerprint ${pf}`);
console.log(`loader governance ${loadedCoreFiles(prodRoot).length} shared modules verified`);
