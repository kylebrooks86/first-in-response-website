/**
 * FIRE Gate 9 — OFFLINE contract for a full-app TEST version with static assets.
 *
 * Pure source-level validation, NOT an API client. No network, auth, D1, Stripe,
 * file writes, or upload support. Never give this module an API token or JWT.
 *
 * Provider documentation:
 * https://developers.cloudflare.com/workers/static-assets/direct-upload/
 * https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/
 *
 * Registration/upload of static assets are separate PROVIDER WRITES, not
 * dry-runs, and require new explicit owner authorization even if no traffic
 * is shifted. This contract cannot authorize them.
 */
export const WORKER = 'fire-stripe-test-20261101';
export const PREDECESSOR = '96e32262-fa33-4f04-a161-bee11f0353e2';
export const DB_UUID = 'dba421ba-fc66-4cf8-9c31-51616f8249ba';
export const ORIGIN = 'https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
export const API = 'workers.beta.workers.versions.create';
export const INHERITED = Object.freeze([
  'DB', 'FIRE_ACCESS_AUD', 'FIRE_ACCESS_OWNER_EMAIL',
  'FIRE_ACCESS_REQUIRED', 'FIRE_ACCESS_TEAM_DOMAIN',
  'FIRE_ENV', 'FIRE_STRIPE_MODE', 'SITE_ORIGIN', 'STRIPE_WEBHOOK_SECRET'
].sort());
const SECRETS = Object.freeze([
  'FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL',
  'FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET'
].sort());
const VARS = Object.freeze({
  FIRE_ACCESS_REQUIRED: 'enabled',
  FIRE_ENV: 'cloudflare-staging',
  FIRE_STRIPE_MODE: 'disabled',
  SITE_ORIGIN: ORIGIN
});
const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
function ok(b) {
  if (!b) throw Error('STOP: TEST full-app inactive contract mismatch. No upload authorized.');
}
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const names = xs => xs.slice().sort().join(',');

/**
 * Independently acquired IMMUTABLE serving-version metadata. Fixtures are
 * allowed for offline tests, but cannot prove the remote state by themselves.
 */
export function verifyPredecessor(version) {
  ok(obj(version) && version.id === PREDECESSOR);
  ok(obj(version.resources) && Array.isArray(version.resources.bindings));
  const b = version.resources.bindings;
  ok(b.length === 9); // exactly one DB, four plain-text vars, four encrypted secrets
  ok(new Set(b.map(x => x?.name)).size === 9);
  ok(names(b.map(x => x.name)) === names(INHERITED));
  const db = b.find(x => x.name === 'DB');
  ok(db.type === 'd1' && db.id === DB_UUID);
  for (const [name, val] of Object.entries(VARS)) {
    const x = b.find(x => x.name === name);
    ok(x.type === 'plain_text' && x.text === val);
  }
  for (const name of SECRETS) {
    const x = b.find(x => x.name === name);
    ok(x.type === 'secret_text' && !Object.hasOwn(x,'text') &&
       !Object.hasOwn(x,'value'));
  }
  ok(!Object.hasOwn(version.resources, 'assets') &&
     !Object.hasOwn(version.resources, 'static_assets'));
  return true;
}

/**
 * Inspect an OFFLINE metadata-only asset manifest. Does NOT upload assets and
 * does NOT consume the short-lived provider upload/completion token.
 */
export function verifyAssetManifest(manifest) {
  ok(obj(manifest));
  const keys = Object.keys(manifest);
  ok(keys.length >= 2 && keys.length <= 5000);
  ok(keys.some(x => x.endsWith('.js')) && keys.some(x => x.endsWith('.css')));
  let total = 0;
  for (const path of keys) {
    ok(/^\/[A-Za-z0-9_.\/-]+$/.test(path) &&
      !path.includes('..') && !path.includes('//') &&
      !/\.(env|map|key|pem|sqlite|db|log|bak)$/i.test(path));
    const f = manifest[path];
    ok(obj(f) && Object.keys(f).sort().join(',') === 'hash,size' &&
      /^[a-f0-9]{32}$/i.test(f.hash) &&
      Number.isSafeInteger(f.size) && f.size > 0 && f.size < 25_000_000);
    total += f.size;
  }
  ok(total < 200_000_000);
  return {assetCount:keys.length, assetBytes:total};
}

/**
 * Review a PROPOSED provider version operation; never send it. Validation
 * deliberately disallows anything except 9 inherited bindings pinned to the
 * actual 100%-serving immutable predecessor, plus a new ASSETS binding.
 *
 * Beta Workers Version API accepts immutable version_id on inherit bindings;
 * script-version upload API accepts latest only. Must use the beta endpoint.
 */
export function verifyInactiveProposal(proposal) {
  ok(obj(proposal));
  ok(Object.keys(proposal).sort().join(',') ===
    'api,bindings,deploy,predecessor,worker');
  ok(proposal.api === API && proposal.worker === WORKER &&
    proposal.predecessor === PREDECESSOR && proposal.deploy === false);
  ok(Array.isArray(proposal.bindings) && proposal.bindings.length === 10);
  const bind = proposal.bindings;
  ok(new Set(bind.map(x => x?.name)).size === bind.length);
  const inherited = bind.filter(x => x.type === 'inherit');
  ok(inherited.length === 9 && names(inherited.map(x => x.name)) === names(INHERITED));
  ok(inherited.every(x =>
    Object.keys(x).sort().join(',') === 'name,type,version_id' &&
    x.version_id === PREDECESSOR && UUID.test(x.version_id)
  ));
  const assets = bind.filter(x => x.type === 'assets');
  ok(assets.length === 1 && assets[0].name === 'ASSETS' &&
    Object.keys(assets[0]).sort().join(',') === 'name,type');
  return {
    offlineShapeReviewed: true,
    inactiveOnly: true,
    exactPredecessorPinned: true,
    actualProviderResponseVerified: false,
    assetCompletionTokenVerified: false,
    completeCompiledAppVerified: false,
    uploadAuthorized: false,
    trafficActivationAuthorized: false,
    gate9Accepted: false
  };
}

/** Fake fixtures only; this is NOT a deployable request body. */
export function proposedInactivePlan() {
  return {
    api: API, worker: WORKER, predecessor: PREDECESSOR, deploy: false,
    bindings: [
      ...INHERITED.map(name => ({name,type:'inherit',version_id:PREDECESSOR})),
      {name:'ASSETS',type:'assets'}
    ]
  };
}
