import {getFireLiveJwksProof} from "../../chatgpt-auth";

// Cloudflare Access still protects every path at the edge; this read-only
// response contains only a fixed-code outcome. No cookies, JWTs, keys,
// identity fields, business records or exceptions are exposed or logged.
export const dynamic="force-dynamic";
export async function GET(){
  const code=await getFireLiveJwksProof();
  const status=code==="FIRE-LIVE-JWKS-VERIFIED"?200:
    code==="FIRE-LIVE-UNAUTHENTICATED"?403:503;
  return Response.json({code},{status,headers:{
    "cache-control":"no-store, private",
    "x-content-type-options":"nosniff",
  }});
}
