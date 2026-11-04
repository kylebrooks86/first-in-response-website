/** Actual FIRE owner overpayment PATCH on disposable native SQLite.
 * No real customer, hosted Worker, D1, Stripe, external refund or messaging.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(), db=rt.db;
const api=rt.load('app/api/notifications/route.ts');
const stamp='2026-10-20T12:00:00Z';
let checks=0;
function check(ok,message){assert.ok(ok,message);checks++;}
function seed(k,paid=12000,total=10000){
 const cid='c-'+k,eid='e-'+k,nid='n-'+k;
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(cid,'Synthetic '+k,stamp);
 db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)').run(eid,cid,'completed',total,total,Math.floor(total/2),stamp);
 db.prepare('INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)').run('p-'+k,eid,'Cash',paid,'paid',stamp);
 db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES(?,?,?,?,?,?)').run('i-'+k,eid,cid,'sent',total,stamp);
 db.prepare('INSERT INTO notifications(id,type,title,body,customer_id,estimate_id,created_at) VALUES(?,?,?,?,?,?,?)').run(nid,'payment_overage','Overpayment','Synthetic',cid,eid,stamp);
 return{cid,eid,nid};
}
const patch=async (job,mode,amount)=>{const body={estimateId:job.eid,resolveOverpayment:true,reconciliationHandled:true,resolutionMode:mode,...(amount===undefined?{}:{refundAmountCents:amount})};
 const response=await api.PATCH(new Request('https://synthetic.invalid/api/notifications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 return{status:response.status,data:await response.json()};
};
const adjustment=job=>db.prepare("SELECT amount_cents AS cents, provider_id AS providerId FROM payments WHERE estimate_id=? AND type='Refund adjustment'").all(job.eid);
const alert=job=>db.prepare('SELECT resolved_at AS resolvedAt,resolution_note AS resolutionNote FROM notifications WHERE id=?').get(job.nid);
const paid=job=>db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS cents FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").get(job.eid).cents;
const invoiceStatus=job=>db.prepare('SELECT status FROM invoices WHERE estimate_id=?').get(job.eid).status;
try{
 const bad=seed('bad');
 const before=paid(bad);
 for(const input of [null,'2000',2000.75,0,-5,Number.MAX_SAFE_INTEGER+2]){
  const result=await patch(bad,'refund',input);
  check(result.status===400&&adjustment(bad).length===0&&paid(bad)===before&&!alert(bad).resolvedAt,
    'Invalid or fractional cent refund payload cannot mutate billing: '+String(input));
 }
 rt.setOwner(null);
 const denied=await patch(bad,'refund',2000);
 check(denied.status===401&&paid(bad)===before&&!alert(bad).resolvedAt,'Nonowner cannot reconcile a real job');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 const originalBatch=rt.env.DB.batch;
 rt.env.DB.batch=async statements=>statements.map(()=>({success:true,meta:{changes:1}}));
 const falselyAcked=await patch(bad,'refund',2000);
 check(falselyAcked.status===503&&falselyAcked.data.saveUncertain===true,'Nonwriting successful-looking batch never claims refund was recorded');
 check(paid(bad)===before&&adjustment(bad).length===0&&!alert(bad).resolvedAt&&invoiceStatus(bad)==='sent','Uncommitted batch leaves no partial refund adjustment or invoice change');
 rt.env.DB.batch=originalBatch;
 const good=await patch(bad,'refund',2000);
 check(good.status===200&&good.data.ok===true&&good.data.estimateId===bad.eid&&good.data.resolutionMode==='refund'&&good.data.paidCents===10000&&good.data.remainingOverpaymentCount===0,
 'Owner receives exact-identity confirmed refund adjustment');
 check(paid(bad)===10000&&adjustment(bad).length===1&&adjustment(bad)[0].cents===-2000&&invoiceStatus(bad)==='paid',
 'Actual saved refund adjustment is exactly -2000 cents and original invoice amount remains');
 check(adjustment(bad)[0].providerId==='refund-adjustment:'+bad.nid&&alert(bad).resolutionNote==='refund:2000'&&!!alert(bad).resolvedAt,
 'Exact synthetic notification ID ties one completed adjustment to one resolved billing alert');
 const replay=await patch(bad,'refund',2000);
 check(replay.status===404&&adjustment(bad).length===1&&paid(bad)===10000,
 'Repeated already-closed refund cannot make a duplicate money entry');
 const partial=seed('partial');
 const partialResponse=await patch(partial,'refund',3000);
 check(partialResponse.status===200&&partialResponse.data.paidCents===9000&&invoiceStatus(partial)==='partial'&&paid(partial)===9000,
 'A larger already-issued external refund produces an exact partial invoice instead of falsely claiming paid');
 const kept=seed('kept');
 const keptBefore=paid(kept);
 const keepResponse=await patch(kept,'keep');
 check(keepResponse.status===200&&keepResponse.data.ok===true&&keepResponse.data.estimateId===kept.eid&&keepResponse.data.resolutionMode==='keep'&&keepResponse.data.remainingOverpaymentCount===0,
 'Owner can deliberately retain overpayment without a refund adjustment');
 check(adjustment(kept).length===0&&paid(kept)===keptBefore&&alert(kept).resolutionNote==='kept_overpayment',
 'Keep flow preserves existing paid amount and marks exact saved alert');
 const interrupted=seed('interrupted');
 rt.env.DB.batch=async()=>{throw Error('synthetic atomic batch unavailable');};
 const failed=await patch(interrupted,'refund',2000);
 check(failed.status===500&&!alert(interrupted).resolvedAt&&adjustment(interrupted).length===0&&paid(interrupted)===12000&&invoiceStatus(interrupted)==='sent',
 'Failed transaction does not leave an unpaired refund adjustment');
 rt.env.DB.batch=originalBatch;
 const restored=await patch(interrupted,'refund',2000);
 check(restored.status===200&&adjustment(interrupted).length===1&&paid(interrupted)===10000,
 'Deliberate later retry after failed batch produces one correct adjustment');
 const lost=seed('lost');
 rt.env.DB.batch=async statements=>{await originalBatch(statements);throw Error('synthetic lost response after full commit');};
 const responseLost=await patch(lost,'refund',2000);
 check(responseLost.status===500&&adjustment(lost).length===1&&paid(lost)===10000&&invoiceStatus(lost)==='paid'&&!!alert(lost).resolvedAt,
 'Lost acknowledgement after committed atomic batch preserves correct records and no false success');
 rt.env.DB.batch=originalBatch;
 const replayLost=await patch(lost,'refund',2000);
 check(replayLost.status===404&&adjustment(lost).length===1,
 'Reopening saved history after lost acknowledgement prevents duplicate adjustment');
 const source=readFileSync('app/dashboard.tsx','utf8');
 check(source.includes('resolutionMode==="refund"?exactMoneyInputCents(refundAmount):undefined'),
   'Actual owner UI parses refund amount in exact cents instead of rounding');
 const start=source.indexOf('  const resolveOverpayment=async(');
 const entry=source.slice(start,source.indexOf('  return <Dialog open',start));
 check(start>=0&&entry.indexOf('setError("Enter the refund already issued')>=0&&
   entry.indexOf('setError("Enter the refund already issued')<entry.indexOf('mutationLock.current=true'),
   'Malformed owner money gives a short local error before any network submission or uncertain-write warning');
 check(source.includes('result.estimateId!==estimate.id')&&source.includes('result.resolutionMode!==resolutionMode')&&source.includes('result.ok!==true'),
   'Actual UI refuses successful-looking receipt for wrong job or resolution mode');
 check(!source.includes('money(Math.round(Number(amount||0)*100))'),
   'Fee summary never displays silent rounding of unvalidated payment amount');
 const helper=readFileSync('lib/exact-money-input.ts','utf8');
 const compiled=ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {exactMoneyInputCents}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(compiled));
 check(exactMoneyInputCents('20.00')===2000&&exactMoneyInputCents('20.005')===null&&exactMoneyInputCents('1e2')===null,
   'Real owner input parser accepts whole cents and rejects third decimals and exponent money');
}finally{db.close();}
console.log('PASS '+checks+' owner overpayment route/native SQLite exact-cents, atomicity, verified receipts and recovery. NO HOSTED ACTIONS.');
