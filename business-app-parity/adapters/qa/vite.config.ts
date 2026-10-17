/** New, isolated FIRE synthetic QA Worker ONLY. Do not deploy automatically.
 * Never bind an existing D1, R2, Stripe, custom domain or ChatGPT Sites resource.
 */
import vinext from "vinext";
import { defineConfig } from "vite";

const QA_WORKER = "fire-fullapp-qa-20261016";
const QA_DB_NAME = "fire-fullapp-qa-db-20261016";
const QA_DB_ID = "8ccfb1f8-1657-4074-b1b2-47de78f95003";
const qaSiteOrigin = process.env.FIRE_QA_SITE_ORIGIN || "";
// Site origin must be discovered from the owner's account before first deployment.
// Intentionally EMPTY in CI: unconfigured authentication then fails closed.
if (qaSiteOrigin && !/^https:\/\/fire-fullapp-qa-20261016\.[a-z0-9-]+\.workers\.dev$/.test(qaSiteOrigin)) {
  throw new Error("QA HTTPS origin does not match the isolated Worker identity.");
}

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: { host: "127.0.0.1" },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          name: QA_WORKER,
          main: "vinext/server/fetch-handler",
          compatibility_date: "2026-10-16",
          compatibility_flags: ["nodejs_compat"],
          workers_dev: true,
          vars: {
            FIRE_ENV: "synthetic-qa",
            FIRE_QA_SYNTHETIC_ONLY: "enabled",
            SITE_ORIGIN: qaSiteOrigin
          },
          d1_databases: [{ binding: "DB", database_name: QA_DB_NAME, database_id: QA_DB_ID }]
          // No R2, Stripe, DNS, routes or existing Worker bindings.
        }
      })
    ]
  };
});
