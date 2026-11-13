/** FIRE signed Cloudflare Access identity validation for optional passkey/PIN sign-in.
 *
 * This is NOT a biometric API. Cloudflare Access is the WebAuthn relying party.
 * Access independently authenticates the person; the Worker checks the Access
 * RS256 assertion, exact application audience, pinned owner and issuer before
 * issuing any FIRE app session. Absence/misconfiguration means DENY.
 *
 * Caller MUST also pin FIRE_ENV and SITE_ORIGIN to the reviewed Worker.
 * No dynamic caller-controlled URL, arbitrary JWKS endpoint or token logging.
 */
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});
const deny=()=>false;
const validTeam=team=>typeof team==='string'&&
 /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(team);
const safeJson=(bytes,max=8192)=>{
 if(bytes.byteLength>max)throw Error('Token too large');
 return JSON.parse(decoder.decode(bytes));
};
function base64url(input){
 if(typeof input!=='string'||!input||!/^[A-Za-z0-9_-]+$/.test(input)||
  input.length%4===1||input.length>16384)throw Error('Invalid base64url');
 const b64=input.replace(/-/g,'+').replace(/_/g,'/');
 const decoded=atob(b64+'='.repeat((4-b64.length%4)%4));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
const validOwnerEmail=email=>typeof email==='string'&&
 /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)&&email.length<=254;

/** Cache only Cloudflare's PUBLIC JWKS for 5 minutes. Never cache tokens or
 * auth decisions. Protected routes otherwise fetch certs on EVERY request,
 * which adds latency and makes Access DNS availability a runtime dependency.
 * An unfamiliar KID bypasses the cache and triggers a fresh provider fetch.
 */
const jwksCache=new Map();
const CERT_TTL_MS=5*60*1000;
async function accessJwks(teamDomain,fetcher,kid,nowMs){
 const cacheable=fetcher===fetch;
 const stored=cacheable?jwksCache.get(teamDomain):undefined;
 if(stored&&stored.expiresAt>nowMs&&stored.keys.some(k=>k.kid===kid))return stored.keys;
 const response=await fetcher('https://'+teamDomain+'/cdn-cgi/access/certs',{
  method:'GET',headers:{accept:'application/json'},
  signal:AbortSignal.timeout(3500)
 });
 if(!response?.ok)throw Error('Access certs unavailable');
 const jwks=await response.json();
 if(!Array.isArray(jwks?.keys)||jwks.keys.length>60)throw Error('Access certs invalid');
 if(cacheable){
  jwksCache.clear(); // one known team domain per Worker; bounded public key cache
  jwksCache.set(teamDomain,{keys:jwks.keys,expiresAt:nowMs+CERT_TTL_MS});
 }
 return jwks.keys;
}

/** Validates a signed Access JWT; never trusts an unverified header or cookie. */
export async function verifyCloudflareAccessOwnerJwt(token,config,{fetcher=fetch,now=Math.floor(Date.now()/1000)}={}){
 try{
  const {teamDomain,audience,ownerEmail}=config||{};
  if(!validTeam(teamDomain)||typeof audience!=='string'||audience.length<12||
   audience.length>256||!validOwnerEmail(ownerEmail)||!Number.isSafeInteger(now)||
   typeof token!=='string'||token.length>16000)return false;
  const parts=token.split('.');
  if(parts.length!==3)return false;
  const header=safeJson(base64url(parts[0]),1024),claims=safeJson(base64url(parts[1]),8192);
  if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||
    header.kid.length<8||header.kid.length>256||header.crit!==undefined||
    !claims||claims.iss!=='https://'+teamDomain||
    !Array.isArray(claims.aud)||!claims.aud.includes(audience)||
    typeof claims.email!=='string'||claims.email.toLowerCase()!==ownerEmail.toLowerCase()||
    typeof claims.sub!=='string'||!claims.sub||claims.sub.length>256||
    !Number.isSafeInteger(claims.exp)||claims.exp<=now||
    !Number.isSafeInteger(claims.iat)||claims.iat>now+60||
    claims.iat<now-60*60*24*30||
    claims.exp-claims.iat>60*60*24*30||
    (claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now+60)))
   return false;
  const publicKeys=await accessJwks(teamDomain,fetcher,header.kid,Date.now());
  const matching=publicKeys.filter(j=>j&&j.kid===header.kid&&j.kty==='RSA'&&
    (j.alg===undefined||j.alg==='RS256')&&(j.use===undefined||j.use==='sig')&&
    typeof j.n==='string'&&typeof j.e==='string'&&j.n.length>300&&j.n.length<3000);
  if(matching.length!==1)return false;
  const key=await crypto.subtle.importKey('jwk',matching[0],
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
    base64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
  return valid===true;
 }catch{return deny();}
}
