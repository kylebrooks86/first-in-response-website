import vinext from "vinext";
import { defineConfig } from "vite";

const LOCAL_PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  vars: {
    FIRE_SERVICE_LOCATIONS_CANDIDATE: process.env.NODE_ENV === "development" && process.env.FIRE_SERVICE_LOCATIONS_CANDIDATE === "synthetic-only" ? "synthetic-only" : "",
    FIRE_CUSTOMER_PROPERTIES_CANDIDATE: process.env.NODE_ENV === "development" && process.env.FIRE_CUSTOMER_PROPERTIES_CANDIDATE === "synthetic-only" ? "synthetic-only" : "",
    FIRE_PROPERTY_RECOVERY_CANDIDATE: process.env.NODE_ENV === "development" && process.env.FIRE_PROPERTY_RECOVERY_CANDIDATE === "synthetic-tests-only" ? "synthetic-tests-only" : "",
    FIRE_PROPERTY_ESTIMATES_CANDIDATE: process.env.NODE_ENV === "development" && process.env.FIRE_PROPERTY_ESTIMATES_CANDIDATE === "synthetic-tests-only" ? "synthetic-tests-only" : "",
    FIRE_LOCAL_CUSTOMERS_CANDIDATE: process.env.NODE_ENV === "development"
      && process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE === "synthetic-only" ? "synthetic-only" : "",
  },
  d1_databases: [{
    binding: "DB",
    database_name: "fire-app-local",
    database_id: LOCAL_PLACEHOLDER_DATABASE_ID,
  }],
  r2_buckets: [{
    binding: "BUCKET",
    bucket_name: "fire-app-local",
  }],
};

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "127.0.0.1",
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
