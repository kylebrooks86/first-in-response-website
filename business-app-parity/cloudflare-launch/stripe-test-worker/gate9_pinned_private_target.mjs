/**
 * FIRE Gate9 PRIVATE target identity — grounded in retained owner Cloudflare
 * Access workflow (FIRE-TEST-Access-7-Paths-Guarded-V2.txt, Nov 2 2026).
 *
 * These are NON-secret resource IDs; NEVER supply or print API tokens,
 * Cloudflare Access credentials, Stripe webhook secrets or bearer JWTs.
 * The account, Worker, app and physical D1 UUIDs are NOT interchangeable.
 *
 * These factories remain libraries; NO execution, CLI, owner write consent,
 * provider request or private token source is provided by this file.
 */
import {createGate9ReadOnlyApi} from './gate9_cloudflare_readonly_adapter.mjs';
import {createGuardedGate9Transport} from './gate9_cloudflare_guarded_transport.mjs';
import {WORKER,PREDECESSOR,DB_UUID} from './gate9_inactive_fullapp_contract.mjs';

export const FIRE_CF_ACCOUNT_ID='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const FIRE_CF_WORKER_ID='72f9cab371974bc8811da05f44976fa9';
export const FIRE_CF_ACCESS_APP_ID='09dbb414-997f-494f-85a5-a3a65a5a92ef';
const fail=()=>{throw Error('STOP: Gate9 pinned Cloudflare TEST target mismatch; no provider change.');};
export function requirePinnedFireCloudflareTarget({accountId,workerName,workerId,d1Id,activeVersion}){
  if(accountId!==FIRE_CF_ACCOUNT_ID||workerName!==WORKER||
     workerId!==FIRE_CF_WORKER_ID||d1Id!==DB_UUID||
     activeVersion!==PREDECESSOR)fail();
  return true;
}
export function createPinnedFireGate9ReadOnlyApi({
  tokenProvider,fetchImpl,timeoutMs=15000
}){
  requirePinnedFireCloudflareTarget({
    accountId:FIRE_CF_ACCOUNT_ID,workerName:WORKER,workerId:FIRE_CF_WORKER_ID,
    d1Id:DB_UUID,activeVersion:PREDECESSOR
  });
  return createGate9ReadOnlyApi({
    accountId:FIRE_CF_ACCOUNT_ID,tokenProvider,fetchImpl,timeoutMs
  });
}
export function createPinnedFireGate9PrivateTransport({
  tokenProvider,fetchImpl,permissionGate,clientDir,approvedManifest,
  timeoutMs=30000
}){
  requirePinnedFireCloudflareTarget({
    accountId:FIRE_CF_ACCOUNT_ID,workerName:WORKER,workerId:FIRE_CF_WORKER_ID,
    d1Id:DB_UUID,activeVersion:PREDECESSOR
  });
  return createGuardedGate9Transport({
    accountId:FIRE_CF_ACCOUNT_ID,tokenProvider,fetchImpl,permissionGate,
    clientDir,approvedManifest,timeoutMs
  });
}
