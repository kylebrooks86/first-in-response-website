// Diagnostic-only, NON-AUTHORIZING probe for a FIRE-A10 failed Access JWT.
// Codes distinguish Cloudflare JWKS fetch, kid, WebCrypto import and signature.
// No token, header, claim, key, audience, email or URL is returned to the UI.
// This module MUST NOT be used for permitting or bypassing access.
const CODES=Object.freeze({
  fetch:"FIRE-A11-CERTS-FETCH",
  shape:"FIRE-A12-CERTS-FORMAT",
  kid:"FIRE-A13-SIGNING-KEY",
  import:"FIRE-A14-KEY-IMPORT",
  crypto:"FIRE-A15-CRYPTO-ERROR",
  signature:"FIRE-A16-SIGNATURE",
  verified:"FIRE-A17-VERIFY-MISMATCH"
});
const b64url=(value)=>{
  if(typeof value!=="string"||value.length>10000||!/^[A-Za-z0-9_-]+$/.test(value))throw Error("Invalid encoding");
  const p=value.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(p+"=".repeat((4-p.length%4)%4)),x=>x.charCodeAt(0));
};
export async function probeFireAccessCrypto(token,config,{fetcher=fetch,subtle=crypto.subtle}={}){
  if(typeof token!=="string"||typeof config?.teamDomain!=="string")return CODES.shape;
  const parts=token.split(".");
  if(parts.length!==3)return CODES.shape;
  let header;
  try{
    header=JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    if(header?.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length<8||header.kid.length>160)return CODES.shape;
  }catch{return CODES.shape;}
  let response;
  try{
    response=await fetcher("https://"+config.teamDomain+"/cdn-cgi/access/certs",
      {redirect:"error",headers:{accept:"application/json"}});
    if(!response?.ok)return CODES.fetch;
  }catch{return CODES.fetch;}
  let keys;
  try{
    const doc=await response.json();
    if(!Array.isArray(doc?.keys)||doc.keys.length>10||doc.keys.length===0)return CODES.shape;
    keys=doc.keys;
  }catch{return CODES.shape;}
  const key=keys.find(k=>k&&k.kid===header.kid&&k.kty==="RSA"&&typeof k.n==="string"
    &&typeof k.e==="string"&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
  if(!key)return CODES.kid;
  let imported;
  try{
    imported=await subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  }catch{return CODES.import;}
  let ok;
  try{
    const sig=b64url(parts[2]);
    ok=await subtle.verify("RSASSA-PKCS1-v1_5",imported,sig,
      new TextEncoder().encode(parts[0]+"."+parts[1]));
  }catch{return CODES.crypto;}
  return ok?CODES.verified:CODES.signature;
}
