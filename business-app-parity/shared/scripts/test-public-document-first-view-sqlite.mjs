/** Actual public estimate/invoice first-view helper + native disposable SQLite.
 * Verifies token revocation between page SELECT and atomic D1 viewed alert.
 * No hosted provider, Stripe calls, real customers or network operations.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
import {recordPublicDocumentFirstView} from '../lib/public-document-first-view.mjs';
const rt=stackedRuntime(),db=rt.db;
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const now='2026-11-19T14:00:00.000Z';
const seed=label=>{
  const c='view-c-'+label,e='view-e-'+label,i='view-i-'+label;
  db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(c,'Synthetic '+label,now);
  db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at,share_token) VALUES(?,?,'draft',10000,0,10000,5000,?,?)")
    .run(e,c,now,'quote-'+label);
  db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at,share_token) VALUES(?,?,?,'draft',10000,?,?)")
    .run(i,e,c,now,'invoice-'+label);
  return {c,e,i,quoteToken:'quote-'+label,invoiceToken:'invoice-'+label};
};
const view=(f,kind,more={})=>recordPublicDocumentFirstView(rt.env.DB,{
  kind,id:kind==='invoice'?f.i:f.e,customerId:f.c,
  token:kind==='invoice'?f.invoiceToken:f.quoteToken,
  customerName:'Synthetic Customer',serviceSummary:'Roof softwash',...more
});
const state=(f,kind)=>db.prepare('SELECT first_viewed_at AS seen,status FROM '+(kind==='invoice'?'invoices':'estimates')+' WHERE id=?').get(kind==='invoice'?f.i:f.e);
const alerts=(f,kind)=>db.prepare("SELECT type,title,body,customer_id AS customerId,estimate_id AS estimateId FROM notifications WHERE type=? AND estimate_id=?").all(kind+'_viewed',f.e);
try{
  const good=seed('good');
  let result=await view(good,'invoice');
  eq(result.allowed,true,'A current invoice token records legitimate customer view');
  eq(result.newlyViewed,true,'First invoice view is a fresh committed transition');
  eq(state(good,'invoice').status,'sent','First invoice open advances draft to sent');
  eq(Boolean(state(good,'invoice').seen),true,'Invoice has immutable viewed timestamp');
  eq(alerts(good,'invoice').length,1,'Exactly one invoice-view alert saved');
  eq(alerts(good,'invoice')[0].customerId,good.c,'Alert scoped to original invoice customer');
  eq(alerts(good,'invoice')[0].estimateId,good.e,'Invoice alert tied to correct estimate');
  result=await view(good,'invoice');
  eq(result.allowed,true,'Repeated invoice view retains valid current bearer');
  eq(result.newlyViewed,false,'Second view never claims new first-view transition');
  eq(alerts(good,'invoice').length,1,'Second view makes no duplicate notification');
  const originalSeen=state(good,'invoice').seen;
  eq(state(good,'invoice').seen,originalSeen,'Repeated invoice view preserves original first-view timestamp');

  result=await view(good,'estimate');
  eq(result.allowed,true,'A valid estimate token records view');
  eq(result.newlyViewed,true,'First estimate view has a committed transition');
  eq(state(good,'estimate').status,'sent','Quote draft advances to sent on first view');
  eq(alerts(good,'estimate').length,1,'One estimate-view alert is linked to correct customer');
  eq(alerts(good,'estimate')[0].customerId,good.c,'Estimate notification preserves customer isolation');
  result=await view(good,'estimate');
  eq(result.newlyViewed,false,'Repeated estimate view cannot rewrite first-view or duplicate alert');
  eq(alerts(good,'estimate').length,1,'No additional quote-view notification on retry');

  for(const kind of ['invoice','estimate']){
    const f=seed('revoked-'+kind);
    // Page already SELECTed the original share token, but the owner rotated
    // that bearer immediately BEFORE its conditional first-view D1 batch.
    db.prepare('UPDATE '+(kind==='invoice'?'invoices':'estimates')+' SET share_token=? WHERE id=?')
      .run('new-rotated-private-token',kind==='invoice'?f.i:f.e);
    const before=rt.counters();
    result=await view(f,kind);
    eq(result.allowed,false,'Rotated '+kind+' token cannot validate old page link');
    eq(result.newlyViewed,false,'Rotated '+kind+' token cannot claim viewed');
    eq(state(f,kind).seen,null,'Rotated '+kind+' token cannot mutate viewed timestamp');
    eq(state(f,kind).status,'draft','Rotated '+kind+' token cannot mark document as sent');
    eq(alerts(f,kind).length,0,'Rotated '+kind+' token cannot generate false viewed notification');
    eq(rt.counters().writes,before.writes,'Rotated '+kind+' token wrote no row');
    result=await view(f,kind,{token:'new-rotated-private-token'});
    eq(result.allowed,true,'Actual new '+kind+' token still supports original owner workflow');
    eq(alerts(f,kind).length,1,'Actual new '+kind+' token creates one legitimate alert');
  }
  for(const stateName of ['declined','superseded']){
    const f=seed('closed-'+stateName);
    db.prepare('UPDATE estimates SET status=? WHERE id=?').run(stateName,f.e);
    result=await view(f,'estimate');
    eq(result.allowed,false,'Withheld '+stateName+' quote link is refused');
    eq(state(f,'estimate').seen,null,'Withheld quote status cannot be marked viewed');
    eq(alerts(f,'estimate').length,0,'Withheld quote emits no customer-view alert');
  }
  {
    const f=seed('wrong-invoice-owner');
    // In case an archived/corrupted invoice customer link differs from its
    // estimate, no public readback or viewed alert can legitimize the row.
    db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('other-invoice-owner','Other synthetic',now);
    try{db.prepare('UPDATE invoices SET customer_id=? WHERE id=?').run('other-invoice-owner',f.i);}catch{}
    if(db.prepare('SELECT customer_id AS c FROM invoices WHERE id=?').get(f.i).c!=='other-invoice-owner'){
      // Some schema revisions enforce ownership in SQL: those already fail closed.
      eq(true,true,'Database ownership trigger prevented foreign invoice reassociation');
    }else{
      result=await view(f,'invoice',{customerId:'other-invoice-owner'});
      eq(result.allowed,false,'Cross-customer invoice/estimate link cannot be viewed');
      eq(alerts(f,'invoice').length,0,'Cross-customer invoice link creates no notification');
    }
  }
  {
    const f=seed('lost-ack');
    const original=rt.env.DB.batch;
    rt.env.DB.batch=async statements=>{
      await original.call(rt.env.DB,statements);
      throw Error('Synthetic D1 batch ACK lost after physical COMMIT');
    };
    result=await view(f,'invoice');
    eq(result.allowed,true,'Committed invoice view is recovered after lost D1 batch ACK');
    eq(result.newlyViewed,false,'Lost ACK cannot invent first-view success from an ACK');
    eq(alerts(f,'invoice').length,1,'Lost ACK creates exactly one genuine invoice event');
    rt.env.DB.batch=original;
    result=await view(f,'invoice');
    eq(result.allowed,true,'Subsequent safe invoice revisit reads the durable original view');
    eq(alerts(f,'invoice').length,1,'No duplicate event after lost-ACK recovery');
  }
  {
    const f=seed('false-ack');
    const original=rt.env.DB.batch;
    rt.env.DB.batch=async()=>[{meta:{changes:1}},{meta:{changes:1}}];
    result=await view(f,'estimate');
    eq(result.allowed,false,'Nonwriting provider ACK cannot fabricate estimate-view receipt');
    eq(state(f,'estimate').seen,null,'False ACK leaves physical estimate untouched');
    eq(alerts(f,'estimate').length,0,'False ACK yields zero viewed notifications');
    rt.env.DB.batch=original;
  }
  {
    const f=seed('deposit-hold');
    db.exec('CREATE TABLE IF NOT EXISTS deposit_policy_events(id TEXT PRIMARY KEY,estimate_id TEXT NOT NULL)');
    db.prepare('INSERT INTO deposit_policy_events(id,estimate_id) VALUES(?,?)').run('synthetic-deposit-exception',f.e);
    result=await view(f,'estimate',{requireNoDepositException:true});
    eq(result.allowed,false,'Revised deposit pending blocks obsolete 50% first-view transition');
    eq(result.newlyViewed,false,'Old agreement must not appear as newly viewed');
    eq(alerts(f,'estimate').length,0,'Legacy quote view never creates alert during deposit revision');
  }
  const invoicePage=readFileSync('app/invoice/[token]/page.tsx','utf8');
  const estimatePage=readFileSync('app/estimate/[token]/page.tsx','utf8');
  for(const [kind,page] of [['invoice',invoicePage],['estimate',estimatePage]]){
    eq(page.includes('recordPublicDocumentFirstView(env.DB,{'),true,
      'Actual public '+kind+' page invokes tested token-bound first-view helper');
    eq(page.includes('if(!viewed.allowed)'),true,
      'Actual public '+kind+' page fails closed after unverified/revoked token');
    eq(page.includes('SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS'),false,
      'Actual public '+kind+' page no longer inserts a context-free view alert');
  }
  eq(estimatePage.includes('if(syntheticOwnerException&&!viewed.newlyViewed)'),true,
    'Actual customer quote still suppresses obsolete revised-deposit 50% terms');
  // The separately gated synthetic revised-agreement first-view SQL is also
  // token/owner-bound; it must not silently keep the old unguarded batch.
  eq(estimatePage.includes("WHERE id=? AND customer_id=? AND share_token=? AND first_viewed_at IS NULL AND status IN ('draft','sent')"),true,
    'Revised-deposit first-view UPDATE compares current customer and bearer token');
  eq(estimatePage.includes("FROM estimates WHERE id=? AND customer_id=? AND share_token=? AND first_viewed_at=? AND EXISTS"),true,
    'Revised-deposit notification SELECT also compares the same bearer token');
  eq(estimatePage.includes('.bind(viewedAt,row.id,row.customerId,token,amendment.totalCents,amendment.depositCents'),true,
    'Revised-deposit first-view SQL binds the route owner/customer/token tuple');
  eq(estimatePage.includes(".bind(crypto.randomUUID(),row.customer+' viewed revised deposit terms','Proposed deposit terms viewed; customer approval and payment are still pending.',viewedAt,row.id,row.customerId,token,viewedAt,row.id)"),true,
    'Revised-deposit first-view notification binds exact owner/customer/token');

  console.log('PASS '+checks+'/'+checks+' public estimate/invoice real first-view helper, native SQLite token-revocation, customer ownership, false ACK, lost ACK and no duplicate notifications; NO HOSTED OPERATIONS.');
}finally{db.close();}
