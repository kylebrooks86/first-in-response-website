// SOURCE-PREPARATION ONLY: synthesize ONE exact TEST app config from Vite's
// compiled local placeholder. NEVER deploy, contact Cloudflare, or overwrite
// the generated Vite config. CI deletes both compiled input and review output.
// Host Access and three existing secrets must be independently verified.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateTestAppIdentity,PROPOSED_TEST_MAPPING} from './test-app-identity-contract.mjs';

const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
const ALLOWED_KEYS=new Set([
 'name','topLevelName','main','compatibility_date','compatibility_flags','d1_databases','r2_buckets',
 'vars','assets','workers_dev','preview_urls','routes','observability',
 'rules','triggers','upload_source_maps'
]);
const DANGEROUS_KEYS=[
 'account_id','zone_id','route','env','kv_namespaces','services','queues',
 'durable_objects','unsafe','migrations','hyperdrive','vectorize','ai',
 'browser','images','send_email','dispatch_namespaces','workflows','pipelines',
 'containers','secrets_store_secrets','logpush'
];
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
  for(const key of DANGEROUS_KEYS) insist(!Object.hasOwn(generated,key),'Forbidden inherited resource: '+key);
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
    Object.keys(generated.triggers).length===0,'Unexpected cron/event trigger');
  insist(!generated.observability||isObject(generated.observability),
    'Unexpected observability configuration');
  insist(noHiddenTokens(generated),'Secrets must not be embedded in Wrangler config');
  const result={...generated,
    name:PROPOSED_TEST_MAPPING.worker,
    topLevelName:PROPOSED_TEST_MAPPING.worker,
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
  insist(!Object.hasOwn(result,'r2_buckets'),'No R2 in TEST candidate');
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
