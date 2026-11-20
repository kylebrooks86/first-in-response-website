// Gate 7/8 offline-photo fallback policy.
// An unreachable backend may show a PREVIOUSLY AUTHENTICATED local photo-only
// directory. Explicit owner authorization failures must never fall back.
export function mayUseOfflinePhotoDirectory(options:{
  networkFailed:boolean;
  responseStatus?:number;
  browserReportsOffline:boolean;
}):boolean{
  if(options.responseStatus===401||options.responseStatus===403)return false;
  if(options.networkFailed||options.browserReportsOffline)return true;
  return options.responseStatus===502||options.responseStatus===503||options.responseStatus===504;
}
export function mustClearOfflinePhotoDirectory(status:number):boolean{
  return status===401||status===403;
}
