/** Actual vinext/Vite/workerd runtime, disposable local D1 and synthetic auth only. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync,cpSync,symlinkSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=resolve(new URL('..',import.meta.url).pathname),testRoot=mkdtempSync(join(tmpdir(),'fire-framework-'));
const profile=mkdtempSync(join(tmpdir(),'fire-framework-browser-'));
const secret='synthetic-framework-session-secret-only-2026',phrase='synthetic framework test phrase only';
const deployment=readFileSync(join(source,'app/local-customer-deployment.ts'),'utf8').match(/= '(\w+)'/)[1];
const env={...process.env,NODE_ENV:'development',FIRE_LOCAL_CUSTOMERS_CANDIDATE:'synthetic-only',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'};
let server,context,passed=0,serverLog='';const checks=[],errors=[],remote=[];
async function check(name,fn){await fn();passed++;checks.push(name);console.log('PASS: '+name);}
async function command(args){return await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:testRoot,env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);const timer=setTimeout(()=>child.kill('SIGTERM'),60000);child.on('exit',code=>{clearTimeout(timer);code===0?resolve(log):reject(Error('Local fixture setup failed: '+log.slice(-2000)));});child.on('error',reject);});}
process.exitCode=1;
try{
 for(const name of ['app','lib','components','db','drizzle','hooks','public','vendor','scripts','package.json','tsconfig.json','next-env.d.ts','postcss.config.mjs','vite.config.ts'])if(existsSync(join(source,name)))cpSync(join(source,name),join(testRoot,name),{recursive:true});
 symlinkSync(join(source,'node_modules'),join(testRoot,'node_modules'),'dir');
 writeFileSync(join(testRoot,'.dev.vars'),'FIRE_SESSION_SECRET='+secret+'\n');
 writeFileSync(join(testRoot,'wrangler.fixture.json'),JSON.stringify({name:'fire-synthetic-framework-fixture',compatibility_date:'2026-10-13',d1_databases:[{binding:'DB',database_name:'fire-app-local',database_id:'00000000-0000-4000-8000-000000000000'}]}));
 writeFileSync(join(testRoot,'synthetic-schema.sql'),readdirSync(join(testRoot,'drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFileSync(join(testRoot,'drizzle',f),'utf8')).join('\n'));
 await command([join(source,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','fire-app-local','--local','--persist-to',join(testRoot,'.wrangler/state'),'--config',join(testRoot,'wrangler.fixture.json'),'--file',join(testRoot,'synthetic-schema.sql')]);
 const testConfig=readFileSync(join(source,'vite.config.ts'),'utf8').replace('  vars: {',`  vars: { FIRE_SESSION_SECRET: '${secret}',`).replace('cloudflare({',`cloudflare({ persistState: {path: ${JSON.stringify(join(testRoot,'.wrangler/state'))}},`);writeFileSync(join(testRoot,'vite.config.ts'),testConfig);
 server=spawn(process.execPath,[join(source,'node_modules/vite/bin/vite.js'),'--config',join(testRoot,'vite.config.ts'),'--port','0'],{cwd:source,env,stdio:['ignore','pipe','pipe'],detached:true});
 server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
 let origin;for(let i=0;i<100;i++){origin=serverLog.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(origin)break;if(server.exitCode!==null)throw Error('Framework exited: '+serverLog.slice(-2000));await new Promise(r=>setTimeout(r,300));}
 if(!origin)throw Error('Framework startup timed out: '+serverLog.slice(-1000));
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-gpu'],viewport:{width:390,height:844}});
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}if(r.request().url().includes('entry-browser'))return new Promise(resolve=>setTimeout(()=>resolve(r.continue()),600));return r.continue();});
 const path='/development/local-customers';
 await check('actual framework requires owner authentication',async()=>{const r=await context.request.get(origin+path,{maxRedirects:0});assert.ok([302,303,307,308].includes(r.status()));assert.match(r.headers().location,/signin-with-chatgpt|login/);});
 if(deployment==='doomsday'){
  await check('actual independent auth rejects invalid signed-cookie fixture',async()=>{const r=await context.request.get(origin+path,{headers:{cookie:'fire_admin_session=v1.9999999999.invalid'},maxRedirects:0});assert.ok([302,303,307,308].includes(r.status()));});
  const payload='v1.'+String(Math.floor(Date.now()/1000)+3600),signature=createHmac('sha256',secret).update(payload).digest('base64url');
  await context.addCookies([{name:'fire_admin_session',value:payload+'.'+signature,url:origin,httpOnly:true,sameSite:'Strict'}]);
 }else{
  await check('actual gateway adapter denies non-owner header fixture',async()=>{const r=await context.request.get(origin+path,{headers:{'oai-authenticated-user-id':'synthetic-outsider','oai-authenticated-user-email':'synthetic-outsider@example.invalid'}});assert.ok((await r.text()).includes('Owner access required'));});
  await context.setExtraHTTPHeaders({'oai-authenticated-user-id':'synthetic-framework-owner','oai-authenticated-user-email':'kylebrooks8605@gmail.com'});
 }
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await check('cold desktop navigation responds to one click',async()=>{
  await p.setViewportSize({width:1280,height:900});await p.goto(origin,{waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:'Customers',exact:true}).first().click();
  await p.getByRole('link',{name:'Offline Customers · synthetic development'}).waitFor({timeout:5000});
 });
 for(const width of [320,390])await check('cold '+width+'px mobile menu responds to single taps',async()=>{
  await p.setViewportSize({width,height:844});await p.goto(origin,{waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:'Open menu',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('.sidebar')?.classList.contains('mobile-open') && document.querySelector('.sidebar').getBoundingClientRect().x>=0,{},{timeout:5000});
  const bounds=await p.getByRole('button',{name:'Customers',exact:true}).first().boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  await p.getByRole('button',{name:'Customers',exact:true}).first().click();
  await p.getByRole('link',{name:'Offline Customers · synthetic development'}).waitFor({timeout:5000});
  assert.equal(await p.locator('.sidebar').evaluate(n=>n.classList.contains('mobile-open')),false);
 });
 await check('navigation source renders disabled until hydrated',async()=>{
  const response=await context.request.get(origin);const html=await response.text();
  assert.match(html,/data-app-ready="false"/);assert.match(html,/disabled/);
 });
 await check('Home and Back each respond to one enabled tap and reset scroll',async()=>{
  await p.locator('.mobile-home-button').click();await p.getByRole('button',{name:'Open menu',exact:true}).click();
  await p.getByRole('button',{name:'Customers',exact:true}).first().click();
  await p.locator('.mobile-back-button').click();await p.getByRole('heading',{name:"Welcome to First In Response Exteriors"}).waitFor({timeout:5000});assert.equal(await p.evaluate(()=>scrollY),0);
 });
 await check('no external browser requests or runtime errors',async()=>{assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);});
 console.log(JSON.stringify({passed,total:passed,checks,deployment,actualFrameworkRuntime:true,singleNativeClicks:true,retries:false,syntheticFixtures:true,physicalIPhoneTested:false,shakingResolved:false}));process.exitCode=0;
}finally{if(context)await context.close();if(server){try{process.kill(-server.pid,'SIGTERM');}catch{}}if(process.env.FIRE_FRAMEWORK_LOG_PATH)writeFileSync(process.env.FIRE_FRAMEWORK_LOG_PATH,serverLog);rmSync(profile,{recursive:true,force:true});rmSync(testRoot,{recursive:true,force:true});}
