'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';

type Worksheet={
 format:'fire-internal-amendment-worksheet-v1';estimateId:string;reviewRevision:string;
 bookingConfirmedOn:string;readyToSend:false;changesSavedEstimate:false;requiresCustomerReapproval:true;
 requiresFinancialReview:boolean;original:{subtotalCents:number;totalCents:number;depositCents:number};
 proposed:{totalCents:number;depositCents:number};possibleSavingsCents:number;
 serviceLines:{name:string;quantity:number;unit:string;totalCents:number}[];
 newRules:{id:string;name:string;type:'percent'|'dollar';valueCents:number}[];
 worksheetText:string;
};
const safe=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
function checked(x:unknown,estimateId:string,revision:string,totalCents:number):x is Worksheet{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const p=x as Record<string,unknown>,o=p.original as Record<string,unknown>,n=p.proposed as Record<string,unknown>;
 return p.format==='fire-internal-amendment-worksheet-v1'&&p.estimateId===estimateId&&p.reviewRevision===revision&&
  p.readyToSend===false&&p.changesSavedEstimate===false&&p.requiresCustomerReapproval===true&&
  typeof p.requiresFinancialReview==='boolean'&&typeof p.bookingConfirmedOn==='string'&&
  o!==null&&typeof o==='object'&&n!==null&&typeof n==='object'&&
  safe(o.subtotalCents)&&safe(o.totalCents)&&o.totalCents===totalCents&&safe(o.depositCents)&&
  safe(n.totalCents)&&safe(n.depositCents)&&safe(p.possibleSavingsCents)&&
  o.totalCents-n.totalCents===p.possibleSavingsCents&&
  Array.isArray(p.serviceLines)&&p.serviceLines.length>0&&p.serviceLines.length<=60&&
  p.serviceLines.every(s=>s&&typeof s==='object'&&typeof s.name==='string'&&typeof s.unit==='string'&&
   typeof s.quantity==='number'&&Number.isFinite(s.quantity)&&s.quantity>0&&safe(s.totalCents))&&
  p.serviceLines.reduce((sum,s)=>sum+s.totalCents,0)===o.subtotalCents&&
  Array.isArray(p.newRules)&&p.newRules.length>0&&
  typeof p.worksheetText==='string'&&p.worksheetText.length<15000&&
  p.worksheetText.includes('FOR OWNER REVIEW ONLY')&&p.worksheetText.includes('NOT A CUSTOMER AGREEMENT');
}
export function AmendmentReviewWorksheet({estimateId,revision,totalCents}:{estimateId:string;revision:string;totalCents:number}){
 const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [value,setValue]=useState<Worksheet|null>(null),[error,setError]=useState(''),[copyState,setCopyState]=useState('');
 const seq=useRef(0);
 useEffect(()=>{seq.current++;setStatus('idle');setValue(null);setError('');setCopyState('');return()=>{seq.current++;};},[estimateId,revision,totalCents]);
 const load=async()=>{
  const id=++seq.current;setStatus('loading');setValue(null);setError('');setCopyState('');
  try{
   const res=await fetch('/api/estimates/'+encodeURIComponent(estimateId)+'/promotion-amendment/handoff',{cache:'no-store'});
   const raw=await res.json() as unknown;
   if(seq.current!==id)return;
   if(!res.ok||!checked(raw,estimateId,revision,totalCents)){
    const detail=raw&&typeof raw==='object'&&'error' in raw?(raw as {error?:unknown}).error:null;
    throw Error(typeof detail==='string'&&detail.length<300?detail:'The saved review has changed or the worksheet could not be verified.');
   }
   setValue(raw);setStatus('ready');
  }catch(e){if(seq.current===id){setStatus('error');setError((e instanceof Error?e.message:'Read failed.')+' Nothing has been sent or changed.');}}
 };
 const copy=async()=>{
  if(!value||status!=='ready')return;
  try{
   if(!navigator.clipboard?.writeText)throw Error();
   await navigator.clipboard.writeText(value.worksheetText);
   setCopyState('Owner-only worksheet text copied. Nothing was sent to a customer.');
  }catch{setCopyState('Clipboard unavailable. Select and copy the worksheet text manually. Nothing was sent.');}
 };
 return <section aria-label="Internal amendment worksheet" className="rounded-lg border p-3 space-y-2 text-sm">
  <strong>Prepare revised-estimate review worksheet</strong>
  <p>Uses your saved internal review and the original service lines. This is <strong>not an official revised estimate</strong> and cannot be sent or approved from this panel.</p>
  <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={status==='loading'} onClick={()=>void load()}>
   {status==='loading'?'Revalidating original quote…':'Prepare internal worksheet'}</Button>
  {status==='error'&&<p role="alert">{error}</p>}
  {status==='ready'&&value&&<>
   <p><strong>{value.requiresFinancialReview?'HOLD — agreement/payment review required':'Owner review required before proposing new terms'}</strong></p>
   <p>Saved review and original service subtotal verified. Any later acceptance, invoice, payment or promotion change requires a fresh check.</p>
   <label htmlFor={'amendment-worksheet-'+estimateId} className="block font-semibold">Internal worksheet text — do not send as a customer agreement</label>
   <textarea id={'amendment-worksheet-'+estimateId} className="w-full min-h-64 rounded-md border bg-background p-3 font-mono text-xs text-foreground" rows={14}
    readOnly value={value.worksheetText}/>
   <Button type="button" variant="outline" className="min-h-11" onClick={()=>void copy()}>Copy internal worksheet text</Button>
   {copyState&&<p role="status">{copyState}</p>}
  </>}
 </section>;
}
