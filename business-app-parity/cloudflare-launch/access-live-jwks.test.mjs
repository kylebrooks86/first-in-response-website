import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyFireAccessJWT} from "./access-jwt.mjs";
const subtle=webcrypto.subtle;
const pair=await subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const key={...await subtle.exportKey("jwk",pair.publicKey),kid:"fire-current-provider-key",alg:"RS256",use:"sig"};
const now=Math.floor(Date.now()/1000);
const enc=x=>Buffer.from(x instanceof Uint8Array?x:JSON.stringify(x)).toString("base64url");
const config=i=>({teamDomain:"fire-live-test-"+i+".cloudflareaccess.com",audience:"test-audience-abcdef1234567890",ownerEmail:"fire-owner@example.test"});
async function token(c,claims={}){
  const h=enc({alg:"RS256",typ:"JWT",kid:key.kid});
  const p=enc({iss:"https://"+c.teamDomain,aud:c.audience,email:c.ownerEmail,iat:now-30,exp:now+3600,...claims});
  const part=h+"."+p;
  const sig=await subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(part));
  return part+"."+enc(new Uint8Array(sig));
}
const pinned=c=>({teamDomain:c.teamDomain,fetchedAt:Date.now(),keys:[key]});
const offline=async()=>{throw Error("Worker cannot fetch Access certs")};
test("live-only mode never trusts a fresh pinned snapshot or previously cached pinned key",async()=>{
 const c=config("offline-cached");
 const t=await token(c);
 assert.equal((await verifyFireAccessJWT(t,c,{fetcher:offline,subtle,now,pinnedSnapshot:pinned(c)}))?.email,c.ownerEmail);
 assert.equal(await verifyFireAccessJWT(t,c,{fetcher:offline,subtle,now,pinnedSnapshot:pinned(c),allowPinned:false}),null);
 assert.equal(await verifyFireAccessJWT(t,c,{fetcher:offline,subtle,now,pinnedSnapshot:pinned(c),allowPinned:false,forceRefresh:true}),null);
});
test("live-only mode accepts only real provider JWKS RSA signature and owner claims",async()=>{
 const c=config("online-unique");
 const t=await token(c);
 const url="https://"+c.teamDomain+"/cdn-cgi/access/certs";
 const fetcher=async (input,opts)=>{
   assert.equal(input,url);
   assert.equal(opts.redirect,"follow");
   return {ok:true,url,json:async()=>({keys:[key]})};
 };
 assert.equal((await verifyFireAccessJWT(t,c,{fetcher,subtle,now,allowPinned:false,forceRefresh:true}))?.email,c.ownerEmail);
 assert.equal(await verifyFireAccessJWT(await token(c,{email:"intruder@example.test"}),c,{fetcher,subtle,now,allowPinned:false,forceRefresh:true}),null);
 assert.equal(await verifyFireAccessJWT(await token(c,{aud:"wrong"}),c,{fetcher,subtle,now,allowPinned:false,forceRefresh:true}),null);
});
test("redirect to a different host and failed certificate endpoint are never trusted",async()=>{
 const c=config("redirect-denied");
 const t=await token(c);
 const evil=async()=>({ok:true,url:"https://attacker.example/certs",json:async()=>({keys:[key]})});
 assert.equal(await verifyFireAccessJWT(t,c,{fetcher:evil,subtle,now,allowPinned:false,forceRefresh:true,pinnedSnapshot:pinned(c)}),null);
 const failure=async()=>({ok:false,status:530,url:"https://"+c.teamDomain+"/cdn-cgi/access/certs"});
 assert.equal(await verifyFireAccessJWT(t,c,{fetcher:failure,subtle,now,allowPinned:false,forceRefresh:true,pinnedSnapshot:pinned(c)}),null);
});
