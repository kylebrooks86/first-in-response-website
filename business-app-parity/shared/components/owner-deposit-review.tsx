"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Snapshot={status:string;totalCents:number;depositCents:number;paidCents:number;acceptedAt:string|null;signedAt:string|null;contractVersion:string|null};
type Audit={id:string;confirmation_id:string;created_at:string;mode:string;previous_deposit_cents:number;new_deposit_cents:number;actor_email:string;reason:string|null};
type State={policy:{remainingDepositCents:number|null;canSchedule:boolean;message:string|null};currentSnapshot?:Snapshot;
 exceptionReview?:{syntheticOnly:boolean;readOnly:boolean;hostedActivation:boolean;canReviewUnsignedDraft:boolean;latestEventId:string|null;events:Audit[];customerExposureDetected:boolean;signedAgreementPresent:boolean;message:string};error?:string};
type Mode="standard"|"waive"|"percentage"|"fixed"|"schedule-before-deposit"|"restore-standard";
const choices:[Mode,string][]=[["standard","Standard 50%"],["waive","Waive upfront deposit"],["percentage","Custom percentage"],["fixed","Custom dollar amount"],["schedule-before-deposit","Request collection deferral"],["restore-standard","Restore standard 50%"]];
const money=(n:number)=>"$"+(n/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
function parseAmount(s:string):number{
 if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(s))throw Error("Enter a positive dollar amount using no more than two decimals.");
 const [d,c=""]=s.split(".");
 const value=BigInt(d)*100n+BigInt(c.padEnd(2,"0"));
 if(value>BigInt(Number.MAX_SAFE_INTEGER))throw Error("The amount is outside the permitted accounting range.");
 return Number(value);
}
function parsePercent(s:string):number{
 if(!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(s))throw Error("Enter a percentage from 0 to 100 with at most two decimals.");
 const [whole,part=""]=s.split(".");
 const basis=Number(whole)*100+Number(part.padEnd(2,"0"));
 if(!Number.isSafeInteger(basis)||basis>10000)throw Error("Deposit percentage cannot exceed 100%.");
 return basis;
}
function preview(total:number,deposit:number,mode:Mode,amount:string):{required:number;basis?:number;fixed?:number}{
 if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(deposit)||deposit<0||deposit>total)throw Error("The stored estimate amounts need reconciliation.");
 let required=Number((BigInt(total)+1n)/2n),basis:undefined|number,fixed:undefined|number;
 if(mode==="waive")required=0;
 if(mode==="schedule-before-deposit")required=deposit;
 if(mode==="percentage"){basis=parsePercent(amount);required=Number((BigInt(total)*BigInt(basis)+5000n)/10000n);}
 if(mode==="fixed"){fixed=parseAmount(amount);required=fixed;}
 if(required>total)throw Error("The deposit cannot exceed the price after discounts.");
 return {required,...(basis===undefined?{}:{basis}),...(fixed===undefined?{}:{fixed})};
}

/** Owner-only synthetic candidate review; never authorizes a job or payment. */
export function OwnerDepositReview({estimateId}:{estimateId:string}){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState<Mode>("standard"),[amount,setAmount]=useState(""),[reason,setReason]=useState("");
 const [reviewed,setReviewed]=useState(false),[explicit,setExplicit]=useState(false),[uncertain,setUncertain]=useState(false);
 const [pending,setPending]=useState<{confirmationId:string;body:Record<string,unknown>}|null>(null);
 const requestNo=useRef(0),lock=useRef(false);
 const refresh=useCallback(async()=>{
  const n=++requestNo.current;setError("");
  try{
   const r=await fetch("/api/estimates/"+encodeURIComponent(estimateId)+"/deposit-policy",{cache:"no-store"});
   const body=await r.json() as State;
   if(!r.ok||!body.policy)throw Error(body.error||"Deposit review unavailable.");
   if(n===requestNo.current){setState(body);setReviewed(false);setExplicit(false);}
  }catch(e){if(n===requestNo.current){setState(null);setError(e instanceof Error?e.message:"Cannot load deposit review.");}}
 },[estimateId]);
 useEffect(()=>{void refresh();return()=>{requestNo.current++;};},[refresh]);
 const current=state?.currentSnapshot,review=state?.exceptionReview;
 const allowed=Boolean(current&&review?.canReviewUnsignedDraft&&!uncertain&&!busy);
 let proposed:{required:number;basis?:number;fixed?:number}|null=null,validation="";
 try{if(current)proposed=preview(current.totalCents,current.depositCents,mode,amount);}
 catch(e){validation=e instanceof Error?e.message:"Invalid proposed terms.";}
 const changed=Boolean(current&&proposed&&(current.depositCents!==proposed.required||mode==="schedule-before-deposit"));
 const submission=()=>{
  if(!current||!proposed||!review)throw Error("Reload the latest verified estimate and audit.");
  return {
   mode,confirmed:true,expectedStatus:current.status,expectedTotalCents:current.totalCents,
   expectedDepositCents:current.depositCents,expectedPaidCents:current.paidCents,
   expectedSignedAt:current.signedAt,expectedContractVersion:current.contractVersion,
   ...(mode==="percentage"?{percentBasisPoints:proposed.basis}:{}),
   ...(mode==="fixed"?{fixedCents:proposed.fixed}:{}),
   reason:reason.trim()
  };
 };
 const save=async()=>{
  if(lock.current||!allowed||!reviewed||!explicit||!current||!review||!proposed)return;
  lock.current=true;setBusy(true);setError("");
  const id=crypto.randomUUID();
  const body={...submission(),confirmationId:id,expectedLastEventId:review.latestEventId};
  setPending({confirmationId:id,body});
  try{
   const r=await fetch("/api/estimates/"+encodeURIComponent(estimateId)+"/deposit-policy",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
   const response=await r.json() as {recorded?:boolean;auditEventId?:string;error?:string;saveUncertain?:boolean};
   if(r.ok&&response.recorded&&response.auditEventId){
    setPending(null);setUncertain(false);setExplicit(false);setReviewed(false);
    await refresh();return;
   }
   if(response.saveUncertain||r.status>=500){setUncertain(true);setError(response.error||"Save result uncertain. Refresh audit before any deliberate retry.");}
   else {setPending(null);setExplicit(false);setReviewed(false);setError(response.error||"Deposit exception rejected. Refresh and review.");}
  }catch{setUncertain(true);setError("The save result is unknown. Do not create a new confirmation. Review the audit first.");}
  finally{lock.current=false;setBusy(false);}
 };
 const reconcile=async()=>{
  if(lock.current)return;setBusy(true);setError("");
  try{
   const n=++requestNo.current;
   const r=await fetch("/api/estimates/"+encodeURIComponent(estimateId)+"/deposit-policy",{cache:"no-store"});
   const data=await r.json() as State;
   if(!r.ok||!data.exceptionReview)throw Error(data.error||"Owner audit cannot be checked.");
   if(n!==requestNo.current)return;
   setState(data);
   const found=pending&&data.exceptionReview.events.find(e=>e.confirmation_id===pending.confirmationId);
   if(found&&found.id===data.exceptionReview.latestEventId&&found.new_deposit_cents===data.currentSnapshot?.depositCents){
    setPending(null);setUncertain(false);setReviewed(false);setExplicit(false);
   }else setError("No matching confirmation receipt was established. Review history and financial terms before taking any new action.");
  }catch(e){setError(e instanceof Error?e.message:"Audit reconciliation failed.");}
  finally{setBusy(false);}
 };
 return <section className="estimate-change-history" aria-label="Owner deposit policy and audit history">
  <header><h3>Deposit policy &amp; owner audit</h3><button type="button" className="brand-button" disabled={busy} onClick={()=>void refresh()}>Refresh</button></header>
  {error&&<p role="alert" className="save-error">{error}</p>}
  {!state?<p>Deposit policy is not currently verified.</p>:
   <div className="revision-totals">
    <span>Required deposit<strong>{current?money(current.depositCents):state.policy.remainingDepositCents===null?"Review required":"Standard policy"}</strong></span>
    {current&&<><span>Total after discounts<strong>{money(current.totalCents)}</strong></span><span>Net principal paid<strong>{money(current.paidCents)}</strong></span></>}
    <span>Scheduling<strong>{state.policy.canSchedule?"Policy checks passed":"Blocked until other requirements are met"}</strong></span>
    {state.policy.message&&<p>{state.policy.message}</p>}
   </div>}
  {review&&<div>
   <p><strong>{review.syntheticOnly?"Synthetic owner exception review":"Deposit audit"}</strong> — customer signing and payment are separate.</p>
   {review.events.length===0?<p>No owner deposit exceptions recorded.</p>:
    <div className="invoice-revision-list">{review.events.slice(0,12).map(event=><article key={event.id} className="invoice-revision-row">
     <strong>{event.mode}</strong><p>{money(event.previous_deposit_cents)} → {money(event.new_deposit_cents)}</p>
     <small>{event.created_at} · {event.reason||"No reason supplied"}</small><small>Audit: {event.id}</small>
    </article>)}</div>}
   {review.signedAgreementPresent||review.customerExposureDetected?<p>These terms have been shared, viewed, or signed. This screen cannot rewrite them. A reviewed reissue or customer reapproval workflow is required.</p>:null}
   {!review.canReviewUnsignedDraft?<p>Owner exception recording is unavailable for this estimate. Existing financial, customer, or agreement records must remain unchanged.</p>:
    <div className="edit-discount-card">
     <label htmlFor={"deposit-mode-"+estimateId}>Proposed deposit option</label>
     <select id={"deposit-mode-"+estimateId} value={mode} disabled={busy||uncertain}
      onChange={e=>{setMode(e.target.value as Mode);setReviewed(false);setExplicit(false);}}>
      {choices.map(([value,label])=><option value={value} key={value}>{label}</option>)}
     </select>
     {(mode==="fixed"||mode==="percentage")&&<label>Amount {mode==="fixed"?"(USD)":"(%)"}
      <input type="text" inputMode="decimal" value={amount} disabled={busy||uncertain}
       onChange={e=>{setAmount(e.target.value);setReviewed(false);setExplicit(false);}} placeholder={mode==="fixed"?"75.00":"25.00"}/>
     </label>}
     <label>Internal reason (optional, up to 500 characters)
      <textarea rows={2} maxLength={500} value={reason} disabled={busy||uncertain}
       onChange={e=>{setReason(e.target.value);setReviewed(false);setExplicit(false);}}/>
     </label>
     {validation&&<p role="alert">{validation}</p>}
     {proposed&&current&&<div className="revision-totals">
      <span>Current upfront deposit<strong>{money(current.depositCents)}</strong></span>
      <span>Proposed upfront deposit<strong>{money(proposed.required)}</strong></span>
      <span>Remaining price after deposit<strong>{money(current.totalCents-proposed.required)}</strong></span>
      {mode==="schedule-before-deposit"&&<p>Deferral does not waive the deposit or authorize scheduling.</p>}
     </div>}
     {!reviewed?<button type="button" className="brand-button" disabled={!allowed||!proposed||!changed}
       onClick={()=>setReviewed(true)}>Review this exception</button>:
      <div>
       <label><input type="checkbox" checked={explicit} disabled={busy||uncertain}
        onChange={e=>setExplicit(e.target.checked)}/>
        I authorize recording these proposed terms in this synthetic draft and understand that customer agreement, scheduling and payment remain separate.
       </label>
       <button type="button" className="brand-button" disabled={!allowed||!explicit||!changed}
        onClick={()=>void save()}>Record owner exception</button>
      </div>}
     </div>}
   {uncertain&&<div role="alert">
    <p>Confirmation result is uncertain. No automatic retry will occur. Refresh the immutable audit; if unresolved, stop and investigate.</p>
    <button type="button" disabled={busy} onClick={()=>void reconcile()}>Review audit and reconcile</button>
   </div>}
  </div>}
 </section>;
}
