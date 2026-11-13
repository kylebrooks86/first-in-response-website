/** Actual built app profile controls; local synthetic HTTPS Worker + native D1/IndexedDB only. */
import assert from 'node:assert/strict';
export async function exerciseCustomerProfileControls({page,context,origin,request,check,originalEstimateId}){
 const response=await request('/api/customers','POST',{name:'Synthetic Profile Controls',email:'profile-controls@example.invalid',phone:'9185550148'});
 assert.equal(response.status(),201);const customer=(await response.json()).customer;
 const created=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[{name:'Synthetic Profile Service',quantity:1,unit:'job',totalCents:20000}]});assert.equal(created.status(),201);const estimate=await created.json();
 const profile=async()=>{await page.setViewportSize({width:390,height:844});await page.goto(origin+'/');await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Customers',exact:true}).first().click();await page.locator('.customer-card').filter({hasText:customer.name}).click();await page.getByRole('heading',{name:customer.name,exact:true}).waitFor();};
 await profile();
 const headerMore=page.locator('details.customer-header-more');
 check(await headerMore.evaluate(node=>!node.open),'Occasional customer edit/message/history controls start collapsed');
 const primaryEstimate=page.locator('.customer-profile-head').getByRole('button',{name:'New estimate',exact:true});
 check(await primaryEstimate.isVisible(),'Primary New estimate stays visible without expanding More actions');
 await headerMore.locator(':scope>summary').click();
 check(await headerMore.getByRole('button',{name:'Edit customer',exact:true}).isVisible()&&await headerMore.getByRole('button',{name:'Customer history',exact:true}).isVisible(),'Existing edit and exact history shortcuts remain accessible');
 await headerMore.getByRole('button',{name:'Customer history',exact:true}).click();
 check(await page.evaluate(id=>document.activeElement?.id==='customer-history-'+id,customer.id),'History shortcut still focuses current record after compact menu');
 await headerMore.locator(':scope>summary').click();
 const customerQuotes=page.getByRole('group',{name:'Customer estimates and signed agreements'});
 check(await customerQuotes.getByRole('button',{name:'All estimates (1)',exact:true}).getAttribute('aria-pressed')==='true','Customer profile opens all of this customer’s saved quotes first');
 await customerQuotes.getByRole('button',{name:'Agreements (0)',exact:true}).click();
 check(await page.getByText('No agreements found',{exact:true}).count()===1,'Unsent draft cannot be misrepresented as a signed or pending agreement');
 check(await page.locator('.customer-records .customer-record').count()===0,'Agreement filter does not alter or duplicate draft records');
 await customerQuotes.getByRole('button',{name:'All estimates (1)',exact:true}).click();
 check(await page.locator('.customer-records .customer-record').filter({hasText:'Synthetic Profile Service'}).count()===1,'Full estimate remains reachable after switching views');
 check(await page.getByRole('button',{name:/^Estimates\s+1$/}).count()===1,'Customer profile has one combined estimates and agreements tab');
 await page.locator('.customer-records .customer-record').filter({hasText:'Synthetic Profile Service'}).click();
 const quoteDetails=page.locator('.estimate-detail');
 await quoteDetails.waitFor();
 check(await quoteDetails.getByRole('button',{name:'Send estimate',exact:true}).count()===1,'Opening the customer quote retains Send estimate');
 check(await quoteDetails.getByRole('button',{name:'Approval required',exact:true}).isDisabled(),'Original payment control remains visible but correctly blocks payment until quote approval');
 check(await quoteDetails.locator('details.detail-more-tools').count()===1,'Job tools remain available without crowding the main action buttons');
 await page.keyboard.press('Escape');
 await quoteDetails.waitFor({state:'hidden'});
 // Opening an exact saved quote intentionally routes to the authoritative
 // Estimates workspace. Navigate back to the same customer before verifying
 // the customer profile; the old test queried a screen no longer mounted.
 await profile();
 check(await page.getByRole('heading',{name:customer.name,exact:true}).isVisible(),
   'Exact customer profile remains reachable after viewing its saved estimate');
 const firstUse=await page.evaluate(()=>{
   const selectors=['.customer-profile-head','.customer-contact','.record-tabs','.customer-records','.customer-snapshot','.customer-flag-panel','.customer-timeline'];
    const profile=document.querySelector('.customer-profile'),roots=selectors.map(selector=>profile?.querySelector(selector));
    const tabs=[...(profile?.querySelectorAll('.record-tabs button')||[])];
    const actions=profile?.querySelector('.profile-head-actions');
    return {ordered:roots.every(Boolean)&&roots.every((node,index)=>index===0||Boolean(roots[index-1].compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING)),orderDetails:selectors.map((selector,index)=>({selector,found:Boolean(roots[index]),preceding:index>0&&roots[index-1]&&roots[index]?Boolean(roots[index-1].compareDocumentPosition(roots[index])&Node.DOCUMENT_POSITION_FOLLOWING):null})),
      tabs:tabs.map(node=>node.textContent?.trim()),tabFit:tabs.every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height>=44}),
      actionColumns:actions?getComputedStyle(actions).gridTemplateColumns.split(' ').filter(Boolean).length:0};
 });
  check(firstUse.ordered,'Quick contact and customer records appear before optional financial, flags and activity details: '+JSON.stringify(firstUse.orderDetails));
 check(firstUse.tabs.length===6&&firstUse.tabs.some(label=>label.startsWith('Photos'))&&firstUse.tabs.some(label=>label.startsWith('Notes'))&&firstUse.tabFit,'All six customer record tabs remain visible and finger-sized on iPhone');
 check(firstUse.actionColumns===2,'Common customer actions use two compact touch-friendly columns on iPhone');
 const optionalActivity=page.locator('details.customer-activity-tools');
 check(await optionalActivity.count()===1&&await optionalActivity.evaluate(node=>!node.open),
   'Optional customer follow-up, callbacks and yard-sign controls begin collapsed without losing the visible section heading');
 await optionalActivity.locator(':scope>summary').click();
 check(await optionalActivity.getByRole('button',{name:'Log lead contacted'}).isVisible(),
   'Contact and callback controls remain accessible when explicitly expanded');
 await optionalActivity.locator(':scope>summary').click();
 check(await optionalActivity.evaluate(node=>!node.open),
   'Optional tracking can be collapsed again without writing a customer record');
 // The primary Text action uses the same saved/custom editor as the Messages tab.
 const quickText=page.locator('.customer-contact').getByRole('button',{name:'Text',exact:true});
 check(await quickText.count()===1,'Primary customer Text remains immediately visible');
 await quickText.click();
 const quickDialog=page.getByRole('dialog',{name:'Message',exact:true});await quickDialog.waitFor();
 const choice=quickDialog.getByRole('combobox'),textField=quickDialog.getByRole('textbox',{name:'Message text',exact:true});
 check(await choice.count()===1&&await textField.inputValue()==='','Text opens a blank, editable custom message');
 await choice.click();
 check(await page.getByRole('option',{name:'Inspection or job report',exact:true}).count()===0,'Email-only report template is not offered when starting a Google Voice Text');
 await page.getByRole('option',{name:'Request estimate photos',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=dialog] textarea')?.value?.includes('photos help me prepare your estimate'));
 check((await textField.inputValue()).includes('photos help me prepare your estimate'),'Saved photo-request template is available to the primary Text action');
 await choice.click();await page.getByRole('option',{name:'Custom message',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=dialog] textarea')?.value==='');
 await textField.fill('Synthetic unsent custom text');
 check(await textField.inputValue()==='Synthetic unsent custom text','Custom message remains editable; never sent during QA');
 page.once('dialog',async prompt=>{check(prompt.type()==='confirm'&&prompt.message()==='Discard your unfinished message edits? No text or email has been sent by FIRE.','Text draft requires explicit discard approval');await prompt.accept();});await page.keyboard.press('Escape');await quickDialog.waitFor({state:'hidden'});
 // Customer email uses the same saved draft/owner confirmation path as Text.
 // A bare mailto link would bypass the audit and fail silently on some phones.
 const quickEmail=page.locator('.customer-contact').getByRole('button',{name:'Email customer'});
 check(await quickEmail.count()===1,'Primary Email action is the verified editable composer');
 await quickEmail.click();const emailDialog=page.getByRole('dialog',{name:'Message',exact:true});await emailDialog.waitFor();
 check(await emailDialog.locator('.message-dialog-recipient').innerText()==='To: '+customer.name,'Email composer retains the exact saved customer');
 check(await emailDialog.getByRole('textbox',{name:'Message text'}).inputValue()==='','Email opens a blank editable draft without sending');
 await page.setViewportSize({width:390,height:568});
 await page.waitForFunction(()=>{const dialog=document.querySelector(".message-dialog");if(!dialog)return false;const rect=dialog.getBoundingClientRect();return rect.top>=-2&&rect.bottom<=innerHeight+2;});
 const emailGeometry=await emailDialog.evaluate(node=>{
   const dialog=node.getBoundingClientRect(),builder=node.querySelector('.message-builder'),scroll=builder?.getBoundingClientRect();
   return {top:dialog.top,bottom:dialog.bottom,scrollHeight:builder?.scrollHeight??0,clientHeight:builder?.clientHeight??0,scrollerTop:scroll?.top??0,scrollerBottom:scroll?.bottom??0,overflow:builder?getComputedStyle(builder).overflowY:'none',maxHeight:getComputedStyle(node).maxHeight,display:getComputedStyle(node).display,viewport:innerHeight};
 });
 check(emailGeometry.top>=-2&&emailGeometry.bottom<=570&&emailGeometry.overflow==='auto'&&emailGeometry.scrollerBottom<=568,
   'Email editor stays inside short laptop viewport with scrolling available when content requires it: '+JSON.stringify(emailGeometry));
 const searchDisclosure=emailDialog.locator('details.composer-template-search-disclosure');
 check(await searchDisclosure.evaluate(node=>!node.open),'Optional template search starts collapsed');
 await searchDisclosure.locator(':scope > summary').click();
 const search=emailDialog.getByRole('searchbox',{name:'Find a message template'});
 await search.fill('invoice');
 await emailDialog.getByRole('combobox').click();
 check(await page.getByRole('option',{name:'Invoice ready',exact:true}).count()===1&&
   await page.getByRole('option',{name:'Estimate ready',exact:true}).count()===0,
   'Email template search narrows to invoice category without changing the unsent draft');
 await page.keyboard.press('Escape');
 await search.fill('');
 await emailDialog.getByRole('combobox').click();
 check(await page.getByRole('option',{name:'Inspection or job report',exact:true}).count()===1,
   'Clearing search restores email-only saved templates without exposing them to Text mode');
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await emailDialog.getByRole('textbox',{name:'Message text'}).fill('Synthetic draft email, not sent');
 check(await emailDialog.getByRole('button',{name:'Email',exact:true}).isVisible(),'Prepared-email handoff stays available');
 page.once('dialog',async prompt=>{check(prompt.type()==='confirm'&&prompt.message()==='Discard your unfinished message edits? No text or email has been sent by FIRE.','Email draft requires explicit discard approval');await prompt.accept();});await emailDialog.getByRole('button',{name:'Close',exact:true}).click();await emailDialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:/^Photos\b/}).click();
 const photos=page.getByRole('region',{name:'On-device customer photos'});await photos.getByText('No on-device photos for this customer').waitFor();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
 await photos.locator('input[type=file][multiple]').setInputFiles({name:'synthetic-responsive-photo.png',mimeType:'image/png',buffer:png});await photos.getByText(/Photos verified on this device/).waitFor();
 await photos.getByLabel('Photo backup recovery passphrase').fill('Synthetic customer profile photo backup passphrase 2026');
 await photos.getByLabel('Confirm new photo backup passphrase').fill('Synthetic customer profile photo backup passphrase 2026');
 await photos.getByRole('button',{name:'Prepare protected all-photos backup',exact:true}).click();
 await photos.getByRole('button',{name:'Save prepared backup to Files',exact:true}).waitFor();
 const morePhotoTools=photos.locator('details.photo-backup-more');
 check(await morePhotoTools.evaluate(node=>!node.open),'Rare ZIP and restore controls stay collapsed on a new customer photo screen');
 await morePhotoTools.locator(':scope > summary').click();
 await photos.getByRole('button',{name:'Download prepared backup',exact:true}).waitFor();
 const labels=['Camera','Photo library','Prepare protected all-photos backup','Protect this customer’s photos','Legacy unencrypted all-photos ZIP','Save prepared backup to Files','Download prepared backup','Verify saved photo backup','Restore verified photo backup'];
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1366,900]]){
  await page.setViewportSize({width,height});
  for(const label of labels){
   const button=photos.getByRole('button',{name:label,exact:true});await button.evaluate(node=>node.scrollIntoView({block:'center'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const box=await button.boundingBox();
   const geometry=await button.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:node.clientWidth,scrollWidth:node.scrollWidth,height:node.clientHeight,scrollHeight:node.scrollHeight,hittable:hit?.closest('button')===node,hit:hit?.tagName,whiteSpace:getComputedStyle(node).whiteSpace};});
   const fits=box&&box.width>0&&box.height>=44&&box.x>=0&&box.x+box.width<=width&&geometry.scrollWidth<=geometry.width+1&&geometry.scrollHeight<=geometry.height+1&&geometry.hittable;
   if(!fits)await page.screenshot({path:'synthetic-profile-layout-failure.png'});
   check(fits,'Photo control fully readable and reachable: '+label+' at '+width+' '+JSON.stringify({box,geometry}));
  }
  check(await photos.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Photo panel has no horizontal overflow at '+width);
 }
 // Read-only picker entry points are usable; cancel without restoring any data.
 for(const label of ['Verify saved photo backup','Restore verified photo backup']){
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),photos.getByRole('button',{name:label,exact:true}).click()]);await chooser.setFiles([]);check(true,'Existing photo file picker opens safely: '+label);
 }
 await page.getByRole('button',{name:/^Messages\s+0$/}).click();
 const messages=page.getByRole('region',{name:'Customer messages'});await messages.getByText('No messages prepared yet').waitFor();
 const composer=()=>page.getByRole('dialog',{name:'Message',exact:true});
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1366,900]]){
  await page.setViewportSize({width,height});const compose=messages.getByRole('button',{name:'+ Compose Message',exact:true});await compose.scrollIntoViewIfNeeded();const box=await compose.boundingBox();
  check(box.x>=0&&box.x+box.width<=width&&box.height>=44,'Messages tab exposes accessible Compose Message at '+width);
  await compose.click();await composer().waitFor();check(await composer().locator('.message-dialog-recipient').innerText()==='To: '+customer.name,'Compact composer keeps the correct recipient at '+width);check(await composer().getByRole('button',{name:'Text',exact:true}).isVisible()&&await composer().getByRole('button',{name:'Email',exact:true}).isVisible()&&await composer().getByLabel('Message text').inputValue().then(text=>text.includes('/estimate/'+estimate.shareToken)),'Shared composer uses current customer and estimate with text/email options at '+width);
  await composer().getByRole('button',{name:'Close',exact:true}).click();
 }
 // Prepare synthetic audit events through the real existing messaging API;
 // do not open an OS sender or transmit any message to anyone.
 const body='Synthetic profile history draft — preserve exactly';
 const prepared=await request('/api/customer-messages','POST',{customerId:customer.id,estimateId:estimate.id,channel:'text_prepared',template:'estimate',body});assert.equal(prepared.status(),201);const record=(await prepared.json()).message;
 await profile();await page.getByRole('button',{name:/^Messages\s+1$/}).click();
 check(await messages.locator('.message-history').filter({hasText:body}).count()===1&&await messages.getByText(/Prepared · sending unconfirmed/).count()===1,'Messages tab displays actual prepared history without claiming delivery');
 await messages.getByRole('button',{name:'+ Compose Message',exact:true}).click();await composer().getByLabel('Message text').fill('Synthetic unsent edited message');page.once('dialog',async prompt=>{check(prompt.type()==='confirm'&&prompt.message()==='Discard your unfinished message edits? No text or email has been sent by FIRE.','Edited message close requires explicit discard decision');await prompt.dismiss();});await composer().getByRole('button',{name:'Close',exact:true}).click();
 check(await composer().isVisible()&&await composer().getByLabel('Message text').inputValue()==='Synthetic unsent edited message','Declining discard retains unsent composer and exact draft');page.once('dialog',prompt=>prompt.accept());await composer().getByRole('button',{name:'Close',exact:true}).click();await composer().waitFor({state:'hidden'});await messages.getByRole('button',{name:'+ Compose Message',exact:true}).click();check(await composer().getByLabel('Message text').inputValue()!=='Synthetic unsent edited message','Approved discard does not restore discarded local edits');await composer().getByRole('button',{name:'Close',exact:true}).click();
 const saved=await (await request('/api/customers')).json();
 check(saved.messages.filter(row=>row.customerId===customer.id).length===1&&saved.messages.some(row=>row.id===record.id&&row.body===body&&row.channel==='text_prepared'),'Opening and editing composer does not send or duplicate history');
 check(saved.estimates.find(row=>row.id===originalEstimateId).totalCents===25000&&saved.estimates.find(row=>row.id===estimate.id).totalCents===20000&&saved.estimates.find(row=>row.id===estimate.id).depositCents===10000&&saved.payments.length===0,'Profile UI tests preserve original estimate, $200/$100 fixture and empty payment ledger');

 // User-reported Acrobat/Acer issue: after preparing an email, the handoff
 // window previously extended below the screen and hid the confirmation
 // controls. Test a REAL prepared email record, only on disposable QA D1.
 const emailPayload='Synthetic prepared email; this was NOT SENT';
 const preparedEmail=await request('/api/customer-messages','POST',{
   customerId:customer.id,estimateId:estimate.id,channel:'email_prepared',template:'estimate',body:emailPayload
 });
 assert.equal(preparedEmail.status(),201,'Synthetic unconfirmed email preparation must be stored in disposable D1');
 await profile();await page.getByRole('button',{name:/^Messages\s+2$/}).click();
 await page.setViewportSize({width:390,height:568});
 await messages.getByRole('button',{name:'+ Compose Message',exact:true}).click();
 const pendingDrafts=composer().locator('details.message-pending-drafts');
 await pendingDrafts.waitFor({state:'visible'});
 check(await pendingDrafts.evaluate(node=>!node.open),'Unconfirmed draft history is collapsed by default after asynchronous saved-draft load');
 await pendingDrafts.locator(':scope > summary').click();
 await pendingDrafts.getByRole('button',{name:/^Email ·/}).click();
 await page.waitForFunction(()=>{const dialog=document.querySelector(".message-dialog");if(!dialog)return false;const rect=dialog.getBoundingClientRect();return rect.top>=-2&&rect.bottom<=innerHeight+2;});
 const preparedDialog=composer();
 const discardDetails=preparedDialog.locator('details.message-secondary-options').last();
 check(await preparedDialog.getByRole('region',{name:'Prepared email handoff'}).isVisible()&&
   await preparedDialog.getByRole('button',{name:'Yes, mark sent',exact:true}).isVisible()&&
   await preparedDialog.getByRole('button',{name:'Not yet · edit',exact:true}).isVisible()&&
   await discardDetails.evaluate(node=>!node.open),
   'Recovered email shows concise send verification and keeps discard collapsed');
 await discardDetails.locator(':scope > summary').click();
 check(await discardDetails.getByRole('button',{name:'Discard unsent draft',exact:true}).isVisible(),
   'Original owner-only draft discard remains accessible on demand');
 await discardDetails.locator(':scope > summary').click();
 const geometry=await preparedDialog.evaluate(node=>{
   const dialog=node.getBoundingClientRect(),builder=node.querySelector('.message-builder'),scroll=builder?.getBoundingClientRect();
   return {top:dialog.top,bottom:dialog.bottom,scrollerBottom:scroll?.bottom,scrollHeight:builder?.scrollHeight,clientHeight:builder?.clientHeight};
 });
 check(geometry.top>=-2&&geometry.bottom<=570&&geometry.scrollHeight>=geometry.clientHeight&&geometry.scrollerBottom<=568,
   'Prepared email modal stays within 568px viewport while long confirmation and template details scroll independently: '+JSON.stringify(geometry));
 await preparedDialog.locator('.message-builder').evaluate(node=>{node.scrollTop=node.scrollHeight;});
 check(await preparedDialog.getByRole('button',{name:'Close',exact:true}).isVisible(),
   'Close stays accessible even after scrolling to bottom of prepared email');
 page.once('dialog',prompt=>prompt.accept());
 await preparedDialog.getByRole('button',{name:'Close',exact:true}).click();
 await preparedDialog.waitFor({state:'hidden'});
 const afterPrepared=await (await request('/api/customers')).json();
 check(afterPrepared.messages.some(row=>row.customerId===customer.id&&row.channel==='email_prepared'&&row.body===emailPayload)&&
   !afterPrepared.messages.some(row=>row.customerId===customer.id&&row.channel==='email_confirmed'),
   'Closing long email handoff never confirms or sends a customer message');

 // An address-only customer retains Maps but explains why Call/Text are unavailable.
 const noContact=await request('/api/customers','POST',{name:'Synthetic Address Only',address:'100 Test Lane, Tulsa, OK'});
 assert.equal(noContact.status(),201);
 await page.goto(origin+'/');await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Customers',exact:true}).first().click();
 await page.locator('.customer-card').filter({hasText:'Synthetic Address Only'}).click();
 await page.getByRole('heading',{name:'Synthetic Address Only',exact:true}).waitFor();
 const blankContact=page.locator('.customer-contact');
 check(await blankContact.getByText('Add a phone or email under More actions → Edit customer to contact them.',{exact:true}).isVisible(),'Address-only customer explains missing contact actions');
 check(await blankContact.getByRole('button',{name:'Text',exact:true}).count()===0,'Missing phone does not expose an invalid recipient Text button');
 check(await blankContact.getByRole('link',{name:'Directions to customer in Google Maps'}).count()===1,'Address-only customer can still open Maps');
}
