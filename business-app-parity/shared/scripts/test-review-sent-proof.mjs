/** Synthetic proof that only owner-confirmed review sends set job review flags.
 * Legacy text/email, copy and prepared records cannot be treated as deliveries. */
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
import vm from "node:vm";
const source=readFileSync("app/api/estimate-history/route.ts","utf8");
const pattern=/\(SELECT MAX\(created_at\) FROM customer_messages cm WHERE cm\.estimate_id=e\.id AND cm\.template='review' AND cm\.channel IN \([^)]+\)\) AS lastReviewRequestAt/;
const expression=source.match(pattern)?.[0];
assert.ok(expression,"Estimate history exposes a review request timestamp");
assert.ok(expression.includes("'text_confirmed','email_confirmed'"),"Only owner-confirmed sending channels count");
assert.ok(!expression.includes("'text','email'"),"Legacy unspecific channels cannot claim delivery");
const db=new DatabaseSync(":memory:");
for(const file of readdirSync("drizzle").filter(name=>name.endsWith(".sql")).sort())db.exec(readFileSync("drizzle/"+file,"utf8"));
const now=Date.now(),date=daysAgo=>new Date(now-daysAgo*86400000).toISOString();
const fixtures=["legacy","prepared","copied","confirmed","mixed"];
try{
 for(const id of fixtures){
  db.prepare("INSERT INTO customers(id,name,created_at) VALUES(?,?,?)").run("c-"+id,"Synthetic "+id,date(20));
  db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)").run("e-"+id,"c-"+id,"completed",10000,10000,5000,date(15));
 }
 const save=(id,channel,days)=>db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)").run(id,"c-"+id.split("-")[0],"e-"+id.split("-")[0],channel,"review","Synthetic only",date(days));
 save("legacy-1","text",15);save("legacy-2","email",13);
 save("prepared-1","text_prepared",10);save("prepared-2","email_prepared",9);
 save("copied-1","copy",7);
 save("confirmed-1","email_confirmed",9);
 save("mixed-1","text",0);save("mixed-2","text_prepared",0);
 save("mixed-3","text_confirmed",3);save("mixed-4","email_confirmed",2);
 const rows=db.prepare("SELECT e.id,"+expression+" FROM estimates e ORDER BY e.id").all();
 const stamp=id=>rows.find(row=>row.id==="e-"+id)?.lastReviewRequestAt??null;
 assert.equal(stamp("legacy"),null,"Older text/email do not imply sent");
 assert.equal(stamp("prepared"),null,"Prepared drafts do not imply sent");
 assert.equal(stamp("copied"),null,"Copy alone does not imply sent");
 assert.equal(stamp("confirmed"),date(9),"Confirmed email sets sent timestamp");
 assert.equal(stamp("mixed"),date(2),"Latest confirmed send wins over newer unconfirmed message");
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync("lib/customer-activity-flags.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 const eligibility=exports.reviewFollowupEligibility;
 assert.equal(eligibility([{status:"completed",lastReviewRequestAt:stamp("legacy")}],[],null,now).status,"not-recorded");
 assert.equal(eligibility([{status:"completed",lastReviewRequestAt:stamp("prepared")}],[],null,now).status,"not-recorded");
 assert.equal(eligibility([{status:"completed",lastReviewRequestAt:stamp("confirmed")}],[],null,now).status,"due");
 assert.equal(eligibility([{status:"completed",lastReviewRequestAt:stamp("mixed")}],[],null,now).status,"waiting");
 const detail=readFileSync("app/dashboard.tsx","utf8");
 assert.ok(detail.includes('estimate.lastReviewRequestAt?"Review requested":"Request review"'),"Owner action label uses the verified timestamp");
 console.log("PASS 10 review-proof checks: confirmed channels only, legacy/prepared/copy never imply sent; real SQLite plus customer follow-up flags.");
}finally{db.close();}
