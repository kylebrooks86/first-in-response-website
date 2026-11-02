// Signed RS256 Cloudflare Access JWT verification, independent FIRE Workers.
// Permanent: live provider keys only, fail-closed on key service outage.
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
// Never use a public key copied into source or captured at build time.
// Fetch the current keys from the configured team issuer over HTTPS, and
// fail CLOSED when unavailable. In-memory cache retains LIVE provider keys
// for no more than 10 minutes to reduce endpoint traffic.
async function signingKey(teamDomain,kid,fetcher,{forceRefresh=false}={}) {
  const origin="https://"+teamDomain;
  const cached=keysCache.get(origin);
  if(!forceRefresh&&cached&&cached.expires>Date.now()&&cached.keys.some(k=>k.kid===kid))
    return cached.keys.find(k=>k.kid===kid);
  try {
    const expectedUrl=origin+"/cdn-cgi/access/certs";
    const response=await fetcher(expectedUrl,{redirect:"follow",headers:{accept:"application/json"}});
    if(!response.ok||!response.url||new URL(response.url).origin!==origin)return null;
    const doc=await response.json();
    if(!Array.isArray(doc?.keys)||doc.keys.length<1||doc.keys.length>10
      ||!doc.keys.every(validJwk))return null;
    const keys=doc.keys;
    if(new Set(keys.map(k=>k.kid)).size!==keys.length)return null;
    keysCache.set(origin,{keys,expires:Date.now()+KEY_TTL_MS});
    return keys.find(k=>k.kid===kid)||null;
  }catch{return null;}
}
export async function verifyFireAccessJWT(token,config,{fetcher=fetch,subtle=crypto.subtle,now=Math.floor(Date.now()/1000),forceRefresh=false}={}){
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
    const key=await signingKey(config.teamDomain,header.kid,fetcher,{forceRefresh});
    if(!key)return null;
    const imported=await subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const signature=b64url(segments[2]);
    const ok=await subtle.verify("RSASSA-PKCS1-v1_5",imported,signature,new TextEncoder().encode(segments[0]+"."+segments[1]));
    if(!ok)return null;
    return {userId:"fire-access-owner",email:config.ownerEmail,displayName:"FIRE Owner",fullName:null};
  }catch{return null;}
}
