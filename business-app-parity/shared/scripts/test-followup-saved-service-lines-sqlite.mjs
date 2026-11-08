/** Actual authenticated Follow-ups API on disposable native SQLite. The
 * shared estimate editor must never receive a summary-only synthetic line.
 * No hosted DB, real message, payout or Stripe interaction.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),route=r.load('app/api/followups/route.ts').GET;
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const quote=()=>({requestId:randomUUID(),customer:'Synthetic follow-up '+randomUUID().slice(0,7),
 email:randomUUID().slice(0,7)+'@example.invalid',items:[
  {name:'House Wash',description:'Originally quoted house washing scope',quantity:1000,unit:'sq ft',totalCents:22000},
  {name:'Gutter Cleaning + Flush',description:'Originally quoted 50 ft',quantity:50,unit:'linear ft',totalCents:7500}
 ],additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:2500});
const get=async q=>{const response=await route(new Request('https://synthetic.invalid/api/followups'+q));return{status:response.status,body:await response.json()};};
const actual=id=>r.db.prepare('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid').all(id);
try{
 const original=quote(),response=await r.post(original);
 eq(response.status,201,'Create synthetic original saved two-service quote');
 const made=await response.json(),saved=actual(made.id);
 eq(saved.length,2,'Database retains two real line UUIDs');
 let result=await get('?estimateId='+made.id);
 eq(result.status,200,'Exact owner Follow-ups lookup succeeds');
 eq(result.body.estimateId,made.id,'Exact lookup remains scoped');
 eq(result.body.estimates.length,1,'Single exact estimate');
 let row=result.body.estimates[0];
 eq(row.subtotalCents,29500,'Saved undiscounted service subtotal');
 eq(row.totalCents,22575,'Owner promotion and bundle total retained below original subtotal');
 eq(row.items.length,2,'Follow-ups includes both real saved services');
 eq(row.items.map(i=>i.id),saved.map(i=>i.id),'No temporary service line IDs');
 eq(row.items.map(i=>i.totalCents),saved.map(i=>i.totalCents),'Exact saved original line cents');
 eq(row.items.map(i=>i.description),saved.map(i=>i.description),'Original quoted scope is not replaced with generic copy');
 eq(row.items.reduce((sum,i)=>sum+i.totalCents,0),row.subtotalCents,'Editor service pricing cannot use discounted summary total');
 eq(row.items.every(item=>item.id&&item.name&&item.unit&&item.quantity>0),true,'Each line has actionable identity and work quantity');
 result=await get('?limit=1');
 eq(result.status,200,'Paginated Follow-ups API still works');
 eq(result.body.estimates[0].items.length,2,'Paginated item membership retained');
 r.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now')").run('fire:business-preferences:v1',JSON.stringify({revision:null,blocks:[],repeatMonths:{}}));
 result=await get('?estimateId='+made.id);
 eq(result.status,200,'Saved repeat preferences do not break saved service rows');
 row=result.body.estimates[0];
 eq(row.items.map(i=>i.id),saved.map(i=>i.id),'Repeat-cadence path preserves saved line IDs');
 eq(row.items.map(i=>i.totalCents),saved.map(i=>i.totalCents),'Repeat-cadence path preserves exact cents');
 eq(Number.isSafeInteger(row.repeatMonths)&&row.repeatMonths>0,true,'Repeat schedule still uses service identities');
 r.setOwner({email:'not-owner@example.invalid'});
 result=await get('?estimateId='+made.id);eq(result.status,401,'Non-owner cannot read quote scope');
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 result=await get('?estimateId=nonexistent');eq(result.status,200,'Missing optional record has empty result, not invented line');
 eq(result.body.estimates.length,0,'No fabricated unknown estimate service lines');
 console.log('PASS '+checks+'/'+checks+' actual Follow-ups SQLite estimate scope: two saved durable item IDs, exact original cents vs discounted total, page/exact lookup, repeat prefs and owner auth.');
}finally{r.db.close();}
