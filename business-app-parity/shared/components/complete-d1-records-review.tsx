"use client";

/** FIRE owner-only COMPLETE DATABASE RECORDS review, deliberately unmounted
 * until a later owner-authorized deployment and explicit review toggle.
 * This NEVER uploads/replaces D1 or automatically saves owner/customer data.
 * The browser protects core AND supplemental records using the EXISTING
 * FIRERB01 offline .firerecords format, with AES-GCM and PBKDF2; photos must
 * be separately saved and verified. Gate7 is still OPEN.
 */
import {useRef,useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {readOwnerCompleteD1ReviewResponse} from '../lib/complete-d1-review-response.mjs';
import {prepareCompleteD1OwnerFile,verifySelectedSavedCompleteD1OwnerFile,
 type PreparedCompleteD1OwnerFile}
 from '../lib/protected-complete-d1-records.mjs';

type Props={reviewEnabled?:boolean};

export function CompleteD1RecordsReview({reviewEnabled=false}:Props){
 const [phrase,setPhrase]=useState(''),[confirmation,setConfirmation]=useState('');
 const [prepared,setPrepared]=useState<PreparedCompleteD1OwnerFile|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [verified,setVerified]=useState(false);
 const selected=useRef<HTMLInputElement>(null),locked=useRef(false);
 const clearSecrets=()=>{setPhrase('');setConfirmation('');};
 const prepare=async()=>{
  if(!reviewEnabled||locked.current)return;
  if(!window.confirm('Prepare PRIVATE encrypted complete DATABASE records for owner review? Original customer photos are NOT included. This does NOT confirm a full backup or permit LIVE release.'))return;
  locked.current=true;setBusy(true);setError('');setMessage('');setVerified(false);setPrepared(null);
  try{
   const response=await fetch('/api/backup/numbered-v2',{
    method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{accept:'application/json'}
   });
   if(!response.ok)throw Error('Complete records review is not separately enabled for this authenticated owner. No file was prepared.');
   const review=await readOwnerCompleteD1ReviewResponse(response);
   const draft=await prepareCompleteD1OwnerFile(review,phrase,confirmation);
   setPrepared(draft);
   setMessage('Entire reviewed D1 record set encrypted in memory in the existing FIRE recovery format. It is NOT saved yet. Save to Files, then independently select the SAVED file below. Preserve original photos and their separate protected archive.');
  }catch(e){setError(e instanceof Error?e.message:'Complete database record export blocked.');}
  finally{clearSecrets();locked.current=false;setBusy(false);}
 };
 const download=()=>{
  if(!reviewEnabled||locked.current||!prepared)return;
  try{
   const url=URL.createObjectURL(prepared.blob),link=document.createElement('a');
   link.href=url;link.download=prepared.filename;
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),10_000);
   setMessage('Encrypted file download offered; saved custody NOT confirmed. Select the actual saved file to verify.');
  }catch{setError('Save could not start; only the in-memory encrypted file exists.');}
 };
 const share=async()=>{
  if(!reviewEnabled||locked.current||!prepared)return;
  const file=new File([prepared.blob],prepared.filename,{type:'application/octet-stream'});
  if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||
     !navigator.canShare({files:[file]})){download();return;}
  locked.current=true;setBusy(true);setError('');
  try{
   await navigator.share({files:[file],title:'FIRE complete DATABASE records — NOT full backup'});
   setMessage('Share was offered. This does NOT prove the file was saved. Reopen the actual saved file below.');
  }catch(e){
   if(e instanceof Error&&e.name==='AbortError')setMessage('Share cancelled; no saved file confirmed.');
   else setError('Saving via Files failed; use encrypted download instead.');
  }finally{locked.current=false;setBusy(false);}
 };
 const verify=async(file:File|undefined)=>{
  if(!reviewEnabled||locked.current||!prepared||!file)return;
  locked.current=true;setBusy(true);setError('');setMessage('');setVerified(false);
  try{
   const receipt=await verifySelectedSavedCompleteD1OwnerFile(prepared,file,phrase);
   if(!receipt.selectedCiphertextIdentical||
      !receipt.completeReviewedD1RecordsAuthenticated||receipt.gate7Accepted!==false)
    throw Error('The SAVED encrypted full-record file could not be verified.');
   setVerified(true);
   setMessage('Selected SAVED encrypted database records verified byte-for-byte. Keep the passphrase separately and protect an independent original-photo archive. This does NOT prove off-device custody or a full isolated restore. Gate 7 remains open.');
  }catch(e){setError(e instanceof Error?e.message:'Saved encrypted file failed verification.');}
  finally{clearSecrets();if(selected.current)selected.current.value='';locked.current=false;setBusy(false);}
 };
 if(!reviewEnabled)return null;
 return <section aria-label="Encrypted complete database records review" className="business-panel">
  <header><h2>Encrypted full database records — owner review only</h2></header>
  <p role="note">This records-only export is encrypted on this device using the EXISTING FIRE recovery format. It includes the reviewed database tables, migration journal and permanent Job # history. It does NOT contain original customer photo bytes, prove off-device custody, authorize database restoration or close Gate 7. DO NOT retire prior backups or activate LIVE.</p>
  <Label htmlFor="complete-records-passphrase">Private recovery passphrase (16–1024 characters)</Label>
  <Input id="complete-records-passphrase" type="password" value={phrase}
   autoComplete="off" maxLength={1024} disabled={busy} onChange={e=>setPhrase(e.target.value)}/>
  {!prepared&&<><Label htmlFor="complete-records-confirm">Confirm new recovery passphrase</Label>
   <Input id="complete-records-confirm" type="password" value={confirmation}
    autoComplete="off" maxLength={1024} disabled={busy}
    onChange={e=>setConfirmation(e.target.value)}/></>}
  {!prepared&&<Button type="button" variant="outline" disabled={busy}
   onClick={()=>void prepare()}>Prepare protected complete database records review</Button>}
  {prepared&&<div className="workspace-head-actions">
   <Button type="button" variant="outline" disabled={busy}
    onClick={()=>void share()}>Save encrypted database file to Files</Button>
   <Button type="button" variant="outline" disabled={busy}
    onClick={download}>Download encrypted database file</Button>
   <Button type="button" variant="outline" disabled={busy}
    onClick={()=>selected.current?.click()}>Verify selected SAVED encrypted file</Button>
   <input type="file" hidden ref={selected} accept=".firerecords,application/octet-stream"
    onChange={e=>void verify(e.currentTarget.files?.[0])}/>
  </div>}
  {message&&<p role="status" className={verified?'save-success':'save-message'}>{message}</p>}
  {error&&<p role="alert" className="save-error">{error}</p>}
  {prepared&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{
   setPrepared(null);setVerified(false);clearSecrets();
   setMessage('Prepared in-memory encrypted file discarded. Previously saved files remain untouched.');
  }}>Discard in-memory preparation</Button>}
 </section>;
}
