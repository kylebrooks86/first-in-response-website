import { readFile, writeFile } from "node:fs/promises";
import { independentConfigValues } from './independent-config-values.mjs';

const sourcePath = new URL("../dist/server/wrangler.json", import.meta.url);
const destinationPath = new URL("../dist/server/wrangler.independent.json", import.meta.url);
// FIRE's private offline-photo vault does not require Cloudflare R2.
// Omit R2 entirely unless the owner explicitly supplies a bucket name.
const { worker, databaseName, databaseId, bucket } = independentConfigValues(process.env);
const config = JSON.parse(await readFile(sourcePath, "utf8"));
// Never carry a compiled custom-domain route or environment override into a
// different account. Reject it for review instead of silently stripping it.
for (const key of ['route', 'routes', 'zone_id', 'env', 'account_id']) {
  if (Object.hasOwn(config, key)) throw Error('Unexpected inherited deployment setting: ' + key);
}
// Wrangler emits empty containers such as queues:{producers:[],consumers:[]}.
const containsResource = value => Array.isArray(value) ? value.length > 0
  : value && typeof value === 'object' ? Object.values(value).some(containsResource) : Boolean(value);
for (const key of ['services', 'kv_namespaces', 'queues', 'durable_objects', 'hyperdrive', 'dispatch_namespaces', 'workflows', 'triggers']) {
  const value = config[key];
  if (containsResource(value)) throw Error('Unexpected inherited resource binding: ' + key);
}
if (Object.keys(config.vars || {}).some(name => /stripe|secret|password|token|api.?key/i.test(name))) {
  throw Error('Secret or payment configuration must not be inherited through plain vars.');
}
config.name = worker;
config.topLevelName = config.name;
config.workers_dev = true;
config.preview_urls = false;
config.secrets = { required: ['FIRE_ADMIN_PASSWORD_HASH', 'FIRE_SESSION_SECRET'] };
config.d1_databases = [{ binding: "DB", database_name: databaseName, database_id: databaseId }];
config.r2_buckets = bucket ? [{ binding: "BUCKET", bucket_name: bucket }] : [];

await writeFile(destinationPath, JSON.stringify(config, null, 2) + "\n", { flag: 'wx', mode: 0o600 });
console.log("Wrote isolated staging configuration to dist/server/wrangler.independent.json");
