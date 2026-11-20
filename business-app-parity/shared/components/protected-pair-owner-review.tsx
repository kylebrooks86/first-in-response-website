"use client";

/** Default-OFF owner-device record+photo pairing without provider storage.
 * All originals MUST already be independently saved in Files, not merely
 * prepared in browser memory; saves an optional `.firepair` receipt readable
 * by the existing PRIVATE offline paired-recovery CLI. Nothing is uploaded.
 */
import {useRef,useState} from 'react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {readOfflinePhotoBackup} from '../lib/offline-photo-backup';
import {prepareBrowserProtectedPairReceipt,verifySelectedBrowserProtectedPairReceipt,
 type PreparedProtectedPair} from '../lib/protected-pair-owner-custody.mjs';

export function ProtectedPairOwnerReview({reviewEnabled=false}:{reviewEnabled?:boolean}){
 const [records,setRecords]=useState<File|null>(null);
 const [photos,setPhotos]=useState<File|null>(null);
 const [recordsPhrase,setRecordsPhrase]=useState('');
 const [photosPhrase,setPhotosPhrase]=useState('');
 const [draft,setDraft]=useState<PreparedProtectedPair|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [checked,setChecked]=useState(false);
 const selectedReceipt=useRef<HTMLInputElement>(null),locked=useRef(false);
 const clearPhrase=()=>{setRecordsPhrase('');setPhotosPhrase('');};
 const prepare=async()=>{
  if(!reviewEnabled||locked.current||!records||!photos)return;
  if(!window.confirm('Verify BOTH independently saved encrypted FIRE files and their original photo/customer relationships before preparing an optional pair receipt? This does not prove off-device custody, the same capture instant or recovery.'))return;
  locked.current=true;setBusy(true);setDraft(null);setChecked(false);setError('');setMessage('');
  try{
   const result=await prepareBrowserProtectedPairReceipt(
    records,recordsPhrase,photos,photosPhrase,readOfflinePhotoBackup);
   setDraft(result);
   setMessage('Original saved encrypted database and photo files authenticated. Every photo byte and customer association checked. Pair receipt prepared IN MEMORY ONLY; save and independently reselect it. Keep all THREE files and both phrases separately.');
  }catch(e){setError(e instanceof Error?e.message:'Saved encrypted records+photo pair was rejected.');}
  finally{clearPhrase();locked.current=false;setBusy(false);}
 };
 const download=()=>{
  if(!reviewEnabled||locked.current||!draft)return;
  try{
   const url=URL.createObjectURL(draft.blob),node=document.createElement('a');
   node.href=url;node.download=draft.filename;document.body.appendChild(node);
   node.click();node.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10_000);
   setMessage('Pair receipt download offered; an actual saved file has NOT been confirmed. Reselect it below.');
  }catch{setError('Could not offer receipt download. No backup files were changed.');}
 };
 const share=async()=>{
  if(!reviewEnabled||locked.current||!draft)return;
  const file=new File([draft.blob],draft.filename,{type:'application/json'});
  if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||
     !navigator.canShare({files:[file]})){download();return;}
  locked.current=true;setBusy(true);setError('');
  try{
   await navigator.share({files:[file],title:'FIRE protected saved-records and photo pair — NOT a full backup'});
   setMessage('Receipt sharing offered; physical saving NOT verified. Select the actual saved .firepair file.');
  }catch(e){
   if(e instanceof Error&&e.name==='AbortError')setMessage('Pair receipt sharing was cancelled.');
   else setError('Pair receipt share failed; download it instead.');
  }finally{locked.current=false;setBusy(false);}
 };
 const verify=async(file:File|undefined)=>{
  if(!reviewEnabled||locked.current||!draft||!file)return;
  locked.current=true;setBusy(true);setError('');setMessage('');setChecked(false);
  try{
   const receipt=await verifySelectedBrowserProtectedPairReceipt(draft,file);
   if(!receipt.exactSavedPairReceiptVerified||!receipt.originalEncryptedRecordsAndPhotosUnchanged||
      receipt.gate7Accepted!==false)
    throw Error('Original encrypted sources or saved receipt failed readback.');
   setChecked(true);
   setMessage('Saved pair receipt reselected and byte-verified against BOTH encrypted source files. Existing offline recovery can use these same three files. This does NOT prove independent off-device custody, same-instant snapshot or physical restoration. Gate 7 stays open.');
  }catch(e){setError(e instanceof Error?e.message:'The saved pair receipt could not be confirmed.');}
  finally{if(selectedReceipt.current)selectedReceipt.current.value='';locked.current=false;setBusy(false);}
 };
 if(!reviewEnabled)return null;
 return <section aria-label="Protected database and photo pair review" className="business-panel">
  <header><h2>Pair protected database and customer-photo files — owner review only</h2></header>
  <p role="note">Select independently SAVED, original encrypted .firerecords and .firephotos files. This checks every photo belongs to a customer in the same reviewed record archive. Never use this receipt in place of storing the actual record and photo files. No automatic Cloudflare storage, uploads, LIVE activation or recovery occurs.</p>
  <Label htmlFor="protected-pair-records">Saved complete database records (.firerecords)</Label>
  <Input id="protected-pair-records" type="file" accept=".firerecords,application/octet-stream"
   disabled={busy} onChange={e=>{setRecords(e.target.files?.[0]||null);setDraft(null);setChecked(false);}}/>
  <Label htmlFor="protected-pair-photos">Saved original encrypted customer photos (.firephotos)</Label>
  <Input id="protected-pair-photos" type="file" accept=".firephotos,application/octet-stream"
   disabled={busy} onChange={e=>{setPhotos(e.target.files?.[0]||null);setDraft(null);setChecked(false);}}/>
  <Label htmlFor="protected-pair-records-secret">Database records recovery phrase</Label>
  <Input id="protected-pair-records-secret" type="password" autoComplete="off" maxLength={1024}
   value={recordsPhrase} disabled={busy} onChange={e=>setRecordsPhrase(e.target.value)}/>
  <Label htmlFor="protected-pair-photos-secret">Customer-photo archive recovery phrase</Label>
  <Input id="protected-pair-photos-secret" type="password" autoComplete="off" maxLength={1024}
   value={photosPhrase} disabled={busy} onChange={e=>setPhotosPhrase(e.target.value)}/>
  {!draft&&<Button type="button" variant="outline" disabled={busy||!records||!photos}
   onClick={()=>void prepare()}>Verify saved originals and prepare paired receipt</Button>}
  {draft&&<div className="workspace-head-actions">
   <Button type="button" variant="outline" disabled={busy}
    onClick={()=>void share()}>Save .firepair receipt to Files</Button>
   <Button type="button" variant="outline" disabled={busy}
    onClick={download}>Download .firepair receipt</Button>
   <Button type="button" variant="outline" disabled={busy}
    onClick={()=>selectedReceipt.current?.click()}>Verify actual SAVED pair receipt</Button>
   <input ref={selectedReceipt} type="file" hidden accept=".firepair,application/json"
    onChange={e=>void verify(e.currentTarget.files?.[0])}/>
  </div>}
  {message&&<p role="status" className={checked?'save-success':'save-message'}>{message}</p>}
  {error&&<p role="alert" className="save-error">{error}</p>}
  {draft&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{
   setDraft(null);setChecked(false);clearPhrase();setRecords(null);setPhotos(null);
   setMessage('In-memory receipt discarded; your original saved encrypted files were never altered.');
  }}>Discard in-memory receipt</Button>}
 </section>;
}
