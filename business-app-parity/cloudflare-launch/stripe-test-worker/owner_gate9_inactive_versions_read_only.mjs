/**
 * FIRE Gate 9: read-only inventory of EXISTING inactive TEST Worker versions.
 * This does NOT approve, stage, upload, deploy, switch, or enable a version.
 * Run from an owner-authenticated Acer terminal:
 *   node business-app-parity/cloudflare-launch/stripe-test-worker/owner_gate9_inactive_versions_read_only.mjs
 *
 * No arguments accepted. Executes only fixed Wrangler GET-style commands:
 *   deployments status, versions list, versions view.
 * Never prints raw provider JSON, secret values, tokens, or customer data.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const WORKER = 'fire-stripe-test-20261101';
export const ACTIVE_ID = '96e32262-fa33-4f04-a161-bee11f0353e2';
export const D1_ID = 'dba421ba-fc66-4cf8-9c31-51616f8249ba';
export const SECRET_NAMES = Object.freeze([
  'FIRE_ACCESS_AUD', 'FIRE_ACCESS_OWNER_EMAIL',
  'FIRE_ACCESS_TEAM_DOMAIN', 'STRIPE_WEBHOOK_SECRET'
]);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function fail() {
  throw new Error('STOP READ ONLY: Cloudflare TEST version identity or inventory is not verifiable');
}
export function activeIdFromDeployment(value) {
  if (!value || !Array.isArray(value.versions) || value.versions.length !== 1) fail();
  const current = value.versions[0];
  if (!uuid.test(current.version_id || '') || Number(current.percentage) !== 100) fail();
  return current.version_id.toLowerCase();
}
export function recentVersionIds(value) {
  let entries;
  if (Array.isArray(value)) entries = value;
  else if (Array.isArray(value?.versions)) entries = value.versions;
  else if (Array.isArray(value?.result)) entries = value.result;
  else if (Array.isArray(value?.result?.versions)) entries = value.result.versions;
  else fail();
  if (entries.length < 1 || entries.length > 100) fail();
  const ids = entries.map(item => {
    const id = item?.id ?? item?.version_id;
    if (typeof id !== 'string' || !uuid.test(id)) fail();
    return id.toLowerCase();
  });
  if (new Set(ids).size !== ids.length) fail();
  return ids;
}
export function classifyVersion(value, expectedId) {
  if (!uuid.test(expectedId || '') || value?.id?.toLowerCase() !== expectedId.toLowerCase()) fail();
  const resources = value.resources;
  if (!resources || typeof resources !== 'object' ||
      !Object.hasOwn(resources, 'script') ||
      !Object.hasOwn(resources, 'script_runtime') ||
      !Array.isArray(resources.bindings)) fail();
  const bindings = resources.bindings;
  const d1 = bindings.filter(x => x?.type === 'd1');
  const mode = bindings.filter(x => x?.name === 'FIRE_STRIPE_MODE');
  const secrets = bindings.filter(x => x?.type === 'secret_text').map(x => x?.name).sort();
  const r2 = bindings.filter(x => x?.type === 'r2' || x?.type === 'r2_bucket');
  const knownSafeBindings =
    d1.length === 1 && d1[0].name === 'DB' && d1[0].id === D1_ID &&
    mode.length === 1 && mode[0].type === 'plain_text' && mode[0].text === 'disabled' &&
    secrets.length === 4 && secrets.every((s, i) => s === SECRET_NAMES[i]) &&
    r2.length === 0;
  const hasAssets = Object.hasOwn(resources, 'assets') ||
                    Object.hasOwn(resources, 'static_assets');
  return { knownSafeBindings, hasAssets };
}
function wranglerJson(args) {
  // Fixed command names/worker/version UUIDs only. No user-provided strings.
  const win = process.platform === 'win32';
  const command = win ? 'cmd.exe' : 'wrangler';
  const commandArgs = win ? ['/d', '/s', '/c', 'wrangler.cmd ' + args.join(' ')] : args;
  const p = spawnSync(command, commandArgs, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    windowsHide: true, shell: false
  });
  if (p.error || p.status !== 0 || typeof p.stdout !== 'string') fail();
  try { return JSON.parse(p.stdout.trim()); } catch { fail(); }
}
export function main() {
  if (process.argv.length !== 2) fail();
  const deployed = activeIdFromDeployment(
    wranglerJson(['deployments', 'status', '--name', WORKER, '--json']));
  if (deployed !== ACTIVE_ID) fail();
  const ids = recentVersionIds(
    wranglerJson(['versions', 'list', '--name', WORKER, '--json']));
  if (!ids.includes(ACTIVE_ID)) fail();
  const baseline = classifyVersion(
    wranglerJson(['versions', 'view', ACTIVE_ID, '--name', WORKER, '--json']), ACTIVE_ID);
  if (!baseline.knownSafeBindings || baseline.hasAssets) fail();
  const inactive = ids.filter(id => id !== ACTIVE_ID);
  // Stop if any response shape is malformed, rather than silently treating it as safe.
  const checked = inactive.map(id => ({
    id, ...classifyVersion(
      wranglerJson(['versions', 'view', id, '--name', WORKER, '--json']), id)
  }));
  console.log('READ_ONLY_GATE9_RECENT_VERSION_CLASSIFICATION=PASS');
  console.log('ACTIVE_CODE_ONLY_BASELINE=VERIFIED_100_PERCENT');
  console.log('RECENT_INACTIVE_COUNT=' + checked.length);
  for (const v of checked) {
    console.log('VERSION_ID=' + v.id +
      ' ASSETS=' + (v.hasAssets ? 'PRESENT' : 'ABSENT') +
      ' LIMITED_BINDINGS=' + (v.knownSafeBindings ? 'MATCH' : 'DIFFER') +
      ' SOURCE=UNVERIFIED USABLE_WITHOUT_REVIEW=NO');
  }
  console.log('NO UPLOAD. NO DEPLOYMENT. NO TRAFFIC OR STRIPE CHANGES.');
  console.log('Assets and matching bindings alone NEVER establish code provenance, route completeness or safe activation.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch {
    console.error('STOP READ ONLY: TEST inventory could not be classified; no changes made.');
    process.exitCode = 1;
  }
}
