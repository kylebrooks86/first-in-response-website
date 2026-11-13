/** Owner/public route inventory for FIRE candidate (source contract, NOT hosted auth certification).
 * This deliberately fails on newly exposed routes or missing owner-auth imports.
 * No provider requests, migrations, customer data or network calls.
 */
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';

const root='app/api';
function walk(dir){
 return readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
  const path=join(dir,item.name);
  return item.isDirectory()?walk(path):item.isFile()&&item.name==='route.ts'?[path]:[];
 });
}
const files=walk(root).sort();
// The new default-disabled owner-only LIVE legacy records review is deliberately
// ABSENT from the isolated Stripe TEST Worker. Both reviewed inventories are
// valid, but any OTHER added/removed route still fails closed.
const legacyReviewPresent=files.some(file=>relative(root,file)===join('backup','legacy-review','route.ts'));
assert.equal(files.length,legacyReviewPresent?70:69,
 'The reviewed FIRE route inventory changed. Re-audit any added/removed API surface before release.');
const publicMethods=new Map([
 ['app-version/route.ts','GET'],
 ['payments/checkout/route.ts','POST'],
 ['payments/webhook/route.ts','POST'],
 ['public/estimates/[token]/accept/route.ts','POST'],
 ['public/estimates/[token]/change-request/route.ts','POST'],
 ['public/estimates/[token]/revised-accept/route.ts','POST']
]);
let owner=0,publicCount=0,methods=0;
for(const file of files){
 const rel=relative(root,file).replaceAll('\\','/');
 const content=readFileSync(file,'utf8');
 const declared=[...content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)].map(x=>x[1]);
 assert.ok(declared.length,rel+': route exports no supported methods');
 methods+=declared.length;
 if(publicMethods.has(rel)){
  publicCount++;
  assert.deepEqual(declared,[publicMethods.get(rel)],rel+': unexpected public HTTP method');
  if(rel==='app-version/route.ts'){
   assert.match(content,/FIRE_APP_VERSION/);
   assert.doesNotMatch(content,/env\.DB|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/);
  }else if(rel==='payments/checkout/route.ts'){
   assert.match(content,/String\(LOCAL_CUSTOMER_DEPLOYMENT\)\s*===\s*["']qa["']/);
   assert.match(content,/shareToken/);
   assert.match(content,/acceptedAt/);
   assert.match(content,/signedAt/);
   assert.match(content,/\["superseded","declined"\]/);
  }else if(rel==='payments/webhook/route.ts'){
   assert.match(content,/verifyStripeSignature\(rawBody,\s*signature,\s*runtime\.STRIPE_WEBHOOK_SECRET\)/);
   assert.match(content,/event\.livemode\s*!==\s*!sandboxTarget/);
   assert.match(content,/LOCAL_CUSTOMER_DEPLOYMENT/);
  }else{
   assert.match(content,/token/);
   assert.match(content,/env\.DB\.prepare/);
   assert.ok(/readCustomerWriteJson|request\.headers\.get\(["']Origin["']\)/.test(content),
    rel+': public customer action must enforce same-origin request');
   assert.match(content,/accepted|status|version|agreement/i);
  }
  continue;
 }
 owner++;
 if(rel==='backup/legacy-review/route.ts'){
  assert.deepEqual(declared,['GET'],'Legacy records review must never expose write methods');
  assert.match(content,/getChatGPTUser/);
  assert.match(content,/LOCAL_CUSTOMER_DEPLOYMENT/);
  assert.match(content,/FIRE_LEGACY_SITES_REVIEW_EXPORT/);
  assert.match(content,/owner-review-only/);
  assert.match(content,/captureLegacySitesReviewReadOnly/);
  assert.match(content,/completeBackup:false/,'Legacy route must not claim full recoverable backup');
  assert.match(content,/status,headers:PRIVATE_HEADERS/,'Denied owner export must be private/no-store');
 }
 assert.ok(!rel.startsWith('public/'),rel+': unexpected public route');
 assert.match(content,/\bgetChatGPTUser\b/,rel+': missing explicit owner identity dependency');
 assert.ok(/Unauthorized|Owner access required|authorization|OWNER|ownerEmail|owner email|ownerAccess|ownerCheck/i.test(content),
  rel+': no visible owner denial or owner identity rule');
}
assert.equal(publicCount,6);
assert.equal(owner,legacyReviewPresent?64:63);
const publicEstimate=readFileSync('app/estimate/[token]/page.tsx','utf8');
const publicPay=readFileSync('app/pay/[id]/page.tsx','utf8');
assert.match(publicEstimate,/row\.status==="declined"/,'Withdrawn customer estimate may not expose stale approval/price');
assert.match(publicEstimate,/row\.status==="superseded"/,'Replacement estimate must identify its obsolete link');
assert.match(publicPay,/isWithdrawnPublicEstimate\(row\.status\)/,'Standalone payment page must suppress withdrawn quotes');
console.log('PASS source API route audit: '+files.length+' endpoints ('+owner+' owner-gated, '+publicCount+' narrowly public), '+methods+' declared methods, withdrawn-token protections. Does not certify hosted runtime permissions.');
