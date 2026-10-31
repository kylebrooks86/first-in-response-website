/** FIRE PRIVATE RECOVERY PREVIEW ROUTE — disabled-by-default.
 * This serves no owner records and does not read D1/R2, write any databases,
 * activate numbering or alter the existing v1 backup API lock.
 *
 * Enable only after independent, owner-approved QA preview review by setting
 * FIRE_V2_PRIVATE_RECOVERY_REVIEW=qa-owner-review-only in ISOLATED QA.
 * Do not set in LIVE, staging, Doomsday or ordinary public website configs.
 * The auth check is server-side; browser-side file/passphrase never reaches
 * this server component or any FIRE endpoint.
 */
import {env} from "cloudflare:workers";
import {notFound} from "next/navigation";
import {getChatGPTUser} from "../chatgpt-auth";
import {PrivateRecoveryReviewClient} from "./recovery-preview-client";
import {PrivateRecoveryExportClient} from "./recovery-export-client";

export const dynamic="force-dynamic";
export const revalidate=0;
const OWNER_EMAIL="kylebrooks8605@gmail.com";
const REVIEW_FLAG="qa-owner-review-only";

export default async function PrivateRecoveryReviewPage(){
 const flags=env as typeof env & {FIRE_V2_PRIVATE_RECOVERY_REVIEW?:string;FIRE_V2_PRIVATE_RECOVERY_EXPORT?:string};
 // No information about this page leaks unless explicitly enabled.
 if(flags.FIRE_V2_PRIVATE_RECOVERY_REVIEW!==REVIEW_FLAG)notFound();
 const user=await getChatGPTUser();
 if(!user||typeof user.userId!=="string"||!user.userId.trim()||
    user.email.trim().toLowerCase()!==OWNER_EMAIL)notFound();
 return <main style={{minHeight:"100vh",background:"var(--background)",padding:"18px 10px"}}>
  <div style={{maxWidth:670,margin:"0 auto 8px"}}>
   <a href="/" style={{color:"var(--foreground)",fontWeight:650,
    display:"inline-flex",padding:"10px 12px",minHeight:44,
    alignItems:"center",textDecoration:"underline"}}>Back to FIRE App</a>
  </div>
  <PrivateRecoveryReviewClient/>
  {flags.FIRE_V2_PRIVATE_RECOVERY_EXPORT==="qa-owner-encrypted-export-only"&&Boolean(env.DB)&&Boolean(env.BUCKET)?<PrivateRecoveryExportClient/>:null}
 </main>;
}
