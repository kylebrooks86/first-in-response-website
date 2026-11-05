/** Owner-requested, read-only connection inspection. Never creates Stripe objects. */
export type StripeInspectionConfig={
 key?:string;expectedAccountId?:string;sandbox:boolean;appUrl?:string;webhookSecretConfigured:boolean;
};
export const FIRE_STRIPE_REQUIRED_EVENTS=[
 'checkout.session.completed','checkout.session.async_payment_succeeded',
 'checkout.session.async_payment_failed','refund.created','refund.updated',
] as const;
export async function inspectStripeConnection(config:StripeInspectionConfig,read:typeof fetch=fetch){
 const baseline={diagnosticOnly:true,endToEndVerified:false,connectionReady:false,mode:config.sandbox?'sandbox':'live',
  webhookSecretConfigured:config.webhookSecretConfigured};
 const blocked=(reason:string)=>({...baseline,reason});
 if(!config.key)return blocked('stripe_key_missing');
 if(!new RegExp(config.sandbox?'^(sk|rk|rkcs)_test_':'^(sk|rk|rkcs)_live_').test(config.key))return blocked('stripe_key_mode_mismatch');
 if(!config.expectedAccountId||!/^acct_[a-zA-Z0-9]+$/.test(config.expectedAccountId))return blocked('expected_account_pin_missing');
 let expectedWebhook:string;
 try{
  const url=new URL(config.appUrl||'');
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return blocked('canonical_https_origin_required');
  expectedWebhook=url.origin+'/api/payments/webhook';
 }catch{return blocked('canonical_https_origin_required');}
 const headers={authorization:`Bearer ${config.key}`,'Stripe-Version':'2026-08-26.dahlia'};
 try{
  const accountResponse=await read('https://api.stripe.com/v1/account',{headers,signal:AbortSignal.timeout(8000)});
  if(!accountResponse.ok)return blocked(accountResponse.status===403?'stripe_account_read_denied':'stripe_account_read_unavailable');
  const account=await accountResponse.json() as {id?:string;default_currency?:string};
  if(account.id!==config.expectedAccountId)return blocked('stripe_account_pin_mismatch');
  if(account.default_currency!=='usd')return blocked('stripe_account_currency_mismatch');
  const endpointsResponse=await read('https://api.stripe.com/v1/webhook_endpoints?limit=100',{headers,signal:AbortSignal.timeout(8000)});
  if(!endpointsResponse.ok)return {...blocked(endpointsResponse.status===403?'webhook_read_denied':'webhook_read_unavailable'),accountVerified:true};
  const endpoints=await endpointsResponse.json() as {data?:Array<{url?:string;livemode?:boolean;status?:string;enabled_events?:string[];api_version?:string}>;has_more?:boolean};
  if(!Array.isArray(endpoints.data)||endpoints.has_more!==false)return {...blocked('webhook_inventory_incomplete'),accountVerified:true};
  const matches=endpoints.data.filter(endpoint=>endpoint&&endpoint.url===expectedWebhook);
  // Duplicated destinations are ambiguous, even if one is healthy. Do not
  // silently choose a destination or send a verification/replay event.
  if(matches.length!==1)return {...blocked(matches.length?'webhook_destination_ambiguous':'webhook_destination_missing'),accountVerified:true};
  const endpoint=matches[0];
  if(endpoint.livemode!==!config.sandbox||endpoint.status!=='enabled')return {...blocked('webhook_mode_or_status_mismatch'),accountVerified:true};
  const events=endpoint.enabled_events;
  const missing=FIRE_STRIPE_REQUIRED_EVENTS.filter(event=>!Array.isArray(events)||(!events.includes('*')&&!events.includes(event)));
  if(missing.length)return {...blocked('required_webhook_events_missing'),accountVerified:true,missingEvents:missing};
  if(endpoint.api_version!=='2026-08-26.dahlia')return {...blocked('webhook_api_version_unverified'),accountVerified:true};
  if(!config.webhookSecretConfigured)return {...blocked('webhook_signing_secret_missing'),accountVerified:true};
  return {...baseline,accountVerified:true,webhookConfigurationVerified:true,connectionReady:true,reason:'read_only_configuration_matches',
   warning:'Configuration matches only. Signing-secret correctness, delivery, checkout, refund and ledger reconciliation still require authorized sandbox tests.'};
 }catch{return blocked('stripe_inspection_uncertain');}
}
