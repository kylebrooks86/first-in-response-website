/** FIRE independent NEW LIVE owner login must be physically bound to a ready,
 * immutable permanent Job # D1 schema. All checks here are disposable/local;
 * no provider credentials, database writes, or Cloudflare calls.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {jobNumberingReady,JOB_NUMBER_FLAG} from "./shared/lib/job-numbering.mjs";

let checks=0;
const pass=async(description,fn)=>{await fn();checks++;};
const fakeDb=(tables=2,triggers=4,invalid=0)=>{
 const prepared=[];
 return {
  prepared,
  prepare(sql){
   prepared.push(sql);
   if(/sqlite_master/.test(sql))return {first:async()=>({tables,triggers})};
   if(/LEFT JOIN/.test(sql))return {first:async()=>({invalid})};
   throw Error("Unreviewed SQL: "+sql.slice(0,90));
  }
 };
};
const on={FIRE_JOB_NUMBERS_CANDIDATE:JOB_NUMBER_FLAG};
await pass("complete immutable schema",async()=>{
 const db=fakeDb();
 assert.equal(await jobNumberingReady(db,on),true);
 assert.equal(db.prepared.length,2);
 assert(db.prepared.every(sql=>/^SELECT\b/i.test(sql.trim())&&!/^(INSERT|UPDATE|DELETE|DROP)\b/i.test(sql.trim())));
});
await pass("feature flag off means disabled",async()=>{
 const db=fakeDb();
 assert.equal(await jobNumberingReady(db,{}),false);
 assert.equal(db.prepared.length,0);
});
for(const [tables,triggers,invalid] of [[0,4,0],[1,4,0],[2,0,0],[2,3,0],[2,4,1],[2,4,2]]){
 await pass("broken numbered schema or history refuses sign-in",async()=>{
  await assert.rejects(jobNumberingReady(fakeDb(tables,triggers,invalid),on),
   /schema|Historical Job # links/);
 });
}
await pass("provider D1 error fails",async()=>{
 const db={prepare(){return {first:async()=>{throw Error("D1 unavailable")}}}};
 await assert.rejects(jobNumberingReady(db,on),/D1 unavailable/);
});
const auth=readFileSync(new URL("./adapters/independent-live/app/owner-auth.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("./adapters/independent-live/app/api/auth/login/route.ts",import.meta.url),"utf8");
await pass("NEW LIVE is gated by owner authorization and flag",()=>{
 assert.match(auth,/FIRE_NEW_LIVE_AUTH_ENABLED !== "owner-approved"/);
 assert.match(auth,/FIRE_JOB_NUMBERS_CANDIDATE !== "owner-approved-schema-v1"/);
});
await pass("NEW LIVE invokes D1 readiness, catching missing tables or links",()=>{
 assert.match(auth,/async function verifiedNewLiveJobNumberSchema\(\)/);
 assert.match(auth,/await jobNumberingReady\(env.DB,env\)/);
 assert.match(auth,/catch \{ return false; \}/);
});
await pass("Passphrase login checks verified D1",()=>{
 assert.match(auth,/if\(!await verifiedNewLiveJobNumberSchema\(\)\)return false;/);
});
await pass("Passkey, PIN and passphrase login all gate before issuing cookies",()=>{
 const start=route.indexOf("export async function POST");
 const guard=route.indexOf("if(!await verifiedNewLiveJobNumberSchema())",start);
 const quick=route.indexOf("if(quickUnlockEnabled())",start);
 const legacy=route.indexOf("await verifyIndependentPassword",start);
 assert(start>=0&&guard>start&&quick>guard&&legacy>guard);
 assert.match(route.slice(guard,quick),/status:503/);
 assert.match(route.slice(guard,quick),/no-store/);
});
console.log("PASS "+checks+"/"+checks+" NEW LIVE physical Job # sign-in preflight, no hosted side effects");
