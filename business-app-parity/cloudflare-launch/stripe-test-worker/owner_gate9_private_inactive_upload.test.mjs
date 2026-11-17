import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseGate9OwnerArgs,ownerGate9Candidate}
  from './owner_gate9_private_inactive_upload.mjs';

const source='a'.repeat(40);
const hash='b'.repeat(64);
const args=(mode='--preflight')=>[
  mode,'--source',source,'--digest',hash,'--build','/outside-repo/TEST-only'
];
test('only offline preflight with exact SHA, digest and compiled location is accepted',()=>{
 const parsed=parseGate9OwnerArgs(args());
 assert.equal(parsed.mode,'--preflight');
 assert.equal(parsed.sourceSha,source);
 assert.equal(parsed.expectedDigest,hash);
 for(const bad of [
   args('--deploy'),args('--activate'),
   args().slice(0,6),[...args(),'unexpected'],
   ['--preflight','--source','latest','--digest',hash,'--build','/tmp'],
   ['--preflight','--source',source,'--digest','expired','--build','/tmp'],
   ['--preflight','--source',source,'--digest',hash,'--build','']
 ]){
   assert.throws(()=>parseGate9OwnerArgs(bad));
 }
});
test('spent execute mode exits before Git, build, authentication or provider access',()=>{
 const entry=fileURLToPath(new URL('./owner_gate9_private_inactive_upload.mjs',import.meta.url));
 assert.throws(()=>parseGate9OwnerArgs(args('--execute')),/LEGACY_UPLOAD_ATTEMPT_SPENT/);
 const result=spawnSync(process.execPath,[entry,...args('--execute')],{
   input:'AUTHORIZE TEST INACTIVE VERSION ONLY\n',encoding:'utf8',timeout:5000
 });
 assert.ifError(result.error);
 assert.equal(result.status,1);
 assert.equal(result.stdout,'');
 assert.match(result.stderr,/^STOP:.*\[LEGACY_UPLOAD_ATTEMPT_SPENT\]/);
});
test('source drift is blocked before compiled file reads or any API calls',()=>{
 let reads=0;
 assert.throws(()=>ownerGate9Candidate({
   sourceSha:source,expectedDigest:hash,buildDir:'/does-not-exist',
   getHead:()=>{reads++;return 'c'.repeat(40);}
 }),/SOURCE_SHA_CHANGED/);
 assert.equal(reads,1);
});
test('offline preflight requires a compiled build',()=>{
 assert.throws(()=>ownerGate9Candidate({
   sourceSha:source,expectedDigest:hash,buildDir:'/does-not-exist',
   getHead:()=>source
 }));
});
test('no implicit network, credentials or remote upload code in argument validation',()=>{
 const x=parseGate9OwnerArgs(args('--preflight'));
 assert.equal(Object.keys(x).sort().join(','),
   'buildDir,expectedDigest,mode,sourceSha');
 assert.equal('token' in x,false);
 assert.equal('approval' in x,false);
});
