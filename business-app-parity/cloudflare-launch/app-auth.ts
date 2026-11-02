// Intended ONLY for independently hosted Cloudflare staging/production builds.
// Cloudflare Access must also protect every route and asset at the edge.
// This does NOT enable a 4-digit PIN or issue persistent sessions by itself.
import {env} from "cloudflare:workers";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {verifyFireAccessJWT} from "./access-jwt.mjs";
import {getFireAccessToken} from "./access-token.mjs";
import {classifyFireAccessProblem} from "./access-diagnostic.mjs";
import {probeFireAccessCrypto} from "./access-key-probe.mjs";

export type ChatGPTUser={
  userId:string;
  displayName:string;
  email:string;
  fullName:string|null;
};
type AccessEnv={
  FIRE_ENV?:string;
  FIRE_ACCESS_REQUIRED?:string;
  FIRE_ACCESS_TEAM_DOMAIN?:string;
  FIRE_ACCESS_AUD?:string;
  FIRE_ACCESS_OWNER_EMAIL?:string;
  SITE_ORIGIN?:string;
  FIRE_QA_SYNTHETIC_ONLY?:string;
};
function accessSettings(){
  const c=env as typeof env & AccessEnv;
  if(!["cloudflare-staging","cloudflare-production"].includes(c.FIRE_ENV||"")
    ||c.FIRE_ACCESS_REQUIRED!=="enabled"
    ||c.FIRE_QA_SYNTHETIC_ONLY==="enabled")return null;
  const origin=c.SITE_ORIGIN;
  try{
    if(!origin||new URL(origin).protocol!=="https:"||new URL(origin).origin!==origin
      ||new URL(origin).hostname.endsWith(".chatgpt.site"))return null;
  }catch{return null;}
  return {teamDomain:c.FIRE_ACCESS_TEAM_DOMAIN||"",audience:c.FIRE_ACCESS_AUD||"",
    ownerEmail:c.FIRE_ACCESS_OWNER_EMAIL||"",origin};
}
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
  const cfg=accessSettings();
  if(!cfg)return null;
  const h=await headers();
  // Cloudflare Access's signed assertion header is preferred. Where the Vite
  // static-assets router omits it, browsers may supply the same signed JWT in
  // CF_Authorization. It is NEVER trusted without cryptographic verification.
  // Ignore untrusted email/login headers and reject all unsigned identities.
  const asserted=getFireAccessToken(h);
  return await verifyFireAccessJWT(asserted,cfg);
}
// Owner-visible, non-sensitive reason code only. Never used to authorize access.
// Cloudflare Access continues to enforce every route at the edge.
export async function getFireAccessDiagnostic():Promise<string>{
  const current=env as typeof env & AccessEnv;
  const cfg=accessSettings();
  const h=await headers();
  const token=getFireAccessToken(h);
  const validated=cfg?await verifyFireAccessJWT(token,cfg):null;
  const code=classifyFireAccessProblem({
    runtime:{
      fireEnv:current.FIRE_ENV,
      accessRequired:current.FIRE_ACCESS_REQUIRED,
      syntheticEnabled:current.FIRE_QA_SYNTHETIC_ONLY,
      origin:current.SITE_ORIGIN,
    },
    config:cfg,token,identity:validated,
  });
  // Only if the token's untrusted metadata looked compatible but signature
  // validation failed, run a NON-AUTHORIZING, redacted phase probe.
  return code==="FIRE-A10-CRYPTO-OR-KEY" ? await probeFireAccessCrypto(token,cfg) : code;
}
// One-time owner-only TEST diagnostic: verifies the *current* provider JWKS
// with a forced fresh fetch and NO embedded/pinned-key fallback. It does not
// grant access, return headers/tokens/claims, or write any business records.
export async function getFireLiveJwksProof():Promise<string>{
  const cfg=accessSettings();
  if(!cfg)return "FIRE-LIVE-CONFIG";
  const jwt=getFireAccessToken(await headers());
  const session=await verifyFireAccessJWT(jwt,cfg);
  if(!session)return "FIRE-LIVE-UNAUTHENTICATED";
  const live=await verifyFireAccessJWT(jwt,cfg,{forceRefresh:true});
  return live?"FIRE-LIVE-JWKS-VERIFIED":"FIRE-LIVE-JWKS-UNAVAILABLE";
}
export async function requireChatGPTUser(_returnTo:string):Promise<ChatGPTUser>{
  const user=await getChatGPTUser();
  if(user)return user;
  redirect("/access-required");
}
export function chatGPTSignInPath(_returnTo:string){return "/access-required";}
export function chatGPTSignOutPath(_returnTo="/"){return "/cdn-cgi/access/logout";}
