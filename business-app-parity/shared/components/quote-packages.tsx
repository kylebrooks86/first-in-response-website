'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {STARTER_QUOTE_PACKAGES,packageDraftLines,validQuotePackageCatalog,type QuotePackage,type QuotePackageCatalog,type QuotePackageDraftLine} from '../lib/quote-packages';
import type {FireService} from '../lib/fire-services';

/** Explicitly selected presets; never use a past customer's totals or terms. */
export function QuotePackages({active,services,ready,currentServiceIds,disabled,onApply}:{
 active:boolean;services:FireService[];ready:boolean;currentServiceIds:string[];disabled:boolean;
 onApply:(lines:QuotePackageDraftLine[],name:string)=>void;
}){
 const [catalog,setCatalog]=useState<QuotePackageCatalog|null>(null);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[newName,setNewName]=useState('');
 const lock=useRef(false),generation=useRef(0);
 const refresh=async()=>{
  if(lock.current)return;
  const seq=++generation.current;setLoading(true);setCatalog(null);setError('');setNotice('');
  try{
   const r=await fetch('/api/quote-packages',{cache:'no-store'}),v=await r.json() as {catalog?:unknown;error?:string};
   if(!r.ok||!validQuotePackageCatalog(v.catalog))throw Error(v.error||'Saved packages could not be verified.');
   if(seq===generation.current)setCatalog(v.catalog);
  }catch(e){if(seq===generation.current)setError(e instanceof Error?e.message:'Packages unavailable.');}
  finally{if(seq===generation.current)setLoading(false);}
 };
 useEffect(()=>{if(active)void refresh();return()=>{generation.current++;};},[active]);
 const usePackage=(ids:readonly string[],name:string)=>{
  if(!ready||disabled||saving)return;
  const lines=packageDraftLines(ids,services);
  if(!lines){setError('The current service catalog is missing a rate or service. Refresh standard pricing before using this package.');return;}
  setError('');setNotice('');
  onApply(lines,name);
 };
 const persist=async(next:QuotePackage[],successMessage:string)=>{
  if(!catalog||lock.current||disabled)return;
  lock.current=true;setSaving(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/quote-packages',{method:'PUT',headers:{'content-type':'application/json'},
     body:JSON.stringify({expectedRevision:catalog.revision,packages:next})});
   const v=await r.json() as {catalog?:unknown;error?:string};
   if(!r.ok||!validQuotePackageCatalog(v.catalog)||JSON.stringify(v.catalog.packages)!==JSON.stringify(next))
    throw Error(v.error||'The package save was not confirmed. Refresh before attempting it again.');
   setCatalog(v.catalog);setNotice(successMessage);
   return true;
  }catch(e){setError((e instanceof Error?e.message:'Package save unavailable.')+' Refresh stored packages before another save.');setCatalog(null);return false;}
  finally{lock.current=false;setSaving(false);}
 };
 const saveMix=async()=>{
  if(!catalog||!ready||disabled||saving)return;
  const name=newName.trim(),ids=[...new Set(currentServiceIds.filter(id=>services.some(s=>s.id===id)))];
  if(name.length<2||name.length>60||ids.length<1||ids.length>12||ids.length!==currentServiceIds.length){
   setError('Enter a 2–60 character package name and select 1–12 distinct known services first.');return;
  }
  if(catalog.packages.some(p=>p.name.toLowerCase()===name.toLowerCase())){setError('This package name already exists. Choose a different name.');return;}
  const created={id:crypto.randomUUID(),name,serviceIds:ids};
  if(await persist([...catalog.packages,created],'Service package saved for future estimates. No customer, quantity, price or discount was stored.'))setNewName('');
 };
 const remove=async(pkg:QuotePackage)=>{
  if(!catalog||disabled||saving||!window.confirm('Remove '+pkg.name+' from reusable quote packages? Existing estimates will not change.'))return;
  await persist(catalog.packages.filter(p=>p.id!==pkg.id),'Reusable package removed. Existing customer estimates remain unchanged.');
 };
 return <section className="rounded-xl border bg-card p-4 space-y-3" aria-label="Reusable quote packages">
  <div><h3 className="font-bold">Quick multi-service packages</h3><p className="text-xs text-muted-foreground">Start with a service mix, then enter new quantities and review current rates. No customer details, previous prices or discounts are reused.</p></div>
  <div className="flex flex-wrap gap-2" aria-label="Suggested service packages">
   {STARTER_QUOTE_PACKAGES.map(pkg=><Button key={pkg.name} type="button" variant="outline" className="min-h-11" disabled={!ready||disabled||saving} onClick={()=>usePackage(pkg.serviceIds,pkg.name)}>{pkg.name}</Button>)}
  </div>
  <div className="border-t pt-3 space-y-2">
   <div className="flex items-center justify-between gap-2"><strong className="text-sm">My saved service mixes</strong><Button type="button" size="sm" variant="outline" disabled={loading||saving||disabled} onClick={()=>void refresh()}>{loading?'Loading…':'Refresh packages'}</Button></div>
   {loading&&<p role="status">Checking saved service packages…</p>}
   {!loading&&catalog&&catalog.packages.length===0&&<p className="text-sm text-muted-foreground">No custom packages saved yet. Choose services below, name the mix and save it once.</p>}
   {catalog?.packages.map(pkg=><div key={pkg.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"><div><strong className="text-sm">{pkg.name}</strong><p className="text-xs text-muted-foreground">{pkg.serviceIds.map(id=>services.find(s=>s.id===id)?.name||id).join(' + ')}</p></div><div className="flex gap-2">
     <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={!ready||disabled||saving||loading} onClick={()=>usePackage(pkg.serviceIds,pkg.name)} aria-label={'Use saved package '+pkg.name}>Use</Button>
     <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={disabled||saving||loading} onClick={()=>void remove(pkg)} aria-label={'Delete saved package '+pkg.name}>Delete</Button>
    </div></div>)}
   {catalog&&<div className="grid gap-2"><Label htmlFor="new-estimate-package-name">Save current selected services as a package</Label><div className="flex flex-wrap gap-2"><Input id="new-estimate-package-name" maxLength={60} className="min-w-40 flex-1" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g., House + gutters + driveway" disabled={saving||disabled}/><Button type="button" variant="secondary" className="min-h-11" disabled={saving||disabled||!ready} onClick={()=>void saveMix()}>Save this mix</Button></div><p className="text-xs text-muted-foreground">Only the service types are saved. Customer names, addresses, measurements, custom pricing and promotions are never included.</p></div>}
  </div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
