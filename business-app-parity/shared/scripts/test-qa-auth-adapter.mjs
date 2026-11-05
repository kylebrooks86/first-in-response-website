/** QA-only independent auth contract. No real credentials, D1 or network. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const good='a-long-separate-synthetic-qa-test-passphrase-2026';
const env={FIRE_QA_PASSWORD_HASH:createHash('sha256').update(good).digest('hex'),
  FIRE_QA_SESSION_SECRET:'isolated-qa-signing-secret-example-only-'.repeat(3),
  FIRE_QA_SYNTHETIC_ONLY:'enabled',FIRE_ENV:'synthetic-qa',
  SITE_ORIGIN:'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'};
let cookie='';
const exports={};let count=0;
const source=ts.transpileModule(readFileSync('app/owner-auth.ts','utf8'),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(source,{
  exports,require:name=>name==='cloudflare:workers'?{env}:name==='next/headers'?{
    headers:async()=>new Headers({cookie,host:'qa-fixture.invalid',
      'oai-authenticated-user-email':'kylebrooks8605@gmail.com'})}:{
    redirect:()=>{throw Error('redirect')}},
  process:{env:{NODE_ENV:'production'}},TextEncoder,crypto:webcrypto,
  btoa:value=>Buffer.from(value,'binary').toString('base64'),URL
});
async function check(condition,message){assert.ok(condition,message);count++;}
await check(await exports.getOwnerUser()===null,'Untrusted gateway owner header cannot authenticate QA');
await check(await exports.verifyIndependentPassword(good),'New independent QA passphrase works');
await check(!await exports.verifyIndependentPassword('1234'),'Old four digit PIN refused');
await check(!await exports.verifyIndependentPassword('wrong-long-passphrase-1234567890'),'Incorrect QA password refused');
const setCookie=await exports.independentSessionCookie();
await check(setCookie.includes('HttpOnly; Secure; SameSite=Strict'),'QA cookie secure flags');
await check(setCookie.startsWith('fire_qa_session='),'QA cookie name isolated');
await check(!setCookie.includes('fire_admin_session'),'QA cookie not Doomsday cookie');
await check(setCookie.includes('Max-Age=43200'),'QA session expires in 12h');
cookie=setCookie.split(';')[0];
await check((await exports.getOwnerUser())?.userId==='fire-qa-owner','QA signed cookie maps to independent owner');
cookie+='tampered';
await check(await exports.getOwnerUser()===null,'Tampered cookie rejected');
cookie=setCookie.split(';')[0]+'.extra';
await check(await exports.getOwnerUser()===null,'Extra token segment rejected');
cookie='fire_admin_session='+setCookie.split('=')[1].split(';')[0];
await check(await exports.getOwnerUser()===null,'Doomsday cookie cannot unlock QA');
cookie=setCookie.split(';')[0];
for(const [key,bad] of [
 ['FIRE_QA_SYNTHETIC_ONLY',''],['FIRE_ENV','production'],
 ['SITE_ORIGIN','https://fire-app-independent-staging.testacct.workers.dev'],
 ['SITE_ORIGIN','https://fire-fullapp-qa-20261016.attacker.invalid'],
 ['SITE_ORIGIN','https://fire-fullapp-qa-20261016.anotheraccount.workers.dev'],
 ['SITE_ORIGIN','http://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'],
 ['SITE_ORIGIN','https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev:8443']]){
 const previous=env[key];env[key]=bad;
 await check(await exports.getOwnerUser()===null,'Fail closed for '+key+'='+bad);
 await check(!await exports.verifyIndependentPassword(good),'Configured passphrase blocked without QA provenance '+key);
 env[key]=previous;
}
env.FIRE_QA_SESSION_SECRET='too-short';
await assert.rejects(()=>exports.independentSessionCookie());count++;
env.FIRE_QA_SESSION_SECRET='isolated-qa-signing-secret-example-only-'.repeat(3);
env.FIRE_QA_PASSWORD_HASH='bad';
await check(!await exports.verifyIndependentPassword(good),'Invalid password hash fails');
await check(exports.safeRelativeReturnPath('//evil.example.invalid')==='/', 'External redirect denied');
await check(exports.safeRelativeReturnPath('/dashboard')==='/dashboard','Local path allowed');
// The real login route must fail closed and log only a classified stage/code.
const authRoute={},diagnostics=[];
env.DB={prepare(){throw Error('SQLITE_BUSY: sensitive fixture '+good+' '+env.FIRE_QA_SESSION_SECRET);}};
vm.runInNewContext(ts.transpileModule(readFileSync('app/api/auth/login/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
 exports:authRoute,require:name=>name==='cloudflare:workers'?{env}:exports,Response,Request,TextEncoder,crypto:webcrypto,Error,console:{error:(...args)=>diagnostics.push(args)}
});
const unavailable=await authRoute.POST(new Request('https://qa-fixture.invalid/api/auth/login',{method:'POST',body:JSON.stringify({password:good})}));
await check(unavailable.status===503&&!unavailable.headers.has('set-cookie'),'Unavailable rate-limit storage never authenticates or sets a session');
await check(diagnostics.length===1&&diagnostics[0][1].stage==='rate-read'&&diagnostics[0][1].code==='SQLITE_BUSY','Login diagnostic identifies failing stage and safe database error class');
await check(!JSON.stringify(diagnostics).includes(good)&&!JSON.stringify(diagnostics).includes(env.FIRE_QA_SESSION_SECRET)&&!JSON.stringify(diagnostics).includes('sensitive fixture'),'Login diagnostic excludes credentials and arbitrary exception details');
console.log('PASS '+count+' synthetic QA auth assertions: separate long passphrase, cookie, fail-closed origin/env, no gateway spoofing, no old PIN. No host, D1 or credential mutation.');
