import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyFireAccessJWT} from "./access-jwt.mjs";
const {subtle}=webcrypto;
const pair=await subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk={...await subtle.exportKey("jwk",pair.publicKey),kid:"synthetic-pinned-rsa-key",alg:"RS256",use:"sig"};
const b64=x=>Buffer.from(x instanceof Uint8Array?x:JSON.stringify(x)).toString("base64url");
const now=Math.floor(Date.now()/1000);
async function signed(config,patch={}){
 const h=b64({alg:"RS256",kid:jwk.kid,typ:"JWT"});
 const p=b64({iss:"https://"+config.teamDomain,aud:config.audience,email:config.ownerEmail,exp:now+600,iat:now-10,...patch});
 const data=h+"."+p;
 return data+"."+b64(Buffer.from(await subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(data))));
}
const cfg=domain=>({teamDomain:domain+".cloudflareaccess.com",audience:"synthetic-pinned-audience-123456789",ownerEmail:"owner@example.test"});
const offline=async()=>{throw Error("offline");};
const snapshot=cfg=>({teamDomain:cfg.teamDomain,fetchedAt:Date.now(),keys:[jwk]});
test("fresh exact-team public JWKS works offline ONLY after valid RSA owner signature",async()=>{
 const c=cfg("pin-good-2026");
 const jwt=await signed(c);
 const ok=await verifyFireAccessJWT(jwt,c,{fetcher:offline,subtle,now,pinnedSnapshot:snapshot(c)});
 assert.equal(ok?.email,c.ownerEmail);
 const tampered=jwt.slice(0,-1)+(jwt.endsWith("a")?"b":"a");
 assert.equal(await verifyFireAccessJWT(tampered,c,{fetcher:offline,subtle,now,pinnedSnapshot:snapshot(c)}),null);
});
test("missing/expired/wrong team snapshots ALWAYS fail closed",async()=>{
 const c=cfg("pin-deny-2026");
 const jwt=await signed(c);
 const opts={fetcher:offline,subtle,now};
 for(const fallback of [
  {teamDomain:"",fetchedAt:Date.now(),keys:[jwk]},
  {...snapshot(c),fetchedAt:Date.now()-15*24*60*60*1000},
  {...snapshot(c),fetchedAt:Date.now()+10*60*1000},
  {...snapshot(c),keys:[{...jwk,kid:"wrong-key-id"}]},
  {...snapshot(c),keys:[{...jwk,d:"private-key-NEVER-accepted"}]},
  {...snapshot(c),keys:[{...jwk,n:"fake"}]},
  {...snapshot(c),keys:[jwk,jwk]},
  {...snapshot(c),keys:[]}
 ])assert.equal(await verifyFireAccessJWT(jwt,c,{...opts,pinnedSnapshot:fallback}),null);
});
test("pinned public key cannot bypass exp, owner, issuer or aud validation",async()=>{
 const c=cfg("pin-claims-2026");
 for(const claims of [
  {email:"attacker@example.test"}, {aud:"wrong-aud"},
  {iss:"https://attacker.cloudflareaccess.com"}, {exp:now-1},
  {nbf:now+1000},{iat:now+1000}
 ]){
  const jwt=await signed(c,claims);
  assert.equal(await verifyFireAccessJWT(jwt,c,{fetcher:offline,subtle,now,pinnedSnapshot:snapshot(c)}),null);
 }
});
test("valid live keys remain authoritative; snapshot cannot revive revoked kid",async()=>{
 const c=cfg("pin-rotation-2026");
 const jwt=await signed(c);
 const response=async()=>({ok:true,json:async()=>({keys:[{...jwk,kid:"new-rotated-kid"}]})});
 assert.equal(await verifyFireAccessJWT(jwt,c,{fetcher:response,subtle,now,pinnedSnapshot:snapshot(c)}),null);
});
