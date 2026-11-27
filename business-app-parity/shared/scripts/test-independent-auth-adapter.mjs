import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const fixturePassword='synthetic-only-test';const env={FIRE_ADMIN_PASSWORD_HASH:createHash('sha256').update(fixturePassword).digest('hex'),FIRE_SESSION_SECRET:'synthetic-fixture-secret-'.repeat(3)};let cookie='';const exports={};
const source=ts.transpileModule(readFileSync('app/owner-auth.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(source,{exports,require:name=>name==='cloudflare:workers'?{env}:name==='next/headers'?{headers:async()=>new Headers({cookie,host:'fixture.invalid'})}:{redirect:()=>{throw Error('redirect');}},process:{env:{NODE_ENV:'production'}},TextEncoder,crypto:webcrypto,btoa:value=>Buffer.from(value,'binary').toString('base64'),URL});
assert.equal(await exports.verifyIndependentPassword(fixturePassword),true);assert.equal(await exports.verifyIndependentPassword('wrong'),false);assert.equal(await exports.verifyIndependentPassword(''),false);assert.equal(await exports.getOwnerUser(),null);
const setCookie=await exports.independentSessionCookie();assert.ok(setCookie.includes('HttpOnly; Secure; SameSite=Strict'));cookie=setCookie.split(';')[0];assert.equal((await exports.getOwnerUser()).email,'kylebrooks8605@gmail.com');const validCookie=cookie;cookie+='tampered';assert.equal(await exports.getOwnerUser(),null);
for(const suffix of ['.extra','.','..extra']) {cookie=validCookie+suffix;assert.equal(await exports.getOwnerUser(),null,'reject trailing session segments');}
const originalHash=env.FIRE_ADMIN_PASSWORD_HASH;env.FIRE_ADMIN_PASSWORD_HASH=createHash('sha256').update('1234').digest('hex');assert.equal(await exports.verifyIndependentPassword('1234'),true);assert.equal(await exports.verifyIndependentPassword('1235'),false);env.FIRE_ADMIN_PASSWORD_HASH=originalHash;
// Owner DR sessions cannot exceed the configured 30-day lifetime even when
// a fixture signs a longer expiration with the otherwise correct HMAC key.
const signedCookie=(expiry)=>{
 const payload='v1.'+expiry;
 return 'fire_admin_session='+payload+'.'+createHmac('sha256',env.FIRE_SESSION_SECRET).update(payload).digest('base64url');
};
cookie=signedCookie(Math.floor(Date.now()/1000)+31*86400);
assert.equal(await exports.getOwnerUser(),null,'Signed cookie beyond 30-day maximum must be refused');
cookie=signedCookie(Math.floor(Date.now()/1000)+120);
assert.equal((await exports.getOwnerUser())?.userId,'fire-owner','Valid short signed DR session still works');
const expired='v1.'+(Math.floor(Date.now()/1000)-1);cookie='fire_admin_session='+expired+'.'+createHmac('sha256',env.FIRE_SESSION_SECRET).update(expired).digest('base64url');assert.equal(await exports.getOwnerUser(),null);cookie=validCookie;env.FIRE_SESSION_SECRET='different-fixture-secret-'.repeat(3);assert.equal(await exports.getOwnerUser(),null);env.FIRE_SESSION_SECRET='short';await assert.rejects(()=>exports.independentSessionCookie());env.FIRE_ADMIN_PASSWORD_HASH='invalid';assert.equal(await exports.verifyIndependentPassword(fixturePassword),false);
for(const path of ['https://evil.invalid','//evil.invalid','/\\evil.invalid'])assert.equal(exports.safeRelativeReturnPath(path),'/');assert.equal(exports.safeRelativeReturnPath('/?view=customers'),'/?view=customers');assert.ok(exports.clearedIndependentSessionCookie().includes('Max-Age=0'));
console.log('PASS: independent candidate adapter rejects missing/wrong credential, missing/tampered/expired/extra-segment cookie, changed/short signing secret and external return paths; valid synthetic session and secure cookie flags. No deployed login or secret changed. Synthetic four-digit credential also tested with configured hash. Does not verify deployed PIN, environment configuration or recovery migration.');
