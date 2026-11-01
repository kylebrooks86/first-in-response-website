export interface AccessConfig {
  teamDomain:string;
  audience:string;
  ownerEmail:string;
  origin?:string;
}
export interface AccessIdentity {
  userId:string;
  displayName:string;
  email:string;
  fullName:null;
}
export function verifyFireAccessJWT(
  token:string|null,
  config:AccessConfig,
  options?:{
    fetcher?:typeof fetch;
    subtle?:SubtleCrypto;
    now?:number;
  }
):Promise<AccessIdentity|null>;
