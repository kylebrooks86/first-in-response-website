import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { prepare } from "./prepare_qa_deploy_config.mjs";

const root = mkdtempSync(join(tmpdir(), "fire-qa-config-"));
const folder = join(root, "dist", "server");
mkdirSync(folder, { recursive: true });
const original = join(folder, "wrangler.json");
const fixture = () => ({
  name: "fire-fullapp-qa-20261016",
  main: "./index.js",
  legacy_env: true,
  compatibility_date: "2026-10-16",
  workers_dev: true,
  d1_databases: [{
    binding: "DB", database_name: "fire-fullapp-qa-db-20261016",
    database_id: "8ccfb1f8-1657-4074-b1b2-47de78f95003"
  }],
  secrets: { required: ["FIRE_QA_PASSWORD_HASH", "FIRE_QA_SESSION_SECRET"] },
  r2_buckets: [{binding: "BUCKET", bucket_name: "fire-fullapp-qa-photos-20261023"}],
  vars: {
    FIRE_ENV: "synthetic-qa", FIRE_QA_SYNTHETIC_ONLY: "enabled",
    SITE_ORIGIN: "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev"
  },
  assets: { directory: "../client", binding: "ASSETS" }
});
let passed = 0;
function source(object) { writeFileSync(original, JSON.stringify(object)); }
function dest() { return join(folder, "wrangler.fire-qa-firstpublish-" + randomUUID() + ".json"); }
function check(name, fn) { fn(); passed += 1; console.log("PASS: " + name); }
try {
  source(fixture());
  check("Removes ONLY default legacy_env=true while preserving all other bindings/assets", () => {
    const to = dest();
    const result = prepare(original, to);
    assert.equal(result.legacyEnvRemoved, true);
    const before = JSON.parse(readFileSync(original));
    const after = JSON.parse(readFileSync(to));
    assert.equal(before.legacy_env, true);
    assert.equal(Object.hasOwn(after, "legacy_env"), false);
    delete before.legacy_env;
    assert.deepEqual(after, before);
  });
  check("Refuses to overwrite even an existing empty manifest", () => {
    const to = dest(); writeFileSync(to, "");
    assert.throws(() => prepare(original, to), /EEXIST/);
  });
  check("Refuses to move config away from compiled Worker entry/assets", () =>
    assert.throws(() => prepare(original,
      join(root, "wrangler.fire-qa-firstpublish-" + randomUUID() + ".json")), /MUST stay beside/));
  for (const [label,mutate] of [
    ["legacy_env=false deployment semantics", x => { x.legacy_env = false; }],
    ["missing legacy_env identity", x => { delete x.legacy_env; }],
    ["occupied or differently named Worker", x => { x.name = "fire-app-independent-staging"; }],
    ["production D1 binding", x => { x.d1_databases[0].database_name = "fire-app-staging-db"; }],
    ["wrong QA D1 UUID", x => { x.d1_databases[0].database_id = "wrong"; }],
    ["production R2 bucket", x => { x.r2_buckets[0].bucket_name = "fire-live-customer-photos"; }],
    ["wrong photo binding", x => { x.r2_buckets[0].binding = "PRIVATE_R2"; }],
    ["extra photo bucket", x => { x.r2_buckets.push({binding:"OTHER",bucket_name:"production"}); }],
    ["no QA photo storage", x => { delete x.r2_buckets; }],
    ["unexpected KV binding", x => { x.kv_namespaces = [{binding:"CONFIG",id:"123"}]; }],
    ["missing required QA secrets", x => { x.secrets.required = []; }],
    ["production env override", x => { x.env = { production: {} }; }],
    ["custom route", x => { x.route = "fire.example.com/*"; }],
    ["changed origin", x => { x.vars.SITE_ORIGIN = "https://other.workers.dev"; }],
    ["secret placed in plaintext vars", x => { x.vars.FIRE_QA_SESSION_SECRET = "bad"; }]
  ]) {
    check("Rejects " + label, () => {
      const broken = fixture();mutate(broken);source(broken);
      const to = dest();
      assert.throws(() => prepare(original,to));
      assert.equal(requireExists(to), false);
    });
  }
} finally { rmSync(root, { recursive: true, force: true }); }
function requireExists(file) {
  try { readFileSync(file); return true; } catch (e) { if(e.code === "ENOENT")return false;throw e; }
}
console.log(JSON.stringify({ passed, uploads: 0, remoteWrites: 0, compiledWorkerModified: false }));
