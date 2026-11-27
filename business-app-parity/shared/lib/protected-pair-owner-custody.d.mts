/** SOURCE ONLY: saved FIRE records+photo encrypted pair, never Gate7 acceptance. */
export interface PreparedProtectedPair {
 readonly format:'fire-browser-protected-recovery-pair-prepared';readonly version:1;
 readonly filename:string;readonly blob:Blob;readonly sha256:string;
 readonly recordsFile:Blob;readonly photosFile:Blob;
 readonly receipt:Record<string,unknown>;
 readonly sourceCustomers:number;readonly sourcePhotos:number;readonly sourceNumberedJobs:number;
 readonly sourceMigrationCount:number;readonly verifiedRecordsAndPhotoOwnership:true;
 readonly encryptedOriginalFilesMatched:true;readonly savedReceiptVerified:false;
 readonly offDeviceCustodyVerified:false;readonly sameInstantSourceSnapshotVerified:false;
 readonly isolatedRestoreVerified:false;readonly gate7Accepted:false;
}
export declare function prepareBrowserProtectedPairReceipt(
 recordsFile:Blob,recordsPhrase:string,photosFile:Blob,photosPhrase:string,
 readVerifiedPhotoZip:(zip:Blob)=>Promise<Array<{
  id:string;customerId:string;category:'before'|'after'|'property';caption:string;
  filename:string;contentType:string;sizeBytes:number;createdAt:string;blob:Blob;
 }>>,
 now?:Date
):Promise<PreparedProtectedPair>;
export declare function verifySelectedBrowserProtectedPairReceipt(
 prepared:PreparedProtectedPair,savedReceipt:Blob
):Promise<{
 exactSavedPairReceiptVerified:true;originalEncryptedRecordsAndPhotosUnchanged:true;
 recordsAndPhotoOwnershipSourceReviewed:true;sourceMigrationCount:number;
 sourcePhotoCount:number;offDeviceCustodyVerified:false;
 sameInstantSourceSnapshotVerified:false;realPhysicalRestorationVerified:false;
 gate7Accepted:false;remoteWritesPerformed:false;
}>;
export declare function validateBrowserProtectedPairReceipt(receipt:unknown):Record<string,unknown>;
