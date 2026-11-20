// Historical fallback regression: permanent FIRE auth must NEVER trust a
// key snapshot, even if it is valid RSA public material and recently fetched.
import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyFireAccessJWT} from "./access-jwt.mjs";
const subtle=webcrypto.subtle;
const pair=await subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
 publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const key={...await subtle.exportKey("jwk",pair.publicKey),kid:"obsolete-pinned-public-key",alg:"RS256",use:"sig"};
const now=Math.floor(Date.now()/1000);
const c={teamDomain:"legacy-pinned-test.cloudflareaccess.com",audience:"old-audience-0123456789-abcdef",ownerEmail:"owner@example.test"};
const b64=x=>Buffer.from(x instanceof Uint8Array?x:JSON.stringify(x)).toString("base64url");
async function jwt(claims={}){
 const h=b64({alg:"RS256",kid:key.kid});
 const p=b64({iss:"https://"+c.teamDomain,aud:c.audience,email:c.ownerEmail,iat:now-60,exp:now+600,...claims});
 const text=h+"."+p;
 const sig=await subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(text));
 return text+"."+b64(new Uint8Array(sig));
}
test("permanent verifier rejects offline key snapshots even if old options are passed",async()=>{
 const signed=await jwt();
 const snapshot={teamDomain:c.teamDomain,fetchedAt:Date.now(),keys:[key]};
 const offline=async()=>{throw Error("offline")};
 // JS forwards ignored legacy options; no secret key data ever used.
 assert.equal(await verifyFireAccessJWT(signed,c,{fetcher:offline,subtle,now,pinnedSnapshot:snapshot,allowPinned:true}),null);
 assert.equal(await verifyFireAccessJWT(signed,c,{fetcher:offline,subtle,now,pinnedSnapshot:snapshot}),null);
});
test("permanent verifier rejects expired, forged and wrong-owner assertions while live keys are reachable",async()=>{
 const live=async url=>({ok:true,url,json:async()=>({keys:[key]})});
 for(const claims of [{email:"attacker@example.test"},{exp:now-1},{aud:"wrong"},{iss:"https://fake.cloudflareaccess.com"}]){
  assert.equal(await verifyFireAccessJWT(await jwt(claims),c,{fetcher:live,subtle,now,forceRefresh:true}),null);
 }
 const t=await jwt();
 const p=t.split(".");p[2]=(p[2][0]==="a"?"b":"a")+p[2].slice(1);
 assert.equal(await verifyFireAccessJWT(p.join("."),c,{fetcher:live,subtle,now,forceRefresh:true}),null);
 assert.equal((await verifyFireAccessJWT(t,c,{fetcher:live,subtle,now,forceRefresh:true}))?.email,c.ownerEmail);
});
