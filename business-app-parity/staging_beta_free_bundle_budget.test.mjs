import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewStagingFreeWorkerBundleBudget as review, STAGING_FREE_WORKER_BUNDLE_MAX_BYTES as MAX} from './staging_beta_free_bundle_budget.mjs';

test('Cloudflare September 2026 uncompressed 64 MiB Free ceiling; raw module bytes only', () => {
  assert.equal(MAX, 67108864);
  assert.deepEqual(review([{bytes:4800000},{bytes:1300000},{bytes:0}]),{
    moduleCount:3,uncompressedModuleBytes:6100000,freeWorkerLimitBytes:MAX,
    sizePrerequisiteSatisfied:true,providerAcceptanceProven:false,startupValidated:false
  });
  assert.equal(review([{bytes:MAX}]).uncompressedModuleBytes,MAX);
  assert.throws(()=>review([{bytes:MAX+1}]),/STAGING_FREE_BUNDLE_STOP_OVER_LIMIT/);
  assert.throws(()=>review([{bytes:MAX},{bytes:1}]),/STAGING_FREE_BUNDLE_STOP_OVER_LIMIT/);
});
test('fail closed on absent, fractional, negative, unsafe or nonnumeric source lengths', () => {
  for(const rows of [[],null,[{}],[{bytes:-1}],[{bytes:1.5}],[{bytes:NaN}],[{bytes:Infinity}],[{bytes:'123'}],[{bytes:Number.MAX_SAFE_INTEGER+1}]])
    assert.throws(()=>review(rows),/STAGING_FREE_BUNDLE_STOP/);
});
