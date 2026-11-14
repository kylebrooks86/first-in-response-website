import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {readCustomerWriteJson} from "../shared/lib/customer-write-request-guard.mjs";

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
