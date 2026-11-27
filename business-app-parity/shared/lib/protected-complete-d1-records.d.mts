/** SOURCE ONLY. Browser FIRERB01 records-only archive, not photo or Gate7 proof. */
export interface CompleteD1RecordsReview {
 format:'fire-full-d1-records-review';version:1;
 schemaIdentity:Record<string,unknown>;
 core:{schemaIdentity:Record<string,unknown>;tables:Record<string,Array<Record<string,unknown>>>;rowCounts:Record<string,number>};
 supplemental:{schemaIdentity:Record<string,unknown>;tables:Record<string,Array<Record<string,unknown>>>;rowCounts:Record<string,number>};
 allReviewedRecordTablesIncluded:true;sourceTables:number;sourceRowCount:number;
 isEncrypted:false;completeBackup:false;
 actualProviderSourceIdentityVerified:false;offDeviceCustodyVerified:false;
 photoBytesIncluded:false;isolatedPhysicalRestoreVerified:false;
 gate7Accepted:false;cloudflareWritesPerformed:false;
}
export interface PreparedCompleteD1OwnerFile {
 readonly format:'fire-protected-complete-d1-owner-file';
 readonly version:1;readonly blob:Blob;readonly sha256:string;
 readonly sizeBytes:number;readonly filename:string;
 readonly inMemoryEncryptionVerified:true;readonly savedFileReadBackVerified:false;
 readonly offDeviceCustodyVerified:false;readonly photoBytesIncluded:false;
 readonly isolatedD1RestoreVerified:false;readonly gate7Accepted:false;
}
export declare function validateCompleteReviewedD1Archive(review:CompleteD1RecordsReview):{
 core:Record<string,unknown>;extra:Record<string,unknown>;
 schemaIdentity:Record<string,unknown>;sourceTables:number;
 sourceRowCount:number;migrationCount:number;
};
export declare function protectCompleteReviewedD1Records(
 review:CompleteD1RecordsReview,phrase:string
):Promise<Blob>;
export declare function verifyProtectedCompleteReviewedD1Records(
 file:Blob,phrase:string
):Promise<{core:Record<string,unknown>;supplemental:Record<string,unknown>;
 sourceTables:number;migrationCount:number;gate7Accepted:false;
 photoBytesIncluded:false;offDeviceCustodyVerified:false}>;
export declare function prepareCompleteD1OwnerFile(
 review:CompleteD1RecordsReview,phrase:string,confirmation:string,now?:Date
):Promise<PreparedCompleteD1OwnerFile>;
/** Shape-only owner saved-file re-entry guard; never authenticates a phrase. */
export declare function ownerSavedRecordsPassphraseReady(
 prepared:PreparedCompleteD1OwnerFile|null,phrase:string
):boolean;
export declare function verifySelectedSavedCompleteD1OwnerFile(
 prepared:PreparedCompleteD1OwnerFile,saved:Blob,phrase:string
):Promise<{selectedCiphertextIdentical:true;
 completeReviewedD1RecordsAuthenticated:true;sourceTables:number;
 migrationCount:number;gate7Accepted:false;originalPhotoBytesIncluded:false;
 offDeviceCustodyVerified:false}>;
