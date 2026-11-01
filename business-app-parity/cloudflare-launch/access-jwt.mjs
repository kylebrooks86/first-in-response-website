// Cloudflare Access identity verifier for a FUTURE independently hosted FIRE app.
// No provision/deploy/credentials; callers must reject null and protect every route.
const KEY_TTL_MS=10*60*1000;
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
async function signingKey(teamDomain,kid,fetcher){
  const origin="https://"+teamDomain;
  const cached=keysCache.get(origin);
  if(cached&&cached.expires>Date.now()&&cached.keys.some(k=>k.kid===kid))return cached.keys.find(k=>k.kid===kid);
  const response=await fetcher(origin+"/cdn-cgi/access/certs",{redirect:"error",headers:{accept:"application/json"}});
  if(!response.ok)throw Error("Unable to obtain Access signing key");
  const doc=await response.json();
  if(!Array.isArray(doc?.keys)||doc.keys.length>10)throw Error("Untrusted signing keys");
  const keys=doc.keys.filter(k=>k&&k.kty==="RSA"&&typeof k.kid==="string"&&k.kid.length<160
    &&typeof k.n==="string"&&/^[A-Za-z0-9_-]+$/.test(k.n)
    &&typeof k.e==="string"&&/^[A-Za-z0-9_-]+$/.test(k.e)
    &&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));
  keysCache.set(origin,{keys,expires:Date.now()+KEY_TTL_MS});
  return keys.find(k=>k.kid===kid);
}
export async function verifyFireAccessJWT(token,config,{fetcher=fetch,subtle=crypto.subtle,now=Math.floor(Date.now()/1000)}={}){
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
    const key=await signingKey(config.teamDomain,header.kid,fetcher);
    if(!key)return null;
    const imported=await subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const signature=b64url(segments[2]);
    const ok=await subtle.verify("RSASSA-PKCS1-v1_5",imported,signature,new TextEncoder().encode(segments[0]+"."+segments[1]));
    if(!ok)return null;
    return {userId:"fire-access-owner",email:config.ownerEmail,displayName:"FIRE Owner",fullName:null};
  }catch{return null;}
}
