'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
type Draft={estimateId:string;revision:string;ownerNote:string;bookingConfirmedOn:string;
 originalTotalCents:number;originalDepositCents:number;proposedTotalCents:number;proposedDepositCents:number;possibleSavingsCents:number};
type VerifiedPreview={bookingConfirmedOn:string;current:{totalCents:number};proposed:{totalCents:number};possibleSavingsCents:number};
const money=(value:number)=>'$'+(value/100).toFixed(2);
const safe=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
const good=(x:unknown,id:string,total:number):x is Draft=>{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const d=x as Record<string,unknown>;
 return d.estimateId===id&&typeof d.revision==='string'&&/^[0-9a-f-]{36}$/i.test(d.revision)&&
 typeof d.ownerNote==='string'&&d.ownerNote.length<=400&&typeof d.bookingConfirmedOn==='string'&&
 safe(d.originalTotalCents)&&d.originalTotalCents===total&&
 safe(d.proposedTotalCents)&&safe(d.possibleSavingsCents)&&
 safe(d.originalDepositCents)&&safe(d.proposedDepositCents)&&
 d.originalTotalCents-d.proposedTotalCents===d.possibleSavingsCents;
};
export function BookingReviewDraftPanel({estimateId,totalCents,preview}:{estimateId:string;totalCents:number;preview:VerifiedPreview|null}){
 const [draft,setDraft]=useState<Draft|null>(null),[stale,setStale]=useState(false);
 const [note,setNote]=useState(''),[phase,setPhase]=useState<'loading'|'ready'|'saving'|'discarding'|'uncertain'>('loading');
 const [error,setError]=useState(''),[discardReady,setDiscardReady]=useState(false);
 const seq=useRef(0),url='/api/estimates/'+encodeURIComponent(estimateId)+'/promotion-amendment/review-draft';
 const load=async()=>{
  const n=++seq.current;setPhase('loading');setError('');setDiscardReady(false);
  try{
   const res=await fetch(url,{cache:'no-store'}),raw=await res.json() as unknown;
   if(n!==seq.current)return;
   if(!res.ok||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error();
   const p=raw as Record<string,unknown>;
   if(typeof p.stale!=='boolean'||!(p.draft===null||good(p.draft,estimateId,totalCents)))throw Error();
   setDraft(p.draft as Draft|null);setStale(p.stale);setNote((p.draft as Draft|null)?.ownerNote??'');setPhase('ready');
  }catch{if(n===seq.current){setPhase('uncertain');setError('Internal draft could not be verified. Refresh saved review before making another change.');}}
 };
 useEffect(()=>{void load();return()=>{seq.current++;};},[estimateId,totalCents]);
 const stage=async()=>{
  if(phase!=='ready'||!preview||stale||preview.possibleSavingsCents<=0)return;
  const n=++seq.current;setPhase('saving');setError('');
  try{
   const r=await fetch(url,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},
    body:JSON.stringify({bookingConfirmedOn:preview.bookingConfirmedOn,expectedOriginalTotalCents:preview.current.totalCents,
     expectedProposedTotalCents:preview.proposed.totalCents,expectedRevision:draft?.revision??null,ownerNote:note})});
   const receipt=await r.json() as {confirmed?:unknown;draft?:unknown;error?:unknown};
   if(n!==seq.current)return;
   if(!r.ok||receipt.confirmed!==true||!good(receipt.draft,estimateId,totalCents))
    throw Error(typeof receipt.error==='string'?receipt.error:'Review save was not confirmed.');
   const read=await fetch(url,{cache:'no-store'}),data=await read.json() as {draft?:unknown;stale?:unknown};
   if(n!==seq.current)return;
   if(!read.ok||data.stale!==false||!good(data.draft,estimateId,totalCents)||data.draft.revision!==receipt.draft.revision)
    throw Error('Review readback could not confirm the saved terms.');
   setDraft(data.draft);setNote(data.draft.ownerNote);setStale(false);setPhase('ready');setDiscardReady(false);
  }catch(e){if(n===seq.current){setPhase('uncertain');setError((e instanceof Error?e.message:'Review save uncertain.')+' Refresh saved review before retrying.');}}
 };
 const discard=async()=>{
  if(phase!=='ready'||!draft||!discardReady)return;
  const n=++seq.current;setPhase('discarding');setError('');
  try{
   const r=await fetch(url,{method:'DELETE',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:draft.revision})});
   const body=await r.json() as {discarded?:unknown;error?:unknown};
   if(n!==seq.current)return;
   if(!r.ok||body.discarded!==true)throw Error(typeof body.error==='string'?body.error:'Discard not confirmed.');
   const check=await fetch(url,{cache:'no-store'}),result=await check.json() as {draft?:unknown};
   if(n!==seq.current)return;
   if(!check.ok||result.draft!==null)throw Error('Discard readback did not confirm removal.');
   setDraft(null);setNote('');setStale(false);setDiscardReady(false);setPhase('ready');
  }catch(e){if(n===seq.current){setPhase('uncertain');setError((e instanceof Error?e.message:'Discard not confirmed.')+' Refresh before another action.');}}
 };
 return <section aria-label="Internal saved review draft" className="rounded-lg border p-3 space-y-2 text-sm">
  <div className="flex flex-wrap items-center justify-between gap-2"><strong>Internal amendment review draft</strong>
   <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={phase==='loading'||phase==='saving'||phase==='discarding'} onClick={()=>void load()}>Refresh saved review</Button></div>
  {phase==='loading'&&<p role="status">Checking owner-only saved review…</p>}
  {phase==='uncertain'&&<p role="alert">{error}</p>}
  {draft&&<div className="space-y-1">
   <p><strong>{stale?'OUTDATED — DO NOT USE':'Saved for owner review only'}</strong></p>
   <p>Original {money(draft.originalTotalCents)} · Possible {money(draft.proposedTotalCents)} · Booking date {draft.bookingConfirmedOn}</p>
   <p>{stale?'Original quote, promotion rules or financial state changed. Recheck before preparing a new review.':'Not a revised customer agreement, payment, booking record or sent message.'}</p>
  </div>}
  {phase==='ready'&&!draft&&<p>No internal review saved for this estimate.</p>}
  {phase==='ready'&&<>
   <label htmlFor={'fire-review-note-'+estimateId} className="block font-semibold">Private owner note (never sent automatically)</label>
   <textarea id={'fire-review-note-'+estimateId} rows={3} maxLength={400} className="w-full rounded-md border p-2 bg-background text-foreground"
    placeholder="e.g. Booking confirmed by phone; revised quote and customer approval still needed"
    value={note} onChange={e=>{setNote(e.target.value);setDiscardReady(false);}}/>
   <div className="flex flex-wrap gap-2">
    <Button type="button" className="min-h-11" disabled={!preview||stale||preview.possibleSavingsCents<=0} onClick={()=>void stage()}>Save internal review draft</Button>
    {draft&&<Button type="button" className="min-h-11" variant="outline" onClick={()=>discardReady?void discard():setDiscardReady(true)}>
     {discardReady?'Confirm discard internal review':'Discard internal review'}</Button>}
   </div>
   {discardReady&&<p role="status">Confirm again to remove only this internal draft, not the estimate.</p>}
  </>}
  {(phase==='saving'||phase==='discarding')&&<p role="status">Verifying internal draft and readback…</p>}
 </section>;
}