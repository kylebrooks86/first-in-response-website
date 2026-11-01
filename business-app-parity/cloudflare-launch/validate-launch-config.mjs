// Offline review of proposed resource mappings. Never creates/updates any resource.
import {readFileSync} from "node:fs";
const KNOWN_DENIED_IDS=new Set([
  "8ccfb1f8-1657-4074-b1b2-47de78f95003", // existing synthetic QA
  "afb2c05a-d794-4a9a-b580-924ce01c26ad" // existing protected Doomsday staging
]);
function requireThat(ok,message){if(!ok)throw Error("FIRE LAUNCH BLOCKED: "+message);}
function checkEnvironment(name,e){
  requireThat(e&&typeof e==="object"&&e.name==="fire-business-app-"+name,"Exact independent Worker name");
  requireThat(e.workers_dev===false,"Do not open unprotected workers.dev origins");
  const vars=e.vars||{};
  requireThat(vars.FIRE_ENV==="cloudflare-"+name&&vars.FIRE_ACCESS_REQUIRED==="enabled","Access gate and exact environment required");
  requireThat(vars.FIRE_STRIPE_MODE==="disabled","No Stripe until separate isolated test approval");
  requireThat(!Object.keys(vars).some(k=>/PASSWORD|TOKEN|KEY|SECRET|EMAIL|AUD|TEAM_DOMAIN|QA_SYNTHETIC/i.test(k)),"No credential/owner identity in plaintext vars");
  requireThat(Array.isArray(e.d1_databases)&&e.d1_databases.length===1&&e.d1_databases[0].binding==="DB","Exactly one D1");
  const db=e.d1_databases[0];
  requireThat(typeof db.database_name==="string"&&/^fire-business-app-(staging|production)-db-[a-z0-9-]+$/.test(db.database_name)&&db.database_name.includes(name),"New environment-specific D1 name");
  requireThat(typeof db.database_id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(db.database_id)&&!KNOWN_DENIED_IDS.has(db.database_id),"Physical provider D1 UUID, not a known QA/DR database");
  requireThat(Array.isArray(e.routes)&&e.routes.length===1&&typeof e.routes[0]==="object"&&e.routes[0].custom_domain===true,"One owner-approved Access-protected custom domain route");
  let origin;
  try{origin=new URL(vars.SITE_ORIGIN)}catch{throw Error("FIRE LAUNCH BLOCKED: Invalid SITE_ORIGIN");}
  requireThat(origin.protocol==="https:"&&origin.origin===vars.SITE_ORIGIN&&origin.hostname===e.routes[0].pattern
    &&!origin.hostname.endsWith(".chatgpt.site")&&!origin.hostname.endsWith(".workers.dev")
    &&!origin.hostname.endsWith(".invalid"),"Verified owner-controlled HTTPS Access route");
  requireThat(JSON.stringify(e.secrets?.required)===JSON.stringify(["FIRE_ACCESS_TEAM_DOMAIN","FIRE_ACCESS_AUD","FIRE_ACCESS_OWNER_EMAIL"]),"Separate Access secrets must be declared");
  for(const forbidden of ["r2_buckets","services","kv_namespaces","unsafe","queues","durable_objects","account_id","zone_id"]){
    requireThat(!Object.hasOwn(e,forbidden),"No inherited or unknown "+forbidden+" resource");
  }
  return {worker:e.name,origin:vars.SITE_ORIGIN,dbName:db.database_name,dbId:db.database_id};
}
export function validateLaunchMapping(cfg) {
  requireThat(cfg&&cfg.name==="fire-business-app-isolated"&&cfg.workers_dev===false,"Independent launch project");
  requireThat(cfg.env&&Object.keys(cfg.env).sort().join(",")==="production,staging","Exactly two explicitly configured environments");
  const staging=checkEnvironment("staging",cfg.env.staging);
  const production=checkEnvironment("production",cfg.env.production);
  requireThat(staging.dbId!==production.dbId&&staging.dbName!==production.dbName&&staging.origin!==production.origin,"Physical DB, origin and name isolation");
  return {status:"MAPPING_READY_FOR_PROVIDER_REVIEW",staging,production,
    providerAttested:false,accessPolicyVerified:false,backupVerified:false,
    databaseMigrated:false,stripeVerified:false,publicationAuthorized:false};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
  requireThat(process.argv.length===3,"Pass one private candidate config file");
  const report=validateLaunchMapping(JSON.parse(readFileSync(process.argv[2],"utf8")));
  console.log(JSON.stringify(report,null,2));
}
