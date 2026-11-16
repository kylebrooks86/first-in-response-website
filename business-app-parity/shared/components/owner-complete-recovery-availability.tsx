"use client";

/** Default hidden: enable source-only complete record encryption and local
 * photo pairing UI ONLY after a fresh, authenticated owner capability GET.
 * Actual record export re-checks owner and the separately approved flag.
 * This does not create a backup, deploy an app or complete Gate7.
 */
import {useEffect,useState} from 'react';
import {CompleteD1RecordsReview} from './complete-d1-records-review';
import {ProtectedPairOwnerReview} from './protected-pair-owner-review';

export function OwnerCompleteRecoveryAvailability(){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  const check=async()=>{
   try{
    const result=await fetch('/api/backup/review-capability',{
     method:'GET',credentials:'same-origin',redirect:'error',
     cache:'no-store',headers:{accept:'application/json'},
     signal:controller.signal
    });
    if(!result.ok||result.status!==200||result.redirected||
       !/(?:^|,)\s*private\b/i.test(result.headers.get('cache-control')||'')||
       !/(?:^|,)\s*no-store\b/i.test(result.headers.get('cache-control')||''))
      return;
    const payload=await result.json();
    if(!controller.signal.aborted&&payload&&
       Object.keys(payload).length===5&&
       payload.format==='fire-complete-records-owner-review-capability'&&
       payload.version===1&&payload.reviewEnabled===true&&
       payload.completeBackup===false&&payload.gate7Accepted===false)
      setAllowed(true);
   }catch{/* Missing/expired auth, feature off, provider errors: hidden. */}
  };
  void check();
  return()=>{controller.abort();};
 },[]);
 if(!allowed)return null;
 return <><CompleteD1RecordsReview reviewEnabled={allowed}/><ProtectedPairOwnerReview reviewEnabled={allowed}/></>;
}
