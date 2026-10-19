import assert from 'node:assert/strict';
import {validateRecordIdentities,validateBackupRelationships,validateRefundIntegrity} from './records-backup-integrity.mjs';
export async function exerciseManualPaymentConfirmation({page,context,origin,request,check}){
 page.setDefaultTimeout(15000);await page.setViewportSize({width:390,height:900});
 const c=await request('/api/customers','POST',{name:'Synthetic Payment Confirmation Customer',email:'payment-confirmation@example.invalid'});assert.equal(c.status(),201);const customer=(await c.json()).customer;
 async function job(name,approve=true){const response=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[{name,quantity:1,unit:'job',totalCents:20000}]});assert.equal(response.status(),201);const estimate=await response.json();if(approve)assert.equal((await request('/api/public/estimates/'+estimate.shareToken+'/accept','POST',{signedName:'Synthetic Confirmation Signer',acceptedTerms:true,photoRelease:'no'})).status(),200);return {...estimate,service:name};}
 const first=await job('Synthetic Confirmed Deposit'),second=await job('Synthetic Interrupted Deposit'),third=await job('Synthetic Missing Receipt Deposit'),fourth=await job('Synthetic Late Receipt Deposit'),unapproved=await job('Synthetic Unapproved Deposit',false);
 const open=async estimate=>{await page.goto(origin+'/?openEstimate='+encodeURIComponent(estimate.id));await page.getByRole('dialog',{name:estimate.service??(estimate.id===first.id?'Synthetic Confirmed Deposit':estimate.id===second.id?'Synthetic Interrupted Deposit':'Synthetic Missing Receipt Deposit'),exact:true}).waitFor();};
 await open(unapproved);const unapprovedDetail=page.getByRole('dialog',{name:unapproved.service,exact:true});
 check(await unapprovedDetail.getByRole('button',{name:'Approval required',exact:true}).isDisabled()&&await unapprovedDetail.getByRole('button',{name:'Deposit recorded',exact:true}).count()===0,'Unapproved $200 job with $0 paid never claims a deposit was recorded');
 const posts=[],dropFirst=new Set([third.id,fourth.id]);const intercept=async route=>{if(route.request().method()!=='POST')return route.continue();const body=route.request().postDataJSON();posts.push(body);if(dropFirst.delete(body.estimateId))return route.abort('failed');const response=await route.fetch();assert.equal(response.status(),201);await new Promise(resolve=>setTimeout(resolve,posts.length===1?1200:250));await route.abort('failed');};await context.route('**/api/payments',intercept);
 await open(first);await page.getByRole('button',{name:'Record payment',exact:true}).click();let form=page.getByRole('dialog',{name:'Record payment',exact:true});
 await form.getByRole('button',{name:'Save payment',exact:true}).evaluate(button=>{button.click();button.click();});
 await form.getByRole('button',{name:'Checking payment…',exact:true}).waitFor();
 check(await form.locator('input').first().isDisabled(),'Delayed write acknowledgement keeps loading state and original amount locked');
 await form.waitFor({state:'hidden'});
 check(posts.length===1,'Immediate double tap and lost POST response result in one manual payment submission');
 let archive=await (await request('/api/backup')).json();
 check(archive.tables.payments.filter(row=>row.estimate_id===first.id).length===1&&archive.tables.payments.find(row=>row.estimate_id===first.id).amount_cents===10000,'Read-only confirmation finds committed $100 deposit after lost response');
 check(await page.evaluate(id=>localStorage.getItem('fire:manual-payment-attempt:'+id),first.id)===null,'Confirmed server ledger clears saved attempt without resubmitting');
 await open(second);await page.getByRole('button',{name:'Record payment',exact:true}).click();form=page.getByRole('dialog',{name:'Record payment',exact:true});
 const unavailable=async route=>route.abort('failed');await context.route('**/api/payments/confirmation?*',unavailable);
 await form.getByRole('button',{name:'Save payment',exact:true}).click();await form.getByRole('alert').filter({hasText:'Not confirmed'}).waitFor();
 check(posts.length===2&&await form.locator('input').first().isDisabled(),'Lost write and unavailable confirmation keep original amount locked and uncertain');
 const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('fire:manual-payment-attempt:'+id)),second.id);
 check(saved.attempt.requestId===posts[1].requestId,'Original request ID is persisted before the uncertain payment');
 await context.unroute('**/api/payments/confirmation?*',unavailable);await open(second);
 const recover=page.getByRole('button',{name:'Check payment status',exact:true});await recover.waitFor();assert.equal(await recover.isEnabled(),true);await recover.click();form=page.getByRole('dialog',{name:'Record payment',exact:true});
 // Reject a success-shaped response for another job and leave the recovery intact.
 const wrong=async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,estimateId:first.id}})};await context.route('**/api/payments/confirmation?*',wrong);
 await form.getByRole('button',{name:'Check saved payment only',exact:true}).click();await form.getByRole('alert').filter({hasText:'does not match'}).waitFor();
 check(posts.length===2&&await form.locator('input').first().isDisabled(),'Wrong-job receipt cannot confirm or unlock payment or trigger another POST');await context.unroute('**/api/payments/confirmation?*',wrong);
 await form.getByRole('button',{name:'Check saved payment only',exact:true}).click();await form.waitFor({state:'hidden'});
 check(posts.length===2,'After full reload with deposit already paid, recovery confirms using GET only');
 await open(third);await page.getByRole('button',{name:'Record payment',exact:true}).click();form=page.getByRole('dialog',{name:'Record payment',exact:true});
 await form.getByRole('button',{name:'Save payment',exact:true}).click();await form.getByRole('alert').filter({hasText:'Not confirmed'}).waitFor();
 const pendingThird=await page.evaluate(id=>JSON.parse(localStorage.getItem('fire:manual-payment-attempt:'+id)).attempt,third.id);
 check(posts.length===3&&await form.locator('input').first().isDisabled(),'No-commit attempt retains its original identity and locked financial details');
 await form.getByRole('button',{name:'Check saved payment only',exact:true}).click();await form.getByRole('alert').filter({hasText:'does not prove an in-flight attempt failed'}).waitFor();
 const retry=form.getByRole('button',{name:'Retry original payment request',exact:true});
 check(posts.length===3&&await retry.isDisabled(),'Missing-receipt review makes no POST and requires separate owner authorization');
 for(const width of [320,390,768,1366]){
  await page.setViewportSize({width,height:900});await retry.scrollIntoViewIfNeeded();const box=await retry.boundingBox();
  check(box.x>=0&&box.x+box.width<=width&&box.height>=44,'Explicit retry stays within the scrolling payment dialog at '+width);
 }
 await page.setViewportSize({width:390,height:900});
 await form.getByRole('checkbox',{name:'I confirm retrying the original payment request with the same details and request ID.'}).check();
 await retry.evaluate(button=>{button.click();button.click();});await form.waitFor({state:'hidden'});
 check(posts.length===4&&posts[3].requestId===pendingThird.requestId&&JSON.stringify(posts[3])===JSON.stringify(posts[2]),'Explicit double-tapped retry reuses identical request ID/body and creates one ledger payment');
 await open(fourth);await page.getByRole('button',{name:'Record payment',exact:true}).click();form=page.getByRole('dialog',{name:'Record payment',exact:true});
 await form.getByRole('button',{name:'Save payment',exact:true}).click();await form.getByRole('alert').filter({hasText:'Not confirmed'}).waitFor();
 await form.getByRole('button',{name:'Check saved payment only',exact:true}).click();await form.getByRole('alert').filter({hasText:'does not prove an in-flight attempt failed'}).waitFor();
 // A delayed earlier request can commit after the read-only absence check.
 assert.equal((await request('/api/payments','POST',posts[4])).status(),201);
 await form.getByRole('checkbox',{name:'I confirm retrying the original payment request with the same details and request ID.'}).check();
 await form.getByRole('button',{name:'Retry original payment request',exact:true}).click();await form.waitFor({state:'hidden'});
 check(posts.length===5,'Retry preflight discovers a late commit and performs GET only instead of another POST');
 archive=await (await request('/api/backup')).json();
 check(archive.tables.payments.filter(row=>row.estimate_id===third.id).length===1&&archive.tables.payments.find(row=>row.estimate_id===third.id).amount_cents===10000,'Native D1 confirms exactly one $100 principal after the no-commit recovery');
 check(archive.tables.payments.filter(row=>row.estimate_id===fourth.id).length===1&&archive.tables.payments.filter(row=>row.estimate_id===unapproved.id).length===0,'Late receipt produces one principal record and the unapproved baseline remains unpaid');
 check(archive.tables.payments.filter(row=>row.estimate_id===second.id).length===1&&archive.tables.payments.filter(row=>[first.id,second.id].includes(row.estimate_id)).every(row=>row.amount_cents===10000&&row.type==='Wave'),'Both deposits preserve one ledger record each and unchanged principal');
 check(!validateRecordIdentities(archive.tables)&&!validateBackupRelationships(archive.tables)&&!validateRefundIntegrity(archive.tables),'Recovered payment records remain valid complete-backup identities and relationships');
 check(archive.tables.estimates.filter(row=>[first.id,second.id].includes(row.id)).every(row=>row.total_cents===20000&&row.deposit_cents===10000&&row.photo_release==='no'),'Recovery preserves estimate prices, required deposits, signatures and No marketing permission');
 await context.unroute('**/api/payments',intercept);
}
