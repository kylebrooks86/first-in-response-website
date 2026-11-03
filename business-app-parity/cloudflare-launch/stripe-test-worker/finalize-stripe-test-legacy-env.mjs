// LOCAL-ONLY finalizer for the immutable historical Gate9 source generator.
// Wrangler 4.151 rejects `legacy_env` (removed since 4.111). The pinned
// generator emits only the previous default: true. Remove exactly that ONE
// obsolete key, NEVER change Worker identity, binding, vars, traffic or secrets.
// This file is downloaded and Git-hash checked alongside the owner script.
import {readFileSync,writeFileSync,renameSync,statSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
function insist(ok,reason){if(!ok)throw Error('STOP: TEST review manifest compatibility '+reason);}
export function finalizeLegacyEnv(review){
  insist(review&&typeof review==='object'&&!Array.isArray(review),'requires object config');
  insist(Object.hasOwn(review,'legacy_env')&&review.legacy_env===true,
    'requires exactly legacy_env=true from pinned historical generator');
  insist(!Object.hasOwn(review,'env')&&!Object.hasOwn(review,'account_id')&&
    !Object.hasOwn(review,'zone_id'),'environment/account controls not allowed');
  insist(review.name==='fire-stripe-test-20261101'&&review.topLevelName==='fire-stripe-test-20261101',
    'wrong TEST Worker name');
  insist(review.workers_dev===true&&review.preview_urls===false&&
    Array.isArray(review.routes)&&review.routes.length===0,'routing or previews differ');
  insist(Array.isArray(review.d1_databases)&&review.d1_databases.length===1&&
    review.d1_databases[0]?.binding==='DB'&&
    review.d1_databases[0]?.database_name==='fire-stripe-test-db-20261101'&&
    review.d1_databases[0]?.database_id==='dba421ba-fc66-4cf8-9c31-51616f8249ba',
    'D1 physical identity differs');
  insist(!Object.hasOwn(review,'r2_buckets')&&!Object.hasOwn(review,'kv_namespaces')&&
    !Object.hasOwn(review,'durable_objects'),'unexpected storage binding');
  insist(review.vars?.FIRE_STRIPE_MODE==='disabled'&&review.vars?.FIRE_ACCESS_REQUIRED==='enabled',
    'Stripe-disabled or Access settings not confirmed');
  insist(review.observability?.enabled===true&&review.observability?.logs?.enabled===true&&
    review.observability?.logs?.invocation_logs===true&&
    review.observability?.redact_query_string===false,'log settings differ from verified TEST Worker');
  const result={...review};
  delete result.legacy_env;
  insist(!Object.hasOwn(result,'legacy_env'),'deprecated config still present');
  const comparison={...result,legacy_env:true};
  insist(Object.keys(review).length===Object.keys(result).length+1&&
    Object.keys(result).every(k=>JSON.stringify(result[k])===JSON.stringify(review[k])),
    'unexpected non-legacy configuration change');
  return result;
}
export function finalizeReviewFile(arg){
  const file=resolve(arg||'');
  insist(basename(file)==='wrangler.FIRE_TEST_REVIEW_ONLY.json'&&
    basename(dirname(file))==='server'&&
    basename(dirname(dirname(file)))==='dist',
    'only the freshly built TEST review file may be finalized');
  insist(statSync(file).size>0&&statSync(file).size<131072,'unexpected review config size');
  const original=JSON.parse(readFileSync(file,'utf8'));
  const reviewed=finalizeLegacyEnv(original);
  const tmp=file+'.FIRE_LEGACY_LOCAL_ONLY.tmp';
  writeFileSync(tmp,JSON.stringify(reviewed,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
  renameSync(tmp,file);
  console.log('PASS: Local TEST review config finalized for standalone Wrangler: removed deprecated legacy_env=true ONLY; zero hosted writes.');
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked){
  insist(process.argv.length===3,'usage: node finalize-stripe-test-legacy-env.mjs EXACT_REVIEW_PATH');
  finalizeReviewFile(process.argv[2]);
}
