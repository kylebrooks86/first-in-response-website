"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
type Receipt={ok?:boolean;version?:string;documentDigest?:string;acceptedAt?:string;signedAt?:string;signedName?:string;photoRelease?:string;replayed?:boolean;error?:string;saveUncertain?:boolean};
export function RevisedDepositAcceptButton({token,version,documentDigest}:{token:string;version:string;documentDigest:string}){
 const router=useRouter();
 const [name,setName]=useState(""),[photo,setPhoto]=useState(""),[checked,setChecked]=useState(false);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const [signed,setSigned]=useState<Receipt|null>(null);
 const locked=useRef(false);
 const attempt=useRef<{version:string;documentDigest:string;signedName:string;photoRelease:string;acceptedTerms:boolean}|null>(null);
 async function accept(){
  if(locked.current)return;
  if(!attempt.current&&(!checked||name.trim().length<2||!photo))return;
  const data=attempt.current??{version,documentDigest,signedName:name.trim(),photoRelease:photo,acceptedTerms:true};
  attempt.current=data;locked.current=true;setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/public/estimates/"+encodeURIComponent(token)+"/revised-accept",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)
   });
   const receipt=await response.json() as Receipt;
   if(!response.ok){
    if([400,403,404,409,415].includes(response.status)){attempt.current=null;setUncertain(false);}
    else setUncertain(true);
    setMessage(receipt.error||"The signature could not be confirmed.");return;
   }
   if(!receipt.ok||receipt.version!==version||receipt.documentDigest!==documentDigest||
      receipt.signedName!==data.signedName||receipt.photoRelease!==data.photoRelease||
      !Number.isFinite(Date.parse(receipt.acceptedAt??""))||
      !Number.isFinite(Date.parse(receipt.signedAt??""))){
    setUncertain(true);setMessage("The signed agreement receipt could not be verified. Check this same request; no automatic retry was made.");return;
   }
   attempt.current=null;setUncertain(false);setSigned(receipt);
   router.refresh();
  }catch{
   setUncertain(true);setMessage("Confirmation is uncertain. Use the same request to check its receipt; no automatic retry was made.");
  }finally{locked.current=false;setBusy(false);}
 }
 if(signed)return <section className="signature-panel" role="status"><strong>Revised agreement signed.</strong>
   <p>Signature: {signed.signedName}</p><p>Revision: {signed.version}</p>
   <p>Scheduling and any payment will be arranged separately by First In Response Exteriors.</p>
 </section>;
 return <section className="signature-panel" aria-label="Sign revised deposit agreement">
   <p><strong>Customer approval of revised payment terms</strong></p>
   <p>Review the service scope, full agreement, and revised amounts above before signing.</p>
   <fieldset className="photo-release" disabled={busy||uncertain}>
    <legend>Before-and-after photo permission (required)</legend>
    <label><input type="radio" name="revisedPhoto" value="yes" checked={photo==="yes"} onChange={()=>setPhoto("yes")}/> Yes — allow photos for marketing</label>
    <label><input type="radio" name="revisedPhoto" value="no" checked={photo==="no"} onChange={()=>setPhoto("no")}/> No — do not allow marketing use</label>
   </fieldset>
   <label htmlFor="revisedDepositSignatureName">Full legal name</label>
   <input id="revisedDepositSignatureName" className="signature-input" autoComplete="name" maxLength={120}
    value={name} disabled={busy||uncertain} onChange={event=>setName(event.target.value)}/>
   <label className="terms-check"><input type="checkbox" checked={checked} disabled={busy||uncertain}
    onChange={event=>setChecked(event.target.checked)}/>
    I have reviewed and accept the revised deposit terms, itemized services, total price, complete Service Agreement &amp; Liability Waiver, and my photo-permission choice.
   </label>
   <button type="button" className="brand-button h-12 w-full" onClick={()=>void accept()}
    disabled={busy||(!uncertain&&(!checked||!photo||name.trim().length<2))}>
    {busy?"Confirming…":uncertain?"Check same signature receipt":"Sign and approve revised agreement"}
   </button>
   {message&&<p role="alert">{message}</p>}
   <p>This action does not initiate a charge or schedule work.</p>
 </section>;
}
