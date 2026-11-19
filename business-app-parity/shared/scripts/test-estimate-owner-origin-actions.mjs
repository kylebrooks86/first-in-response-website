/** Exercise actual owner estimate resolution/share/void route handlers in isolation.
 * The fake D1 throws if a legitimate request reaches it; forged browsers must
 * be rejected BEFORE any D1 call. NO provider, Stripe, hosted data or network.
 */
import assert from 'node:assert/strict';
import {createRouteFixtureLoader} from './route-test-loader.mjs';

let owner={email:'kylebrooks8605@gmail.com'};
let reads=0,writes=0,checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const env={DB:{prepare(){reads++;return {bind(){return this;},
 async first(){throw Error('Synthetic D1 operation intentionally blocked');},
 async all(){throw Error('Synthetic D1 operation intentionally blocked');},
 async run(){writes++;throw Error('Synthetic D1 operation intentionally blocked');}};},
 async batch(){writes++;throw Error('Synthetic D1 batch intentionally blocked');}}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>owner);
const fixedId='11111111-1111-4111-8111-111111111111';
const actions=[
 {name:'resolve',method:'PATCH',path:'app/api/estimates/[id]/change-requests/route.ts',
  body:{requestId:'request-synthetic',confirm:true}},
 {name:'share',method:'POST',path:'app/api/estimates/[id]/share/route.ts',body:null},
 {name:'void',method:'POST',path:'app/api/estimates/[id]/void/route.ts',body:null}
];
async function run(action,headers,body=action.body){
 const url='https://qa.example.invalid/api/estimates/'+fixedId+
  (action.name==='resolve'?'/change-requests':'/'+action.name);
 const request=new Request(url,{method:action.method,headers,
  ...(body===null?{}:{body:JSON.stringify(body)})});
 return load(action.path)[action.method](request,{params:Promise.resolve({id:fixedId})});
}
for(const action of actions){
 const jsonHeader=action.body===null?{}:{'content-type':'application/json'};
 const forged=[
  [{...jsonHeader,origin:'https://external.invalid'},'foreign Origin'],
  [{...jsonHeader,origin:'https://sibling.qa.example.invalid','sec-fetch-site':'same-site'},'sibling host'],
  [{...jsonHeader,origin:'https://qa.example.invalid','sec-fetch-site':'cross-site'},'cross-site metadata'],
  [{...jsonHeader,origin:'null'},'null Origin'],
  [{...jsonHeader,'sec-fetch-site':'none'},'browser none metadata']
 ];
 for(const [headers,label] of forged){
  const before={reads,writes};
  const reply=await run(action,headers);
  eq(reply.status,403,action.name+' refuses '+label);
  eq({reads,writes},before,action.name+' '+label+' did not touch D1');
 }
 if(action.body!==null){
  const before={reads,writes};
  const rejected=await run(action,{
   origin:'https://qa.example.invalid','sec-fetch-site':'same-origin',
   'content-type':'text/plain'});
  eq(rejected.status,415,'Owner '+action.name+' requires browser JSON');
  eq({reads,writes},before,'Bad owner '+action.name+' body did not reach D1');
 }
 const sameOrigin={...jsonHeader,origin:'https://qa.example.invalid',
  'sec-fetch-site':'same-origin'};
 const before=reads;
 const legit=await run(action,sameOrigin);
 eq(legit.status!==403&&legit.status!==415,true,
  'Owner '+action.name+' same-origin request passes browser gate');
 eq(reads>before,true,'Owner '+action.name+' legitimate route reaches synthetic D1');
 eq(writes,0,'Owner '+action.name+' fixture never commits a write');
 owner=null;
 const deniedBefore={reads,writes};
 const denied=await run(action,{...jsonHeader,origin:'https://external.invalid'});
 eq(denied.status,401,'Unauthenticated '+action.name+' rejected first');
 eq({reads,writes},deniedBefore,'Unauthenticated '+action.name+' touches no D1');
 owner={email:'kylebrooks8605@gmail.com'};
}
eq(typeof globalThis.fetch,'function','No remote network setup needed');
console.log('PASS '+checks+'/'+checks+': actual owner resolve/share/void browser Origin, metadata, JSON and authentication boundaries; zero synthetic D1 writes.');
