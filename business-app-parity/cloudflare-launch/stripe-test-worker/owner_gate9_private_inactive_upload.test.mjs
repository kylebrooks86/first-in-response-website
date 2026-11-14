import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGate9OwnerArgs,ownerGate9Candidate,ownerLocalGitHead}
  from './owner_gate9_private_inactive_upload.mjs';

const source='a'.repeat(40);
const hash='b'.repeat(64);
const args=(mode='--preflight')=>[
  mode,'--source',source,'--digest',hash,'--build','/outside-repo/TEST-only'
];
test('only explicit --preflight or --execute with exact SHA/digest/compiled location is accepted',()=>{
 for(const m of ['--preflight','--execute']){
   const x=parseGate9OwnerArgs(args(m));
   assert.equal(x.mode,m);
   assert.equal(x.sourceSha,source);
   assert.equal(x.expectedDigest,hash);
 }
 for(const bad of [
   args('--deploy'),args('--activate'),
   args().slice(0,6),[...args(),'unexpected'],
   ['--execute','--source','latest','--digest',hash,'--build','/tmp'],
   ['--execute','--source',source,'--digest','expired','--build','/tmp'],
   ['--execute','--source',source,'--digest',hash,'--build','']
 ]){
   assert.throws(()=>parseGate9OwnerArgs(bad));
 }
});
test('source drift is blocked before compiled file reads or any API calls',()=>{
 let reads=0;
 assert.throws(()=>ownerGate9Candidate({
   sourceSha:source,expectedDigest:hash,buildDir:'/does-not-exist',
   getHead:()=>{reads++;return 'c'.repeat(40);}
 }),/SOURCE_SHA_CHANGED/);
 assert.equal(reads,1);
});
test('owner execution CLI requires a build and does not try auth when unavailable',()=>{
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
