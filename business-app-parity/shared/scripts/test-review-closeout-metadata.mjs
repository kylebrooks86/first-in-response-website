/** Actual owner list, focused history and customer routes share closeout evidence. */
import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
const queries=[];const env={DB:{prepare(sql){queries.push(sql);const statement={all:async()=>({results:db.prepare(sql).all()}),bind(...args){return {all:async()=>({results:db.prepare(sql).all(...args)}),first:async()=>db.prepare(sql).get(...args)}}};return statement;},batch:async statements=>Promise.all(statements.map(s=>s.all()))}};
let user={email:'kylebrooks8605@gmail.com'};const load=createRouteFixtureLoader(process.cwd(),env,()=>user),routes=['app/api/estimates/route.ts','app/api/estimate-history/route.ts','app/api/customers/route.ts'].map(load);let n=0;const check=(x,label)=>{assert.ok(x,label);n++};
const at='2026-10-22T12:00:00.000Z';
try{
 for(const id of ['c','other'])db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(id,'Synthetic '+id,at);
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e','c','completed',10000,10000,5000,?)").run(at);
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('p','e','Cash',10000,'paid',?)").run(at);
 const read=async()=>{const result=[];for(const route of routes){const response=await route.GET(new Request('http://fixture.local/api/estimate-history?focus=e'));check(response.status===200,'Owner route returns closeout metadata');result.push((await response.json()).estimates.find(e=>e.id==='e'));}return result;};
 for(const row of await read())check(row.pendingRefundCount===0&&row.openCheckoutCount===0&&row.reviewReceivedAt===null&&row.lastReviewRequestAt===null,'No holds and no review flags are explicit, not guessed');
 for(const channel of ['text','email','text_prepared','email_prepared','copy'])db.prepare('INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES(?,?,?,?,?,?,?)').run(channel,'c','e',channel,'review','Synthetic private message',at);
 for(const row of await read())check(row.lastReviewRequestAt===null,'Legacy/prepared/copied review history cannot claim owner-confirmed send');
 db.prepare("INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES('confirmed','c','e','text_confirmed','review','Synthetic private message',?)").run(at);
 db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES('other-note','other','[FIRE FLAG] REVIEW_RECEIVED',?)").run(at);
 for(const row of await read())check(row.lastReviewRequestAt===at&&row.reviewReceivedAt===null,'Confirmed send retained while another customer flag remains isolated');
 db.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES('refund','p','e',1000,'manual','pending',?)").run(at);
 db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES('checkout','e','balance',10000,'open',?)").run(at);
 db.prepare("INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES('received','c','[FIRE FLAG] REVIEW_RECEIVED',?)").run(at);
 for(const row of await read())check(row.pendingRefundCount===1&&row.openCheckoutCount===1&&row.reviewReceivedAt===at&&row.paidCents===10000&&row.totalCents===10000,'All entry points expose same holds and owner flag without changing money');
 check(queries.every(q=>q.trim().startsWith('SELECT')),'Metadata reads never write');const before=queries.length;user=null;for(const route of routes)check((await route.GET(new Request('http://fixture.local/api/estimate-history?focus=e'))).status===401,'Unauthorized reads refused');check(queries.length===before,'Auth refusal precedes DB access');
 console.log(`PASS ${n} actual closeout metadata checks across three owner routes; read only synthetic SQLite.`);
}finally{db.close()}
