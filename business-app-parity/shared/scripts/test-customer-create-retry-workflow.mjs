import assert from 'node:assert/strict';
import {validateRecordIdentities,validateBackupRelationships,validateRefundIntegrity} from './records-backup-integrity.mjs';
export async function exerciseCustomerCreateRetry({page,context,origin,request,check}){
 page.setDefaultTimeout(15000);await page.setViewportSize({width:390,height:900});
 const customers=async()=>{await page.goto(origin+'/');await page.locator('[data-app-ready=true]').waitFor();if(await page.getByRole('button',{name:'Open menu',exact:true}).isVisible())await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.locator('.sidebar nav').getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('heading',{name:'Customers',exact:true}).waitFor();};
 const open=async()=>{await page.getByRole('button',{name:'Add customer',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add customer',exact:true});await dialog.waitFor();return dialog};
 const posts=[];let loseRead=false,loseBeforeCommit=false;
 const intercept=async route=>{
  if(route.request().method()!=='POST')return route.continue();
  posts.push(route.request().postDataJSON());
  if(loseBeforeCommit){loseBeforeCommit=false;return route.abort('failed')}
  const response=await route.fetch();assert.equal(response.status(),201);await new Promise(r=>setTimeout(r,350));await route.abort('failed');
 };
 const read=async route=>loseRead?route.abort('failed'):route.continue();
 await context.route('**/api/customers',intercept);await context.route('**/api/customers/confirmation?*',read);
 await customers();let form=await open();
 check(await form.locator('details.customer-create-source').count()===1,'Optional lead source is available without crowding customer form');
 check(await form.locator('details.customer-create-source').getAttribute('open')===null,'Optional lead source starts collapsed');
 check((await form.locator('details.customer-create-source summary').textContent()).includes('Unknown'),'Unspecified source is not falsely recorded as a referral');
 await form.getByLabel('Customer name',{exact:true}).fill('Synthetic Name Only Lost Response');
 await form.getByRole('button',{name:'Save customer',exact:true}).evaluate(button=>{button.click();button.click()});
 await page.getByRole('heading',{name:'Synthetic Name Only Lost Response',exact:true}).waitFor();
 check(posts.length===1,'A name-only customer with double tap and lost acknowledgement sends one POST');
 check(posts[0].leadSource==='Unknown','Name-only customer has a truthful unknown source');
 let backup=await (await request('/api/backup')).json(),saved=backup.tables.customers.filter(row=>row.name==='Synthetic Name Only Lost Response');
 check(saved.length===1&&saved[0].id===posts[0].requestId,'Saved customer uses stable creation ID with no duplicate contactless record');
 check(await page.evaluate(()=>localStorage.getItem('fire:customer-create-request:v1'))===null,'Confirmed customer clears recovery ID');
 await customers();form=await open();await form.getByLabel('Customer name',{exact:true}).fill('Synthetic Reload Customer');loseRead=true;
 await form.getByRole('button',{name:'Save customer',exact:true}).click();await form.getByRole('alert').filter({hasText:'Check this SAME save'}).waitFor();
 check(posts.length===2&&await form.getByLabel('Customer name',{exact:true}).isDisabled(),'Unavailable confirmation preserves form and prevents editing an unresolved create');
 check(await page.evaluate(()=>localStorage.getItem('fire:customer-create-request:v1'))===posts[1].requestId,'Persistent recovery stores only the request UUID, no customer details');
 loseRead=false;await customers();await page.getByRole('button',{name:'Check previous customer save',exact:true}).click();form=page.getByRole('dialog',{name:'Add customer',exact:true});
 const wrong=async route=>{const response=await route.fetch();const data=await response.json();await route.fulfill({response,json:{...data,customer:{...data.customer,id:posts[0].requestId}}})};await context.route('**/api/customers/confirmation?*',wrong);
 await form.getByRole('button',{name:'Check previous save',exact:true}).click();await form.getByRole('alert').filter({hasText:'does not match'}).waitFor();
 check(posts.length===2&&await form.getByLabel('Customer name',{exact:true}).isDisabled(),'Wrong-customer receipt cannot unlock the form, navigate or resubmit');await context.unroute('**/api/customers/confirmation?*',wrong);
 await form.getByRole('button',{name:'Check previous save',exact:true}).click();await page.getByRole('heading',{name:'Synthetic Reload Customer',exact:true}).waitFor();
 check(posts.length===2,'After reload the exact saved customer is recovered through GET only');
 // No-commit outage: deliberate retry uses the same frozen payload and ID.
 await customers();form=await open();await form.getByLabel('Customer name',{exact:true}).fill('Synthetic No Commit Customer');loseBeforeCommit=true;
 await form.getByRole('button',{name:'Save customer',exact:true}).click();await form.getByRole('alert').filter({hasText:'Check this SAME save'}).waitFor();
 check(posts.length===3&&await form.getByLabel('Customer name',{exact:true}).isDisabled(),'No-commit failure does not automatically resubmit or discard the original fields');
 await form.getByRole('button',{name:'Check / retry same customer save',exact:true}).click();await page.getByRole('heading',{name:'Synthetic No Commit Customer',exact:true}).waitFor();
 check(posts.length===4&&JSON.stringify(posts[2])===JSON.stringify(posts[3]),'Explicit same-attempt retry retains exact request ID and customer payload');
 // Original fields are intentionally not in persistent storage; a missing
 // receipt after reload reserves the same ID for safely re-entered details.
 await customers();form=await open();await form.getByLabel('Customer name',{exact:true}).fill('Synthetic Reentered Customer');loseBeforeCommit=true;
 await form.getByRole('button',{name:'Save customer',exact:true}).click();await form.getByRole('alert').filter({hasText:'Check this SAME save'}).waitFor();const id=posts[4].requestId;
 await customers();await page.getByRole('button',{name:'Check previous customer save',exact:true}).click();form=page.getByRole('dialog',{name:'Add customer',exact:true});await form.getByRole('button',{name:'Check previous save',exact:true}).click();
 await form.getByRole('alert').filter({hasText:'Re-enter the details'}).waitFor();assert.equal(await form.getByLabel('Customer name',{exact:true}).isEnabled(),true);
 check(posts.length===5,'Missing receipt after reload performs no automatic create and permits deliberate re-entry');
 await form.getByLabel('Customer name',{exact:true}).fill('Synthetic Reentered Customer');await form.getByRole('button',{name:'Save customer',exact:true}).click();await page.getByRole('heading',{name:'Synthetic Reentered Customer',exact:true}).waitFor();
 check(posts.length===6&&posts[5].requestId===id,'Re-entered customer uses original reserved ID rather than a second creation identity');
 backup=await (await request('/api/backup')).json();
 check(['Synthetic Name Only Lost Response','Synthetic Reload Customer','Synthetic No Commit Customer','Synthetic Reentered Customer'].every(name=>backup.tables.customers.filter(row=>row.name===name).length===1),'All fault scenarios retain exactly one customer each');
 check(!validateRecordIdentities(backup.tables)&&!validateBackupRelationships(backup.tables)&&!validateRefundIntegrity(backup.tables),'Create recovery preserves valid backup identities, relationships and financial history');
 await customers();form=await open();await form.getByLabel('Customer name',{exact:true}).fill('Synthetic Instant Estimate Customer');
 const prev=await (await request('/api/backup')).json(),beforeEstimates=prev.tables.estimates.length;
 await form.getByRole('button',{name:'Save & estimate'}).click();
 await page.getByRole('dialog',{name:'Create estimate'}).waitFor();
 await page.locator('.customer-profile h1').filter({hasText:'Synthetic Instant Estimate Customer'}).waitFor({state:'attached'});
 check(await page.locator('.customer-profile h1').textContent()==='Synthetic Instant Estimate Customer','Confirmed new customer opens the exact profile behind its modal estimate editor');
 backup=await (await request('/api/backup')).json();
 check(backup.tables.customers.filter(row=>row.name==='Synthetic Instant Estimate Customer').length===1,'Quick quote saves only one confirmed customer');
 check(backup.tables.estimates.length===beforeEstimates,'Opening wizard does not submit or approve an estimate');
 await context.unroute('**/api/customers',intercept);await context.unroute('**/api/customers/confirmation?*',read);
}
