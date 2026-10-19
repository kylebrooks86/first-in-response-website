"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Search,X,Users,ClipboardList,Receipt,CalendarDays,CircleDollarSign,StickyNote,MapPin} from 'lucide-react';
export type SearchResult={id:string;kind:'customer'|'estimate'|'invoice'|'job'|'payment'|'note'|'property';title:string;customerId?:string;address?:string|null;customer?:string;phone?:string;email?:string;service?:string;status?:string;scheduledAt?:string|null;createdAt?:string;excerpt?:string;amountCents?:number};
const filters=[['all','All'],['customers','Customers'],['estimates','Estimates'],['invoices','Invoices'],['jobs','Jobs'],['payments','Payments'],['notes','Notes'],['properties','Properties']] as const;
const icons={customer:Users,estimate:ClipboardList,invoice:Receipt,job:CalendarDays,payment:CircleDollarSign,note:StickyNote,property:MapPin};
const names={customer:'Customer',estimate:'Estimate',invoice:'Invoice',job:'Job',payment:'Payment record',note:'Note',property:'Property'};
function valid(value:unknown):value is SearchResult{if(!value||typeof value!=='object')return false;const r=value as SearchResult;return typeof r.id==='string'&&r.id.length>0&&r.id.length<=200&&Object.hasOwn(icons,r.kind)&&typeof r.title==='string'&&r.title.length>0&&['address','customer','customerId','phone','email','service','status','scheduledAt','createdAt','excerpt'].every(key=>{const v=(r as unknown as Record<string,unknown>)[key];return v===undefined||v===null||typeof v==='string';})&&(!r.scheduledAt||Number.isFinite(Date.parse(r.scheduledAt)))&&(!r.createdAt||Number.isFinite(Date.parse(r.createdAt)))&&(r.amountCents===undefined||Number.isSafeInteger(r.amountCents))&&(!['payment','note','property'].includes(r.kind)||typeof r.customerId==='string'&&r.customerId.length>0&&r.customerId.length<=200);}
export function GlobalSearch({query,onQuery,onSelect,active=true,disabled=false,menu=false}:{query:string;onQuery:(value:string)=>void;onSelect:(row:SearchResult)=>void;active?:boolean;disabled?:boolean;menu?:boolean}){
  const id=useId(),root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),generation=useRef(0);
  const [scope,setScope]=useState('all'),[rows,setRows]=useState<SearchResult[]>([]),[expanded,setExpanded]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false),[selected,setSelected]=useState(-1),[retry,setRetry]=useState(0),[height,setHeight]=useState(360);
  useEffect(()=>{
    const serial=++generation.current,controller=new AbortController();setRows([]);setSelected(-1);setMore(false);setError('');
    if(!active||disabled||!expanded||!query.trim()){setLoading(false);return()=>controller.abort();}
    setLoading(true);
    const timer=setTimeout(async()=>{try{
      const response=await fetch('/api/search?q='+encodeURIComponent(query.trim())+'&scope='+scope,{cache:'no-store',signal:controller.signal});const data=await response.json() as {results?:unknown[];hasMore?:boolean;error?:string};
      if(!response.ok||!Array.isArray(data.results)||!data.results.every(valid)||new Set(data.results.map(r=>r.kind+':'+r.id)).size!==data.results.length)throw Error(data.error||'Search results could not be verified.');
      if(serial===generation.current){setRows(data.results);setMore(data.hasMore===true);}
    }catch(e){if(serial===generation.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Search needs a connection. Try again when connected.');}
    finally{if(serial===generation.current)setLoading(false);}},180);
    return()=>{clearTimeout(timer);controller.abort();generation.current++;};
  },[query,scope,active,expanded,disabled,retry]);
  useEffect(()=>{if(!expanded||!active)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setExpanded(false);};const resize=()=>{const rect=root.current?.getBoundingClientRect();if(rect)setHeight(Math.max(0,Math.min(360,(window.visualViewport?.height??window.innerHeight)+(window.visualViewport?.offsetTop??0)-rect.bottom-12)));};resize();document.addEventListener('pointerdown',close);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);return()=>{document.removeEventListener('pointerdown',close);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);};},[expanded,active]);
  useEffect(()=>{if(selected>=0)document.getElementById(id+'-'+selected)?.scrollIntoView({block:'nearest'});},[selected,id]);
  const choose=(row:SearchResult)=>{input.current?.blur();setExpanded(false);setScope('all');onQuery('');onSelect(row);};
  return <div className={menu?'global-search global-search-menu':'global-search'} ref={root}>
    <label className="search-box" htmlFor={id}><Search aria-hidden="true"/><input id={id} ref={input} role="combobox" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={160} disabled={disabled} value={query} placeholder="Search FIRE records" aria-label="Search customers, jobs, or addresses" aria-autocomplete="list" aria-expanded={active&&expanded&&Boolean(query.trim())} aria-controls={id+'-results'} aria-activedescendant={active&&expanded&&selected>=0?id+'-'+selected:undefined} onFocus={()=>setExpanded(true)} onChange={event=>{onQuery(event.target.value);setRows([]);setLoading(Boolean(event.target.value.trim()));setExpanded(true);setSelected(-1);}} onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setExpanded(false);setSelected(-1);}
      else if(event.key==='ArrowDown'&&rows.length){event.preventDefault();setExpanded(true);setSelected(value=>(value+1)%rows.length);}
      else if(event.key==='ArrowUp'&&rows.length){event.preventDefault();setSelected(value=>value<0?rows.length-1:(value-1+rows.length)%rows.length);}
      else if(event.key==='Enter'){event.preventDefault();if(expanded&&selected>=0&&rows[selected])choose(rows[selected]);}
    }}/>{query&&<button type="button" aria-label="Clear global search" onClick={()=>{onQuery('');input.current?.focus();}}><X aria-hidden="true"/></button>}</label>
    {active&&expanded&&query.trim()&&<section className="global-search-panel" aria-label="FIRE search results" style={{maxHeight:height}}>
      <div className="global-search-filters" role="group" aria-label="Search record types">{filters.map(([key,title])=><button type="button" key={key} aria-pressed={scope===key} onClick={()=>{if(scope===key)return;setScope(key);setRows([]);setLoading(true);setSelected(-1);}}>{title}</button>)}</div>
      {loading?<p role="status">Searching FIRE records…</p>:error?<div><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Retry search</button></div>:<>
        <div role="listbox" id={id+'-results'} aria-label="Matching FIRE records">{rows.map((row,index)=>{const Icon=icons[row.kind];return <button type="button" role="option" tabIndex={-1} aria-selected={selected===index} id={id+'-'+index} key={row.kind+':'+row.id} onClick={()=>choose(row)}><Icon aria-hidden="true"/><span><small>{names[row.kind]}{row.kind==='estimate'||row.kind==='job'?' #'+row.id.slice(0,6).toUpperCase():''}{row.status?' · '+row.status.replaceAll('_',' '):''}</small><strong>{row.title}</strong><span>{[row.customer,row.service,row.phone,row.email].filter(Boolean).join(' · ')}</span>{row.excerpt&&<span>{row.excerpt}</span>}{row.amountCents!==undefined&&<span>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(row.amountCents/100)}</span>}{row.createdAt&&<span>Recorded · {new Date(row.createdAt).toLocaleString('en-US',{timeZone:'America/Chicago'})}</span>}{row.address&&<span>{row.address}</span>}{row.scheduledAt&&<span>Service · {new Date(row.scheduledAt).toLocaleString('en-US',{timeZone:'America/Chicago'})}</span>}</span></button>;})}</div>
        {!rows.length&&<p role="status">No matching FIRE records in this filter.</p>}{more&&<p role="status">More matches available. Choose a filter or keep typing.</p>}
      </>}
      <p className="global-search-coverage">Searches customers, estimates, invoices, jobs, contact details, addresses, quoted services, payment references and customer notes. Property results require enabled property management. Offline search and photo/document metadata are not available here yet.</p>
    </section>}
  </div>;
}
