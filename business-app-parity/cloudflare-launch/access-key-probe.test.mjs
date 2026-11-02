import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {probeFireAccessCrypto as probe} from "./access-key-probe.mjs";
const {subtle}=webcrypto;
const conf={teamDomain:"synthetic-fire.cloudflareaccess.com"};
const pair=await subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,
  publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const key={...await subtle.exportKey("jwk",pair.publicKey),kid:"synthetic-kid-for-testing",alg:"RS256",use:"sig"};
const b64=x=>Buffer.from(x instanceof Uint8Array?x:(typeof x==="string"?x:JSON.stringify(x))).toString("base64url");
async function token({kid=key.kid,claims={}}={}){
  const header=b64({alg:"RS256",kid,typ:"JWT"});
  const payload=b64({iss:"https://"+conf.teamDomain,aud:["synthetic-app"],email:"private@example.test",
    exp:2100000000,...claims});
  const data=header+"."+payload;
  return data+"."+b64(Buffer.from(await subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,
    new TextEncoder().encode(data))));
}
const goodFetch=async (url,opts)=>{
  assert.equal(url,"https://synthetic-fire.cloudflareaccess.com/cdn-cgi/access/certs");
  assert.equal(opts.redirect,"error");
  return {ok:true,json:async()=>({keys:[key]})};
};
test("diagnostic phase probe distinguishes fetch, malformed certs, unknown kid, import and bad signature",async()=>{
 const good=await token();
 const options={subtle};
 assert.equal(await probe(good,conf,{...options,fetcher:async()=>{throw Error("offline")}}),"FIRE-A11-CERTS-FETCH");
 assert.equal(await probe(good,conf,{...options,fetcher:async()=>({ok:false})}),"FIRE-A11-CERTS-FETCH");
 assert.equal(await probe(good,conf,{...options,fetcher:async()=>({ok:true,json:async()=>({keys:[]})})}),"FIRE-A12-CERTS-FORMAT");
 assert.equal(await probe(await token({kid:"different-signing-kid"}),conf,{...options,fetcher:goodFetch}),"FIRE-A13-SIGNING-KEY");
 assert.equal(await probe(good,conf,{...options,fetcher:goodFetch,subtle:{importKey:async()=>{throw Error("unsupported")}}}),"FIRE-A14-KEY-IMPORT");
 assert.equal(await probe(good,conf,{...options,fetcher:goodFetch,subtle:{importKey:async()=>({}),verify:async()=>{throw Error("unsupported")}}}),"FIRE-A15-CRYPTO-ERROR");
 assert.equal(await probe(good.slice(0,-12)+"a".repeat(12),conf,{...options,fetcher:goodFetch}),"FIRE-A16-SIGNATURE");
 assert.equal(await probe(good,conf,{...options,fetcher:goodFetch}),"FIRE-A17-VERIFY-MISMATCH");
});
test("diagnostic code never contains token, claims, emails, key material or fetch error details",async()=>{
 const s=await token({claims:{email:"private-key@example.test"}});
 for(const opts of [{fetcher:goodFetch,subtle},{fetcher:async()=>{throw Error("SECRET_EXCEPTION_IN_FETCH")},subtle}]){
  const result=await probe(s,conf,opts);
  assert.match(result,/^FIRE-A1[1-7]-[A-Z0-9-]+$/);
  assert.ok(result.length<35);
  assert.doesNotMatch(result,/private|key@example|SECRET_EXCEPTION|synthetic-fire|eyJ|RSA.*AQAB/i);
 }
});
