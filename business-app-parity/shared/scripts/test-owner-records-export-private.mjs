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
const restoreAt=src.indexOf('async function restoreRecords(request: Request) {',getAt);
const postAt=src.indexOf('export async function POST(request: Request) {',restoreAt);
assert.ok(helperAt>0&&getAt>helperAt&&restoreAt>getAt&&postAt>restoreAt,'Real owner backup, guarded restore and private POST wrapper exist');
const get=src.slice(getAt,restoreAt);
const restore=src.slice(restoreAt,postAt);
const post=src.slice(postAt);
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

const authAt=src.indexOf('async function authorized() {');
const authEnd=src.indexOf('// A full records export carries customer contact data',authAt);
assert.ok(authAt>=0&&authEnd>authAt,'Production owner check exists');checks++;
let principal=null,authThrows=false;
const authCtx={OWNER_EMAIL:'synthetic-owner@example.invalid',getChatGPTUser:async()=>{
 if(authThrows)throw Error('Synthetic identity provider unavailable');
 return principal;
}};
vm.runInNewContext(src.slice(authAt,authEnd)+'\nthis.authorized=authorized;',authCtx);
for(const malformed of [null,{}, {email:null},{email:123},{email:{}},{email:'another@example.invalid'}]){
 principal=malformed;eq(await authCtx.authorized(),false,'Malformed/unrelated owner refuses both backup directions');
}
authThrows=true;eq(await authCtx.authorized(),false,'Session provider failure denies records backup and restore');authThrows=false;
principal={email:'SYNTHETIC-OWNER@example.invalid'};
eq(await authCtx.authorized(),true,'Valid owner email preserves authorized backup flows');

assert.ok(restore.includes('readBoundedRecordsRestoreText(request)')&&
 restore.includes('ownerBrowserWriteScope(request,true)'),'Production restore keeps original body budget and origin guard');checks++;
const ctx={Response,Headers,privateRecordsHeaders:context.privateRecordsHeaders,restoreRecords:async()=>Response.json({error:'Synthetic private restore result'},{status:409,headers:{'cache-control':'public, max-age=3600','vary':'Accept-Encoding','x-content-type-options':'unsafe'}})};
vm.runInNewContext(post.replace('export async function POST(request: Request) {','async function POST(request) {')+'\nthis.POST=POST;',ctx);
for(const code of [200,400,401,409,503]){
 ctx.restoreRecords=async()=>Response.json({synthetic:true},{status:code,headers:{'cache-control':'public, max-age=3600','vary':'Accept-Encoding','x-content-type-options':'unsafe'}});
 const res=await ctx.POST({});
 eq(res.status,code,'Private restore wrapper preserves original status');
 eq(res.headers.get('cache-control'),'private, no-store','Never cache owner restore receipt');
 eq(res.headers.get('vary'),'Cookie','Restore receipts isolate owner session');
 eq(res.headers.get('x-content-type-options'),'nosniff','Restore receipts disable content sniffing');
 eq((await res.json()).synthetic,true,'Restore payload preserved without mutation');
}
console.log('PASS '+checks+'/'+checks+' actual owner records GET/POST session denial, private restore receipts, body/financial guard preservation; synthetic only, NO HOSTED WRITES.');
