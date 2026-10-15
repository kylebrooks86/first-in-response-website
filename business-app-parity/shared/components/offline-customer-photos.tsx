"use client";

import {useEffect,useRef,useState} from 'react';
import {Camera,Download,Images,Trash2,Upload} from 'lucide-react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {addOfflinePhoto,listOfflinePhotos,removeOfflinePhoto,exportLocalPhotos,restoreLocalPhotos} from '../lib/local-photo-vault';
import type {OfflinePhoto} from '../lib/offline-photo-backup';

type Preview={photo:OfflinePhoto;url:string};
export function OfflineCustomerPhotos({customerId,customerName,knownCustomerIds,legacyCloudPhotoCount=0}:{customerId:string;customerName:string;knownCustomerIds:string[];legacyCloudPhotoCount?:number}){
 const [items,setItems]=useState<Preview[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [preparedBackup,setPreparedBackup]=useState<File|null>(null);
 const [category,setCategory]=useState<'before'|'after'|'property'>('before'),[caption,setCaption]=useState('');
 const [beforeId,setBeforeId]=useState(''),[afterId,setAfterId]=useState('');
 const cameraRef=useRef<HTMLInputElement>(null),libraryRef=useRef<HTMLInputElement>(null),restoreRef=useRef<HTMLInputElement>(null);
 const active=useRef(false);
 const refresh=async()=>{
  const rows=await listOfflinePhotos(customerId);
  const next=rows.map(photo=>({photo,url:URL.createObjectURL(photo.blob)}));
  setItems(next);return next.length;
 };
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError('');setItems([]);
  listOfflinePhotos(customerId).then(rows=>{
   if(cancelled)return;
   setItems(rows.map(photo=>({photo,url:URL.createObjectURL(photo.blob)})));
  }).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not open this device’s photo vault.');})
  .finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[customerId]);
 useEffect(()=>()=>{for(const item of items)URL.revokeObjectURL(item.url);},[items]);
 const add=async(files:FileList|null)=>{
  if(!files?.length||active.current)return;
  active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  try{
   for(const file of Array.from(files))await addOfflinePhoto(customerId,category,caption,file);
   await refresh();setCaption('');
   setMessage('Photos verified on this device. They are NOT backed up yet; export a ZIP to Files/iCloud.');
  }catch(err){setError((err instanceof Error?err.message:'Photo save failed.')+' Review the list before retrying.');try{await refresh();}catch{}}
  finally{active.current=false;setBusy(false);if(cameraRef.current)cameraRef.current.value='';if(libraryRef.current)libraryRef.current.value='';}
 };
 const remove=async(photo:OfflinePhoto)=>{
  if(active.current||!window.confirm('Delete this on-device photo? This cannot be undone without a separate backup.'))return;
  active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  try{await removeOfflinePhoto(photo.id,customerId);await refresh();setMessage('Photo removed from this device. An older exported ZIP is unchanged.');}
  catch(err){setError(err instanceof Error?err.message:'Could not verify photo removal.');try{await refresh();}catch{}}
  finally{active.current=false;setBusy(false);}
 };
 // iOS Safari requires an active user gesture for navigator.share(). Preparing
 // a ZIP first and THEN trying to share after awaits loses that gesture.
 // Step 1 prepares/verifies asynchronously; step 2 opens sharing immediately
 // inside a new actual button click, before the first await.
 const prepareArchive=async(scope:'all'|'customer')=>{
  if(active.current)return;active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  try{
   const zip=await exportLocalPhotos(scope==='customer'?customerId:undefined);
   const filename='FIRE-'+(scope==='customer'?'customer-'+customerId:'all')+'-photos-'+new Date().toISOString().slice(0,10)+'.zip';
   const file=new File([zip],filename,{type:'application/zip'});
   setPreparedBackup(file);
   setMessage((scope==='customer'?'This customer’s':'All customers’')+' photo ZIP passed integrity checks and is READY. Tap Save prepared ZIP to Files or Download prepared ZIP. Backups are not complete until you confirm the file exists in Files or iCloud.');
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
   setMessage('ZIP download offered. Check Files/Downloads and verify the file before considering photos backed up.');
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
   setMessage('Photo ZIP was offered to the iOS share sheet. Confirm it exists in Files or iCloud Drive before treating it as backed up. Keep original photos too.');
  }catch(err){
   if(err instanceof Error&&err.name==='AbortError')setMessage('Saving was cancelled. Your prepared ZIP is still available; photos are NOT backed up.');
   else setError('iOS could not open the share sheet. Try Download prepared ZIP below; your prepared archive has not been erased.');
  }finally{active.current=false;setBusy(false);}
 };
 const restore=async(files:FileList|null)=>{
  if(!files?.length||active.current)return;
  if(!window.confirm('Restore this photo ZIP? FIRE will check all photos and customer IDs. Existing photos will NOT be overwritten. Restore matching customer records first.'))return;
  active.current=true;setBusy(true);setError('');setMessage('');setPreparedBackup(null);
  try{
   const count=await restoreLocalPhotos(files[0],knownCustomerIds);
   await refresh();setMessage('Restored '+count+' verified photos. Keep the original archive for recovery.');
  }catch(err){setError(err instanceof Error?err.message:'Photo restore failed safely. No existing photos were replaced.');}
  finally{active.current=false;setBusy(false);if(restoreRef.current)restoreRef.current.value='';}
 };
 const before=items.filter(item=>item.photo.category==='before');
 const after=items.filter(item=>item.photo.category==='after');
 const selectedBefore=before.find(item=>item.photo.id===(beforeId||before[0]?.photo.id));
 const selectedAfter=after.find(item=>item.photo.id===(afterId||after[0]?.photo.id));
 const comparison=async()=>{
  if(!selectedBefore||!selectedAfter||active.current)return;
  active.current=true;setBusy(true);setError('');setMessage('');
  try{
   const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Photo cannot be decoded by this browser.'));image.src=url;
   });
   const [a,b]=await Promise.all([load(selectedBefore.url),load(selectedAfter.url)]);
   const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=980;
   const context=canvas.getContext('2d');if(!context)throw Error('Image comparison is unavailable.');
   const draw=(img:HTMLImageElement,x:number)=>{const ratio=Math.max(796/img.naturalWidth,870/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;context.drawImage(img,x+(796-w)/2,(870-h)/2,w,h);};
   context.fillStyle='#10213a';context.fillRect(0,0,1600,980);draw(a,0);draw(b,804);
   context.fillStyle='#10213a';context.fillRect(0,0,796,70);context.fillRect(804,0,796,70);
   context.fillStyle='white';context.textAlign='center';context.font='bold 30px sans-serif';context.fillText('BEFORE',398,46);context.fillText('AFTER',1202,46);
   context.textAlign='left';context.font='bold 27px sans-serif';context.fillText('FIRST IN RESPONSE EXTERIORS',35,930);
   context.textAlign='right';context.font='22px sans-serif';context.fillText(customerName,1560,930);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not create comparison.')),'image/png'));
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='FIRE-before-after.png';link.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
   setMessage('Before/after comparison offered for download. Keep the originals in your photo backup.');
  }catch(err){setError(err instanceof Error?err.message:'Comparison failed.');}
  finally{active.current=false;setBusy(false);}
 };
 return <section className="photo-panel" aria-label="On-device customer photos">
  <header><strong>Private on-device photos</strong><p>Stored only in this device’s FIRE Home Screen/browser storage. No R2 subscription or automatic syncing.</p></header>
  <p className="payment-handle-note"><strong>Backup required:</strong> iPhone app deletion, storage clearing, or device failure can erase these photos. Keep originals in Apple Photos and export ZIP backups to Files/iCloud Drive. Export includes local photos from this FIRE candidate only, not older hosted R2 images.</p>
  {legacyCloudPhotoCount>0&&<p role="alert" className="save-error">{legacyCloudPhotoCount} older hosted photo record(s) remain associated with this customer. The new on-device gallery and ZIP backup do not include those bytes. No existing hosted records were deleted or migrated. Preserve the old cloud archive separately before considering its storage retired.</p>}
  <div className="photo-toolbar">
   <div><Label>Photo type</Label><select aria-label="Photo type" value={category} onChange={e=>setCategory(e.target.value as typeof category)} disabled={busy}><option value="before">Before</option><option value="after">After</option><option value="property">Property / damage</option></select></div>
   <div className="photo-caption"><Label>Optional note</Label><Input value={caption} disabled={busy} onChange={e=>setCaption(e.target.value)} placeholder="North siding, water damage…"/></div>
   <div className="photo-buttons"><Button disabled={busy||loading} className="brand-button" onClick={()=>cameraRef.current?.click()}><Camera className="h-4 w-4"/>Camera</Button><Button disabled={busy||loading} variant="outline" onClick={()=>libraryRef.current?.click()}><Images className="h-4 w-4"/>Photo library</Button></div>
  </div>
  <input ref={cameraRef} className="photo-input" type="file" accept="image/*" capture="environment" onChange={e=>void add(e.target.files)}/>
  <input ref={libraryRef} className="photo-input" type="file" accept="image/*" multiple onChange={e=>void add(e.target.files)}/>
  <div className="photo-buttons">
   <Button variant="outline" disabled={busy||loading} onClick={()=>void prepareArchive('all')}><Download className="h-4 w-4"/>Prepare all local photos ZIP</Button>
   <Button variant="outline" disabled={busy||loading} onClick={()=>void prepareArchive('customer')}><Download className="h-4 w-4"/>Prepare this customer's photos ZIP</Button>
   {preparedBackup&&<><Button variant="outline" disabled={busy||loading} onClick={()=>void savePreparedArchive()}><Upload className="h-4 w-4"/>Save prepared ZIP to Files</Button>
    <Button variant="outline" disabled={busy||loading} onClick={downloadPreparedArchive}><Download className="h-4 w-4"/>Download prepared ZIP</Button></>}
   <Button variant="outline" disabled={busy||loading} onClick={()=>restoreRef.current?.click()}><Upload className="h-4 w-4"/>Restore verified photo ZIP</Button>
  </div>
  <input ref={restoreRef} className="photo-input" type="file" accept=".zip,application/zip" onChange={e=>void restore(e.target.files)}/>
  {error&&<p className="save-error" role="alert">{error}</p>}{message&&<p className="save-success" role="status">{message}</p>}
  {loading?<p>Opening saved photos on this device…</p>:items.length===0?<div className="record-empty"><Camera/><strong>No on-device photos for this customer</strong><p>Use Camera or Photo library. No photos are uploaded to Cloudflare.</p></div>:<div className="photo-groups">
   {(['before','after','property'] as const).map(kind=>{
    const matches=items.filter(x=>x.photo.category===kind);if(!matches.length)return null;
    return <section key={kind}><header><strong>{kind==='property'?'Property / damage':kind==='before'?'Before':'After'}</strong><span>{matches.length}</span></header>
     <div className="photo-grid">{matches.map(({photo,url})=><article className="photo-card" key={photo.id}>
      <a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" alt={photo.caption||photo.filename}/></a>
      <div><p>{photo.caption||photo.filename}</p><small>{new Date(photo.createdAt).toLocaleDateString()}</small></div>
      <button disabled={busy} type="button" aria-label="Delete on-device photo" onClick={()=>void remove(photo)}><Trash2/></button>
     </article>)}</div>
    </section>;
   })}
  </div>}
  {before.length>0&&after.length>0&&<section className="before-after-builder"><header><div><strong>Before &amp; after comparison</strong><p>Create a shareable comparison from photos stored on this device.</p></div><Images/></header>
   <div><label><span>Before</span><select value={selectedBefore?.photo.id??''} disabled={busy} onChange={e=>setBeforeId(e.target.value)}>{before.map(x=><option key={x.photo.id} value={x.photo.id}>{x.photo.caption||x.photo.filename}</option>)}</select></label>
   <label><span>After</span><select value={selectedAfter?.photo.id??''} disabled={busy} onChange={e=>setAfterId(e.target.value)}>{after.map(x=><option key={x.photo.id} value={x.photo.id}>{x.photo.caption||x.photo.filename}</option>)}</select></label>
   <Button disabled={busy} className="brand-button" onClick={()=>void comparison()}><Download className="h-4 w-4"/>Create comparison</Button></div>
   <div className="before-after-preview"><figure><img src={selectedBefore?.url} alt="Selected before"/><figcaption>Before</figcaption></figure><figure><img src={selectedAfter?.url} alt="Selected after"/><figcaption>After</figcaption></figure></div>
  </section>}
 </section>;
}
