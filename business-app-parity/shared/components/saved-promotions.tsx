'use client';
import {useEffect,useRef,useState} from 'react';
import {FIRE_SERVICES} from '../lib/fire-services';
import {fireDate,validPromotions,validSavedPromotionCatalog,type SavedPromotion,type SavedPromotionCatalog} from '../lib/saved-promotions';
import {priceCents} from '../lib/service-pricing';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';

const newRule=():SavedPromotion=>({id:crypto.randomUUID(),name:'',type:'percent',valueCents:1500,
 enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:[]});
const dollar=(value:number)=>'$'+(value/100).toFixed(2);
const amountLabel=(p:SavedPromotion)=>p.type==='percent'?(p.valueCents/100).toFixed(2).replace(/\.00$/,'')+'%':dollar(p.valueCents);
const dateLabel=(p:SavedPromotion)=>p.startOn&&p.endOn?p.startOn+' to '+p.endOn:p.endOn?'Through '+p.endOn:p.startOn?'From '+p.startOn:'No end date';

export function SavedPromotionsSettings(){
 const [catalog,setCatalog]=useState<SavedPromotionCatalog|null>(null);
 const [rules,setRules]=useState<SavedPromotion[]>([]);
 const [editing,setEditing]=useState<SavedPromotion|null>(null);
 const [amountText,setAmountText]=useState('');
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [uncertain,setUncertain]=useState(false);
 const generation=useRef(0),saveLock=useRef(false);
 const load=async(discard=false)=>{
  if(discard&&catalog&&JSON.stringify(rules)!==JSON.stringify(catalog.promotions)&&
   !window.confirm('Discard unsaved promotion changes and load the saved catalog?'))return;
  const current=++generation.current;setLoading(true);setError('');setMessage('');
  try{const response=await fetch('/api/saved-promotions',{cache:'no-store'});
   const body=await response.json() as {catalog?:unknown;error?:string};
   if(!response.ok||!validSavedPromotionCatalog(body.catalog))throw Error(body.error||'Saved promotions could not be verified.');
   if(current!==generation.current)return;
   setCatalog(body.catalog);setRules(body.catalog.promotions);setEditing(null);setUncertain(false);
  }catch{if(current===generation.current)setError('Saved promotions could not be verified. No automatic promotions may be selected until the catalog is refreshed.');}
  finally{if(current===generation.current)setLoading(false);}
 };
 useEffect(()=>{void load();return()=>{generation.current++;};},[]);
 const startEdit=(rule:SavedPromotion)=>{setEditing({...rule,requiredServiceIds:[...rule.requiredServiceIds]});setAmountText((rule.valueCents/100).toFixed(2));setError('');};
 const patch=(value:Partial<SavedPromotion>)=>setEditing(current=>current?{...current,...value}:null);
 const inputCents=priceCents(amountText);
 const edited=editing?{...editing,valueCents:inputCents??0}:null;
 const editorValid=edited!==null&&validPromotions([edited]);
 const keepEdit=()=>{
  if(!edited||!editorValid){setError('Enter a name, positive discount and valid date range.');return;}
  setRules(current=>current.some(p=>p.id===edited.id)?current.map(p=>p.id===edited.id?edited:p):[...current,edited]);
  setEditing(null);setMessage('Promotion staged. Save changes to make it available across devices.');setError('');
 };
 const remove=(id:string)=>{
  if(!window.confirm('Remove this saved promotion? Previously agreed estimates will stay unchanged.'))return;
  setRules(current=>current.filter(p=>p.id!==id));setMessage('Promotion removal staged. Save changes to confirm.');
 };
 const save=async()=>{
  if(saveLock.current||!catalog||editing||!validPromotions(rules)||uncertain)return;
  const requested=rules;
  saveLock.current=true;setSaving(true);setError('');setMessage('');
  try{const response=await fetch('/api/saved-promotions',{method:'PUT',headers:{'content-type':'application/json'},
   body:JSON.stringify({promotions:requested,expectedRevision:catalog.revision})});
   const body=await response.json() as {catalog?:unknown;error?:string};
   if(!response.ok||!validSavedPromotionCatalog(body.catalog)||JSON.stringify(body.catalog.promotions)!==JSON.stringify(requested))
    throw Error(body.error||'The saved promotion receipt was not verified.');
   setCatalog(body.catalog);setRules(body.catalog.promotions);setMessage('Saved promotion rules are verified for future estimates.');
  }catch(e){setUncertain(true);setError((e instanceof Error?e.message:'The save was not confirmed.')+' Your entries remain here. Refresh and verify before another save.');}
  finally{saveLock.current=false;setSaving(false);}
 };
 const today=fireDate(new Date());
 const dirty=!!catalog&&JSON.stringify(rules)!==JSON.stringify(catalog.promotions);
 return <section className="mt-6 space-y-4" aria-label="Saved promotions">
  <h2 className="text-lg font-semibold">Saved promotions</h2>
  <p className="service-description-help">Create reusable discounts, select which services qualify and choose an estimate-date or confirmed-booking window. Overlapping promotions may stack. Existing customer agreements are never automatically repriced.</p>
  {loading&&<p role="status">Reading saved promotions…</p>}
  {error&&<p role="alert" className="save-error">{error}</p>}
  {message&&<p role="status">{message}</p>}
  <div className="flex flex-wrap gap-2">
   <Button variant="outline" className="min-h-11" onClick={()=>void load(true)} disabled={loading||saving}>Refresh saved promotions</Button>
   {catalog&&!editing&&<Button className="min-h-11" onClick={()=>startEdit(newRule())} disabled={loading||saving||rules.length>=40}>Add promotion</Button>}
   {dirty&&!editing&&<Button className="min-h-11" onClick={()=>void save()} disabled={saving||loading||uncertain||!validPromotions(rules)}>{saving?'Saving…':'Save promotion changes'}</Button>}
  </div>
  {catalog&&!editing&&<div className="space-y-3">{rules.length===0&&<p className="service-description-help">No saved promotions yet. Nothing will be automatically discounted until you add and save a rule.</p>}
   {rules.map(rule=>{
    const ended=Boolean(rule.endOn&&today>rule.endOn),future=Boolean(rule.startOn&&today<rule.startOn);
    const state=!rule.enabled?'Paused':ended?'Expired':future?'Upcoming':rule.dateBasis==='booking-confirmed'?'Booking required':'Current';
    return <article key={rule.id} className="rounded-xl border p-3 space-y-2">
     <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><strong className="block">{rule.name}</strong><small className="block">{amountLabel(rule)} • {dateLabel(rule)} • {state}</small><small className="block">{rule.requiredServiceIds.length?rule.requiredServiceIds.map(id=>FIRE_SERVICES.find(s=>s.id===id)?.name).join(' + '):'All services'} • {rule.dateBasis==='booking-confirmed'?'Booking date required':'Estimate created date'} • {rule.autoApply?'Auto apply when qualified':'Manual only'}</small></div>
     </div>
     <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="min-h-11" onClick={()=>startEdit(rule)}>Edit</Button>
      <Button variant="outline" className="min-h-11" onClick={()=>setRules(current=>current.map(r=>r.id===rule.id?{...r,enabled:!r.enabled}:r))}>{rule.enabled?'Pause':'Enable'}</Button>
      <Button variant="outline" className="min-h-11" disabled={rules.length>=40} onClick={()=>startEdit({...rule,id:crypto.randomUUID(),name:rule.name+' copy',enabled:false})}>Duplicate</Button>
      <Button variant="outline" className="min-h-11" onClick={()=>remove(rule.id)}>Delete</Button>
     </div>
    </article>;
   })}
  </div>}
  {editing&&<section className="space-y-3 rounded-xl border p-3" aria-label="Promotion editor">
   <h3 className="font-semibold">Edit saved promotion</h3>
   <Label htmlFor="fire-promo-name">Promotion name</Label><Input id="fire-promo-name" maxLength={80} value={editing.name} onChange={event=>patch({name:event.target.value})} placeholder="October 15% special"/>
   <Label htmlFor="fire-promo-type">Discount method</Label>
   <select id="fire-promo-type" className="min-h-11 w-full rounded-md border bg-background px-3" value={editing.type} onChange={e=>{patch({type:e.target.value as SavedPromotion['type']});setAmountText('');}}>
    <option value="percent">Percentage off</option><option value="dollar">Flat dollars off</option>
   </select>
   <Label htmlFor="fire-promo-amount">{editing.type==='percent'?'Percentage (up to 50%)':'Dollar amount'}</Label>
   <Input id="fire-promo-amount" inputMode="decimal" value={amountText} aria-invalid={inputCents===null||!editorValid} onChange={event=>setAmountText(event.target.value)} placeholder={editing.type==='percent'?'15.00':'25.00'}/>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div><Label htmlFor="fire-promo-start">Start date (optional)</Label><Input id="fire-promo-start" type="date" value={editing.startOn??''} onChange={e=>patch({startOn:e.target.value||null})}/></div>
    <div><Label htmlFor="fire-promo-end">End date (optional)</Label><Input id="fire-promo-end" type="date" value={editing.endOn??''} onChange={e=>patch({endOn:e.target.value||null})}/></div>
   </div>
   <Label htmlFor="fire-promo-date-basis">Which date qualifies?</Label>
   <select id="fire-promo-date-basis" className="min-h-11 w-full rounded-md border bg-background px-3" value={editing.dateBasis} onChange={e=>patch({dateBasis:e.target.value as SavedPromotion['dateBasis']})}>
    <option value="estimate-created">Date estimate is created</option><option value="booking-confirmed">Date booking is confirmed</option>
   </select>
   {editing.dateBasis==='booking-confirmed'&&<p className="service-description-help">This offer is pending until booking is confirmed within the date range. Creating an estimate alone does not satisfy the deadline.</p>}
   <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={editing.enabled} onChange={e=>patch({enabled:e.target.checked})}/> Promotion enabled</label>
   <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={editing.autoApply} onChange={e=>patch({autoApply:e.target.checked})}/> Automatically include when eligible</label>
   <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium">Required services ({editing.requiredServiceIds.length}; none means all estimates)</summary>
    <p className="service-description-help">If you select multiple services, ALL must be on the estimate. For the $25 house-and-gutters bundle, choose House Wash and Gutter Cleaning.</p>
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
     {FIRE_SERVICES.map(service=><label key={service.id} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={editing.requiredServiceIds.includes(service.id)} onChange={e=>patch({requiredServiceIds:e.target.checked?[...editing.requiredServiceIds,service.id]:editing.requiredServiceIds.filter(id=>id!==service.id)})}/><span className="text-sm">{service.name}</span></label>)}
    </div>
   </details>
   {!editorValid&&<p role="alert">Complete the promotion name, amount and valid start/end dates.</p>}
   <div className="flex flex-wrap gap-2">
    <Button className="min-h-11" disabled={!editorValid} onClick={keepEdit}>Keep promotion in draft</Button>
    <Button className="min-h-11" variant="outline" onClick={()=>setEditing(null)}>Cancel edit</Button>
   </div>
  </section>}
  <p className="service-description-help">An active rule is not permission to alter a saved, sent, signed or paid record. Saved rules are only candidates for new estimate calculations and must be integrated into the confirmed estimate discount workflow before automatic application goes live.</p>
 </section>;
}
