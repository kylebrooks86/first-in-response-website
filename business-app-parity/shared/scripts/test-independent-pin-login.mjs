import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const db=new DatabaseSync(':memory:');
db.exec(readFileSync('drizzle/0009_spicy_micromax.sql','utf8'));
let now=2000000000;
const env={FIRE_ADMIN_PASSWORD_HASH:createHash('sha256').update('1234').digest('hex'),FIRE_SESSION_SECRET:'synthetic-only-signing-secret-'.repeat(3)};
const binding={
 prepare(sql){
  return {bind(...args){
   return {
    async first(){const row=db.prepare(sql).get(...args)??null;await new Promise(resolve=>setImmediate(resolve));return row;},
    async run(){db.prepare(sql).run(...args);return {success:true};}
   };
  }};
 }
};
env.DB=binding;
function load(path,modules={},extra=''){
 const exports={};
 const source=ts.transpileModule(readFileSync(path,'utf8')+extra,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>name==='cloudflare:workers'?{env}:modules[name]??require(name),process:{env:{NODE_ENV:'production'}},Date:{now:()=>now*1000},Headers,Request,Response,TextEncoder,URL,URLSearchParams,crypto:webcrypto,btoa:value=>Buffer.from(value,'binary').toString('base64'),window:fakeWindow});return exports;
}
const fakeWindow={location:{origin:'https://fixture.invalid',search:''}};
const owner=load('app/owner-auth.ts',{'next/headers':{headers:async()=>new Headers()},'next/navigation':{redirect(){throw Error('redirect');}}});
const login=load('app/api/auth/login/route.ts',{'../../../owner-auth':owner});
let checks=0;
function equal(actual,expected){assert.equal(actual,expected);checks++;}
function ok(value){assert.ok(value);checks++;}
function request(password,ip='192.0.2.1'){return new Request('https://fixture.invalid/api/auth/login',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({password})});}
function reset(){db.exec('DELETE FROM auth_rate_limits');}
try {
 let response=await login.POST(request('1234'));equal(response.status,200);ok(response.headers.get('set-cookie')?.includes('HttpOnly; Secure; SameSite=Strict'));equal(response.headers.get('cache-control'),'no-store');equal((await response.json()).ok,true);
 for(const invalid of ['1235','123','12345','abcd',1234,null]){reset();response=await login.POST(request(invalid));equal(response.status,401);equal(response.headers.get('set-cookie'),null);}
 reset();for(let i=0;i<4;i++)equal((await login.POST(request('9999'))).status,401);
 response=await login.POST(request('9999'));equal(response.status,429);equal(response.headers.get('retry-after'),'1800');
 now+=901;response=await login.POST(request('1234'));equal(response.status,429);equal(response.headers.get('retry-after'),'899');equal(response.headers.get('set-cookie'),null);
 equal((await login.POST(request('1234','192.0.2.2'))).status,200);
 now+=900;equal((await login.POST(request('1234'))).status,200);
 reset();await login.POST(request('9999'));equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,1);equal((await login.POST(request('1234'))).status,200);equal(db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n,0);
 reset();await login.POST(request('9999'));now+=901;await login.POST(request('9999'));equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,1);
 reset();const simultaneous=await Promise.all(Array.from({length:5},()=>login.POST(request('9999'))));equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,5);ok(simultaneous.some(r=>r.status===429));equal((await login.POST(request('1234'))).status,429);
 reset();env.DB=undefined;response=await login.POST(request('1234'));equal(response.status,503);equal(response.headers.get('set-cookie'),null);env.DB=binding;
 const signingSecret=env.FIRE_SESSION_SECRET;env.FIRE_SESSION_SECRET='short';response=await login.POST(request('1234'));equal(response.status,503);equal(response.headers.get('set-cookie'),null);env.FIRE_SESSION_SECRET=signingSecret;
 const credentialHash=env.FIRE_ADMIN_PASSWORD_HASH;env.FIRE_ADMIN_PASSWORD_HASH=undefined;equal((await login.POST(request('1234'))).status,401);env.FIRE_ADMIN_PASSWORD_HASH=credentialHash;
 const page=load('app/login/page.tsx',{},'\nexport { safeReturnTo };');
 for(const path of ['https://evil.invalid','//evil.invalid','/\\evil.invalid']){fakeWindow.location.search='?return_to='+encodeURIComponent(path);equal(page.safeReturnTo(),'/');}
 fakeWindow.location.search='?return_to='+encodeURIComponent('/?view=customers#profile');equal(page.safeReturnTo(),'/?view=customers#profile');
 const html=renderToStaticMarkup(React.createElement(page.default));ok(html.includes('4-digit PIN'));ok(html.includes('inputMode="numeric"'));ok(html.includes('maxLength="4"'));ok(html.includes('autoComplete="off"'));ok(html.includes('disabled=""'));
 console.log(`PASS ${checks}/${checks}: synthetic PIN login, SQLite-backed attempt limit including 30-minute lock beyond 15-minute window, simultaneous failure increments, secure session/fail-closed configuration, safe return paths and server-rendered PIN input. No deployed login, remote D1 or credential changed.`);
} finally {db.close();}
