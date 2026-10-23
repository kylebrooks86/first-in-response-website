/** Strict owner-opted-in, NO-R2 deployment manifest for the EXISTING synthetic QA Worker.
 * Start with the fully verified compiled QA build. Change exactly TWO properties:
 * remove Cloudflare's default legacy_env=true and the dedicated QA-only R2
 * binding. Never edit the original build or remotely deploy/create anything.
 * This is separate from the existing R2-required profile, not an implicit fallback.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { prepare } from "./prepare_qa_deploy_config.mjs";

const QA_R2 = [{ binding: "BUCKET", bucket_name: "fire-fullapp-qa-photos-20261023" }];
const QA_DB = [{ binding:"DB", database_name:"fire-fullapp-qa-db-20261016",
  database_id:"8ccfb1f8-1657-4074-b1b2-47de78f95003" }];

export function prepareNoR2(originalFile, destinationFile) {
  const original = resolve(originalFile);
  const destination = resolve(destinationFile);
  assert.equal(basename(original), "wrangler.json", "Must use compiled QA manifest");
  assert.equal(dirname(original), dirname(destination), "Must preserve original compiled asset paths");
  assert.match(basename(destination), /^wrangler\\.fire-qa-no-r2-[a-f0-9-]{36}\\.json$/,
    "Unique opt-in QA no-R2 output name required");
  assert.ok(!existsSync(destination), "Existing destination must never be overwritten");
  const sourceText = readFileSync(original, "utf8");
  const source = JSON.parse(sourceText);
  // The original strict profile validates worker, D1, secrets, allowed QA vars,
  // the one dedicated R2 bucket and no foreign resource. No broad rewrites.
  assert.deepEqual(source.r2_buckets, QA_R2, "Exact dedicated QA R2 is required in SOURCE");
  const temporary = resolve(dirname(original), "wrangler.fire-qa-firstpublish-"+randomUUID()+".json");
  try {
    prepare(original, temporary);
    const validated = JSON.parse(readFileSync(temporary, "utf8"));
    assert.deepEqual(validated.r2_buckets, QA_R2, "Unexpected intermediate photo storage");
    assert.deepEqual(validated.d1_databases, QA_DB, "Only the existing QA D1 is permitted");
    assert.equal(validated.name, "fire-fullapp-qa-20261016");
    assert.equal(validated.workers_dev, true);
    assert.deepEqual(validated.secrets?.required,
      ["FIRE_QA_PASSWORD_HASH", "FIRE_QA_SESSION_SECRET"]);
    assert.equal(validated.vars?.FIRE_QA_SYNTHETIC_ONLY, "enabled");
    assert.equal(validated.vars?.FIRE_LOCAL_CUSTOMERS_CANDIDATE, "synthetic-only");
    assert.equal(validated.vars?.SITE_ORIGIN,
      "https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev");
    // Explicitly reject any other photo or billed storage binding.
    delete validated.r2_buckets;
    assert.ok(!Object.hasOwn(validated, "r2_buckets"),
      "No R2 bucket may be present in the NO-R2 manifest");
    const expected = {...source};
    delete expected.legacy_env;
    delete expected.r2_buckets;
    assert.deepEqual(validated, expected,
      "No-R2 manifest must change ONLY legacy_env and the QA R2 binding");
    // Exclusive creation and full byte-level verification; never overwrite.
    writeFileSync(destination, JSON.stringify(validated, null, 2)+"\\n",
      {flag:"wx", mode:0o600});
    try {
      assert.deepEqual(JSON.parse(readFileSync(destination,"utf8")), expected);
      assert.equal(readFileSync(original,"utf8"), sourceText, "Compiled QA build mutated");
    } catch(error) { unlinkSync(destination); throw error; }
    return {name:validated.name, noR2:true, destination};
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 4,
    "Usage: node prepare_qa_no_r2_deploy_config.mjs <dist/server/wrangler.json> <dist/server/wrangler.fire-qa-no-r2-UUID.json>");
  const result=prepareNoR2(process.argv[2],process.argv[3]);
  console.log("PASS: Prepared STRICT existing-QA NO-R2 local manifest: "+result.name);
  console.log("NO REMOTE CHANGE. On-device photos only; no auto-sync; no R2 billing or bucket.");
}
