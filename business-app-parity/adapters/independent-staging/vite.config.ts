/** Source-only candidate for EXISTING owner-isolated staging Worker.
 * Build does NOT deploy. Must pass exact identity, D1, auth, key-mode,
 * backup, migration, and traffic-routing gates before any upload.
 * The login/session adapter is inherited unchanged from Doomsday;
 * core application UI and business code come from shared/.
 */
import {buildOfflineFieldAssets} from './scripts/build-offline-field.mjs';
import vinext from "vinext";
import { defineConfig } from "vite";

const WORKER = "fire-app-independent-staging";
const DB_NAME = "fire-app-staging-db";
const DB_ID = "afb2c05a-d794-4a9a-b580-924ce01c26ad";
const ORIGIN = "https://fire-app-independent-staging.kyle-bfc.workers.dev";
// Permanent Job # display/search/creation is OFF by default.
// Only a target-bound OWNER-reviewed D1 schema, immutable trigger/link and
// numbering high-water receipt may authorize adding this flag to a build.
// The actual D1 Job # ready check still blocks writes if data is incomplete.
const NUMBERING_OPT_IN = process.env.FIRE_STAGING_JOB_NUMBERS_CANDIDATE;
if (NUMBERING_OPT_IN && NUMBERING_OPT_IN !== "owner-approved-schema-v1") {
  throw new Error("FIRE STAGING permanent Job # flag is not a reviewed value.");
}
if (NUMBERING_OPT_IN &&
    (process.env.FIRE_STAGING_JOB_NUMBERS_D1_UUID !== DB_ID ||
     process.env.FIRE_STAGING_JOB_NUMBERS_SCHEMA_APPROVAL !== "owner-verified-staging-job-numbers-v1")) {
  throw new Error("FIRE STAGING permanent Job #s require separate physical D1 schema and owner review.");
}
const reviewedJobNumberVars = NUMBERING_OPT_IN
  ? { FIRE_JOB_NUMBERS_CANDIDATE: "owner-approved-schema-v1" }
  : {};


// Face ID / fingerprint sign-in happens at a VERIFIED Cloudflare Access
// passkey relying party. Source-only builds keep quick unlock OFF unless
// the owner has approved a specifically bound Access app and separate
// PIN-HASH + PIN-PEPPER secrets for this Worker. No PIN or pepper in vars.
const quickAuthMode = process.env.FIRE_STAGING_QUICK_AUTH_MODE;
if (quickAuthMode && quickAuthMode !== "passkey-or-pin-v1") {
  throw new Error("Unreviewed FIRE STAGING quick sign-in mode.");
}
const quickAuthRequested = quickAuthMode === "passkey-or-pin-v1";
const quickAuthTeam = process.env.FIRE_STAGING_ACCESS_TEAM_DOMAIN;
const quickAuthAudience = process.env.FIRE_STAGING_ACCESS_AUDIENCE;
const quickAuthOwnerEmail = process.env.FIRE_STAGING_ACCESS_OWNER_EMAIL;
if (quickAuthRequested &&
    (process.env.FIRE_STAGING_QUICK_AUTH_APPROVAL !== "owner-approved-staging-quick-auth-v1" ||
     typeof quickAuthTeam !== "string" ||
     !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(quickAuthTeam) ||
     typeof quickAuthAudience !== "string" || quickAuthAudience.length < 12 || quickAuthAudience.length > 256 ||
     typeof quickAuthOwnerEmail !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(quickAuthOwnerEmail))) {
  throw new Error("FIRE STAGING passkey/PIN requires separate owner-verified Cloudflare Access application settings.");
}
const reviewedQuickAuthVars = quickAuthRequested
  ? { FIRE_QUICK_AUTH_MODE:"passkey-or-pin-v1",
      FIRE_ACCESS_TEAM_DOMAIN:quickAuthTeam!,
      FIRE_ACCESS_AUDIENCE:quickAuthAudience!,
      FIRE_ACCESS_OWNER_EMAIL:quickAuthOwnerEmail! }
  : {};
const reviewedQuickAuthSecrets = quickAuthRequested
  ? [...["FIRE_ADMIN_PASSWORD_HASH", "FIRE_SESSION_SECRET"], "FIRE_PIN_HASH", "FIRE_PIN_PEPPER"]
  : ["FIRE_ADMIN_PASSWORD_HASH", "FIRE_SESSION_SECRET"];

if (process.env.FIRE_STAGING_SITE_ORIGIN && process.env.FIRE_STAGING_SITE_ORIGIN !== ORIGIN) {
  throw new Error("Staging origin override is not the owner-verified Worker.");
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
          name: WORKER,
          main: "vinext/server/fetch-handler",
          compatibility_date: "2026-10-16",
          compatibility_flags: ["nodejs_compat"],
          workers_dev: true,
          secrets: { required: reviewedQuickAuthSecrets },
          vars: {
            FIRE_ENV: "staging",
            SITE_ORIGIN: ORIGIN,
            ...reviewedJobNumberVars,
            ...reviewedQuickAuthVars
          },
          d1_databases: [{ binding: "DB", database_name: DB_NAME, database_id: DB_ID }]
          // No R2, custom route, or production payment binding configured here.
          // Existing Worker secrets/bindings must be separately read-only
          // reviewed. No upload/deployment is authorized by this file.
        }
      })
    ]
  };
});
