"use client";

/** FIRE owner-only private kit preview. Component never uploads or restores.
 * No server request, analytics, localStorage, cookies or passphrase persistence.
 */
import {useRef,useState,type FormEvent} from "react";
import {inspectLocalEncryptedRecoveryKit,
 FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES} from "../../lib/numbered-records-v2-local-review.mjs";

type Preview = {
 recordTables:number;recordRows:number;customers:number;estimates:number;
 customerNumbers:number;jobNumbers:number;jobLinks:number;
 verifiedPhotoFiles:number;verifiedPhotoBytes:number;
 validEncryptedRecordsAndPhotos:boolean;filesUploaded:false;
 recordsRestored:false;photosRestored:false;releaseApproved:false;
};
const styleInput={
 display:"block",width:"100%",maxWidth:"100%",boxSizing:"border-box" as const,
 minHeight:44,padding:10,border:"1px solid var(--border)",borderRadius:9,
 background:"var(--card)",color:"var(--foreground)",fontSize:16
};
const styleLabel={display:"block" as const,fontWeight:650,marginBottom:8};
export function PrivateRecoveryReviewClient(){
 const fileRef=useRef<HTMLInputElement>(null);
 const passRef=useRef<HTMLInputElement>(null);
 const [selected,setSelected]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Preview|null>(null);
 const [error,setError]=useState("");
 const clear=()=>{
  if(fileRef.current)fileRef.current.value="";
  if(passRef.current)passRef.current.value="";
  setSelected(null);setResult(null);setError("");
 };
 async function verify(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setResult(null);setError("");
  const file=selected;
  const password=passRef.current?.value??"";
  if(!file||file.size<=0||file.size>FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES){
   setError("Select a valid private recovery kit within the reviewed size limit.");
   if(passRef.current)passRef.current.value="";
   return;
  }
  if(password.length<20){
   setError("Enter the owner-held recovery passphrase. Do not paste it into chat.");
   if(passRef.current)passRef.current.value="";
   return;
  }
  setBusy(true);
  try{
   // Local browser file read and Web Crypto only. NO upload or API calls.
   const text=await file.text();
   const summary=await inspectLocalEncryptedRecoveryKit({text,passphrase:password});
   setResult(summary as Preview);
  }catch{
   setError("Private recovery verification failed. The file, passphrase, records, or photo files may be incomplete or altered. Nothing was uploaded or restored.");
  }finally{
   if(passRef.current)passRef.current.value="";
   if(fileRef.current)fileRef.current.value="";
   setSelected(null);setBusy(false);
  }
 }
 return <section style={{maxWidth:670,margin:"0 auto",padding:"20px 16px",color:"var(--foreground)"}}>
  <div style={{border:"1px solid var(--border)",borderRadius:14,padding:18,background:"var(--card)"}}>
   <h1 style={{fontSize:23,fontWeight:750,margin:"0 0 10px"}}>Private recovery kit review</h1>
   <p style={{margin:"0 0 14px",lineHeight:1.5,fontSize:14}}>
    Verify a previously created encrypted FIRE backup on this device.
    Both the business records and original photo bytes must pass.
   </p>
   <p style={{margin:"0 0 18px",lineHeight:1.5,fontSize:14,fontWeight:650}}>
    Read-only preview. No files are uploaded, and no customer data, photos, numbering,
    Stripe records, or database settings are changed.
   </p>
   <form onSubmit={verify} autoComplete="off" style={{display:"grid",gap:16}}>
    <div>
     <label htmlFor="fire-recovery-file" style={styleLabel}>Encrypted recovery kit (JSON)</label>
     <input id="fire-recovery-file" ref={fileRef} type="file" accept=".json,application/json"
      onChange={event=>{setResult(null);setError("");
       setSelected(event.currentTarget.files?.[0]??null);
      }} disabled={busy} style={styleInput}/>
    </div>
    <div>
     <label htmlFor="fire-recovery-passphrase" style={styleLabel}>Private backup passphrase</label>
     <input id="fire-recovery-passphrase" ref={passRef} type="password"
      autoComplete="off" spellCheck={false} disabled={busy}
      placeholder="Enter locally; never share in chat"
      style={styleInput}/>
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
     <button type="submit" disabled={busy||!selected}
      style={{minHeight:46,borderRadius:9,padding:"10px 16px",
       background:"var(--primary)",color:"var(--primary-foreground)",
       opacity:busy||!selected?.65:1,fontWeight:700}}>
      {busy?"Checking encrypted records and photos…":"Verify kit locally"}
     </button>
     <button type="button" onClick={clear} disabled={busy}
      style={{minHeight:46,border:"1px solid var(--border)",borderRadius:9,
       padding:"10px 16px",background:"var(--secondary)",color:"var(--foreground)"}}>
      Clear
     </button>
    </div>
   </form>
   {error?<p role="alert" style={{marginTop:14,color:"var(--destructive)",
     overflowWrap:"anywhere",lineHeight:1.5}}>{error}</p>:null}
   {result?<div role="status" aria-live="polite"
     style={{marginTop:18,padding:14,background:"var(--secondary)",
       borderRadius:10,lineHeight:1.7}}>
     <strong>Encrypted backup verified locally</strong>
     <div>Database record tables: {result.recordTables}</div>
     <div>Total database records: {result.recordRows}</div>
     <div>Customers: {result.customers}</div>
     <div>Estimates: {result.estimates}</div>
     <div>Permanent customer numbers: {result.customerNumbers}</div>
     <div>Permanent job numbers: {result.jobNumbers}</div>
     <div>Job/revision links: {result.jobLinks}</div>
     <div>Verified photo files: {result.verifiedPhotoFiles}</div>
     <div>Verified photo bytes: {result.verifiedPhotoBytes.toLocaleString()}</div>
     <p style={{margin:"10px 0 0",fontSize:13}}>
      This is an offline integrity review, <strong>not</strong> a restored app or
      proof of source ownership, remote photo custody, or production release.
     </p>
    </div>:null}
  </div>
 </section>;
}
