'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './ui/button';
export function OfflineFieldSetup(){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const prepare=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setMessage('Preparing offline field mode…');try{
  if(!('serviceWorker' in navigator)||!isSecureContext)throw Error('Offline field mode requires a supported browser and HTTPS.');
  const registration=await navigator.serviceWorker.register('/fire-offline-worker.js',{scope:'/'});
  const worker=registration.installing??registration.waiting;
  if(worker)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preparation timed out. Reconnect and try again.')),30000);const state=()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}if(worker.state==='redundant'){clearTimeout(timer);reject(Error('Offline files could not be saved.'));}};worker.addEventListener('statechange',state);state();});
  if(!registration.active)throw Error('Offline files are not yet active.');
  if(alive.current)setMessage('Offline field mode ready. Enable and unlock Offline pins before leaving service.');
 }catch(e){if(alive.current)setMessage(e instanceof Error?e.message:'Offline preparation failed.');}finally{lock.current=false;if(alive.current)setBusy(false);}};
 return <details className="ui-help"><summary>Offline field mode</summary><p>Opens saved pins after an offline restart. Your recovery phrase unlocks private pins. Quotes, payments and customer records still need the connected app.</p><Button variant="outline" disabled={busy} onClick={()=>void prepare()}>{busy?'Preparing…':'Prepare offline field mode'}</Button><a className="block min-h-11 py-3" href="/fire-offline/">Open field workspace</a>{message&&<p role="status">{message}</p>}</details>;
}
