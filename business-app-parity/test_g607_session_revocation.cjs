const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {webcrypto} = require("node:crypto");
const ts = require(process.env.FIRE_G607_TS);

const root = process.env.FIRE_G607_ROOT;
let count = 0;

function check(value, label) {
  assert.ok(value, label);
  count++;
  console.log("PASS:", label);
}

async function run() {
  for (const adapter of [
    "qa", "doomsday", "independent-dr", "independent-live"
  ]) {
    let cookie = "";
    let offline = false;
    const rows = new Map();

    const env = {
      FIRE_QA_SESSION_SECRET: "q".repeat(64),
      FIRE_SESSION_SECRET: "s".repeat(64),
      FIRE_DR_SESSION_SECRET: "d".repeat(64),
      FIRE_NEW_LIVE_SESSION_SECRET: "l".repeat(64),
      FIRE_QA_SYNTHETIC_ONLY: "enabled",
      FIRE_DR_AUTH_ENABLED: "owner-approved",
      FIRE_NEW_LIVE_AUTH_ENABLED: "owner-approved",
      FIRE_JOB_NUMBERS_CANDIDATE: "owner-approved-schema-v1",
      FIRE_CUSTOMER_NUMBERS_CANDIDATE: "owner-approved-schema-v1",
      FIRE_ENV: {
        qa: "synthetic-qa",
        doomsday: "staging",
        "independent-dr": "isolated-dr",
        "independent-live": "new-live-prelaunch"
      }[adapter],
      SITE_ORIGIN: "https://" + {
        qa: "fire-fullapp-qa-20261016",
        doomsday: "fire-app-independent-staging",
        "independent-dr": "fire-fullapp-dr",
        "independent-live": "fire-fullapp-new-live"
      }[adapter] + ".kyle-bfc.workers.dev"
    };

    env.DB = {
      prepare(sql) {
        if (offline) throw Error("Synthetic storage outage");
        return {
          bind(...args) {
            return {
              async run() {
                if (sql.startsWith("INSERT")) {
                  const [id, scope, expires_at] = args;
                  const key = scope + ":" + id;
                  if (rows.has(key)) throw Error("Duplicate");
                  rows.set(key, {expires_at, revoked_at: null});
                  return {success: true, meta: {changes: 1}};
                }
                if (sql.startsWith("UPDATE")) {
                  const [now, id, scope] = args;
                  const row = rows.get(scope + ":" + id);
                  if (row && !row.revoked_at) row.revoked_at = now;
                  return {success: true};
                }
                throw Error("Unexpected write");
              },
              async first() {
                const [id, scope] = args;
                const row = rows.get(scope + ":" + id);
                if (!row) return null;
                if (sql.includes("IS NULL") && row.revoked_at)
                  return null;
                return {...row};
              }
            };
          }
        };
      }
    };

    function load(file, owner) {
      const exports = {};
      const compiled = ts.transpileModule(
        fs.readFileSync(file, "utf8"),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS
          },
          reportDiagnostics: true
        }
      );
      assert.equal(
        compiled.diagnostics.filter(d => d.category === 1).length,
        0, "TypeScript syntax errors"
      );

      vm.runInNewContext(compiled.outputText, {
        exports,
        require(name) {
          if (name === "cloudflare:workers") return {env};
          if (name === "next/headers") return {
            headers: async () => new Headers({cookie})
          };
          if (name === "next/navigation") return {
            redirect() { throw Error("redirect"); }
          };
          if (name.includes("owner-auth")) return owner;
          return {};
        },
        process: {env: {NODE_ENV: "production"}},
        TextEncoder,
        crypto: webcrypto,
        btoa: s => Buffer.from(s, "binary").toString("base64"),
        URL, Headers, Request, Response
      });
      return exports;
    }

    const base = path.join(root, "business-app-parity/adapters");
    const authPath = path.join(base, adapter, "app/owner-auth.ts");
    const auth = load(authPath);
    const logout = load(path.join(
      base, "doomsday/app/api/auth/logout/route.ts"
    ), auth);

    const a = (await auth.independentSessionCookie()).split(";")[0];
    const b = (await auth.independentSessionCookie()).split(";")[0];

    check(a !== b, adapter + " unique sessions");

    cookie = a;
    check(!!await auth.getOwnerUser(), adapter + " valid session");

    cookie = a + "tampered";
    check(!await auth.getOwnerUser(), adapter + " tampering denied");

    cookie = a;
    const request = new Request(env.SITE_ORIGIN + "/api/auth/logout", {
      headers: {cookie: a}
    });

    const result = await logout.GET(request);

    check(result.status === 303, adapter + " logout success");
    check(result.headers.get("set-cookie").includes("Max-Age=0"),
      adapter + " cookie cleared");

    check(!await auth.getOwnerUser(), adapter + " old credential denied");

    const restarted = load(authPath);
    check(!await restarted.getOwnerUser(),
      adapter + " revoked credential denied after module restart");

    cookie = b;
    check(!!await restarted.getOwnerUser(),
      adapter + " second device preserved");

    offline = true;

    check(!await auth.getOwnerUser(),
      adapter + " database outage fails closed");

    const failed = await logout.GET(new Request(
      env.SITE_ORIGIN + "/api/auth/logout", {
        headers: {cookie: b}
      }
    ));

    check(failed.status === 503,
      adapter + " failed revocation not reported successful");

    offline = false;

    check(!!await auth.getOwnerUser(),
      adapter + " remaining session works after recovery");
  }

  console.log("G607 ACTUAL HANDLER TESTS PASS: " + count + "/" + count);
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});