/** Synthetic review STATUS check deferral; never sends reviews. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";
import ts from "typescript";
const db=new DatabaseSync(":memory:");
for(const name of readdirSync("drizzle").filter(x=>x.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+name,"utf8"));
let owner={email:"kylebrooks8605@gmail.com"},reads=0,writes=0,total=0;
const check=(x,n)=>{assert.ok(x,n);total++};
const env={DB:{prepare(sql){return {all:async()=>{reads++;return {results:db.prepare(sql).all()}},bind(...args){return {
 first:async()=>{reads++;return db.prepare(sql).get(...args)??null},
 run:async()=>{writes++;return {meta:{changes:db.prepare(sql).run(...args).changes}}}
}}}}}};
function load(p,deps){const exports={};const code=ts.transpileModule(readFileSync(p,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{exports,require:name=>{if(!(name in deps))throw Error("Unexpected import "+name);return deps[name]},Response,Request,Date});return exports}
const flags=load("lib/customer-activity-flags.ts",{});
const lib=load("lib/dashboard-review-checks.ts",{"./customer-activity-flags":flags});
const view=load("app/api/dashboard-review-checks/route.ts",{"cloudflare:workers":{env},"../../chatgpt-auth":{getChatGPTUser:async()=>owner},"../../../lib/dashboard-review-checks":lib});
const action=load("app/api/dashboard-review-checks/snooze/route.ts",{"cloudflare:workers":{env},"../../../chatgpt-auth":{getChatGPTUser:async()=>owner}});
const stamp=d=>new Date(Date.now()-d*86400000).toISOString();
const op=n=>"10000000-0000-4000-8000-"+String(n).padStart(12,"0");
function setup(id,jobStatus="completed",days=12,channel="text_confirmed"){
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run(id,"Synthetic "+id,stamp(20));
 db.prepare("INSERT INTO estimates(id,customer_id,status,total_cents,subtotal_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run("j-"+id,id,jobStatus,10000,10000,5000,stamp(20));
 const at=stamp(days);
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)").run("m-"+id,id,"j-"+id,channel,"review","Synthetic content",at);
 return at;
}
const req=(id,n,date)=>new Request("https://fire.invalid/api/dashboard-review-checks/snooze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({customerId:id,requestedAt:date,operationId:op(n)})});
const due=async()=>{const resp=await view.GET();return (await resp.json()).checks};
const savedCount=id=>db.prepare("SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id=? AND channel='review_check_snoozed'").get(id).n;
try{
 const at=setup("ready");const draft=setup("draft","completed",12,"text_prepared");
 const unfinished=setup("unfinished","approved");const recent=setup("recent","completed",3);
 const received=setup("received");
 db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)").run("review-received","received","[FIRE FLAG] REVIEW_RECEIVED",stamp(1));
 const initially=await due();check(initially.length===1&&initially[0].customerId==="ready","Only confirmed completed-job review checks are due");
 const snapshot={reads,writes};owner=null;
 check((await action.POST(req("ready",1,at))).status===401&&reads===snapshot.reads&&writes===snapshot.writes,"Anonymous cannot access owner data");
 owner={email:"not-the-owner@example.invalid"};
 check((await action.POST(req("ready",1,at))).status===401&&reads===snapshot.reads&&writes===snapshot.writes,"Wrong owner denied before DB");
 owner={email:"kylebrooks8605@gmail.com"};
 check((await action.POST(req("draft",2,draft))).status===409,"Prepared-only review cannot be deferred");
 check((await action.POST(req("unfinished",3,unfinished))).status===409,"Unfinished job cannot authorize status check");
 check((await action.POST(req("recent",4,recent))).status===409,"Only reviews at least seven days old qualify");
 check((await action.POST(req("received",5,received))).status===409,"Owner-logged received review cannot be deferred");
 const first=await action.POST(req("ready",1,at)),data=await first.json();
 check(first.status===201&&data.saved&&data.customerId==="ready"&&Date.parse(data.snoozeUntil)>Date.now()+6*86400000,"Owner saved a seven-day status check pause");
 check(savedCount("ready")===1&&(await due()).length===0,"Deferral suppresses Dashboard check without creating a message send");
 const rows=db.prepare("SELECT id,estimate_id AS estimateId,channel,template,body,created_at AS createdAt FROM customer_messages WHERE customer_id=?").all("ready");
 check(flags.reviewFollowupEligibility([{id:"j-ready",status:"completed"}],rows,null,Date.now()).status==="waiting","Customer profile agrees with Dashboard on active snooze");
 const replay=await action.POST(req("ready",1,at));
 check(replay.status===200&&(await replay.json()).snoozeUntil===data.snoozeUntil&&savedCount("ready")===1,"Same operation replays saved receipt");
 check((await action.POST(req("unfinished",1,unfinished))).status===409,"Reused operation cannot cross customers");
 check((await action.POST(req("ready",6,at))).status===409,"Cannot stack another active review status snooze");
 db.prepare("UPDATE customer_messages SET body=? WHERE id=?").run(stamp(1),"review-check-snooze:"+op(1));
 check((await due()).some(x=>x.customerId==="ready"),"Expired snooze restores customer review check");
 const again=await action.POST(req("ready",7,at));check(again.status===201&&savedCount("ready")===2,"Can defer anew only after expiration");
 const all=db.prepare("SELECT channel,template FROM customer_messages WHERE id LIKE 'review-check-snooze:%'").all();
 check(all.every(x=>x.channel==="review_check_snoozed"&&x.template==="reviewCheckSnooze"),"Deferrals never claim a review was received or a message sent");
 const dashboard=readFileSync("app/dashboard.tsx","utf8");
 const customerView=dashboard.slice(dashboard.indexOf("function CustomersView("),dashboard.indexOf("\nfunction ",dashboard.indexOf("function CustomersView(")+20));
 check(customerView.includes('fetch("/api/dashboard-review-checks/snooze"')&&customerView.includes("Check later · 7 days"),"Customer profile can defer review checks");
 check(customerView.includes('new Event("fire:attention-saved")')&&customerView.includes("reviewCheckSnoozeAttempt.current"),"Owner saves refresh bell and preserve retry operation identity");
 check(customerView.includes("No message was sent and no review was marked received."),"Uncertain save never claims customer was contacted");
 console.log("PASS "+total+" synthetic review check snooze assertions.");
}finally{db.close();}
