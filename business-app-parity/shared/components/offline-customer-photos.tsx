"use client";

import {useEffect,useRef,useState} from 'react';
import {Camera,Download,Images,Trash2,Upload} from 'lucide-react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {addOfflinePhoto,listOfflinePhotos,removeOfflinePhoto,exportLocalPhotos,restoreLocalPhotos,byteIdenticalOfflinePhotoInventory,verifyOfflinePhotoJobOwnership,resolveVerifiedOfflinePhotoJobSelection,validateOfflinePhotoCaptureFile,type VerifiedPhotoJob,OFFLINE_PHOTO_CHANGES_CHANNEL,OFFLINE_PHOTO_PAGE_ID} from '../lib/local-photo-vault';
import {readPhotoMutationAttempt,runPhotoMutation,reviewPhotoMutation,acknowledgePhotoMutation} from '../lib/photo-mutation-journal';
import {requiresAllCustomerPhotoReview} from '../lib/photo-restore-interruption-scope.mjs';
import {photoComparisonPlacement,FIRE_PHOTO_COMPARISON_LAYOUT,assertPhotoComparisonSameJob,eligiblePhotoComparisonAfter} from '../lib/photo-comparison-layout.mjs';
import {readOfflinePhotoBackup,type OfflinePhoto} from '../lib/offline-photo-backup';
import {inspectSavedOfflinePhotoZip} from '../lib/offline-photo-inspection';
import {protectOfflinePhotoZip,openOwnerOfflinePhotoArchive} from '../lib/protected-offline-photo-archive.mjs';

type Preview={photo:OfflinePhoto;url:string};
export function OfflineCustomerPhotos({customerId,customerName,knownCustomerIds,knownJobs=[],legacyCloudPhotoCount=0,onPhotoCountChange}:{customerId:string;customerName:string;knownCustomerIds:string[];knownJobs?:ReadonlyArray<VerifiedPhotoJob>;legacyCloudPhotoCount?:number;onPhotoCountChange?:(customerId:string,count:number)=>void}){
 const [items,setItems]=useState<Preview[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [preparedBackup,setPreparedBackup]=useState<File|null>(null);
 const [preparedComparison,setPreparedComparison]=useState<{file:File;beforeId:string;afterId:string}|null>(null);
 const [backupPassphrase,setBackupPassphrase]=useState('');
 const [confirmBackupPassphrase,setConfirmBackupPassphrase]=useState('');
 const [category,setCategory]=useState<'before'|'after'|'property'>('before'),[caption,setCaption]=useState('');
 const [selectedJobId,setSelectedJobId]=useState('');
 const [beforeId,setBeforeId]=useState(''),[afterId,setAfterId]=useState('');
 const cameraRef=useRef<HTMLInputElement>(null),libraryRef=useRef<HTMLInputElement>(null),restoreRef=useRef<HTMLInputElement>(null),verifyRef=useRef<HTMLInputElement>(null);
 const active=useRef(false),reviewRequired=useRef(false);
 const [needsReview,setNeedsReview]=useState(false),[reviewLoaded,setReviewLoaded]=useState(false);
 const [allCustomerRestoreReview,setAllCustomerRestoreReview]=useState(false);
 const [safetyReady,setSafetyReady]=useState(false);
 const reviewedAttempt=useRef<string|null>(null);
 const pauseForReview=()=>{reviewRequired.current=true;setNeedsReview(true);setReviewLoaded(false);setPreparedBackup(null);};
 const refresh=async()=>{
  const rows=await listOfflinePhotos(customerId);
  const next=rows.map(photo=>({photo,url:URL.createObjectURL(photo.blob)}));
  setItems(next);onPhotoCountChange?.(customerId,next.length);return next.length;
 };
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError('');setItems([]);
   // A saved job/photo choice must never carry over into another customer.
   setSelectedJobId('');setBeforeId('');setAfterId('');setPreparedComparison(null);
  listOfflinePhotos(customerId).then(rows=>{
   if(cancelled)return;
   setItems(rows.map(photo=>({photo,url:URL.createObjectURL(photo.blob)})));
   onPhotoCountChange?.(customerId,rows.length);
  }).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not open this device’s photo vault.');})
  .finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[customerId]);
 // Multi-tab safety: a prepared all-photos or single-customer ZIP must not
 // remain offered after ANOTHER FIRE tab changes the on-device photo vault.
 // Broadcasts carry no photo bytes or customer identity; reread IndexedDB.
 useEffect(()=>{
  setPreparedBackup(null);
  if(typeof BroadcastChannel==='undefined')return;
  const channel=new BroadcastChannel(OFFLINE_PHOTO_CHANGES_CHANNEL);
  const changed=()=>{
   setPreparedBackup(null);setPreparedComparison(null);
   setError('Another FIRE tab changed on-device photos. Any previously prepared ZIP may be incomplete. Prepare a fresh backup after reviewing the updated gallery.');
   void refresh().catch(()=>setError('Other FIRE tab changed photos, but this gallery could not be refreshed. Do not rely on a previously prepared ZIP.'));
  };
  const onChange=(event:MessageEvent)=>{
   if(!event.data||event.data.type!=='changed'||typeof event.data.source!=='string'||event.data.source===OFFLINE_PHOTO_PAGE_ID)return;
   changed();
  };
  channel.addEventListener('message',onChange);
  return()=>{channel.removeEventListener('message',onChange);channel.close();};
 },[customerId]);
 // Read the durable receipt on mount, focus and return from another app. Never
 // clear it on navigation, reload, sign-out or age; only explicit review may.
 useEffect(()=>{
  let cancelled=false;
  const inspect=async()=>{
   try{const pending=await readPhotoMutationAttempt();if(cancelled)return;
    if(pending){pauseForReview();setAllCustomerRestoreReview(requiresAllCustomerPhotoReview(pending));}
    setSafetyReady(true);
   }catch(err){if(!cancelled){pauseForReview();setError(err instanceof Error?err.message:'Photo safety storage unavailable.');setSafetyReady(false);}}
  };
  void inspect();window.addEventListener('focus',inspect);
  const visible=()=>{if(document.visibilityState==='visible')void inspect();};
  document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;window.removeEventListener('focus',inspect);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const allowChanges=async()=>{
  if(active.current||!reviewLoaded)return;
  active.current=true;setBusy(true);
  try{await acknowledgePhotoMutation(reviewedAttempt.current);reviewRequired.current=false;setNeedsReview(false);setReviewLoaded(false);setAllCustomerRestoreReview(false);setError('');setMessage('New deliberate photo changes are enabled. Previously selected files will not be retried.');}
  catch(err){setReviewLoaded(false);setError(err instanceof Error?err.message:'Photo review could not be confirmed. Changes remain paused.');}
  finally{active.current=false;setBusy(false);}
 };
 useEffect(()=>()=>{for(const item of items)URL.revokeObjectURL(item.url);},[items]);
 const add=async(files:FileList|null)=>{
  if(!files?.length||active.current||reviewRequired.current||!safetyReady)return;
  active.current=true;setBusy(true);setError('');setMessage('');
  let mutationStarted=false;
  try{
   // Preflight ALL selected originals and job owner before the first durable
   // mutation receipt, so invalid choices do not lock the entire gallery.
   const selectedJob=resolveVerifiedOfflinePhotoJobSelection(customerId,selectedJobId,knownJobs);
   const chosenFiles=Array.from(files);
   for(const file of chosenFiles)validateOfflinePhotoCaptureFile(customerId,category,file,selectedJob?.id);
   setPreparedBackup(null);
   mutationStarted=true;
   await runPhotoMutation('add',customerId,async()=>{
    for(const file of chosenFiles)await addOfflinePhoto(customerId,category,caption,file,selectedJob?.id);
    await refresh();
   });setCaption('');
   setMessage('Photos verified on this device. They are NOT backed up yet; export a ZIP to Files/iCloud.');
  }catch(err){
   if(!mutationStarted)setError((err instanceof Error?err.message:'Photo selection is invalid.')+' No photos were changed. Choose valid originals or refresh saved jobs.');
   else{pauseForReview();setError((err instanceof Error?err.message:'Photo save was not confirmed.')+' Some selected photos may already be saved. No automatic retry was made. Refresh and review saved photos before choosing any remaining originals.');try{await refresh();}catch{}}
  }finally{active.current=false;setBusy(false);if(cameraRef.current)cameraRef.current.value='';if(libraryRef.current)libraryRef.current.value='';}
 };
 const remove=async(photo:OfflinePhoto)=>{
  if(active.current||reviewRequired.current||!safetyReady||!window.confirm('Delete this on-device photo? This cannot be undone without a separate backup.'))return;
  active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  try{await runPhotoMutation('delete',customerId,async()=>{await removeOfflinePhoto(photo.id,customerId);await refresh();});setMessage('Photo removed from this device. An older exported ZIP is unchanged.');}
  catch(err){pauseForReview();setError((err instanceof Error?err.message:'Could not verify photo removal.')+' Removal may already have completed. No automatic retry was made. Refresh and review saved photos.');try{await refresh();}catch{}}
  finally{active.current=false;setBusy(false);}
 };
 // iOS Safari requires an active user gesture for navigator.share(). Preparing
 // a ZIP first and THEN trying to share after awaits loses that gesture.
 // Step 1 prepares/verifies asynchronously; step 2 opens sharing immediately
 // inside a new actual button click, before the first await.
 const prepareArchive=async(scope:'all'|'customer',protectedFile=true)=>{
  if(active.current)return;active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  try{
   // Keep the verified legacy ZIP import/export while making the default new backup private.
   if(protectedFile&&backupPassphrase!==confirmBackupPassphrase)
    throw Error('Recovery passphrases do not match. Re-enter both before creating a protected backup.');
   const zip=await exportLocalPhotos(scope==='customer'?customerId:undefined);
   const payload=protectedFile?await protectOfflinePhotoZip(zip,backupPassphrase):zip;
   // Owner may have another tab: encryption takes longer than ZIP creation.
   // Re-read every current photo byte before offering a possibly stale backup.
   const archived=await readOfflinePhotoBackup(zip);
   if(!await byteIdenticalOfflinePhotoInventory(archived,await listOfflinePhotos(scope==='customer'?customerId:undefined)))
    throw Error('Device photos changed while the protected backup was prepared. Discard this copy and prepare a fresh archive.');
   const filename='FIRE-'+(scope==='customer'?'customer-'+customerId:'all')+'-photos-'+
    new Date().toISOString().slice(0,10)+(protectedFile?'.firephotos':'.zip');
   setPreparedBackup(new File([payload],filename,{type:protectedFile?'application/octet-stream':'application/zip'}));
   if(protectedFile){
    setBackupPassphrase('');setConfirmBackupPassphrase('');
    setMessage('Protected photo backup ready. Save it to Files or a separate private location, then RE-ENTER your passphrase to verify the SAVED file. FIRE cannot recover a forgotten passphrase.');
   }else setMessage('Legacy UNENCRYPTED ZIP ready. This copy is not private or protected. Save and verify before relying on it.');
  }catch(err){setError(err instanceof Error?err.message:'Photo archive was not created.');}
  finally{active.current=false;setBusy(false);}
 };
 const downloadPreparedArchive=()=>{
  if(active.current||busy||!preparedBackup)return;
  setError('');setMessage('');
  try{
   const url=URL.createObjectURL(preparedBackup),link=document.createElement('a');
   link.href=url;link.download=preparedBackup.name;document.body.appendChild(link);
   link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
   setMessage('Backup download offered. Check Files/Downloads and VERIFY the saved file before considering photos backed up.');
  }catch(err){setError(err instanceof Error?err.message:'Could not start download; prepared ZIP remains available.');}
 };
 const savePreparedArchive=async()=>{
  if(active.current||busy||!preparedBackup)return;
  // The share invocation is the FIRST asynchronous action after this click.
  // Do not add an await before it: iOS will reject a stale user gesture.
  setError('');setMessage('');
  const file=preparedBackup;
  if(!navigator.share||!navigator.canShare?.({files:[file]})){
   downloadPreparedArchive();return;
  }
  active.current=true;setBusy(true);
  try{
   await navigator.share({files:[file],title:'FIRE Offline Photo Backup'});
   setMessage('Check that the backup exists in Files or separate private storage, then use Verify saved photo backup. A protected file requires the original passphrase.');
  }catch(err){
   if(err instanceof Error&&err.name==='AbortError')setMessage('Saving was cancelled. The prepared backup is still available; photos are NOT backed up.');
   else setError('iOS could not open the share sheet. Open More photo backup tools, then Download prepared backup. No backup was confirmed saved.');
  }finally{active.current=false;setBusy(false);}
 };
 const verifySavedArchive=async(files:FileList|null)=>{
  if(!files?.length||active.current)return;
  active.current=true;setBusy(true);setError('');setMessage('');
  try{
   const opened=await openOwnerOfflinePhotoArchive(files[0],backupPassphrase);
   const result=await inspectSavedOfflinePhotoZip(opened,knownCustomerIds,knownJobs);
   // A valid ZIP is not necessarily a complete backup. An older or
   // customer-scoped ZIP may have perfect checksums but miss newer photos.
   const details=result.archivePhotoCount+' photo(s) in archive; '+
    result.byteIdenticalOnDevice+' exactly match this device; '+
    result.notYetOnDevice+' archive photo(s) are not on this device.';
   if(result.localPhotosNotInArchive>0){
    setError('INCOMPLETE PHOTO BACKUP: '+result.localPhotosNotInArchive+
     ' current device photo(s) are NOT in this saved ZIP. Preserve it, but prepare and save a NEW all-local-photos ZIP before relying on the backup.');
    setMessage('Saved ZIP checksum verification passed, but backup coverage is incomplete: '+details);
   }else if(result.notYetOnDevice>0){
    setMessage('Saved ZIP VERIFIED: '+details+' '+
     (result.byteIdenticalOnDevice===0?'Current local library is empty. ':'All current on-device photos are included. ')+
     'Verification did not restore any photos. Keep this ZIP in Files; open More photo backup tools, then Restore verified photo ZIP to recover missing photos.');
   }else if(result.archivePhotoCount===0){
    setMessage('Saved ZIP VERIFIED: archive and current local library are empty. No photos were restored. Keep any older photo backups.');
   }else{
    setMessage('Backup COMPLETE: all current on-device photos included. '+
     details+' Keep this ZIP in Files; back up again after adding photos.');
   }
  }catch(err){setError((err instanceof Error?err.message:'Saved backup verification failed.')+' No photos were changed.');}
  finally{active.current=false;setBusy(false);setBackupPassphrase('');setConfirmBackupPassphrase('');if(verifyRef.current)verifyRef.current.value='';}
 };
 const restore=async(files:FileList|null)=>{
  if(!files?.length||active.current||reviewRequired.current||!safetyReady)return;
  if(!window.confirm('Restore this photo backup? FIRE will check every photo and customer ID. Identical originals stay saved. Conflicting IDs stop without overwrites. Restore matching customer records first.'))return;
  active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  let mutationStarted=false;
  try{
   // Wrong passphrase and damaged encrypted files fail BEFORE a mutation receipt.
   const zip=await openOwnerOfflinePhotoArchive(files[0],backupPassphrase);
   // Finish ZIP CRC/SHA-256 and customer-relationship preflight before the
   // first durable mutation receipt. Invalid ZIPs must not pause safe edits.
   const incoming=await readOfflinePhotoBackup(zip);
   if(!incoming.length)throw Error('This photo archive contains no photos.');
   const known=new Set(knownCustomerIds);
   if(incoming.some(photo=>!known.has(photo.customerId)))
    throw Error('Restore matching customer records before importing these photos.');
   // Authenticated owner history supplies the job-to-customer mapping. A
   // cached offline-only customer directory is NOT a verified job inventory.
   // Reject unknown or cross-customer links BEFORE mutation journaling.
   verifyOfflinePhotoJobOwnership(incoming,knownJobs);
   mutationStarted=true;
   const result=await runPhotoMutation('restore',customerId,async()=>{
    const restored=await restoreLocalPhotos(zip,knownCustomerIds,knownJobs);
    await refresh();return restored;
   });
   setMessage('Restored '+result.restored+' new verified photo(s); '+result.alreadyPresent+' byte-identical photo(s) already on this device were safely skipped. Keep the original archive and recovery passphrase in separate private locations.');
  }catch(err){
   if(mutationStarted){
    pauseForReview();
    setError((err instanceof Error?err.message:'Photo restore could not be confirmed.')+' Some photos may already have been saved. No automatic retry. Review existing photos before another restore.');
    try{await refresh();}catch{}
   }else setError((err instanceof Error?err.message:'Could not read photo backup.')+' No photos were changed. Check the file and original recovery passphrase.');
  }finally{
   active.current=false;setBusy(false);setBackupPassphrase('');setConfirmBackupPassphrase('');
   if(restoreRef.current)restoreRef.current.value='';
  }
 };
 const refreshForReview=async()=>{
  if(active.current)return;active.current=true;setBusy(true);setReviewLoaded(false);
  try{
   const pending=await readPhotoMutationAttempt();
   let summary='';
   reviewedAttempt.current=await reviewPhotoMutation(customerId,async()=>{
    // A restore can write several customers before an iPhone/tab interruption.
    // Read and hash ALL saved customer photo blobs before acknowledging it,
    // never only this gallery. This checks readable bytes, NOT that every
    // original ZIP image has been restored: the owner must retain the backup.
    const stored=await listOfflinePhotos();
    if(requiresAllCustomerPhotoReview(pending)){
     const customerCounts=new Map<string,number>();
     for(const row of stored){
      if(!(row.blob instanceof Blob)||row.blob.size!==row.sizeBytes||
         row.blob.type!==row.contentType)
       throw Error('A saved customer photo cannot be read consistently. Preserve original backups and keep changes paused.');
      await crypto.subtle.digest('SHA-256',await row.blob.arrayBuffer());
      customerCounts.set(row.customerId,(customerCounts.get(row.customerId)||0)+1);
     }
     summary='All-customer interruption review: '+stored.length+
      ' readable saved photo(s) across '+customerCounts.size+
      ' customer gallery/galleries. Review every affected customer gallery before unlocking. This does NOT prove every original archive photo was restored. Keep the source ZIP and verify it again.';
    }
    await refresh();
   });
   if(pending&&reviewedAttempt.current!==pending.id)
    throw Error('The interrupted photo attempt changed during review. Refresh the library again.');
   setAllCustomerRestoreReview(requiresAllCustomerPhotoReview(pending));
   setReviewLoaded(true);
   setMessage(summary||'Saved photo list refreshed without adding, deleting or restoring photos. Review it before allowing new changes.');
  }catch(err){setError((err instanceof Error?err.message:'Could not refresh saved photos.')+' Changes remain paused.');}
  finally{active.current=false;setBusy(false);}
 };
 const before=items.filter(item=>item.photo.category==='before');
 const after=items.filter(item=>item.photo.category==='after');
 const selectedBefore=before.find(item=>item.photo.id===(beforeId||before[0]?.photo.id));
 const compatibleAfter=selectedBefore?after.filter(item=>eligiblePhotoComparisonAfter(selectedBefore.photo,item.photo)):[];
 const selectedAfter=compatibleAfter.find(item=>item.photo.id===afterId)||compatibleAfter[0];
 // Only offer the prepared PNG for its selected before/after originals.
 const readyComparison=preparedComparison&&
  preparedComparison.beforeId===selectedBefore?.photo.id&&
  preparedComparison.afterId===selectedAfter?.photo.id?preparedComparison:null;
 const comparison=async()=>{
  if(!selectedBefore||!selectedAfter||active.current)return;
  active.current=true;setBusy(true);setError('');setMessage('');setPreparedComparison(null);
  try{
   // Never present unrelated numbered-job originals as one real job comparison.
   assertPhotoComparisonSameJob(selectedBefore.photo,selectedAfter.photo);
   const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Photo cannot be decoded by this browser.'));image.src=url;
   });
   const [a,b]=await Promise.all([load(selectedBefore.url),load(selectedAfter.url)]);
   const canvas=document.createElement('canvas');canvas.width=FIRE_PHOTO_COMPARISON_LAYOUT.canvasWidth;canvas.height=FIRE_PHOTO_COMPARISON_LAYOUT.canvasHeight;
   const context=canvas.getContext('2d');if(!context)throw Error('Image comparison is unavailable.');
   // Show the ENTIRE original before/after photos (never crop out damage,
   // cleaning edges or existing dirt) and clip every draw to its own panel.
   // Without clipping, a wide AFTER image can overwrite the BEFORE half.
   const draw=(img:HTMLImageElement,x:number)=>{
    const place=photoComparisonPlacement(img.naturalWidth,img.naturalHeight,x);
    context.save();context.beginPath();
    context.rect(place.panelX,place.panelY,place.panelWidth,place.panelHeight);
    context.clip();context.drawImage(img,place.x,place.y,place.width,place.height);
    context.restore();
   };
   context.fillStyle='#10213a';context.fillRect(0,0,canvas.width,canvas.height);
   draw(a,0);draw(b,804);
   context.fillStyle='#10213a';context.fillRect(0,0,796,70);context.fillRect(804,0,796,70);
   context.fillStyle='white';context.textAlign='center';context.font='bold 30px sans-serif';context.fillText('BEFORE',398,46);context.fillText('AFTER',1202,46);
   context.textAlign='left';context.font='bold 27px sans-serif';context.fillText('FIRST IN RESPONSE EXTERIORS',35,930);
   // Comparison files are intended for marketing. Customer profile names are
   // private and must never be embedded in the exported PNG by default.
   // Keep the actual untouched photo pair; label only public FIRE identity.
   context.textAlign='right';context.font='22px sans-serif';context.fillText('firstinresponseexteriors.com',1560,930);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not create comparison.')),'image/png'));
   const file=new File([blob],'FIRE-before-after.png',{type:'image/png'});
   setPreparedComparison({file,beforeId:selectedBefore.photo.id,afterId:selectedAfter.photo.id});
   // Preserve Chrome's direct download; iPhone Safari may need a new user tap
   // after asynchronous image decoding to open its native share sheet.
   const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
   setMessage('Comparison prepared and download offered. On iPhone, tap Save or share comparison to open Files. Keep the originals in your separate backup.');
  }catch(err){setError(err instanceof Error?err.message:'Comparison failed.');}
  finally{active.current=false;setBusy(false);}
 };
 const savePreparedComparison=async()=>{
  // Native iPhone share must be invoked on the FIRST await of this fresh tap.
  const ready=readyComparison;
  if(!ready||active.current||busy)return;
  const file=ready.file;
  setError('');setMessage('');
  if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files:[file]})){
   try{
    const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
    setMessage('Comparison download offered. Check Files/Downloads for the PNG.');
   }catch{setError('Comparison download could not start; the prepared PNG is unchanged.');}
   return;
  }
  active.current=true;setBusy(true);
  try{
   await navigator.share({files:[file],title:'FIRE Before & After'});
   setMessage('Comparison sharing offered. Confirm the PNG was saved to Files or your chosen location.');
  }catch(err){
   if(err instanceof Error&&err.name==='AbortError')setMessage('Sharing cancelled; prepared comparison remains available.');
   else setError('Comparison sharing failed. The prepared PNG remains available to download.');
  }finally{active.current=false;setBusy(false);}
 };
 return <section className="photo-panel" aria-label="On-device customer photos">
  <header><strong>Photos</strong><p>On this device only · not synced.</p></header>
  <p className="payment-handle-note"><strong>Back up photos:</strong> Prepare a protected all-photos archive and save it outside this browser. A file left only on this device is not independent recovery. FIRE cannot reset a forgotten passphrase. Photos are not synced; older cloud photos are not included.</p>
  {legacyCloudPhotoCount>0&&<p role="alert" className="save-error">{legacyCloudPhotoCount} older hosted photo record(s) remain associated with this customer. The new on-device gallery and ZIP backup do not include those bytes. No existing hosted records were deleted or migrated. Preserve the old cloud archive separately before considering its storage retired.</p>}
  <div className="photo-toolbar">
   <div><Label>Photo type</Label><select aria-label="Photo type" value={category} onChange={e=>setCategory(e.target.value as typeof category)} disabled={busy}><option value="before">Before</option><option value="after">After</option><option value="property">Property / damage</option></select></div>
   {knownJobs.some(job=>job.customerId===customerId)&&<div><Label>Attach to job (optional)</Label><select aria-label="Attach photo to job" value={selectedJobId} onChange={e=>setSelectedJobId(e.target.value)} disabled={busy}><option value="">Customer photos only</option>{knownJobs.filter(job=>job.customerId===customerId).map(job=><option key={job.id} value={job.id}>{job.label||'Saved job'}</option>)}</select></div>}
   <div className="photo-caption"><Label>Optional note</Label><Input value={caption} disabled={busy} onChange={e=>setCaption(e.target.value)} placeholder="North siding, water damage…"/></div>
   <div className="photo-buttons"><Button disabled={busy||loading||needsReview||!safetyReady} className="brand-button" onClick={()=>cameraRef.current?.click()}><Camera className="h-4 w-4"/>Camera</Button><Button disabled={busy||loading||needsReview||!safetyReady} variant="outline" onClick={()=>libraryRef.current?.click()}><Images className="h-4 w-4"/>Photo library</Button></div>
  </div>
  <input ref={cameraRef} className="photo-input" type="file" accept="image/*" capture="environment" onChange={e=>void add(e.target.files)}/>
  <input ref={libraryRef} className="photo-input" type="file" accept="image/*" multiple onChange={e=>void add(e.target.files)}/>
  <div className="photo-backup-passphrase">
   <Label>Private recovery passphrase (16–1024 characters)</Label>
   <Input type="password" aria-label="Photo backup recovery passphrase" autoComplete="off" value={backupPassphrase} maxLength={1024} disabled={busy} onChange={e=>setBackupPassphrase(e.target.value)} placeholder="Enter passphrase to protect, verify or restore"/>
   <Label>Confirm passphrase (only for a new protected backup)</Label>
   <Input type="password" aria-label="Confirm new photo backup passphrase" autoComplete="off" value={confirmBackupPassphrase} maxLength={1024} disabled={busy} onChange={e=>setConfirmBackupPassphrase(e.target.value)} placeholder="Repeat passphrase for new backup"/>
   <p className="payment-handle-note">Keep the passphrase privately in a password manager, separate from the protected backup file. FIRE cannot reset it.</p>
  </div>
  <div className="photo-buttons photo-backup-primary">
   <Button variant="outline" disabled={busy||loading} onClick={()=>void prepareArchive("all",true)}><Download className="h-4 w-4"/>Prepare protected all-photos backup</Button>
   {preparedBackup&&<Button variant="outline" disabled={busy||loading} onClick={()=>void savePreparedArchive()}><Upload className="h-4 w-4"/>Save prepared backup to Files</Button>}
   <Button variant="outline" disabled={busy||loading} onClick={()=>verifyRef.current?.click()}><Images className="h-4 w-4"/>Verify saved photo backup</Button>
  </div>
  <details className="photo-backup-more">
   <summary>More photo backup tools</summary>
   <div className="photo-buttons">
    <Button variant="outline" disabled={busy||loading} onClick={()=>void prepareArchive("customer",true)}><Download className="h-4 w-4"/>Protect this customer’s photos</Button>
    <Button variant="outline" disabled={busy||loading} onClick={()=>void prepareArchive("all",false)}><Download className="h-4 w-4"/>Legacy unencrypted all-photos ZIP</Button>
    <Button variant="outline" disabled={busy||loading} onClick={()=>void prepareArchive("customer",false)}><Download className="h-4 w-4"/>Legacy unencrypted this customer’s photos ZIP</Button>
    {preparedBackup&&<Button variant="outline" disabled={busy||loading} onClick={downloadPreparedArchive}><Download className="h-4 w-4"/>Download prepared backup</Button>}
    <Button variant="outline" disabled={busy||loading||needsReview||!safetyReady} onClick={()=>restoreRef.current?.click()}><Upload className="h-4 w-4"/>Restore verified photo backup</Button>
   </div>
  </details>
  <input ref={verifyRef} className="photo-input" type="file" accept=".firephotos,.zip,application/zip,application/octet-stream" onChange={e=>void verifySavedArchive(e.target.files)}/>
  <input ref={restoreRef} className="photo-input" type="file" accept=".firephotos,.zip,application/zip,application/octet-stream" onChange={e=>void restore(e.target.files)}/>
  {needsReview&&<div role="alert" className="save-error"><p>Photo changes are paused because the last result was not confirmed. Keep original images and backup files.</p>
   {allCustomerRestoreReview&&<p><strong>Interrupted multi-customer restore:</strong> Photos for OTHER customers may have been saved before the interruption. Refresh the whole library and review each customer gallery, not just this page. Do not repeat the restore automatically; keep and verify the original ZIP.</p>}
   <Button variant="outline" disabled={busy} onClick={()=>void refreshForReview()}>Refresh saved photos for review</Button>
   <Button variant="outline" disabled={busy||!reviewLoaded} onClick={()=>void allowChanges()}>I reviewed saved photos; allow new changes</Button>
  </div>}
  {error&&<p className="save-error" role="alert">{error}</p>}{message&&<p className="save-success" role="status">{message}</p>}
  {loading?<p>Opening saved photos on this device…</p>:items.length===0?<div className="record-empty"><Camera/><strong>No on-device photos for this customer</strong><p>Use Camera or Photo library. No photos are uploaded to Cloudflare.</p></div>:<div className="photo-groups">
   {(['before','after','property'] as const).map(kind=>{
    const matches=items.filter(x=>x.photo.category===kind);if(!matches.length)return null;
    return <section key={kind}><header><strong>{kind==='property'?'Property / damage':kind==='before'?'Before':'After'}</strong><span>{matches.length}</span></header>
     <div className="photo-grid">{matches.map(({photo,url})=><article className="photo-card" key={photo.id}>
      <a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" alt={photo.caption||photo.filename}/></a>
      <div><p>{photo.caption||photo.filename}</p><small>{new Date(photo.createdAt).toLocaleDateString()}</small>{photo.jobId&&<small>Job: {knownJobs.find(job=>job.id===photo.jobId&&job.customerId===photo.customerId)?.label||'Check restored job records'}</small>}</div>
      <button disabled={busy||needsReview||!safetyReady} type="button" aria-label="Delete on-device photo" onClick={()=>void remove(photo)}><Trash2/></button>
     </article>)}</div>
    </section>;
   })}
  </div>}
  {before.length>0&&after.length>0&&<details className="photo-comparison-more"><summary>Before &amp; after comparison</summary><section className="before-after-builder"><header><div><p>Create a shareable comparison from photos stored on this device.</p></div><Images/></header>
   <div><label><span>Before</span><select value={selectedBefore?.photo.id??''} disabled={busy} onChange={e=>setBeforeId(e.target.value)}>{before.map(x=><option key={x.photo.id} value={x.photo.id}>{x.photo.caption||x.photo.filename}</option>)}</select></label>
   <label><span>After</span><select value={selectedAfter?.photo.id??''} disabled={busy||compatibleAfter.length===0} onChange={e=>setAfterId(e.target.value)}>{compatibleAfter.length?compatibleAfter.map(x=><option key={x.photo.id} value={x.photo.id}>{x.photo.caption||x.photo.filename}</option>):<option value="">No matching AFTER photo</option>}</select></label>
   <Button disabled={busy||!selectedAfter} className="brand-button" onClick={()=>void comparison()}><Download className="h-4 w-4"/>Create comparison</Button>
    {readyComparison&&<Button disabled={busy} variant="outline" onClick={()=>void savePreparedComparison()}><Upload className="h-4 w-4"/>Save or share comparison</Button>}</div>
   {!selectedAfter&&<p role="status">No AFTER photo matches this saved job. Choose another BEFORE photo or add an AFTER original for the same job.</p>}
   <div className="before-after-preview"><figure><img src={selectedBefore?.url} alt="Selected before"/><figcaption>Before</figcaption></figure>{selectedAfter&&<figure><img src={selectedAfter.url} alt="Selected after"/><figcaption>After</figcaption></figure>}</div>
  </section></details>}
 </section>;
}
