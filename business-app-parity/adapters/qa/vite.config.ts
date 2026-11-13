import {buildOfflineFieldAssets} from './scripts/build-offline-field.mjs';
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
// Permanent Job # display/search/creation is OFF by default.
// Only a target-bound OWNER-reviewed D1 schema, immutable trigger/link and
// numbering high-water receipt may authorize adding this flag to a build.
// The actual D1 Job # ready check still blocks writes if data is incomplete.
const NUMBERING_OPT_IN = process.env.FIRE_QA_JOB_NUMBERS_CANDIDATE;
if (NUMBERING_OPT_IN && NUMBERING_OPT_IN !== "owner-approved-schema-v1") {
  throw new Error("FIRE QA permanent Job # flag is not a reviewed value.");
}
if (NUMBERING_OPT_IN &&
    (process.env.FIRE_QA_JOB_NUMBERS_D1_UUID !== QA_DB_ID ||
     process.env.FIRE_QA_JOB_NUMBERS_SCHEMA_APPROVAL !== "owner-verified-qa-job-numbers-v1")) {
  throw new Error("FIRE QA permanent Job #s require separate physical D1 schema and owner review.");
}
const reviewedJobNumberVars = NUMBERING_OPT_IN
  ? { FIRE_JOB_NUMBERS_CANDIDATE: "owner-approved-schema-v1" }
  : {};

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
      {name:'fire-private-field-shell',apply:'build' as const,async generateBundle(){
        if(this.environment.name!=='client')return;
        const assets=await buildOfflineFieldAssets();
        for(const [fileName,source] of Object.entries(assets))this.emitFile({type:'asset',fileName,source:source as string});
      }},
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
            SITE_ORIGIN: QA_SITE_ORIGIN,
            ...reviewedJobNumberVars
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
