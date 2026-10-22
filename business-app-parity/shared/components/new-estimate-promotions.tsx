'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
import type {PromotionEvidence} from '../lib/estimate-promotion-attribution';
type Offer={id:string;name:string;type:'percent'|'dollar';valueCents:number;startOn?:string|null;endOn?:string|null};
type Preview={revision:string|null;checkedOn:string;eligible:Offer[];pendingBooking:Offer[];percentBasisPoints:number;dollarCents:number;blocked:string|null;previewTotalCents:number|null;previewDepositCents:number|null};
const safe=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function validPreview(v:unknown):v is Preview{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const x=v as Record<string,unknown>;
 const offer=(p:unknown):p is Offer=>Boolean(p&&typeof p==='object'&&!Array.isArray(p)&&
  typeof (p as Offer).id==='string'&&typeof (p as Offer).name==='string'&&
  ['percent','dollar'].includes((p as Offer).type)&&safe((p as Offer).valueCents));
 return (x.revision===null||typeof x.revision==='string')&&typeof x.checkedOn==='string'&&
  /^\d{4}-\d\d-\d\d$/.test(x.checkedOn)&&Array.isArray(x.eligible)&&x.eligible.every(offer)&&
  Array.isArray(x.pendingBooking)&&x.pendingBooking.every(offer)&&
  safe(x.percentBasisPoints)&&x.percentBasisPoints<=5000&&safe(x.dollarCents)&&
  (x.blocked===null||typeof x.blocked==='string')&&(x.previewTotalCents===null||safe(x.previewTotalCents))&&
  (x.previewDepositCents===null||safe(x.previewDepositCents));
}
export function NewEstimatePromotions({active,quoteKey,serviceIds,subtotalCents,appreciationDiscount,manualOverride,onApply,onVerified}:
{active:boolean;quoteKey:string;serviceIds:string[];subtotalCents:number;appreciationDiscount:boolean;manualOverride:boolean;
 onApply:(percentBasisPoints:number,dollarCents:number,evidence:PromotionEvidence|null)=>void;onVerified:(key:string|null)=>void}){
 const [status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle'),[preview,setPreview]=useState<Preview|null>(null);
 const [message,setMessage]=useState(''),[skipped,setSkipped]=useState(false),[refresh,setRefresh]=useState(0);
 const serial=JSON.stringify(serviceIds);
 const seq=useRef(0),applyRef=useRef(onApply),verifiedRef=useRef(onVerified),overrideRef=useRef(manualOverride),keyRef=useRef(quoteKey);
 applyRef.current=onApply;verifiedRef.current=onVerified;overrideRef.current=manualOverride;keyRef.current=quoteKey;
 useEffect(()=>{
  if(!active)return;
  const id=++seq.current,expectedKey=quoteKey;
  setStatus('loading');setPreview(null);setMessage('');setSkipped(false);verifiedRef.current(null);
  // No verified offer may survive a changed scope, expired window or failed refresh.
  if(!overrideRef.current)applyRef.current(0,0,null);
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch('/api/saved-promotions/preview',{method:'POST',cache:'no-store',
     headers:{'content-type':'application/json'},body:JSON.stringify({serviceIds:JSON.parse(serial),subtotalCents,appreciationDiscount})});
    const body=await response.json() as unknown;
    if(!response.ok||!validPreview(body))throw Error('Invalid verified promotion preview.');
    if(seq.current!==id||keyRef.current!==expectedKey)return;
    setPreview(body);setStatus('ready');
    if(body.blocked){setMessage(body.blocked);verifiedRef.current(null);return;}
    if(!overrideRef.current)applyRef.current(body.percentBasisPoints,body.dollarCents,{revision:body.revision,checkedOn:body.checkedOn,ruleIds:body.eligible.map(p=>p.id),serviceIds:JSON.parse(serial) as string[]});
    verifiedRef.current(expectedKey);
   }catch{
    if(seq.current!==id||keyRef.current!==expectedKey)return;
    setStatus('error');setMessage('Saved promotions were not verified. Retry or deliberately proceed without automatic promotions.');
    verifiedRef.current(null);
   }
  },180);
  return()=>{clearTimeout(timer);seq.current++;};
 },[active,quoteKey,serial,subtotalCents,appreciationDiscount,refresh]);
 if(!active)return null;
 return <section className="rounded-xl border p-3 space-y-3" aria-label="Saved promotion suggestions">
  <div className="flex flex-wrap items-center justify-between gap-2"><strong>Saved promotions</strong>
   <Button type="button" variant="outline" className="min-h-11" onClick={()=>setRefresh(n=>n+1)}>Refresh offers</Button></div>
  {status==='loading'&&<p role="status" className="text-sm">Checking current saved promotions…</p>}
  {message&&<p role="alert" className="text-sm">{message}</p>}
  {status==='ready'&&preview&&!preview.blocked&&<>
   <p className="text-sm">{preview.eligible.length?
    preview.eligible.length+' eligible saved offer(s): '+preview.eligible.map(p=>p.name).join(' + ')+'. '+(manualOverride?'Your custom amount is preserved.':'Qualifying amounts were filled in automatically.'):
    'No saved promotions qualify for these services and the estimate date.'}</p>
   {preview.pendingBooking.length>0&&<p className="text-sm"><strong>Booking required:</strong> {preview.pendingBooking.map(p=>p.name+(p.endOn?' (book by '+p.endOn+')':'')).join('; ')}. These remain reminders until booking is confirmed.</p>}
   {manualOverride&&preview.eligible.length>0&&<Button className="min-h-11" variant="outline" onClick={()=>applyRef.current(preview.percentBasisPoints,preview.dollarCents,{revision:preview.revision,checkedOn:preview.checkedOn,ruleIds:preview.eligible.map(p=>p.id),serviceIds:JSON.parse(serial) as string[]})}>Use saved offers</Button>}
  </>}
  {(status==='error'||Boolean(preview?.blocked))&&<Button type="button" variant="outline" className="min-h-11" onClick={()=>{setSkipped(true);setMessage('Owner bypassed promotion verification. Review discounts manually.');verifiedRef.current(quoteKey);}}>Continue without automatic promotions</Button>}
  {skipped&&<p role="status" className="text-sm">Promotion verification explicitly skipped for this estimate.</p>}
 </section>;
}
