/** Real owner followups GET, disposable native SQLite, no Cloudflare or customer data.
 * Verify session-private responses, 50/10 paging, exact saved service history,
 * focused lookup, cross-customer invoice refusal, and D1 failure behavior.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db,route=rt.load('app/api/followups/route.ts');
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const get=(query='')=>route.GET(new Request('https://synthetic.invalid/api/followups'+query));
const secure=(response,label)=>{
  eq(response.headers.get('cache-control'),'private, no-store',label+' is not cacheable');
  eq(response.headers.get('vary'),'Cookie',label+' varies by session');
  eq(response.headers.get('x-content-type-options'),'nosniff',label+' forbids MIME sniff');
};
try{
  rt.setOwner(null);
  let before=rt.counters(),r=await get();
  eq(r.status,401,'Anonymous owner follow-up access is denied');
  secure(r,'Anonymous denial');
  eq(rt.counters(),before,'Anonymous request never touches D1');
  rt.setOwner({email:'nonowner@invalid.example'});
  r=await get();
  eq(r.status,401,'Distinct nonowner cannot retrieve customer follow-ups');
  secure(r,'Nonowner denial');
  rt.setOwner({email:'kylebrooks8605@gmail.com'});
  for(const q of ['?limit=0','?limit=51','?estimateId=bad%20id','?estimateId=a&limit=1','?cursor=%23broken']){
    before=rt.counters();r=await get(q);
    eq(r.status,400,'Invalid followup request refused: '+q);
    secure(r,'Validation denial');
    eq(rt.counters(),before,'Invalid query cannot inspect private D1');
  }
  const customer='followup-owner-1';
  db.prepare('INSERT INTO customers(id,name,email,phone,created_at) VALUES(?,?,?,?,?)')
    .run(customer,'Synthetic Follow-up','followup@invalid.example','9180000000','2026-01-01T00:00:00.000Z');
  for(let n=0;n<60;n++){
    const id='synthetic-followup-'+String(n).padStart(3,'0');
    const createdAt=new Date(Date.UTC(2026,0,1,0,n)).toISOString();
    db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,share_token,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id,customer,'sent',15000,0,15000,7500,'followup-private-token-'+n,createdAt);
    for(const [i,name,price] of [[0,'House washing',10000],[1,'Gutter clean-out',5000]])
      db.prepare('INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES(?,?,?,?,?,?,?)')
        .run(id+'-line-'+i,id,name,'Synthetic '+name,1,'job',price);
  }
  eq(db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n,60,'Every original quote exists');
  eq(db.prepare('SELECT COUNT(*) AS n FROM estimate_items').get().n,120,'Every original service exists');
  before=rt.counters();
  r=await get('?limit=50');
  eq(r.status,200,'Authenticated owner sees follow-up history');
  secure(r,'Owner follow-up history');
  const p1=await r.json();
  eq(p1.estimates.length,50,'First follow-up page retains exact 50-row limit');
  eq(p1.estimates[0].id,'synthetic-followup-059','Newest follow-up first');
  eq(p1.estimates.at(-1).id,'synthetic-followup-010','50th follow-up last');
  eq(p1.estimates.every(e=>e.items.length===2),true,'Both persisted service lines retained in all 50 records');
  eq(p1.estimates.every(e=>e.items[0].name==='House washing'&&e.items[1].name==='Gutter clean-out'),true,'Every service keeps original order');
  eq(p1.estimates.every(e=>e.items.reduce((sum,x)=>sum+Number(x.totalCents),0)===15000),true,'Services preserve exact cents');
  eq(p1.estimates.every(e=>e.customerId===customer&&e.shareToken.startsWith('followup-private-token-')),true,'Original private owner/customer token links untouched');
  eq(typeof p1.nextCursor,'string','Owner receives an opaque page cursor');
  r=await get('?cursor='+encodeURIComponent(p1.nextCursor));
  eq(r.status,200,'Older follow-ups load successfully');
  secure(r,'Older follow-up page');
  const p2=await r.json();
  eq(p2.estimates.length,10,'Second page retains all ten old follow-ups');
  eq(p2.estimates.at(-1).id,'synthetic-followup-000','Oldest original quote remains retrievable');
  eq(p2.nextCursor,null,'No false third page');
  r=await get('?estimateId=synthetic-followup-005');
  eq(r.status,200,'Exact focused lookup works for owner reminders');
  secure(r,'Focused owner follow-up');
  const focus=await r.json();
  eq(focus.estimates.length,1,'Focused lookup returns one exact quote');
  eq(focus.estimates[0].id,'synthetic-followup-005','Focused quote is never replaced by another customer');
  eq(focus.estimates[0].items.length,2,'Focused editor receives actual stored services');
  eq(rt.counters().writes,before.writes,'Paging and focused reads cannot modify financial rows');
  const foreign='followup-foreign';
  db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(foreign,'Synthetic Foreign','2026-01-01');
  db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('followup-foreign-invoice','synthetic-followup-005',foreign,'sent',15000,'foreign-invoice-token','2026-01-01');
  r=await get('?estimateId=synthetic-followup-005');
  eq(r.status,409,'Cross-customer invoice mismatch blocks follow-up editor');
  secure(r,'Foreign invoice refusal');
  eq((await r.json()).error.includes('different customer'),true,'Mismatch returns clear owner recovery warning');
  eq(rt.counters().writes,before.writes,'Foreign association never triggers an automatic database repair');
  const prepare=rt.env.DB.prepare;
  rt.env.DB.prepare=()=>{throw Error('Synthetic D1 error')};
  try{
    r=await get();
    eq(r.status,503,'D1 outage does not falsely claim empty follow-ups');
    secure(r,'D1 failure');
    eq((await r.json()).error,'Follow-up records could not be read.','Failure is actionable without leaking data');
  }finally{rt.env.DB.prepare=prepare;}
  eq(db.prepare('SELECT COUNT(*) AS n FROM estimate_items').get().n,120,'No service rows deleted by search or error');
  console.log('PASS '+checks+'/'+checks+' actual owner followups SQLite privacy/paging/cross-customer isolation, no hosted writes.');
}finally{db.close();}
