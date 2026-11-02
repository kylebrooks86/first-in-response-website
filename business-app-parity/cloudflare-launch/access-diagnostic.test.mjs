import test from "node:test";
import assert from "node:assert/strict";
import {classifyFireAccessProblem as diagnose} from "./access-diagnostic.mjs";
const c={teamDomain:"restless-unit-ad5b.cloudflareaccess.com",audience:"a".repeat(48),ownerEmail:"owner@example.com"};
const runtime={fireEnv:"cloudflare-staging",accessRequired:"enabled",origin:"https://fire-stripe-test-20261101.kyle-bfc.workers.dev"};
const now=Math.floor(Date.now()/1000);
function fakeToken(changes={}){
  const b=(obj)=>Buffer.from(JSON.stringify(obj),"utf8").toString("base64url");
  return b({alg:"RS256",kid:"fake"})+"."+b({
    iss:"https://"+c.teamDomain,aud:c.audience,email:c.ownerEmail,exp:now+3600,iat:now-60,...changes
  })+"."+"b".repeat(90);
}
function testCase(extra){return {runtime,config:c,token:fakeToken(),identity:null,...extra};}
test("diagnostic does not authorize, returns bounded exact reason codes",()=>{
  assert.equal(diagnose(testCase({identity:{email:c.ownerEmail}})),"FIRE-A00-VERIFIED");
  assert.equal(diagnose(testCase({runtime:{...runtime,accessRequired:"disabled"}})),"FIRE-A01-RUNTIME");
  assert.equal(diagnose(testCase({runtime:{...runtime,origin:"http://localhost"}})),"FIRE-A02-ORIGIN");
  assert.equal(diagnose(testCase({config:{...c,teamDomain:"https://bad.example"}})),"FIRE-A03-IDENTITY-CONFIG");
  assert.equal(diagnose(testCase({token:null})),"FIRE-A04-TOKEN-ABSENT");
  assert.equal(diagnose(testCase({token:"incorrect"})),"FIRE-A05-TOKEN-FORMAT");
  assert.equal(diagnose(testCase({token:fakeToken({iss:"https://bad.cloudflareaccess.com"})})),"FIRE-A06-ISSUER");
  assert.equal(diagnose(testCase({token:fakeToken({aud:"other"})})),"FIRE-A07-AUDIENCE");
  assert.equal(diagnose(testCase({token:fakeToken({email:"intruder@example.com"})})),"FIRE-A08-OWNER-CLAIM");
  assert.equal(diagnose(testCase({token:fakeToken({exp:now-1})})),"FIRE-A09-TOKEN-TIME");
  assert.equal(diagnose(testCase({token:fakeToken()})),"FIRE-A10-CRYPTO-OR-KEY");
});
test("diagnostic never returns header, raw JWT, secret, email or AUD",()=>{
  for(const token of [fakeToken(),fakeToken({email:"private@secret.example"}),"invalid",null]){
    const reason=diagnose(testCase({token}));
    assert.match(reason,/^FIRE-A\d\d-[A-Z0-9-]+$/);
    assert.ok(reason.length<36);
    assert.doesNotMatch(reason,/owner|private|secret|example|a{20}|eyJ/i);
  }
});
