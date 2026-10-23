/** New, isolated FIRE synthetic QA Worker ONLY. Do not deploy automatically.
 * Never bind a production D1/R2, Stripe, custom domain or ChatGPT Sites resource.
 * QA R2 name is RESERVED FOR A FUTURE NEW QA-ONLY BUCKET; source does not
 * prove that the remote bucket exists or authorize creating/publishing it.
 */
import vinext from "vinext";
import { defineConfig } from "vite";

const QA_WORKER = "fire-fullapp-qa-20261016";
const QA_DB_NAME = "fire-fullapp-qa-db-20261016";
const QA_DB_ID = "8ccfb1f8-1657-4074-b1b2-47de78f95003";
const QA_PHOTO_BUCKET = "fire-fullapp-qa-photos-20261023";
// Account origin verified by owner-provided Cloudflare Workers dashboard screenshot.
// Pin the FULL origin to prevent a QA build from targeting any other account.
const QA_SITE_ORIGIN = "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev";
if (process.env.FIRE_QA_SITE_ORIGIN && process.env.FIRE_QA_SITE_ORIGIN !== QA_SITE_ORIGIN) {
  throw new Error("FIRE QA origin override does not match the verified account.");
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
          // Wrangler must refuse a hosted QA release with either owner login
          // secret missing. Values never belong in source or plain vars.
          secrets: { required: ["FIRE_QA_PASSWORD_HASH", "FIRE_QA_SESSION_SECRET"] },
          vars: {
            FIRE_ENV: "synthetic-qa",
            FIRE_QA_SYNTHETIC_ONLY: "enabled",
            FIRE_LOCAL_CUSTOMERS_CANDIDATE: "synthetic-only",
            SITE_ORIGIN: QA_SITE_ORIGIN
          },
          d1_databases: [{ binding: "DB", database_name: QA_DB_NAME, database_id: QA_DB_ID }],
          // Separate QA-only photo storage. Must be newly created and
          // owner-verified before any deployment, NEVER an existing LIVE bucket.
          r2_buckets: [{ binding: "BUCKET", bucket_name: QA_PHOTO_BUCKET }]
          // No Stripe, DNS, routes or existing Worker bindings.
        }
      })
    ]
  };
});
