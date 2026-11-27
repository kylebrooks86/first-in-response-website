// SOURCE REVIEW ONLY. Do not use this object as a deployable wrangler config.
// Runtime provider facts (Access, DB and secrets) must be confirmed independently.
const WORKER='fire-stripe-test-20261101';
const D1_NAME='fire-stripe-test-db-20261101';
const D1_ID='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const REQUIRED_SECRET_NAMES=['FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN'];
const privateOnlyProps=['r2_buckets','kv_namespaces','services','durable_objects','queues','unsafe','account_id','zone_id'];
function assertOK(condition,reason){if(!condition)throw Error('FIRE TEST APP DEPLOY BLOCKED: '+reason)}
export function validateTestAppIdentity(config){
 assertOK(config && typeof config==='object' && !Array.isArray(config),'Config required');
 assertOK(config.worker===WORKER,'Unexpected Worker');
 assertOK(config.origin===ORIGIN,'Unexpected Access-protected origin');
 assertOK(config.productionUrlEnabled===true && config.previewUrlsEnabled===false,'Only pre-protected production workers.dev URL allowed');
 assertOK(config.existingAccessOwnerOnlyVerified===true,'Cloudflare owner-only Access must be verified separately');
 assertOK(config.fullAppDeploymentApproved===false,'This is a source-only review, not an authorization');
 assertOK(config.d1?.binding==='DB'&&config.d1?.name===D1_NAME&&config.d1?.uuid===D1_ID,'Exact isolated physical D1 required');
 assertOK(config.d1?.migrationsApplied===25,'Existing remote D1 migration receipt required: do NOT rerun');
 assertOK(config.vars && Object.keys(config.vars).sort().join(',')==='FIRE_ACCESS_REQUIRED,FIRE_ENV,FIRE_STRIPE_MODE,SITE_ORIGIN','Four required nonsecret vars only');
 assertOK(config.vars.FIRE_ENV==='cloudflare-staging' && config.vars.FIRE_ACCESS_REQUIRED==='enabled' && config.vars.FIRE_STRIPE_MODE==='disabled' && config.vars.SITE_ORIGIN===ORIGIN,'Fail-closed runtime env required');
 assertOK(Array.isArray(config.secretNames) && config.secretNames.slice().sort().join(',')===REQUIRED_SECRET_NAMES.join(','),'Three existing Access secret names; never commit values');
 assertOK(config.photos==='disabled-no-r2-binding'&&config.payments==='disabled-no-stripe-secrets','No paid photos or Stripe');
 for(const key of privateOnlyProps)assertOK(!Object.hasOwn(config,key),'Unexpected resource '+key);
 assertOK(config.routes.length===0&&config.customDomains.length===0,'Never add domains/routes for TEST');
 return {status:'SOURCE_MAPPING_OK_NOT_DEPLOYED',worker:WORKER,origin:ORIGIN,database:D1_NAME,
   appDeployed:false,ownerJWTVerifiedInApp:false,photosEnabled:false,stripeEnabled:false,
   hostBindingsVerified:false,billingAssured:false};
}
export const PROPOSED_TEST_MAPPING=Object.freeze({
 worker:WORKER,origin:ORIGIN,productionUrlEnabled:true,previewUrlsEnabled:false,
 existingAccessOwnerOnlyVerified:true,fullAppDeploymentApproved:false,
 d1:{binding:'DB',name:D1_NAME,uuid:D1_ID,migrationsApplied:25},
 vars:{FIRE_ENV:'cloudflare-staging',FIRE_ACCESS_REQUIRED:'enabled',FIRE_STRIPE_MODE:'disabled',SITE_ORIGIN:ORIGIN},
 secretNames:REQUIRED_SECRET_NAMES,
 photos:'disabled-no-r2-binding',payments:'disabled-no-stripe-secrets',
 routes:[],customDomains:[]
});
