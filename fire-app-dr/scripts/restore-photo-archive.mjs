import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const valueAfter = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const has = (name) => args.includes(name);
const archive = valueAfter("--archive");
const configPath = valueAfter("--config") || "dist/server/wrangler.independent.json";
const apply = has("--apply");
const local = has("--local");
const remote = has("--remote");
const persistTo = valueAfter("--persist-to") || ".wrangler/state";

if (!archive || local === remote) {
  console.error("Usage: npm run restore:photos -- --archive <zip> (--local | --remote) [--config <path>] [--persist-to <path>] [--apply] [--confirm-bucket <name>]");
  process.exit(1);
}

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const absoluteArchive = resolve(archive);
const absoluteConfig = resolve(configPath);
const config = JSON.parse(await readFile(absoluteConfig, "utf8"));
const bucket = config.r2_buckets?.find((item) => item.binding === "BUCKET")?.bucket_name;
const database = config.d1_databases?.find((item) => item.binding === "DB");

if (!bucket || !database?.database_id || database.database_id === "00000000-0000-4000-8000-000000000000") {
  console.error("The independent Wrangler configuration must contain non-placeholder DB and BUCKET resources.");
  process.exit(1);
}
if (remote && apply && valueAfter("--confirm-bucket") !== bucket) {
  console.error(`Remote apply requires --confirm-bucket ${bucket}`);
  process.exit(1);
}

const wrangler = resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const modeArgs = local ? ["--local", "--persist-to", persistTo] : ["--remote"];

function run(commandArgs, options = {}) {
  return spawnSync(process.execPath, [wrangler, ...commandArgs], {
    cwd: projectRoot,
    encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    input: options.input,
  });
}

function unzip(commandArgs, options = {}) {
  return spawnSync("unzip", commandArgs, { encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function fail(result, context) {
  const detail = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  throw new Error(`${context}${detail ? `\n${detail}` : ""}`);
}

function sql(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Archive contains a non-finite number.");
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

const archiveStat = await stat(absoluteArchive).catch(() => null);
if (!archiveStat?.isFile()) throw new Error(`Photo archive not found: ${absoluteArchive}`);

const listResult = unzip(["-Z1", absoluteArchive]);
if (listResult.status !== 0) fail(listResult, "The ZIP archive could not be listed.");
const entries = String(listResult.stdout).split(/\r?\n/).filter(Boolean);
if (!entries.includes("manifest.json")) throw new Error("The ZIP archive does not contain manifest.json.");

const manifestResult = unzip(["-p", absoluteArchive, "manifest.json"]);
if (manifestResult.status !== 0) fail(manifestResult, "manifest.json could not be read.");
const manifest = JSON.parse(String(manifestResult.stdout));
if (manifest?.format !== "fire-app-photo-archive" || manifest?.version !== 1 || !Array.isArray(manifest.photos)) {
  throw new Error("This is not a valid FIRE App photo archive.");
}
const rawMissingPhotoIds=Array.isArray(manifest.missingPhotoIds)?manifest.missingPhotoIds.map((value)=>String(value)):[];
const missingPhotoIds=new Set(rawMissingPhotoIds);
const manifestPhotoIdList=manifest.photos.map((candidate)=>String(candidate?.id||""));
const manifestPhotoIds=new Set(manifestPhotoIdList);
const manifestObjectKeys=manifest.photos.map((candidate)=>String(candidate?.objectKey||""));
if(manifestPhotoIds.size!==manifestPhotoIdList.length)throw new Error("Photo archive contains duplicate photo IDs.");
if(new Set(manifestObjectKeys).size!==manifestObjectKeys.length)throw new Error("Photo archive contains duplicate object keys.");
if(missingPhotoIds.size!==rawMissingPhotoIds.length||[...missingPhotoIds].some((id)=>!manifestPhotoIds.has(id)))
  throw new Error("Photo archive missing-photo metadata is inconsistent.");
if(!Number.isSafeInteger(Number(manifest.photoCount))||Number(manifest.photoCount)!==manifest.photos.length-missingPhotoIds.size)
  throw new Error("Photo archive manifest counts are inconsistent.");

const stateResult = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--json", "--command", "SELECT id FROM customers; SELECT id,customer_id AS customerId,category,caption,filename,content_type AS contentType,size_bytes AS sizeBytes,object_key AS objectKey,created_at AS createdAt FROM customer_photos"]);
if (stateResult.status !== 0) fail(stateResult, "Could not inspect the target FIRE database.");
const state = JSON.parse(stateResult.stdout);
const customerIds = new Set((state[0]?.results || []).map((row) => String(row.id)));
const existingPhotos = new Map((state[1]?.results || []).map((row) => [String(row.id), row]));
const existingObjectOwners=new Map((state[1]?.results || []).map((row)=>[String(row.objectKey),String(row.id)]));
const plans = [];

for (const candidate of manifest.photos) {
  const photo = {
    id: String(candidate?.id || ""), customerId: String(candidate?.customerId || ""),
    category: String(candidate?.category || "property"), caption: candidate?.caption == null ? null : String(candidate.caption),
    filename: String(candidate?.filename || "photo.jpg"), contentType: String(candidate?.contentType || "application/octet-stream"),
    sizeBytes: Number(candidate?.sizeBytes), objectKey: String(candidate?.objectKey || ""), createdAt: String(candidate?.createdAt || ""),
  };
  if (!/^[a-zA-Z0-9-]{8,}$/.test(photo.id) || !/^[a-zA-Z0-9-]{8,}$/.test(photo.customerId)) throw new Error("Archive contains an invalid photo or customer ID.");
  if (!Number.isSafeInteger(photo.sizeBytes) || photo.sizeBytes < 0 || photo.sizeBytes > 20 * 1024 * 1024) throw new Error(`Photo ${photo.id} has an invalid size.`);
  if (!photo.contentType.startsWith("image/") || !["before", "after", "property"].includes(photo.category)) throw new Error(`Photo ${photo.id} has invalid metadata.`);
  if (!photo.objectKey.startsWith(`customers/${photo.customerId}/${photo.id}.`) || photo.objectKey.includes("..")) throw new Error(`Photo ${photo.id} has an unsafe object key.`);
  if (missingPhotoIds.has(photo.id)) { plans.push({ photo, action: "skip_missing_archive_object" }); continue; }
  if (!customerIds.has(photo.customerId)) { plans.push({ photo, action: "skip_missing_customer" }); continue; }
  const objectOwner=existingObjectOwners.get(photo.objectKey);
  if(objectOwner&&objectOwner!==photo.id)throw new Error(`Photo object key ${photo.objectKey} already belongs to target photo ${objectOwner}.`);
  if (existingPhotos.has(photo.id)) {
    const existing=existingPhotos.get(photo.id);
    const metadataMatches=
      String(existing.customerId)===photo.customerId&&String(existing.category)===photo.category&&
      (existing.caption==null?null:String(existing.caption))===photo.caption&&String(existing.filename)===photo.filename&&
      String(existing.contentType)===photo.contentType&&Number(existing.sizeBytes)===photo.sizeBytes&&
      String(existing.objectKey)===photo.objectKey&&String(existing.createdAt)===photo.createdAt;
    if(!metadataMatches)throw new Error(`Photo ${photo.id} already exists with different metadata.`);
    plans.push({ photo, action: "skip_existing_record" }); continue;
  }
  const prefix = `photos/${photo.customerId}/${photo.id}-`;
  const matches = entries.filter((entry) => entry.startsWith(prefix));
  if (matches.length !== 1) throw new Error(`Photo ${photo.id} must have exactly one matching file in the archive.`);
  plans.push({ photo, entry: matches[0], action: "restore" });
}

const summary = plans.reduce((result, plan) => { result[plan.action] = (result[plan.action] || 0) + 1; return result; }, {});
console.log(JSON.stringify({ archive: basename(absoluteArchive), targetDatabase: database.database_name, targetBucket: bucket, mode: local ? "local" : "remote", apply, summary }, null, 2));
if (!apply) {
  console.log("Dry run complete. No database records or R2 objects were changed.");
  process.exit(0);
}

const work = await mkdtemp(`${tmpdir()}/fire-photo-restore-`);
let restored = 0;
let conflicts = 0;
try {
  for (const plan of plans) {
    if (plan.action !== "restore") continue;
    const { photo, entry } = plan;
    const existingPath = resolve(work, `${photo.id}-existing`);
    const existing = run(["r2", "object", "get", `${bucket}/${photo.objectKey}`, "--config", absoluteConfig, ...modeArgs, "--file", existingPath]);
    if (existing.status === 0) { conflicts += 1; console.warn(`Skipped ${photo.id}: an R2 object already exists at ${photo.objectKey}.`); continue; }
    const missingText = `${existing.stdout || ""}\n${existing.stderr || ""}`;
    if (!missingText.includes("specified key does not exist")) fail(existing, `Could not safely check R2 object ${photo.objectKey}.`);

    const extracted = unzip(["-p", absoluteArchive, entry], { encoding: null });
    if (extracted.status !== 0) fail(extracted, `Could not extract photo ${photo.id}.`);
    if (extracted.stdout.byteLength !== photo.sizeBytes) throw new Error(`Photo ${photo.id} size does not match its manifest.`);
    const photoPath = resolve(work, photo.id);
    await writeFile(photoPath, extracted.stdout);
    const upload = run(["r2", "object", "put", `${bucket}/${photo.objectKey}`, "--config", absoluteConfig, ...modeArgs, "--file", photoPath, "--content-type", photo.contentType, "--force"]);
    if (upload.status !== 0) fail(upload, `Could not upload photo ${photo.id}.`);

    const insert = `INSERT OR IGNORE INTO customer_photos (id,customer_id,category,caption,filename,content_type,size_bytes,object_key,created_at) VALUES (${sql(photo.id)},${sql(photo.customerId)},${sql(photo.category)},${sql(photo.caption)},${sql(photo.filename)},${sql(photo.contentType)},${sql(photo.sizeBytes)},${sql(photo.objectKey)},${sql(photo.createdAt)})`;
    const databaseWrite = run(["d1", "execute", "DB", "--config", absoluteConfig, ...modeArgs, "--yes", "--command", insert]);
    if (databaseWrite.status !== 0) {
      run(["r2","object","delete",`${bucket}/${photo.objectKey}`,"--config",absoluteConfig,...modeArgs]);
      fail(databaseWrite, `Photo ${photo.id} database metadata could not be restored; the just-uploaded object was removed.`);
    }
    const verifyRecord=run(["d1","execute","DB","--config",absoluteConfig,...modeArgs,"--json","--command",`SELECT customer_id AS customerId,object_key AS objectKey,size_bytes AS sizeBytes FROM customer_photos WHERE id=${sql(photo.id)} LIMIT 1`]);
    if(verifyRecord.status!==0){
      run(["r2","object","delete",`${bucket}/${photo.objectKey}`,"--config",absoluteConfig,...modeArgs]);
      fail(verifyRecord,`Photo ${photo.id} metadata verification failed; the just-uploaded object was removed.`);
    }
    const verifiedRows=JSON.parse(verifyRecord.stdout)[0]?.results||[];
    const verified=verifiedRows[0];
    if(!verified||String(verified.customerId)!==photo.customerId||String(verified.objectKey)!==photo.objectKey||Number(verified.sizeBytes)!==photo.sizeBytes){
      run(["r2","object","delete",`${bucket}/${photo.objectKey}`,"--config",absoluteConfig,...modeArgs]);
      throw new Error(`Photo ${photo.id} metadata does not match the archive; the just-uploaded object was removed.`);
    }
    restored += 1;
    console.log(`Restored and verified ${photo.id} (${photo.filename}).`);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}

console.log(JSON.stringify({ restored, conflicts, skipped: plans.length - restored - conflicts }, null, 2));
