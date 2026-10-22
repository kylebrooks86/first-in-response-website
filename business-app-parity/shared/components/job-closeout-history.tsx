'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
import {validCloseoutHistoryItem,type CloseoutHistoryItem,type CloseoutHistoryState} from '../lib/job-closeout-history';
const labels:Record<CloseoutHistoryState,string>={due:'Check due',waiting:'Awaiting review',snoozed:'Snoozed',received:'Review received', 'needs-review':'Needs verification'};
const date=(value:string)=>new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
export function JobCloseoutHistory({searchQuery='',onOpenCustomer,onOpenEstimate}:{searchQuery?:string;onOpenCustomer:(id:string)=>void;onOpenEstimate:(id:string)=>void}){
 const [items,setItems]=useState<CloseoutHistoryItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[nextCursor,setNextCursor]=useState<string|null>(null);
 const [filter,setFilter]=useState<CloseoutHistoryState|'all'>('due'),[query,setQuery]=useState('');
 const [confirm,setConfirm]=useState<CloseoutHistoryItem|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[saveError,setSaveError]=useState('');
 const generation=useRef(0),pages=useRef(1),busy=useRef(false),readBusy=useRef(false),retryAppend=useRef(false),attempts=useRef<Record<string,string>>({});
 const load=async(append=false)=>{
  if(append&&(!nextCursor||readBusy.current))return;
  const request=++generation.current;readBusy.current=true;retryAppend.current=append;setLoading(true);setError('');
  try{
   let cursor=append?nextCursor:null,count=0;const incoming:CloseoutHistoryItem[]=[];const visited=new Set<string>();
   for(let i=0;i<(append?1:pages.current);i++){
    if(cursor&&visited.has(cursor))throw Error('Closeout history paging did not advance. Refresh to try again.');if(cursor)visited.add(cursor);
    const response=await fetch('/api/job-closeout-history'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{cache:'no-store'});
    if(request!==generation.current)return;
    if(response.status===401||response.status===403){setItems([]);setNextCursor(null);setConfirm(null);throw Error('Unauthorized. Reopen the owner session and refresh review progress.');}
    const data=await response.json() as {items?:unknown[];nextCursor?:unknown;error?:string};
    if(request!==generation.current)return;
    if(!response.ok||!Array.isArray(data.items)||data.items.length>200||!data.items.every(validCloseoutHistoryItem)||!(data.nextCursor===null||typeof data.nextCursor==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(data.nextCursor))||data.nextCursor&&data.nextCursor===cursor)
     throw Error(data.error||'Saved review progress could not be verified. Try again.');
    incoming.push(...data.items);count++;cursor=data.nextCursor as string|null;if(!cursor)break;
   }
   if(request!==generation.current)return;
   const unique=[...new Map(incoming.map(item=>[item.customerId,item])).values()];
   setItems(current=>append?[...current,...unique.filter(item=>!current.some(old=>old.customerId===item.customerId))]:unique);setNextCursor(cursor);pages.current=append?pages.current+count:count;
  }catch(reason){if(request===generation.current)setError(reason instanceof Error?reason.message:'Review progress is unavailable.');}
  finally{if(request===generation.current){setLoading(false);readBusy.current=false;}}
 };
 useEffect(()=>{void load();const refresh=()=>{if(document.visibilityState==='visible'&&!busy.current&&!readBusy.current)void load();};
  window.addEventListener('fire:attention-saved',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);const timer=window.setInterval(refresh,60000);
  return()=>{generation.current++;window.clearInterval(timer);window.removeEventListener('fire:attention-saved',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 useEffect(()=>{if(confirm){const node=document.getElementById('closeout-check-confirmation');node?.scrollIntoView({block:'center',behavior:'instant'});node?.focus({preventScroll:true});}},[confirm]);
 const snooze=async()=>{
  const item=confirm;if(!item?.requestedAt||item.state!=='due'||busy.current||loading||error)return;
  busy.current=true;setSaving(true);setSaveError('');setMessage('');
  const key=item.customerId+'|'+item.requestedAt,operationId=attempts.current[key]??crypto.randomUUID();attempts.current[key]=operationId;
  try{
   const response=await fetch('/api/dashboard-review-checks/snooze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:item.customerId,requestedAt:item.requestedAt,operationId})});
   const data=await response.json() as {saved?:boolean;customerId?:string;snoozeUntil?:string;error?:string};
   if(!response.ok||data.saved!==true||data.customerId!==item.customerId||typeof data.snoozeUntil!=='string'||!Number.isFinite(Date.parse(data.snoozeUntil)))throw Error(data.error||'The saved snooze could not be verified.');
   delete attempts.current[key];setConfirm(null);
   if(Date.parse(data.snoozeUntil)>Date.now())setItems(current=>current.map(row=>row.customerId===item.customerId?{...row,state:'snoozed',snoozeUntil:data.snoozeUntil!}:row));
   setMessage('Review check deferral saved. No customer message was sent.');await load();window.dispatchEvent(new Event('fire:attention-saved'));
  }catch(reason){setSaveError((reason instanceof Error?reason.message:'Snooze not confirmed.')+' Retry this same confirmation to reuse its saved action ID.');}
  finally{busy.current=false;setSaving(false);}
 };
 const searched=items.filter(item=>[item.customerName,item.customerId,item.estimateId].join(' ').toLowerCase().includes(query.trim().toLowerCase())&&item.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
 const matches=searched.filter(item=>filter==='all'||item.state===filter).sort((a,b)=>{
  const rank=(x:CloseoutHistoryItem)=>x.state==='due'?0:x.state==='needs-review'?1:x.state==='waiting'?2:x.state==='snoozed'?3:4;
  return rank(a)-rank(b)||(a.state==='due'?(Date.parse(a.requestedAt!)||0)-(Date.parse(b.requestedAt!)||0):a.customerName.localeCompare(b.customerName))||a.customerId.localeCompare(b.customerId);
 });
 return <section className="closeout-history" aria-label="Review closeout progress" aria-busy={loading}>
  <header><div><h3>Review progress</h3><p>Check posted reviews before deciding on more contact. Received reviews are owner-logged.</p></div><Button variant="outline" disabled={loading||saving} onClick={()=>void load()}>Refresh review progress</Button></header>
  <label htmlFor="closeout-progress-search">Find a customer or job<input id="closeout-progress-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Customer or job ID"/></label>
  <div className="closeout-status-controls" role="group" aria-label="Filter review progress">
   {(['due','waiting','snoozed','received','needs-review','all'] as const).map(state=><Button key={state} variant={filter===state?'default':'outline'} aria-pressed={filter===state} onClick={()=>setFilter(state)}>{state==='all'?'All progress':labels[state]}{!loading&&!error?' ('+(state==='all'?searched.length:searched.filter(item=>item.state===state).length)+')':''}</Button>)}
  </div>
  {(query||filter!=="due")&&<Button variant="outline" onClick={()=>{setQuery("");setFilter("due");}}>Reset review progress view</Button>}
  {!loading&&!error&&<p role="status">{matches.length} matching loaded customer{matches.length===1?"":"s"}{nextCursor?" · Older review records may not be loaded":""}. Confirmed sends and received reviews are owner-recorded, not independently verified.</p>}
  {message&&<p role="status">{message}</p>}{saveError&&<p role="alert" className="save-error">{saveError}</p>}
  {error&&<div role="alert"><p>{error} Previously shown records may be out of date; snoozing is disabled until refreshed.</p><Button variant="outline" disabled={loading||saving} onClick={()=>void load(retryAppend.current)}>Retry review progress</Button></div>}
  {confirm&&<section id="closeout-check-confirmation" className="closeout-confirmation" tabIndex={-1} role="region" aria-label="Confirm review check snooze"><strong>Defer the review status check for {confirm.customerName}?</strong><p>Check again in 7 days. This does not send another review request or log a received review.</p><div><Button disabled={saving||loading||!!error} onClick={()=>void snooze()}>{saving?'Saving…':'Confirm check snooze'}</Button><Button variant="outline" disabled={saving} onClick={()=>{const id=confirm.customerId;setConfirm(null);const node=document.getElementById('closeout-progress-'+id);node?.focus({preventScroll:true});node?.scrollIntoView({block:'center',behavior:'instant'});}}>Cancel</Button></div></section>}
  {loading&&!items.length?<p role="status">Checking saved review progress…</p>:matches.length?<div className="closeout-progress-list">{matches.map(item=><article key={item.customerId} id={'closeout-progress-'+item.customerId} tabIndex={-1} className={'closeout-progress-card '+item.state}>
   <div><strong>{item.customerName}</strong><span className="closeout-state">{labels[item.state]}</span></div>
   {item.requestedAt&&<p>Review request send confirmed by owner · {date(item.requestedAt)}. Delivery is unverified.</p>}
   {!item.requestedAt&&item.state==='snoozed'&&<p>Review request deferred · sending remains unconfirmed.</p>}
   {item.checkDueAt&&item.state==='waiting'&&<p>Check review status after {date(item.checkDueAt)}.</p>}
   {item.state==='due'&&<p>Review status check is due. Check whether a review appeared before considering another message.</p>}
   {item.reviewReceivedAt&&<p>Review received logged {date(item.reviewReceivedAt)}. Google has not verified this in the app.</p>}
   {item.snoozeUntil&&<p>Deferred until {date(item.snoozeUntil)}.</p>}
   {item.state==='needs-review'&&<p>Saved dates need owner review. No new message is suggested.</p>}
   <div className="closeout-card-actions"><Button variant="outline" onClick={()=>onOpenCustomer(item.customerId)}>{item.state==='due'?'Check customer review status':'Customer review activity'}</Button><Button variant="outline" onClick={()=>onOpenEstimate(item.estimateId)}>Open exact job</Button>{item.state==='due'&&<Button variant="outline" disabled={saving||loading||!!error} onClick={()=>{setSaveError('');setMessage('');setConfirm(item);}}>Snooze status check 7 days</Button>}</div>
  </article>)}</div>:!loading&&!error?<p className="record-empty">{searched.length?'No reviews in this status. Choose All progress to see the other saved records.':query||searchQuery?'No matching customers or jobs in loaded review progress.':'No tracked review progress in loaded records. Jobs needing a request remain in Needs request.'}</p>:null}
  {!loading&&!error&&<p className="pay-note" role="status">{matches.length} matching customers from {items.length} loaded records. {nextCursor?'Older review progress is available.':'End of available review progress.'}</p>}
  {nextCursor&&<Button variant="outline" disabled={loading||saving||!!error} onClick={()=>void load(true)}>Load older review progress</Button>}
 </section>;
}
