/** Only invoked in disposable built Worker / native D1. Never sends messages. */
export async function exerciseStackedDiscounts({page,origin,request,check}){
 const response=await request('/api/estimates','POST',{customer:'Synthetic Stacked Discounts',email:'stacked-native@example.invalid',items:[{name:'Synthetic Stacked Service',description:'Agreed synthetic scope',quantity:2000,unit:'sq ft',totalCents:46000}],additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:2500});
 const estimate=await response.json();
 check(response.status()===201&&estimate.totalCents===36600&&estimate.depositCents===18300&&estimate.discountCents===9400,'Native D1 atomically saves 15% promotion plus $25 bundle: $366 total and $183 deposit');
 const receipt=await request('/api/estimates/'+estimate.id+'/discounts'),saved=await receipt.json();
 check(receipt.status()===200&&saved.bundleDiscountCents===2500&&saved.snapshot.additionalCents===6900&&saved.totalCents===36600,'Native D1 returns frozen separate components bound to saved totals');
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/estimate/'+estimate.shareToken+'?ownerPreview=1');
 const breakdown=page.getByLabel('Agreed discount components');await breakdown.waitFor();
 check((await breakdown.innerText()).includes('$69')&&(await breakdown.innerText()).includes('$25'),'Real public estimate displays agreed promotion and bundle separately');
 await page.goto(origin+'/?openEstimate='+estimate.id);
 const detail=page.getByRole('dialog',{name:'Synthetic Stacked Service',exact:true});await detail.waitFor();
 await detail.getByRole('button',{name:'Edit estimate',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Edit estimate',exact:true});await editor.waitFor();
 await editor.getByRole('button',{name:'Save estimate changes'}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('.estimate-edit-scroll-area fieldset')?.disabled);
 check(await editor.getByLabel('Separate bundle discount ($)',{exact:true}).inputValue()==='25.00','Entire built React editor restores persisted bundle');
 await editor.getByRole('button',{name:'Save estimate changes'}).click();await editor.waitFor({state:'hidden'});
 const after=await(await request('/api/estimates/'+estimate.id+'/discounts')).json();
 check(after.totalCents===36600&&after.bundleDiscountCents===2500,'Built UI no-op save/reopen preserves agreed total instead of applying or dropping discount again');
}
