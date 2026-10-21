/** Synthetic SQLite/idempotency checks: preparing a customer text/email never sends it. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";
import ts from "typescript";
import {shouldOfferReviewAfterPayment} from "../lib/customer-review-invite.mjs";
const db=new DatabaseSync(":memory:");
for(const name of readdirSync("drizzle").filter(n=>n.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+name,"utf8"));
let owner={email:"kylebrooks8605@gmail.com"},writes=0,queries=0;
const env={DB:{prepare(sql){queries++;return {bind(...args){const stmt=db.prepare(sql);return {
 first:async()=>stmt.get(...args)??null,
 run:async()=>{const result=stmt.run(...args);writes+=result.changes;return {meta:{changes:result.changes}}}
 };}};}}};
const code=ts.transpileModule(readFileSync("app/api/customer-messages/route.ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};
vm.runInNewContext(code,{exports:module.exports,require:key=>{
 if(key==="cloudflare:workers")return {env};
 if(key==="../../chatgpt-auth")return {getChatGPTUser:async()=>owner};
 if(key==="../../../lib/customer-review-invite.mjs")return {shouldOfferReviewAfterPayment};
 throw Error("Unexpected import "+key);
},Response,crypto:{randomUUID:()=> "legacy-test-id-"+(++queries)}});
const api=module.exports;
const at=new Date().toISOString();
function job(id,who,paid){db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run(who,"Fixture "+who,at);
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run(id,who,"completed",10000,10000,5000,at);
 if(paid)db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("p-"+id,id,"Cash",paid,"paid",at);
}
job("job1","alice",10000);job("job2","bob",10000);
db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run("job3","alice","completed",10000,10000,5000,at);
db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("p-job3","job3","Cash",10000,"paid",at);
const uid=i=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0");
const payload={customerId:"alice",estimateId:"job1",channel:"text_prepared",template:"review",body:"Please leave an honest review."};
async function post(data){const response=await api.POST(new Request("https://fire.test/api/customer-messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)}));return {status:response.status,data:await response.json()}}
const count=id=>db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE id=?").get(id).n;
let n=0;const check=(ok,label)=>{assert.ok(ok,label);n++};
try{
 const id="owner-message-prep:"+uid(1);
 let first=await post({...payload,requestId:uid(1)});
 check(first.status===201&&first.data.message.id===id&&count(id)===1,"First review text preparation writes exactly one immutable record");
 check(first.data.message.channel==="text_prepared"&&first.data.message.template==="review","Preparation never claims a sent message");
 const lostAck=await post({...payload,requestId:uid(1)});
 check(lostAck.status===200&&lostAck.data.duplicate===true&&lostAck.data.message.createdAt===first.data.message.createdAt&&count(id)===1,"Lost acknowledgement returns original receipt without second write");
 const beforeWrites=writes;
 const conflict=await post({...payload,body:"Different review text",requestId:uid(1)});
 check(conflict.status===409&&writes===beforeWrites,"Same operation cannot silently prepare different message body");
 check((await post({...payload,channel:"email_prepared",requestId:uid(1)})).status===409,"Same operation cannot cross from text to email");
 check((await post({...payload,customerId:"bob",estimateId:"job2",requestId:uid(1)})).status===409,"Same operation cannot cross customers");
 check((await post({...payload,estimateId:"job3",requestId:uid(1)})).status===409,"Same operation cannot cross jobs even for same customer");
 check((await post({...payload,requestId:"invalid"})).status===400&&writes===beforeWrites,"Invalid retry UUID is rejected with zero writes");
 const id2="owner-message-prep:"+uid(2);
 const both=await Promise.all([post({...payload,channel:"email_prepared",requestId:uid(2)}),post({...payload,channel:"email_prepared",requestId:uid(2)})]);
 check(both.every(x=>[200,201].includes(x.status))&&count(id2)===1,"Two concurrent same-ID email saves create one row");
 check(both.every(x=>x.data.message.id===id2&&x.data.message.channel==="email_prepared"),"Concurrent callers see identical saved receipt");
 const id3="owner-message-prep:"+uid(3);
 const race=await Promise.all([post({...payload,body:"Version A",requestId:uid(3)}),post({...payload,body:"Version B",requestId:uid(3)})]);
 check(race.some(x=>x.status===201)&&race.some(x=>x.status===409)&&count(id3)===1,"Concurrent conflicting preparations do not overwrite one another");
 const closedId=id2+":owner-cancelled";
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)")
   .run(closedId,"alice","job1","send_cancelled","review","Explicit owner discarded unsent draft",at);
 check((await post({...payload,channel:"email_prepared",requestId:uid(2)})).status===409,
   "A discarded draft is not resurrected or handed off by retrying an old operation");
 const id4="owner-message-prep:"+uid(4);
 first=await post({...payload,channel:"copy",requestId:uid(4)});
 const copyAgain=await post({...payload,channel:"copy",requestId:uid(4)});
 check(first.status===201&&copyAgain.status===200&&count(id4)===1&&first.data.message.channel==="copy","Copy logs idempotently without being marked sent");
 check(db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE channel IN ('text_confirmed','email_confirmed')").get().n===0,"No send receipt is created by preparing text, email, or copy");
 db.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,?,?,?,?)")
   .run("pending-after-prep","p-job1","job1",1000,"Stripe","pending",at);
 check((await post({...payload,requestId:uid(1)})).status===409&&count(id)===1,
   "A later pending refund blocks replay handoff of a previously authorized review draft");
 db.prepare("UPDATE payment_refunds SET status='failed' WHERE id=?").run("pending-after-prep");
 db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)")
   .run("checkout-after-prep","job1","balance",10000,"open",at);
 check((await post({...payload,requestId:uid(1)})).status===409,
   "A subsequently opened card checkout blocks retry of a previously prepared review message");
 db.prepare("UPDATE payment_checkout_sessions SET status='expired' WHERE id=?").run("checkout-after-prep");
 let q=queries;
 owner=null;check((await post({...payload,requestId:uid(5)})).status===401&&queries===q,"Anonymous cannot read or write private draft receipts");
 owner={email:"attacker@example.invalid"};check((await post({...payload,requestId:uid(5)})).status===401&&queries===q,"Non-owner cannot read or write private draft receipts");
 owner={email:"kylebrooks8605@gmail.com"};
 const dashboard=readFileSync("app/dashboard.tsx","utf8");
 const a=dashboard.indexOf("function MessageComposer("),b=dashboard.indexOf("\nfunction ",a+20),ui=dashboard.slice(a,b);
 check(ui.includes("preparationLock.current=true")&&ui.includes("if(preparationLock.current)return false"),"Composer prevents double tap while in flight");
 check(ui.includes("uncertainPreparation.current")&&ui.includes("requestId:operation.requestId")&&ui.includes("signature!==signature"),"Composer replays exact request ID and refuses changed uncertain details");
 check(ui.includes('saved.id!=="owner-message-prep:"+operation.requestId')&&ui.includes('saved.body!==body'),"Composer verifies scoped immutable server receipt before opening SMS/Mail");
 check(ui.includes('if(!await log("text_prepared"))return')&&ui.includes('if(!await log("email_prepared"))return'),"External SMS/Email handoff follows only a verified saved record");
 console.log("PASS "+n+" synthetic idempotent message prep, lost acknowledgement, concurrent retries, owner isolation and mobile handoff contracts.");
}finally{db.close()}
