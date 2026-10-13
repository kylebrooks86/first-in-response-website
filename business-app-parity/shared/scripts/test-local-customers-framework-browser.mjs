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
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});
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
 await check('actual framework renders and hydrates candidate route',async()=>{const response=await p.goto(origin+path);if(response.status()!==200){const html=await response.text();console.log('Framework error details: '+JSON.stringify([...html.matchAll(/rsc\.push\(("(?:[^"\\]|\\.)*")\)/g)].map(x=>JSON.parse(x[1])).filter(x=>x.includes(':E{'))));}assert.equal(response.status(),200);await p.getByLabel('New test phrase',{exact:true}).waitFor();assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await check('explicit local fixture creation mounts locked and clears phrase',async()=>{await p.getByLabel('New test phrase',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Create empty synthetic test vault'}).click();await p.getByLabel('New test phrase',{exact:true}).waitFor({state:'detached'});assert.equal(await p.locator('[data-customer-id]').count(),0);});
 async function unlock(){await p.getByLabel('Test recovery phrase',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Unlock local contacts',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-local-customer-state]')?.dataset.localCustomerState==='ready');}
 await unlock();
 async function save(name){await p.getByLabel('Name',{exact:true}).fill(name);await p.getByLabel('Test phrase for this local save',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Save locally',exact:true}).click();await p.waitForFunction(n=>[...document.querySelectorAll('[data-customer-id] strong')].some(x=>x.textContent===n),name);}
 await check('framework panel saves encrypted contacts and shows pending status',async()=>{await p.getByRole('button',{name:'Add synthetic customer'}).click();await save('Synthetic Framework Contact');assert.match(await p.locator('[data-save-status]').innerText(),/Saved locally/);});
 await check('loaded framework panel edits offline',async()=>{await context.setOffline(true);await p.getByRole('button',{name:'Edit Synthetic Framework Contact'}).click();await save('Synthetic Framework Offline');assert.match(await p.locator('.customer-workspace').innerText(),/Revision 2/);await context.setOffline(false);});
 await check('actual framework retains a new unsaved edit for comparison',async()=>{
  await p.getByRole('button',{name:'Edit Synthetic Framework Offline',exact:true}).click();await p.getByLabel('Name',{exact:true}).fill('Synthetic Draft '+ 'Long comparison text '.repeat(8));
  assert.equal(await p.getByRole('region',{name:'Stored customer and draft comparison'}).count(),0);
 });
 await check('actual framework reads stored receipts offline without server acknowledgement',async()=>{
  await context.setOffline(true);await p.getByLabel('Test phrase for stored inspection',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Inspect stored local receipts'}).click();
  await p.getByRole('region',{name:'Stored local receipt report'}).waitFor();const text=await p.getByRole('region',{name:'Stored local receipt report'}).innerText();
  assert.match(text,/2 stored receipts/);assert.match(text,/Synthetic Framework Offline/);assert.match(text,/No server acknowledgement/);assert.equal(await p.getByLabel('Test phrase for stored inspection',{exact:true}).inputValue(),'');await context.setOffline(false);
 });
 await check('actual framework explicitly compares stored record and retained draft',async()=>{
  await p.getByRole('button',{name:'Review stored record against draft'}).click();const review=p.getByRole('region',{name:'Stored customer and draft comparison'});
  assert.match(await review.locator('[data-comparison-summary]').innerText(),/1 of 5/);
  assert.deepEqual((await review.locator('[data-comparison-field=name] dd').allTextContents()).slice(0,2),['Synthetic Framework Offline','No save attempt']);
  assert.ok((await p.getByLabel('Name',{exact:true}).inputValue()).startsWith('Synthetic Draft'));
 });
 await check('actual framework requires explicit proposal choices without replacing draft',async()=>{
  assert.equal(await p.getByRole('region',{name:'Proposed customer resolution'}).count(),0);
  for(const name of ['Name','Email','Phone','Address','Lead source'])await p.getByRole('button',{name:'Use draft '+name,exact:true}).click();
  const proposed=p.getByRole('region',{name:'Proposed customer resolution'});assert.equal(await proposed.locator('[data-proposed-field]').count(),5);
  assert.equal(await proposed.locator('[data-proposed-field=name] dd').innerText(),await p.getByLabel('Name',{exact:true}).inputValue());
 });
 await check('actual framework rechecks proposal offline without saving contact',async()=>{
  await context.setOffline(true);await p.getByLabel('Test phrase for resolution recheck',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Recheck stored snapshot for proposal'}).click();
  await p.waitForFunction(()=>document.querySelector('[data-resolution-status]').textContent.includes('matches the reviewed inspection'));
  assert.equal(await p.getByLabel('Test phrase for resolution recheck',{exact:true}).inputValue(),'');assert.match(await p.locator('[data-customer-id]').innerText(),/Revision 2/);
  await context.setOffline(false);
 });
 for(const theme of ['dark','light'])await check('stored receipt report fits actual 320px '+theme+' screen',async()=>{
  await p.setViewportSize({width:320,height:844});if(await p.locator('.fire-synthetic-preview').getAttribute('data-theme')!==theme)await p.getByRole('button',{name:'Switch to '+theme+' mode'}).click();
  assert.equal(await p.getByRole('region',{name:'Stored local receipt report'}).count(),1);assert.equal(await p.getByRole('region',{name:'Stored customer and draft comparison'}).count(),1);assert.equal(await p.getByRole('region',{name:'Proposed customer resolution'}).count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 });
 let portableFile;
 await check('candidate encrypted download preserves retained draft and saved revision',async()=>{
  const draft=await p.getByLabel('Name',{exact:true}).inputValue();
  await p.getByLabel('Test phrase for portable backup',{exact:true}).fill(phrase);
  const download=p.waitForEvent('download');await p.getByRole('button',{name:'Download encrypted customer bundle',exact:true}).click();
  const result=await download;portableFile=readFileSync(await result.path());
  await p.waitForFunction(()=>document.querySelector('[data-backup-status]')?.textContent.includes('download prepared'));
  assert.ok(/^fire-customer-bundle-.*\.json$/.test(result.suggestedFilename()));
  assert.deepEqual(Object.keys(JSON.parse(portableFile)),['format','version','salt','iv','ciphertext']);
  assert.ok(!portableFile.toString().includes('Synthetic Framework'));assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),draft);
  assert.match(await p.locator('[data-customer-id]').innerText(),/Revision 2/);assert.equal(await p.getByLabel('Test phrase for portable backup',{exact:true}).inputValue(),'');
  assert.match(await p.getByRole('region',{name:'Portable encrypted customer backup'}).innerText(),/current unsaved edit is not yet archived/i);
 });
 async function verifyFile(buffer,testPhrase){
  await p.getByLabel('Portable encrypted JSON file',{exact:true}).setInputFiles({name:'synthetic-portable.json',mimeType:'application/json',buffer});
  await p.getByLabel('Test phrase for portable file verification',{exact:true}).fill(testPhrase);
  await p.getByRole('button',{name:'Verify portable bundle without changes',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('[data-backup-status]')?.textContent.includes('Processing'));
 }
 await check('actual downloaded file verifies offline without restoration or draft loss',async()=>{
  const draft=await p.getByLabel('Name',{exact:true}).inputValue();await context.setOffline(true);await verifyFile(portableFile,phrase);
  assert.match(await p.locator('[data-backup-status]').innerText(),/1 customers, 2 receipts and 0 resolution draft archives/);
  assert.match(await p.locator('[data-backup-status]').innerText(),/Verification only; no restoration/);
  assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),draft);assert.equal(await p.getByLabel('Test phrase for portable file verification',{exact:true}).inputValue(),'');
  assert.equal(await p.getByLabel('Portable encrypted JSON file',{exact:true}).inputValue(),'');await context.setOffline(false);
 });
 await check('wrong portable phrase shows authentication uncertainty and keeps saved revision',async()=>{
  await verifyFile(portableFile,'incorrect synthetic portable phrase');assert.match(await p.locator('[data-backup-status]').innerText(),/incorrect phrase or altered encrypted file/);assert.match(await p.locator('[data-customer-id]').innerText(),/Revision 2/);
 });
 await check('malformed file is rejected without losing retained draft',async()=>{
  const draft=await p.getByLabel('Name',{exact:true}).inputValue();await verifyFile(Buffer.from('{broken'),phrase);
  assert.match(await p.locator('[data-backup-status]').innerText(),/Invalid portable bundle/);assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),draft);
 });
 await check('altered downloaded ciphertext cannot verify or write records',async()=>{
  const value=JSON.parse(portableFile);value.ciphertext=(value.ciphertext.startsWith('00')?'01':'00')+value.ciphertext.slice(2);await verifyFile(Buffer.from(JSON.stringify(value)),phrase);
  assert.match(await p.locator('[data-backup-status]').innerText(),/incorrect phrase or altered encrypted file/);assert.match(await p.locator('[data-customer-id]').innerText(),/Revision 2/);
 });
 await check('locking interrupts a pending export and hides backup controls',async()=>{
  const downloads=[];const listener=d=>downloads.push(d);p.on('download',listener);
  await p.getByLabel('Test phrase for portable backup',{exact:true}).fill(phrase);await p.getByRole('button',{name:'Download encrypted customer bundle',exact:true}).click();
  await p.getByRole('button',{name:'Lock local contacts',exact:true}).click();await p.waitForTimeout(1000);
  assert.deepEqual(downloads,[]);assert.equal(await p.getByRole('region',{name:'Portable encrypted customer backup'}).count(),0);p.off('download',listener);await unlock();
 });
 await check('actual page lifecycle locks and never automatically unlocks',async()=>{await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.waitForFunction(()=>!document.querySelector('[data-customer-id]'));assert.equal(await p.getByRole('region',{name:'Stored local receipt report'}).count(),0);assert.equal(await p.getByRole('region',{name:'Stored customer and draft comparison'}).count(),0);await p.evaluate(()=>dispatchEvent(new Event('pageshow')));assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock();});
 await check('actual route reload preserves encrypted contact and receipts',async()=>{await p.reload();await p.getByRole('button',{name:'Unlock local contacts',exact:true}).waitFor();await unlock();assert.match(await p.locator('.customer-workspace').innerText(),/Synthetic Framework Offline/);assert.match(await p.locator('.customer-workspace').innerText(),/2 local operation receipts/);});
 await check('Home loads actual app with empty synthetic D1 and exposes gated Customers entry',async()=>{await p.setViewportSize({width:1280,height:900});await p.getByRole('link',{name:'FIRE · Home',exact:true}).click();await p.getByRole('button',{name:'Customers',exact:true}).first().click();await p.getByRole('link',{name:'Offline Customers · synthetic development'}).waitFor({timeout:5000});assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await check('candidate entry navigation returns locked and retains contacts',async()=>{await p.getByRole('link',{name:'Offline Customers · synthetic development'}).click();await p.getByRole('button',{name:'Unlock local contacts',exact:true}).waitFor();await unlock();assert.match(await p.locator('.customer-workspace').innerText(),/Synthetic Framework Offline/);});
 for(const theme of ['dark','light'])await check('actual 320px '+theme+' layout fits',async()=>{await p.setViewportSize({width:320,height:844});if(await p.locator('.fire-synthetic-preview').getAttribute('data-theme')!==theme)await p.getByRole('button',{name:'Switch to '+theme+' mode'}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);});
 await check('no external requests or framework browser errors',async()=>{assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);});
 console.log(JSON.stringify({passed,total:passed,checks,deployment,browserVersion:context.browser().version(),actualFrameworkRuntime:true,actualAuthAdapter:true,syntheticAuthFixtures:true,disposableLocalD1:true,realGatewayTested:false,productionActivated:false}));process.exitCode=0;
}finally{if(context)await context.close();if(server){try{process.kill(-server.pid,'SIGTERM');}catch{}}if(process.env.FIRE_FRAMEWORK_LOG_PATH)writeFileSync(process.env.FIRE_FRAMEWORK_LOG_PATH,serverLog);rmSync(profile,{recursive:true,force:true});rmSync(testRoot,{recursive:true,force:true});}
