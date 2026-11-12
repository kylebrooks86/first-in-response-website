// Cloudflare Access browser-token retrieval for independent FIRE Workers.
// Prefer the signed request assertion. A signed browser cookie is a fallback
// ONLY when Cloudflare's assertion header is completely absent; both go through
// the identical RS256 issuer/AUD/owner/expiry verification in access-jwt.mjs.
// Never trust a login email header, unsigned cookie payload, or local storage.
const TOKEN_PATTERN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export function getFireAccessToken(headers){
  const asserted=headers?.get?.("cf-access-jwt-assertion");
  if(asserted!==null&&asserted!==undefined) return asserted;
  const raw=headers?.get?.("cookie");
  if(typeof raw!=="string"||raw.length>32768)return null;
  const values=[];
  for(const part of raw.split(";")){
    const at=part.indexOf("=");
    if(at<0)continue;
    if(part.slice(0,at).trim()!=="CF_Authorization")continue;
    let val=part.slice(at+1).trim();
    if(val.startsWith('"')&&val.endsWith('"'))val=val.slice(1,-1);
    try{if(val.includes("%"))val=decodeURIComponent(val);}catch{return null;}
    values.push(val);
  }
  if(values.length!==1)return null;
  const token=values[0];
  if(token.length<60||token.length>8192||!TOKEN_PATTERN.test(token))return null;
  return token;
}
