/** Native local D1, authenticated full app, read-only payment/note navigation. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateRecordIdentities,validateBackupRelationships,validateRefundIntegrity} from './records-backup-integrity.mjs';
export async function exerciseSearchMetadata({page,context,browser,origin,request,check}){
 page.setDefaultTimeout(15000);
 const make=async email=>{const r=await request('/api/customers','POST',{name:'Synthetic Search Metadata Twin',email});assert.equal(r.status(),201);return (await r.json()).customer;};
 const customer=await make('metadata-a@example.invalid'),other=await make('metadata-b@example.invalid');
 const er=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[{name:'Synthetic Metadata Service',quantity:1,unit:'job',totalCents:20000}]});assert.equal(er.status(),201);const estimate=await er.json();
 assert.ok((await request('/api/public/estimates/'+estimate.shareToken+'/accept','POST',{signedName:customer.name,acceptedTerms:true,photoRelease:'no'})).ok());
 const reference='SYNTH-META-REFERENCE-7019',nr=await request('/api/customer-notes','POST',{customerId:customer.id,body:'Synthetic prefix. '.repeat(40)+'METADATA-NOTE-7921 <script>literal text</script> saved for customer A.'});assert.equal(nr.status(),201);const note=(await nr.json()).note;
 const otherNote=await request('/api/customer-notes','POST',{customerId:other.id,body:'METADATA-NOTE-7921 saved for customer B.'});assert.equal(otherNote.status(),201);
 const pr=await request('/api/payments','POST',{estimateId:estimate.id,requestId:randomUUID(),amountCents:10000,method:'Cash',reference});assert.equal(pr.status(),201);const payment=(await pr.json()).payment;
 const before=(await (await request('/api/backup')).json()).tables;
 const anonymous=await browser.newContext({ignoreHTTPSErrors:true});for(const scope of ['notes','payments'])check((await anonymous.request.get(origin+'/api/search?q=METADATA&scope='+scope)).status()===401,'Unauthenticated '+scope+' search cannot disclose private records');await anonymous.close();
 const search=()=>page.locator('.topbar').getByRole('combobox',{name:'Search customers, jobs, or addresses'}),panel=()=>page.getByRole('region',{name:'FIRE search results'});
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1366,900]]){
  await page.setViewportSize({width,height});await page.goto(origin+'/');await search().fill('meta-reference');const match=panel().getByRole('option').filter({hasText:reference});await match.waitFor();
  const receipt=await match.innerText();check(receipt.includes('metadata-a@example.invalid')&&receipt.includes('$100.00')&&receipt.toLowerCase().includes('paid'),'Payment result identifies customer, recorded status, reference and amount at '+width);
  await panel().getByRole('button',{name:'Payments',exact:true}).click();await match.waitFor();await match.click();const row=page.locator('[id="customer-payment-'+payment.id+'"]');await row.waitFor();await page.waitForFunction(id=>document.activeElement?.id===id,'customer-payment-'+payment.id);
  check(await row.evaluate(el=>el===document.activeElement)&&(await page.locator('.record-tabs button.active').innerText())==='Payments','Search opens exact customer payment record, not a general balances screen, at '+width);
  await search().fill('metadata-note-7921');await panel().getByRole('button',{name:'Notes',exact:true}).click();const own=panel().getByRole('option').filter({hasText:'metadata-a@example.invalid'});await own.waitFor();
  check(await panel().getByRole('option').count()===2&&await own.innerText().then(t=>t.includes('METADATA-NOTE-7921')&&!t.includes('Synthetic prefix. Synthetic prefix. Synthetic prefix. Synthetic prefix. Synthetic prefix.')),'Matching bounded excerpts and contact details distinguish same-name customer notes at '+width);
  const box=await panel().boundingBox();check(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'Expanded search filters and metadata results fit viewport at '+width);
  await own.click();const n=page.locator('[id="customer-note-'+note.id+'"]');await n.waitFor();await page.waitForFunction(id=>document.activeElement?.id===id,'customer-note-'+note.id);
  check(/^Notes\b/.test(await page.locator('.record-tabs button.active').innerText())&&(await n.textContent()).includes(note.body),'Search opens and focuses exact full note on correct customer at '+width);
 }
 // Preserve an unsaved customer A draft while reading customer B's note, then return.
 const draft='UNSAVED customer A draft stays with A';await page.getByPlaceholder('Gate code, pets, property details…').fill(draft);
 await search().fill('metadata-note-7921');await panel().getByRole('button',{name:'Notes',exact:true}).click();await panel().getByRole('option').filter({hasText:'metadata-b@example.invalid'}).click();await page.waitForFunction(()=>document.activeElement?.id?.startsWith('customer-note-'));
 check(await page.getByPlaceholder('Gate code, pets, property details…').inputValue()==='','Switching customers never carries another customer’s unsaved note draft');
 await search().fill('metadata-note-7921');await panel().getByRole('button',{name:'Notes',exact:true}).click();await panel().getByRole('option').filter({hasText:'metadata-a@example.invalid'}).click();await page.waitForFunction(id=>document.activeElement?.id===id,'customer-note-'+note.id);check(await page.getByPlaceholder('Gate code, pets, property details…').inputValue()===draft,'Returning to customer restores their unsaved in-memory note draft');
 // Fresh load cannot silently focus a cached or wrong-customer payment row.
 const hide=async route=>{const response=await route.fetch(),body=await response.json();body.payments=body.payments.filter(p=>p.id!==payment.id);await route.fulfill({response,json:body});};await context.route('**/api/customers',hide);await search().fill(reference);await panel().getByRole('option').filter({hasText:reference}).click();await page.getByRole('alert').filter({hasText:'selected payment record is unavailable'}).waitFor();
 check(await page.locator('[id="customer-payment-'+payment.id+'"]:focus').count()===0,'Unavailable payment target is reported after refreshing; stale cached rows are never focused');await context.unroute('**/api/customers',hide);
 await search().fill(reference);await panel().getByRole('option').filter({hasText:reference}).click();await page.waitForFunction(id=>document.activeElement?.id===id,'customer-payment-'+payment.id);check(await page.getByRole('alert').filter({hasText:'selected payment record is unavailable'}).count()===0,'Explicit reselection refreshes current records and recovers the exact target');
 const after=(await (await request('/api/backup')).json()).tables;check(JSON.stringify(after.payments)===JSON.stringify(before.payments)&&JSON.stringify(after.customer_notes)===JSON.stringify(before.customer_notes),'Search and draft switching neither replay payments nor save unsent note drafts');check(!validateRecordIdentities(after)&&!validateBackupRelationships(after)&&!validateRefundIntegrity(after),'Metadata search and focused navigation preserve complete-backup financial/customer integrity');
}
