// Focused read-only regression for owner QA update active-version safety.
// No Cloudflare credentials, provider calls, database access, deployment or payment actions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const review = readFileSync(join(root, 'owner_windows_qa_update_review.ps1'), 'utf8');
const publish = readFileSync(join(root, 'owner_windows_qa_update_publish.ps1'), 'utf8');
const active = '08d77fb1-9484-4014-bd5b-1bb1da066cdb';
const obsolete = '6d77bd7c-20d3-49aa-9816-c651d98953cb';
const qaWorker = 'fire-fullapp-qa-20261016';
const qaD1 = '8ccfb1f8-1657-4074-b1b2-47de78f95003';

function pin(script) {
  const matches = [...script.matchAll(/^\$expectedActiveVersion\s*=\s*'([^']+)'\s*$/gm)];
  assert.equal(matches.length, 1, 'There must be one unambiguous active Worker pin');
  return matches[0][1];
}
function requireGuard(source, pattern, label) {
  assert.match(source, pattern, label);
}

test('QA reviewer and publisher use same accepted actual hosted 100%-serving Worker version', () => {
  assert.equal(pin(review), active);
  assert.equal(pin(publish), active);
  assert.notEqual(pin(review), obsolete);
  assert.notEqual(pin(publish), obsolete);
});

test('both paths pin the same QA target and physical D1 without R2', () => {
  for (const script of [review, publish]) {
    assert.ok(script.includes(qaWorker), 'Correct QA Worker must be pinned');
    assert.ok(script.includes(qaD1), 'Correct isolated D1 UUID must be pinned');
    requireGuard(script, /\bversions view\b/, 'Current immutable version binding must be checked');
    requireGuard(script, /bindingVerified\s*-eq\s*\$true/, 'Physical D1 binding must be verified');
  }
  requireGuard(review, /r2_buckets/, 'Reviewer must check no-R2 requirement');
  requireGuard(publish, /NO R2 bucket is bound or billed/, 'Publisher must preserve no-R2 requirement');
});

test('review refuses split traffic, changed version, stale local SHA and unreviewed migration', () => {
  requireGuard(review, /\$activeVersions\.Count\s*-eq\s*1/, 'One serving version only');
  requireGuard(review, /\[double\]\$activeVersions\[0\]\.percentage\s*-eq\s*100/, '100 percent traffic only');
  requireGuard(review, /\$activeVersion\s*-ceq\s*\$expectedActiveVersion/, 'Owner-confirmed version strict check');
  requireGuard(review, /\$head\s*-ceq\s*\$ExpectedCommit/, 'Strict reviewed exact source commit');
  requireGuard(review, /originalSqlCount\s*-eq\s*23/, '23 prior migrations');
  requireGuard(review, /candidateSqlCount\s*-eq\s*25/, '25 current QA migrations');
  requireGuard(review, /deploy --dry-run/, 'Only dry-run for review');
  assert.doesNotMatch(review, /&\s*\$wrangler\.Source\s+deploy\s+--config\b/, 'Review must not publish');
});

test('publisher is default read-only and requires precise owner authorization and race check', () => {
  requireGuard(publish, /if\s*\(-not\s+\$Publish\)\s*\{[\s\S]*?\breturn\b[\s\S]*?\}/, 'No-Publish default');
  requireGuard(publish, /\$typed\s*-ceq\s*\$approval/, 'Exact typed authorization');
  requireGuard(publish, /OwnerConfirmedPhotoZipBackup\.IsPresent\s*-xor\s*\$OwnerConfirmedNoLocalPhotos\.IsPresent/, 'Photo attestation');
  requireGuard(publish, /\$expectedOldVersion\s*-ceq\s*\$expectedActiveVersion/, 'Pre-consent current pin');
  requireGuard(publish, /\$afterVersions\.Count\s*-eq\s*1/, 'Post-consent no split traffic');
  requireGuard(publish, /\[string\]\$afterVersions\[0\]\.version_id\s*-ceq\s*\$expectedOldVersion/, 'Post-consent race refusal');
  requireGuard(publish, /&\s*\$wrangler\.Source\s+deploy\s+--config\s+\$temporaryManifest/, 'Actual publish remains explicitly gated');
});

test('the safety contract rejects stale or divergent script pins', () => {
  const staleReview = review.replace(active, obsolete);
  const stalePublish = publish.replace(active, obsolete);
  assert.notEqual(pin(staleReview), active);
  assert.notEqual(pin(stalePublish), active);
  assert.notEqual(pin(staleReview), pin(publish));
  assert.notEqual(pin(review), pin(stalePublish));
});
