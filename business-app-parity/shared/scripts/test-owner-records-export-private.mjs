/** Real Gate 7 source contract for customer/payment/contract backup downloads.
 * Uses only the actual route source plus Node's native Response/Headers; no
 * customer data, Cloudflare, network, SQLite writes or backup file output.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync('app/api/backup/route.ts','utf8');
const helperAt=src.indexOf('const privateRecordsHeaders=');
const getAt=src.indexOf('export async function GET() {',helperAt);
const postAt=src.indexOf('export async function POST(request: Request) {',getAt);
assert.ok(helperAt>0&&getAt>helperAt&&postAt>getAt,'Real owner backup route and private-header helper exist');
const get=src.slice(getAt,postAt);
const helper=src.slice(helperAt,getAt).replace('body:unknown,init:ResponseInit={}','body,init={}');
assert.ok(!helper.includes('ResponseInit')&&!helper.includes('body:unknown'),'Execute real helper without TS-only annotations');
const context={Response,Headers};
vm.runInNewContext(helper+'\nthis.privateRecordsJson=privateRecordsJson;this.privateRecordsHeaders=privateRecordsHeaders;',context);
let checks=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};
for(const code of [200,400,401,409,503]){
 const response=context.privateRecordsJson({error:'Synthetic owner-only result'},{status:code,headers:{
  'cache-control':'public, max-age=1200','vary':'Accept-Encoding','x-content-type-options':'unsafe'
 }});
 eq(response.status,code,'Owner backup helper retains status '+code);
 eq(response.headers.get('cache-control'),'private, no-store','Never cache backup '+code);
 eq(response.headers.get('vary'),'Cookie','Session isolation backup '+code);
 eq(response.headers.get('x-content-type-options'),'nosniff','No content sniffing '+code);
}
const privateCalls=(get.match(/privateRecordsJson\(/g)||[]).length;
assert.ok(privateCalls>=15,'All fifteen previous JSON error/denial branches use the same private helper');checks++;
eq((get.match(/Response\.json\(/g)||[]).length,0,'No unprotected JSON responses in actual owner export GET');
eq((get.match(/new Response\(/g)||[]).length,2,'Both legacy owner-download formats are recognized');
assert.match(get,/if\s*\(!await authorized\(\)\)\s*return privateRecordsJson/);checks++;
assert.match(get,/try\s*\{\s*if\(await numberedIdentityBackupLocked\(\)\)/);checks++;
assert.match(get,/catch\s*\{\s*return privateRecordsJson\(/);checks++;
assert.match(get,/headers:\{\.\.\.privateRecordsHeaders,'content-type':'application\/json'/);checks++;
assert.match(get,/headers:\s*\{\s*\.\.\.privateRecordsHeaders,/);checks++;
assert.ok(!get.includes('await request.text()')&&!get.includes('await request.json()'),
 'Owner GET performs no consumer-upload parsing');checks++;
console.log('PASS '+checks+'/'+checks+' owner full-record export GET privacy, auth, denial, schema-error and two downloads; source only, no provider');
