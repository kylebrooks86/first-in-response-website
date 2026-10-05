"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, MessageSquareText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AcceptEstimateButton({token,accepted,signedName,photoRelease:existingPhotoRelease,terms}:{token:string;accepted:boolean;signedName?:string|null;photoRelease?:string|null;terms:string}){
  const router=useRouter();
  const [done,setDone]=useState(accepted);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [name,setName]=useState(signedName||"");
  const [photoRelease,setPhotoRelease]=useState(existingPhotoRelease||"");
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [showChanges,setShowChanges]=useState(false);
  const [changeMessage,setChangeMessage]=useState("");
  const [changeSent,setChangeSent]=useState(false);
  const accept=async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch(`/api/public/estimates/${token}/accept`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({signedName:name,photoRelease,acceptedTerms:termsAccepted})});
      const result=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||!result.ok)throw new Error(result.error||"The estimate could not be approved.");
      setDone(true);
      router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"The estimate could not be approved.");}
    finally{setLoading(false);}
  };
  const requestChanges=async()=>{setLoading(true);setError("");try{const response=await fetch(`/api/public/estimates/${token}/change-request`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:changeMessage})});const result=await response.json() as {ok?:boolean;error?:string};if(!response.ok||!result.ok)throw new Error(result.error||"The request could not be sent.");setChangeSent(true);}catch(reason){setError(reason instanceof Error?reason.message:"The request could not be sent.");}finally{setLoading(false);}};
  if(done)return <div className="portal-approved"><Check/>Estimate approved and agreement signed{signedName?` by ${signedName}`:""}. Kyle will contact you to schedule.</div>;
  return <div className="signature-panel">
    <div className="contract-box"><strong>Service Agreement &amp; Liability Waiver</strong><p>{terms}</p></div>
    <fieldset className="photo-release"><legend>Photo permission (required)</legend><label><input type="radio" name="photoRelease" value="yes" checked={photoRelease==="yes"} onChange={(event)=>setPhotoRelease(event.target.value)}/><span><strong>Yes</strong> — I authorize before-and-after property photos for marketing purposes.</span></label><label><input type="radio" name="photoRelease" value="no" checked={photoRelease==="no"} onChange={(event)=>setPhotoRelease(event.target.value)}/><span><strong>No</strong> — I do not authorize use of property photos for marketing.</span></label></fieldset>
    <label htmlFor="signatureName">Type your full name to sign</label><div className="signature-input"><PenLine/><Input id="signatureName" value={name} onChange={(event)=>setName(event.target.value)} placeholder="Full legal name"/></div>
    <label className="terms-check"><input type="checkbox" checked={termsAccepted} onChange={(event)=>setTermsAccepted(event.target.checked)}/><span>I have read, understand, and accept the estimate, scope, price, Service Agreement &amp; Liability Waiver, payment terms, and selected photo permission above.</span></label>
    <Button className="brand-button h-12 w-full text-base" onClick={()=>void accept()} disabled={loading||name.trim().length<2||!photoRelease||!termsAccepted}>{loading?<LoaderCircle className="animate-spin"/>:<Check/>}{loading?"Approving…":"Sign agreement & approve"}</Button>
    <button className="change-request-toggle" onClick={()=>setShowChanges((value)=>!value)}><MessageSquareText/>Need something changed?</button>
    {showChanges&&(changeSent?<div className="change-sent"><Check/>Your request was sent to Kyle.</div>:<div className="change-request"><Textarea value={changeMessage} onChange={(event)=>setChangeMessage(event.target.value)} placeholder="Tell Kyle what you would like changed…" rows={4}/><Button variant="outline" onClick={()=>void requestChanges()} disabled={loading||changeMessage.trim().length<5}>Send change request</Button></div>)}
    {error&&<p className="mt-3 text-center text-sm text-red-600">{error}</p>}
  </div>;
}
