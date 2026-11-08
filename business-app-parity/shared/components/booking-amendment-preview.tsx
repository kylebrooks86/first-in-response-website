'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
import {BookingReviewDraftPanel} from './booking-review-draft-panel';

type NewRule={id:string;name:string;type:'percent'|'dollar';valueCents:number};
type Preview={
 estimateId:string;bookingConfirmedOn:string;checkedOn:string;status:string;
 customerAlreadyAccepted:boolean;hasFinancialActivity:boolean;
 current:{subtotalCents:number;totalCents:number;depositCents:number};
 proposed:{totalCents:number;depositCents:number;percentBasisPoints:number;flatDiscountCents:number};
 possibleSavingsCents:number;newlyEligible:NewRule[];
 requiresReviewedAmendment:true;changesSavedEstimate:false;warning:string;
};
const money=(c:number)=>'$'+(c/100).toFixed(2);
const safe=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const dateNow=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=(part:string)=>parts.find(p=>p.type===part)?.value??'';
 return value('year')+'-'+value('month')+'-'+value('day');};
function isPreview(input:unknown,id:string,originalTotal:number):input is Preview{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const p=input as Record<string,unknown>,c=p.current as Record<string,unknown>,n=p.proposed as Record<string,unknown>;
 return p.estimateId===id&&p.requiresReviewedAmendment===true&&p.changesSavedEstimate===false&&
   typeof p.bookingConfirmedOn==='string'&&typeof p.checkedOn==='string'&&
   typeof p.customerAlreadyAccepted==='boolean'&&typeof p.hasFinancialActivity==='boolean'&&
   typeof p.status==='string'&&typeof p.warning==='string'&&
   Boolean(c&&n)&&safe(c.totalCents)&&c.totalCents===originalTotal&&safe(c.depositCents)&&safe(c.subtotalCents)&&
   safe(n.totalCents)&&safe(n.depositCents)&&safe(n.percentBasisPoints)&&safe(n.flatDiscountCents)&&
   safe(p.possibleSavingsCents)&&p.possibleSavingsCents===c.totalCents-n.totalCents&&
   Array.isArray(p.newlyEligible)&&p.newlyEligible.length<=40&&p.newlyEligible.every(r=>r&&typeof r==='object'&&
    typeof r.id==='string'&&typeof r.name==='string'&&['percent','dollar'].includes(r.type)&&safe(r.valueCents));
}
export function BookingAmendmentPreview({estimateId,totalCents}:{estimateId:string;totalCents:number}){
 const [bookingOn,setBookingOn]=useState(dateNow),[status,setStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [result,setResult]=useState<Preview|null>(null),[message,setMessage]=useState('');
 const run=useRef(0),abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>{run.current++;abort.current?.abort();},[]);
 const change=(value:string)=>{run.current++;abort.current?.abort();setBookingOn(value);setStatus('idle');setMessage('');setResult(null);};
 const check=async()=>{
  const seq=++run.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  setStatus('loading');setResult(null);setMessage('');
  try{
   const response=await fetch('/api/estimates/'+encodeURIComponent(estimateId)+'/promotion-amendment',{
    method:'POST',cache:'no-store',headers:{'content-type':'application/json'},
    body:JSON.stringify({bookingConfirmedOn:bookingOn}),signal:controller.signal
   });
   const body=await response.json() as unknown;
   if(run.current!==seq)return;
   if(!response.ok){const detail=body&&typeof body==='object'&&'error' in body?(body as {error?:unknown}).error:null;
    throw Error(typeof detail==='string'&&detail.length<250?detail:'Original promotion terms could not be confirmed.');}
   if(!isPreview(body,estimateId,totalCents)||(body as Preview).bookingConfirmedOn!==bookingOn)throw Error('The calculated offer did not match this estimate. No changes made.');
   setResult(body);setStatus('ready');
  }catch(e){if(run.current===seq){setMessage(e instanceof Error&&e.name!=='AbortError'?e.message:'Could not verify the amendment preview. No changes made.');setStatus('error');}}
 };
 return <section className="rounded-lg border p-3 space-y-3" aria-label="Booking promotion adjustment preview">
   <p className="text-sm text-muted-foreground">Optional: preview savings for a later booking. The original quote stays unchanged.</p>
   <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
    <div className="flex-1 space-y-1"><label htmlFor={'booking-preview-date-'+estimateId} className="block text-sm font-semibold">Booking date confirmed by owner (Tulsa)</label>
     <input type="date" id={'booking-preview-date-'+estimateId} className="min-h-11 w-full rounded-md border bg-background p-2 text-foreground"
      min="2020-01-01" max={dateNow()} value={bookingOn} onChange={e=>change(e.target.value)}/></div>
    <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={status==='loading'||!bookingOn} onClick={()=>void check()}>
     {status==='loading'?'Checking saved offers…':'Preview booking adjustment'}</Button>
   </div>
   <details className="rounded-lg border px-3" aria-label="Advanced booking review">
    <summary className="cursor-pointer min-h-11 py-2 font-medium">Internal review (optional)</summary>
    <div className="pb-3"><BookingReviewDraftPanel estimateId={estimateId} totalCents={totalCents} preview={status==='ready'?result:null}/></div>
   </details>
   {status==='loading'&&<p role="status" className="text-sm">Rechecking original saved offer rules and current eligibility…</p>}
   {status==='error'&&<p role="alert" className="text-sm">{message}</p>}
   {status==='ready'&&result&&<div role="status" className="space-y-2 text-sm">
    {result.customerAlreadyAccepted||result.hasFinancialActivity?
     <p><strong>Existing customer or financial commitment:</strong> This preview does not change signed, accepted, invoiced, or paid terms. Any revision requires separate approval.</p>:
     <p><strong>Draft/sent quote:</strong> This is still a proposal. Review before offering any change to the customer.</p>}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
     <div><span className="block">Agreed estimate</span><strong>{money(result.current.totalCents)}</strong><p>Recorded deposit {money(result.current.depositCents)}</p></div>
     <div><span className="block">Possible revised amount</span><strong>{money(result.proposed.totalCents)}</strong><p>Calculated 50% deposit {money(result.proposed.depositCents)}</p></div>
    </div>
    <p><strong>Potential additional savings: {money(result.possibleSavingsCents)}</strong></p>
    <p>{result.newlyEligible.length?'Newly qualifying offers: '+result.newlyEligible.map(r=>r.name).join(' + '):'No additional saved offers qualify for this booking date.'}</p>
    <p>{result.warning}</p>
   </div>}
 </section>;
}
