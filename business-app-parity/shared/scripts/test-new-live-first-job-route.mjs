/** Actual NEW LIVE pre-activation HTTP route; no provider, no SQL writes. */
import assert from 'node:assert/strict';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
let user=null,reads=0;
const env={
 FIRE_ENV:'new-live-prelaunch',
 FIRE_NEW_LIVE_CLEAN_START:'required',
 FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
 FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
 DB:{prepare(sql){reads++;if(!/^SELECT\\b/i.test(sql.trim()))throw Error('Unexpected write');throw Error('Synthetic unavailable physical D1');}}
};
const route=createRouteFixtureLoader(resolve(fileURLToPath(new URL('../',import.meta.url))),env,()=>user)('app/api/release/new-live-clean-start/route.ts');
let checks=0;
async function expect(status,reason){
 const before=reads,response=await route.GET(),json=await response.json();
 assert.equal(response.status,status,reason);
 assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(json.releaseApproved,false);
 assert.equal(json.providerIdentityVerified,false);
 if(status!==409)assert.equal(reads,before,'denied access must not issue D1 reads');
 checks++;
}
await expect(401,'anonymous denied before touching database');
user={email:'someone-else@example.invalid'};
await expect(401,'nonowner denied before touching database');
user={email:'kylebrooks8605@gmail.com'};
env.FIRE_ENV='qa';
await expect(404,'QA cannot inspect NEW LIVE database');
env.FIRE_ENV='new-live-prelaunch';
env.FIRE_NEW_LIVE_CLEAN_START='disabled';
await expect(404,'explicit clean-start flag required');
env.FIRE_NEW_LIVE_CLEAN_START='required';
await expect(409,'uncertain physical D1 fails closed');
assert.ok(reads>0,'authorized preflight attempted read-only D1 inspection');
console.log('PASS '+checks+' actual owner-only NEW LIVE preactivation route denial and uncertain D1 cases; no provider or writes.');
