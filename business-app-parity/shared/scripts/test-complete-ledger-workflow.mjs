/** Actual authenticated QA app and native D1; no hosted or real records. */
import assert from 'node:assert/strict';
export async function exerciseCompleteLedger({page,context,origin,request,check,originalEstimateId}){
 const created=await request('/api/customers','POST',{name:'Synthetic Complete Ledger',email:'complete-ledger@example.invalid'});assert.equal(created.status(),201);const customer=(await created.json()).customer;
 const create=async name=>{const r=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[{name,quantity:1,unit:'job',totalCents:20000}]});assert.equal(r.status(),201);return r.json();};
 const old=await create('Synthetic Oldest Collectible Job');
 assert.equal((await request('/api/public/estimates/'+old.shareToken+'/accept','POST',{signedName:customer.name,photoRelease:'no',acceptedTerms:true})).status(),200);
 assert.equal((await request('/api/estimates/'+old.id,'PATCH',{scheduledAt:'2026-10-20T15:00:00.000Z'})).status(),200);
 assert.equal((await request('/api/payments','POST',{estimateId:old.id,amountCents:5000,method:'Cash'})).status(),201);
 for(let offset=0;offset<224;offset+=8)await Promise.all(Array.from({length:Math.min(8,224-offset)},(_,i)=>create('Synthetic Ledger Quote '+String(offset+i).padStart(3,'0'))));
 const limited=await (await request('/api/estimates')).json();check(limited.estimates.length===100&&!limited.estimates.some(row=>row.id===old.id),'Synthetic fixture reproduces the legacy 100-record cutoff');
 let cursor=null;const ids=new Set();let pages=0;
 do{const r=await request('/api/estimate-history?limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(r.status(),200);check(r.headers()['cache-control']==='no-store','Authenticated history page is not cacheable');const data=await r.json();assert.ok(data.estimates.length<=50);for(const row of data.estimates){assert.ok(!ids.has(row.id));ids.add(row.id);}cursor=data.nextCursor;pages++;}while(cursor);
 check(ids.size===226&&pages===5&&ids.has(old.id)&&ids.has(originalEstimateId),'Native D1 keyset pages cover every synthetic record exactly once');
 const navigate=async tab=>{await page.setViewportSize({width:390,height:844});await page.goto(origin+'/');await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:tab,exact:true}).first().click();};
 await navigate('Payments');await page.getByRole('heading',{name:'Collectible job balances',exact:true}).waitFor();
 const metric=label=>page.locator('.business-metrics>article').filter({has:page.getByText(label,{exact:true})}).locator('strong');
 for(const width of [320,390,768,1366]){
   await page.setViewportSize({width,height:900});
   check(await metric('Collectible job balance').innerText()==='$150'&&await metric('Deposit still required').innerText()==='$50'&&await metric('Principal paid (net refunds)').innerText()==='$50','Urgent financial totals include the oldest job at '+width);
   const extra=page.locator('details.payments-secondary-metrics');
   check(await extra.evaluate(node=>!node.open),'Secondary accounting totals are optional initially at '+width);
   await extra.locator('summary').click();
   check(await metric('Potential estimate value').innerText()==='$45,050','Complete financial totals still include all 226 estimates after one tap at '+width);
   await extra.locator('summary').click();
 }
 check(await page.locator('.balance-list article').filter({hasText:'Synthetic Oldest Collectible Job'}).count()===1,'Oldest collectible job remains actionable beyond 200 newer quotes');
 await navigate('Schedule');await page.getByText('Synthetic Oldest Collectible Job',{exact:false}).first().waitFor();check(true,'Schedule includes the old appointment beyond the first 100 records');
 await navigate('Contracts');await page.locator('.contract-list button').filter({hasText:customer.name}).filter({hasText:'Synthetic Oldest Collectible Job'}).waitFor();check(true,'Agreements includes the old signed estimate beyond the first 100 records');
 const fail=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic later-page interruption'})});
 await context.route('**/api/estimate-history?limit=50&cursor=*',fail);await navigate('Payments');await page.getByRole('alert').filter({hasText:'Synthetic later-page interruption'}).waitFor();
 check(await page.locator('.business-metrics').count()===0&&await page.locator('.payment-layout').count()===0,'Interrupted later page hides partial totals and payment actions');
 await context.unroute('**/api/estimate-history?limit=50&cursor=*',fail);await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('heading',{name:'Collectible job balances',exact:true}).waitFor();check(await metric('Collectible job balance').innerText()==='$150','Explicit read retry recovers the complete financial view');
 const backup=await (await request('/api/backup')).json();check(backup.tables.estimates.length===226&&backup.tables.estimates.find(row=>row.id===originalEstimateId).total_cents===25000&&backup.tables.estimates.find(row=>row.id===old.id).total_cents===20000&&backup.tables.payments.length===1,'Complete backup preserves all estimates, original baseline and the one synthetic payment');
}
