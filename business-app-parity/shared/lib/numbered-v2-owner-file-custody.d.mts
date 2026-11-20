/** SOURCE ONLY: verified encrypted 23-table CORE records files.
 * These receipts NEVER establish off-device custody or Gate 7 acceptance.
 */
export interface NumberedCoreSnapshot {
 format:'fire-numbered-core-records-snapshot';
 version:2;
 allTablesComplete:true;
 truncated:false;
 tables:Record<string,Record<string,unknown>[]>;
 rowCounts:Record<string,number>;
 highWater:{customer:number;job:number};
}
export interface PreparedNumberedCoreOwnerFile {
 readonly blob:Blob;
 readonly filename:string;
 readonly sha256:string;
 readonly sizeBytes:number;
 readonly format:'fire-numbered-v2-owner-file-prepared';
 readonly version:1;
 readonly preparedAndDecryptedInMemory:true;
 readonly savedFileReadbackVerified:false;
 readonly offDeviceCustodyVerified:false;
 readonly photoBytesIncluded:false;
 readonly supplementalTableCoverageVerified:false;
 readonly isolatedRestoreVerified:false;
 readonly gate7Accepted:false;
}
export interface VerifiedSavedNumberedCoreFile {
 readonly format:'fire-numbered-v2-owner-file-readback';
 readonly version:1;
 readonly encryptedFileSha256:string;
 readonly byteLength:number;
 readonly numberOfCoreTables:20;
 readonly numberOfPermanentIdentityTables:3;
 readonly selectedSavedFileByteIdentical:true;
 readonly savedFileAuthenticatedAndCoreValidated:true;
 readonly sourceAndSavedRecordContentIdentical:true;
 readonly independentOffDeviceCustodyVerified:false;
 readonly sameInstantPhotoPairVerified:false;
 readonly supplementalSchemaCoverageVerified:false;
 readonly isolatedRestoreVerified:false;
 readonly hostedProviderIdentityVerified:false;
 readonly gate7Accepted:false;
 readonly remoteWritesPerformed:false;
}
export function prepareNumberedV2OwnerFile(
 snapshot:NumberedCoreSnapshot,passphrase:string,confirmation:string,now?:Date
):Promise<PreparedNumberedCoreOwnerFile>;
export function verifySavedNumberedV2OwnerFile(
 prepared:PreparedNumberedCoreOwnerFile,saved:Blob,passphrase:string
):Promise<VerifiedSavedNumberedCoreFile>;
export function inspectExistingProtectedNumberedV2File(file:Blob,passphrase:string):Promise<{
 format:'fire-numbered-v2-owner-file-inspection';
 version:1;encryptedFileSha256:string;numberedCoreValidated:boolean;
 currentSourceSnapshotCompared:false;offDeviceCustodyVerified:false;photoBytesIncluded:false;
 supplementalSchemaCoverageVerified:false;isolatedRestoreVerified:false;
 gate7Accepted:false;remoteWritesPerformed:false;
}>;
