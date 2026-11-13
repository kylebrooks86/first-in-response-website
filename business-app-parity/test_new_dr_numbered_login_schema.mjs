/** DR-only negative contract: permanent Job # schema must be verified on the
 * actually bound independent D1 BEFORE any owner auth method issues a session.
 * Source-only/static guard; no Cloudflare, passwords, provider or D1 writes.
 * Reuse accepted #242 NEW LIVE numeric D1 tests rather than re-run them.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareReviewedIndependentManifest} from './prepare_new_independent_release_manifest.mjs';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const auth=read('./adapters/independent-dr/app/owner-auth.ts');
const route=read('./adapters/independent-dr/app/api/auth/login/route.ts');
let checks=0;
const check=(name,verify)=>{verify();checks++};

check('DR owner environment requires real permanent Job # source flag',()=>{
 assert.match(auth,/FIRE_DR_AUTH_ENABLED !== "owner-approved"/);
 assert.match(auth,/FIRE_JOB_NUMBERS_CANDIDATE !== "owner-approved-schema-v1"/);
 assert.match(auth,/FIRE_CUSTOMER_NUMBERS_CANDIDATE !== "owner-approved-schema-v1"/);
});
check('DR explicitly imports physical DB Job # checker',()=>{
 assert.match(auth,/import \{jobNumberingReady\} from "\.\.\/lib\/job-numbering\.mjs";/);
 assert.match(auth,/import \{customerNumberingReady\} from "\.\.\/lib\/customer-numbering\.mjs";/);
 assert.match(auth,/export async function verifiedDrJobNumberSchema\(\)/);
 assert.match(auth,/!env\.DB/);
 assert.match(auth,/await jobNumberingReady\(env\.DB, env\)/);
 assert.match(auth,/await customerNumberingReady\(env\.DB, env\)/);
 assert.match(auth,/await immutableNumberingTriggersReady\(env\.DB\)/);
 assert.match(auth,/catch \{ return false; \}/);
});
check('DR long-passphrase authentication never bypasses D1',()=>{
 const method=auth.indexOf('export async function verifyIndependentPassword');
 assert(method>=0);
 const guard=auth.indexOf('if (!await verifiedDrJobNumberSchema()) return false;',method);
 const digest=auth.indexOf('crypto.subtle.digest(',method);
 assert(guard>method && digest>guard);
});
check('DR login checks schema before any PIN, passkey or passphrase session',()=>{
 const start=route.indexOf('export async function POST');
 const guard=route.indexOf('if (!await verifiedDrJobNumberSchema())',start);
 const quick=route.indexOf('if(quickUnlockEnabled())',start);
 const pass=route.indexOf('await verifyIndependentPassword',start);
 const firstCookie=route.indexOf('await independentSessionCookie()',start);
 assert(start>=0 && guard>start && quick>guard && pass>guard && firstCookie>guard);
 assert.match(route.slice(guard,quick),/status:503/);
 assert.match(route.slice(guard,quick),/no-store/);
 assert.doesNotMatch(route.slice(guard,quick),/set-cookie/);
});
check('DR sign-in gate has no schema writes or automatic repair',()=>{
 const block=auth.slice(auth.indexOf('export async function verifiedDrJobNumberSchema'),auth.indexOf('\nfunction secrets()'));
 assert.match(block,/jobNumberingReady\(env\.DB, env\)/);
 assert.match(block,/customerNumberingReady\(env\.DB, env\)/);
 assert.doesNotMatch(block,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bDROP\b|migrat|wrangler/i);
});
const manifest={
 name:'fire-fullapp-dr',workers_dev:true,
 secrets:{required:['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']},
 vars:{FIRE_ENV:'isolated-dr',SITE_ORIGIN:'https://fire-fullapp-dr.kyle-bfc.workers.dev',FIRE_DR_AUTH_ENABLED:'blocked'},
 d1_databases:[{binding:'DB',database_name:'fire-fullapp-dr-db',database_id:'00000000-0000-4000-8000-000000000000'}],
 r2_buckets:[]
};
const options={databaseId:'54a5e470-2ae3-471b-a2db-ea8bdf092513',photoStorageMode:'owner-device-zip',resourceAttestation:'owner-checked-independent-dr'};
check('DR manifest refuses owner auth with no numbered schema attestation',()=>{
 assert.throws(()=>prepareReviewedIndependentManifest('independent-dr',manifest,{
  ...options,enableAuth:true,authAttestation:'owner-approved-independent-dr-auth'
 }),/BLOCKED/);
});
check('DR manifest remains auth blocked before recovery',()=>{
 const prepared=prepareReviewedIndependentManifest('independent-dr',manifest,{...options,enableAuth:false});
 assert.equal(prepared.config.vars.FIRE_DR_AUTH_ENABLED,'blocked');
 assert.equal(prepared.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,undefined);
 assert.deepEqual(prepared.config.r2_buckets,[]);
});
check('DR reviewed numbered schema still requires physically verified provider readiness',()=>{
 const prepared=prepareReviewedIndependentManifest('independent-dr',manifest,{
  ...options,enableAuth:true,authAttestation:'owner-approved-independent-dr-auth',
  jobNumbersSchemaAttestation:'owner-verified-independent-dr-job-numbers-v1',
  customerNumbersSchemaAttestation:'owner-verified-independent-dr-customer-numbers-v1'
 });
 assert.equal(prepared.config.vars.FIRE_DR_AUTH_ENABLED,'owner-approved');
 assert.equal(prepared.config.vars.FIRE_JOB_NUMBERS_CANDIDATE,'owner-approved-schema-v1');
 assert.equal(prepared.config.vars.FIRE_CUSTOMER_NUMBERS_CANDIDATE,'owner-approved-schema-v1');
 assert.equal(prepared.evidence.jobNumberSchemaPhysicallyVerified,false);
 assert.equal(prepared.evidence.providerResourcesIndependentlyVerified,false);
 assert.equal(prepared.evidence.ownerApprovedDeployment,false);
});
console.log('PASS '+checks+'/'+checks+' targeted DR bound-D1 numbered-login protection; no hosted changes.');
