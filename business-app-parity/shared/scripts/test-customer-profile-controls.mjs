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
 const firstUse=await page.evaluate(()=>{
   const selectors=['.customer-profile-head','.customer-contact','.record-tabs','.customer-records','.customer-snapshot','.customer-flag-panel','.customer-timeline'];
   const roots=selectors.map(selector=>document.querySelector(selector));
   const profile=document.querySelector('.customer-profile'),tabs=[...document.querySelectorAll('.record-tabs button')];
   const actions=document.querySelector('.profile-head-actions');
   return {ordered:roots.every(Boolean)&&roots.every(node=>profile?.contains(node))&&roots.every((node,index)=>index===0||Boolean(roots[index-1].compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING)),
      tabs:tabs.map(node=>node.textContent?.trim()),tabFit:tabs.every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height>=44}),
      actionColumns:actions?getComputedStyle(actions).gridTemplateColumns.split(' ').filter(Boolean).length:0};
 });
 check(firstUse.ordered,'Quick contact and customer records appear before optional financial, flags and activity details');
 check(firstUse.tabs.length===6&&firstUse.tabs.some(label=>label.startsWith('Photos'))&&firstUse.tabs.some(label=>label.startsWith('Notes'))&&firstUse.tabFit,'All six customer record tabs remain visible and finger-sized on iPhone');
 check(firstUse.actionColumns===2,'Common customer actions use two compact touch-friendly columns on iPhone');
 // The primary customer Text action must use the same template-enabled
 // composer as customer history, not the separate blank-only Voice modal.
 const quickText=page.locator('.customer-contact').getByRole('button',{name:'Text',exact:true});
 check(await quickText.count()===1,'Primary customer Text action remains immediately visible');
 await quickText.click();
 const quickDialog=page.getByRole('dialog',{name:'Message',exact:true});
 await quickDialog.waitFor();
 const choice=quickDialog.getByRole('combobox');
 const textField=quickDialog.getByRole('textbox',{name:'Message text',exact:true});
 check(await choice.count()===1&&await textField.inputValue()==='','Text opens editable composer with blank custom default');
 await choice.click();
 await page.getByRole('option',{name:'Request estimate photos',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=dialog] textarea')?.value?.includes('photos help me prepare your estimate'));
 check((await textField.inputValue()).includes('photos help me prepare your estimate'),
   'Existing FIRE photo estimate template is discoverable and personalized');
 await choice.click();
 await page.getByRole('option',{name:'Custom message',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role=dialog] textarea')?.value==='');
 await textField.fill('Synthetic custom text — do not send');
 check(await textField.inputValue()==='Synthetic custom text — do not send','Owner can switch back to custom editable text');
 check(await quickDialog.getByRole('button',{name:'Text',exact:true}).count()===1,
   'Actual Google Voice preparation is still an explicit step, never an automatic send');
 await page.keyboard.press('Escape');
 await quickDialog.waitFor({state:'hidden'});

 await page.getByRole('button',{name:'Photos',exact:true}).click();
 const photos=page.getByRole('region',{name:'On-device customer photos'});await photos.getByText('No on-device photos for this customer').waitFor();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
 await photos.locator('input[type=file][multiple]').setInputFiles({name:'synthetic-responsive-photo.png',mimeType:'image/png',buffer:png});await photos.getByText(/Photos verified on this device/).waitFor();
 await photos.getByRole('button',{name:'Prepare all local photos ZIP',exact:true}).click();
 await photos.getByRole('button',{name:'Save prepared ZIP to Files',exact:true}).waitFor();
 const morePhotoTools=photos.locator('details.photo-backup-more');
 check(await morePhotoTools.evaluate(node=>!node.open),'Rare ZIP and restore controls stay collapsed on a new customer photo screen');
 await morePhotoTools.locator(':scope > summary').click();
 await photos.getByRole('button',{name:'Download prepared ZIP',exact:true}).waitFor();
 const labels=['Camera','Photo library','Prepare all local photos ZIP',"Prepare this customer's photos ZIP",'Save prepared ZIP to Files','Download prepared ZIP','Verify saved ZIP from Files','Restore verified photo ZIP'];
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
 for(const label of ['Verify saved ZIP from Files','Restore verified photo ZIP']){
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
 await messages.getByRole('button',{name:'+ Compose Message',exact:true}).click();await composer().getByLabel('Message text').fill('Synthetic unsent edited message');await composer().getByRole('button',{name:'Close',exact:true}).click();await messages.getByRole('button',{name:'+ Compose Message',exact:true}).click();
 check(await composer().getByLabel('Message text').inputValue()==='Synthetic unsent edited message','Messages tab reuses existing composer draft protection across close/reopen');await composer().getByRole('button',{name:'Close',exact:true}).click();
 const saved=await (await request('/api/customers')).json();
 check(saved.messages.filter(row=>row.customerId===customer.id).length===1&&saved.messages.some(row=>row.id===record.id&&row.body===body&&row.channel==='text_prepared'),'Opening and editing composer does not send or duplicate history');
 check(saved.estimates.find(row=>row.id===originalEstimateId).totalCents===25000&&saved.estimates.find(row=>row.id===estimate.id).totalCents===20000&&saved.estimates.find(row=>row.id===estimate.id).depositCents===10000&&saved.payments.length===0,'Profile UI tests preserve original estimate, $200/$100 fixture and empty payment ledger');
 // A real-looking address-only synthetic customer must not appear to have
 // mysteriously lost the contact buttons. The app should explain the reason
 // without inventing a phone/email or opening the wrong destination.
 const noContact=await request('/api/customers','POST',{name:'Synthetic Address Only',address:'100 Test Lane, Tulsa, OK'});
 assert.equal(noContact.status(),201);
 await page.goto(origin+'/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Customers',exact:true}).first().click();
 await page.locator('.customer-card').filter({hasText:'Synthetic Address Only'}).click();
 await page.getByRole('heading',{name:'Synthetic Address Only',exact:true}).waitFor();
 const blankContact=page.locator('.customer-contact');
 check(await blankContact.getByText('Add a phone or email under More actions → Edit customer to contact them.',{exact:true}).isVisible(),
   'Address-only customer explains absent Call/Text/Email actions');
 check(await blankContact.getByRole('button',{name:'Text',exact:true}).count()===0,
   'Missing phone must not expose an actionable wrong-recipient Text button');
 check(await blankContact.getByRole('link',{name:'Directions to customer in Google Maps'}).count()===1,
   'Customer address still supports Google Maps even without contact details');

}
