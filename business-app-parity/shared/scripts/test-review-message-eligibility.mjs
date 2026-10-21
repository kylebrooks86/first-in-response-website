/** Synthetic review message safety on real SQLite schema; never sends messages. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";
import ts from "typescript";
import {shouldOfferReviewAfterPayment} from "../lib/customer-review-invite.mjs";
const db=new DatabaseSync(":memory:");
for(const p of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+p,"utf8"));
let user={email:"kylebrooks8605@gmail.com"},writes=0,sequence=0;
const env={DB:{prepare(sql){return {bind(...args){const query=db.prepare(sql);return {
 first:async()=>query.get(...args)??null,
 run:async()=>{const result=query.run(...args);if(result.changes)writes+=result.changes;return {meta:{changes:result.changes}}},
 };}};}}};
const load=()=>{
 const exports={};const js=ts.transpileModule(readFileSync("app/api/customer-messages/route.ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const imported={"cloudflare:workers":{env},"../../chatgpt-auth":{getChatGPTUser:async()=>user},"../../../lib/customer-review-invite.mjs":{shouldOfferReviewAfterPayment}};
 vm.runInNewContext(js,{exports,require:n=>{if(!(n in imported))throw Error("Unexpected dependency "+n);return imported[n]},Response,crypto:{randomUUID:()=>`synthetic-review-${++sequence}`}});
 return exports;
};
const api=load();
const stamp=new Date().toISOString();
function customer(id){db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run("c-"+id,"Synthetic "+id,stamp)}
function job(id,{status="completed",total=10000,paid=10000}={}){
 customer(id);
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run("e-"+id,"c-"+id,status,total,total,total/2,stamp);
 if(paid)db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("p-"+id,"e-"+id,"Cash",paid,"paid",stamp);
}
const post=(id,channel="text_prepared",extra={})=>api.POST(new Request("https://fire.local/api/customer-messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({customerId:"c-"+id,estimateId:"e-"+id,channel,template:"review",body:"Please share your honest experience: https://firstinresponseexteriors.com/review",...extra})}));
let n=0;function check(condition,label){assert.ok(condition,label);n++}
try{
 job("paid");job("deposit",{paid:5000});job("scheduled",{status:"scheduled"});job("overpaid",{paid:11000});job("unpaid",{paid:0});job("zero",{total:0,paid:0});
 job("refund");
 db.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,?,?,?,?)").run("r1","p-refund","e-refund",1000,"Stripe","pending",stamp);
 job("checkout");
 db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("cs_review","e-checkout","balance",10000,"open",stamp);
 job("overage");
 db.prepare("INSERT INTO notifications(id,customer_id,estimate_id,type,title,body,created_at) VALUES(?,?,?,?,?,?,?)").run("n_review","c-overage","e-overage","payment_overage","Review","Synthetic",stamp);
 let res=await post("paid"),data=await res.json();
 check(res.status===201&&data.message?.channel==="text_prepared"&&data.message?.template==="review","Confirmed full payment allows owner to prepare a text, not automatically send it");
 res=await post("paid","copy");data=await res.json();
 check(res.status===201&&data.message?.channel==="copy","Copy after verified closeout only logs copy, not delivered");
 for(const [id,channel] of [["deposit","copy"],["deposit","email_prepared"],["scheduled","text_prepared"],["overpaid","copy"],["unpaid","text_prepared"],["zero","copy"],["refund","text_prepared"],["checkout","copy"],["overage","text_prepared"]]){
  res=await post(id,channel);check(res.status===409,"Unsafe or unfinished job blocked: "+id+" / "+channel);
 }
 check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE channel IN ('text_confirmed','email_confirmed')").get().n===0,"Preparing messages never creates send-confirmed receipts");
 check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages").get().n===2,"Only two authorized preparation records saved");
 const before=writes;
 user=null;res=await post("paid");check(res.status===401&&writes===before,"Unauthenticated message preparation denied before write");
 user={email:"someoneelse@example.invalid"};res=await post("paid");check(res.status===401&&writes===before,"Non-owner message preparation denied");
 user={email:"kylebrooks8605@gmail.com"};
 res=await post("paid","text_prepared",{customerId:"c-deposit"});check(res.status===409&&writes===before,"Job/customer mismatch cannot record a review message");
 res=await post("paid","text_confirmed");check(res.status===400&&writes===before,"Direct sent-status POST remains prohibited");
 console.log("PASS "+n+" review request permission, fully paid, held billing, authorization and no-delivery checks.");
}finally{db.close()}
