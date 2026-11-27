/** Read-only QA Worker built-config review (no deploy, D1 writes or login).
 * Accept only the explicit optional source flags already guarded in
 * adapters/qa/vite.config.ts; never infer Cloudflare Access or D1 approval.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const name="fire-fullapp-qa-20261016";
const db="fire-fullapp-qa-db-20261016";
const id="8ccfb1f8-1657-4074-b1b2-47de78f95003";
const origin="https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev";
const loginSecrets=["FIRE_QA_PASSWORD_HASH", "FIRE_QA_SESSION_SECRET"];
const quickSecrets=[...loginSecrets,"FIRE_QA_PIN_HASH","FIRE_QA_PIN_PEPPER"];
const reviewedOptionalR2=[{binding:"BUCKET",bucket_name:"fire-fullapp-qa-photos-20261023"}];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function isEmpty(value) {
  if(value===null || value===undefined || value==="") return true;
  if(Array.isArray(value)) return value.length===0;
  return typeof value==="object" && Object.values(value).every(isEmpty);
}

export function verify(cfg) {
  assert.ok(cfg && typeof cfg==="object" && !Array.isArray(cfg),
    "Compiled QA Worker manifest required");
  assert.equal(cfg.name,name,"Only the new QA Worker name is permitted");
  assert.deepEqual(cfg.d1_databases,[{binding:"DB",database_name:db,database_id:id}],
    "Built QA must bind exactly ONE already-reviewed synthetic QA D1");
  assert.equal(cfg.workers_dev,true,"QA should not use existing custom routes");
  assert.ok(!cfg.env,"No extra named Cloudflare environment override");

  // Historical source builds may carry the exact reviewed, unused legacy
  // photo placeholder. The separately approved deployment preparer MUST strip
  // it; a compiled R2 placeholder never proves an R2 subscription or binding.
  assert.ok(cfg.r2_buckets===undefined||Array.isArray(cfg.r2_buckets),
    "Invalid compiled QA R2 declaration");
  const hasCompiledLegacyR2=(cfg.r2_buckets?.length??0)>0;
  assert.deepEqual(cfg.r2_buckets??[],
    hasCompiledLegacyR2?reviewedOptionalR2:[],
    "No new R2 or paid storage binding is permitted");

  assert.ok(cfg.vars && typeof cfg.vars==="object" && !Array.isArray(cfg.vars),
    "QA vars object required");
  const vars=cfg.vars;
  assert.equal(vars.FIRE_ENV,"synthetic-qa");
  assert.equal(vars.FIRE_QA_SYNTHETIC_ONLY,"enabled");
  assert.equal(vars.FIRE_LOCAL_CUSTOMERS_CANDIDATE,"synthetic-only",
    "Only the approved synthetic-only customer mode permitted");
  assert.equal(vars.SITE_ORIGIN,origin,
    "QA origin must match previously owner-reviewed workers.dev origin");
  const numbering=own(vars,"FIRE_JOB_NUMBERS_CANDIDATE");
  const quick=own(vars,"FIRE_QUICK_AUTH_MODE");
  if(numbering)assert.equal(vars.FIRE_JOB_NUMBERS_CANDIDATE,
    "owner-approved-schema-v1","Wrong source-only permanent Job # request");
  if(quick) {
    assert.equal(vars.FIRE_QUICK_AUTH_MODE,"passkey-or-pin-v1",
      "Wrong source-only PIN/passkey request");
    assert.ok(typeof vars.FIRE_ACCESS_TEAM_DOMAIN==="string" &&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(vars.FIRE_ACCESS_TEAM_DOMAIN),
      "Quick auth requires exact-format Access team");
    assert.ok(typeof vars.FIRE_ACCESS_AUDIENCE==="string" &&
      vars.FIRE_ACCESS_AUDIENCE.length>=12 && vars.FIRE_ACCESS_AUDIENCE.length<=256,
      "Quick auth requires bounded Access audience");
    assert.ok(typeof vars.FIRE_ACCESS_OWNER_EMAIL==="string" &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vars.FIRE_ACCESS_OWNER_EMAIL),
      "Quick auth requires bounded owner identity");
  }
  // Prevent hidden Stripe/production/customer secrets from being smuggled in
  // as plaintext Worker vars while allowing only reviewed opt-in names.
  const allowed=["FIRE_ENV","FIRE_QA_SYNTHETIC_ONLY",
    "FIRE_LOCAL_CUSTOMERS_CANDIDATE","SITE_ORIGIN",
    ...(numbering?["FIRE_JOB_NUMBERS_CANDIDATE"]:[]),
    ...(quick?["FIRE_QUICK_AUTH_MODE","FIRE_ACCESS_TEAM_DOMAIN",
      "FIRE_ACCESS_AUDIENCE","FIRE_ACCESS_OWNER_EMAIL"]:[])];
  assert.deepEqual(Object.keys(vars).sort(),allowed.sort(),
    "Unknown QA Worker var or unreviewed feature flag");
  assert.deepEqual(cfg.secrets?.required,quick?quickSecrets:loginSecrets,
    "Required private QA login and PIN/pepper names must match exact mode");
  assert.ok(!cfg.secrets || Object.keys(cfg.secrets).every(k=>k==="required"),
    "Unexpected QA secret configuration");
  assert.ok(!cfg.routes?.length && !cfg.route && !cfg.zone_id && !cfg.account_id &&
    isEmpty(cfg.triggers),"QA cannot target custom routing, zones or foreign accounts");
  for(const field of ["kv_namespaces","durable_objects","services","queues","ai",
    "unsafe","dispatch_namespaces","analytics_engine_datasets","send_email",
    "pipelines","browser","workflows","hyperdrive","tail_consumers","migrations"]){
    assert.ok(isEmpty(cfg[field]),"Unapproved QA resource binding: "+field);
  }
  return {
    identityVerified:true,name:cfg.name,dbName:db,dbId:id,
    originConfigured:true,
    sourceJobNumberModeRequested:numbering,
    sourceQuickAuthModeRequested:quick,
    jobNumbersPhysicalD1ProofVerified:false,
    quickAuthAccessAndOwnerApproved:false,
    legacyCompiledR2PlaceholderPresent:hasCompiledLegacyR2,
    r2Required:false,r2Configured:false,r2RemoteVerified:false,
    r2BindingRemovedBeforeApprovedDeploy:true,stripeConfigured:false,
    remoteD1WritesPerformed:false,publicationAuthorized:false,
    gateAcceptanceAsserted:false
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const filename=process.argv[2];
  if(!filename)throw Error("Built QA Wrangler manifest path required");
  const result=verify(JSON.parse(readFileSync(filename,"utf8")));
  console.log(JSON.stringify(result));
}
