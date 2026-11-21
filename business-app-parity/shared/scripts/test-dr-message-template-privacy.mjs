/** Actual independent DR message templates GET/PUT, owner-only privacy and D1 failure.
 * Disposable synthetic data; no hosted Cloudflare, mail, customer or payment writes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
// The DR and QA request-guard modules have identical Git blobs at this source SHA.
import {readOwnerWriteObject} from '../lib/customer-write-request-guard.mjs';

const path=process.env.FIRE_DR_MESSAGE_TEMPLATE_ROUTE;
assert.ok(path,'Pin the real independent DR source path from the PR checkout');
const source=readFileSync(path,'utf8');
let user={email:'kylebrooks8605@gmail.com'},reads=0,writes=0,failRead=false,failWrite=false;
let rows=[{key:'estimate',subject:'Owner subject',body:'Owner saved message',updatedAt:'2026-11-20T00:00:00Z'}];
let readOutcome=null;
const DB={prepare(sql){
  if(sql.startsWith('SELECT key,subject,body,updated_at')){
    reads++;
    return {all:async()=>{if(failRead)throw Error('Synthetic DR D1 read unavailable');return readOutcome??{results:structuredClone(rows)};}};
  }
  if(sql.startsWith('INSERT INTO message_templates')||sql.startsWith('DELETE FROM message_templates')){
    return {bind(...args){return {run:async()=>{
      writes++;
      if(failWrite)throw Error('Synthetic DR D1 acknowledgement unavailable');
      if(sql.startsWith('DELETE'))rows=rows.filter(row=>row.key!==args[0]);
      else{
        rows=rows.filter(row=>row.key!==args[0]);
        rows.push({key:args[0],subject:args[1],body:args[2],updatedAt:args[3]});
      }
      return {success:true,meta:{changes:1}};
    }};}};
  }
  throw Error('Unexpected independent DR query: '+sql);
}};
const templates=[{key:'estimate',subject:'Default subject',body:'Default wording'},{key:'contractTerms',subject:'Contract',body:'Standard agreement'}];
const sandbox={exports:{},Request,Response,Date,Array,Map,String,Boolean,Error,console,
  require(id){
    if(id==='cloudflare:workers')return {env:{DB}};
    if(id==='../../owner-auth')return {getOwnerUser:async()=>user};
    if(id==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject};
    if(id==='../../../lib/fire-templates')return {FIRE_TEMPLATES:templates,SERVICE_AGREEMENT:'Current approved FIRE agreement'};
    throw Error('Unexpected import: '+id);
  }
};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
const route=sandbox.exports;
let checks=0;
function eq(actual,expected,why){assert.deepEqual(actual,expected,why);checks++;}
function headers(response,label){
  eq(response.headers.get('cache-control'),'private, no-store',label+' never cache owner templates');
  eq(response.headers.get('vary'),'Cookie',label+' varies by session');
  eq(response.headers.get('x-content-type-options'),'nosniff',label+' prevents sniffing');
}
function put(body){
  return route.PUT(new Request('https://dr.synthetic.invalid/api/message-templates',{method:'PUT',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)}));
}

const initial=await route.GET();eq(initial.status,200,'Owner GET succeeds');
headers(initial,'Owner GET');
eq((await initial.json()).templates[0].body,'Owner saved message','Exact saved owner wording returned');
const beforeDenials=reads;
for(const [label,identity] of [
  ['anonymous',null],['foreign',{email:'somebody@synthetic.invalid'}],
  ['numeric email',{email:42}],['missing email',{}],
  ['throwing email',{get email(){throw Error('bad principal');}}],
  ['rejected session',{then(_ok,reject){reject(Error('session unavailable'));}}]
]){
  user=identity;
  const denied=await route.GET();
  eq(denied.status,401,label+' GET returns controlled owner denial');
  headers(denied,label+' GET');
  const refused=await put({key:'estimate',body:'Unauthorized edit'});
  eq(refused.status,401,label+' PUT returns controlled owner denial');
  headers(refused,label+' PUT');
}
eq(reads,beforeDenials,'Denied GET never reads saved DR templates');
eq(writes,0,'Denied PUT never writes saved DR templates');
user={email:'kylebrooks8605@gmail.com'};
failRead=true;
const unavailable=await route.GET();
eq(unavailable.status,503,'D1 read outage returns controlled 503, not empty defaults');
headers(unavailable,'D1 outage');
eq((await unavailable.json()).error.includes('not changed'),true,'Outage does not imply deleted settings');
failRead=false;


for(const [label,outcome] of [
 ['soft-failed',{success:false,results:[]}],
 ['missing rows',{success:true}],
 ['null rows',{success:true,results:null}],
 ['scalar rows',{success:true,results:'bad'}]
]){
 readOutcome=outcome;
 const denied=await route.GET();
 eq(denied.status,503,label+' D1 result never shows false-default saved templates');
 headers(denied,label+' D1 read failure');
 eq((await denied.json()).error.includes('not changed'),true,label+' keeps saved wording status uncertain');
}
readOutcome={success:true,results:[]};
const confirmedEmpty=await route.GET();
eq(confirmedEmpty.status,200,'True empty D1 template table may return defaults');
headers(confirmedEmpty,'Confirmed empty DR templates');
eq((await confirmedEmpty.json()).templates[0].body,'Default wording','Confirmed empty DR table uses approved defaults');
readOutcome=null;

const invalid=await put('{');
eq(invalid.status,400,'Malformed JSON returns controlled 400');headers(invalid,'Malformed body');
const nonobject=await put('[]');
eq(nonobject.status,400,'Array body rejected');headers(nonobject,'Array body');
const unknown=await put({key:'not-a-template',body:'x'});
eq(unknown.status,400,'Unknown template not saved');headers(unknown,'Unknown key');
eq(writes,0,'All malformed requests refused before D1 writes');
// QA-master write parity: previously, a truthy reset='false' erased saved
// owner wording. Cross-origin or oversized browser requests must never reach D1.
for(const [label,body,status] of [
  ['string false reset',{key:'estimate',reset:'false'},400],
  ['numeric reset',{key:'estimate',reset:1},400],
  ['reset with replacement text',{key:'estimate',reset:true,body:'Erase then edit'},400],
  ['unknown JSON field',{key:'estimate',body:'Text',admin:true},400],
  ['object-coerced template body',{key:'estimate',body:{danger:'coerce'}},400],
  ['object-coerced subject',{key:'estimate',body:'Text',subject:{}},400],
  ['oversized UTF-8 body',{key:'estimate',body:'é'.repeat(40_000)},413],
]){
  const beforeReads=reads,beforeWrites=writes,snapshot=JSON.stringify(rows);
  const denied=await put(body);
  eq(denied.status,status,label+' refuses the unsafe owner write');
  headers(denied,label);
  eq(reads,beforeReads,label+' zero DR D1 reads');
  eq(writes,beforeWrites,label+' zero DR D1 writes');
  eq(JSON.stringify(rows),snapshot,label+' custom wording preserved');
}
for(const [label,customHeaders,expected] of [
  ['foreign Origin',{'origin':'https://evil.synthetic.invalid'},403],
  ['same-site sibling Origin',{'origin':'https://sibling.dr.synthetic.invalid'},403],
  ['cross-site browser',{'sec-fetch-site':'cross-site'},403],
  ['form content type',{'origin':'https://dr.synthetic.invalid','content-type':'text/plain'},415],
  ['invalid declared length',{'content-length':'999'},400],
]){
  const beforeReads=reads,beforeWrites=writes,snapshot=JSON.stringify(rows);
  const denied=await route.PUT(new Request('https://dr.synthetic.invalid/api/message-templates',{
    method:'PUT',headers:{'content-type':'application/json',...customHeaders},
    body:JSON.stringify({key:'estimate',body:'Must not overwrite'})
  }));
  eq(denied.status,expected,label+' refused by actual DR route');
  headers(denied,label);
  eq(reads,beforeReads,label+' no D1 read');
  eq(writes,beforeWrites,label+' no D1 write');
  eq(JSON.stringify(rows),snapshot,label+' owner wording unchanged');
}
const saved=await put({key:'estimate',subject:' Revised ',body:' New owner wording '});
eq(saved.status,200,'Owner template PUT persists with original success status');headers(saved,'Saved PUT');
eq(rows[0].body,'New owner wording','Successful real D1 mock write uses normalized body');
const refreshed=await route.GET();
eq((await refreshed.json()).templates[0].subject,'Revised','GET reflects saved subject');
failWrite=true;
const lost=await put({key:'estimate',subject:'Disconnected',body:'Not confirmed'});
eq(lost.status,503,'Uncertain D1 write does not claim saved');headers(lost,'Uncertain PUT');
eq((await lost.json()).saveUncertain,true,'Uncertain write advises owner to refresh');
eq(rows[0].body,'New owner wording','Synthetic failed write did not overwrite saved data');
failWrite=false;
const reset=await put({key:'estimate',reset:true});
eq(reset.status,200,'Owner reset preserves existing response status');headers(reset,'Reset PUT');
eq(rows.length,0,'Owner reset deletes customization');
const defaultAfterReset=await route.GET();
eq((await defaultAfterReset.json()).templates[0].body,'Default wording','Defaults preserved after reset');
console.log('PASS '+checks+'/'+checks+' independent DR real template GET/PUT owner identity, private/no-store/Cookie Vary, D1 outage, save/reset and unsafe-session denials. Synthetic only.');
