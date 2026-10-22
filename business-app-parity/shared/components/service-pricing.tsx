'use client';
import {useEffect,useRef,useState} from 'react';
import {FIRE_SERVICES} from '../lib/fire-services';
import {priceCents,validServiceRates,type ServiceRate} from '../lib/service-pricing';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
export function useServicePricing(active:boolean){
 const [rates,setRates]=useState<ServiceRate[]|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const generation=useRef(0);
 const load=async()=>{const request=++generation.current;setLoading(true);setError('');try{const response=await fetch('/api/service-pricing',{cache:'no-store'});const data=await response.json() as {rates?:unknown};if(!response.ok||!validServiceRates(data.rates))throw Error('Standard prices could not be verified. Your draft prices are retained.');if(request===generation.current)setRates(data.rates);}catch(e){if(request===generation.current){setError('Standard prices could not be verified. Your draft prices are retained. Retry when connected.');}}finally{if(request===generation.current)setLoading(false);}};
 useEffect(()=>{if(active)void load();return()=>{generation.current++;};},[active]);
 return{rates,error,loading,reload:load,acceptRate:(rate:ServiceRate)=>setRates(current=>current?.map(r=>r.id===rate.id?rate:r)??null),services:rates?FIRE_SERVICES.map(s=>({...s,rate:rates.find(r=>r.id===s.id)!.rateCents})):FIRE_SERVICES};
}
export function PricingSettings(){
 const pricing=useServicePricing(true);const [query,setQuery]=useState('');
 return <section className="pricing-settings" aria-label="Standard service prices"><h2>Standard starting prices</h2><p>Defaults for new service selections only. Saved estimates, invoices, signed agreements and payments stay unchanged. Use an estimate&apos;s pricing controls for a one-time customer price.</p><Label htmlFor="pricing-search">Find a service</Label><Input id="pricing-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all 30 services"/>{pricing.loading&&<p role="status">Loading standard prices…</p>}{pricing.error&&<p role="alert">{pricing.error}</p>}<Button variant="outline" disabled={pricing.loading} onClick={()=>void pricing.reload()}>Refresh standard prices</Button>{pricing.rates&&<div className="pricing-grid">{pricing.services.filter(s=>s.name.toLowerCase().includes(query.trim().toLowerCase())).map(service=><StandardRate key={service.id} service={service} saved={pricing.rates!.find(r=>r.id===service.id)!} blocked={pricing.loading||Boolean(pricing.error)} onSaved={pricing.acceptRate}/>)}</div>}</section>;
}
function StandardRate({service,saved,blocked,onSaved}:{service:typeof FIRE_SERVICES[number];saved:ServiceRate;blocked:boolean;onSaved:(rate:ServiceRate)=>void}){
 const [current,setCurrent]=useState(saved),[value,setValue]=useState((saved.rateCents/100).toFixed(2)),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);const lock=useRef(false);
 useEffect(()=>{if(saved.revision!==current.revision||saved.rateCents!==current.rateCents||uncertain){setCurrent(saved);setUncertain(false);setMessage('');}},[saved]);
 const amount=priceCents(value);
 const save=async()=>{if(lock.current||amount===null||uncertain||blocked)return;lock.current=true;setBusy(true);setMessage('');try{const response=await fetch('/api/service-pricing',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({id:service.id,rateCents:amount,expectedRevision:current.revision})});const data=await response.json() as {rate:ServiceRate;error?:string};if(!response.ok||!validServiceRates(FIRE_SERVICES.map(s=>s.id===service.id?data.rate:{id:s.id,rateCents:s.rate,revision:null}))||data.rate.id!==service.id||data.rate.rateCents!==amount)throw Error(data.error||'Save receipt did not match.');setCurrent(data.rate);onSaved(data.rate);setMessage('Standard price saved for future estimates.');}catch(e){setUncertain(true);setMessage((e instanceof SyntaxError||e instanceof TypeError?'Save could not be confirmed.':e instanceof Error?e.message:'Save unconfirmed.')+' Your entry is retained. Refresh standard prices before another save.');}finally{lock.current=false;setBusy(false);}};
 return <article><Label htmlFor={'standard-'+service.id}>{service.name}</Label><small>Per {service.unit} · currently ${(current.rateCents/100).toFixed(2)}</small><div><span aria-hidden="true">$</span><Input id={'standard-'+service.id} inputMode="decimal" value={value} disabled={busy} aria-invalid={amount===null} onChange={e=>{setValue(e.target.value);setMessage('');}}/><Button className="min-h-11" disabled={busy||blocked||uncertain||amount===null||amount===current.rateCents} onClick={()=>void save()}>{busy?'Saving…':'Save standard'}</Button></div>{message&&<p role={uncertain?'alert':'status'}>{message}</p>}</article>;
}
