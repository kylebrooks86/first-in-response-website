/** Review-only all-table D1 capture; never a complete encrypted photo backup. */
export declare function captureCompleteReviewedD1RecordsReadOnly(
 db:D1Database,
 options?:{customerProperties?:boolean;serviceLocations?:boolean}
):Promise<{
 format:'fire-full-d1-records-review';version:1;
 allReviewedRecordTablesIncluded:true;
 sourceTables:number;sourceRowCount:number;
 core:Record<string,unknown>;
 supplemental:Record<string,unknown>;
 schemaIdentity:Record<string,unknown>;
 completeBackup:false;photoBytesIncluded:false;
 offDeviceCustodyVerified:false;isolatedPhysicalRestoreVerified:false;
 actualProviderSourceIdentityVerified:false;cloudflareWritesPerformed:false;
 gate7Accepted:false;isEncrypted:false;
}>;
