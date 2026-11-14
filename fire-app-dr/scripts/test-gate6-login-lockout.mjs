/** Gate6 NEW-case DR login tests. Actual TypeScript owner/login handlers,
 * disposable in-memory SQLite, fake credentials, no Cloudflare/Stripe/network.
 * Covers previously-unhandled X-Forwarded-For spoofing, concurrent failures,
 * premature 15-minute unlocking of a 30-minute block and HMAC TTL bounds.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE auth_rate_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,window_started_at INTEGER NOT NULL,blocked_until INTEGER NOT NULL)');
const password='FIRE-SYNTHETIC-DR-PASSWORD-NOT-A-CREDENTIAL-1234';
const env={
 FIRE_ADMIN_PASSWORD_HASH:createHash('sha256').update(password).digest('hex'),
 FIRE_SESSION_SECRET:'SYNTHETIC-DR-SESSION-SECRET-'.repeat(3)
};
let clock=2000000000, cookie='', checks=0;
const DateStub={now:()=>clock*1000};
const assertEq=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++};
const wait=()=>new Promise(resolve=>setImmediate(resolve));
const stmt=(sql,values=[])=>({bind(...args){return stmt(sql,args)},
 async first(){
  const result=db.prepare(sql).get(...values)??null;
  await wait(); // provider-like async interleaving, so non-atomic RMW fails
  return result;
 },
 async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}}}
});
env.DB={prepare:stmt};
function module(path,dependencies={}){
 const exports={};
 const js=ts.transpileModule(readFileSync(path,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 vm.runInNewContext(js,{exports,require:name=>{
  if(name==='cloudflare:workers')return {env};
  if(name==='next/headers')return {headers:async()=>new Headers({cookie,host:'dr-offline.invalid'})};
  if(name==='next/navigation')return {redirect:()=>{throw Error('Offline redirect')}};
  if(name in dependencies)return dependencies[name];
  throw Error('Unexpected dependency '+name);
 },Response,Request,Headers,URL,TextEncoder,crypto:webcrypto,
 btoa:text=>Buffer.from(text,'binary').toString('base64'),
 Date:DateStub,process:{env:{NODE_ENV:'production'}}
 },{filename:path});
 return exports;
}
const owner=module('app/owner-auth.ts');
const login=module('app/api/auth/login/route.ts',{'../../../owner-auth':owner});
const req=(pass,extraHeaders={})=>new Request('https://dr-offline.invalid/api/auth/login',{
 method:'POST',headers:{'content-type':'application/json',...extraHeaders},
 body:JSON.stringify({password:pass})
});
const reset=()=>db.exec('DELETE FROM auth_rate_limits');
try{
 assertEq((await login.POST(req(password))).status,200,'Valid fake owner can sign in');
 reset();
 for(let i=0;i<5;i++){
  const response=await login.POST(req('invalid-DR-passphrase-'+i,{'x-forwarded-for':'203.0.113.'+(30+i)}));
  assertEq(response.status,i===4?429:401,'Spoofed forwarded-IP variant '+i+' shares rate limit');
 }
 assertEq(db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n,1,
  'Untrusted forwarded IPs generate exactly one conservative bucket');
 assertEq(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,5,
  'Rate-limit counter is five even when clients rotate forwarding headers');
 assertEq((await login.POST(req(password,{'x-forwarded-for':'198.51.100.55'}))).status,429,
  'Correct password cannot evade active block via spoofed forwarding header');
 // The 30-minute blocking window must outlive the shorter 15-minute attempt window.
 clock+=901;
 let response=await login.POST(req(password));
 assertEq(response.status,429,'DR lockout persists after failed-attempt window ends');
 assertEq(response.headers.get('retry-after'),'899','Remaining 30-minute block is preserved');
 clock+=899;
 assertEq((await login.POST(req(password))).status,200,'Login recovers at genuine lockout expiry');
 reset();
 const parallel=await Promise.all(Array.from({length:5},(_,i)=>login.POST(req('bad-'+i,{'cf-connecting-ip':'192.0.2.91'}))));
 assertEq(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,5,
  'Concurrent failed logins atomically increment the same D1 row');
 assertEq(parallel.some(r=>r.status===429),true,
  'Concurrent fifth failure triggers lockout rather than losing increments');
 assertEq((await login.POST(req(password,{'cf-connecting-ip':'192.0.2.91'}))).status,429,
  'Genuine Cloudflare IP stays blocked after concurrent failures');
 assertEq((await login.POST(req(password,{'cf-connecting-ip':'192.0.2.92'}))).status,200,
  'Distinct trusted Cloudflare-provided address has a separate rate bucket');
 // A properly signed cookie is not sufficient if it claims an impossible TTL.
 const signed=expiry=>{
  const payload='v1.'+expiry;
  return 'fire_admin_session='+payload+'.'+createHmac('sha256',env.FIRE_SESSION_SECRET).update(payload).digest('base64url');
 };
 cookie=signed(clock+120);
 assertEq((await owner.getOwnerUser())?.userId,'fire-owner','Ordinary signed session accepted');
 cookie=signed(clock+31*86400);
 assertEq(await owner.getOwnerUser(),null,'Correctly signed 31-day-future cookie rejected');
 cookie=signed(clock-1);
 assertEq(await owner.getOwnerUser(),null,'Signed expired session rejected');
 cookie=signed(clock+120)+'.extra';
 assertEq(await owner.getOwnerUser(),null,'Appended cookie segment rejected');
 cookie=signed(clock+120);
 env.FIRE_SESSION_SECRET='other-fake-signing-secret-'.repeat(3);
 assertEq(await owner.getOwnerUser(),null,'Wrong-signing-secret cookie rejected');
 console.log('PASS '+checks+' new Gate6 DR login/TTL regression assertions: actual source and disposable SQLite; no remote host or owner credentials.');
}finally{db.close();}
