/** Native D1 + authenticated compiled app; synthetic records only. */
import assert from 'node:assert/strict';
export async function exerciseCustomerBalances({page,origin,request,check}){
 const response=await request('/api/customers','POST',{name:'Synthetic Balance Classification',email:'balance-classification@example.invalid'});assert.equal(response.status(),201);const customer=(await response.json()).customer;
 const create=async(name)=>{const r=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[{name,quantity:1,unit:'job',totalCents:20000}]});assert.equal(r.status(),201);return r.json();};
 const quote=await create('Synthetic Pending Quote'),job=await create('Synthetic Scheduled Job');
 assert.equal((await request('/api/estimates/'+quote.id,'PATCH',{status:'sent'})).status(),200);
 const approval={signedName:customer.name,photoRelease:'no',acceptedTerms:true};
 for(let i=0;i<2;i++)assert.equal((await request('/api/public/estimates/'+job.shareToken+'/accept','POST',approval)).status(),200);
 assert.equal((await request('/api/estimates/'+job.id,'PATCH',{scheduledAt:'2026-10-20T15:00:00.000Z'})).status(),200);
 let data=await (await request('/api/customers')).json();let saved=data.estimates.find(row=>row.id===job.id);
 check(saved.status==='scheduled'&&saved.signedAt&&saved.photoRelease==='no'&&data.payments.filter(row=>row.customerId===customer.id).length===0,'Approval/scheduling preserve signature, permission and empty payment ledger');
 const profile=async()=>{await page.goto(origin+'/');await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Customers',exact:true}).first().click();await page.locator('.customer-card').filter({hasText:customer.name}).click();await page.getByRole('heading',{name:customer.name,exact:true}).waitFor();};
 await page.setViewportSize({width:390,height:844});await profile();
 const metric=label=>page.locator('.customer-snapshot>span').filter({has:page.getByText(label,{exact:true})}).locator('strong');
 for(const width of [320,390,768,1366]){
  await page.setViewportSize({width,height:900});
  check(await metric('Collectible job balance').innerText()==='$200'&&await metric('Potential estimate value').innerText()==='$200'&&await metric('Deposit still required').innerText()==='$100'&&await metric('Paid').innerText()==='$0','Profile separates quote, job, deposit and paid at '+width);
 }
 await page.goto(origin+'/');
 for(const width of [320,390,768,1366]){
  await page.setViewportSize({width,height:900});const row=page.locator('.recent-estimate-row').filter({hasText:'Synthetic Scheduled Job'});await row.waitFor();
  check(await row.locator('.recent-estimate-status').isVisible()&&await row.locator('.recent-estimate-status').innerText()==='Scheduled'&&/Oct 20, 2026.*10:00 AM/.test(await row.locator('.recent-estimate-appointment').innerText())&&/^Created /.test(await row.locator('.recent-estimate-dates').innerText()),'Home exposes current status and distinct Central service/creation dates at '+width);
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.recent-estimate-row').filter({hasText:'Synthetic Scheduled Job'}).click();
 const directJob=page.getByRole('dialog',{name:'Synthetic Scheduled Job',exact:true});await directJob.waitFor();
 check((await directJob.innerText()).includes(customer.name),'Home recent row opens the exact selected customer/job instead of the generic history');
 await directJob.getByRole('button',{name:'Close',exact:true}).click();await page.goto(origin+'/');
 await page.context().request.get(origin+'/estimate/'+quote.shareToken);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 const viewed=page.locator('.recent-estimate-row').filter({hasText:'Synthetic Pending Quote'}).locator('.recent-estimate-status');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.recent-estimate-row')).some(row=>row.textContent.includes('Synthetic Pending Quote')&&row.textContent.includes('Sent · Viewed')));
 check(await viewed.innerText()==='Sent · Viewed','Home refreshes viewed status on focus without page reload');
 const paid=await request('/api/payments','POST',{estimateId:job.id,amountCents:10000,method:'Cash'});assert.equal(paid.status(),201);
 await page.setViewportSize({width:390,height:844});await profile();
 check(await metric('Collectible job balance').innerText()==='$100'&&await metric('Deposit still required').innerText()==='$0'&&await metric('Paid').innerText()==='$100','Recorded deposit reduces principal and deposit requirement once');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Payments',exact:true}).first().click();
 await page.getByRole('heading',{name:'Collectible job balances',exact:true}).waitFor();
 const balances=page.locator('.balance-list article').filter({hasText:customer.name});
 check(await balances.count()===1&&await balances.first().innerText().then(text=>text.includes('Synthetic Scheduled Job')&&!text.includes('Synthetic Pending Quote')),'Payments excludes unapproved quote and retains scheduled collectible job');
 data=await (await request('/api/customers')).json();
 check(data.estimates.find(row=>row.id===quote.id).status==='sent'&&data.estimates.filter(row=>[quote.id,job.id].includes(row.id)).every(row=>row.totalCents===20000&&row.depositCents===10000),'Quote status and original full totals/deposit terms remain unchanged');
}
