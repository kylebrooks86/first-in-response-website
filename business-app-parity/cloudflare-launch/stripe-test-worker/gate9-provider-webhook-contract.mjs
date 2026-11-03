/**
 * SOURCE-ONLY / OFFLINE: Gate 9 cross-provider identity and exception check.
 * Does NOT create an endpoint, set secrets, edit Access, deploy, or hit APIs.
 * Require actual provider-read values for any later real review. Synthetic
 * fixtures passed in CI are NOT evidence of hosted configuration.
 *
 * Cloudflare Workers Access supports exact worker destination overrides:
 * {type:'worker', worker_id:'provider-id', overrides:[{behavior:'public',path_pattern:'...'}]}.
 * Stripe webhook endpoint metadata is returned by the test-mode API.
 */
import {
  REQUIRED_PUBLIC_ACCESS_PATHS, OWNER_ONLY_PATH_SAMPLES,
  accessPathPatternMatches,
} from '../public-access-contract.mjs';
import {
  STRIPE_TEST_WEBHOOK_PATH,
  STRIPE_TEST_REQUIRED_EVENTS,
  STRIPE_TEST_PROPOSED_OVERRIDE,
  reviewTestWebhookOverride,
} from './webhook-path-contract.mjs';

export const GATE9_TEST_WORKER='fire-stripe-test-20261101';
export const GATE9_TEST_ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
export const GATE9_TEST_CALLBACK=GATE9_TEST_ORIGIN+STRIPE_TEST_WEBHOOK_PATH;
// This legacy endpoint is forbidden as the new refund-test callback.
export const LEGACY_SITES_CALLBACK='https://fire-app.kylebrooks8605.chatgpt.site/api/payments/webhook';

function stop(reason){throw Error('FIRE GATE9 PROVIDER ISOLATION BLOCKED: '+reason);}
function obj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function exactKeys(v,keys){return obj(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');}
function reviewedOverrides(overrides){
  if(!Array.isArray(overrides))stop('Access overrides must be a complete array');
  const paths=[];
  for(const p of overrides){
    if(!exactKeys(p,['behavior','path_pattern'])||p.behavior!=='public'||typeof p.path_pattern!=='string')
      stop('Unreviewed Access override shape or behavior');
    if(!REQUIRED_PUBLIC_ACCESS_PATHS.includes(p.path_pattern))
      stop('Unapproved existing public path: '+p.path_pattern);
    paths.push(p.path_pattern);
  }
  if(new Set(paths).size!==paths.length)stop('Duplicate public Access path');
  for(const privatePath of OWNER_ONLY_PATH_SAMPLES){
    if(paths.some(p=>accessPathPatternMatches(p,privatePath)))
      stop('Existing Access override exposes owner/private route');
  }
  return paths;
}
function assertWorkerDestination(destination,expectedWorkerId){
  if(typeof expectedWorkerId!=='string'||expectedWorkerId.length<4||expectedWorkerId.length>256||
     !/^[a-zA-Z0-9_-]+$/.test(expectedWorkerId))
    stop('Provider-verified Worker ID required; never infer from app name');
  if(!exactKeys(destination,['type','worker_id','overrides'])||destination.type!=='worker'||
     destination.worker_id!==expectedWorkerId)stop('Wrong Access destination/Worker');
  return destination.overrides;
}
/**
 * Compares one exact provider Worker Access destination BEFORE/AFTER proposal.
 * Preserves all previously reviewed customer paths; adds ONLY exact webhook.
 * Cannot attest actual provider state, matching methods or inherited policies.
 */
export function reviewWebhookAccessDelta({expectedWorkerId,before,after}={}){
  const existing=reviewedOverrides(assertWorkerDestination(before,expectedWorkerId));
  const next=assertWorkerDestination(after,expectedWorkerId);
  if(!Array.isArray(next)||next.length!==existing.length+1)
    stop('Access must add exactly ONE new exception without removing existing rules');
  const webhook=next.filter(x=>x?.path_pattern===STRIPE_TEST_WEBHOOK_PATH);
  if(webhook.length!==1)stop('Exactly one exact Stripe TEST callback exception required');
  reviewTestWebhookOverride(webhook[0]);
  const other=reviewedOverrides(next.filter(x=>x.path_pattern!==STRIPE_TEST_WEBHOOK_PATH));
  if(other.length!==existing.length||other.some(p=>!existing.includes(p)))
    stop('Existing customer exceptions must remain identical');
  for(const privatePath of OWNER_ONLY_PATH_SAMPLES.filter(p=>p!==STRIPE_TEST_WEBHOOK_PATH)){
    if(next.some(p=>accessPathPatternMatches(p.path_pattern,privatePath)))
      stop('New Access plan exposes owner/private route '+privatePath);
  }
  return Object.freeze({
    status:'SOURCE_ONLY_EXACT_TEST_WEBHOOK_DELTA',
    worker:GATE9_TEST_WORKER,origin:GATE9_TEST_ORIGIN,
    addedPublicPath:STRIPE_TEST_WEBHOOK_PATH,
    existingExceptionsPreserved:existing.length,
    providerVerified:false,cloudflarePolicyApplied:false,
    endpointCreated:false,secretConfigured:false,signedDeliveryVerified:false,
    stripeModeEnabled:false,gate9Accepted:false,publicationAuthorized:false,
  });
}

/**
 * Read-only review of a NEW, provider-returned Stripe TEST endpoint and
 * preserved legacy endpoint. No secrets, events or customer data emitted.
 * Never treats a proposed endpoint's presence as successful signed delivery.
 */
export function reviewStripeTestEndpointMetadata({legacyBefore,legacyAfter,newTestEndpoint}={}){
  const goodLegacy=(e)=>obj(e)&&typeof e.id==='string'&&/^we_[a-zA-Z0-9]+$/.test(e.id)&&
    e.url===LEGACY_SITES_CALLBACK&&e.livemode===false&&e.status==='enabled'&&
    Array.isArray(e.enabled_events)&&e.enabled_events.every(x=>typeof x==='string');
  if(!goodLegacy(legacyBefore)||!goodLegacy(legacyAfter))
    stop('Verified original legacy TEST webhook inventory required');
  if(JSON.stringify(legacyAfter)!==JSON.stringify(legacyBefore))
    stop('Legacy Sites webhook must not be changed or repointed');
  const endpoint=newTestEndpoint;
  if(!obj(endpoint)||typeof endpoint.id!=='string'||!/^we_[a-zA-Z0-9]+$/.test(endpoint.id)||
     endpoint.id===legacyBefore.id||endpoint.url!==GATE9_TEST_CALLBACK||endpoint.livemode!==false||
     endpoint.status!=='enabled')stop('New endpoint must be separate, enabled TEST-only on exact Worker');
  if(!Array.isArray(endpoint.enabled_events)||endpoint.enabled_events.length!==STRIPE_TEST_REQUIRED_EVENTS.length||
     new Set(endpoint.enabled_events).size!==STRIPE_TEST_REQUIRED_EVENTS.length||
     STRIPE_TEST_REQUIRED_EVENTS.some(e=>!endpoint.enabled_events.includes(e)))
    stop('New endpoint must subscribe to exactly five reviewed event types');
  return Object.freeze({
    status:'SOURCE_ONLY_SEPARATE_TEST_ENDPOINT_CONTRACT',
    callback:GATE9_TEST_CALLBACK,events:STRIPE_TEST_REQUIRED_EVENTS.length,
    originalLegacyEndpointPreserved:true,
    providerVerified:false,endpointCreatedOrEnabledByThisCode:false,
    secretConfigured:false,signedDeliveryVerified:false,refundLedgerVerified:false,
    stripeModeEnabled:false,gate9Accepted:false,publicationAuthorized:false,
  });
}
