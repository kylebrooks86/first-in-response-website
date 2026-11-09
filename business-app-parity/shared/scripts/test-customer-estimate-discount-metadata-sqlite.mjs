/** Actual owner Customers GET /api/customers with disposable SQLite:
 * price/discount terms must survive opening original quote from customer.
 * Synthetic data only; no hosted provider or Stripe calls.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),customers=r.load('app/api/customers/route.ts');
const discount=r.load('lib/discount-input.ts'),eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
let checks=0,network=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{network++;throw Error('Never send remote request');};
const items=[
 {name:'House Wash',description:'Owner chose price above base',quantity:1540,unit:'sq ft',totalCents:38500},
 {name:'Gutter Cleaning + Flush',description:'Owner chose 50 linear feet',quantity:50,unit:'linear ft',totalCents:7500}
];
const base={customer:'Synthetic Discount Customer',email:'discount-customer@example.invalid',address:'Synthetic Tulsa',items};
try{
 let response=await r.post({...base,requestId:randomUUID(),appreciationDiscount:true,additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:2500});
 eq(response.status,201,'Create actual synthetic quote');
 const first=await response.json();
 eq(first.totalCents,34300,'Stacked appreciation 5%, 15% and $25 bundle math');
 response=await r.post({...base,requestId:randomUUID(),customerId:first.customerId,appreciationDiscount:false,additionalDiscountType:'dollar',additionalDiscountValue:1200,bundleDiscountCents:0});
 eq(response.status,201,'Create second genuine quote for same saved customer');
 const second=await response.json();
 eq(second.totalCents,44800,'Separate dollar discount total');
 response=await customers.GET(new Request('https://synthetic.invalid/api/customers'));
 eq(response.status,200,'Owner Customers GET');
 const result=await response.json();
 const a=result.estimates.find(row=>row.id===first.id),d=result.estimates.find(row=>row.id===second.id);
 eq(Boolean(a&&d),true,'Both customer estimates present in actual response');
 eq(a.appreciationDiscount,1,'5% appreciation flag survives Customers history');
 eq(a.additionalDiscountType,'percent','Original percentage discount mode survives');
 eq(a.additionalDiscountValue,1500,'Original 15.00% basis points survive, not fabricated zero');
 eq(a.discountCents,11700,'Full stacked discount cents retained');
 eq(a.subtotalCents,46000,'Original service subtotal retained');
 eq(a.totalCents,34300,'Original agreed total retained');
 eq(a.items.length,2,'Full original service lines retained');
 const saved=await r.get(first.id);eq(saved.status,200,'Independent saved bundle read');
 const bundle=(await saved.json()).bundleDiscountCents;
 eq(bundle,2500,'Saved bundle component remains separate and verified');
 const pricing=discount.quoteDiscounts(a.subtotalCents,Boolean(a.appreciationDiscount),a.additionalDiscountType,a.additionalDiscountValue,bundle);
 eq(pricing.total,a.totalCents,'Opened customer quote exactly reconstructs actual saved price');
 eq(pricing.appliedDiscount,a.discountCents,'Opened customer quote exactly reconstructs discount amount');
 eq(pricing.deposit,a.depositCents,'Original deposit remains exact');
 eq(d.additionalDiscountType,'dollar','Separate dollar discount mode survives');
 eq(d.additionalDiscountValue,1200,'Separate $12 amount stored as exact cents');
 eq(d.appreciationDiscount,0,'Separate quote has no appreciation discount');
 eq(discount.quoteDiscounts(d.subtotalCents,false,d.additionalDiscountType,d.additionalDiscountValue,0).total,d.totalCents,'Separate dollar-discount quote can also be safely edited from Customers');
 r.setOwner({email:'nonowner@example.invalid'});
 eq((await customers.GET(new Request('https://synthetic.invalid/api/customers'))).status,401,'Nonowner cannot read customer discounts');
 eq(network,0,'No external network or payments');
 console.log('PASS '+checks+'/'+checks+': actual Customers API preserves per-estimate appreciation and exact original percentage/dollar discount terms without changing quote, bundle, or deposit.');
}finally{globalThis.fetch=originalFetch;r.db.close();}
