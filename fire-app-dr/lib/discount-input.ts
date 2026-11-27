/** Accept only exact nonnegative integer cents/basis-points.
 * Retain compatibility with integer strings from older clients; reject fractional,
 * negative, overflowed or malformed input rather than rounding/clamping it.
 */
export function submittedDiscountCents(raw:unknown):number|null{
  if(raw===undefined||raw===null)return 0;
  const value=typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):raw;
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
}

/** Discount components are frozen alongside the saved aggregate, not inferred
 * from today's settings. Namespaced owner metadata uses existing backup storage.
 * No migration, historical backfill or recalculation happens on reads. */
export const DISCOUNT_SNAPSHOT_PREFIX='fire:estimate-discounts:v1:';
export function quoteDiscounts(subtotal:number,appreciation:boolean,mode:'percent'|'dollar',value:number,bundle=0){
  if(!Number.isSafeInteger(subtotal)||subtotal<0||typeof value!=='number'||!Number.isSafeInteger(value)||value<0||typeof bundle!=='number'||!Number.isSafeInteger(bundle)||bundle<0)throw Error('Enter valid exact-cent discounts.');
  if(mode==='percent'&&value>(appreciation?4500:5000))throw Error('Percentage discounts including appreciation cannot exceed 50%.');
  if(mode==='dollar'&&value>subtotal||bundle>subtotal)throw Error('Dollar discounts cannot exceed the service subtotal.');
  const appreciationCents=appreciation?Math.round(subtotal*0.05):0;
  const additionalCents=mode==='percent'?Math.round(subtotal*(value/10000)):value;
  const sum=BigInt(appreciationCents)+BigInt(additionalCents)+BigInt(bundle);
  const requestedDiscount=Number(sum>BigInt(subtotal)?BigInt(subtotal):sum);
  // FIRE charges the edited service price, not an automatic job minimum.
  const total=Math.max(0,subtotal-requestedDiscount),appliedDiscount=Math.max(0,subtotal-total),deposit=Math.round(total/2);
  return{appreciationCents,additionalCents,bundleDiscountCents:bundle,requestedDiscount,appliedDiscount,total,deposit};
}
/** Only for verifying historical quotes saved under the removed $150 floor.
 * Never use this for any new estimate or invoice calculation. */
function historicalFloorDiscounts(subtotal:number,appreciation:boolean,mode:'percent'|'dollar',value:number,bundle=0){
  const current=quoteDiscounts(subtotal,appreciation,mode,value,bundle);
  const total=Math.max(15000,current.total);
  return {...current,total,appliedDiscount:Math.max(0,subtotal-total),deposit:Math.round(total/2)};
}
function historicalFloorSnapshot(estimateId:string,subtotalCents:number,appreciationDiscount:boolean,additionalDiscountType:'percent'|'dollar',additionalDiscountValue:number,bundleDiscountCents:number){
  return {format:'fire-estimate-discounts-v1',estimateId,subtotalCents,appreciationDiscount,additionalDiscountType,additionalDiscountValue,...historicalFloorDiscounts(subtotalCents,appreciationDiscount,additionalDiscountType,additionalDiscountValue,bundleDiscountCents)};
}
export function discountSnapshot(estimateId:string,subtotalCents:number,appreciationDiscount:boolean,additionalDiscountType:'percent'|'dollar',additionalDiscountValue:number,bundleDiscountCents:number){
  return{format:'fire-estimate-discounts-v1',estimateId,subtotalCents,appreciationDiscount,additionalDiscountType,additionalDiscountValue,...quoteDiscounts(subtotalCents,appreciationDiscount,additionalDiscountType,additionalDiscountValue,bundleDiscountCents)};
}
export type DiscountSnapshot=ReturnType<typeof discountSnapshot>;
export function readDiscountSnapshot(estimateId:string,raw:string|null,stored:{subtotalCents:number;discountCents:number;totalCents:number;depositCents:number}):DiscountSnapshot|null{
  if(raw===null)return null;
  if(typeof raw!=='string'||raw.length>8000)throw Error('Saved discount breakdown requires review.');
  const value=JSON.parse(raw);
  if(!value||value.format!=='fire-estimate-discounts-v1'||value.estimateId!==estimateId||typeof value.appreciationDiscount!=='boolean'||!['percent','dollar'].includes(value.additionalDiscountType))throw Error('Saved discount breakdown requires review.');
  const expected=discountSnapshot(estimateId,value.subtotalCents,value.appreciationDiscount,value.additionalDiscountType,value.additionalDiscountValue,value.bundleDiscountCents);
  const historical=historicalFloorSnapshot(estimateId,value.subtotalCents,value.appreciationDiscount,value.additionalDiscountType,value.additionalDiscountValue,value.bundleDiscountCents);
  const matches=(candidate:typeof expected)=>Object.keys(value).sort().join(',')===Object.keys(candidate).sort().join(',')&&Object.entries(candidate).every(([key,item])=>value[key]===item)&&stored.subtotalCents===candidate.subtotalCents&&stored.discountCents===candidate.appliedDiscount&&stored.totalCents===candidate.total&&stored.depositCents===candidate.deposit;
  if(matches(expected))return expected;
  // Do not alter an existing agreed customer total merely because the rule changed.
  if(matches(historical))return historical;
  throw Error('Saved discount breakdown differs from the agreed totals. Refresh and review; no prices changed.');
}
export function verifiedSavedDiscounts(estimateId:string,raw:string|null,stored:{subtotalCents:number;discountCents:number;totalCents:number;depositCents:number;appreciationDiscount:number|boolean;additionalDiscountType:string;additionalDiscountValue:number}){
 const snapshot=readDiscountSnapshot(estimateId,raw,stored);if(snapshot){
  if(snapshot.appreciationDiscount!==Boolean(Number(stored.appreciationDiscount))||snapshot.additionalDiscountType!==stored.additionalDiscountType||snapshot.additionalDiscountValue!==stored.additionalDiscountValue)throw Error('Saved discount inputs differ from the agreed breakdown.');
  return snapshot;
 }
 // Missing metadata is safe only for a mathematically consistent legacy quote.
 // Never infer a lost bundle from an aggregate or silently convert it to zero.
 const args=[stored.subtotalCents,Boolean(Number(stored.appreciationDiscount)),stored.additionalDiscountType==='dollar'?'dollar':'percent',stored.additionalDiscountValue,0] as const;
 const current=quoteDiscounts(...args),historical=historicalFloorDiscounts(...args);
 if(![current,historical].some(quote=>quote.appliedDiscount===stored.discountCents&&quote.total===stored.totalCents&&quote.deposit===stored.depositCents))throw Error('Saved discount terms require review before repricing.');
 return null;
}
