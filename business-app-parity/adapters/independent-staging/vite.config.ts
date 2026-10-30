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
          secrets: { required: ["FIRE_ADMIN_PASSWORD_HASH", "FIRE_SESSION_SECRET"] },
          vars: {
            FIRE_ENV: "staging",
            SITE_ORIGIN: ORIGIN
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
