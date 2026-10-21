/** FIRE owner review closeout actions — synthetic SQLite, no real customers or messages. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";
import ts from "typescript";
const db=new DatabaseSync(":memory:");
for(const file of readdirSync("drizzle").filter(name=>name.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+file,"utf8"));
const statements=[];
let owner={email:"kylebrooks8605@gmail.com"};
const env={DB:{prepare(sql){statements.push(sql);return {bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)})};}};}}};
function load(file,imports){
 const exports={};
 const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(!(name in imports))throw Error("Unexpected dependency "+name);return imports[name]},Response,URL});
 return exports;
}
const helpers=load("lib/payment-closeout-actions.ts",{});
const imports={"cloudflare:workers":{env},"../../chatgpt-auth":{getChatGPTUser:async()=>owner},"../../../lib/payment-closeout-actions":helpers};
const api=load("app/api/payment-closeouts/route.ts",imports);
const stamp=d=>new Date(Date.now()-d*86400000).toISOString();
let count=0;
const check=(ok,label)=>{assert.ok(ok,label);count++};
function job(id,{status="completed",paid=10000,total=10000}={}){
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run("c-"+id,"Customer "+id,stamp(12));
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run("e-"+id,"c-"+id,status,total,total,Math.floor(total/2),stamp(12));
 if(paid!==0)db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("p-"+id,"e-"+id,"Wave",paid,"paid",stamp(1));
}
const review=(id,channel)=>db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)").run("m-"+id,"c-"+id,"e-"+id,channel,"review","Synthetic message",stamp(1));
const read=async()=>{const response=await api.GET();return {response,data:await response.json()}};
try{
 job("ready");job("prepared");review("prepared","text_prepared");
 job("confirmed");review("confirmed","email_confirmed");
 job("copy");review("copy","copy");
 job("received");
 db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)").run("received-note","c-received","[FIRE FLAG] REVIEW_RECEIVED",stamp(1));
 job("approved",{status:"approved"});
 job("unpaid",{paid:5000});
 job("overpaid",{paid:12000});
 job("zero",{paid:0,total:0});
 job("pending-refund");
 db.prepare("INSERT INTO payment_refunds(id,estimate_id,payment_id,amount_cents,mode,status,created_at) VALUES(?,?,?,?,?,?,?)").run("r-pending","e-pending-refund","p-pending-refund",1000,"Stripe","pending",stamp(1));
 job("card-open");
 db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("cs-test","e-card-open","balance",10000,"open",stamp(1));
 job("overage");
 db.prepare("INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at) VALUES(?,?,?,?,?,?,?)").run("overage-notification","payment_overage","Overage","Synthetic only","c-overage","e-overage",stamp(1));
 job("refunded");
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("refund-ledger","e-refunded","Refund",-1000,"paid",stamp(1));
 job("tip-only",{paid:0});
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("tip-ledger","e-tip-only","Tip",10000,"paid",stamp(1));
 // A high-volume payment history must not bury an older, valid closeout.
 // Without filtering BEFORE the SQL LIMIT, 210 newer partials hide all ready jobs.
 for(let i=0;i<210;i++){
  job("partial-"+i,{paid:5000});
  db.prepare("UPDATE payments SET created_at=? WHERE id=?").run(stamp(0),"p-partial-"+i);
 }
 let {response,data}=await read();
 check(response.status===200&&response.headers.get("cache-control").includes("no-store"),"Private owner-only successful read");
 check(data.actions.length===3,"Only fully paid ready, prepared, copied jobs appear, even with 210 newer partial payments");
 check(data.mayHaveMore===false,"Partial payment history cannot masquerade as more valid review actions");
 check(data.actions.find(x=>x.estimateId==="e-ready")?.state==="ready","Unrequested job marked ready");
 check(data.actions.find(x=>x.estimateId==="e-prepared")?.state==="prepared","Prepared message not called sent");
 check(data.actions.find(x=>x.estimateId==="e-copy")?.state==="ready","Copy-only history never claims sent");
 check(!data.actions.some(x=>/approved|unpaid|overpaid|zero|pending|card|overage|refunded|tip|confirmed|received/.test(x.estimateId)),"No unfinished, unsafe, refunded or already requested work");
 check(data.actions.every(x=>!["phone","email","body"].some(k=>k in x)),"No customer contact information or message body in action feed");
 check(statements.every(sql=>sql.trim().startsWith("SELECT")),"Endpoint performs no writes");
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)").run("unpaid-balance","e-unpaid","Cash",5000,"paid",stamp(0));
 data=(await read()).data;
 check(data.actions.some(x=>x.estimateId==="e-unpaid"),"Recording manual final payment makes job eligible on refresh");
 review("ready","text_confirmed");
 data=(await read()).data;
 check(!data.actions.some(x=>x.estimateId==="e-ready"),"Confirmation of actual review request clears ready action");
 // More than 200 eligible closeouts must remain reachable in stable pages.
 // Same payment timestamps exercise the estimate-ID cursor tie-breaker.
 const sameStamp=stamp(-0.02);
 for(let i=0;i<205;i++){
  job("older-page-"+String(i).padStart(3,"0"));
  db.prepare("UPDATE payments SET created_at=? WHERE id=?").run(sameStamp,"p-older-page-"+String(i).padStart(3,"0"));
 }
 const firstPage=(await read()).data;
 check(firstPage.actions.length===200&&firstPage.mayHaveMore===true&&typeof firstPage.nextCursor==="string","200 eligible rows expose a real next-page cursor");
 check(firstPage.actions[0].estimateId==="e-older-page-204","Same-timestamp page sort is newest ID first");
 const secondResponse=await api.GET(new Request("https://fire.test/api/payment-closeouts?cursor="+encodeURIComponent(firstPage.nextCursor)));
 const second=await secondResponse.json();
 check(secondResponse.status===200&&second.actions.length>=5&&second.actions.some(x=>x.estimateId==="e-older-page-000"),"The 201st and later eligible closeouts are reachable");
 check(second.actions.every(x=>!firstPage.actions.some(y=>x.estimateId===y.estimateId)),"Keyset pages never duplicate rows with identical payment timestamps");
 check(second.mayHaveMore===false&&second.nextCursor===null,"Final page ends with no next cursor");
 const broken=await api.GET(new Request("https://fire.test/api/payment-closeouts?cursor="+encodeURIComponent("not-a-cursor")));
 check(broken.status===400,"Malformed cursor fails closed before the ledger is read");
 const queries=statements.length;
 owner=null;
 check((await api.GET()).status===401&&statements.length===queries,"Unauthenticated cannot inspect private payment closeouts");
 owner={email:"notowner@example.invalid"};
 check((await api.GET()).status===401&&statements.length===queries,"Other user denied before database read");
 owner={email:"kylebrooks8605@gmail.com"};
 const offline=load("app/api/payment-closeouts/route.ts",{"cloudflare:workers":{env:{DB:{prepare(){throw Error("Unavailable")}}}},"../../chatgpt-auth":{getChatGPTUser:async()=>owner},"../../../lib/payment-closeout-actions":helpers});
 check((await offline.GET()).status===503,"Database outage visible instead of false all-caught-up");
 const dashboard=readFileSync("app/dashboard.tsx","utf8");
 const start=dashboard.indexOf("function PaymentsView("),end=dashboard.indexOf("\nfunction ",start+20);
 const ui=dashboard.slice(start,end);
 check(ui.includes("fetch(\"/api/payment-closeouts\"")&&ui.includes("Paid jobs · review follow-up"),"Payments view loads and presents closeout queue");
 check(ui.includes("openEstimate=")&&ui.includes("encodeURIComponent(item.estimateId)"),"Queue links directly to exact job");
 check(ui.includes('onRecorded={()=>void load()}'),"Manual payment refresh includes closeout queue");
 check(ui.includes("Other payment records remain available."),"Review-feed failure does not hide payment history");
 check(ui.includes("sending not confirmed")&&ui.includes("Nothing is sent automatically"),"Unverified delivery never claimed");
 console.log("PASS "+count+" owner closeout action checks, synthetic SQLite, authorization, lifecycle and payments screen contracts.");
}finally{db.close();}
