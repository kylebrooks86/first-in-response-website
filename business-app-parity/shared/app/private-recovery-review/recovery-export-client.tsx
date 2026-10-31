"use client";

/** Optional QA-only export button, rendered ONLY by owner-authenticated
 * server page when separate QA export flag and real D1/R2 bindings exist.
 * Different from purely local review: the passphrase is sent via SAME-ORIGIN
 * HTTPS to the private QA Worker, which encrypts the records + photos in
 * memory. It is never placed in URLs, logs, browser storage or file output.
 * Server returns only authenticated encrypted JSON kit; no restore.
 */
import {useRef,useState,type FormEvent} from "react";
import {inspectLocalEncryptedRecoveryKit,FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES} from "../../lib/numbered-records-v2-local-review.mjs";

export function PrivateRecoveryExportClient(){
 const pass=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("");
 async function makeKit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const password=pass.current?.value??"";
  if(password.length<20){setStatus("Use a private recovery passphrase at least 20 characters long.");return;}
  setBusy(true);setStatus("");
  try{
   const response=await fetch("/api/private-recovery-kit",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({passphrase:password})
   });
   if(!response.ok)throw Error("Export source was incomplete or not authorized");
   if(!response.headers.get("content-type")?.includes("application/json"))
    throw Error("Unrecognized export reply");
   const declaredSize=response.headers.get("content-length");
   if(declaredSize!==null){
    const declared=Number(declaredSize);
    if(!Number.isSafeInteger(declared)||declared<=0||
       declared>FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES)
     throw Error("Unreviewed encrypted kit response length");
   }
   const sealed=await response.blob();
   if(sealed.size<=0||sealed.size>FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES)
    throw Error("Encrypted kit outside reviewed download limit");
   // No saved-backup claim without decrypting and verifying EXACTLY the
   // server response, including original image bytes and financial history.
   // This local check makes no API call and returns aggregate counts only.
   const proof=await inspectLocalEncryptedRecoveryKit({
    text:await sealed.text(),passphrase:password
   });
   if(!proof.validEncryptedRecordsAndPhotos||proof.filesUploaded||
      proof.recordsRestored||proof.photosRestored||proof.releaseApproved)
    throw Error("Encrypted response failed full local backup verification");
   const url=URL.createObjectURL(sealed);
   try{
    const link=document.createElement("a");
    link.href=url;
    link.download="fire-private-recovery-kit-v2.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus("Verified encrypted kit; browser download requested. Check your Downloads folder, then use the review above to verify the SAVED file. Keep your passphrase separately.");
   }finally{
    // The browser needs the blob URL long enough to begin the download.
    setTimeout(()=>URL.revokeObjectURL(url),60_000);
   }
  }catch{
   setStatus("Export was not downloaded: private source or full local encrypted records/photo verification failed. No database or photo records were changed.");
  }finally{
   if(pass.current)pass.current.value="";
   setBusy(false);
  }
 }
 return <div style={{maxWidth:670,margin:"18px auto",padding:18,
  background:"var(--card)",border:"1px solid var(--border)",borderRadius:14}}>
  <h2 style={{fontSize:19,fontWeight:750,margin:"0 0 8px"}}>Create encrypted QA recovery kit</h2>
  <p style={{fontSize:14,lineHeight:1.5,margin:"0 0 14px"}}>
   Separate opt-in, read-only export. All business records and every referenced photo
   must pass before an encrypted download is created. No restore is performed.
  </p>
  <p style={{fontSize:13,lineHeight:1.5,margin:"0 0 14px",fontWeight:650}}>
   Unlike the local verification above, this export sends your passphrase over
   encrypted HTTPS to the private QA app so it can encrypt the backup.
   It is not stored with the downloaded file. Keep the passphrase separately.
  </p>
  <form onSubmit={makeKit} autoComplete="off" style={{display:"grid",gap:10}}>
   <label htmlFor="fire-export-passphrase" style={{fontWeight:650}}>
    Owner-held export passphrase
   </label>
   <input ref={pass} id="fire-export-passphrase" type="password" autoComplete="off"
    spellCheck={false} disabled={busy}
    style={{minHeight:44,width:"100%",boxSizing:"border-box",
     padding:10,border:"1px solid var(--border)",borderRadius:9,fontSize:16,
     background:"var(--card)",color:"var(--foreground)"}}/>
   <button type="submit" disabled={busy}
    style={{minHeight:46,padding:"10px 16px",borderRadius:9,
     background:"var(--primary)",color:"var(--primary-foreground)",
     fontWeight:700}}>
    {busy?"Checking source, encrypting and verifying…":"Create private encrypted kit"}
   </button>
  </form>
  {status?<p role="status" aria-live="polite" style={{
    margin:"12px 0 0",fontSize:14,lineHeight:1.5,overflowWrap:"anywhere"
   }}>{status}</p>:null}
 </div>;
}
