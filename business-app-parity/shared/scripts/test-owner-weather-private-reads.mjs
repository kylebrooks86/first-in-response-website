/** Targeted actual FIRE owner daily-weather route private-cache regression.
 * No live NWS, photo routes, D1, Cloudflare or Stripe access.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const path='app/api/weather/route.ts';
const source=readFileSync(path,'utf8').replace(/^import .*;\n/gm,'');
const prefix=`const getChatGPTUser=async()=>globalThis.__fireDailyOwner;
const loadTulsaWeather=async()=>{globalThis.__fireDailyLoads++;if(globalThis.__fireDailyOutage)throw Error('synthetic outage');return {location:'Tulsa',daily:[]};};
`;
const code=ts.transpileModule(prefix+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const route=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let count=0;const eq=(actual,expected,message)=>{assert.equal(actual,expected,message);count++;};
const privateHeaders=(response,cache)=>{
 eq(response.headers.get('cache-control'),cache,'Expected private owner-only cache directive');
 eq(response.headers.get('vary'),'Cookie','Session cache must vary by Cookie');
 eq(response.headers.get('x-content-type-options'),'nosniff','MIME sniffing refused');
};
globalThis.__fireDailyOwner=null;globalThis.__fireDailyOutage=false;globalThis.__fireDailyLoads=0;
let response=await route.GET();eq(response.status,401,'Anonymous daily weather refused');
privateHeaders(response,'private, no-store');eq(globalThis.__fireDailyLoads,0,'Anonymous never calls upstream');
globalThis.__fireDailyOwner={};
response=await route.GET();eq(response.status,401,'Missing-email identity denied safely');
privateHeaders(response,'private, no-store');eq(globalThis.__fireDailyLoads,0,'Invalid identity never calls upstream');
globalThis.__fireDailyOwner={email:'other@example.invalid'};
response=await route.GET();eq(response.status,401,'Different principal denied');
privateHeaders(response,'private, no-store');eq(globalThis.__fireDailyLoads,0,'Nonowner never calls upstream');
globalThis.__fireDailyOwner={email:'kylebrooks8605@gmail.com'};
response=await route.GET();eq(response.status,200,'Owner daily forecast allowed');
privateHeaders(response,'private, max-age=300');eq((await response.json()).location,'Tulsa','Original owner forecast preserved');
eq(globalThis.__fireDailyLoads,1,'Only owner called upstream');
globalThis.__fireDailyOutage=true;
response=await route.GET();eq(response.status,503,'Synthetic NWS outage returns 503');
privateHeaders(response,'private, no-store');eq(globalThis.__fireDailyLoads,2,'Outage attempted only owner upstream');
console.log('PASS '+count+' original daily-weather real route 200/401/503 privacy, owner identity and fail-closed no-remote negative checks.');
