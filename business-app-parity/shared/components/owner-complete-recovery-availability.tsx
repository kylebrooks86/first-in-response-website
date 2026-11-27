"use client";

/** Default hidden: enable source-only complete record encryption and local
 * photo pairing UI ONLY after a fresh, authenticated owner capability GET.
 * Actual record export re-checks owner and the separately approved flag.
 * No provider action or deployment occurs here.
 *
 * In an already-open browser tab, the authorized session can expire or be
 * revoked after the first mount. Refresh the read-only owner capability when
 * the tab becomes active; a denied/failed read MUST hide and unmount the
 * sensitive local review controls, clearing prepared encrypted-file refs.
 * During a native Files selection, retain the mounted component until the
 * refreshed GET resolves so the file input can complete its onChange event.
 */
import {useEffect,useState} from 'react';
import {CompleteD1RecordsReview} from './complete-d1-records-review';
import {ProtectedPairOwnerReview} from './protected-pair-owner-review';

export function OwnerCompleteRecoveryAvailability(){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{
  let disposed=false,latestCheck=0;
  let controller=new AbortController();
  const check=async()=>{
   // A newer visibility/focus event invalidates the earlier request. Do not
   // allow a delayed owner-OK response to re-enable a now-revoked session.
   controller.abort();
   controller=new AbortController();
   const requestId=++latestCheck,signal=controller.signal;
   let approved=false;
   try{
    const result=await fetch('/api/backup/review-capability',{
     method:'GET',credentials:'same-origin',redirect:'error',
     cache:'no-store',headers:{accept:'application/json'},signal
    });
    const cache=result.headers.get('cache-control')||'';
    if(result.ok&&result.status===200&&!result.redirected&&
       /(?:^|,)\s*private\b/i.test(cache)&&
       /(?:^|,)\s*no-store\b/i.test(cache)){
     const raw:unknown=await result.json();
     if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
      const payload=raw as Record<string,unknown>;
      approved=Object.keys(payload).length===5&&
       payload.format==='fire-complete-records-owner-review-capability'&&
       payload.version===1&&payload.reviewEnabled===true&&
       payload.completeBackup===false&&payload.gate7Accepted===false;
     }
    }
   }catch{/* Missing/expired auth, no network or provider errors: hidden. */}
   finally{
    if(!disposed&&requestId===latestCheck&&!signal.aborted)
     setAllowed(approved);
   }
  };
  const onFocus=()=>{void check();};
  const onVisible=()=>{if(document.visibilityState==='visible')void check();};
  void check();
  window.addEventListener('focus',onFocus);
  window.addEventListener('pageshow',onFocus);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   disposed=true;latestCheck++;controller.abort();
   window.removeEventListener('focus',onFocus);
   window.removeEventListener('pageshow',onFocus);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[]);
 if(!allowed)return null;
 return <><CompleteD1RecordsReview reviewEnabled={allowed}/><ProtectedPairOwnerReview reviewEnabled={allowed}/></>;
}
