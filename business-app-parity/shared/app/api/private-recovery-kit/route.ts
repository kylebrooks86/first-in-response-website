/** FIRE PRIVATE RECOVERY EXPORT — QA-ONLY, OFF by default.
 *
 * There is intentionally NO GET and NO public dashboard link.
 * NEVER activate on LIVE or through the regular backup API. Both real
 * database number tables and a real PHOTO bucket must exist, or fail.
 * Owner enters passphrase OVER HTTPS only when explicit QA approval is given.
 * POST response is encrypted kit ONLY; no plaintext records/IDs in output.
 * No D1 or R2 writes, backups, migrations, Stripe or deployment actions.
 *
 * The legacy /api/backup POST/GET HTTP 409 protection is unchanged.
 */
import {env} from "cloudflare:workers";
import {getChatGPTUser} from "../../chatgpt-auth";
import {captureEncryptedNumberedV2PrivateKitFromProviders}
 from "../../../lib/numbered-records-v2-source-export.mjs";

const OWNER="kylebrooks8605@gmail.com";
const QA_HOST="fire-fullapp-qa-20261016.kyle-bfc.workers.dev";
const ENABLED="qa-owner-encrypted-export-only";
const OFFLINE_HEADERS={
 "Cache-Control":"no-store, private, max-age=0",
 "Pragma":"no-cache",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer"
};
function unavailable(){
 return Response.json({error:"Not found"},{status:404,headers:OFFLINE_HEADERS});
}
function rejected(status:number,message:string){
 return Response.json({error:message},{status,headers:OFFLINE_HEADERS});
}
export async function POST(request:Request){
 const flags=env as typeof env & {FIRE_V2_PRIVATE_RECOVERY_EXPORT?:string};
 let target:URL;
 try{target=new URL(request.url);}catch{return unavailable();}
 // Exact QA hostname prevents accidental LIVE activation even if a
 // deployment operator mistakenly copied the QA approval flag.
 if(flags.FIRE_V2_PRIVATE_RECOVERY_EXPORT!==ENABLED||
    target.protocol!=="https:"||target.hostname!==QA_HOST)
  return unavailable();
 const user=await getChatGPTUser();
 if(!user||!user.userId?.trim()||user.email.trim().toLowerCase()!==OWNER)
  return unavailable();
 // Require explicit same-origin browser POST. No cross-site form posts,
 // cross-origin fetch or credential-carrying CORS from another website.
 const origin=request.headers.get("origin");
 if(origin!==target.origin||request.method!=="POST"||
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")
  return rejected(403,"Recovery export request was not authorized.");
 const len=Number(request.headers.get("content-length"));
 if(Number.isFinite(len)&&len>2048)
  return rejected(413,"Recovery export request exceeds the supported size.");
 let password:string;
 try{
  const raw=await request.text();
  if(raw.length>2048)throw Error("body too large");
  const input:unknown=JSON.parse(raw);
  if(!input||typeof input!=="object"||Array.isArray(input)||
     Object.keys(input).sort().join("|")!=="passphrase"||
     typeof (input as {passphrase?:unknown}).passphrase!=="string")
   throw Error("invalid input");
  password=(input as {passphrase:string}).passphrase;
 }catch{return rejected(400,"Invalid private recovery request.");}
 if(password.length<20||new TextEncoder().encode(password).byteLength>1024)
  return rejected(400,"Passphrase does not meet private backup requirements.");
 const db=env.DB,bucket=env.BUCKET;
 if(!db||!bucket)
  return rejected(503,"The isolated QA photo and database bindings are not available.");
 try{
  const {kit}=await captureEncryptedNumberedV2PrivateKitFromProviders({
   db,bucket,passphrase:password
  });
  return new Response(JSON.stringify(kit),{
   status:200,
   headers:{
    ...OFFLINE_HEADERS,
    "Content-Type":"application/json; charset=utf-8",
    "Content-Disposition":"attachment; filename=\"fire-private-recovery-kit-v2.json\""
   }
  });
 }catch{
  // No customer record, object key, database error, passphrase, or
  // signed agreement is included in any returned diagnostic.
  return rejected(409,"Private recovery export could not verify a complete source. Nothing was changed.");
 }
}
