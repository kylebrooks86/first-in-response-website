#!/usr/bin/env node
// Source-only regression tests for the independently scoped public-website verifier.
// Changes occur exclusively in a disposable OS temp copy, never in this checkout.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(join(tmpdir(), 'fire-site-verifier-negative-'));
const copy = join(temp, 'repository');
const excluded = new Set(['.git', 'node_modules', '.next', '.wrangler', '.venv', 'dist']);

function run() {
  const processResult = spawnSync(process.execPath, ['verify-site-ci.mjs'], {
    cwd: copy,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024
  });
  assert.ifError(processResult.error);
  return {
    status: processResult.status,
    output: (processResult.stdout ?? '') + '\n' + (processResult.stderr ?? '')
  };
}

try {
  cpSync(root, copy, {
    recursive: true,
    filter(source) {
      const parts = relative(root, source).split(sep);
      return !parts.some(part => excluded.has(part));
    }
  });
  assert.ok(existsSync(join(copy, 'verify-site.mjs')));
  const baseline = run();
  assert.equal(baseline.status, 0, 'Baseline site verification must pass: ' + baseline.output.slice(-1200));
  console.log('PASS: Unmodified public website passes the real verifier with the exact approved media-blob exception.');

  // A deliberately invalid app HTML page must not be misidentified as a
  // public website page, even when it lives inside the same repository.
  const fixtureDir = join(copy, 'business-app-parity', 'adversarial-fixture');
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(join(fixtureDir, 'invalid-public-looking-page.html'),
    '<html><body>Internal app fixture without a public page heading or crawl rule.</body></html>\n');
  const isolated = run();
  assert.equal(isolated.status, 0, 'Internal app fixture incorrectly affected public website verification: ' + isolated.output.slice(-1200));
  console.log('PASS: Invalid internal app HTML fixture is excluded from the public website inventory.');

  // A genuine public-page regression must still fail, including through the
  // exact-blob exception wrapper.
  const homepage = join(copy, 'index.html');
  const originalIndex = readFileSync(homepage, 'utf8');
  const approvedServiceLink = 'href="services/gutter-brightening/"';
  assert.ok(originalIndex.includes(approvedServiceLink), 'Source fixture must include the approved public service link.');
  writeFileSync(homepage, originalIndex.replaceAll(approvedServiceLink,
    'href="services/removed-service/"'));
  const brokenPage = run();
  assert.notEqual(brokenPage.status, 0, 'A broken real public website service link must fail.');
  assert.match(brokenPage.output, /Homepage is missing its gutter-brightening service link/);
  console.log('PASS: Real public-page link regression fails independently.');

  writeFileSync(homepage, originalIndex);
  const logo = join(copy, 'assets', 'logo.jpg');
  const bytes = readFileSync(logo);
  assert.ok(bytes.length > 1024 && bytes.subarray(0, 3).toString('hex') === 'ffd8ff',
    'Baseline homepage logo must have an ordinary JPEG signature.');
  bytes[0] = 0;
  writeFileSync(logo, bytes);
  const brokenAsset = run();
  assert.notEqual(brokenAsset.status, 0, 'A genuine public media corruption must fail.');
  assert.match(brokenAsset.output, /assets\/logo\.jpg does not have a valid JPEG signature/);
  console.log('PASS: Real public media corruption fails; masonry exception cannot mask it.');
  console.log('PASS: Public-site verifier scope has positive and negative controls; production files untouched.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
