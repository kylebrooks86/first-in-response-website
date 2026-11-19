import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {readCustomerWriteJson,readOwnerWriteObject,ownerBrowserWriteScope} from "../shared/lib/customer-write-request-guard.mjs";

const origin="https://fire-stripe-test-20261101.kyle-bfc.workers.dev";
const endpoint=origin+"/api/public/estimates/FICTIONAL/accept";
const fields=["signedName","photoRelease","acceptedTerms"];
function request(body,headers={},endpointOverride=endpoint){
  return new Request(endpointOverride,{method:"POST",headers:{
    "origin":origin,"content-type":"application/json; charset=utf-8",...headers
  },body:typeof body==="string"?body:JSON.stringify(body)});
}
const read=async(req,maxBytes=2048)=>readCustomerWriteJson(req,fields,maxBytes);
const denial=async(req,status)=>{const result=await read(req);assert.equal(result.response?.status,status);assert.equal(result.response?.headers.get("cache-control"),"no-store");assert.equal(result.value,undefined);};

test("Gate 6 same-origin valid JSON customer approval is accepted for route-level token validation",async()=>{
  const req=request({signedName:"Gate Six Test Customer",photoRelease:"no",acceptedTerms:true});
  const result=await read(req);
  assert.deepEqual(result.value,{signedName:"Gate Six Test Customer",photoRelease:"no",acceptedTerms:true});
  assert.equal(result.response,undefined);
});
test("cross-origin, null Origin, missing Origin and wrong app origins cannot write",async()=>{
  await denial(request({signedName:"Test",photoRelease:"no",acceptedTerms:true},{"origin":"https://evil.example"}),403);
  await denial(request({signedName:"Test",photoRelease:"no",acceptedTerms:true},{"origin":"null"}),403);
  const req=request({signedName:"Test",photoRelease:"no",acceptedTerms:true});req.headers.delete("origin");
  await denial(req,403);
  await denial(request({signedName:"Test",photoRelease:"no",acceptedTerms:true},{},origin.replace("fire-stripe-test-20261101","fire-qa")+"/api/public/estimates/X/accept"),403);
});
test("wrong Content-Type, form and text are rejected before signature validation",async()=>{
  await denial(request('{"signedName":"Test"}',{"content-type":"text/plain"}),415);
  await denial(request("signedName=Test",{"content-type":"application/x-www-form-urlencoded"}),415);
});
test("invalid or unexpected JSON fields cannot reach database",async()=>{
  await denial(request("{"),400);
  await denial(request("null"),400);
  await denial(request("[]"),400);
  await denial(request('{"signedName":"Test","photoRelease":"no","acceptedTerms":true,"isAdmin":true}'),400);
  await denial(request('{"__proto__":{"injected":true}}'),400);
});
test("bounded body rejects oversized customer name/payload (stream and header limits)",async()=>{
  await denial(request({signedName:"X".repeat(10000),photoRelease:"no",acceptedTerms:true}),413);
  await denial(request({signedName:"Test",photoRelease:"no",acceptedTerms:true},{"content-length":"999999"}),413);
  await denial(request({signedName:"Test",photoRelease:"no",acceptedTerms:true},{"content-length":"-1"}),413);
});
// Exercise the REAL streamed, signed customer-write reader: declared length
// must match actual BYTES; split UTF-8 characters are valid, corrupted ones
// fail CLOSED before the share-token handler queries any D1 records.
function streamed(chunks,headers={}){
 return new Request(endpoint,{method:"POST",duplex:"half",headers:{
  origin,"content-type":"application/json; charset=utf-8",...headers
 },body:new ReadableStream({start(controller){
  for(const chunk of chunks)controller.enqueue(chunk);
  controller.close();
 }})});
}
test("Gate6 stream accepts split valid multibyte UTF-8 and exact declared byte length",async()=>{
 const payload={signedName:"Synthetic 🔥 Customer",photoRelease:"no",acceptedTerms:true};
 const bytes=new TextEncoder().encode(JSON.stringify(payload));
 const split=bytes.indexOf(0xf0);
 assert.ok(split>0);
 const result=await read(streamed([
  bytes.slice(0,split+1),bytes.slice(split+1,split+3),bytes.slice(split+3)
 ],{"content-length":String(bytes.length)}));
 assert.deepEqual(result.value,payload);
 assert.equal(result.response,undefined);
});
test("Gate6 stream rejects forged short/extra Content-Length before any public write",async()=>{
 const bytes=new TextEncoder().encode('{"signedName":"FIRE Test","photoRelease":"no","acceptedTerms":true}');
 await denial(streamed([bytes],{"content-length":String(bytes.length-1)}),400);
 await denial(streamed([bytes],{"content-length":String(bytes.length+1)}),400);
 await denial(streamed([bytes],{"content-length":"0"}),400);
});
test("Gate6 strict streaming rejects malformed UTF-8, arbitrary chunks and empty request body",async()=>{
 const start=new TextEncoder().encode('{"signedName":"');
 const end=new TextEncoder().encode('","photoRelease":"no","acceptedTerms":true}');
 await denial(streamed([start,new Uint8Array([0xc3,0x28]),end]),400);
 await denial(streamed(["not a Uint8Array"]),400);
 await denial(streamed([]),400);
});
test("revised customer agreement uses the same 4096-byte guarded reader before bearer token lookup",()=>{
 const route=readFileSync(fileURLToPath(new URL(
  "../shared/app/api/public/estimates/[token]/revised-accept/route.ts",import.meta.url)),"utf8");
 const guard=route.indexOf("await readCustomerWriteJson(request,");
 const token=route.indexOf("const {token}=await params;");
 assert.ok(guard>0&&token>guard);
 assert.match(route,/\['version','documentDigest','signedName','photoRelease','acceptedTerms'\],4096/);
 assert.doesNotMatch(route,/await request\.text\(\)/);
 assert.match(route,/if\(!active\(env\)\)return/);
});

test("change-request allowance supports bounded fictional message + id",async()=>{
  const value={message:"Please change my test quote",requestId:"8bd90bf2-eb6f-420d-9372-794a34aa5124"};
  const result=await readCustomerWriteJson(request(value),["message","requestId"],8192);
  assert.deepEqual(result.value,value);
});
test("both public write handlers use same-origin bounded parser before share-token DB reads",()=>{
  const readFile=(relative)=>readFileSync(fileURLToPath(new URL(relative,import.meta.url)),"utf8");
  const accept=readFile("../shared/app/api/public/estimates/[token]/accept/route.ts");
  const change=readFile("../shared/app/api/public/estimates/[token]/change-request/route.ts");
  for(const handler of [accept,change]){
    const guard=handler.indexOf("await readCustomerWriteJson(request,");
    const token=handler.indexOf("const {token}=await");
    assert.ok(guard>=0&&token>guard,"Guard must run before token or database access");
    assert.match(handler,/if\(parsed\.response\)return parsed\.response/);
    assert.match(handler,/\.bind\(token\)/);
  }
});

const ownerEndpoint=origin+"/api/expenses";
const ownerRequest=(body,overrides={})=>new Request(ownerEndpoint,{method:"POST",
  headers:{"origin":origin,"sec-fetch-site":"same-origin","content-type":"application/json",...overrides},
  body:typeof body==="string"?body:JSON.stringify(body)});
const ownerRead=async(request)=>readOwnerWriteObject(request,8192);
const ownerDenied=async(request,expected)=>{
  const result=await ownerRead(request);
  assert.equal(result.response?.status,expected);
  assert.equal(result.response?.headers.get("cache-control"),"private, no-store");
  assert.equal(result.value,undefined);
};
test("Gate6 owner JSON writes accept same-origin browser metadata and small valid bodies",async()=>{
 const row={description:"Synthetic expense",amountCents:1500};
 const result=await ownerRead(ownerRequest(row));
 assert.deepEqual(result.value,row);
 assert.equal(result.response,undefined);
});
test("Gate6 owner writes reject foreign Origin, sibling origin, and null Origin before reading body",async()=>{
 const row={description:"Synthetic expense",amountCents:1500};
 for(const foreign of ["https://evil.example","https://foo.kyle-bfc.workers.dev","null"]){
   await ownerDenied(ownerRequest(row,{"origin":foreign}),403);
 }
 // A forged same-site sibling fetch is still not the same origin.
 await ownerDenied(ownerRequest(row,{"sec-fetch-site":"same-site"}),403);
});
test("Gate6 owner writes reject cross-site, navigational and null fetch contexts even without Origin",async()=>{
 for(const site of ["cross-site","same-site","none","null"]){
  const req=ownerRequest({description:"Synthetic expense"},{"sec-fetch-site":site});
  req.headers.delete("origin");
  await ownerDenied(req,403);
 }
});
test("Gate6 owner browser writes reject form/text content types and missing JSON before DB writes",async()=>{
 for(const contentType of ["text/plain","application/x-www-form-urlencoded","multipart/form-data"]){
  await ownerDenied(ownerRequest('{"description":"Synthetic"}',{"content-type":contentType}),415);
 }
 const req=ownerRequest({description:"Synthetic"});req.headers.delete("content-type");
 await ownerDenied(req,415);
});
test("Gate6 owner synthetic/internal request without browser metadata retains existing bounded JSON compatibility",async()=>{
 const req=new Request(ownerEndpoint,{method:"POST",body:JSON.stringify({description:"Internal synthetic"})});
 const result=await ownerRead(req);
 assert.deepEqual(result.value,{description:"Internal synthetic"});
 assert.equal(result.response,undefined);
});

test("Gate6 backup restore permits same-origin browser JSON but rejects forged and form writes",()=>{
 const json=ownerRequest({format:"synthetic"},{});
 assert.equal(ownerBrowserWriteScope(json,true),null);
 const crossSite=ownerRequest({format:"synthetic"},{"origin":"https://foreign.invalid","sec-fetch-site":"cross-site"});
 assert.equal(ownerBrowserWriteScope(crossSite,true)?.status,403);
 const form=ownerRequest('{"format":"synthetic"}',{"content-type":"text/plain"});
 assert.equal(ownerBrowserWriteScope(form,true)?.status,415);
});
test("Gate6 photo upload keeps valid multipart while rejecting browser cross-origin requests",()=>{
 const multipart=new Request(ownerEndpoint,{method:"POST",headers:{"origin":origin,"sec-fetch-site":"same-origin","content-type":"multipart/form-data; boundary=synthetic"},body:"--synthetic--"});
 assert.equal(ownerBrowserWriteScope(multipart,false),null);
 const foreign=new Request(ownerEndpoint,{method:"POST",headers:{"origin":"https://untrusted.invalid","sec-fetch-site":"cross-site","content-type":"multipart/form-data; boundary=synthetic"},body:"--synthetic--"});
 assert.equal(ownerBrowserWriteScope(foreign,false)?.status,403);
});
test("Gate6 destructive restore and photo upload require owner origin checks before ANY D1/storage work",()=>{
 const source=(path)=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
 const restore=source("../shared/app/api/backup/route.ts");
 const upload=source("../shared/app/api/customer-photos/route.ts");
 assert.match(restore,/import \{ownerBrowserWriteScope\} from/);
 assert.match(upload,/import \{ownerBrowserWriteScope\} from/);
 const restorePost=restore.indexOf('export async function POST(request: Request)');
 const restoreAuth=restore.indexOf('if (!await authorized())',restorePost);
 const restoreGuard=restore.indexOf('ownerBrowserWriteScope(request,true)',restorePost);
 const restoreDatabaseRead=restore.indexOf('numberedIdentityBackupLocked()',restoreAuth);
 const restoreBody=restore.indexOf('await readBoundedRecordsRestoreText(request)',restoreAuth);
 assert.ok(restoreAuth>=0&&restoreGuard>restoreAuth&&restoreGuard<restoreDatabaseRead&&restoreGuard<restoreBody,
  "Restore must reject forged browser requests before D1 and JSON backup parsing");
 const uploadAuth=upload.indexOf('if (!await authorized())');
 const uploadGuard=upload.indexOf('ownerBrowserWriteScope(request,false)');
 const uploadStorage=upload.indexOf('if (!env.BUCKET)',uploadAuth);
 const uploadBody=upload.indexOf('await boundedPhotoForm(request)',uploadAuth);
 assert.ok(uploadAuth>=0&&uploadGuard>uploadAuth&&uploadGuard<uploadStorage&&uploadGuard<uploadBody,
  "Photo upload must reject forged browser writes before storage and multipart parsing");
});

test("Gate6 saved photo DELETE accepts same-origin intent without requiring a JSON body",()=>{
 const valid=new Request(ownerEndpoint,{method:"DELETE",headers:{"origin":origin,"sec-fetch-site":"same-origin"}});
 assert.equal(ownerBrowserWriteScope(valid,false),null);
 const foreign=new Request(ownerEndpoint,{method:"DELETE",headers:{"origin":"https://untrusted.invalid","sec-fetch-site":"cross-site"}});
 assert.equal(ownerBrowserWriteScope(foreign,false)?.status,403);
 const sibling=new Request(ownerEndpoint,{method:"DELETE",headers:{"origin":origin,"sec-fetch-site":"same-site"}});
 assert.equal(ownerBrowserWriteScope(sibling,false)?.status,403);
 const noOrigin=new Request(ownerEndpoint,{method:"DELETE",headers:{"sec-fetch-site":"cross-site"}});
 assert.equal(ownerBrowserWriteScope(noOrigin,false)?.status,403);
});
test("Gate6 actual photo DELETE route checks owner and browser boundary before D1 or bucket writes",()=>{
 const route=readFileSync(fileURLToPath(new URL("../shared/app/api/customer-photos/[id]/route.ts",import.meta.url)),"utf8");
 assert.match(route,/import \{ownerBrowserWriteScope\} from/);
 const del=route.indexOf("export async function DELETE(");
 assert.ok(del>0,"Photo deletion handler must exist");
 const auth=route.indexOf("if (!await authorized())",del);
 const scope=route.indexOf("ownerBrowserWriteScope(request,false)",del);
 const bucket=route.indexOf("if (!env.BUCKET)",del);
 const select=route.indexOf('SELECT object_key AS objectKey FROM customer_photos',del);
 const remove=route.indexOf('DELETE FROM customer_photos WHERE id=? AND object_key=?',del);
 const deleteBytes=route.indexOf('await env.BUCKET.delete(',del);
 assert.ok(auth>del&&scope>auth&&scope<bucket&&scope<select&&scope<remove&&scope<deleteBytes,
  "Photo DELETE refuses cross-origin browser intent before storage and irreversible metadata/byte writes");
});
