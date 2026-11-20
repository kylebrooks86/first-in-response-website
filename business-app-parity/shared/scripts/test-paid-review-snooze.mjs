/** Owner-only paid review snooze: native synthetic SQLite, no customers contacted. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";
import ts from "typescript";
import {readOwnerWriteObject} from "../lib/customer-write-request-guard.mjs";
const db=new DatabaseSync(":memory:");
for(const file of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+file,"utf8"));
let user={email:"kylebrooks8605@gmail.com"},reads=0,writes=0;
const env={DB:{prepare(sql){return {
 // Match native D1 unbound SELECT .all() used by real refund-ledger gate.
 all:async()=>{reads++;return {results:db.prepare(sql).all()}},
 bind(...args){return {
 first:async()=>{reads++;return db.prepare(sql).get(...args)??null},
 all:async()=>{reads++;return {results:db.prepare(sql).all(...args)}},
 run:async()=>{writes++;return {meta:{changes:db.prepare(sql).run(...args).changes}}}
}}}}}};
const load=(path,deps)=>{
 const exports={};
 const code=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(!(name in deps))throw Error("Unexpected import "+name);return deps[name]},Response,URL,Date});
 return exports;
};
const helpers=load("lib/payment-closeout-actions.ts",{});
// The real closeout queue now imports the mandatory fail-closed refund-ledger
// guard. Load its actual TypeScript module; never replace it with a pass stub.
const refundReadiness=load("lib/refund-ledger-readiness.ts",{});
const auth={"cloudflare:workers":{env},"../../chatgpt-auth":{getChatGPTUser:async()=>user},"../../../lib/payment-closeout-actions":helpers,"../../../lib/refund-ledger-readiness":refundReadiness};
const closeouts=load("app/api/payment-closeouts/route.ts",auth);
const snooze=load("app/api/payment-closeouts/snooze/route.ts",{"cloudflare:workers":{env},"../../../chatgpt-auth":{getChatGPTUser:async()=>user},"../../../../lib/customer-write-request-guard.mjs":{readOwnerWriteObject}});
const stamp=n=>new Date(Date.now()-n*86400000).toISOString();
let counter=0;const check=(condition,message)=>{assert.ok(condition,message);counter++};
function job(id,{status="completed",paid=10000}={}){
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run("c-"+id,"Synthetic "+id,stamp(20));
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run("e-"+id,"c-"+id,status,10000,10000,5000,stamp(15));
 if(paid!==0)db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("p-"+id,"e-"+id,"Cash",paid,"paid",stamp(1));
}
const op=n=>"10000000-0000-4000-8000-"+String(n).padStart(12,"0");
const req=(id,n,customer=id)=>new Request("https://fire.invalid/api/payment-closeouts/snooze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:"e-"+id,customerId:"c-"+customer,operationId:op(n)})});
async function list(){const res=await closeouts.GET();return {res,body:await res.json()};}
const count=(id)=>db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE estimate_id=? AND customer_id=? AND channel='review_snoozed'").get("e-"+id,"c-"+id).n;
const privateReceipt=response=>response.headers.get("cache-control")==="private, no-store"&&
 response.headers.get("vary")==="Cookie"&&response.headers.get("x-content-type-options")==="nosniff";
try{
 job("ready");job("prepared");job("unpaid",{paid:5000});job("draft",{status:"draft"});
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)").run("prepared","c-prepared","e-prepared","text_prepared","review","synthetic, unsent",stamp(1));
 let state=await list();
 check(state.body.actions.some(x=>x.estimateId==="e-ready")&&state.body.actions.some(x=>x.estimateId==="e-prepared"),"Ready and prepared jobs visible initially");
 const before={reads,writes};
 user=null;
 const anonymous=await snooze.POST(req("ready",1));
 check(anonymous.status===401&&reads===before.reads&&writes===before.writes,"No anonymous snooze or database access");
 check(privateReceipt(anonymous),"Anonymous owner review action denial is session-private and nosniff");
 user={email:"notowner@example.invalid"};check((await snooze.POST(req("ready",1))).status===401&&reads===before.reads&&writes===before.writes,"Wrong owner rejected before DB");
 for(const malformedOwner of [{},{email:47},{email:null}]){
  user=malformedOwner;
  const denied=await snooze.POST(req("ready",1));
  check(denied.status===401,"Malformed owner principal cannot snooze a review");
  check(privateReceipt(denied),"Malformed owner denial remains session-private and nosniff");
  check(reads===before.reads&&writes===before.writes,"Malformed owner identity touches no D1");
 }
 user={email:"kylebrooks8605@gmail.com"};
 // The route itself rejects malformed/oversized owner bytes before D1.
 for(const [label,body,headers,expected] of [
  ["declared oversized body","{}",{"content-length":"4097"},413],
  ["actual oversized stream"," ".repeat(4097),{},413],
  ["contradictory declared bytes",'{"x":1}',{"content-length":"2"},400],
  ["invalid UTF8",new Uint8Array([123,34,120,34,58,255,125]),{},400],
  ["nonobject JSON","[]",{},400],
 ]){
  const snapshot={reads,writes};
  const r=await snooze.POST(new Request("https://fire.invalid/api/payment-closeouts/snooze",{method:"POST",headers,body}));
  check(r.status===expected,label+" rejected before owner billing reads");
  check(reads===snapshot.reads&&writes===snapshot.writes,label+" touches no financial D1 records");
 }
 const invalid=await snooze.POST(new Request("https://fire.invalid/api/payment-closeouts/snooze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:"e-ready",customerId:"c-ready",operationId:"bad"})}));
 check(invalid.status===400,"No malformed operation IDs");
 check(privateReceipt(invalid),"Validation errors cannot be cached or MIME-sniffed across owner sessions");
 const first=await snooze.POST(req("ready",1));const saved=await first.json();
 check(first.status===201&&saved.saved===true&&saved.estimateId==="e-ready"&&saved.customerId==="c-ready","Snooze records authoritative scope");
 check(privateReceipt(first),"Saved review snooze receipt remains private and session-specific");
 check(Date.parse(saved.snoozeUntil)>Date.now()+6*86400000&&Date.parse(saved.snoozeUntil)<Date.now()+8*86400000,"Exactly a seven-day review pause");
 check(count("ready")===1,"One saved reminder and zero sent-message events");
 state=await list();
 check(!state.body.actions.some(x=>x.estimateId==="e-ready")&&state.body.actions.some(x=>x.estimateId==="e-prepared"),"Snoozed job hidden, other ready job retained");
 const replay=await snooze.POST(req("ready",1));check(replay.status===200&&(await replay.json()).snoozeUntil===saved.snoozeUntil&&count("ready")===1,"Uncertain retry reuses the saved receipt");
 check(privateReceipt(replay),"Idempotent saved receipt remains owner-session private");
 check((await snooze.POST(req("prepared",1))).status===409&&count("prepared")===0,"Reused operation cannot snooze another customer/job");
 check((await snooze.POST(req("ready",2))).status===409&&count("ready")===1,"A new operation cannot stack active snoozes");
 check((await snooze.POST(req("unpaid",3))).status===409&&count("unpaid")===0,"Unpaid job cannot receive review snooze");
 check((await snooze.POST(req("draft",4))).status===409&&count("draft")===0,"Uncompleted job cannot receive review snooze");
 check((await snooze.POST(req("ready",5,"prepared"))).status===409,"Job-customer mismatch fails closed");
 db.prepare("UPDATE customer_messages SET body=? WHERE id=?").run(stamp(1),"review-snooze:"+op(1));
 state=await list();check(state.body.actions.some(x=>x.estimateId==="e-ready"),"Expired snooze automatically returns eligible job to action queue");
 const again=await snooze.POST(req("ready",6));check(again.status===201&&count("ready")===2,"Owner may explicitly snooze again once expired");
 const simultaneous=await Promise.all([snooze.POST(req("prepared",7)),snooze.POST(req("prepared",7))]);
 check(simultaneous.map(x=>x.status).sort().join(",")==="200,201"&&count("prepared")===1,"Double-tapped owner save persists only once");
 job("sent");
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)").run("sent-proof","c-sent","e-sent","text_confirmed","review","Synthetic owner send",stamp(1));
 check((await snooze.POST(req("sent",8))).status===409,"Cannot snooze review already confirmed sent");
 job("checkout");
 db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("cs-snooze","e-checkout","balance",10000,"open",stamp(1));
 check((await snooze.POST(req("checkout",9))).status===409,"Open Stripe checkout prevents snooze");
 job("refund");
 db.prepare("INSERT INTO payment_refunds(id,estimate_id,payment_id,amount_cents,mode,status,created_at) VALUES(?,?,?,?,?,?,?)").run("refund-snooze","e-refund","p-refund",1000,"Stripe","pending",stamp(1));
 check((await snooze.POST(req("refund",10))).status===409,"Pending refunds prevent review snooze");
 // A provider-settled refund can precede the corresponding negative ledger
 // entry; the gross payment must NOT qualify it as a fully paid review.
 job("settled-refund");
 db.prepare("INSERT INTO payment_refunds(id,estimate_id,payment_id,amount_cents,mode,status,created_at) VALUES(?,?,?,?,?,?,?)")
  .run("settled-review-refund","e-settled-refund","p-settled-refund",1000,"Stripe","succeeded",stamp(1));
 const refunded=await snooze.POST(req("settled-refund",12));
 check(refunded.status===409&&count("settled-refund")===0,"Successful refund without negative payment ACK blocks review snooze");
 check(privateReceipt(refunded),"Settled-refund rejection is owner-private");
 // An imported/mislinked invoice must never authorize another customer's
 // paid-review action, even when the estimate gross payment looks complete.
 job("foreign-invoice");
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES(?,?,?,?,?,?,?)")
  .run("foreign-review-invoice","e-foreign-invoice","c-ready","paid",10000,"synthetic-wrong-homeowner",stamp(1));
 check((await snooze.POST(req("foreign-invoice",13))).status===409&&count("foreign-invoice")===0,
  "Cross-customer invoice blocks review snooze without persisting any action");
 // Imported cross-customer message pointers cannot suppress an otherwise
 // eligible homeowner's action.
 job("other-message-owner");
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)")
  .run("foreign-confirmed-review","c-ready","e-other-message-owner","text_confirmed","review","Synthetic wrong-owner reference",stamp(1));
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)")
  .run("foreign-review-snooze","c-ready","e-other-message-owner","review_snoozed","reviewSnooze",new Date(Date.now()+7*86400000).toISOString(),stamp(1));
 const scoped=await snooze.POST(req("other-message-owner",14));
 check(scoped.status===201&&count("other-message-owner")===1,"Another customer's message and snooze cannot block this homeowner's paid-review action");
 check(privateReceipt(scoped),"Correctly scoped owner review receipt is cache-private");
 job("overage");
 db.prepare("INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at) VALUES(?,?,?,?,?,?,?)").run("overage-snooze","payment_overage","Synthetic hold","No real work","c-overage","e-overage",stamp(1));
 check((await snooze.POST(req("overage",11))).status===409,"Overage hold prevents review snooze");
 check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE channel IN ('text_confirmed','email_confirmed') AND id LIKE 'review-snooze:%'").get().n===0,"Snoozes never claim text or email delivery");
 const view=readFileSync("app/dashboard.tsx","utf8");
 const pay=view.slice(view.indexOf("function PaymentsView("),view.indexOf("\nfunction ",view.indexOf("function PaymentsView(")+20));
 check(pay.includes("Snooze 7 days")&&pay.includes('fetch("/api/payment-closeouts/snooze"')&&pay.includes('"fire:attention-saved"'),"Mobile Payments surface saves snooze and refreshes Dashboard and bell");
 check(pay.includes("reviewSnoozeOps.current[item.estimateId]")&&pay.includes("No customer message was sent."),"Uncertain save retries reuse same operation and show no-delivery warning");
 console.log("PASS "+counter+" owner-only review snooze, idempotent receipt, expiry, account holds and live attention contracts; synthetic data only.");
}finally{db.close()}
