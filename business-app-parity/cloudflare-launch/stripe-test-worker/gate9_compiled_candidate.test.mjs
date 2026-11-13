import test from 'node:test';
import assert from 'node:assert/strict';
import {compileGate9ApprovalCandidate} from './gate9_compiled_candidate.mjs';
test('fails before reading any source without exact immutable 40-hex commit',()=>{
 for(const sourceSha of ['', 'latest', '0'.repeat(40), 'z'.repeat(40),'a'.repeat(39)]){
   assert.throws(()=>compileGate9ApprovalCandidate({
     serverDir:'/definitely-no-real-test-build',
     clientDir:'/definitely-no-real-test-build',
     sourceSha
   }),/SOURCE_SHA/);
 }
});
test('exact source SHA alone does NOT bypass compiled candidate validation',()=>{
 assert.throws(()=>compileGate9ApprovalCandidate({
   serverDir:'/definitely-no-real-test-build',
   clientDir:'/definitely-no-real-test-build',
   sourceSha:'a'.repeat(40)
 }));
});
