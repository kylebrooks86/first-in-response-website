// Isolated CLI integration test: local Wrangler D1 + R2, synthetic fixture only.
// Deliberately contains NO --remote, deploy, or production identifiers.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const config = resolve(root, "dist/server/wrangler.independent.json");
const expected = {
  worker: "fire-app-ci-synthetic-do-not-deploy",
  database: "fire-app-ci-synthetic-no-database",
  bucket: "fire-app-ci-synthetic-no-bucket",
  id: "12345678-1234-4234-8234-123456789abc",
};
const parsed = JSON.parse(await readFile(config, "utf8"));
assert.equal(parsed.name, expected.worker, "Local integration requires CI-only synthetic Worker config");
assert.equal(parsed.d1_databases?.[0]?.database_name, expected.database);
assert.equal(parsed.d1_databases?.[0]?.database_id, expected.id);
assert.equal(parsed.r2_buckets?.[0]?.bucket_name, expected.bucket);
assert.equal(parsed.d1_databases?.[0]?.binding, "DB");
assert.equal(parsed.r2_buckets?.[0]?.binding, "BUCKET");

const temp = await mkdtemp(join(tmpdir(), "fire-photo-local-ci-"));
const persist = join(temp, "wrangler-state");
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
const restoreScript = resolve(root, "scripts/restore-photo-archive.mjs");
const base = ["--config", config, "--local", "--persist-to", persist];

function exec(binary, args, { cwd = root, expectFailure = false } = {}) {
  const output = spawnSync(binary, args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const combined = String(output.stdout || "") + "\n" + String(output.stderr || "");
  if (output.error) throw output.error;
  if (expectFailure ? output.status === 0 : output.status !== 0) {
    throw new Error(`Unexpected command status ${output.status}: ${binary} ${args.join(" ")}\n${combined}`);
  }
  return combined;
}
const wr = (args, options) => exec(process.execPath, [wrangler, ...args], options);
const restore = (archive, apply = false, options = {}) =>
  exec(process.execPath, [restoreScript, "--archive", archive, ...base, ...(apply ? ["--apply"] : [])], options);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9VLMTaoAAAAASUVORK5CYII=", "base64");
const customerId = "customer-ci-0001";
const createdAt = "2026-10-14T00:00:00.000Z";
function photo(id) {
  return {
    id, customerId, category: "before", caption: "Synthetic photo only",
    filename: "synthetic.png", contentType: "image/png", sizeBytes: pixel.length,
    objectKey: `customers/${customerId}/${id}.png`, createdAt,
  };
}
async function makeArchive(name, photos) {
  const dir = join(temp, name);
  await mkdir(dir, { recursive: true });
  const entries = [];
  for (const p of photos) {
    const relative = `photos/${p.customerId}/${p.id}-synthetic.png`;
    const full = join(dir, relative);
    await mkdir(join(dir, "photos", p.customerId), { recursive: true });
    await writeFile(full, pixel);
    entries.push(relative);
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    format: "fire-app-photo-archive", version: 1, photoCount: photos.length,
    missingPhotoIds: [], photos,
  }));
  const zip = join(temp, name + ".zip");
  exec("zip", ["-q", "-0", zip, "manifest.json", ...entries], { cwd: dir });
  return zip;
}

try {
  const { readdirSync, readFileSync } = await import("node:fs");
  const migrationDir = join(root, "drizzle");
  const migrationFiles = readdirSync(migrationDir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.ok(migrationFiles.length >= 20, "Expected full FIRE migration set");
  const sql = migrationFiles.map((file) => readFileSync(join(migrationDir, file), "utf8")).join("\n");
  const migrationPath = join(temp, "synthetic-schema.sql");
  await writeFile(migrationPath, sql);
  wr(["d1", "execute", "DB", ...base, "--yes", "--file", migrationPath]);
  wr(["d1", "execute", "DB", ...base, "--yes", "--command",
    `INSERT INTO customers (id,name,created_at) VALUES ('${customerId}','Synthetic CI Customer','${createdAt}')`]);

  const first = photo("photo-ci-0001");
  const archive = await makeArchive("success", [first]);
  const dry = restore(archive);
  assert.match(dry, /Dry run complete/);
  assert.match(dry, /"restore": 1/);
  const applied = restore(archive, true);
  assert.match(applied, /Restored and verified photo-ci-0001/);

  const queried = wr(["d1", "execute", "DB", ...base, "--json", "--command",
    `SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,object_key AS objectKey,created_at AS createdAt FROM customer_photos WHERE id='${first.id}'`]);
  const rows = JSON.parse(queried)[0]?.results;
  assert.equal(rows?.length, 1);
  for (const key of Object.keys(first)) assert.equal(rows[0][key], first[key], `Mismatch for ${key}`);
  const downloaded = join(temp, "verified.png");
  wr(["r2", "object", "get", `${expected.bucket}/${first.objectKey}`, ...base, "--file", downloaded]);
  assert.equal(hash(await readFile(downloaded)), hash(pixel), "Recovered R2 bytes differ");
  assert.match(restore(archive), /"skip_existing_record": 1/);

  // Preflight must refuse the entire batch if any later key already exists:
  // the first new photo must NEVER be uploaded in that scenario.
  const unoccupied = photo("photo-ci-0002");
  const occupied = photo("photo-ci-0003");
  const conflictArchive = await makeArchive("conflict", [unoccupied, occupied]);
  const seedFile = join(temp, "occupied.png");
  await writeFile(seedFile, pixel);
  wr(["r2", "object", "put", `${expected.bucket}/${occupied.objectKey}`, ...base,
    "--file", seedFile, "--content-type", "image/png"]);
  assert.match(restore(conflictArchive, true, { expectFailure: true }), /No uploads have started/);
  const missing = wr(["r2", "object", "get", `${expected.bucket}/${unoccupied.objectKey}`, ...base,
    "--file", join(temp, "should-not-exist.png")], { expectFailure: true });
  assert.ok(missing.length > 0);
  const check = wr(["d1", "execute", "DB", ...base, "--json", "--command",
    `SELECT COUNT(*) AS count FROM customer_photos WHERE id IN ('${unoccupied.id}','${occupied.id}')`]);
  assert.equal(Number(JSON.parse(check)[0]?.results?.[0]?.count), 0);

  console.log("PASS: synthetic local D1/R2 photo restore, dry-run, metadata/bytes, idempotence, occupied-key preflight, zero partial writes");
} finally {
  await rm(temp, { recursive: true, force: true });
}
