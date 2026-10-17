import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {LOCAL_CUSTOMER_DEPLOYMENT} from '../../../local-customer-deployment';
import {inspectStripeConnection} from '../../../../lib/stripe-connection-inspection';

type RuntimeEnv=Cloudflare.Env & {STRIPE_RESTRICTED_KEY?:string;STRIPE_SECRET_KEY?:string;
 FIRE_STRIPE_EXPECTED_ACCOUNT_ID?:string;FIRE_ENV?:string;SITE_ORIGIN?:string;STRIPE_WEBHOOK_SECRET?:string};
/** This endpoint never enables payments, creates checkouts or sends test events. */
export async function GET(){
  if (String(LOCAL_CUSTOMER_DEPLOYMENT) === "qa") return Response.json({error:"Synthetic QA disables all Stripe actions and connection probes."},{status:503,headers:{"cache-control":"no-store"}});
 const owner=await getChatGPTUser();
 if(!owner||owner.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401});
 const runtime=env as RuntimeEnv;
 const result=await inspectStripeConnection({key:runtime.STRIPE_RESTRICTED_KEY||runtime.STRIPE_SECRET_KEY,
  expectedAccountId:runtime.FIRE_STRIPE_EXPECTED_ACCOUNT_ID,sandbox:String(LOCAL_CUSTOMER_DEPLOYMENT)!=='live'||/(?:staging|doomsday|synthetic|sandbox)/i.test(runtime.FIRE_ENV||''),
  appUrl:runtime.SITE_ORIGIN,webhookSecretConfigured:Boolean(runtime.STRIPE_WEBHOOK_SECRET)});
 return Response.json(result,{status:result.connectionReady?200:503,headers:{'cache-control':'no-store'}});
}
