/** Hosted QA source test: actual server route, namespace gate and installed PWA.
 * No Cloudflare requests, credentials, filesystem writes, or browser vault access.
 * Run inside the separately materialized QA candidate.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const esbuild = require("../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild");
const root = resolve(new URL("..", import.meta.url).pathname);
const owner = { userId: "synthetic-qa-signed-cookie-owner", email: "kylebrooks8605@gmail.com" };
const origin = "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev";
const scope = { fireEnv: "synthetic-qa", syntheticOnly: "enabled", siteOrigin: origin };
const fixtureEnv = globalThis.fireQaFixtureEnv = {
  FIRE_ENV: scope.fireEnv,
  FIRE_QA_SYNTHETIC_ONLY: scope.syntheticOnly,
  SITE_ORIGIN: origin,
  FIRE_LOCAL_CUSTOMERS_CANDIDATE: "synthetic-only"
};
globalThis.fireQaFixtureOwner = owner;
globalThis.fireQaFixtureAuthCalls = 0;
let passed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    passed += 1;
    console.log("PASS: " + name);
  });
}
async function moduleFrom(entry, plugins = []) {
  const bundle = await esbuild.build({
    entryPoints: [join(root, entry)], bundle: true, write: false,
    format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty" }, plugins
  });
  return import("data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64"));
}
const fakeCloudflare = {
  name: "QA synthetic server-only test fixtures",
  setup(build) {
    build.onResolve({ filter: /^cloudflare:workers$/ }, () =>
      ({ path: "fixture:qa-env", namespace: "fire-fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fire-fixture" }, () =>
      ({ contents: "export const env = globalThis.fireQaFixtureEnv;", loader: "js" }));
    build.onLoad({ filter: /app\/chatgpt-auth\.ts$/ }, () => ({
      contents: "export async function requireChatGPTUser() { globalThis.fireQaFixtureAuthCalls++; if (!globalThis.fireQaFixtureOwner) throw Error('QA login required'); return globalThis.fireQaFixtureOwner; }",
      loader: "ts"
    }));
  }
};
const { default: page } = await moduleFrom("app/development/local-customers/page.tsx", [fakeCloudflare]);
const { candidateCustomerAccess } = await moduleFrom("lib/candidate-customer-access.ts");
const { default: manifest } = await moduleFrom("app/manifest.ts");
function contentOf(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(contentOf).join(" ");
  return node?.props ? contentOf(node.props.children) : "";
}
const previousNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = "production";
  await check("Hosted authenticated QA exposes the actual synthetic local customer panel", async () => {
    const panel = await page();
    assert.equal(panel.props.identity.accountId, "synthetic-fire-owner-account-v1");
    assert.equal(panel.props.identity.targetId, "synthetic-fire-isolated-synthetic-qa-v1");
    assert.equal(fireQaFixtureAuthCalls, 1);
  });
  await check("QA production requires authenticated owner, not just build flags", async () => {
    fireQaFixtureOwner = null;
    await assert.rejects(() => page(), /QA login required/);
    fireQaFixtureOwner = owner;
  });
  await check("QA refuses a different signed-in account", async () => {
    fireQaFixtureOwner = { ...owner, email: "unauthorized@example.invalid" };
    assert.match(contentOf(await page()), /Owner access required/);
    fireQaFixtureOwner = owner;
  });
  for (const [key, wrong] of [
    ["FIRE_LOCAL_CUSTOMERS_CANDIDATE", "normal"],
    ["FIRE_ENV", "production"],
    ["FIRE_QA_SYNTHETIC_ONLY", "disabled"],
    ["SITE_ORIGIN", "https://wrong-account.workers.dev"]
  ]) {
    await check("Hosted QA blocks " + key + " mismatch before authentication", async () => {
      const before = fireQaFixtureAuthCalls, prior = fixtureEnv[key];
      fixtureEnv[key] = wrong;
      try {
        assert.match(contentOf(await page()), /Development screen disabled/);
        assert.equal(fireQaFixtureAuthCalls, before);
      } finally { fixtureEnv[key] = prior; }
    });
  }
  await check("Missing provenance cannot open QA production customer vault", () => {
    for (const missing of [undefined, {}, { ...scope, siteOrigin: "https://other.workers.dev" }])
      assert.equal(candidateCustomerAccess(owner, "qa", "synthetic-only", "production", missing), null);
  });
  await check("LIVE, Doomsday and staging production never receive local vault access", () => {
    for (const target of ["live", "doomsday", "staging"])
      assert.equal(candidateCustomerAccess(owner, target, "synthetic-only", "production", scope), null);
  });
  await check("Ordinary local developer synthetic access remains unchanged", () => {
    assert.equal(candidateCustomerAccess(owner, "live", "synthetic-only", "development")?.targetId,
      "synthetic-fire-live-v1");
  });
  await check("QA Home Screen app is visibly and technically separate from LIVE", () => {
    const m = manifest();
    assert.equal(m.id, "/fire-synthetic-qa-v1");
    assert.equal(m.name, "FIRE QA - Synthetic Only");
    assert.equal(m.short_name, "FIRE QA");
    assert.match(m.start_url, /^\/\?qa=synthetic&app=/);
    assert.notEqual(m.id, "/");
  });
  await check("QA build config requires synthetic local customer mode", () => {
    const config = readFileSync(join(root, "vite.config.ts"), "utf8");
    assert.match(config, /FIRE_LOCAL_CUSTOMERS_CANDIDATE: "synthetic-only"/);
  });
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  delete globalThis.fireQaFixtureEnv;
  delete globalThis.fireQaFixtureOwner;
  delete globalThis.fireQaFixtureAuthCalls;
}
console.log(JSON.stringify({ passed, target: "qa", hostedOrDeployed: false,
  iPhoneAcceptance: false, usedRealCustomerData: false, payments: false }));
