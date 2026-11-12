/** Execute the ACTUAL checkout handler with concurrent requests and synthetic D1/Stripe; no network or deployed resources. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../app/api/payments/checkout/route.ts',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let checks=0;
const check=(condition,description)=>{assert.ok(condition,description);checks++;console.log('PASS: '+description);};
const body=JSON.stringify({shareToken:'synthetic-share-token',paymentType:'deposit'});
function harness({twoReaders=false,stripeResponse='success',saveFailure=false,priorStatus=null,priorPaymentStatus='unpaid',priorMatches=true,priorMode=true,quoteStatus='approved',quoteAcceptedAt='2026-01-01',quoteSignedAt='2026-01-01',siteOrigin='https://synthetic.invalid',requestOrigin='https://synthetic.invalid'}={}){
 const state={open:priorStatus?{id:'cs_test_previoussynthetic',estimateId:'estimate-1',type:'deposit',charge:5000,status:'open'}:null,creates:0,expirations:0,locks:0,inspections:0,dbPrepares:0};
 let readers=0,openReaders;
 const bothReaders=new Promise(resolve=>{openReaders=resolve;});
 const db={prepare(sql){
   state.dbPrepares++;
   return {bind(...params){
     return {
       async first(){
         if(sql.includes('WHERE e.share_token=? LIMIT 1'))return {id:'estimate-1',totalCents:10000,depositCents:5000,invoiceOwnershipMismatch:0,status:quoteStatus,acceptedAt:quoteAcceptedAt,signedAt:quoteSignedAt,customer:'Fixture',service:'House wash'};
         if(sql.includes('FROM payment_refunds WHERE estimate_id=?'))return null;
         if(sql.includes("FROM notifications WHERE estimate_id=? AND type='payment_overage'"))return null;
         if(sql.includes('AS amount FROM payments WHERE estimate_id=?'))return {amount:0};
         if(sql.includes('SELECT e.status,e.accepted_at AS acceptedAt,e.signed_at AS signedAt,e.deposit_cents AS depositCents'))return {status:quoteStatus,acceptedAt:quoteAcceptedAt,signedAt:quoteSignedAt,depositCents:5000,totalCents:10000,paidCents:0,paymentOverageOpen:0,invoiceOwnershipMismatch:0};
         throw Error('Unexpected first SQL: '+sql);
       },
       async all(){
         if(!sql.includes('FROM payment_checkout_sessions WHERE estimate_id=? AND status=\'open\''))throw Error('Unexpected all SQL: '+sql);
         const snapshot=state.open?[{id:state.open.id,type:state.open.type,amountCents:state.open.charge}]:[];
         if(twoReaders){readers++;if(readers===2)openReaders();await bothReaders;}
         return {results:snapshot};
       },
       async run(){
         if(sql.includes('INSERT INTO payment_checkout_sessions')){
           check(sql.includes('WHERE NOT EXISTS'),'Checkout lock uses database-side conditional reservation');
           state.locks++;
           if(state.open)return {meta:{changes:0}};
           state.open={id:params[0],estimateId:params[1],type:params[2],charge:params[3],status:'open'};
           return {meta:{changes:1}};
         }
         if(sql.includes('UPDATE payment_checkout_sessions SET id=?')){
           if(saveFailure)throw Error('Synthetic D1 acknowledgement unavailable');
           if(!state.open||state.open.id!==params[1])return {meta:{changes:0}};
           state.open.id=params[0];return {meta:{changes:1}};
         }
         if(sql.includes("SET status='expired',expired_at=?")){
           if(state.open?.id===params[1])state.open=null;
           return {meta:{changes:1}};
         }
         throw Error('Unexpected run SQL: '+sql);
       }
     };
   }};
 }};
 const env={DB:db,FIRE_ENV:'synthetic',FIRE_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_synthetic',SITE_ORIGIN:siteOrigin};
 async function fakeFetch(url,options){
   if(url==='https://api.stripe.com/v1/checkout/sessions'&&options.method==='POST'){
     state.creates++;
     check(options.headers['Idempotency-Key'].startsWith('fire-checkout-fire-creating:'),'Stripe create uses the reserved operation ID as idempotency key');
     const form=new URLSearchParams(options.body);
     check(form.get('metadata[fire_checkout_reservation_id]')===state.open?.id,'Checkout session carries its exact reserved slot for signed-event recovery');
     check(form.get('success_url')==='https://synthetic.invalid/estimate/synthetic-share-token?session_id={CHECKOUT_SESSION_ID}'&&form.get('cancel_url')==='https://synthetic.invalid/estimate/synthetic-share-token',
       'Customer Stripe success/cancel links use only the pinned canonical HTTPS origin');
     if(stripeResponse==='rejection')return Response.json({error:{message:'Synthetic card setup rejected'}},{status:400});
     if(stripeResponse==='server-error')return Response.json({error:{message:'Stripe internal error'}},{status:500});
     if(stripeResponse==='rate-limit')return Response.json({error:{message:'Stripe rate limit'}},{status:429});
     if(stripeResponse==='uncertain')throw Error('Lost Stripe acknowledgement');
     if(stripeResponse==='wrong-mode')return Response.json({id:'cs_live_unexpected',url:'https://checkout.stripe.com/c/pay/test'});
     if(stripeResponse==='bad-origin')return Response.json({id:'cs_test_real_synthetic',url:'https://checkout.stripe.com.evil.invalid/pay'});
     if(stripeResponse==='plain-http')return Response.json({id:'cs_test_real_synthetic',url:'http://checkout.stripe.com/pay'});
     if(stripeResponse==='bad-id')return Response.json({id:'not-a-stripe-session',url:'https://checkout.stripe.com/pay'});
     if(stripeResponse==='valid-stripe-host')return Response.json({id:'cs_test_real_synthetic',url:'https://checkout.stripe.com/c/pay/synthetic'});
     return Response.json({id:'cs_test_real_synthetic',url:'https://checkout.stripe.test/synthetic'});
   }
   if(String(url).endsWith('/expire')){
     state.expirations++;
     return Response.json({id:'cs_test_real_synthetic',status:'expired'});
   }
   if(String(url).includes('/checkout/sessions/')){
     state.inspections++;
     if(priorStatus==='unavailable')return Response.json({error:'Stripe is temporarily unreachable'},{status:503});
     return Response.json({id:priorMatches?'cs_test_previoussynthetic':'cs_test_other_job',
      livemode:!priorMode, status:priorStatus,payment_status:priorPaymentStatus,
      client_reference_id:'estimate-1',amount_total:5000,
      metadata:{estimate_id:'estimate-1',payment_type:'deposit',expected_charge_cents:'5000'}});
   }
   throw Error('Unexpected Stripe API call '+url);
 }
 const exports={};
 new Function('require','exports','env','Response','Request','crypto','fetch','LOCAL_CUSTOMER_DEPLOYMENT',compiled)(
   id=>{if(id==='cloudflare:workers')return {env};throw Error('Unexpected import '+id);},exports,env,Response,Request,webcrypto,fakeFetch,'doomsday');
 const request=(payload=body,headers={})=>new Request(requestOrigin+'/api/payments/checkout',{
   method:'POST',headers:{'content-type':'application/json',...headers},body:payload
 });
 return {post:(payload,headers)=>exports.POST(request(payload,headers)),state};
}
// Stripe checkout callback URLs contain a private estimate share-token.
// An attacker-controlled Host, Cloudflare version-preview URL, or missing/unsafe
// SITE_ORIGIN must never be accepted or sent to Stripe. Rejection must precede
// all database reads and payment-network requests.
for(const [label,siteOrigin,requestOrigin] of [
 ['missing SITE_ORIGIN',undefined,'https://synthetic.invalid'],
 ['non-HTTPS SITE_ORIGIN','http://synthetic.invalid','http://synthetic.invalid'],
 ['path in SITE_ORIGIN','https://synthetic.invalid/estimate','https://synthetic.invalid'],
 ['query in SITE_ORIGIN','https://synthetic.invalid/?redirect=evil','https://synthetic.invalid'],
 ['credentials in SITE_ORIGIN','https://owner:secret@synthetic.invalid','https://synthetic.invalid'],
 ['wrong incoming host','https://synthetic.invalid','https://attacker.invalid'],
 ['Cloudflare preview vs canonical TEST origin','https://synthetic.invalid','https://ce69c574-synthetic.invalid'],
 ['non-HTTPS incoming host','https://synthetic.invalid','http://synthetic.invalid']
]){
 const h=harness({siteOrigin,requestOrigin});
 const response=await h.post();
 check(response.status===503,label+' fails closed before accepting public payment');
 check(h.state.dbPrepares===0&&h.state.locks===0&&h.state.creates===0&&h.state.inspections===0,
   label+' never reads D1, contacts Stripe, or reserves a checkout');
}
{
 const h=harness({siteOrigin:'https://synthetic.invalid/'});
 check((await h.post()).status===200,'Canonical HTTPS SITE_ORIGIN with trailing slash supports card checkout');
}
// Public checkout receives an unauthenticated request before its estimate
// bearer token is checked. Refuse large/malformed JSON without any D1 read,
// checkout reservation, financial write or Stripe call.
for(const [label,payload,headers,expected] of [
 ['body >16KiB with no Content-Length','x'.repeat(16385),{},413],
 ['spoofed smaller length still >16KiB','x'.repeat(16385),{'content-length':'8'},413],
 ['declared oversize','{}',{'content-length':'16385'},413],
 ['malformed Content-Length','{}',{'content-length':'12abc'},413],
 ['unclosed JSON','{broken',{},400],
 ['array is not an object','[]',{},400],
 ['JSON null','null',{},400],
 ['numeric shareToken',JSON.stringify({shareToken:1}),{},400],
 ['nested shareToken',JSON.stringify({shareToken:{id:'synthetic-share-token'}}),{},400],
 ['excessive shareToken',JSON.stringify({shareToken:'a'.repeat(129)}),{},400],
 ['invalid bearer characters',JSON.stringify({shareToken:'https://invalid.test/x'}),{},400]
]){
 const h=harness();
 const reply=await h.post(payload,headers);
 check(reply.status===expected,label+' is rejected before payment work');
 check(h.state.locks===0&&h.state.creates===0,label+' cannot reserve or create a card session');
}
{
 const h=harness();
 const response=await h.post(body,{'content-length':String(Buffer.byteLength(body,'utf8'))});
 check(response.status===200,'Valid signed checkout request with numeric Content-Length is accepted');
 check(h.state.locks===1&&h.state.creates===1,'Valid Content-Length preserves exactly one checkout');
}
for(const kind of ['wrong-mode','bad-origin','plain-http','bad-id']){
 const h=harness({stripeResponse:kind});
 const reply=await h.post();
 check(reply.status===503,kind+' Stripe reply never returns a payment URL');
 check((await reply.json()).checkoutUncertain===true,kind+' requires owner reconciliation, not a blind retry');
 check(h.state.open?.id.startsWith('fire-creating:'),kind+' leaves provisional checkout lock intact');
 check((await h.post()).status===409&&h.state.creates===1,kind+' cannot cause a duplicate session');
}
{
 const h=harness({stripeResponse:'valid-stripe-host'});
 const reply=await h.post();
 check(reply.status===200,'Official HTTPS checkout.stripe.com destination remains valid');
 check((await reply.json()).url==='https://checkout.stripe.com/c/pay/synthetic','Only verified Stripe checkout URL is returned');
}

{
 const h=harness({twoReaders:true});
 const results=await Promise.all([h.post(),h.post()]);
 check(results.filter(r=>r.status===200).length===1&&results.filter(r=>r.status===409).length===1,'Racing customer clicks produce one checkout and one conflict');
 check(h.state.creates===1,'Exactly one Stripe checkout is created during a concurrent race');
 check(h.state.open?.id==='cs_test_real_synthetic','Atomic lock is promoted in place to real checkout session ID');
 check(h.state.locks===2,'Both racing requests reach the guarded database reservation');
}
{
 const h=harness({stripeResponse:'rejection'});
 const r=await h.post();
 check(r.status===502,'Definitive Stripe API rejection is reported');
 check(h.state.open===null,'Definitive Stripe rejection releases reservation so another checkout is possible');
}
for(const kind of ['server-error','rate-limit']){
 const h=harness({stripeResponse:kind});
 const r=await h.post();
 check(r.status===503,kind+' is a potentially committed Stripe session, not a proven rejection');
 check(h.state.open?.id.startsWith('fire-creating:'),kind+' retains the checkout lock');
 check((await h.post()).status===409&&h.state.creates===1,kind+' blocks a duplicate checkout attempt');
}
{
 const h=harness({stripeResponse:'uncertain'});
 const r=await h.post();
 check(r.status===500&&h.state.creates===1,'Lost Stripe acknowledgement does not create an untracked second session');
 check(h.state.open?.id.startsWith('fire-creating:'),'Uncertain Stripe outcome retains fail-closed D1 reservation');
 check((await h.post()).status===409&&h.state.creates===1,'Further attempt cannot charge again after uncertain Stripe outcome');
}
{
 const h=harness({saveFailure:true});
 const r=await h.post();
 check(r.status===503,'Failed D1 checkout acknowledgement blocks returning a payable link');
 check(h.state.expirations===1,'The unmatched external Stripe session is explicitly expired');
 check(h.state.open===null,'Confirmed Stripe expiry releases the checkout lock');
}

for(const [kind,payment] of [['open','unpaid'],['complete','paid'],['expired','paid'],['unavailable','unpaid']]){
 const h=harness({priorStatus:kind,priorPaymentStatus:payment});
 const response=await h.post();
 check(response.status===409,'Prior '+kind+'/'+payment+' checkout is not replaced by customer retry');
 check(h.state.expirations===0,'Customer retry NEVER sends /expire for a prior '+kind+' Stripe session');
 check(h.state.creates===0&&h.state.open?.id==='cs_test_previoussynthetic','Prior '+kind+' checkout stays tracked and cannot start a second payment');
}
{
 const h=harness({priorStatus:'expired',priorPaymentStatus:'unpaid'});
 const response=await h.post();
 check(response.status===200,'Stripe-confirmed expired unpaid session permits a replacement checkout');
 check(h.state.creates===1&&h.state.expirations===0,'A new link is created after read-only expiry verification without forcing cancellation');
 check(h.state.open?.id==='cs_test_real_synthetic','Old verified-expired checkout slot was replaced atomically with newly tracked session');
}
for(const flag of ['priorMatches','priorMode']){
 const h=harness({priorStatus:'expired',priorPaymentStatus:'unpaid',[flag]:false});
 const response=await h.post();
 check(response.status===409&&h.state.creates===0&&h.state.expirations===0,'Stripe expired session with mismatched '+flag+' cannot release old lock');
}
// Reject direct POST calls that bypass the public payment UI. Even a valid
// share-token and test Stripe key must never authorize unsigned or retired work.
for(const [label,fixture] of [
  ['declined quote', {quoteStatus:'declined'}],
  ['superseded quote', {quoteStatus:'superseded'}],
  ['unsigned approval', {quoteSignedAt:null}],
  ['missing acceptance', {quoteAcceptedAt:null}],
  ['sent quote', {quoteStatus:'sent'}],
  ['draft quote', {quoteStatus:'draft'}]
]){
  const h=harness(fixture);
  const response=await h.post();
  check(response.status===409,label+' cannot create card checkout from direct API POST');
  check(h.state.creates===0&&h.state.locks===0,label+' never reserves or sends a Stripe request');
}
console.log('PASS '+checks+' synthetic checkout race, retired/unsigned rejection and recovery assertions against the actual FIRE route.');
