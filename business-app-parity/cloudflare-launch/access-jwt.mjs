// Cloudflare Access signed-token verification, fail-closed for independent FIRE Workers.
// Public-key snapshot fallback is TEMPORARY (14-day max). Real production needs
// confirmed durable live JWKS fetch or periodic rotation handling.
import {pinnedAccessPublicKeys} from "./access-public-keys.mjs";
const KEY_TTL_MS=10*60*1000;
const PINNED_MAX_AGE_MS=14*24*60*60*1000;
const keysCache=new Map();
function b64url(input) {
  if(typeof input!=="string"||!/^[A-Za-z0-9_-]+$/.test(input)||input.length>10000)throw Error("Invalid token encoding");
  const value=input.replace(/-/g,"+").replace(/_/g,"/");
  const bin=atob(value+"=".repeat((4-value.length%4)%4));
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
function parseJSON(segment) {
  return JSON.parse(new TextDecoder().decode(b64url(segment)));
}
function configOK(c){
  return c&&typeof c.teamDomain==="string"&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(c.teamDomain)
    &&typeof c.audience==="string"&&/^[A-Za-z0-9_-]{20,128}$/.test(c.audience)
    &&typeof c.ownerEmail==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.ownerEmail)
    &&c.ownerEmail===c.ownerEmail.trim().toLowerCase();
}
function validJwk(k) {
  const permitted=["kid","kty","alg","use","e","n","key_ops","ext"];
  return k&&typeof k==="object"&&!Array.isArray(k)
    &&Object.keys(k).every(x=>permitted.includes(x))
    &&(k.key_ops===undefined||Array.isArray(k.key_ops)&&k.key_ops.length===1&&k.key_ops[0]==="verify")
    &&(k.ext===undefined||k.ext===true||k.ext===false)
    &&k.kty==="RSA"&&(k.alg===undefined||k.alg==="RS256")
    &&(k.use===undefined||k.use==="sig")
    &&typeof k.kid==="string"&&k.kid.length>=8&&k.kid.length<160
    &&typeof k.n==="string"&&/^[A-Za-z0-9_-]{256,1024}$/.test(k.n)
    &&typeof k.e==="string"&&/^[A-Za-z0-9_-]{2,12}$/.test(k.e);
}
function safePinnedKeys(snapshot,domain) {
  if(!snapshot||snapshot.teamDomain!==domain||!Number.isSafeInteger(snapshot.fetchedAt)
    ||snapshot.fetchedAt>Date.now()+60000
    ||Date.now()-snapshot.fetchedAt>PINNED_MAX_AGE_MS
    ||!Array.isArray(snapshot.keys)||snapshot.keys.length<1||snapshot.keys.length>5
    ||!snapshot.keys.every(validJwk))return [];
  const kidSet=new Set(snapshot.keys.map(k=>k.kid));
  return kidSet.size===snapshot.keys.length?snapshot.keys:[];
}
async function signingKey(teamDomain,kid,fetcher,snapshot) {
  const origin="https://"+teamDomain;
  const cached=keysCache.get(origin);
  if(cached&&cached.expires>Date.now()&&cached.keys.some(k=>k.kid===kid))
    return cached.keys.find(k=>k.kid===kid);
  let keys;
  try {
    const response=await fetcher(origin+"/cdn-cgi/access/certs",{
      redirect:"error",headers:{accept:"application/json"}});
    if(!response.ok)throw Error("Access JWKS unavailable");
    const doc=await response.json();
    if(!Array.isArray(doc?.keys)||doc.keys.length<1||doc.keys.length>10
       ||!doc.keys.every(validJwk))throw Error("Invalid Access JWKS");
    keys=doc.keys;
  } catch {
    // Never trust an unsigned identity. This is a locally bundled copy of
    // the public keys fetched over HTTPS from the exact, fixed team hostname
    // by the operator during the build. Every JWT still gets RS256 verified.
    keys=safePinnedKeys(snapshot,teamDomain);
  }
  if(!keys?.length)return null;
  keysCache.set(origin,{keys,expires:Date.now()+KEY_TTL_MS});
  return keys.find(k=>k.kid===kid)||null;
}
export async function verifyFireAccessJWT(token,config,{fetcher=fetch,subtle=crypto.subtle,now=Math.floor(Date.now()/1000),pinnedSnapshot=pinnedAccessPublicKeys}={}){
  if(!configOK(config)||typeof token!=="string"||token.length>8192||token.length<60)return null;
  try{
    const segments=token.split(".");
    if(segments.length!==3)return null;
    const header=parseJSON(segments[0]),claims=parseJSON(segments[1]);
    if(!header||header.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>160
      ||(header.typ&&header.typ!=="JWT")||!claims)return null;
    const issuer="https://"+config.teamDomain;
    if(claims.iss!==issuer
      ||!(typeof claims.aud==="string"?claims.aud===config.audience:Array.isArray(claims.aud)&&claims.aud.includes(config.audience))
      ||typeof claims.email!=="string"||claims.email.toLowerCase()!==config.ownerEmail
      ||!Number.isSafeInteger(claims.exp)||claims.exp<=now
      ||claims.exp>now+31*86400
      ||(claims.iat!==undefined&&(!Number.isSafeInteger(claims.iat)||claims.iat>now+60))
      ||(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now+60)))return null;
    const key=await signingKey(config.teamDomain,header.kid,fetcher,pinnedSnapshot);
    if(!key)return null;
    const imported=await subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const signature=b64url(segments[2]);
    const ok=await subtle.verify("RSASSA-PKCS1-v1_5",imported,signature,new TextEncoder().encode(segments[0]+"."+segments[1]));
    if(!ok)return null;
    return {userId:"fire-access-owner",email:config.ownerEmail,displayName:"FIRE Owner",fullName:null};
  }catch{return null;}
}
