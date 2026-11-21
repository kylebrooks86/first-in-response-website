/** Actual owner GET /api/estimates with native disposable SQLite, NO HOSTED DATA.
 * Protect private customer/share-token responses from caches and keep the
 * 100-card API's service-line query bounded to exactly the same 100 quotes.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db;
const route=rt.load('app/api/estimates/route.ts');
let checks=0,childRowsRead=-1;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const oldBatch=rt.env.DB.batch;
rt.env.DB.batch=async function(statements){
  const result=await oldBatch.call(this,statements);
  if(statements.length===2&&statements[0].sql.includes('FROM estimates e JOIN customers c'))
    childRowsRead=result[1].results.length;
  return result;
};
const response=()=>route.GET();
const stamp=i=>new Date(Date.UTC(2026,0,1+i)).toISOString();
try{
  db.prepare('INSERT INTO customers(id,name,email,phone,created_at) VALUES(?,?,?,?,?)')
    .run('owner-private-estimate-customer','Synthetic QA','test@invalid.example','9180000000',stamp(0));
  // More than the actual 100-row UI limit, each with two separately saved
  // services. Old unbounded query would load all 224 rows into memory.
  for(let n=0;n<112;n++){
    const id='owner-test-estimate-'+String(n).padStart(4,'0');
    const at=stamp(n);
    db.prepare(`INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,share_token,created_at)
      VALUES(?,'owner-private-estimate-customer','draft',15000,0,15000,7500,?,?)`)
      .run(id,'private-token-'+n,at);
    for(const [i,label,price] of [[0,'House washing',10000],[1,'Gutter cleaning',5000]])
      db.prepare(`INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents)
        VALUES(?,?,?,?,?,?,?)`).run(id+'-service-'+i,id,label,label+' synthetic scope',1,'job',price);
  }
  eq(db.prepare('SELECT COUNT(*) AS total FROM estimates').get().total,112,
    'All 112 historical quotes remain durable and unchanged');
  eq(db.prepare('SELECT COUNT(*) AS total FROM estimate_items').get().total,224,
    'All 224 historical service lines remain durable before list reads');

  rt.setOwner(null);
  let before=rt.counters();
  let r=await response();
  eq(r.status,401,'Anonymous estimate roster GET is refused before D1');
  eq(r.headers.get('cache-control'),'private, no-store','Anonymous 401 cannot be cached');
  eq(r.headers.get('vary'),'Cookie','Anonymous estimate denial varies by session');
  eq(rt.counters(),before,'Anonymous list reads no D1 customer or financial rows');
  rt.setOwner({email:'different@invalid.example'});
  r=await response();
  eq(r.status,401,'Genuine nonowner identity cannot read financial/customer roster');
  for(const [label,malformed] of [['missing',{}],['null',{email:null}],['numeric',{email:42}],['object',{email:{}}]]){
    rt.setOwner(malformed);
    before=rt.counters();
    r=await response();
    eq(r.status,401,'Malformed '+label+' owner principal cannot list private estimates');
    eq(r.headers.get('cache-control'),'private, no-store','Malformed '+label+' estimate denial stays private');
    eq(r.headers.get('vary'),'Cookie','Malformed '+label+' estimate denial varies by session');
    eq(r.headers.get('x-content-type-options'),'nosniff','Malformed '+label+' estimate denial is nosniff');
    eq(rt.counters(),before,'Malformed '+label+' owner principal cannot read or write D1');
  }
  // Malformed owner-session gateway responses must deny BOTH private quote
  // list and new estimate creation before any customer D1 access.
  for(const [label,identity] of [
    ['email getter exception',{get email(){throw Error('Synthetic owner email unavailable');}}],
    ['rejected session promise',{then(_ok,reject){reject(Error('Synthetic owner session service down'));}}],
  ]){
    rt.setOwner(identity);
    const beforeBroken=rt.counters();
    const deniedList=await route.GET();
    eq(deniedList.status,401,label+' estimate list denied');
    eq(deniedList.headers.get('cache-control'),'private, no-store',label+' GET is private');
    const deniedCreate=await route.POST(new Request('https://synthetic.invalid/api/estimates',{
      method:'POST',headers:{'content-type':'application/json'},body:'{}'
    }));
    eq(deniedCreate.status,401,label+' estimate create denied');
    eq(deniedCreate.headers.get('cache-control'),'private, no-store',label+' POST is private');
    eq(deniedCreate.headers.get('vary'),'Cookie',label+' POST varies by session');
    eq(deniedCreate.headers.get('x-content-type-options'),'nosniff',label+' POST nosniff');
    eq(rt.counters(),beforeBroken,label+' never reads or mutates customer/estimate D1');
  }
  rt.setOwner({email:'kylebrooks8605@gmail.com'});

  before=rt.counters();
  r=await response();
  eq(r.status,200,'Real owner estimate roster loads successfully');
  eq(r.headers.get('cache-control'),'private, no-store','Owner roster never cached');
  eq(r.headers.get('vary'),'Cookie','Private owner list varies with authentication');
  eq(r.headers.get('x-content-type-options'),'nosniff','Private roster cannot be MIME sniffed');
  const list=(await r.json()).estimates;
  eq(list.length,100,'UI remains deliberately limited to 100 estimates');
  eq(childRowsRead,200,'Worker loads 200 matching service lines, not all 224 history rows');
  eq(list[0].id,'owner-test-estimate-0111','Newest saved quote appears first');
  eq(list.at(-1).id,'owner-test-estimate-0012','100th latest quote is retained');
  eq(list.every(q=>q.items.length===2),true,'Both original service lines retained per visible quote');
  eq(list.every(q=>q.items[0].name==='House washing'&&q.items[1].name==='Gutter cleaning'),true,
    'Saved line order and service names preserved for each quote');
  eq(list.every(q=>q.customerId==='owner-private-estimate-customer'&&q.customer==='Synthetic QA'),true,
    'Private customer relationship retained only for owner');
  eq(list.every(q=>q.items.reduce((a,item)=>a+item.totalCents,0)===q.subtotalCents),true,
    'Original item cents still reconcile to displayed quote subtotal');
  eq(list.some(q=>q.id==='owner-test-estimate-0000'),false,
    'Old historical quote remains off the bounded dashboard response');
  eq(db.prepare('SELECT COUNT(*) AS total FROM estimate_items').get().total,224,
    'Bounded read does not delete old service lines or customer history');
  eq(rt.counters().writes,before.writes,'Owner estimate listing never mutates D1');

  // Fail-closed private no-store response on SQL outage: no misleading
  // empty-list success and no accidental cacheable financial error.
  rt.env.DB.batch=async()=>{throw Error('Synthetic D1 unavailable')};
  r=await response();
  eq(r.status,503,'Unavailable D1 does not claim successfully empty estimates');
  eq(r.headers.get('cache-control'),'private, no-store','Financial list failure cannot be cached');
  eq((await r.json()).estimates.length,0,'Failure preserves existing response shape for UI recovery');
  console.log('PASS '+checks+'/'+checks+
    ' actual owner estimates route/native SQLite: 100 quote cards/200 service lines instead of 224, no-store auth, exact cents, nonowner zero reads and fail-closed D1; NO HOSTED OPERATIONS.');
}finally{rt.env.DB.batch=oldBatch;db.close();}
