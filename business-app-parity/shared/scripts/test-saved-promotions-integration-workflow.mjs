/** Disposable built Worker/native D1: reconciled promotions + notes remain isolated. */
export async function exerciseSavedPromotionsIntegration({page,origin,request,check}){
 const uid=n=>'fafa0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
 const base={enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:[]};
 const percent={...base,id:uid(1),name:'Synthetic verified 15%',type:'percent',valueCents:1500};
 const bundle={...base,id:uid(2),name:'Synthetic house/gutters bundle',type:'dollar',valueCents:2500,requiredServiceIds:['house-wash','gutters']};
 const booking={...percent,id:uid(3),name:'October booking hold',dateBasis:'booking-confirmed',startOn:'2026-10-01',endOn:'2026-10-31'};
 const prior=(await(await request('/api/saved-promotions')).json()).catalog;
 let response=await request('/api/saved-promotions','PUT',{expectedRevision:prior.revision,promotions:[percent,bundle,booking]});check(response.status()===200,'Native D1 accepts isolated synthetic saved promotion catalog');const catalog=(await response.json()).catalog;
 const scope={serviceIds:['house-wash','gutters'],subtotalCents:46000,appreciationDiscount:false};
 response=await request('/api/saved-promotions/preview','POST',scope);const preview=await response.json();check(response.status()===200&&preview.percentBasisPoints===1500&&preview.dollarCents===2500&&preview.pendingBooking.some(p=>p.id===booking.id)&&preview.previewTotalCents===36600,'Native server combines $69 plus $25, holding unconfirmed October booking savings');
 const payload={customer:'Synthetic Integrated Promotion',email:'integrated-promotions@example.invalid',items:[{name:'House Wash',description:'Original synthetic scope',quantity:1540,unit:'sq ft',totalCents:38500},{name:'Gutter Cleaning + Flush',description:'Original synthetic gutters',quantity:50,unit:'linear ft',totalCents:7500}],appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:2500,promotionEvidence:{revision:preview.revision,checkedOn:preview.checkedOn,ruleIds:preview.eligible.map(p=>p.id),serviceIds:scope.serviceIds}};
 response=await request('/api/estimates','POST',payload);const quote=await response.json();check(response.status()===201&&quote.totalCents===36600&&quote.depositCents===18300&&quote.promotionAttributionSaved===true,'Real Worker atomically saves attributed $366 quote and $183 deposit');
 await request('/api/saved-promotions','PUT',{expectedRevision:catalog.revision,promotions:[]});
 check((await request('/api/estimates','POST',{...payload,email:'stale-integrated@example.invalid'})).status()===409,'Stale catalog revision cannot write another automatically attributed quote');
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/?openEstimate='+quote.id);
 const detail=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Edit estimate',exact:true})});
 const history=detail.getByRole('region',{name:'Saved promotions on estimate'}).filter({hasText:percent.name}).first();await history.getByText(percent.name,{exact:true}).waitFor();check((await history.innerText()).includes(bundle.name),'Actual built mobile estimate shows original frozen rule names after catalog removal');
 await page.getByRole('button',{name:'Edit estimate',exact:true}).click();const editor=page.getByRole('dialog',{name:'Edit estimate',exact:true});await editor.getByRole('button',{name:'Save estimate changes'}).waitFor();await page.waitForFunction(()=>!document.querySelector('.estimate-edit-scroll-area fieldset')?.disabled);
 await editor.getByRole('button',{name:'Save estimate changes'}).click();await editor.waitFor({state:'hidden'});
 const saved=(await(await request('/api/estimates/'+quote.id+'/promotions')).json()).attribution;check(saved?.rules.length===2&&saved.totalCents===36600&&saved.depositCents===18300,'Built editor no-op save retains accurate automatic promotion attribution');
}
