/** Actual paginated owner estimate-history GET, native disposable SQLite only.
 * Private customer/share tokens, financials, denied/error responses must not
 * be cached or mixed across owner sessions. Never touches hosted customer data.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db;
const history=rt.load('app/api/estimate-history/route.ts');
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const get=(query='')=>history.GET(new Request('https://synthetic.invalid/api/estimate-history'+query));
const secure=(r,label)=>{
  eq(r.headers.get('cache-control'),'private, no-store',label+' is private and never cached');
  eq(r.headers.get('vary'),'Cookie',label+' varies by authenticated session');
  eq(r.headers.get('x-content-type-options'),'nosniff',label+' cannot be MIME-sniffed');
};
try{
  rt.setOwner(null);
  let before=rt.counters(),r=await get();
  eq(r.status,401,'Anonymous history access is denied before any D1 read');
  secure(r,'Anonymous denial');
  eq(rt.counters(),before,'Anonymous history never queries D1');
  rt.setOwner({email:'other@invalid.example'});
  r=await get();
  eq(r.status,401,'Genuine nonowner cannot read customer or estimate history');
  secure(r,'Nonowner denial');
  rt.setOwner({email:'kylebrooks8605@gmail.com'});
  for(const query of ['?limit=51','?limit=0','?status=invalid','?q='+('x'.repeat(129)),'?cursor=%23not-base64']){
    before=rt.counters();
    r=await get(query);
    eq(r.status,400,'Malformed owner history request is refused: '+query.slice(0,32));
    secure(r,'Owner validation refusal');
    eq(rt.counters(),before,'Invalid filters never read private DB rows');
  }
  const customer='synthetic-history-owner';
  db.prepare('INSERT INTO customers(id,name,email,phone,created_at) VALUES(?,?,?,?,?)')
    .run(customer,'Synthetic History','history@invalid.example','9180000000','2026-01-01T00:00:00.000Z');
  // 60 historical quotes, two real SQLite service lines each. The API's page
  // limit is 50 and the second page must retain the other 10 original quotes.
  for(let n=0;n<60;n++){
    const id='synthetic-history-'+String(n).padStart(3,'0');
    const createdAt=new Date(Date.UTC(2026,0,1,0,n)).toISOString();
    db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,share_token,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id,customer,'draft',15000,0,15000,7500,'private-history-token-'+n,createdAt);
    for(const [i,name,amount] of [[0,'House washing',10000],[1,'Gutter clean-out',5000]])
      db.prepare('INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES(?,?,?,?,?,?,?)')
        .run(id+'-item-'+i,id,name,'Synthetic '+name,1,'job',amount);
  }
  eq(db.prepare('SELECT COUNT(*) AS total FROM estimates').get().total,60,'All 60 estimates physically saved');
  eq(db.prepare('SELECT COUNT(*) AS total FROM estimate_items').get().total,120,'All 120 service lines physically saved');
  before=rt.counters();
  r=await get('?limit=50');
  eq(r.status,200,'Authenticated owner sees first history page');
  secure(r,'Owner history success');
  const page1=await r.json();
  eq(page1.estimates.length,50,'First history page contains exactly 50 estimates');
  eq(page1.estimates[0].id,'synthetic-history-059','Newest estimate first');
  eq(page1.estimates.at(-1).id,'synthetic-history-010','50th newest estimate last');
  eq(page1.estimates.every(e=>e.items.length===2),true,'Every saved estimate retains two ordered service rows');
  eq(page1.estimates.every(e=>e.items[0].name==='House washing'&&e.items[1].name==='Gutter clean-out'),true,'Original service line names and order retained');
  eq(page1.estimates.every(e=>e.items.reduce((sum,line)=>sum+Number(line.totalCents),0)===15000),true,'History service amounts reconcile exactly in cents');
  eq(page1.estimates.every(e=>e.customerId===customer&&e.shareToken.startsWith('private-history-token-')),true,'Saved customer and quote-token associations preserved for owner');
  eq(typeof page1.nextCursor,'string','Owner receives an opaque, bounded next-page cursor');
  const cursor=page1.nextCursor;
  r=await get('?limit=50&cursor='+encodeURIComponent(cursor));
  eq(r.status,200,'Authenticated owner reads second history page');
  secure(r,'Second owner history page');
  const page2=await r.json();
  eq(page2.estimates.length,10,'Second page retains remaining ten old quotes');
  eq(page2.estimates[0].id,'synthetic-history-009','Older history resumes at the next saved quote');
  eq(page2.estimates.at(-1).id,'synthetic-history-000','Oldest saved quote remains available');
  eq(page2.nextCursor,null,'History pagination terminates without repeating earlier records');
  eq(rt.counters().writes,before.writes,'Both history reads preserve every record without writes');
  eq(db.prepare('SELECT COUNT(*) AS total FROM estimate_items').get().total,120,'No old service lines were deleted or changed');
  const originalPrepare=rt.env.DB.prepare;
  rt.env.DB.prepare=()=>{throw Error('Synthetic D1 unavailable')};
  try{
    r=await get();
    eq(r.status,503,'D1 failure returns controlled 503, not a fake empty history');
    secure(r,'D1 failure');
    eq((await r.json()).error,'Estimate history could not be read.','Client can display a recoverable history error');
  }finally{rt.env.DB.prepare=originalPrepare;}
  console.log('PASS '+checks+'/'+checks+' actual estimate-history SQLite paging, exact cents, private no-store GET 200/400/401/503; no hosted changes.');
}finally{db.close();}
