'use client';
import {useEffect,useState} from 'react';
import {Button} from './ui/button';
type SavedRule={id:string;name:string;type:'percent'|'dollar';valueCents:number};
type Attribution={format:'fire-estimate-promotions-v1';estimateId:string;catalogRevision:string|null;checkedOn:string;
 selectedServices:string[];rules:SavedRule[];subtotalCents:number;percentBasisPoints:number;flatDiscountCents:number;totalCents:number;depositCents:number;bookingConfirmedOn?:string};
const cents=(v:number)=>'$'+(v/100).toFixed(2);
const label=(p:SavedRule)=>p.type==='percent'?(p.valueCents/100).toFixed(2).replace(/\.00$/,'')+'%':cents(p.valueCents);
const safe=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function validAttribution(v:unknown,estimateId:string,totalCents:number):v is Attribution{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const x=v as Record<string,unknown>;
 return x.format==='fire-estimate-promotions-v1'&&x.estimateId===estimateId&&
  typeof x.checkedOn==='string'&&/^\d{4}-\d\d-\d\d$/.test(x.checkedOn)&&
  (x.bookingConfirmedOn===undefined||typeof x.bookingConfirmedOn==='string'&&/^\d{4}-\d\d-\d\d$/.test(x.bookingConfirmedOn)&&x.bookingConfirmedOn<=x.checkedOn)&&
  safe(x.subtotalCents)&&safe(x.totalCents)&&x.totalCents===totalCents&&safe(x.depositCents)&&
  Array.isArray(x.rules)&&x.rules.length<=40&&x.rules.every(p=>
   p&&typeof p==='object'&&typeof p.id==='string'&&typeof p.name==='string'&&
   ['percent','dollar'].includes(p.type)&&safe(p.valueCents));
}
export function EstimatePromotionHistory({estimateId,totalCents}:{estimateId:string;totalCents:number}){
 const [state,setState]=useState<'loading'|'none'|'ready'|'error'>('loading'),[record,setRecord]=useState<Attribution|null>(null);
 const [seq,setSeq]=useState(0);
 useEffect(()=>{
  let live=true;setState('loading');setRecord(null);
  void (async()=>{
   try{
    const response=await fetch('/api/estimates/'+encodeURIComponent(estimateId)+'/promotions',{cache:'no-store'});
    const data=await response.json() as {estimateId?:unknown;attribution?:unknown};
    if(!response.ok||data.estimateId!==estimateId||!Object.prototype.hasOwnProperty.call(data,'attribution'))throw Error('Unverified promotion receipt');
    if(data.attribution!==null&&!validAttribution(data.attribution,estimateId,totalCents))throw Error('Conflicting totals');
    if(live){setRecord(data.attribution);setState(data.attribution===null?'none':'ready');}
   }catch{if(live)setState('error');}
  })();
  return()=>{live=false;};
 },[estimateId,totalCents,seq]);
 if(state==='none')return null;
 return <section aria-label="Saved promotions on estimate" className="rounded-xl border p-3 space-y-2">
  <div className="flex flex-wrap items-center justify-between gap-2"><strong>Saved promotion history</strong>
   <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={()=>setSeq(value=>value+1)}>Refresh history</Button></div>
  {state==='loading'&&<p role="status" className="text-sm">Verifying original promotion terms…</p>}
  {state==='error'&&<p role="alert" className="text-sm">Saved promotion evidence could not be verified. The agreed quote total is unchanged. Refresh history before relying on rule details.</p>}
  {state==='ready'&&record&&<>
   <p className="text-sm">Rules verified when the estimate was created on {record.checkedOn}. Later promotions or expirations do not change these frozen terms.</p>
   {record.bookingConfirmedOn&&<p className="text-sm"><strong>Owner-attested booking date:</strong> {record.bookingConfirmedOn}. Recorded for promotion eligibility, not as a customer signature.</p>}
   {record.rules.length?record.rules.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 text-sm"><span>{p.name}</span><strong>{label(p)}</strong></div>):
    <p className="text-sm">No automatic discounts qualified at the original promotion check.</p>}
   <div className="text-sm"><span>Original subtotal {cents(record.subtotalCents)} · Quote total {cents(record.totalCents)} · 50% deposit {cents(record.depositCents)}</span></div>
  </>}
 </section>;
}
