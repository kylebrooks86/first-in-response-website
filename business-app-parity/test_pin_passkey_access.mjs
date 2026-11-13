/** Actual cryptographic Access assertion guards, synthetic RSA, local-only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyCloudflareAccessOwnerJwt as verify} from './shared/lib/access-passkey-identity.mjs';
const enc=new TextEncoder();
const base64url=bytes=>Buffer.from(bytes).toString('base64url');
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',
 modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);
const teamDomain='fire-testing.cloudflareaccess.com';
const audience='8ebc9cfa75c6426f9ba0c6d07aa11482';
const ownerEmail='test-owner@example.invalid';
const now=Math.floor(Date.now()/1000),kid='fire-testing-pinned-key-1';
const cfg={teamDomain,audience,ownerEmail};
let calls=0;
const fetcher=async(url,options)=>{
 assert.equal(url,'https://'+teamDomain+'/cdn-cgi/access/certs');
 assert.equal(options.method,'GET');
 calls++;
 return {ok:true,json:async()=>({keys:[{...publicJwk,kid,alg:'RS256',use:'sig'}]})};
};
async function sign(claim={},header={}){
 const payload={iss:'https://'+teamDomain,aud:[audience],sub:'test-owner-id',email:ownerEmail,
  iat:now-120,exp:now+120, ...claim};
 const h={kid,alg:'RS256',typ:'JWT',...header};
 const message=base64url(JSON.stringify(h))+'.'+base64url(JSON.stringify(payload));
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,enc.encode(message));
 return message+'.'+base64url(signature);
}
let passed=0;
const accept=async(t,settings=cfg)=>{assert.equal(await verify(t,settings,{fetcher,now}),true);passed++};
const reject=async(t,settings=cfg)=>{assert.equal(await verify(t,settings,{fetcher,now}),false);passed++};
const valid=await sign();
await accept(valid);
await reject(valid,{...cfg,audience:'different-application-audience'});
await reject(valid,{...cfg,teamDomain:'different.cloudflareaccess.com'});
await reject(valid,{...cfg,ownerEmail:'other-owner@example.invalid'});
await reject(await sign({aud:['other-audience']}));
await reject(await sign({aud:audience}));
await reject(await sign({email:'someone-else@example.invalid'}));
await reject(await sign({iss:'https://attacker.example.invalid'}));
await reject(await sign({exp:now-1}));
await reject(await sign({nbf:now+500}));
await reject(await sign({iat:now+500}));
await reject(await sign({iat:now-60*60*24*35}));
await reject(await sign({exp:now+60*60*24*35}));
await reject(await sign({sub:''}));
await reject(await sign({email:42}));
await reject(await sign({}, {alg:'none'}));
await reject(await sign({}, {alg:'HS256'}));
await reject(await sign({}, {kid:'wrong-signing-key'}));
await reject(await sign({}, {crit:['custom']}));
await reject(valid.slice(0,-4)+'abcd');
await reject('bad.header.signature');
await reject(null);
await reject('');
await reject(valid,{...cfg,teamDomain:'http://evil.example.invalid'});
await reject(valid,{...cfg,teamDomain:'fire.cloudflareaccess.com.evil.invalid'});
await reject(valid,{...cfg,teamDomain:'a..cloudflareaccess.com'});
const corrupt=valid.split('.');
await reject(corrupt[0]+'.'+base64url(JSON.stringify({email:ownerEmail,aud:[audience],
 iss:'https://'+teamDomain,sub:'test-owner-id',iat:now-120,exp:now+120,admin:true}))+'.'+corrupt[2]);
assert.ok(calls>0);passed++;
const files=[
 'adapters/qa/app/owner-auth.ts',
 'adapters/doomsday/app/owner-auth.ts',
 'adapters/independent-dr/app/owner-auth.ts',
 'adapters/independent-live/app/owner-auth.ts'
];
for(const file of files){
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 assert.match(source,/quickUnlockEnabled/);
 assert.match(source,/verifyCloudflareAccessOwnerJwt/);
 assert.match(source,/verifyAccessOwnerRequest/);
 assert.match(source,/PIN_PEPPER/);
 assert.match(source,/PIN_HASH/);
 assert.match(source,/\^\\d\{4\}\$/);
 // Quick-auth sessions must be distinguishable from legacy v1 cookies;
 // only the Access-verifying login route may mint a v2 session.
 assert.match(source,/version !== \(quickUnlockEnabled\(\) \? "v2" : "v1"\)/);
 assert.match(source,/const value = \(quickUnlockEnabled\(\) \? "v2\." : "v1\."\)/);
 passed+=8;
}
for(const file of ['adapters/qa/app/api/auth/login/route.ts',
 'adapters/doomsday/app/api/auth/login/route.ts',
 'adapters/independent-dr/app/api/auth/login/route.ts',
 'adapters/independent-live/app/api/auth/login/route.ts']){
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 assert.match(source,/if\(quickUnlockEnabled\(\)\)/);
 assert.match(source,/!await verifyAccessOwnerRequest\(request\)/);
 assert.match(source,/body\?\.method==="passkey"/);
 assert.match(source,/verifyIndependentPin/);
 assert.match(source,/rateLimitStatus/);
 passed+=5;
}

// Targeted source audit of QA app-version discoverability, prelaunch Job #
// safety and first-run semantics. This is NOT hosted biometric or D1 proof.
for(const file of ['adapters/qa/app/api/app-version/route.ts',
 'adapters/doomsday/app/api/app-version/route.ts']){
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 assert.match(source,/quickUnlockEnabled\(\)/);
 assert.match(source,/pin-or-passkey/);
 assert.match(source,/no-store/);
 passed+=3;
}
{
 const live=readFileSync(new URL('adapters/independent-live/app/owner-auth.ts',import.meta.url),'utf8');
 assert.match(live,/FIRE_JOB_NUMBERS_CANDIDATE/);
 assert.match(live,/owner-approved-schema-v1/);
 const review=readFileSync(new URL('prepare_new_independent_release_manifest.mjs',import.meta.url),'utf8');
 assert.match(review,/jobNumbersSchemaAttestation/);
 assert.match(review,/owner-verified-independent-live-job-numbers-empty-v1/);
 assert.match(review,/FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1'/);
 passed+=5;
}
{
 const home=readFileSync(new URL('shared/app/dashboard.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('shared/app/globals.css',import.meta.url),'utf8');
 const search=readFileSync(new URL('shared/components/global-search.tsx',import.meta.url),'utf8');
 assert.match(home,/summaryVerified&&metrics.estimates===0&&estimates.length===0/);
 assert.match(home,/aria-label="First job workflow"/);
 for(const label of ['Customer','Estimate','Schedule','Get paid'])assert.ok(home.includes(' · '+label));
 assert.match(home,/Nothing sends automatically/);
 assert.match(css,/fire-first-job-steps/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(search,/placeholder="Name, address or Job #"/);
 assert.match(search,/Permanent Job # lookup works|enter a full number such as Job #0001/i);
 passed+=11;
}
console.log('PASS '+passed+'/'+passed+' signed Access JWT integrity, owner/audience/issuer, short-PIN security source and all app overlays; no real credentials or provider requests.');
