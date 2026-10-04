import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../dist/server/wrangler.json", import.meta.url);
const destinationPath = new URL("../dist/server/wrangler.independent.json", import.meta.url);
const required = ["FIRE_WORKER_NAME", "FIRE_D1_DATABASE_NAME", "FIRE_D1_DATABASE_ID", "FIRE_R2_BUCKET_NAME"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error("Missing required deployment values: " + missing.join(", "));
  console.error("No deployment configuration was written.");
  process.exit(1);
}

const databaseId = process.env.FIRE_D1_DATABASE_ID.trim();
if (!/^[0-9a-f-]{32,36}$/i.test(databaseId) || databaseId === "00000000-0000-4000-8000-000000000000") {
  console.error("FIRE_D1_DATABASE_ID is not a valid non-placeholder D1 database ID.");
  process.exit(1);
}

const config = JSON.parse(await readFile(sourcePath, "utf8"));
config.name = process.env.FIRE_WORKER_NAME.trim();
config.topLevelName = config.name;
config.d1_databases = [{ binding: "DB", database_name: process.env.FIRE_D1_DATABASE_NAME.trim(), database_id: databaseId }];
config.r2_buckets = [{ binding: "BUCKET", bucket_name: process.env.FIRE_R2_BUCKET_NAME.trim() }];

await writeFile(destinationPath, JSON.stringify(config, null, 2) + "\n");
console.log("Wrote isolated staging configuration to dist/server/wrangler.independent.json");
