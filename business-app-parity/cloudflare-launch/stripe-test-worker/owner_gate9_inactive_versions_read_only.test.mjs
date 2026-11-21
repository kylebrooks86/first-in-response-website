import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeIdFromDeployment, recentVersionIds, classifyVersion,
  ACTIVE_ID, D1_ID, SECRET_NAMES
} from './owner_gate9_inactive_versions_read_only.mjs';

// Entirely synthetic fixtures. No Cloudflare process, network, Stripe, or D1.
const OTHER = 'd6906ea1-f7a8-4153-ad7a-c8f4ed3ef1c9';
const current = () => ({
  id: ACTIVE_ID,
  resources: {
    script: {}, script_runtime: {}, bindings: [
      { type: 'd1', name: 'DB', id: D1_ID },
      { type: 'plain_text', name: 'FIRE_STRIPE_MODE', text: 'disabled' },
      ...SECRET_NAMES.map(name => ({ type: 'secret_text', name }))
    ]
  }
});
test('refuses split deployment, wrong traffic, unexpected version', () => {
  assert.equal(activeIdFromDeployment({ versions: [{ version_id: ACTIVE_ID, percentage: 100 }] }), ACTIVE_ID);
  assert.throws(() => activeIdFromDeployment({ versions: [
    { version_id: ACTIVE_ID, percentage: 95 }, { version_id: OTHER, percentage: 5 }
  ] }));
  assert.throws(() => activeIdFromDeployment({ versions: [{ version_id: ACTIVE_ID, percentage: 99 }] }));
});
test('accepts standard versions lists and rejects duplicate/malformed IDs', () => {
  assert.deepEqual(recentVersionIds([{ id: ACTIVE_ID }, { version_id: OTHER }]), [ACTIVE_ID, OTHER]);
  assert.deepEqual(recentVersionIds({ result: { versions: [{ id: ACTIVE_ID }] } }), [ACTIVE_ID]);
  assert.throws(() => recentVersionIds([{ id: ACTIVE_ID }, { id: ACTIVE_ID }]));
  assert.throws(() => recentVersionIds([{ id: 'latest' }]));
  assert.throws(() => recentVersionIds({ foo: [] }));
});
test('classifies approved code-only baseline without exposing secret values', () => {
  assert.deepEqual(classifyVersion(current(), ACTIVE_ID), { knownSafeBindings: true, hasAssets: false });
});
test('identifies static asset transition as only a candidate for further inspection', () => {
  const v = current(); v.id = OTHER; v.resources.assets = { binding: 'ASSETS' };
  assert.deepEqual(classifyVersion(v, OTHER), { knownSafeBindings: true, hasAssets: true });
});
test('refuses wrong physical database, enabled Stripe, altered secrets, or R2', () => {
  for (const mutate of [
    v => { v.resources.bindings[0].id = OTHER; },
    v => { v.resources.bindings[1].text = 'test'; },
    v => { v.resources.bindings.splice(2, 1); },
    v => { v.resources.bindings.push({ type: 'secret_text', name: 'UNEXPECTED' }); },
    v => { v.resources.bindings.push({ type: 'r2_bucket', name: 'PHOTOS' }); }
  ]) {
    const v = current(); mutate(v);
    assert.equal(classifyVersion(v, ACTIVE_ID).knownSafeBindings, false);
  }
});
test('fails closed on malformed provider metadata and mismatched immutable version ID', () => {
  const v = current();
  delete v.resources.script_runtime;
  assert.throws(() => classifyVersion(v, ACTIVE_ID));
  assert.throws(() => classifyVersion(current(), OTHER));
});
