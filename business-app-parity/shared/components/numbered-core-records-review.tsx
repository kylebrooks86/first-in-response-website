"use client";

/** Owner REVIEW ONLY: source-ready, deliberately unmounted until the owner
 * approves exposure after complete numbered records + device photo recovery.
 * Never show this as a full backup or imply a saved download is independently
 * held. No passphrase is sent over HTTP or persisted in browser storage.
 */
import {useRef,useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {readOwnerNumberedCoreReviewResponse} from '../lib/numbered-v2-review-response.mjs';
import {prepareNumberedV2OwnerFile,verifySavedNumberedV2OwnerFile,
 type PreparedNumberedCoreOwnerFile}
 from '../lib/numbered-v2-owner-file-custody.mjs';

type Props={reviewEnabled?:boolean};

/** Intentionally disabled in the QA-master Business page by default.
 * When owner-approved, this is still REVIEW ONLY until a fully independent
 * encrypted records + photo + supplemental table restore passes Gate7.
 */
export function NumberedCoreRecordsReview({reviewEnabled=false}:Props){
 const [passphrase,setPassphrase]=useState('');
 const [confirmPassphrase,setConfirmPassphrase]=useState('');
 const [prepared,setPrepared]=useState<PreparedNumberedCoreOwnerFile|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [readbackVerified,setReadbackVerified]=useState(false);
 const selectSaved=useRef<HTMLInputElement>(null),locked=useRef(false);
 const clearSecrets=()=>{setPassphrase('');setConfirmPassphrase('');};
 const prepare=async()=>{
  if(locked.current||!reviewEnabled)return;
  if(!window.confirm('Prepare a private numbered CORE-records review? This is NOT a complete FIRE backup: photo bytes and optional service/property tables are missing. Do not retire prior backups or start LIVE based on this file.'))return;
  locked.current=true;setBusy(true);setError('');setMessage('');setPrepared(null);setReadbackVerified(false);
  try{
   const response=await fetch('/api/backup/numbered-v2',{
    method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{accept:'application/json'}
   });
   if(!response.ok)throw Error('Numbered core review has not been owner-enabled. No records file was prepared.');
   const source=await readOwnerNumberedCoreReviewResponse(response);
   const result=await prepareNumberedV2OwnerFile(source,passphrase,confirmPassphrase);
   setPrepared(result);
   setMessage('Private CORE records file prepared in memory only. Deliberately save it, then select that SAVED file and re-enter the original passphrase to verify exact encrypted bytes. This is NOT a full backup.');
  }catch(e){setError(e instanceof Error?e.message:'Core records preparation was blocked.');}
  finally{clearSecrets();locked.current=false;setBusy(false);}
 };
 const download=()=>{
  if(!reviewEnabled||locked.current||!prepared)return;
  try{
   const url=URL.createObjectURL(prepared.blob),link=document.createElement('a');
   link.href=url;link.download=prepared.filename;
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),10_000);
   setMessage('Download offered, NOT confirmed saved. Open the actual file from Files/Downloads using Verify selected saved records file.');
  }catch{setError('Download could not be started; prepared bytes remain in memory only.');}
 };
 const share=async()=>{
  if(!reviewEnabled||locked.current||!prepared)return;
  const file=new File([prepared.blob],prepared.filename,{type:'application/octet-stream'});
  if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files:[file]})){
   download();return;
  }
  locked.current=true;setBusy(true);setError('');
  try{
   await navigator.share({files:[file],title:'FIRE Protected Numbered CORE Records — NOT Full Backup'});
   setMessage('Save/share was offered. FIRE has not confirmed the file exists. Select the saved file below and independently verify it.');
  }catch(e){
   if(e instanceof Error&&e.name==='AbortError')
    setMessage('File sharing was cancelled. No saved backup was confirmed.');
   else setError('Sharing failed; no saved backup was confirmed. Use the download option.');
  }finally{locked.current=false;setBusy(false);}
 };
 const verify=async(file:File|undefined)=>{
  if(!reviewEnabled||locked.current||!prepared||!file)return;
  locked.current=true;setBusy(true);setError('');setMessage('');setReadbackVerified(false);
  try{
   const receipt=await verifySavedNumberedV2OwnerFile(prepared,file,passphrase);
   if(!receipt.selectedSavedFileByteIdentical||!receipt.savedFileAuthenticatedAndCoreValidated||
      receipt.gate7Accepted!==false)
    throw Error('Selected file could not be independently confirmed.');
   setReadbackVerified(true);
   setMessage('Selected saved file verified byte-for-byte against the prepared encrypted numbered CORE records. Keep the passphrase separately. This does NOT prove off-device custody, photos, a restore or Gate 7 acceptance.');
  }catch(e){setError(e instanceof Error?e.message:'The saved file failed readback verification.');}
  finally{clearSecrets();if(selectSaved.current)selectSaved.current.value='';locked.current=false;setBusy(false);}
 };
 if(!reviewEnabled)return null;
 return <section aria-label="Protected numbered core records review" className="business-panel">
  <header><h2>Encrypted numbered records — owner review only</h2></header>
  <p role="note">CORE RECORDS ONLY. No photo bytes, optional tables, independent off-device custody, or disaster-recovery restore are proven. Existing full-backup locks stay active; this does not authorize LIVE.</p>
  <Label htmlFor="numbered-records-review-passphrase">Private recovery passphrase (16–1024 characters)</Label>
  <Input id="numbered-records-review-passphrase" type="password" value={passphrase}
   autoComplete="off" maxLength={1024} disabled={busy} onChange={e=>setPassphrase(e.target.value)}/>
  {!prepared&&<><Label htmlFor="numbered-records-review-confirm">Confirm new recovery passphrase</Label>
   <Input id="numbered-records-review-confirm" type="password" value={confirmPassphrase}
    autoComplete="off" maxLength={1024} disabled={busy} onChange={e=>setConfirmPassphrase(e.target.value)}/></>}
  {!prepared&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void prepare()}>Prepare encrypted numbered CORE review file</Button>}
  {prepared&&<div className="workspace-head-actions">
   <Button type="button" variant="outline" disabled={busy} onClick={()=>void share()}>Save protected file to Files</Button>
   <Button type="button" variant="outline" disabled={busy} onClick={download}>Download protected records file</Button>
   <Button type="button" variant="outline" disabled={busy} onClick={()=>selectSaved.current?.click()}>Verify selected SAVED file</Button>
   <input type="file" hidden ref={selectSaved} accept=".firerecords,application/octet-stream" onChange={e=>void verify(e.currentTarget.files?.[0])}/>
  </div>}
  {message&&<p role="status" className={readbackVerified?'save-success':'save-message'}>{message}</p>}
  {error&&<p role="alert" className="save-error">{error}</p>}
  {prepared&&<Button type="button" variant="outline" disabled={busy}
    onClick={()=>{setPrepared(null);setReadbackVerified(false);clearSecrets();setMessage('Prepared file forgotten. Previously saved files were not touched.');}}>Discard prepared in-memory file</Button>}
 </section>;
}
