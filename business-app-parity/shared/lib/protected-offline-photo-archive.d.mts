/** Protected opaque FIRE photo ZIP: WebCrypto only, no network. */
export function isProtectedOfflinePhotoArchive(file:Blob):Promise<boolean>;
export function protectOfflinePhotoZip(zip:Blob,phrase:string):Promise<Blob>;
export function recoverProtectedOfflinePhotoZip(file:Blob,phrase:string):Promise<Blob>;
export function openOwnerOfflinePhotoArchive(file:Blob,phrase:string):Promise<Blob>;
