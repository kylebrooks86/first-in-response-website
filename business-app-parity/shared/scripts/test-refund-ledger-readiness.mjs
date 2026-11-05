/** Real owner financial handlers must refuse missing LIVE refund schema BEFORE Stripe/ledger work.
 * Disposable module stubs and synthetic schema names only; no host/provider access.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const compile=(path)=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8")
  .replace(/^import .*?;\n/gm,""),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let passed=0;
const eq=(value,wanted,reason)=>{assert.deepEqual(value,wanted,reason);console.log("PASS: "+reason);passed++};
const objects=[
  ["payment_refunds","table","payment_refunds"],
  ["idx_payment_refunds_payment_status","index","payment_refunds"],
  ["idx_payment_refunds_estimate_status","index","payment_refunds"],
  ["idx_payment_refunds_provider","index","payment_refunds"],
].map(([name,type,tableName])=>({name,type,tableName}));
const guardExports={};
new Function("exports","Response",compile("../lib/refund-ledger-readiness.ts"))(guardExports,Response);
const {refundLedgerObjectsPresent,refundLedgerNotReady}=guardExports;
function dbFor(rows,{throwOnQuery=false}={}){
 const calls={read:0,other:0,write:0,queries:[]};
 const db={prepare(sql){
  calls.queries.push(sql);
  if(sql.includes("sqlite_master")){
   calls.read++;
   if(throwOnQuery)throw Error("Synthetic D1 metadata error");
   return {all:async()=>({results:rows})};
  }
  calls.other++;
  if(/\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql))calls.write++;
  return {all:async()=>({results:[]}),bind(){return {first:async()=>null,all:async()=>({results:[]}),run:async()=>({meta:{changes:0}})}}};
 }};
 return {db,calls};
}
for(const [name,rows,expected] of [
 ["complete ledger and index names",objects,true],
 ["missing refund table",objects.slice(1),false],
 ["missing provider unique index",objects.slice(0,3),false],
 ["wrong index parent table",objects.map((x,i)=>i===2?{...x,tableName:"payments"}:x),false],
 ["duplicate schema object name",[...objects.slice(0,3),objects[0]],false],
 ["mismatched object type",objects.map((x,i)=>i===0?{...x,type:"index"}:x),false],
 ["malformed projection",null,false],
]){
 const {db,calls}=dbFor(rows);
 eq(await refundLedgerObjectsPresent(db),expected,name+" is correctly gated");
 eq(calls.read,1,name+" performs exactly one metadata SELECT");
 eq(calls.other,0,name+" performs zero finance/other queries");
 eq(calls.write,0,name+" performs zero writes");
}
const broken=dbFor(objects,{throwOnQuery:true});
eq(await refundLedgerObjectsPresent(broken.db),false,"provider metadata exception fails closed");
eq(broken.calls.write,0,"unavailable provider metadata never causes write");
const blocked=refundLedgerNotReady();
eq(blocked.status,503,"schema blocker uses non-success 503");
eq(blocked.headers.get("cache-control"),"no-store","financial blocker is never cached");
const payload=await blocked.json();
eq(payload.code,"REFUND_LEDGER_SCHEMA_INCOMPLETE","financial API provides stable machine-readable error");
eq(payload.retryable,false,"schema mismatch never advertises automatic retry");
eq(typeof payload.error,"string","owner receives actionable message");

function route(file,db,owner=true,deployment="live"){
 const env={DB:db,FIRE_ENV:deployment,STRIPE_RESTRICTED_KEY:"sk_test_SYNTHETIC"};
 const calls={fetch:0,finalize:0,refundUpdate:0};
 const exports={};
 const factory=new Function("require","exports","env","getChatGPTUser",
   "refundLedgerObjectsPresent","refundLedgerNotReady","LOCAL_CUSTOMER_DEPLOYMENT",
   "processingAmounts","finalizeRefund","recordRefundUpdate","fetch","Response",compile(file));
 factory(()=>{throw Error("Imports are supplied as synthetic dependencies");},exports,env,
   async()=>owner?{email:"kylebrooks8605@gmail.com"}:null,
   refundLedgerObjectsPresent,refundLedgerNotReady,deployment,
   ()=>{throw Error("No processing on missing schema");},
   async()=>{calls.finalize++;throw Error("No refund writes allowed");},
   async()=>{calls.refundUpdate++;throw Error("No refund updates allowed");},
   async()=>{calls.fetch++;throw Error("No external Stripe network allowed");},Response);
 return {exports,calls};
}
for(const rows of [[],objects.slice(1),objects.slice(0,3)]){
 const {db,calls}=dbFor(rows);
 const payments=route("../app/api/payments/route.ts",db);
 const get=await payments.exports.GET();
 eq(get.status,503,"Payments GET blocks before querying missing refund ledger");
 eq((await get.json()).code,"REFUND_LEDGER_SCHEMA_INCOMPLETE","Payment history tells owner exact prerequisite");
 const post=await payments.exports.POST(new Request("https://synthetic.invalid/api/payments",{method:"POST",body:"{}"}));
 eq(post.status,503,"Manual payment POST blocks while accounting ledger incomplete");
 const refund=route("../app/api/payments/refund/route.ts",db);
 const request=new Request("https://synthetic.invalid/api/payments/refund",{method:"POST",
  body:JSON.stringify({paymentId:"synth-paid",requestId:"synth-refund",amountCents:2000})});
 const response=await refund.exports.POST(request);
 eq(response.status,503,"Refund POST blocks before any potential money movement");
 eq(refund.calls.fetch,0,"Missing refund ledger allows zero Stripe requests");
 eq(refund.calls.finalize+refund.calls.refundUpdate,0,"Missing refund ledger allows zero refund finalizations");
 eq(calls.other,0,"Missing refund schema never queries individual payment/customer rows");
 eq(calls.write,0,"Missing refund schema performs zero database writes");
}
const good=dbFor(objects);
const healthy=route("../app/api/payments/route.ts",good.db);
const badBody=await healthy.exports.POST(new Request("https://synthetic.invalid/api/payments",{method:"POST",body:"{}"}));
eq(badBody.status,400,"Complete object names preserve standard bad-input validation (not false outage)");
const validGet=await healthy.exports.GET();
eq(validGet.status,200,"Complete object names preserve regular payment history GET");
eq((await validGet.json()).payments,[],"Healthy synthetic history loads correctly");
const validRefund=route("../app/api/payments/refund/route.ts",good.db);
eq((await validRefund.exports.POST(new Request("https://synthetic.invalid/api/payments/refund",
 {method:"POST",body:"{}"}))).status,400,"Complete object names preserve standard refund validation");
const forbidden=dbFor(objects);
const unknown=route("../app/api/payments/route.ts",forbidden.db,false);
eq((await unknown.exports.GET()).status,401,"Unauthorized GET never introspects schema");
eq((await unknown.exports.POST(new Request("https://synthetic.invalid/api/payments",
 {method:"POST",body:"{}"}))).status,401,"Unauthorized POST never introspects schema");
eq(forbidden.calls.queries.length,0,"Unauthorized financial reads/writes cause zero database access");
const qa=dbFor(objects);
const qaRefund=route("../app/api/payments/refund/route.ts",qa.db,true,"qa");
eq((await qaRefund.exports.POST(new Request("https://synthetic.invalid/api/payments/refund",
 {method:"POST",body:"{}"}))).status,503,"QA Stripe-refund hard prohibition stays intact");
eq(qa.calls.queries.length,0,"QA refund handler never reads hosted schema");
console.log("PASS "+passed+"/"+passed+" actual payment/refund handlers guarded without Stripe, records or writes.");
