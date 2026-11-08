/** Immutable, owner-only estimate creation receipts. No raw customer details are stored in proofs. */
export const ESTIMATE_CREATE_PROOF_PREFIX='fire:estimate-create-request:v1:';
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex=/^[a-f0-9]{64}$/;
export const validEstimateCreateRequestId=(value:unknown):value is string=>typeof value==='string'&&uuidV4.test(value);
export type EstimateCreateProof={
 version:1;requestId:string;requestHash:string;customerId:string;
 subtotalCents:number;discountCents:number;totalCents:number;depositCents:number;
 bundleDiscountCents:number;appreciationDiscount:number;
 additionalDiscountType:string;additionalDiscountValue:number;
 propertyId:string|null;propertyRevision:number|null;promotionAttributionSaved:boolean;
};
export async function fingerprintEstimateCreateRequest(body:Record<string,unknown>):Promise<string>{
 const data=new TextEncoder().encode(JSON.stringify(body));
 const buffer=await crypto.subtle.digest('SHA-256',data);
 return Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function readEstimateCreateProof(raw:string|null):EstimateCreateProof|null{
 if(raw===null)return null;
 if(raw.length>2048)throw Error('Estimate creation proof exceeds the expected size.');
 const v:unknown=JSON.parse(raw);
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid estimate creation proof.');
 const p=v as Record<string,unknown>;
 const keys=['version','requestId','requestHash','customerId','subtotalCents','discountCents','totalCents','depositCents','bundleDiscountCents','appreciationDiscount','additionalDiscountType','additionalDiscountValue','propertyId','propertyRevision','promotionAttributionSaved'];
 if(Object.keys(p).sort().join('|')!==keys.sort().join('|')||p.version!==1||!validEstimateCreateRequestId(p.requestId)||!hex.test(String(p.requestHash))||
 typeof p.customerId!=='string'||!p.customerId||
 !['subtotalCents','discountCents','totalCents','depositCents','bundleDiscountCents','appreciationDiscount','additionalDiscountValue'].every(k=>typeof p[k]==='number'&&Number.isSafeInteger(p[k])&&Number(p[k])>=0)||
 (p.additionalDiscountType!=='percent'&&p.additionalDiscountType!=='dollar')||
 (p.propertyId!==null&&typeof p.propertyId!=='string')||
 (p.propertyRevision!==null&&(typeof p.propertyRevision!=='number'||!Number.isSafeInteger(p.propertyRevision)||p.propertyRevision<0))||
 typeof p.promotionAttributionSaved!=='boolean')throw Error('Unverifiable estimate creation proof.');
 return p as EstimateCreateProof;
}
