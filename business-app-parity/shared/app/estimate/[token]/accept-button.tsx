"use client";

import { useRef, useState } from "react";
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
  const [changeUncertain,setChangeUncertain]=useState(false);
  const [approvalUncertain,setApprovalUncertain]=useState(false);
  const approvalAttempt=useRef<{signedName:string;photoRelease:string;acceptedTerms:boolean}|null>(null);
  const mutationLock=useRef(false);
  const changeAttempt=useRef<{requestId:string;message:string}|null>(null);
  const accept=async()=>{
    if(mutationLock.current||changeUncertain)return;
    const attempt=approvalAttempt.current??{signedName:name.trim(),photoRelease,acceptedTerms:termsAccepted};
    approvalAttempt.current=attempt;mutationLock.current=true;setLoading(true);setError("");
    try{
      const response=await fetch(`/api/public/estimates/${token}/accept`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(attempt)});
      const result=await response.json() as {ok?:boolean;acceptedAt?:string;signedName?:string;signedAt?:string;photoRelease?:string;error?:string};
      if(!response.ok){if([400,404,409].includes(response.status)){approvalAttempt.current=null;setApprovalUncertain(false);}throw Error(result.error||"The approval was not confirmed.");}
      if(!result.ok||typeof result.signedName!=="string"||result.signedName.trim().length<2||!["yes","no"].includes(result.photoRelease??"")||!Number.isFinite(Date.parse(result.acceptedAt??""))||!Number.isFinite(Date.parse(result.signedAt??"")))throw Error("The saved approval receipt could not be verified.");
      setName(result.signedName);setPhotoRelease(result.photoRelease!);setApprovalUncertain(false);approvalAttempt.current=null;setDone(true);
      router.refresh();
    }catch(reason){if(approvalAttempt.current)setApprovalUncertain(true);setError((reason instanceof Error?reason.message:"The approval was not confirmed.")+(approvalAttempt.current?" It may already be saved. Retry this same approval to verify it; no automatic retry was made.":""));}
    finally{mutationLock.current=false;setLoading(false);}
  };
  const requestChanges=async()=>{
    if(mutationLock.current||approvalUncertain)return;
    const attempt=changeAttempt.current??{requestId:crypto.randomUUID(),message:changeMessage.trim()};
    if(attempt.message.length<5||attempt.message.length>4000){setError("Describe the requested change using 5 to 4,000 characters.");return;}
    changeAttempt.current=attempt;mutationLock.current=true;setLoading(true);setError("");
    try{
      const response=await fetch(`/api/public/estimates/${token}/change-request`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(attempt)});
      const result=await response.json() as {ok?:boolean;request?:{id?:string;message?:string;createdAt?:string};error?:string};
      if(!response.ok){
        if([400,404,409].includes(response.status)){changeAttempt.current=null;setChangeUncertain(false);}
        else setChangeUncertain(true);
        throw Error(result.error||"The change request was not confirmed.");
      }
      if(!result.ok||!result.request?.id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.request.id)||result.request.message!==attempt.message||!Number.isFinite(Date.parse(result.request.createdAt??"")))throw Error("The saved change request receipt could not be verified.");
      setChangeUncertain(false);changeAttempt.current=null;setChangeSent(true);
    }catch(reason){
      if(changeAttempt.current)setChangeUncertain(true);
      setError((reason instanceof Error?reason.message:"The change request was not confirmed.")+(changeAttempt.current?" Retry this same request; no automatic retry was made.":""));
    }finally{mutationLock.current=false;setLoading(false);}
  };
  if(done)return <div className="portal-approved"><Check/>Estimate approved and agreement signed. First In Response Exteriors will contact you to schedule.</div>;
  return <div className="signature-panel">
    <div className="contract-box"><strong>Service Agreement &amp; Liability Waiver</strong><p>{terms}</p></div>
    <fieldset className="photo-release" disabled={loading||approvalUncertain||changeUncertain}><legend>Photo permission (required)</legend><label><input type="radio" name="photoRelease" value="yes" checked={photoRelease==="yes"} onChange={(event)=>setPhotoRelease(event.target.value)}/><span><strong>Yes</strong> — I authorize before-and-after property photos for marketing purposes.</span></label><label><input type="radio" name="photoRelease" value="no" checked={photoRelease==="no"} onChange={(event)=>setPhotoRelease(event.target.value)}/><span><strong>No</strong> — I do not authorize use of property photos for marketing.</span></label></fieldset>
    <label htmlFor="signatureName">Type your full name to sign</label><div className="signature-input"><PenLine/><Input id="signatureName" disabled={loading||approvalUncertain||changeUncertain} value={name} onChange={(event)=>setName(event.target.value)} placeholder="Full legal name"/></div>
    <label className="terms-check"><input type="checkbox" disabled={loading||approvalUncertain||changeUncertain} checked={termsAccepted} onChange={(event)=>setTermsAccepted(event.target.checked)}/><span>I have read, understand, and accept the estimate, scope, price, Service Agreement &amp; Liability Waiver, payment terms, and selected photo permission above.</span></label>
    <Button className="brand-button h-12 w-full text-base" onClick={()=>void accept()} disabled={loading||changeUncertain||name.trim().length<2||!photoRelease||!termsAccepted}>{loading?<LoaderCircle className="animate-spin"/>:<Check/>}{loading?"Approving…":approvalUncertain?"Check / retry same approval":"Sign agreement & approve"}</Button>
    <button className="change-request-toggle" onClick={()=>setShowChanges((value)=>!value)}><MessageSquareText/>Need something changed?</button>
    {showChanges&&(changeSent?<div className="change-sent"><Check/>Your request was sent to First In Response Exteriors.</div>:<div className="change-request"><Textarea aria-label="Requested estimate changes" maxLength={4000} disabled={loading||changeUncertain||approvalUncertain} value={changeMessage} onChange={(event)=>setChangeMessage(event.target.value)} placeholder="Describe what you would like changed…" rows={4}/><Button variant="outline" onClick={()=>void requestChanges()} disabled={loading||approvalUncertain||changeMessage.trim().length<5}>{changeUncertain?"Check / retry same request":"Send change request"}</Button></div>)}
    {changeUncertain&&<p role="status">This request may already be saved. Its text is protected until the same request is confirmed.</p>}
    {error&&<p role="alert" className="mt-3 text-center text-sm text-red-600">{error}</p>}
  </div>;
}
