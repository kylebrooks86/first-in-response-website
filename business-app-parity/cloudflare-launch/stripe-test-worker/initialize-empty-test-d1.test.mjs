import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('retired initialize-empty-test-d1 can only throw the spent-initialization error',()=>{
 const source=readFileSync(new URL('./initialize-empty-test-d1.ps1',import.meta.url),'utf8');
 const executable=source.split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
 assert.deepEqual(executable,[
  '[CmdletBinding()]',
  'param()',
  "throw 'STOP: STRIPE_TEST_D1_INITIALIZATION_SPENT. The approved 25 migrations already completed.'"
 ]);
});
