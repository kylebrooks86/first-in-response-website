// Diagnostic-only, redacted FIRE Access failure classification.
// NEVER grants login, accepts unsigned identity, returns token, secret,
// policy AUD, domain, email, claims, user identifiers or raw headers.
// No data mutations or provider network calls. Codes only.
const has=(x)=>typeof x==="string"&&x.length>0;
const hostOk=(s)=>has(s)&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(s);
const audOk=(s)=>has(s)&&/^[A-Za-z0-9_-]{20,128}$/.test(s);
const emailOk=(s)=>has(s)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s===s.trim().toLowerCase();
function decodeUntrustedClaims(token){
  if(typeof token!=="string"||token.length<60||token.length>8192)return null;
  const a=token.split(".");
  if(a.length!==3||a.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))return null;
  try{
    const p=a[1].replace(/-/g,"+").replace(/_/g,"/");
    const json=atob(p+"=".repeat((4-p.length%4)%4));
    const claims=JSON.parse(new TextDecoder().decode(Uint8Array.from(json,c=>c.charCodeAt(0))));
    return claims&&typeof claims==="object"&&!Array.isArray(claims)?claims:null;
  }catch{return null;}
}
export function classifyFireAccessProblem({runtime,config,token,identity}){
  if(identity)return "FIRE-A00-VERIFIED";
  if(!runtime||!["cloudflare-staging","cloudflare-production"].includes(runtime.fireEnv)
      ||runtime.accessRequired!=="enabled"||runtime.syntheticEnabled==="enabled")
    return "FIRE-A01-RUNTIME";
  try{
    const u=new URL(runtime.origin||"");
    if(u.protocol!=="https:"||u.origin!==runtime.origin||u.hostname.endsWith(".chatgpt.site"))
      return "FIRE-A02-ORIGIN";
  }catch{return "FIRE-A02-ORIGIN";}
  if(!config||!hostOk(config.teamDomain)||!audOk(config.audience)||!emailOk(config.ownerEmail))
    return "FIRE-A03-IDENTITY-CONFIG";
  if(!token)return "FIRE-A04-TOKEN-ABSENT";
  const claim=decodeUntrustedClaims(token);
  if(!claim)return "FIRE-A05-TOKEN-FORMAT";
  // The next comparisons operate on UNVERIFIED metadata, used ONLY for
  // troubleshooting. They MUST NOT influence access decisions.
  if(claim.iss!=="https://"+config.teamDomain)return "FIRE-A06-ISSUER";
  const aud=typeof claim.aud==="string"?[claim.aud]:Array.isArray(claim.aud)?claim.aud:[];
  if(!aud.includes(config.audience))return "FIRE-A07-AUDIENCE";
  if(typeof claim.email!=="string"||claim.email.toLowerCase()!==config.ownerEmail)return "FIRE-A08-OWNER-CLAIM";
  const now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(claim.exp)||claim.exp<=now
      ||claim.exp>now+31*86400
      ||claim.iat!==undefined&&(!Number.isSafeInteger(claim.iat)||claim.iat>now+60)
      ||claim.nbf!==undefined&&(!Number.isSafeInteger(claim.nbf)||claim.nbf>now+60))
    return "FIRE-A09-TOKEN-TIME";
  // Signature validation still failed despite superficially compatible
  // untrusted claims. Could include JWKS retrieval/key or signature.
  return "FIRE-A10-CRYPTO-OR-KEY";
}
