/** Actual source, synthetic GET-only Stripe responses; no provider/network writes. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const load=(path,deps={})=>{
 const output=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('exports','require',output)(exports,name=>{if(!(name in deps))throw Error('Undeclared import '+name);return deps[name];});return exports;
};
const {inspectStripeConnection,FIRE_STRIPE_REQUIRED_EVENTS}=load('../lib/stripe-connection-inspection.ts');
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
const config={key:'rk_test_synthetic-never-real',expectedAccountId:'acct_syntheticQA',sandbox:true,appUrl:'https://synthetic-qa.invalid',webhookSecretConfigured:true};
const endpoint={url:config.appUrl+'/api/payments/webhook',status:'enabled',livemode:false,enabled_events:[...FIRE_STRIPE_REQUIRED_EVENTS],api_version:'2026-08-26.dahlia'};
let calls=[];
const read=async(url,options)=>{calls.push({url,options});assert.ok(!options.method||options.method==='GET');return Response.json(url.endsWith('/account')?{id:config.expectedAccountId,default_currency:'usd'}:{data:[endpoint],has_more:false});};
const good=await inspectStripeConnection(config,read);
check(good.connectionReady&&good.accountVerified&&good.webhookConfigurationVerified,'Exact pinned account and complete sandbox endpoint match');
check(good.endToEndVerified===false&&good.diagnosticOnly===true,'Read-only configuration never claims end-to-end acceptance');
check(calls.length===2&&calls.every(call=>call.url.startsWith('https://api.stripe.com/v1/')),'Inspection makes only two bounded Stripe GETs');
check(!JSON.stringify(good).includes(config.key),'Inspection never exposes its API key');
for(const [patch,reason] of [
 [{key:undefined},'stripe_key_missing'],[{key:'sk_live_synthetic'},'stripe_key_mode_mismatch'],
 [{sandbox:false},'stripe_key_mode_mismatch'],[{expectedAccountId:undefined},'expected_account_pin_missing'],
 [{appUrl:'http://synthetic-qa.invalid'},'canonical_https_origin_required'],
 [{appUrl:'https://user:secret@synthetic-qa.invalid'},'canonical_https_origin_required'],
 [{appUrl:'https://synthetic-qa.invalid/?token=secret'},'canonical_https_origin_required'],
 [{appUrl:'https://synthetic-qa.invalid/path'},'canonical_https_origin_required'],
]){
 calls=[];const result=await inspectStripeConnection({...config,...patch},read);
 check(!result.connectionReady&&result.reason===reason&&calls.length===0,'Unsafe configuration stops before network: '+reason);
}
for(const [account,reason] of [[{id:'acct_wrong',default_currency:'usd'},'stripe_account_pin_mismatch'],[{id:config.expectedAccountId,default_currency:'eur'},'stripe_account_currency_mismatch']]){
 let count=0;const result=await inspectStripeConnection(config,async()=>{count++;return Response.json(account);});
 check(result.reason===reason&&count===1,'Account mismatch stops before inspecting webhooks: '+reason);
}
for(const [inventory,reason] of [
 [{data:[],has_more:false},'webhook_destination_missing'],
 [{data:[endpoint,endpoint],has_more:false},'webhook_destination_ambiguous'],
 [{data:[endpoint],has_more:true},'webhook_inventory_incomplete'],
 [{data:[{...endpoint,livemode:true}],has_more:false},'webhook_mode_or_status_mismatch'],
 [{data:[{...endpoint,status:'disabled'}],has_more:false},'webhook_mode_or_status_mismatch'],
 [{data:[{...endpoint,url:'https://existing-production.invalid/api/payments/webhook'}],has_more:false},'webhook_destination_missing'],
 [{data:[{...endpoint,enabled_events:['checkout.session.completed']}],has_more:false},'required_webhook_events_missing'],
 [{data:[{...endpoint,api_version:null}],has_more:false},'webhook_api_version_unverified'],
]){
 const result=await inspectStripeConnection(config,async url=>url.endsWith('/account')?Response.json({id:config.expectedAccountId,default_currency:'usd'}):Response.json(inventory));
 check(!result.connectionReady&&result.reason===reason,'Unsafe endpoint does not pass: '+reason);
}
check((await inspectStripeConnection({...config,webhookSecretConfigured:false},read)).reason==='webhook_signing_secret_missing','Missing signing-secret configuration remains blocked');
check((await inspectStripeConnection(config,async()=>Response.json({private:'not exposed'},{status:403}))).reason==='stripe_account_read_denied','Account permission denial is explicit and sanitized');
const denied=await inspectStripeConnection(config,async url=>url.endsWith('/account')?Response.json({id:config.expectedAccountId,default_currency:'usd'}):Response.json({}, {status:403}));
check(denied.reason==='webhook_read_denied','Webhook read permission is separately checked');
check((await inspectStripeConnection(config,async()=>{throw Error('secret provider detail');})).reason==='stripe_inspection_uncertain','Network ambiguity never becomes a healthy connection');
const payment=load('../lib/stripe-payments.ts'),refund=load('../lib/stripe-refunds.ts');
const DB={prepare(){throw Error('Invalid currency touched database');}};
for(const currency of ['eur','jpy','USD','',null,undefined,1]){
 check((await payment.reconcileStripeCheckout(DB,{id:'cs_test_synthetic',currency,payment_status:'paid',amount_total:10000})).reason==='currency_mismatch','Payment rejects non-USD/missing currency before DB: '+String(currency));
 check((await refund.recordRefundUpdate(DB,{id:'re_synthetic',currency,amount:1000,status:'succeeded'})).reason==='currency_mismatch','Refund rejects non-USD/missing currency before DB: '+String(currency));
}
let owner=null;const env={STRIPE_RESTRICTED_KEY:config.key,FIRE_STRIPE_EXPECTED_ACCOUNT_ID:config.expectedAccountId,SITE_ORIGIN:config.appUrl,STRIPE_WEBHOOK_SECRET:'whsec_synthetic-never-real'};
const route=load('../app/api/payments/connection/route.ts',{'cloudflare:workers':{env},'../../../chatgpt-auth':{getChatGPTUser:async()=>owner},'../../../local-customer-deployment':{LOCAL_CUSTOMER_DEPLOYMENT:'staging'},'../../../../lib/stripe-connection-inspection':{inspectStripeConnection}});
const previous=globalThis.fetch;globalThis.fetch=read;
try{
 calls=[];check((await route.GET()).status===401&&calls.length===0,'Unauthenticated request cannot inspect the account');
 owner={email:'not-owner@example.invalid'};check((await route.GET()).status===401&&calls.length===0,'Non-owner cannot inspect Stripe configuration');
 owner={email:'kylebrooks8605@gmail.com'};const response=await route.GET();
 check(response.status===200&&response.headers.get('cache-control')==='no-store','Authenticated owner receives uncached read-only connection result');
 const body=JSON.stringify(await response.json());check(!body.includes(config.key)&&!body.includes(env.STRIPE_WEBHOOK_SECRET),'Actual route hides both API and signing secrets');
 delete env.FIRE_STRIPE_EXPECTED_ACCOUNT_ID;check((await route.GET()).status===503,'Actual route fails closed without an explicit account pin');
}finally{globalThis.fetch=previous;}
console.log('PASS '+checks+' actual-source Stripe configuration/currency assertions; no external requests, writes or credentials.');
