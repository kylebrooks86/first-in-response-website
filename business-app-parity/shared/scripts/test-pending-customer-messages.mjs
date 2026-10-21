/** Owner-only SMS / email prepared-message recovery, synthetic native SQLite. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
import vm from "node:vm";

const db=new DatabaseSync(":memory:");
for(const file of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+file,"utf8"));
let owner={email:"kylebrooks8605@gmail.com"},queries=[];
const DB={prepare(sql){queries.push(sql);return {bind(...args){return {
 first:async()=>db.prepare(sql).get(...args),
 all:async()=>({results:db.prepare(sql).all(...args)}),
 run:async()=>{const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes}}}
};}};}};
function loadRoute(dbResource=DB) {
 const code=ts.transpileModule(readFileSync("app/api/customer-messages/route.ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:key=>{
  if(key==="cloudflare:workers")return {env:{DB:dbResource}};
  if(key==="../../chatgpt-auth")return {getChatGPTUser:async()=>owner};
  if(key==="../../../lib/customer-review-invite.mjs")return {shouldOfferReviewAfterPayment:()=>false};
  throw Error("Unexpected import "+key);
 },Response,URL,crypto});
 return exports;
}
const api=loadRoute();
const stamp=n=>new Date(Date.now()-n*3600000).toISOString();
const customer=id=>db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run(id,"Synthetic "+id,stamp(120));
const job=(id,c)=>db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run(id,c,"completed",20000,20000,10000,stamp(96));
const message=(id,c,e,channel,at=1)=>db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)").run(id,c,e,channel,"review","Review my exact prepared text "+id,stamp(at));
const read=async(c,e,cursor)=>{const params=new URLSearchParams({customerId:c,estimateId:e??""});if(cursor!==undefined)params.set("cursor",cursor);const q="https://fire.example.invalid/api/customer-messages?"+params.toString();const r=await api.GET(new Request(q));return {response:r,data:await r.json()}};
let n=0;const check=(truth,label)=>{assert.ok(truth,label);n++};
try{
 customer("c1");customer("c2");job("e1","c1");job("e2","c1");job("foreign","c2");
 message("first","c1","e1","text_prepared",8);
 message("other-job","c1","e2","text_prepared",2);
 message("other-customer","c2","foreign","email_prepared",1);
 message("copied","c1","e1","copy",1);
 message("confirmed-prep","c1","e1","email_prepared",2);
 message("confirmed-prep:owner-confirmed","c1","e1","email_confirmed",1);
 message("no-job","c1",null,"text_prepared",3);
 message("unconfirmed-email","c1","e1","email_prepared",1);
 let {response,data}=await read("c1","e1");
 check(response.status===200&&response.headers.get("cache-control").includes("no-store"),"Private owner-only no-store response");
 check(data.pending.length===2&&data.pending[0].id==="unconfirmed-email"&&data.pending[1].id==="first","Only correct customer/job, unconfirmed prepared messages sorted newest first");
 const cancel=async(messageId,customerId,flags={ownerConfirmedNotSent:true})=>{
  const request=new Request("https://fire.example.invalid/api/customer-messages",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({preparedMessageId:messageId,customerId,...flags})});
  const response=await api.PATCH(request);return {response,data:await response.json()};
 };
 let discard=await cancel("unconfirmed-email","c1");
 check(discard.response.status===200&&discard.data.cancelled===true&&discard.data.message.channel==="send_cancelled","Explicit owner cancel saves immutable audit receipt");
 check(discard.data.message.id==="unconfirmed-email:owner-cancelled","Cancel receipt uses exact linked identity");
 check(db.prepare("SELECT body FROM customer_messages WHERE id=?").get("unconfirmed-email").body.includes("Review my exact"),"Original prepared text is never deleted");
 discard=await cancel("unconfirmed-email","c1");
 check(discard.response.status===200&&db.prepare("SELECT COUNT(*) AS c FROM customer_messages WHERE id=?").get("unconfirmed-email:owner-cancelled").c===1,"Uncertain retry cannot duplicate a cancellation");
 let rejected=await cancel("unconfirmed-email","c2");
 check(rejected.response.status===409,"Other customer cannot cancel prepared messages");
 rejected=await cancel("confirmed-prep","c1");
 check(rejected.response.status===409,"Confirmed sent messages cannot later be discarded");
 rejected=await cancel("unconfirmed-email","c1",{ownerConfirmedSent:true,ownerConfirmedNotSent:true});
 check(rejected.response.status===400,"Contradictory owner intent is refused");
 ({response,data}=await read("c1","e1"));
 check(data.pending.length===1&&data.pending[0].id==="first","Canceled draft is hidden from pending recovery, other drafts remain");
 const confirmation=await cancel("unconfirmed-email","c1",{ownerConfirmedSent:true,ownerConfirmedNotSent:false});
 check(confirmation.response.status===409,"Canceled unsent draft cannot later receive a sent-confirmed receipt");
 check(data.pending[0].body==="Review my exact prepared text first","Exact remaining prepared body available for owner to review before manual confirmation");
 check(!data.pending.some(m=>m.id==="confirmed-prep"||m.id==="unconfirmed-email"||m.id==="copied"||m.id==="other-job"||m.id==="other-customer"),"Already-confirmed, copied, wrong-job and wrong-customer data excluded");
 ({response,data}=await read("c1",""));
 check(response.status===200&&data.pending.length===1&&data.pending[0].id==="no-job","Customer-only composer sees only its customer-level prepared messages");
 ({response,data}=await read("c2","foreign"));
 check(data.pending.length===1&&data.pending[0].id==="other-customer","Second customer's own history is available in its own exact scope");
 check((await read("c1","foreign")).response.status===409,"Foreign estimate rejected for selected customer");
 check((await read("missing","e1")).response.status===404,"Missing customer rejected");
 check((await read("c1","x".repeat(129))).response.status===400,"Overlong IDs refused");
 const before=queries.length;
 owner=null;check((await read("c1","e1")).response.status===401&&queries.length===before,"Unauthenticated session cannot read drafts");
 owner={email:"nonowner@example.invalid"};check((await read("c1","e1")).response.status===401&&queries.length===before,"Non-owner cannot read drafts");
 owner={email:"kylebrooks8605@gmail.com"};
 for(let i=0;i<13;i++)message("many-"+i,"c1","e1","text_prepared",0);
 ({response,data}=await read("c1","e1"));
 check(data.pending.length===10,"Large message history remains bounded to the latest ten prepared messages");
 check(data.mayHaveMore===true&&typeof data.nextCursor==="string","First prepared page advertises older drafts with an exact cursor");
 const firstIds=data.pending.map(item=>item.id);
 const older=await read("c1","e1",data.nextCursor);
 check(older.response.status===200&&older.data.pending.length>=4,"Unconfirmed drafts beyond the first 10 remain recoverable");
 check(older.data.pending.some(item=>item.id==="first"),"Oldest saved unconfirmed message remains accessible");
 check(older.data.pending.every(item=>!firstIds.includes(item.id)&&item.customerId==="c1"&&item.estimateId==="e1"),"Keyset pages stay scoped and never duplicate prepared messages");
 check(older.data.nextCursor===null&&older.data.mayHaveMore===false,"Final pending-message page ends without a false next cursor");
 const rejectedCursor=await read("c1","e1","wrong-cursor");
 check(rejectedCursor.response.status===400&&((rejectedCursor.data.error??"").includes("cursor")),"Malformed cursor fails closed");
 const foreignCursor=await read("c2","foreign",data.nextCursor);
 check(foreignCursor.response.status===200&&foreignCursor.data.pending.every(item=>item.customerId==="c2"),"A valid cursor cannot reveal another customer's message history");
 check(queries.some(q=>q.includes("INSERT OR IGNORE"))&&db.prepare("SELECT channel FROM customer_messages WHERE id=?").get("unconfirmed-email:owner-cancelled").channel==="send_cancelled","Only explicit owner cancellation adds one audit event");
 const outage=loadRoute({prepare(){throw Error("Database unavailable");}});
 const fail=await outage.GET(new Request("https://fire.example.invalid/api/customer-messages?customerId=c1&estimateId=e1"));
 check(fail.status===503&&((await fail.json()).error??"").includes("No send is assumed"),"Database outage never claims delivery or shows stale records");
 const dashboard=readFileSync("app/dashboard.tsx","utf8");
 const a=dashboard.indexOf("function MessageComposer("),z=dashboard.indexOf("\nfunction ",a+20),ui=dashboard.slice(a,z);
 check(ui.includes('fetch("/api/customer-messages?"+query.toString()')&&ui.includes('cache:"no-store"'),"Composer fetches fresh exact-owner saved draft history on reopening");
 check(ui.includes("Saved messages awaiting confirmation")&&ui.includes("Resume ")&&ui.includes("setPreparedMessage(item)"),"Mobile owner can resume selected message without generating a new send event");
 check(ui.includes("Load older prepared messages")&&ui.includes("loadOlderPendingMessages")&&ui.includes("pendingNextCursor"),"Mobile owner can deliberately retrieve older saved drafts");
 check(ui.includes("pendingPageRequest.current++")&&ui.includes("pendingOlderLock.current"),"Late page results cannot replace a newer customer/job scope");
 check(ui.includes("Previously loaded drafts remain available.")&&ui.includes("setPendingMessages(current=>{"),"Interrupted older-page read preserves confirmed existing draft history");
 check(ui.includes('Only confirm if you actually sent it.')&&ui.includes('Sending is not confirmed.'),"Resumed draft is not recorded as delivered automatically");
 check(ui.includes('current.filter(item=>item.id!==preparedMessage.id)'),"Confirmed messages leave the pending recovery UI only after owner save");
 check(ui.includes("Discard unsent draft")&&ui.includes("ownerConfirmedNotSent:true")&&ui.includes("draft.id+\":owner-cancelled\""),"Mobile composer offers explicit owner-only discard with linked server receipt");
 check(dashboard.includes('draft discarded')&&dashboard.includes('Owner-confirmed not sent'),"Customer timeline shows discarded-not-sent status, never delivered");
 console.log("PASS "+n+" synthetic scoped SMS/email prepared-message recovery, authorization, history, no-write and mobile composer contracts.");
}finally{db.close();}
