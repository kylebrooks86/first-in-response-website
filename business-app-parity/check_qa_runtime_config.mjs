/** Read-only fail-closed proof that a built QA Worker cannot bind existing resources.
 * This does not publish, create D1 tables, authenticate an owner, or grant deployment approval.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const filename=process.argv[2];
if(!filename)throw Error("Built QA Wrangler manifest path required");
const cfg=JSON.parse(readFileSync(filename,"utf8"));
const name="fire-fullapp-qa-20261016";
const db="fire-fullapp-qa-db-20261016";
const id="8ccfb1f8-1657-4074-b1b2-47de78f95003";
assert.equal(cfg.name,name,"Only the new QA Worker name is permitted");
assert.deepEqual(cfg.d1_databases,[{binding:"DB",database_name:db,database_id:id}],
  "Built QA must bind exactly ONE newly created D1, via app's DB binding");
assert.equal(cfg.workers_dev,true,"QA should not use existing custom routes");
assert.ok(!cfg.routes?.length && !cfg.route && !cfg.zone_id && !cfg.account_id,
  "QA build must not target existing routing, zones or foreign accounts");
// Wrangler may emit default empty objects and empty nested queues/DO arrays.
// Accept only recursively EMPTY resource settings. A single actual binding,
 // class, consumer or script is a hard failure.
function isEmpty(value) {
  if(value===null || value===undefined || value==="") return true;
  if(Array.isArray(value)) return value.length===0;
  return typeof value==="object" && Object.values(value).every(isEmpty);
}
for(const field of ["r2_buckets","kv_namespaces","durable_objects","services","queues","ai","unsafe","dispatch_namespaces"]){
  assert.ok(isEmpty(cfg[field]),"Unapproved QA resource binding or nonempty metadata in: "+field);
}
const vars=cfg.vars??{};
assert.equal(vars.FIRE_ENV,"synthetic-qa");
assert.equal(vars.FIRE_QA_SYNTHETIC_ONLY,"enabled");
assert.equal(typeof vars.SITE_ORIGIN,"string");
assert.ok(!vars.SITE_ORIGIN || /^https:\/\/fire-fullapp-qa-20261016\.[a-z0-9-]+\.workers\.dev$/.test(vars.SITE_ORIGIN),
  "QA SITE_ORIGIN must be empty (fail-closed in CI) or the exact future QA origin");
assert.ok(!Object.keys(vars).some(k=>/(stripe|r2|live|staging|doomsday|password|secret|token|private)/i.test(k)),
  "No credentials or privileged resource identities may be in published QA vars");
assert.ok(!("site-creator"===cfg.name),"Not the default build");
console.log(JSON.stringify({identityVerified:true,name:cfg.name,dbName:db,dbId:id,
  originConfigured:Boolean(vars.SITE_ORIGIN),r2Configured:false,stripeConfigured:false,
  remoteD1WritesPerformed:false,publicationAuthorized:false,acceptedGateCount:3}));
