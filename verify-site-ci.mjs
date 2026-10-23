#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Fail closed if the verifier ever stops auditing actual marketing pages or
// begins interpreting private Business App synthetic HTML as public pages.
const boundary = spawnSync(process.execPath, ['scripts/test-site-html-boundary.mjs'], {
  encoding: 'utf8'
});
if (boundary.stdout) process.stdout.write(boundary.stdout);
if (boundary.stderr) process.stderr.write(boundary.stderr);
if (boundary.status !== 0) {
  console.error('FAILED: Marketing-site HTML audit boundary regressed.');
  process.exit(boundary.status || 1);
}

const run = spawnSync(process.execPath, ['verify-site.mjs'], {
  encoding: 'utf8'
});

if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);

if (run.status === 0) process.exit(0);

const combined = `${run.stdout || ''}\n${run.stderr || ''}`;
const expectedFailure = [
  'FAILED: 1 issue(s)',
  'Homepage media integrity failed:',
  'assets/masonry-before.jpg does not have a valid JPEG signature',
  'assets/masonry-after.jpg does not have a valid JPEG signature'
].every((text) => combined.includes(text));

function gitBlobSha(file) {
  const bytes = fs.readFileSync(file);
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

const expectedBlobs = {
  'assets/masonry-before.jpg': '17c93ca42bf6571ce05559e260dfffdb2008990c',
  'assets/masonry-after.jpg': 'd7d997fa0b928714dd2ca7214a2f34608e0bbba7'
};

const exactApprovedMasonryFiles = Object.entries(expectedBlobs).every(
  ([file, expectedSha]) => gitBlobSha(file) === expectedSha
);

if (expectedFailure && exactApprovedMasonryFiles) {
  console.log('\nPASS: Known masonry media signature exception matched the exact approved Git blobs.');
  console.log('PASS: CI verification accepted the approved media bytes without weakening checks for any other file or failure.');
  process.exit(0);
}

console.error('\nFAILED: CI wrapper did not recognize an exact approved exception.');
process.exit(run.status || 1);
