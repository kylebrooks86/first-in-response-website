/** Continuous owner workflow in the complete built Worker, local native D1 only. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function exerciseJobCloseout({page,context,origin,request,check,mutateSyntheticD1}){
 page.setDefaultTimeout(15000);await page.setViewportSize({width:390,height:844});
 const c=await request('/api/customers','POST',{name:'Synthetic Closeout Journey',email:'closeout-journey@example.invalid'});assert.equal(c.status(),201);const customer=(await c.json()).customer;
 const e=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[{name:'Synthetic Closeout Service',quantity:1,unit:'job',totalCents:20000}]});assert.equal(e.status(),201);const estimate=await e.json();
 for(const [path,method,body] of [
  ['/api/public/estimates/'+estimate.shareToken+'/accept','POST',{signedName:customer.name,acceptedTerms:true,photoRelease:'no'}],
  ['/api/payments','POST',{estimateId:estimate.id,requestId:randomUUID(),amountCents:10000,method:'Cash'}],
  ['/api/estimates/'+estimate.id,'PATCH',{scheduledAt:'2026-10-22T15:00:00Z'}]
 ]){const response=await request(path,method,body);assert.ok(response.ok(),path+': '+await response.text());}
 const open=async()=>{await page.goto(origin+'/?openEstimate='+estimate.id);await page.getByRole('dialog',{name:'Synthetic Closeout Service',exact:true}).waitFor();};
 await open();let detail=page.getByRole('dialog',{name:'Synthetic Closeout Service',exact:true});
 check(await detail.getByRole('button',{name:'Complete report first',exact:true}).isDisabled(),'Job completion is gated by saved service report');
 await detail.getByRole('button',{name:'Job report',exact:true}).click();const report=page.getByRole('dialog',{name:'Service completion report',exact:true});
 await report.getByRole('group',{name:'Completion checklist'}).waitFor();for(const box of await report.getByRole('checkbox').all())await box.check();await report.getByLabel('Technician notes',{exact:true}).fill('Synthetic closeout report. No actual customer work.');
 await report.getByRole('button',{name:'Save completed report',exact:true}).click();await report.getByRole('status').filter({hasText:'Job report saved.'}).waitFor();await report.getByRole('button',{name:'Close',exact:true}).click();
 await detail.getByRole('button',{name:'Mark job complete',exact:true}).click();await detail.getByRole('button',{name:'Create invoice',exact:true}).waitFor();
 check(await detail.getByRole('button',{name:'Request review',exact:true}).count()===0,'Completed job with only deposit offers no review shortcut');
 await detail.getByRole('button',{name:'Record payment',exact:true}).click();const payment=page.getByRole('dialog',{name:'Record payment',exact:true});await payment.getByRole('button',{name:'Save payment',exact:true}).click();await payment.waitFor({state:'hidden'});
 await detail.getByRole('button',{name:'Request review',exact:true}).waitFor();check(await detail.locator('.next-action').count()===0,'Final payment enables review without a redundant next-step explanation; financial exceptions still retain explicit alerts');
 const prepare=await request('/api/customer-messages','POST',{customerId:customer.id,estimateId:estimate.id,channel:'text_prepared',template:'review',body:'Synthetic review request https://firstinresponseexteriors.com/review',requestId:randomUUID()});assert.equal(prepare.status(),201);const draft=(await prepare.json()).message;
 // Prepare through the actual API to avoid dispatching an external SMS application.
 await detail.getByRole('button',{name:'Request review',exact:true}).click();const composer=page.getByRole('dialog',{name:'Message',exact:true});await composer.waitFor();check(await composer.locator('.message-dialog-recipient').innerText()==='To: '+customer.name,'Review composer identifies exact customer before draft confirmation');await composer.getByRole('button',{name:/^Resume text/}).click();
 check((await composer.getByLabel('Message text',{exact:true}).inputValue()).includes('https://firstinresponseexteriors.com/review'),'Actual composer resumes exact prepared review URL and body');
 const queue=(await(await request('/api/payment-closeouts')).json()).actions;check(queue.some(x=>x.estimateId===estimate.id&&x.state==='prepared'),'Preparation is visible without claiming a send');
 await composer.getByRole('button',{name:'I sent the prepared message',exact:true}).evaluate(n=>{n.click();n.click()});await composer.waitFor({state:'hidden'});
 check(await detail.getByRole('button',{name:'Review requested',exact:true}).count()===0&&await detail.getByRole('status').filter({hasText:'Review request send confirmed by owner.'}).count()===1,'Confirmed send replaces repeat-outreach control with truthful status');
 let archive=await(await request('/api/backup')).json();const sent=archive.tables.customer_messages.filter(m=>m.customer_id===customer.id&&m.channel==='text_confirmed');check(sent.length===1&&sent[0].id===draft.id+':owner-confirmed','Rapid owner confirmation saves one immutable receipt');
 check(!(await(await request('/api/payment-closeouts')).json()).actions.some(x=>x.estimateId===estimate.id),'Confirmed send clears actual ready queue');
 const date=new Date(Date.now()-8*86400000).toISOString();const quote=x=>"'"+x.replaceAll("'","''")+"'";
 await mutateSyntheticD1('UPDATE customer_messages SET created_at='+quote(date)+' WHERE id='+quote(sent[0].id));
 await page.goto(origin+'/');await page.locator('details.dashboard-extra-reminders > summary').click();const reminders=page.getByRole('region',{name:'Review status checks on dashboard',exact:true});await reminders.getByRole('button').filter({hasText:customer.name}).click();
 await page.locator('#customer-review-check-'+customer.id).waitFor();check(await page.locator('#customer-review-check-'+customer.id).evaluate(n=>document.activeElement===n),'Dashboard reminder opens and focuses exact customer review check');
 const moreTracking=page.locator('details.customer-extra-tracking');
 check(!(await moreTracking.evaluate(node=>node.open)),'Due review remains visible while occasional review receipt tracking starts collapsed');
 await moreTracking.locator(':scope>summary').click();
 await page.getByRole('button',{name:'Prepare review received note',exact:true}).click();const note=page.getByLabel('Customer note',{exact:true});check(await note.inputValue()==='[FIRE FLAG] REVIEW_RECEIVED','Logging receipt prepares existing note and requires explicit save');
 check(!(await(await request('/api/backup')).json()).tables.customer_notes.some(n=>n.customer_id===customer.id&&n.body==='[FIRE FLAG] REVIEW_RECEIVED'),'Preparation alone never records a received review');
 await page.getByRole('button',{name:'Add note',exact:true}).click();await page.getByRole('status').filter({hasText:'Note saved.'}).waitFor();
 check(!(await(await request('/api/dashboard-review-checks')).json()).checks.some(x=>x.customerId===customer.id),'Explicit saved review flag clears due reminder');
 const progress=(await(await request('/api/job-closeout-history')).json()).items;check(progress.find(x=>x.customerId===customer.id)?.state==='received','Same native D1 note updates closeout progress');
 await open();detail=page.getByRole('dialog',{name:'Synthetic Closeout Service',exact:true});check(await detail.getByRole('button',{name:'Request review',exact:true}).count()===0&&await detail.getByRole('status').filter({hasText:'Review received · owner logged.'}).count()===1,'Received state suppresses duplicate outreach on exact job');
 archive=await(await request('/api/backup')).json();const job=archive.tables.estimates.find(x=>x.id===estimate.id);check(job.total_cents===20000&&job.deposit_cents===10000&&job.signed_name===customer.name&&job.photo_release==='no'&&archive.tables.payments.filter(x=>x.estimate_id===estimate.id).reduce((sum,x)=>sum+x.amount_cents,0)===20000,'Continuous closeout preserves price, deposit, signature, photo choice and principal');
}
