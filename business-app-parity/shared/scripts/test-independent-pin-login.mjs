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
 let response=await login.POST(request('1234'));const oldV1Cookie=response.headers.get('set-cookie')?.split(';')[0]||'';equal(response.status,200);ok(response.headers.get('set-cookie')?.includes('HttpOnly; Secure; SameSite=Strict'));equal(response.headers.get('cache-control'),'no-store');equal((await response.json()).ok,true);
 for(const invalid of ['1235','123','12345','abcd',1234,null]){reset();response=await login.POST(request(invalid));equal(response.status,401);equal(response.headers.get('set-cookie'),null);}
 reset();for(let i=0;i<4;i++)equal((await login.POST(request('9999'))).status,401);
 response=await login.POST(request('9999'));equal(response.status,429);equal(response.headers.get('retry-after'),'1800');
 now+=901;response=await login.POST(request('1234'));equal(response.status,429);equal(response.headers.get('retry-after'),'899');equal(response.headers.get('set-cookie'),null);
 equal((await login.POST(request('1234','192.0.2.2'))).status,200);
 now+=900;equal((await login.POST(request('1234'))).status,200);
 reset();await login.POST(request('9999'));equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,1);equal((await login.POST(request('1234'))).status,200);equal(db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n,0);
 reset();await login.POST(request('9999'));now+=901;await login.POST(request('9999'));equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,1);
 reset();const spoofedIP=xff=>new Request('https://fixture.invalid/api/auth/login',{
  method:'POST',headers:{'content-type':'application/json','x-forwarded-for':xff},
  body:JSON.stringify({password:'9999'})
 });
 for(let i=0;i<5;i++){
   response=await login.POST(spoofedIP('203.0.113.'+(20+i)));
   equal(response.status,i===4?429:401);
 }
 equal(db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n,1);
 equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,5);
 const spoofSuccess=new Request('https://fixture.invalid/api/auth/login',{
   method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'198.51.100.88'},
   body:JSON.stringify({password:'1234'})
 });
 equal((await login.POST(spoofSuccess)).status,429);
 reset();const simultaneous=await Promise.all(Array.from({length:5},()=>login.POST(request('9999'))));equal(db.prepare('SELECT attempts FROM auth_rate_limits').get().attempts,5);ok(simultaneous.some(r=>r.status===429));equal((await login.POST(request('1234'))).status,429);
 reset();env.DB=undefined;response=await login.POST(request('1234'));equal(response.status,503);equal(response.headers.get('set-cookie'),null);env.DB=binding;
 const signingSecret=env.FIRE_SESSION_SECRET;env.FIRE_SESSION_SECRET='short';response=await login.POST(request('1234'));equal(response.status,503);equal(response.headers.get('set-cookie'),null);env.FIRE_SESSION_SECRET=signingSecret;
 const credentialHash=env.FIRE_ADMIN_PASSWORD_HASH;env.FIRE_ADMIN_PASSWORD_HASH=undefined;equal((await login.POST(request('1234'))).status,401);env.FIRE_ADMIN_PASSWORD_HASH=credentialHash;
 const page=load('app/login/page.tsx',{},'\nexport { safeReturnTo };');
 for(const path of ['https://evil.invalid','//evil.invalid','/\\evil.invalid']){fakeWindow.location.search='?return_to='+encodeURIComponent(path);equal(page.safeReturnTo(),'/');}
 fakeWindow.location.search='?return_to='+encodeURIComponent('/?view=customers#profile');equal(page.safeReturnTo(),'/?view=customers#profile');
 // In quick mode the app must load the deployed auth capability first.
 // SSR cannot expose a weaker PIN or create a session from stale metadata.
 const html=renderToStaticMarkup(React.createElement(page.default));
 ok(html.includes('Checking secure sign-in'));
 ok(!html.includes('4-digit PIN'));
 const ui=readFileSync('app/login/page.tsx','utf8');
 ok(ui.includes('inputMode={quick||legacyNumeric?"numeric":undefined}'));
 ok(ui.includes('maxLength={quick||legacyNumeric?4:128}'));
 ok(ui.includes('autoComplete="off"'));

 // Verify the REAL route's new opt-in quick-login behavior with a synthetic
 // Access identity provider; the separate JWT suite exercises real RSA signatures.
 // A valid Access JWT is required only at SIGN-IN, not on public customer routes.
 const access={verifyCloudflareAccessOwnerJwt:async(jwt,settings)=>jwt==='valid-owner-access'&&
  settings.teamDomain==='qa-only.cloudflareaccess.com'&&
  settings.audience==='synthetic-audience-123456789'&&
  settings.ownerEmail==='synthetic.owner@example.invalid'};
 let browserHeaders=new Headers();
 const ownerQuick=load('app/owner-auth.ts',{
  '../lib/access-passkey-identity.mjs':access,
  'next/headers':{headers:async()=>browserHeaders},
  'next/navigation':{redirect(){throw Error('redirect');}}
 });
 const loginQuick=load('app/api/auth/login/route.ts',{'../../../owner-auth':ownerQuick});
 env.FIRE_QUICK_AUTH_MODE='passkey-or-pin-v1';
 env.FIRE_ACCESS_TEAM_DOMAIN='qa-only.cloudflareaccess.com';
 env.FIRE_ACCESS_AUDIENCE='synthetic-audience-123456789';
 env.FIRE_ACCESS_OWNER_EMAIL='synthetic.owner@example.invalid';
 env.FIRE_PIN_PEPPER='synthetic-private-pepper-32-bytes-or-longer';
 const hmacKey=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.FIRE_PIN_PEPPER),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 env.FIRE_PIN_HASH=Buffer.from(await webcrypto.subtle.sign('HMAC',hmacKey,new TextEncoder().encode('1234'))).toString('hex');
 const quick=(body,jwt)=>new Request('https://fixture.invalid/api/auth/login',{
  method:'POST',headers:{'content-type':'application/json',...(jwt?{'cf-access-jwt-assertion':jwt}:{})},
  body:JSON.stringify(body)
 });
 reset();
 equal((await loginQuick.POST(quick({method:'passkey'},null))).status,401);
 equal((await loginQuick.POST(quick({method:'pin',pin:'1234'},null))).status,401);
 equal((await loginQuick.POST(quick({password:'1234'},null))).status,401);
 equal((await loginQuick.POST(quick({method:'passkey'},'wrong-access'))).status,401);
 equal(db.prepare('SELECT COUNT(*) AS n FROM auth_rate_limits').get().n,0);
 response=await loginQuick.POST(quick({method:'passkey'},'valid-owner-access'));
 equal(response.status,200);
 const newV2Cookie=response.headers.get('set-cookie')?.split(';')[0]||'';
 ok(newV2Cookie.startsWith('fire_admin_session=v2.'));
 equal((await response.json()).ok,true);
 browserHeaders=new Headers({cookie:oldV1Cookie});
 equal(await ownerQuick.getOwnerUser(),null); // old 30-day token does NOT bypass new Access enrollment
 browserHeaders=new Headers({cookie:newV2Cookie}); // no Access JWT after completing login
 ok((await ownerQuick.getOwnerUser())?.userId==='fire-owner');
 const wrong=await loginQuick.POST(quick({method:'pin',pin:'9999'},'valid-owner-access'));
 equal(wrong.status,401);
 const validPin=await loginQuick.POST(quick({method:'pin',pin:'1234'},'valid-owner-access'));
 equal(validPin.status,200);
 ok((validPin.headers.get('set-cookie')||'').includes('v2.'));
 env.FIRE_PIN_PEPPER='short';
 equal((await loginQuick.POST(quick({method:'pin',pin:'1234'},'valid-owner-access'))).status,401);
 delete env.FIRE_PIN_HASH;delete env.FIRE_PIN_PEPPER;delete env.FIRE_QUICK_AUTH_MODE;
 delete env.FIRE_ACCESS_TEAM_DOMAIN;delete env.FIRE_ACCESS_AUDIENCE;delete env.FIRE_ACCESS_OWNER_EMAIL;
 console.log(`PASS ${checks}/${checks}: synthetic PIN login, SQLite-backed attempt limit including 30-minute lock beyond 15-minute window, simultaneous failure increments, secure session/fail-closed configuration, safe return paths and server-rendered PIN input. No deployed login, remote D1 or credential changed.`);
} finally {db.close();}
