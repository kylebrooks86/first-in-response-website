/** Create a disposable, QA-only Wrangler v4.151 manifest beside the compiled manifest.
 * Removes obsolete legacy_env=true AND strips the exclusively QA-only optional
 * R2 binding from a disposable deploy manifest, never from the original build.
 * Worker identity, D1, secrets, assets, routes and original QA build stay intact.
 * No API calls, secrets, migrations or deployment.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function prepare(originalFile, deployFile) {
  const original = resolve(originalFile);
  const destination = resolve(deployFile);
  assert.equal(basename(original), "wrangler.json", "Only compiled QA Wrangler manifest allowed");
  assert.equal(dirname(original), dirname(destination),
    "Temporary config MUST stay beside compiled main/assets for relative path resolution");
  assert.match(basename(destination),
    /^wrangler\.fire-qa-firstpublish-[a-f0-9-]{36}\.json$/,
    "Must use a unique disposable QA manifest name");
  const config = JSON.parse(readFileSync(original, "utf8"));
  assert.equal(config.name, "fire-fullapp-qa-20261016", "Wrong Worker; refuse deploy");
  assert.equal(config.legacy_env, true,
    "Only obsolete default legacy_env=true may be removed; false changes deployment behavior");
  assert.ok(!Object.hasOwn(config, "env"), "QA must not have named environment overrides");
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.d1_databases, [{
    binding: "DB",
    database_name: "fire-fullapp-qa-db-20261016",
    database_id: "8ccfb1f8-1657-4074-b1b2-47de78f95003"
  }]);
  // The hosted QA Worker already works with an on-device IndexedDB photo vault.
  // Never require billing activation or accidentally bind an unrelated bucket.
  // Either the historical candidate's exact QA-only optional R2 declaration or
  // no bucket at all is allowed; both deploy as D1-only.
  if (Object.hasOwn(config, "r2_buckets")) {
    assert.deepEqual(config.r2_buckets, [{
      binding: "BUCKET", bucket_name: "fire-fullapp-qa-photos-20261023"
    }], "Unexpected R2 binding; refuse QA deploy");
  }
  // Wrangler compiles unused services/queues/DO metadata as empty objects.
  // Accept that default representation but forbid any actual resource or
  // declared worker consumer, including nested producer/consumer settings.
  function isEmptyResource(value) {
    if (value === null || value === undefined || value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.values(value).every(isEmptyResource);
    return false;
  }
  for (const field of ["kv_namespaces", "services", "queues", "durable_objects", "hyperdrive", "dispatch_namespaces", "ai", "unsafe"]) {
    assert.ok(isEmptyResource(config[field]), "Unexpected hosted resource: " + field);
  }
  assert.deepEqual(config.secrets?.required,
    ["FIRE_QA_PASSWORD_HASH", "FIRE_QA_SESSION_SECRET"]);
  assert.equal(config.vars?.FIRE_ENV, "synthetic-qa");
  assert.equal(config.vars?.FIRE_QA_SYNTHETIC_ONLY, "enabled");
  assert.equal(config.vars?.FIRE_LOCAL_CUSTOMERS_CANDIDATE, "synthetic-only",
    "Refusing QA deploy without approved on-device, synthetic-only customer mode");
  assert.equal(config.vars?.SITE_ORIGIN,
    "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev");
  assert.ok(!config.routes && !config.route && !config.zone_id && !config.account_id,
    "No custom routes or zones allowed");
  assert.ok(!Object.keys(config.vars ?? {}).some(name =>
    /(stripe|secret|password|r2|token|live|staging|doomsday|private)/i.test(name)),
    "No secret values in public vars");
  const clean = { ...config };
  delete clean.legacy_env;
  delete clean.r2_buckets; // Explicitly R2-free, including no accidental auto-provision.
  assert.ok(!Object.hasOwn(clean, "r2_buckets"), "QA deployment must be R2-free");
  const text = JSON.stringify(clean, null, 2) + "\n";
  // 'wx' means fail on collision, even after a previous unsuccessful attempt.
  writeFileSync(destination, text, { flag: "wx", mode: 0o600 });
  try {
    assert.deepEqual(JSON.parse(readFileSync(destination, "utf8")), clean);
    assert.deepEqual(JSON.parse(readFileSync(original, "utf8")), config,
      "Original compiled manifest changed unexpectedly");
  } catch (error) {
    unlinkSync(destination);
    throw error;
  }
  return { worker: clean.name, config: destination, legacyEnvRemoved: true, r2Free: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 4, "Usage: node prepare_qa_deploy_config.mjs <original-wrangler.json> <unique-output.json>");
  const result = prepare(process.argv[2], process.argv[3]);
  console.log("PASS: Temporary R2-free QA-only Wrangler v4 deployment config prepared; original preserved.");
  console.log("Worker: " + result.worker);
}
