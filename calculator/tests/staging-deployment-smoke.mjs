#!/usr/bin/env node
// Smoke-check a separately deployed staging calculator before iPhone acceptance.
// Usage: node calculator/tests/staging-deployment-smoke.mjs https://STAGING-HOST/calculator/
// IMPORTANT: pass a separately verified staging URL, never the known LIVE calculator or production website.
import assert from 'node:assert/strict';

const candidate=process.argv[2];
if(!candidate){console.error('Usage: node calculator/tests/staging-deployment-smoke.mjs https://STAGING-HOST/calculator/');process.exit(2)}
const url=new URL(candidate);
if(!['https:','http:'].includes(url.protocol))throw Error('Only HTTP(S) is supported');
const path=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
if(!path.endsWith('/calculator/'))throw Error('Expected a /calculator/ staging root');
const base=new URL(path,url);
const forbidden=['fire-field-calculator-fir.kylebrooks8605.chatgpt.site','firstinresponseexteriors.com','www.firstinresponseexteriors.com','kylebrooks86.github.io'];
if(forbidden.includes(base.hostname))throw Error('This URL is known production, LIVE, or unverified GitHub Pages, not an approved staging host');

const expectedCache='fire-field-calculator-v18-best-of-both-210';
const expectedEntry='./full-v18.js?v=71';
const expectedHydration='./v18-live-backup-hydration.js?v=12';
const expectedHelpers='./v18-interactions.js?v=21';
const get=async u=>{
  const response=await fetch(u,{redirect:'follow',cache:'no-store'});
  if(!response.ok)throw Error(response.status+' '+response.url);
  return response.text();
};
const sw=await get(new URL('sw.js',base));
const html=await get(new URL('index.html',base));
const loader=await get(new URL(expectedEntry,base));
for(const [condition,message] of [
  [sw.includes(expectedCache),'Wrong service-worker cache generation'],
  [sw.includes(expectedEntry),'Service worker has wrong entry version'],
  [sw.includes(expectedHydration),'Service worker has wrong hydration module'],
  [sw.includes(expectedHelpers),'Service worker has wrong imported-helper module'],
  [html.includes(expectedEntry),'HTML is not loading the expected entry'],
  [loader.includes(expectedHydration),'Loader has wrong hydration version'],
  [loader.includes(expectedHelpers),'Loader has wrong helper version']
])assert.ok(condition,message);
const cacheMatches=[...sw.matchAll(/'(\.\/[^']+)'/g)].map(x=>x[1]);
const assets=cacheMatches.filter(x=>x.startsWith('./')||x.startsWith('../'));
const unique=[...new Set(assets)];
const failures=[];
for(const asset of unique){
  try{
    const res=await fetch(new URL(asset,base),{method:'GET',redirect:'follow',cache:'no-store'});
    if(!res.ok)failures.push(asset+' HTTP '+res.status);
  }catch(e){failures.push(asset+' '+e.message)}
}
if(failures.length)throw Error('Missing deployed assets:\n'+failures.join('\n'));
console.log('STAGING DEPLOYMENT SMOKE PASS base='+base.href+' cache='+expectedCache+' assets='+unique.length);
console.log('NOTE: This verifies HTTP asset availability and code identity only. It does not test runtime UI, actual offline behavior, or iPhone Safari.');
