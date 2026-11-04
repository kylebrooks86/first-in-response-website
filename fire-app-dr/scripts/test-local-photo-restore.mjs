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
async function makeArchive(name, photos, missingPhotoIds = []) {
  const dir = join(temp, name);
  await mkdir(dir, { recursive: true });
  const entries = [];
  for (const p of photos) {
    if (missingPhotoIds.includes(p.id)) continue;
    const relative = `photos/${p.customerId}/${p.id}-synthetic.png`;
    const full = join(dir, relative);
    await mkdir(join(dir, "photos", p.customerId), { recursive: true });
    await writeFile(full, pixel);
    entries.push(relative);
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    format: "fire-app-photo-archive", version: 1, photoCount: entries.length,
    missingPhotoIds, photos,
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

  // A matching D1 record without its R2 bytes must NOT be treated as restored.
  const missingR2 = photo("photo-ci-0004");
  const beforeMissing = photo("photo-ci-0005");
  const seedMetadata = (p) => wr(["d1", "execute", "DB", ...base, "--yes", "--command",
    `INSERT INTO customer_photos (id,customer_id,category,caption,filename,content_type,size_bytes,object_key,created_at) VALUES ('${p.id}','${p.customerId}','${p.category}','${p.caption}','${p.filename}','${p.contentType}',${p.sizeBytes},'${p.objectKey}','${p.createdAt}')`]);
  seedMetadata(missingR2);
  const missingR2Archive = await makeArchive("existing-without-r2", [beforeMissing, missingR2]);
  assert.match(restore(missingR2Archive, true, { expectFailure: true }), /no readable R2 image/);
  wr(["r2", "object", "get", `${expected.bucket}/${beforeMissing.objectKey}`, ...base,
    "--file", join(temp, "missing-r2-must-not-upload.png")], { expectFailure: true });

  // Existing R2 bytes that differ from the archive must stop the whole batch.
  const wrongBytes = photo("photo-ci-0006");
  const beforeWrongBytes = photo("photo-ci-0007");
  seedMetadata(wrongBytes);
  const differentPixel = Buffer.from(pixel);
  differentPixel[10] ^= 1;
  const differentFile = join(temp, "different-image.png");
  await writeFile(differentFile, differentPixel);
  wr(["r2", "object", "put", `${expected.bucket}/${wrongBytes.objectKey}`, ...base,
    "--file", differentFile, "--content-type", "image/png"]);
  const differentArchive = await makeArchive("existing-wrong-bytes", [beforeWrongBytes, wrongBytes]);
  assert.match(restore(differentArchive, true, { expectFailure: true }), /differs from the archive/);
  wr(["r2", "object", "get", `${expected.bucket}/${beforeWrongBytes.objectKey}`, ...base,
    "--file", join(temp, "wrong-bytes-must-not-upload.png")], { expectFailure: true });
  const stillDifferent = join(temp, "still-different.png");
  wr(["r2", "object", "get", `${expected.bucket}/${wrongBytes.objectKey}`, ...base, "--file", stillDifferent]);
  assert.equal(hash(await readFile(stillDifferent)), hash(differentPixel), "Existing R2 object was unexpectedly overwritten");

  // A later manifest size mismatch must not allow earlier bytes to be uploaded.
  const beforeBadSize = photo("photo-ci-0008");
  const invalidSize = { ...photo("photo-ci-0009"), sizeBytes: pixel.length + 1 };
  const invalidSizeArchive = await makeArchive("manifest-size-mismatch", [beforeBadSize, invalidSize]);
  assert.match(restore(invalidSizeArchive, true, { expectFailure: true }), /archive size differs from manifest/);
  wr(["r2", "object", "get", `${expected.bucket}/${beforeBadSize.objectKey}`, ...base,
    "--file", join(temp, "bad-size-must-not-upload.png")], { expectFailure: true });

  // Incomplete photo exports are not silently applied.
  const beforeMissingArchive = photo("photo-ci-0010");
  const missingArchived = photo("photo-ci-0011");
  const partial = await makeArchive("partial-export", [beforeMissingArchive, missingArchived], [missingArchived.id]);
  assert.match(restore(partial, true, { expectFailure: true }), /partial recovery is not automatic/);
  wr(["r2", "object", "get", `${expected.bucket}/${beforeMissingArchive.objectKey}`, ...base,
    "--file", join(temp, "partial-must-not-upload.png")], { expectFailure: true });

  // Missing destination customers must be restored before any photo writes.
  const beforeNoCustomer = photo("photo-ci-0012");
  const withoutCustomer = { ...photo("photo-ci-0013"), customerId: "customer-ci-missing",
    objectKey: "customers/customer-ci-missing/photo-ci-0013.png" };
  const missingCustomerArchive = await makeArchive("missing-customer", [beforeNoCustomer, withoutCustomer]);
  assert.match(restore(missingCustomerArchive, true, { expectFailure: true }), /customer records are absent/);
  wr(["r2", "object", "get", `${expected.bucket}/${beforeNoCustomer.objectKey}`, ...base,
    "--file", join(temp, "missing-customer-must-not-upload.png")], { expectFailure: true });

  const readCount = (ids) => {
    const values = ids.map((id) => `'${id}'`).join(",");
    const data = wr(["d1", "execute", "DB", ...base, "--json", "--command",
      `SELECT COUNT(*) AS count FROM customer_photos WHERE id IN (${values})`]);
    return Number(JSON.parse(data)[0]?.results?.[0]?.count);
  };
  assert.equal(readCount([beforeMissing.id, beforeWrongBytes.id, beforeBadSize.id, beforeMissingArchive.id, beforeNoCustomer.id]), 0,
    "Aborted synthetic batches left unexpected database records");
  console.log("PASS: synthetic local D1/R2 recovery; full metadata/bytes; idempotence; occupied, missing, mismatched R2; bad sizes; incomplete archives; missing customer; no partial writes");
} finally {
  await rm(temp, { recursive: true, force: true });
}
