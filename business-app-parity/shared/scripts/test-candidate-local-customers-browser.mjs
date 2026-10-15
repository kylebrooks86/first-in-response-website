/** Actual server page and React panel; synthetic auth substitution and localhost only. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const root=resolve(new URL('..',import.meta.url).pathname), phrase='synthetic candidate recovery phrase only';
let passed=0;const checks=[],errors=[],remote=[];
async function check(name,fn){await fn();passed++;checks.push(name);console.log('PASS: '+name);}
const bundledPage=await esbuild.build({entryPoints:[join(root,'app/development/local-customers/page.tsx')],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'synthetic-auth-fixture',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'fixture-worker-env',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const env={get FIRE_LOCAL_CUSTOMERS_CANDIDATE(){return process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE;}}",loader:'js'}));build.onLoad({filter:/app\/chatgpt-auth\.ts$/},()=>({contents:"export async function requireChatGPTUser(){globalThis.fixtureAuthCalls++;if(!globalThis.fixtureOwner)throw Error('Synthetic sign-in required');return globalThis.fixtureOwner;}",loader:'ts'}));}}]});
const {default:page}=await import('data:text/javascript;base64,'+Buffer.from(bundledPage.outputFiles[0].text).toString('base64'));
const savedMode=process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE,savedRuntime=process.env.NODE_ENV;
const owner={userId:'synthetic-authenticated-owner',email:'kylebrooks8605@gmail.com'};
globalThis.fixtureOwner=owner;globalThis.fixtureAuthCalls=0;
function textOf(n){if(typeof n==='string')return n;if(Array.isArray(n))return n.map(textOf).join(' ');return n?.props?textOf(n.props.children):'';}
let identity;
await check('production page remains disabled even with synthetic flag',async()=>{process.env.NODE_ENV='production';process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE='synthetic-only';assert.match(textOf(await page()),/Development screen disabled/);assert.equal(fixtureAuthCalls,0);});
await check('development page requires explicit synthetic flag',async()=>{process.env.NODE_ENV='development';delete process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE;assert.match(textOf(await page()),/Development screen disabled/);});
process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE='synthetic-only';
await check('actual route refuses missing synthetic session',async()=>{fixtureOwner=null;await assert.rejects(()=>page(),/sign-in required/);});
await check('actual route refuses non-owner fixture',async()=>{fixtureOwner={...owner,email:'synthetic-other@example.invalid'};assert.match(textOf(await page()),/Owner access required/);});
await check('actual route supplies synthetic server-scoped descriptor',async()=>{fixtureOwner=owner;identity=(await page()).props.identity;assert.equal(identity.accountId,'synthetic-fire-owner-account-v1');assert.match(identity.targetId,/^synthetic-fire-(live|doomsday|refund-staging)-v1$/);});
if(savedMode===undefined)delete process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE;else process.env.FIRE_LOCAL_CUSTOMERS_CANDIDATE=savedMode;
if(savedRuntime===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=savedRuntime;
delete globalThis.fixtureOwner;delete globalThis.fixtureAuthCalls;
const browserBundle=await esbuild.build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import{CandidateLocalCustomers}from'./components/candidate-local-customers';const r=createRoot(document.querySelector('#app'));window.renderFixture=identity=>r.render(React.createElement(CandidateLocalCustomers,{identity}));window.renderFixture(window.fixtureIdentity);",resolveDir:root,sourcefile:'candidate-fixture.tsx',loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'}});
const fixtureSecret='synthetic-local-session-signature-only';const token=createHmac('sha256',fixtureSecret).update('owner').digest('hex');
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(browserBundle.outputFiles[0].text);return;}
 if(req.url==='/preview.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync(join(root,'synthetic-customers-preview/preview.css')));return;}
 if(req.url==='/identity.js'){res.setHeader('Content-Type','text/javascript');res.end('window.fixtureIdentity='+JSON.stringify(identity));return;}
 if(req.url==='/development/local-customers'){
  if(!req.headers.cookie?.includes('synthetic_session='+token)){res.statusCode=401;res.end('Synthetic sign-in required');return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Candidate Customers fixture</title><link rel="stylesheet" href="/preview.css"><body style="margin:0"><div id="app"></div><script src="/identity.js"></script><script type="module" src="/bundle.js"></script>');return;
 }res.statusCode=404;res.end();});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const profile=mkdtempSync(join(tmpdir(),'fire-candidate-integration-'));let context;
process.exitCode=1;
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu']});
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await check('unsigned browser session cannot enter fixture screen',async()=>assert.equal((await p.goto(origin+'/development/local-customers')).status(),401));
 await context.addCookies([{name:'synthetic_session',value:token,url:origin,httpOnly:true,sameSite:'Strict'}]);
 await p.goto(origin+'/development/local-customers');await p.waitForFunction(()=>document.querySelector('[data-local-customer-state]')?.dataset.localCustomerState==='locked');
 await check('React candidate screen mounts locked without automatically seeding',async()=>{await p.getByLabel('New test phrase',{exact:true}).waitFor();assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await check('explicit test-vault creation clears phrase and preserves locked state',async()=>{await p.getByLabel('New test phrase',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Create empty synthetic test vault'}).click();await p.getByLabel('New test phrase',{exact:true}).waitFor({state:'detached'});assert.equal(await p.locator('[data-customer-id]').count(),0);});
 async function unlock(){await p.getByLabel('Test recovery phrase',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Unlock local contacts',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-local-customer-state]')?.dataset.localCustomerState==='ready');}
 await unlock();
 async function save(name){await p.getByLabel('Name',{exact:true}).fill(name);await p.getByLabel('Test phrase for this local save',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Save locally',exact:true}).click();await p.waitForFunction(name=>[...document.querySelectorAll('[data-customer-id] strong')].some(n=>n.textContent===name),name);}
 await check('candidate creates synthetic customer and accurately reports unsynced local save',async()=>{await p.getByRole('button',{name:'Add synthetic customer'}).click();await save('Synthetic Integrated Customer');assert.match(await p.locator('[data-save-status]').innerText(),/Saved locally\. Not sent to a server\./);assert.match(await p.locator('.customer-workspace').innerText(),/1 local operation receipts/);});
 await check('candidate edits loaded contacts offline and increments revision',async()=>{await context.setOffline(true);await p.getByRole('button',{name:'Edit Synthetic Integrated Customer'}).click();await save('Synthetic Offline Edited');assert.match(await p.locator('.customer-workspace').innerText(),/Revision 2/);await context.setOffline(false);});
 await check('explicit lock removes contact plaintext and draft',async()=>{await p.getByRole('button',{name:'Edit Synthetic Offline Edited'}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Unsaved');await p.getByRole('button',{name:'Lock local contacts'}).click();assert.equal(await p.locator('[data-customer-id]').count(),0);assert.equal(await p.getByLabel('Name',{exact:true}).count(),0);});
 await check('reload retains encrypted local contact and receipt history',async()=>{await p.reload();await p.waitForFunction(()=>document.querySelector('[data-local-customer-state]')?.dataset.localCustomerState==='locked');assert.equal(await p.getByLabel('New test phrase',{exact:true}).count(),0);await unlock();assert.match(await p.locator('.customer-workspace').innerText(),/Synthetic Offline Edited/);assert.match(await p.locator('.customer-workspace').innerText(),/2 local operation receipts/);});
 await check('React identity change unmounts old controller and separates account storage',async()=>{await p.evaluate(id=>window.renderFixture({...id,accountId:'synthetic-second-account'}),identity);await p.getByLabel('New test phrase',{exact:true}).waitFor();assert.equal(await p.locator('[data-customer-id]').count(),0);await p.evaluate(id=>window.renderFixture(id),identity);await p.getByLabel('New test phrase',{exact:true}).waitFor({state:'detached'});await unlock();assert.match(await p.locator('.customer-workspace').innerText(),/Synthetic Offline Edited/);});
 for(const mode of ['light','dark'])await check('320px '+mode+' candidate layout fits viewport',async()=>{await p.setViewportSize({width:320,height:844});if(await p.locator('.fire-synthetic-preview').getAttribute('data-theme')!==mode)await p.getByRole('button',{name:'Switch to '+mode+' mode'}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);});
 await check('candidate light theme remains light under a dark host page',async()=>{await p.evaluate(()=>document.documentElement.dataset.theme='dark');if(await p.locator('.fire-synthetic-preview').getAttribute('data-theme')!=='light')await p.getByRole('button',{name:'Switch to light mode'}).click();assert.equal(await p.locator('.fire-synthetic-preview').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(243, 245, 248)');});
 await check('logout fixture revokes local plaintext',async()=>{await p.evaluate(()=>window.renderFixture(null));await p.waitForFunction(()=>!document.querySelector('[data-customer-id]'));assert.equal(await p.getByRole('button',{name:'Unlock local contacts',exact:true}).count(),0);});
 await check('online/financial routes untouched and no outside network or runtime errors',async()=>{for(const path of ['/api/customers','/api/invoices','/api/payments'])assert.equal((await context.request.get(origin+path)).status(),404);assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);});
 console.log(JSON.stringify({passed,total:passed,checks,identity,browserVersion:context.browser().version(),actualReactPanel:true,actualServerPageWithAuthStub:true,syntheticSignedSessionFixture:true,realAuthTested:false,fullAppRuntimeTested:false,productionActivated:false}));process.exitCode=0;
}finally{if(context)await context.close();await new Promise(r=>server.close(r));rmSync(profile,{recursive:true,force:true});}
