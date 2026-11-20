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
 const seed=Array.from({length:48},(_,i)=>`INSERT INTO customers(id,name,email,phone,address,created_at) VALUES('synthetic-scroll-${i}','Synthetic Customer ${String(i).padStart(2,'0')} ${'Long contact name '.repeat(i%3+1)}','synthetic${i}@example.invalid','','Synthetic address ${i}','2026-10-13T00:00:00.000Z');`).join('\n');
 writeFileSync(join(testRoot,'synthetic-schema.sql'),readFileSync(join(testRoot,'synthetic-schema.sql'),'utf8')+'\n'+seed);
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
 const observations=[];
 await p.setViewportSize({width:1280,height:844});await p.goto(origin);
 await p.getByRole('button',{name:'Customers',exact:true}).first().click();
 await p.waitForFunction(()=>document.querySelectorAll('.customer-card').length===48);
 await check('actual Customers route loads 48 synthetic local-D1 records',async()=>assert.equal(await p.locator('.customer-card').count(),48));
 await p.locator('.candidate-layout-trace summary').click();
 await check('manual capture records geometry only and reports stop',async()=>{
  const before=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.getByRole('button',{name:'Start layout capture',exact:true}).click();
  await p.waitForTimeout(350);await p.mouse.wheel(0,200);
  await p.getByRole('button',{name:'Stop layout capture',exact:true}).click();
  const report=JSON.parse(await p.locator('#candidate-layout-report').inputValue());
  assert.equal(report.version,1);assert.equal(report.reason,'manual');assert.ok(report.frames.length>=2);
  assert.deepEqual(Object.keys(report).sort(),['events','frames','reason','version']);
  assert.deepEqual(Object.keys(report.frames[0]).sort(),['documentHeight','elapsedMs','headerTop','lastCustomerTop','scrollY','viewportHeight','visualViewportHeight','visualViewportOffsetTop']);
  assert.ok(report.frames.every(f=>Object.values(f).every(v=>v===null||typeof v==='number')));
  assert.ok(report.events.every(e=>['scroll','resize','visual-resize','visual-scroll'].includes(e.kind)));
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),before);
  assert.equal(await p.locator('.customer-card').count(),48);
 });
 await check('discard removes in-memory layout report',async()=>{await p.getByRole('button',{name:'Discard layout report',exact:true}).click();assert.equal(await p.locator('#candidate-layout-report').count(),0);});
 await check('capture auto-stops at 20 seconds with bounded samples',async()=>{
  await p.getByRole('button',{name:'Start layout capture',exact:true}).click();
  await p.locator('#candidate-layout-report').waitFor({timeout:25000});
  const report=JSON.parse(await p.locator('#candidate-layout-report').inputValue());
  assert.equal(report.reason,'timeout');assert.ok(report.frames.length>10&&report.frames.length<=201);assert.ok(report.events.length<=600);
  await p.getByRole('button',{name:'Discard layout report',exact:true}).click();
 });
 await check('navigation cancels capture without leaking a report',async()=>{
  await p.getByRole('button',{name:'Start layout capture',exact:true}).click();
  await p.goto(origin+path);await p.getByText('Offline Customers · synthetic candidate',{exact:true}).waitFor();
  await p.goto(origin);await p.getByRole('button',{name:'Customers',exact:true}).first().click();
  await p.waitForFunction(()=>document.querySelectorAll('.customer-card').length===48);
  assert.equal(await p.locator('#candidate-layout-report').count(),0);
  await p.locator('.candidate-layout-trace summary').click();
  assert.equal(await p.getByRole('button',{name:'Start layout capture',exact:true}).isEnabled(),true);
  await p.locator('.candidate-layout-trace summary').click();
 });
 await check('hidden page ends capture and preserves records',async()=>{
  await p.locator('.candidate-layout-trace summary').click();await p.getByRole('button',{name:'Start layout capture',exact:true}).click();
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  assert.equal(JSON.parse(await p.locator('#candidate-layout-report').inputValue()).reason,'hidden');
  assert.equal(await p.locator('.customer-card').count(),48);
  await p.getByRole('button',{name:'Discard layout report',exact:true}).click();await p.locator('.candidate-layout-trace summary').click();
 });
 await check('capture remains available for a new session',async()=>{
  await p.locator('.candidate-layout-trace summary').click();await p.getByRole('button',{name:'Start layout capture',exact:true}).click();
  await p.waitForTimeout(200);await p.getByRole('button',{name:'Stop layout capture',exact:true}).click();
  assert.equal(JSON.parse(await p.locator('#candidate-layout-report').inputValue()).reason,'manual');
  await p.getByRole('button',{name:'Discard layout report',exact:true}).click();await p.locator('.candidate-layout-trace summary').click();
 });
 async function sample(){return await p.evaluate(async()=>{
  await document.fonts.ready;const frames=[];
  for(let i=0;i<90;i++){
   await new Promise(requestAnimationFrame);const last=document.querySelector('.customer-card:last-child'),header=document.querySelector('.topbar');
   frames.push({scrollY,docHeight:document.documentElement.scrollHeight,viewport:innerHeight,visualViewport:visualViewport?.height??innerHeight,headerTop:header.getBoundingClientRect().top,lastCardTop:last.getBoundingClientRect().top});
  }
  const ranges={};for(const key of Object.keys(frames[0])){const values=frames.map(f=>f[key]);ranges[key]={min:Math.min(...values),max:Math.max(...values),delta:Math.max(...values)-Math.min(...values)};}
  return {frameCount:frames.length,ranges,first:frames[0],last:frames.at(-1),horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
 });}
 async function settleBottom(){await p.evaluate(async()=>{window.scrollTo(0,document.documentElement.scrollHeight);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});}
 for(const width of [320,390,768])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:844});
  const nextTheme=theme==='dark'?'dark':'light';
  if(await p.locator('html').getAttribute('data-theme')!==theme){const button=width<=760?p.locator('.mobile-theme-button'):p.locator('.theme-toggle');await button.click();}
  await check(`${width}px ${theme} diagnostic controls fit the viewport`,async()=>{
   await p.locator('.candidate-layout-trace summary').click();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const bounds=await p.getByRole('button',{name:'Start layout capture',exact:true}).boundingBox();
   assert.ok(bounds.height>=44&&bounds.width>=44);assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
   await p.locator('.candidate-layout-trace summary').click();
  });
  await settleBottom();
  for(const scenario of ['stationary-bottom','wheel-at-bottom','viewport-height-change']){
   await check(`${width}px ${theme} ${scenario} measurement`,async()=>{
    let transition;
    if(scenario==='wheel-at-bottom')await p.mouse.wheel(0,400);
    if(scenario==='viewport-height-change'){
     const before=await sample();await p.setViewportSize({width,height:724});await settleBottom();const short=await sample();await p.setViewportSize({width,height:844});await settleBottom();transition={before:before.last,short:short.last};
    }
    const result=await sample();observations.push({width,theme,scenario,result,transition});
    assert.equal(result.frameCount,90);assert.equal(result.horizontalOverflow,false);
    for(const metric of ['scrollY','docHeight','headerTop','lastCardTop'])assert.ok(result.ranges[metric].delta<=1,`${metric} moved ${result.ranges[metric].delta}px`);
   });
  }
 }
 await check('measurements leave all synthetic records intact',async()=>assert.equal(await p.locator('.customer-card').count(),48));
 await check('no outside browser requests or runtime errors',async()=>{assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);});
 console.log(JSON.stringify({passed,total:passed,checks,deployment,observations,measurementCases:observations.length,syntheticCustomerCount:48,actualFrameworkRuntime:true,viewportWidths:[320,390,768],themes:['light','dark'],fixedViewportFramesPerSample:90,physicalSafariTested:false,shakingReproduced:false,productionActivated:false,layoutCaptureChecks:6}));process.exitCode=0;
}finally{if(context)await context.close();if(server){try{process.kill(-server.pid,'SIGTERM');}catch{}}if(process.env.FIRE_FRAMEWORK_LOG_PATH)writeFileSync(process.env.FIRE_FRAMEWORK_LOG_PATH,serverLog);rmSync(profile,{recursive:true,force:true});rmSync(testRoot,{recursive:true,force:true});}
