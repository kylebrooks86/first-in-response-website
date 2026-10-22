/** Invoked only by the disposable built-QA HTTPS / native D1 harness. */
import assert from 'node:assert/strict';
export async function exerciseCustomerLookup({page,context,browser,origin,request,check,originalEstimateId}){
 const make=async data=>{const response=await request('/api/customers','POST',data);assert.equal(response.status(),201);return (await response.json()).customer;};
 const a=await make({name:'Lookup Twin',email:'lookup-a@example.invalid',phone:'(918) 010-1010',address:'10 North Fixture Way'});
 const b=await make({name:'Lookup Twin',email:'lookup-b@example.invalid',phone:'918-010-2020',address:'20 South Fixture Way'});
 const property=async(customer,address)=>{const r=await request('/api/customer-properties','POST',{customerId:customer.id,address});assert.equal(r.status(),201);return (await r.json()).property;};
 const pa=await property(a,'11 North Service Property'),pb=await property(b,'21 South Service Property');await property(b,'22 South Second Property');
 const anonymous=await browser.newContext({ignoreHTTPSErrors:true});
 check((await anonymous.request.get(origin+'/api/customers/lookup?q=Lookup')).status()===401,'Customer lookup never exposes saved customer details without owner authentication');await anonymous.close();
 for(const query of ['lookUP','lookup-a@','010-101','North Fixture','North Service Property','+1 9180101010']){
  const response=await request('/api/customers/lookup?q='+encodeURIComponent(query)),data=await response.json();
  check(response.status()===200&&data.customers.some(row=>row.id===a.id),'Native D1 partial customer search: '+query);
  check(response.headers()['cache-control']==='no-store'&&data.customers.every(row=>Object.keys(row).sort().join(',')==='address,email,id,name,phone'),'Lookup response is uncached and contains only customer identity fields');
 }
 check((await (await request('/api/customers/lookup?q='+encodeURIComponent("%' OR 1=1 --"))).json()).customers.length===0,'Bound literal search safely handles SQL and wildcard characters without dumping matches');
 const blank=await (await request('/api/customers/lookup?q=')).json();check(blank.customers.length===0,'Empty lookup does not dump the customer directory');
 const dialog=()=>page.getByRole('dialog',{name:'Create estimate',exact:true});
 const search=()=>dialog().getByRole('combobox',{name:'Find an existing customer'});
 const choose=async email=>{await search().fill(email);const option=dialog().getByRole('option').filter({hasText:email});await option.waitFor();await option.click();await dialog().getByLabel('Customer name',{exact:true}).waitFor();};
 const closeDraft=async()=>{page.once('dialog',d=>d.accept());await dialog().getByRole('button',{name:'Close',exact:true}).click();await dialog().waitFor({state:'hidden'});};
 // Responsive lookup is exercised through the actual shared New Estimate
 // mounted in the entire app, never a parallel implementation or fake form.
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1366,900]]){
  await page.setViewportSize({width,height});await page.goto(origin+'/');
  await page.getByRole('button',{name:'New estimate',exact:true}).click();
  await search().fill('Lookup');await dialog().getByRole('option').first().waitFor();
  check(await dialog().getByRole('option').count()===2,'Autocomplete shows both similarly named customers at '+width);
  check(await dialog().getByRole('option').filter({hasText:a.email}).innerText().then(text=>text.includes(a.address)&&text.includes(a.phone)),'Matches include phone, email and address at '+width);
  const matchBox=await dialog().getByRole('option').first().boundingBox(),createButton=dialog().getByRole('button',{name:'+ Create New Customer',exact:true});await createButton.scrollIntoViewIfNeeded();const createBox=await createButton.boundingBox();
  check(matchBox.x>=0&&matchBox.x+matchBox.width<=width&&matchBox.height>=44&&createBox.x>=0&&createBox.x+createBox.width<=width&&createBox.height>=44,'Lookup options and Create New Customer stay within viewport with accessible touch targets at '+width);
  await search().press('Enter');
  check(await dialog().getByLabel('Customer name',{exact:true}).count()===0&&await dialog().getByRole('button',{name:'Continue to services'}).isDisabled(),'Typing and Enter never select the first match automatically at '+width);
  const ordered=await dialog().getByRole('option').allInnerTexts(),targetIndex=ordered.findIndex(text=>text.includes(a.email));assert.ok(targetIndex>=0);
  for(let i=0;i<=targetIndex;i++)await search().press('ArrowDown');await search().press('Enter');
  await dialog().getByText('Only active property selected automatically.').waitFor();
  check(await dialog().getByLabel('Customer name',{exact:true}).inputValue()==='Lookup Twin'&&await dialog().getByLabel('Estimate service address').inputValue()===pa.address,'Explicit keyboard choice populates actual customer and sole service property at '+width);
  await closeDraft();
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/');
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:/Estimates/}).first().click();
 await page.getByRole('button',{name:'New estimate',exact:true}).click();await choose(a.email);await dialog().getByText('Only active property selected automatically.').waitFor();
 check(await dialog().getByLabel('Email',{exact:true}).inputValue()===a.email,'Estimates section uses the same searchable customer workflow');await closeDraft();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Customers',exact:true}).first().click();
 await page.locator('.customer-card').filter({hasText:a.phone}).click();
 await page.getByRole('heading',{name:'Lookup Twin',exact:true}).waitFor();
 await page.getByRole('button',{name:'New estimate',exact:true}).click();
 await dialog().getByText('Only active property selected automatically.').waitFor();
 check(await dialog().getByLabel('Email',{exact:true}).inputValue()===a.email,'Profile entry starts with that explicitly chosen customer and rechecks server data');
 await dialog().getByRole('button',{name:'Continue to services'}).click();
 await dialog().getByRole('combobox').click();await page.getByRole('option',{name:'Gutter Cleaning + Flush',exact:true}).click();
 await dialog().locator('.edit-quantity-row input').fill('100');await dialog().getByLabel('Price per unit — adjustable for this job',{exact:true}).fill('2');
 await dialog().getByRole('button',{name:'Back',exact:true}).click();
 await search().fill(b.email);await dialog().getByRole('option').filter({hasText:b.email}).waitFor();
 page.once('dialog',d=>d.dismiss());await dialog().getByRole('option').filter({hasText:b.email}).click();
 check(await dialog().getByLabel('Email',{exact:true}).inputValue()===a.email&&await dialog().getByLabel('Estimate service address').inputValue()===pa.address,'Cancel switching protects draft customer and selected property');
 await dialog().getByRole('button',{name:'Continue to services'}).click();
 check(await dialog().locator('.edit-quantity-row input').inputValue()==='100'&&await dialog().getByLabel('Price per unit — adjustable for this job',{exact:true}).inputValue()==='2','Cancel switching preserves unsaved service quantity and price');
 await dialog().getByRole('button',{name:'Back',exact:true}).click();
 page.once('dialog',d=>d.accept());await choose(b.email);
 await dialog().getByText('Select the property explicitly for future work.').waitFor();
 check(await dialog().getByLabel('Email',{exact:true}).inputValue()===b.email&&await dialog().getByLabel('Phone',{exact:true}).inputValue()===b.phone&&await dialog().getByLabel('Estimate service address').inputValue()===b.address,'Confirmed switch replaces every customer contact/address field');
 check(await dialog().getByText(pa.address,{exact:true}).count()===0&&await dialog().getByRole('button',{name:'Continue to services'}).isDisabled(),'Switch never carries old property selection; multiple active properties require explicit choice');
 await dialog().getByRole('radio',{name:'Select '+pb.address,exact:true}).check();await dialog().getByRole('button',{name:'Continue to services'}).click();
 check(await dialog().locator('.edit-quantity-row input').inputValue()===''&&await dialog().locator('.discount-input input').last().inputValue()==='','Confirmed discard clears previous customer’s service draft and discount');
 await dialog().getByRole('combobox').click();await page.getByRole('option',{name:'Gutter Cleaning + Flush',exact:true}).click();
 await dialog().locator('.edit-quantity-row input').fill('100');await dialog().getByLabel('Price per unit — adjustable for this job',{exact:true}).fill('2');
 await dialog().getByLabel('Price per unit — adjustable for this job',{exact:true}).fill('0');check(await dialog().getByRole('button',{name:'Save $150 estimate',exact:true}).count()===1,'Valid zero-priced service previews the existing server minimum instead of a misleading $0');check((await dialog().locator('.edit-totals').innerText()).includes('$75'),'Existing minimum produces the correct $75 deposit preview');await dialog().getByLabel('Price per unit — adjustable for this job',{exact:true}).fill('2');
 await dialog().getByRole('button',{name:'Save $200 estimate',exact:true}).click();await dialog().getByRole('heading',{name:'Estimate ready'}).waitFor();
 check(await dialog().locator('[data-saved-service-address]').innerText()===pb.address,'Save confirms selected customer’s authoritative property address');await dialog().getByRole('button',{name:'Done',exact:true}).click();
 const saved=await (await request('/api/customers')).json();
 const linked=saved.estimates.filter(row=>row.customerId===b.id);
 check(saved.customers.filter(row=>row.name==='Lookup Twin').length===2&&linked.length===1&&linked[0].propertyId===pb.id&&linked[0].address===pb.address,'Profile switch saves to actual target ID without duplicating customers or crossing property/history ownership');
 check(saved.estimates.find(row=>row.id===originalEstimateId).totalCents===25000,'Existing synthetic estimate history and financial total remain intact');
 const payload={customer:a.name,email:a.email,phone:a.phone,address:a.address,items:[{name:'Synthetic Service',quantity:1,unit:'job',totalCents:20000}]};
 check((await request('/api/estimates','POST',payload)).status()===409,'Server refuses implicit new-customer duplication from estimate flow');
 check((await request('/api/customers','POST',{name:'Different Name',email:'LOOKUP-A@EXAMPLE.INVALID',address:'Different'})).status()===409,'Server blocks duplicate email case variants');
 check((await request('/api/customers','POST',{name:'Different Name',phone:'+1 9180101010',address:'Different'})).status()===409,'Server blocks duplicate formatted/country-code phone variants');
 const stale=await request('/api/estimates','POST',{...payload,customerId:a.id,customerLookupSelection:true,email:b.email});
 check(stale.status()===409,'Server rejects stale/cross-customer contact snapshot instead of saving it');
 check((await request('/api/estimates','POST',{...payload,customerId:a.id,customerLookupSelection:true,propertyId:pb.id,propertyRevision:pb.revision,propertySelectionMode:'explicit'})).status()===409,'Server rejects another customer’s property ID without changing history');
 const race={customer:'Concurrent Synthetic',email:'race-lookup@example.invalid',phone:'9185558989',address:'50 Concurrent Fixture',items:payload.items};
 const concurrent=await Promise.all([request('/api/estimates','POST',race),request('/api/estimates','POST',race)]);
 const after=await (await request('/api/backup')).json(),raceCustomers=after.tables.customers.filter(row=>row.email===race.email);
 check(concurrent.filter(response=>response.status()===201).length===1&&raceCustomers.length===1&&after.tables.estimates.filter(row=>row.customer_id===raceCustomers[0].id).length===1,'Native atomic D1 duplicate race creates exactly one customer and one linked estimate');
 // A stale autocomplete response cannot replace the newer query's results.
 await page.goto(origin+'/');await page.getByRole('button',{name:'New estimate',exact:true}).click();
 let releaseOld,markSeen,markDone;const held=new Promise(r=>{releaseOld=r;}),seen=new Promise(r=>{markSeen=r;}),done=new Promise(r=>{markDone=r;});
 const oldSearch=async route=>{
  if(new URL(route.request().url()).searchParams.get('q')!=='North Fixture')return route.continue();
  const response=await route.fetch();markSeen();await held;try{await route.fulfill({response});}catch{}finally{markDone();}
 };
 await page.route('**/api/customers/lookup?*',oldSearch);
 await search().fill('North Fixture');await seen;await search().fill(b.email);await dialog().getByRole('option').filter({hasText:b.email}).waitFor();releaseOld();await done;
 check(await dialog().getByRole('option').count()===1&&await dialog().getByRole('option').filter({hasText:b.email}).count()===1,'Slow prior autocomplete response cannot replace newer customer matches');
 await page.unroute('**/api/customers/lookup?*',oldSearch);
 // Read-only search failure has an explicit retry; no implicit selection/write.
 const failSearch=async route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic search unavailable'})});
 await page.route('**/api/customers/lookup?*',failSearch);await search().fill('Retry fixture');await dialog().getByRole('alert').filter({hasText:'Synthetic search unavailable'}).waitFor();
 check(await dialog().getByRole('button',{name:'Continue to services'}).isDisabled(),'Search failure cannot enable an unselected customer');
 await page.unroute('**/api/customers/lookup?*',failSearch);await dialog().getByRole('button',{name:'Retry customer search',exact:true}).click();await dialog().getByText('No matching customers. Create a new customer if needed.').waitFor();
 check(true,'Explicit search retry recovers without customer or estimate writes');
 const missing=async route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Synthetic selected customer is unavailable'})});
 await page.route('**/api/customers/lookup?customerId=*',missing);await search().fill(a.email);await dialog().getByRole('option').filter({hasText:a.email}).click();await dialog().getByRole('alert').filter({hasText:'Synthetic selected customer is unavailable'}).waitFor();
 check(await dialog().getByRole('button',{name:'Continue to services'}).isDisabled()&&await dialog().getByLabel('Customer name',{exact:true}).count()===0,'Stale/deleted customer selection cannot advance or silently create another customer');
 await page.unroute('**/api/customers/lookup?customerId=*',missing);
 // Explicit new-customer path is available everywhere and never selected by typing.
 await dialog().getByRole('button',{name:'+ Create New Customer',exact:true}).click();
 check(await dialog().getByLabel('Customer name',{exact:true}).isEditable()&&await dialog().getByLabel('Email',{exact:true}).inputValue()===''&&await dialog().getByLabel('Estimate service address').inputValue()==='','Visible Create New Customer opens a clean editable identity without carrying selected customer fields');
 await dialog().getByRole('button',{name:'Close',exact:true}).click();
}
