import {readOfflinePhotoBackup} from './offline-photo-backup';
import {listOfflinePhotos,exactSavedPhotoMatch} from './local-photo-vault';

export type PhotoBackupInspection={
 archivePhotoCount:number;byteIdenticalOnDevice:number;notYetOnDevice:number;
 localPhotosNotInArchive:number;verifiedArchiveBytes:number;
};
// Reads a ZIP chosen BACK from Apple Files by the owner. Unlike checking a
// prepared in-memory ZIP, this demonstrates that the saved copy is readable.
// No local photo edits, upload, camera permission or Cloudflare call occurs.
export async function inspectSavedOfflinePhotoZip(file:Blob,knownCustomerIds:string[]):Promise<PhotoBackupInspection>{
 const archive=await readOfflinePhotoBackup(file);
 if(!archive.length)throw Error('This ZIP contains no photo records.');
 const known=new Set(knownCustomerIds);
 if(archive.some(photo=>!known.has(photo.customerId)))
   throw Error('Saved ZIP includes customer IDs unavailable in FIRE. Restore the matching customer records before using this archive.');
 const onDevice=await listOfflinePhotos();
 const current=new Map(onDevice.map(photo=>[photo.id,photo]));
 const included=new Set(archive.map(photo=>photo.id));
 let byteIdenticalOnDevice=0,notYetOnDevice=0;
 for(const photo of archive){
  const stored=current.get(photo.id);
  if(!stored){notYetOnDevice++;continue;}
  if(!await exactSavedPhotoMatch(stored,photo))
   throw Error('Backup has a photo ID that conflicts with different bytes or metadata on this device. Do not overwrite the originals.');
  byteIdenticalOnDevice++;
 }
 return {
  archivePhotoCount:archive.length,
  byteIdenticalOnDevice,notYetOnDevice,
  localPhotosNotInArchive:onDevice.filter(photo=>!included.has(photo.id)).length,
  verifiedArchiveBytes:file.size
 };
}
