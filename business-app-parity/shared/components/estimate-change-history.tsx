"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
type ChangeRequest={id:string;message:string;status:string;createdAt:string;resolvedAt?:string|null;resolutionNote?:string|null};
export function EstimateChangeHistory({estimateId,onSummary}:{estimateId:string;onSummary:(pending:number,latest:string|null)=>void}){
  const [rows,setRows]=useState<ChangeRequest[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[confirmId,setConfirmId]=useState<string|null>(null);
  const alive=useRef(true),serial=useRef(0),locked=useRef(false),summary=useRef(onSummary);summary.current=onSummary;
  function accept(requests:ChangeRequest[]){setRows(requests);summary.current(requests.filter(r=>r.status==='open').length,requests.find(r=>r.status==='open')?.message??null);}
  async function refresh(){
    if(locked.current)return;locked.current=true;const current=++serial.current;setBusy(true);setError('');
    try{const response=await fetch(`/api/estimates/${encodeURIComponent(estimateId)}/change-requests`,{cache:'no-store'});const data=await response.json() as {requests?:ChangeRequest[];error?:string};if(!response.ok||!Array.isArray(data.requests))throw Error(data.error||'History could not be loaded.');if(alive.current&&current===serial.current){accept(data.requests);setUncertain(false);setConfirmId(null);}}
    catch(e){if(alive.current&&current===serial.current)setError(e instanceof Error?e.message:'History could not be loaded.');}
    finally{if(current===serial.current){locked.current=false;if(alive.current)setBusy(false);}}
  }
  useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;serial.current++;locked.current=false;};},[estimateId]);
  async function resolve(id:string){
    if(locked.current||uncertain)return;locked.current=true;const current=++serial.current;setBusy(true);setError('');
    try{const response=await fetch(`/api/estimates/${encodeURIComponent(estimateId)}/change-requests`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:id,confirm:true})});const data=await response.json() as {requests?:ChangeRequest[];error?:string};if(!response.ok||!Array.isArray(data.requests))throw Error(data.error||'Resolution result is unconfirmed.');if(alive.current&&current===serial.current){accept(data.requests);setConfirmId(null);}}
    catch{if(alive.current&&current===serial.current){setUncertain(true);setConfirmId(null);setError('Resolution result is unconfirmed. Refresh history to check the saved status before retrying. No automatic retry was sent.');}}
    finally{if(current===serial.current){locked.current=false;if(alive.current)setBusy(false);}}
  }
  const date=(value:string)=>new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago'});
  return <section className="estimate-change-history" aria-label="Customer change-request history" aria-busy={busy}>
    <header><h3>Customer change-request history</h3><Button variant="outline" disabled={busy} onClick={()=>void refresh()}>Refresh history</Button></header>
    {error&&<p role="alert">{error}</p>}
    {rows===null?<p>{busy?'Loading history…':'History unavailable. Refresh to try again.'}</p>:rows.length===0?<p>No customer change requests.</p>:rows.map(row=><article key={row.id}>
      <strong>{row.status==='open'?'Pending':row.status==='resolved'?'Resolved':row.status}</strong><small>Customer requested · {date(row.createdAt)}</small><p className="change-request-text">{row.message}</p>
      {row.status==='resolved'&&(row.resolutionNote?<><small>Resolution recorded · {date(row.resolvedAt!)}</small><p className="change-resolution-note">{row.resolutionNote}</p></>:<small>Previously resolved. Resolution time and actor were not recorded.</small>)}
      {row.status==='open'&&(confirmId===row.id?<div><p>Mark this request resolved? This preserves its history and does not approve revised work, change pricing, or record payment.</p><div className="change-request-actions"><Button disabled={busy||uncertain} onClick={()=>void resolve(row.id)}>Confirm resolution</Button><Button variant="outline" disabled={busy} onClick={()=>setConfirmId(null)}>Cancel</Button></div></div>:<Button variant="outline" disabled={busy||uncertain} onClick={()=>setConfirmId(row.id)}>Mark resolved</Button>)}
    </article>)}
  </section>;
}
