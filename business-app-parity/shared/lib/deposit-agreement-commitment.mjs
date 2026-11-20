/** Canonical proposed deposit agreement snapshot. No payment or approval action. */
export const DEPOSIT_AGREEMENT_VERSION='deposit-exception-v1';
export const agreementVersion=eventId=>DEPOSIT_AGREEMENT_VERSION+':'+eventId;
export const agreementScope=items=>JSON.stringify(items.map(x=>[x.id,x.name,x.description,x.quantity,x.unit,x.total_cents]));
export async function agreementDigest({eventId,totalCents,depositCents,mode,scope,terms}){
 const body=JSON.stringify({format:DEPOSIT_AGREEMENT_VERSION,eventId,totalCents,depositCents,mode,scope,terms});
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export function validateAgreementItems(items,subtotal,discount,total){
 if(!Array.isArray(items)||items.length===0||items.length>100||![subtotal,discount,total].every(Number.isSafeInteger)||
  subtotal<0||discount<0||discount>subtotal||total!==subtotal-discount)return false;
 let sum=0;
 for(const item of items){
  if(typeof item.id!=='string'||!item.id||typeof item.name!=='string'||!item.name.trim()||
     typeof item.description!=='string'||!Number.isSafeInteger(item.quantity)||item.quantity<=0||
     typeof item.unit!=='string'||!Number.isSafeInteger(item.total_cents)||item.total_cents<0)return false;
  sum+=item.total_cents;if(!Number.isSafeInteger(sum))return false;
 }
 return sum===subtotal;
}
