/**
 * FIRE Gate4: distinct, READ-ONLY Cloudflare public-exposure evidence.
 * NEVER uses Wrangler deploy, scripts, D1, Stripe, routes mutations or login.
 * Default and imported mode contact no provider; --capture requires an
 * already-existing scoped API token, owner Windows TTY, and makes ONLY GETs.
 * No provider credentials, raw bodies or customer data are written to disk.
 * This does NOT close Gate4 or prove Access / nonowner denial / source bytes.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const FIRE_DARK_ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const FIRE_DARK_WORKERS=Object.freeze({
  dr:'fire-fullapp-dr','new-live':'fire-fullapp-new-live'
});
const fail=reason=>{throw new Error('FIRE DARK EXPOSURE READ-ONLY STOP: '+reason)};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const apiResult=(x,label)=>{
  if(!isObj(x)||x.success!==true||!Array.isArray(x.errors)||x.errors.length||!Object.hasOwn(x,'result'))
    fail(label+' missing successful complete API response');
  return x.result;
};
const pageInfo=(x,label,page)=>{
  const info=x.result_info;
  if(!isObj(info)||!Number.isSafeInteger(info.total_pages)||
      !Number.isSafeInteger(info.total_count)||!Number.isSafeInteger(info.count)||
      !Number.isSafeInteger(info.per_page)||info.per_page<1||info.per_page>50||
      info.count<0||info.count>info.per_page||info.total_count<0||
      info.total_pages<0||info.total_pages>20||info.page!==page)
    fail(label+' pagination incomplete/ambiguous');
  // Cloudflare may return total_pages:0 for an empty collection. Zero is
  // still exactly one successfully checked (empty) first response.
  if(info.total_pages===0){
    if(page!==1||info.count!==0)fail(label+' inconsistent zero-page inventory');
    return {...info,total_pages:1};
  }
  return info;
};
export function evaluateDarkExposureEvidence(target,evidence){
  const worker=FIRE_DARK_WORKERS[target];
  if(!worker||!isObj(evidence))fail('unknown target or malformed evidence');
  const sub=apiResult(evidence.subdomain,'subdomain');
  if(!isObj(sub)||typeof sub.enabled!=='boolean'||typeof sub.previews_enabled!=='boolean')
    fail('subdomain public/preview booleans absent');
  const domains=apiResult(evidence.domains,'domains');
  if(!Array.isArray(domains)||domains.some(d=>!isObj(d)||typeof d.service!=='string'))
    fail('account custom domains inventory malformed');
  if(evidence.domainsComplete!==true)fail('account custom domains pagination not complete');
  const zones=apiResult(evidence.zones,'zones');
  if(!Array.isArray(zones)||evidence.zonesComplete!==true||
    zones.some(z=>!isObj(z)||!(/^[a-f0-9]{32}$/).test(z.id)||z.account?.id!==FIRE_DARK_ACCOUNT))
    fail('all-account zone inventory not complete or cross-account');
  if(!Array.isArray(evidence.zoneRoutes)||evidence.zoneRoutes.length!==zones.length)
    fail('routes missing for one or more zones');
  const unique=new Set();let matchingRoutes=0;
  for(const item of evidence.zoneRoutes){
    if(!isObj(item)||typeof item.zoneId!=='string'||unique.has(item.zoneId))
      fail('zone route evidence duplicated or invalid');
    unique.add(item.zoneId);
    const result=apiResult(item.response,'zone routes');
    if(!Array.isArray(result)||result.some(r=>!isObj(r)||typeof r.pattern!=='string'||
      (r.script!==undefined&&typeof r.script!=='string')))
      fail('zone route response invalid');
    matchingRoutes+=result.filter(r=>r.script===worker).length;
  }
  if(unique.size!==zones.length||zones.some(z=>!unique.has(z.id)))
    fail('zone routing response does not cover every account zone');
  const matchingDomains=domains.filter(d=>d.service===worker).length;
  const absence=sub.enabled===false&&sub.previews_enabled===false&&
    matchingDomains===0&&matchingRoutes===0;
  return Object.freeze({
    result:absence?'FIRE_DARK_EXPOSURE_INVENTORY_CLEAR':'FIRE_DARK_EXPOSURE_REQUIRES_REVIEW',
    target,worker,workersDevEnabled:sub.enabled,workersDevPreviewEnabled:sub.previews_enabled,
    targetCustomDomains:matchingDomains,targetZoneRoutes:matchingRoutes,
    zonesInspected:zones.length,accountCustomDomainsInspected:domains.length,
    completeInventoryFromSuppliedEvidence:true,publicEndpointsAbsentInSuppliedEvidence:absence,
    providerReadbackVerified:false,accessPolicyProviderVerified:false,
    hostedSourceBytesVerified:false,hostedNonownerDenialVerified:false,
    gate4Accepted:false,productionReady:false
  });
}
async function getApi(token,path){
  const url=new URL(path,'https://api.cloudflare.com');
  if(url.origin!=='https://api.cloudflare.com'||!url.pathname.startsWith('/client/v4/'))
    fail('unapproved provider GET path');
  const response=await fetch(url,{method:'GET',redirect:'error',
    signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token}});
  if(!response.ok)fail('Cloudflare GET failed with HTTP '+response.status+'; no retries');
  const raw=await response.text();
  if(raw.length>750000)fail('provider response exceeded sanitized read limit');
  try{return JSON.parse(raw)}catch{fail('Cloudflare GET was not valid JSON')}
}
export async function captureDarkExposure(target,{token,request=getApi}={}){
  if(!FIRE_DARK_WORKERS[target])fail('unknown target');
  if(typeof token!=='string'||!token.trim())fail('an existing scoped API token is required; no login or token creation');
  // request injection is only for fully offline tests. Live entry always uses getApi.
  const get=(path)=>request(token,path);
  const subdomain=await get('/client/v4/accounts/'+FIRE_DARK_ACCOUNT+'/workers/scripts/'+FIRE_DARK_WORKERS[target]+'/subdomain');
  const pages=async(path,label)=>{
    let all=[],total=null,reportedDomainCount=null;
    for(let p=1;p<=20;p++){
      const r=await get(path+(path.includes('?')?'&':'?')+'page='+p+'&per_page=50');
      const items=apiResult(r,label);
      if(!Array.isArray(items))fail(label+' not array');
      const info=pageInfo(r,label,p);
      if(total!==null&&total!==info.total_pages)fail(label+' changed between pages');
      if(info.count!==items.length)fail(label+' page item-count mismatch');
      // The domains endpoint is queried WITHOUT filters, so total_count
      // must equal all returned domains; an incomplete listing must not
      // be accepted as proof that the target Worker has no public domain.
      // The account-filtered zones endpoint has different total_count
      // semantics, so apply this additional invariant only to domains.
      if(label==='domains'){
        if(reportedDomainCount!==null&&reportedDomainCount!==info.total_count)
          fail('domains total_count changed between pages');
        reportedDomainCount=info.total_count;
      }
      total=info.total_pages;all.push(...items);
      if(p===total){
        if(label==='domains'&&info.total_count!==all.length)
          fail('domains total_count does not match exhausted pages');
        return all;
      }
      if(info.count===0)fail(label+' unexpectedly empty intermediate page');
    }
    fail(label+' exceeds page bound');
  };
  const domains=await pages('/client/v4/accounts/'+FIRE_DARK_ACCOUNT+'/workers/domains','domains');
  // Do NOT filter zone types. The zones API accepts a single type, and a
  // comma-joined filter can silently omit unrecognized/other zone types.
  // Inspect every account-scoped zone returned before claiming no routes.
  const zones=await pages('/client/v4/zones?account.id='+FIRE_DARK_ACCOUNT,'zones');
  const routes=[];
  for(const zone of zones){
    if(!isObj(zone)||!(/^[a-f0-9]{32}$/).test(zone.id)||zone.account?.id!==FIRE_DARK_ACCOUNT)
      fail('zone scope invalid before routes GET');
    routes.push({zoneId:zone.id,response:await get('/client/v4/zones/'+zone.id+'/workers/routes')});
  }
  const result=evaluateDarkExposureEvidence(target,{
    subdomain,domains:{success:true,errors:[],result:domains},domainsComplete:true,
    zones:{success:true,errors:[],result:zones},zonesComplete:true,zoneRoutes:routes
  });
  return Object.freeze({...result,providerReadbackVerified:request===getApi,
    directReadOnlyCloudflareApi:request===getApi,providerDataMutated:false,
    gate4Accepted:false,productionReady:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  try{
    if(args.length===0){
      console.log(JSON.stringify({result:'DRY_RUN_NO_PROVIDER',providerContacted:false,
        permittedTargets:Object.keys(FIRE_DARK_WORKERS),gate4Accepted:false}));
    }else if(args.length===2&&args[0]==='--capture'&&FIRE_DARK_WORKERS[args[1]]){
      if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
        process.env.CI||process.env.GITHUB_ACTIONS)fail('owner Windows interactive session only');
      const proof=await captureDarkExposure(args[1],{token:process.env.CLOUDFLARE_API_TOKEN});
      console.log(JSON.stringify(proof,null,2));
      if(!proof.publicEndpointsAbsentInSuppliedEvidence)process.exitCode=2;
    }else fail('usage: node SCRIPT (no provider) OR SCRIPT --capture dr|new-live');
  }catch(e){console.error(e.message);process.exitCode=1}
}
