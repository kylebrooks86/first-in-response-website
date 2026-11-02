import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {verifyFireAccessJWT} from "./access-jwt.mjs";
import {getFireAccessToken} from "./access-token.mjs";
import {validateLaunchMapping} from "./validate-launch-config.mjs";
const {subtle}=webcrypto;
const tdomain="fire-test.cloudflareaccess.com";
const config={teamDomain:tdomain,audience:"fire-synthetic-audience-123456789",ownerEmail:"owner@example.test"};
const pair=await subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk={...await subtle.exportKey("jwk",pair.publicKey),kid:"synthetic-RS256-key",alg:"RS256",use:"sig"};
const url64=bytes=>Buffer.from(bytes).toString("base64url");
async function sign(claims,head={alg:"RS256",kid:jwk.kid,typ:"JWT"}){
  const input=url64(JSON.stringify(head))+"."+url64(JSON.stringify(claims));
  const signed=await subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(input));
  return input+"."+url64(signed);
}
const now=2100000000;
const base={iss:"https://"+tdomain,aud:[config.audience],email:config.ownerEmail,iat:now,exp:now+1800};
const fetcher=async url=>{
  assert.equal(url,"https://"+tdomain+"/cdn-cgi/access/certs");
  return {ok:true,json:async()=>({keys:[jwk]})};
};
test("signed owner Access JWT accepted without a stored PIN or client secret",async()=>{
  const identity=await verifyFireAccessJWT(await sign(base),config,{fetcher,subtle,now});
  assert.equal(identity?.email,config.ownerEmail);
});
test("browser Cloudflare JWT cookie fallback passes IDENTICAL RS256 owner validation",async()=>{
 const good=await sign(base);
 const fromCookie=getFireAccessToken(new Headers({"cookie":"x=other; CF_Authorization="+good+"; y=other"}));
 assert.equal(fromCookie,good);
 const identity=await verifyFireAccessJWT(fromCookie,config,{fetcher,subtle,now});
 assert.equal(identity?.email,config.ownerEmail);
 const encoded=getFireAccessToken(new Headers({"cookie":"CF_Authorization="+encodeURIComponent(good)}));
 assert.equal(encoded,good);
});
test("signed Access assertion always takes precedence; cannot fall back after header validation failure",async()=>{
 const good=await sign(base);
 const bad=await sign({...base,email:"intruder@example.test"});
 const headers=new Headers({"cf-access-jwt-assertion":bad,"cookie":"CF_Authorization="+good});
 assert.equal(getFireAccessToken(headers),bad);
 assert.equal(await verifyFireAccessJWT(getFireAccessToken(headers),config,{fetcher,subtle,now}),null);
});
test("cookie-only must never grant access without valid signed owner JWT",async()=>{
 const good=await sign(base);
 const invalid=[
  "",
  "CF_Authorization=",
  "Cf-Access-Authenticated-User-Email=owner@example.test",
  "CF_Authorization=a.b.c",
  "CF_Authorization="+good+"; CF_Authorization="+good,
  "CF_Authorization="+good.slice(0,-3)+"abc",
  "CF_Authorization="+await sign({...base,aud:["other-audience"]}),
  "CF_Authorization="+await sign({...base,iss:"https://attacker.cloudflareaccess.com"}),
  "CF_Authorization="+await sign({...base,email:"attacker@example.test"}),
 ];
 for(const cookie of invalid){
  const token=getFireAccessToken(new Headers({cookie}));
  assert.equal(await verifyFireAccessJWT(token,config,{fetcher,subtle,now}),null,cookie.slice(0,70));
 }
 assert.equal(getFireAccessToken(new Headers({cookie:"CF_Authorization="+good,
  "cf-access-jwt-assertion":""})), "");
 assert.equal(getFireAccessToken(new Headers({"cf-access-authenticated-user-email":"owner@example.test"})),null);
});
test("invalid forged or cross-environment tokens fail closed",async()=>{
  const good=await sign(base);
  for(const token of [
    null,good.slice(0,-3)+"xyz",
    await sign({...base,email:"intruder@example.test"}),
    await sign({...base,iss:"https://another.cloudflareaccess.com"}),
    await sign({...base,aud:["wrong-synthetic-audience"]}),
    await sign({...base,exp:now-1}),
    await sign({...base,nbf:now+3600}),
    await sign({...base,iat:now+3600}),
    await sign({...base,exp:now+40*86400}),
    await sign(base,{alg:"none",kid:jwk.kid}),
    await sign(base,{alg:"HS256",kid:jwk.kid})
  ])assert.equal(await verifyFireAccessJWT(token,config,{fetcher,subtle,now}),null);
  for(const broken of [
    {...config,audience:"wrong-synthetic-audience"},
    {...config,ownerEmail:"intruder@example.test"},
    {...config,teamDomain:"untrusted.attacker.invalid"},
    {...config,ownerEmail:"Owner@EXAMPLE.TEST"}
  ])assert.equal(await verifyFireAccessJWT(good,broken,{fetcher,subtle,now}),null);
});
test("provider certificate failures are denied without a fallback",async()=>{
  const token=await sign({...base,iss:"https://different-team.cloudflareaccess.com"});
  const different={...config,teamDomain:"different-team.cloudflareaccess.com"};
  assert.equal(await verifyFireAccessJWT(token,different,{fetcher:async()=>{throw Error("offline")},subtle,now}),null);
});
const original=JSON.parse(readFileSync(new URL("./wrangler.NONDEPLOYABLE.example.json",import.meta.url)));
test("committed staging/LIVE template is intentionally not deployable",()=>{
  assert.throws(()=>validateLaunchMapping(original),/FIRE LAUNCH BLOCKED/);
});
function valid(){
  const x=structuredClone(original);
  for(const [name,id] of [["staging","a1411414-1111-4111-8111-a14114141111"],["production","b2522525-2222-4222-8222-b25225252222"]]){
    const e=x.env[name];e.d1_databases[0].database_name="fire-business-app-"+name+"-db-future";
    e.d1_databases[0].database_id=id;
    e.vars.SITE_ORIGIN="https://fire-"+name+".example.com";
    e.routes=[{pattern:"fire-"+name+".example.com",custom_domain:true}];
  }
  return x;
}
test("synthetic independent staging/production resource mappings pass offline ONLY",()=>{
  const v=validateLaunchMapping(valid());
  assert.equal(v.status,"MAPPING_READY_FOR_PROVIDER_REVIEW");
  assert.equal(v.publicationAuthorized,false);
  assert.equal(v.accessPolicyVerified,false);
});
test("no shared, QA, Doomsday, rogue route, live Stripe or weak auth mappings",()=>{
  const mutations=[
    x=>x.env.production.d1_databases[0].database_id=x.env.staging.d1_databases[0].database_id,
    x=>x.env.staging.d1_databases[0].database_id="8ccfb1f8-1657-4074-b1b2-47de78f95003",
    x=>x.env.production.d1_databases[0].database_id="afb2c05a-d794-4a9a-b580-924ce01c26ad",
    x=>x.env.staging.d1_databases[0].database_id="00000000-0000-4000-8000-000000000000", // known local Vite placeholder
    x=>x.env.production.d1_databases[0].database_id="00000000-0000-0000-0000-000000000000", // nil UUID
    x=>x.env.production.vars.FIRE_ACCESS_REQUIRED="",
    x=>x.env.production.vars.FIRE_STRIPE_MODE="live",
    x=>x.env.production.vars.FIRE_QA_SYNTHETIC_ONLY="enabled",
    x=>x.env.staging.routes=[],
    x=>x.env.production.vars.SITE_ORIGIN="https://fire-app.kylebrooks8605.chatgpt.site",
    x=>x.env.production.vars.FIRE_SECRET="never-allow",
    x=>x.env.production.r2_buckets=[{binding:"BUCKET",bucket_name:"unverified"}],
    x=>x.env.staging.workers_dev=true
  ];
  for(const mutate of mutations){const x=valid();mutate(x);assert.throws(()=>validateLaunchMapping(x),/FIRE LAUNCH BLOCKED/);}
});
