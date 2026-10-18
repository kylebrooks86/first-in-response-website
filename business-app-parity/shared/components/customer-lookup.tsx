"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Input} from './ui/input';
import {Button} from './ui/button';
export type LookupCustomer={id:string;name:string;email:string;phone:string;address:string};
export function validLookupCustomer(value:unknown):value is LookupCustomer{
 if(!value||typeof value!=='object')return false;
 const row=value as Record<string,unknown>;
 return typeof row.id==='string'&&row.id.length>0&&row.id.length<=128&&['name','email','phone','address'].every(key=>typeof row[key]==='string')&&Boolean(String(row.name).trim());
}
export function CustomerLookup({disabled,onSelect,onCreate}:{disabled:boolean;onSelect:(customer:LookupCustomer)=>void;onCreate:()=>void}){
 const id=useId(),[query,setQuery]=useState(''),[rows,setRows]=useState<LookupCustomer[]>([]),[expanded,setExpanded]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);
 const generation=useRef(0);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const current=++generation.current,controller=new AbortController();setRows([]);setActive(-1);setMore(false);setError('');
  if(!query.trim()||disabled){setLoading(false);return()=>controller.abort();}
  setLoading(true);
  const timer=setTimeout(async()=>{
   try{const response=await fetch('/api/customers/lookup?q='+encodeURIComponent(query.trim()),{cache:'no-store',signal:controller.signal});const data=await response.json() as {customers?:LookupCustomer[];hasMore?:boolean;error?:string};
    if(!response.ok||!Array.isArray(data.customers)||data.customers.some((row:unknown)=>!validLookupCustomer(row))||new Set(data.customers.map((row:LookupCustomer)=>row.id)).size!==data.customers.length)throw Error(data.error||'Customer matches could not be verified.');
    if(current===generation.current){setRows(data.customers);setMore(data.hasMore===true);}
   }catch(err){if(current===generation.current&&!controller.signal.aborted)setError(err instanceof Error?err.message:'Customer search unavailable.');}
   finally{if(current===generation.current)setLoading(false);}
  },180);
  return()=>{clearTimeout(timer);controller.abort();generation.current++;};
 },[query,disabled,retry]);
 useEffect(()=>{if(expanded&&active>=0)document.getElementById(id+'-match-'+active)?.scrollIntoView({block:'nearest'});},[active,expanded,id]);
 const choose=(row:LookupCustomer)=>{setExpanded(false);setQuery('');setRows([]);setActive(-1);onSelect(row);};
 return <section className="customer-lookup" aria-label="Customer lookup">
  <label htmlFor={id}>Find an existing customer</label>
  <Input id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={expanded} aria-controls={id+'-matches'} aria-activedescendant={expanded&&active>=0?id+'-match-'+active:undefined} placeholder="Search name, phone, email, or address" value={query} disabled={disabled} maxLength={160} onFocus={()=>setExpanded(true)} onChange={event=>{setQuery(event.target.value);setExpanded(true);setActive(-1);}} onKeyDown={event=>{
   if(event.key==='ArrowDown'&&rows.length){event.preventDefault();setExpanded(true);setActive(index=>(index+1)%rows.length);}
   else if(event.key==='ArrowUp'&&rows.length){event.preventDefault();setExpanded(true);setActive(index=>index<0?rows.length-1:(index-1+rows.length)%rows.length);}
   else if(event.key==='Enter'&&expanded){event.preventDefault();if(active>=0&&rows[active])choose(rows[active]);}
   else if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();setExpanded(false);}
  }}/>
  {expanded&&query.trim()&&<div className="customer-lookup-results">
   {loading?<p role="status">Searching customers…</p>:error?<div><p role="alert">{error}</p><Button type="button" variant="outline" onClick={()=>setRetry(value=>value+1)}>Retry customer search</Button></div>:<>
    <div id={id+'-matches'} role="listbox" aria-label="Matching customers">{rows.map((row,index)=><button type="button" role="option" id={id+'-match-'+index} aria-selected={active===index} tabIndex={-1} key={row.id} onClick={()=>choose(row)}><strong>{row.name}</strong><span>{[row.phone,row.email].filter(Boolean).join(' · ')||'No phone or email saved'}</span><span>{row.address||'No address saved'}</span></button>)}</div>
    {!rows.length&&<p role="status">No matching customers. Create a new customer if needed.</p>}{more&&<p role="status">More matches available. Keep typing to narrow the search.</p>}
   </>}
  </div>}
  <Button type="button" variant="outline" disabled={disabled} onClick={()=>{setExpanded(false);onCreate();}}>+ Create New Customer</Button>
 </section>;
}
