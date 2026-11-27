import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {LOCAL_CUSTOMER_DEPLOYMENT} from '../../../local-customer-deployment';
import {inspectStripeConnection} from '../../../../lib/stripe-connection-inspection';

type RuntimeEnv=Cloudflare.Env & {STRIPE_RESTRICTED_KEY?:string;STRIPE_SECRET_KEY?:string;
 FIRE_STRIPE_EXPECTED_ACCOUNT_ID?:string;FIRE_ENV?:string;SITE_ORIGIN?:string;STRIPE_WEBHOOK_SECRET?:string;FIRE_STRIPE_MODE?:string};
const privateConnectionHeaders={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const privateDiagnostic=(body:unknown,status:number)=>Response.json(body,{status,headers:privateConnectionHeaders});
/** This endpoint never enables payments, creates checkouts or sends test events. */
export async function GET(){
  if (String(LOCAL_CUSTOMER_DEPLOYMENT) === "qa") return privateDiagnostic({error:"Synthetic QA disables all Stripe actions and connection probes."},503);
 const owner=await getChatGPTUser();
 if(typeof owner?.email!=='string'||owner.email.toLowerCase()!=='kylebrooks8605@gmail.com')return privateDiagnostic({error:'Unauthorized'},401);
 const runtime=env as RuntimeEnv;
 // Treat dark DR, prelaunch NEW LIVE, QA, and MISSING/unknown runtime labels
 // as isolated TEST targets, even when compiled with the shared "live" adapter.
 // An absent FIRE_ENV must never implicitly authorize a LIVE-mode Stripe probe.
 const sandbox=String(LOCAL_CUSTOMER_DEPLOYMENT)!=='live'||
   !['live','production','cloudflare-live'].includes(String(runtime.FIRE_ENV??'').trim().toLowerCase());
 if(sandbox && runtime.FIRE_STRIPE_MODE !== 'test')
   return privateDiagnostic({connectionReady:false,diagnosticOnly:true,endToEndVerified:false,reason:'stripe_test_mode_disabled'},503);
 const result=await inspectStripeConnection({key:runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY,
  expectedAccountId:runtime.FIRE_STRIPE_EXPECTED_ACCOUNT_ID,sandbox,
  appUrl:runtime.SITE_ORIGIN,webhookSecretConfigured:Boolean(runtime.STRIPE_WEBHOOK_SECRET)});
 return privateDiagnostic(result,result.connectionReady?200:503);
}
