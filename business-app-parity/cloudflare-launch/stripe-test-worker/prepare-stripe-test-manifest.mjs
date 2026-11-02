// SOURCE-PREPARATION ONLY: synthesize ONE exact TEST app config from Vite's
// compiled local placeholder. NEVER deploy, contact Cloudflare, or overwrite
// the generated Vite config. CI deletes both compiled input and review output.
// Host Access and three existing secrets must be independently verified.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateTestAppIdentity,PROPOSED_TEST_MAPPING} from './test-app-identity-contract.mjs';

const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
// Cloudflare's Vite output includes empty config defaults for nearly every
// Worker binding. Explicitly reject nonempty versions and remove them from
// the review config: an empty default is NOT permission to add that resource.
const EMPTY_BINDING_ARRAYS=[
 'ai_search','ai_search_namespaces','analytics_engine_datasets','artifacts',
 'dispatch_namespaces','flagship','hyperdrive','kv_namespaces','migrations',
 'mtls_certificates','pipelines','ratelimits','secrets_store_secrets',
 'send_email','services','unsafe_hello_world','vectorize','vpc_networks',
 'vpc_services','worker_loaders','workflows'
];
const EMPTY_BINDING_OBJECTS={
 cloudchamber:[],define:[],durable_objects:['bindings'],
 logfwdr:['bindings'],queues:['consumers','producers']
};
const BUILT_KEYS=[
 'name','topLevelName','main','compatibility_date','compatibility_flags',
 'd1_databases','r2_buckets','vars','assets','workers_dev','preview_urls',
 'routes','observability','rules','triggers','upload_source_maps',
 'legacy_env','no_bundle','jsx_factory','jsx_fragment','build','dev','python_modules'
];
const ALLOWED_KEYS=new Set([...BUILT_KEYS,...EMPTY_BINDING_ARRAYS,...Object.keys(EMPTY_BINDING_OBJECTS)]);
function insist(ok,msg){if(!ok)throw Error('FIRE TEST BUILD BLOCKED: '+msg);}
function isObject(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function noHiddenTokens(x){return !/(?:sk|rk|rkcs)_(?:live|test)_|whsec_|cf_access_token|CLOUDFLARE_API_TOKEN/i.test(JSON.stringify(x));}

export function prepareStripeTestManifest(generated){
  const mapping=validateTestAppIdentity(PROPOSED_TEST_MAPPING);
  insist(mapping.status==='SOURCE_MAPPING_OK_NOT_DEPLOYED','Source mapping must stay review-only');
  insist(isObject(generated),'Generated Vite manifest must be an object');
  const unknownKeys=Object.keys(generated).filter(key=>!ALLOWED_KEYS.has(key));
  const typeSummary=(value)=>Array.isArray(value)?'array('+value.length+')':
    value===null?'null':typeof value==='object'?
    'object('+Object.keys(value).sort().join('|')+')':
    typeof value==='boolean'?'boolean('+value+')':typeof value;
  insist(unknownKeys.length===0,'Unexpected Vite config keys/shapes: '+unknownKeys.sort()
    .map(k=>k+'='+typeSummary(generated[k])).join(','));
  for(const key of ['account_id','zone_id','route','env','unsafe','browser','images','ai','containers','logpush']){
    insist(!Object.hasOwn(generated,key),'Forbidden inherited provider control: '+key);
  }
  for(const key of EMPTY_BINDING_ARRAYS){
    if(Object.hasOwn(generated,key))
      insist(Array.isArray(generated[key])&&generated[key].length===0,
        'Unapproved inherited nonempty binding: '+key);
  }
  for(const [key,fields] of Object.entries(EMPTY_BINDING_OBJECTS)){
    if(!Object.hasOwn(generated,key))continue;
    const val=generated[key];
    insist(isObject(val)&&Object.keys(val).sort().join(',')===fields.slice().sort().join(',')&&
      fields.every(field=>Array.isArray(val[field])&&val[field].length===0),
      'Unapproved inherited nonempty object binding: '+key);
  }
  // Vite's default Python source exclusion globs are build metadata, not
  // Worker module bindings. Discard only this narrowly shaped field.
  if(Object.hasOwn(generated,'python_modules')){
    const x=generated.python_modules;
    insist(isObject(x)&&Object.keys(x).join(',')==='exclude'&&
      Array.isArray(x.exclude)&&x.exclude.length<=64&&
      x.exclude.every(v=>typeof v==='string'&&v.length<=256),
      'Unexpected Python module build exclusion');
  }
  insist(!Object.hasOwn(generated,'legacy_env')||generated.legacy_env===true,
    'Unexpected Wrangler legacy environment handling');
  insist(!Object.hasOwn(generated,'no_bundle')||generated.no_bundle===true,
    'Generated Vite bundling flag changed');
  insist(!Object.hasOwn(generated,'build')||isObject(generated.build)&&
    Object.keys(generated.build).join(',')==='watch_dir',
    'Unexpected provider build step');
  insist(!Object.hasOwn(generated,'dev')||isObject(generated.dev)&&
    Object.keys(generated.dev).sort().join(',')===
      'enable_containers,generate_types,ip,local_protocol,upstream_protocol',
    'Unexpected development configuration');
  insist(typeof generated.main==='string'&&generated.main.length>0&&
    !generated.main.includes('..')&&!generated.main.startsWith('/'),'Compiled Worker main must be relative');
  insist(typeof generated.compatibility_date==='string','Missing compatibility date');
  insist(Array.isArray(generated.d1_databases)&&generated.d1_databases.length===1,
    'Exactly one local placeholder D1 required');
  const db=generated.d1_databases[0];
  insist(isObject(db)&&Object.keys(db).sort().join(',')==='binding,database_id,database_name',
    'Unexpected local D1 fields');
  insist(db.binding==='DB'&&db.database_name==='fire-app-local'&&db.database_id===PLACEHOLDER,
    'Source D1 must be the known fake placeholder (never a real QA/LIVE database)');
  insist(Array.isArray(generated.r2_buckets)&&generated.r2_buckets.length===1,
    'Exactly one local-only bucket placeholder required');
  insist(generated.r2_buckets[0]?.binding==='BUCKET'&&
    generated.r2_buckets[0]?.bucket_name==='fire-app-local'&&
    Object.keys(generated.r2_buckets[0]).sort().join(',')==='binding,bucket_name',
    'Unrecognized local photo binding; do not carry photos into TEST');
  insist(isObject(generated.vars),'Local Vite vars required');
  const localFlags=[
   'FIRE_SERVICE_LOCATIONS_CANDIDATE','FIRE_CUSTOMER_PROPERTIES_CANDIDATE',
   'FIRE_PROPERTY_WORKFLOW_CANDIDATE','FIRE_PROPERTY_RECOVERY_CANDIDATE',
   'FIRE_PROPERTY_ESTIMATES_CANDIDATE','FIRE_LOCAL_CUSTOMERS_CANDIDATE'
  ];
  insist(Object.keys(generated.vars).sort().join(',')===localFlags.sort().join(',')&&
    localFlags.every(k=>generated.vars[k]===''),'Local development flags must all be disabled');
  insist(!generated.routes||Array.isArray(generated.routes)&&generated.routes.length===0,
    'Existing public routes in compiled config');
  insist(!generated.triggers||isObject(generated.triggers)&&
    (Object.keys(generated.triggers).length===0||Object.keys(generated.triggers).join(',')==='crons'&&
      Array.isArray(generated.triggers.crons)&&generated.triggers.crons.length===0),'Unexpected cron/event trigger');
  insist(!generated.observability||isObject(generated.observability),
    'Unexpected observability configuration');
  insist(noHiddenTokens(generated),'Secrets must not be embedded in Wrangler config');
  const result={...generated,
    name:PROPOSED_TEST_MAPPING.worker,
    topLevelName:PROPOSED_TEST_MAPPING.worker,
    // Explicit Cloudflare-supported Worker-to-Worker *public* fetch semantics,
    // TEST ONLY. Required for attempting provider public cert retrieval when
    // the Worker runtime's global fetch is blocked by a Cloudflare Worker hop.
    // Never bypass Cloudflare Access, authorize a user, or add a binding.
    compatibility_flags:[...new Set([...(generated.compatibility_flags||[]),'global_fetch_strictly_public'])],
    workers_dev:true, // EXACT previously Access-protected workers.dev host
    preview_urls:false,
    routes:[],
    d1_databases:[{
      binding:'DB',
      database_name:PROPOSED_TEST_MAPPING.d1.name,
      database_id:PROPOSED_TEST_MAPPING.d1.uuid
    }],
    vars:{...PROPOSED_TEST_MAPPING.vars}
  };
  delete result.r2_buckets;
  for(const key of [...EMPTY_BINDING_ARRAYS,...Object.keys(EMPTY_BINDING_OBJECTS),'dev','build','python_modules']){
    delete result[key];
  }
  delete result.triggers;
  insist(!Object.hasOwn(result,'r2_buckets')&&!Object.hasOwn(result,'kv_namespaces')&&
    !Object.hasOwn(result,'durable_objects'),'No R2/KV/DO in TEST candidate');
  insist(result.vars.FIRE_STRIPE_MODE==='disabled'&&
    !Object.keys(result.vars).some(k=>/STRIPE_(SECRET|RESTRICTED|WEBHOOK)|PASSWORD|TOKEN|SECRET|AUD|OWNER_EMAIL|TEAM_DOMAIN/.test(k)),
    'Forbidden payment keys or identity secrets in plaintext');
  insist(result.d1_databases[0].database_id===PROPOSED_TEST_MAPPING.d1.uuid,
    'Exact isolated new D1 UUID required');
  insist(noHiddenTokens(result),'No payment credentials in output');
  return result;
}
const isCLI=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isCLI){
  insist(process.argv.length===4,'Usage: node prepare-stripe-test-manifest.mjs INPUT_VITE_WRANGLER_JSON OUTPUT_REVIEW_JSON');
  const from=resolve(process.argv[2]),to=resolve(process.argv[3]);
  insist(basename(from)==='wrangler.json'&&basename(dirname(from))==='server'&&
    basename(dirname(dirname(from)))==='dist',
    'Only compiled dist/server/wrangler.json is accepted');
  insist(dirname(to)===dirname(from)&&basename(to)==='wrangler.FIRE_TEST_REVIEW_ONLY.json',
    'Review output must be exact sibling name');
  insist(!existsSync(to),'Existing review output must never be overwritten');
  const result=prepareStripeTestManifest(JSON.parse(readFileSync(from,'utf8')));
  writeFileSync(to,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
  console.log('PASS: Source-only Stripe TEST manifest prepared locally for review. No hosted changes.');
  console.log('Worker '+result.name+'; isolated new DB '+result.d1_databases[0].database_name+
    '; Stripe disabled; R2 absent; Access secrets never written to manifest.');
  console.log('NOT AUTHORIZED TO DEPLOY: requires new owner-approved release gate, hosted proof and no-cost confirmation.');
}
