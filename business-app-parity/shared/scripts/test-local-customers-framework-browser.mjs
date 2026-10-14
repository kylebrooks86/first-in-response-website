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
 async function destinationCheck(page,buffer,testPhrase){
  await page.getByLabel('Portable JSON file for destination check',{exact:true}).setInputFiles({name:'synthetic-bundle.json',mimeType:'application/json',buffer});
  await page.getByLabel('Test phrase for destination check',{exact:true}).fill(testPhrase);await page.getByRole('button',{name:'Verify file and check destination without changes',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-destination-status]')?.textContent.includes('Verifying file and reading'));
 }
 await check('locked occupied destination preflight blocks recovery without unlocking',async()=>{
  await p.getByRole('button',{name:'Lock local contacts',exact:true}).click();await destinationCheck(p,portableFile,phrase);
  assert.match(await p.locator('[data-destination-status]').innerText(),/destination contains stored vault data/);assert.equal(await p.locator('[data-customer-id]').count(),0);
  assert.equal(await p.getByLabel('Test phrase for destination check',{exact:true}).inputValue(),'');assert.equal(await p.getByLabel('Portable JSON file for destination check',{exact:true}).inputValue(),'');
 });
 await check('locked destination check distinguishes failed file authentication',async()=>{
  await destinationCheck(p,portableFile,'incorrect synthetic destination phrase');assert.match(await p.locator('[data-destination-status]').innerText(),/incorrect phrase or altered encrypted file/);assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock();assert.match(await p.locator('[data-customer-id]').innerText(),/Revision 2/);
 });
 await check('genuinely empty authenticated browser preflight performs no restoration',async()=>{
  const isolated=await context.browser().newContext();try{
   await isolated.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});
   if(deployment==='doomsday')await isolated.addCookies(await context.cookies());else await isolated.setExtraHTTPHeaders({'oai-authenticated-user-id':'synthetic-framework-owner','oai-authenticated-user-email':'kylebrooks8605@gmail.com'});
   const q=await isolated.newPage();await q.goto(origin+path);await q.getByLabel('New test phrase',{exact:true}).waitFor();
   await destinationCheck(q,portableFile,phrase);assert.match(await q.locator('[data-destination-status]').innerText(),/No stored destination rows found/);assert.match(await q.locator('[data-destination-status]').innerText(),/no records were restored/);
   const rows=await q.evaluate(async()=>{const result=[];for(const info of await indexedDB.databases()){if(!info.name.startsWith('fire-local-customer-vault:'))continue;result.push(await new Promise((resolve,reject)=>{const request=indexedDB.open(info.name);request.onsuccess=()=>{const db=request.result,tx=db.transaction('sealed','readonly'),read=tx.objectStore('sealed').count();tx.oncomplete=()=>{db.close();resolve(read.result);};tx.onabort=()=>reject(tx.error);};request.onerror=()=>reject(request.error);}));}return result;});assert.deepEqual(rows,[0]);assert.equal(await q.locator('[data-customer-id]').count(),0);
  }finally{await isolated.close();}
 });
 await check('authenticated candidate recovery requires confirmation and completes locked',async()=>{
  const isolated=await context.browser().newContext();try{
   await isolated.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});
   if(deployment==='doomsday')await isolated.addCookies(await context.cookies());else await isolated.setExtraHTTPHeaders({'oai-authenticated-user-id':'synthetic-framework-owner','oai-authenticated-user-email':'kylebrooks8605@gmail.com'});
   const q=await isolated.newPage();await q.goto(origin+path);await q.getByLabel('New test phrase',{exact:true}).waitFor();await destinationCheck(q,portableFile,phrase);
   const action=q.getByRole('button',{name:'Recover verified bundle only if destination is empty',exact:true});assert.equal(await action.isDisabled(),true);
   await q.getByLabel('Re-enter test phrase for deliberate recovery',{exact:true}).fill(phrase);await q.getByLabel('I approve recovery into this empty synthetic candidate vault.',{exact:true}).check();await action.click();await q.waitForFunction(()=>document.querySelector('[data-destination-status]')?.textContent.includes('Recovered 1 customers'));
   assert.equal(await q.locator('[data-local-customer-state]').getAttribute('data-local-customer-state'),'locked');assert.equal(await q.locator('[data-customer-id]').count(),0);assert.equal(await q.getByLabel('New test phrase',{exact:true}).count(),0);
   await q.getByLabel('Test recovery phrase',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Unlock local contacts',exact:true}).click();await q.waitForFunction(()=>document.querySelector('[data-local-customer-state]')?.dataset.localCustomerState==='ready');assert.match(await q.locator('[data-customer-id]').innerText(),/Revision 2/);assert.match(await q.locator('.customer-workspace').innerText(),/2 local operation receipts/);
  }finally{await isolated.close();}
 });
 await check('actual page lifecycle locks and never automatically unlocks',async()=>{await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.waitForFunction(()=>!document.querySelector('[data-customer-id]'));assert.equal(await p.getByRole('region',{name:'Stored local receipt report'}).count(),0);assert.equal(await p.getByRole('region',{name:'Stored customer and draft comparison'}).count(),0);await p.evaluate(()=>dispatchEvent(new Event('pageshow')));assert.equal(await p.locator('[data-customer-id]').count(),0);await unlock();});
 await check('actual route reload preserves encrypted contact and receipts',async()=>{await p.reload();await p.getByRole('button',{name:'Unlock local contacts',exact:true}).waitFor();await unlock();assert.match(await p.locator('.customer-workspace').innerText(),/Synthetic Framework Offline/);assert.match(await p.locator('.customer-workspace').innerText(),/2 local operation receipts/);});
 await check('Home loads actual app with empty synthetic D1 and exposes gated Customers entry',async()=>{await p.setViewportSize({width:1280,height:900});await p.getByRole('link',{name:'FIRE · Home',exact:true}).click();await p.getByRole('button',{name:'Customers',exact:true}).first().click();await p.getByRole('link',{name:'Offline Customers · synthetic development'}).waitFor({timeout:5000});assert.equal(await p.locator('[data-customer-id]').count(),0);});
 await check('unfinished estimate close requires explicit discard and preserves service pricing on cancel',async()=>{
  await p.getByRole('button',{name:'Dashboard',exact:true}).first().click();
  await p.getByRole('button',{name:'New estimate',exact:true}).first().click();let editor=p.getByRole('dialog',{name:'Create estimate',exact:true});await editor.getByPlaceholder('Full name',{exact:true}).fill('Synthetic Unsaved Estimate');await editor.getByPlaceholder('Tulsa-area address',{exact:true}).fill('Synthetic Service Address');await editor.getByRole('button',{name:'Continue to services'}).click();
  await editor.getByRole('combobox').first().click();await p.getByRole('option',{name:/House Wash/}).first().click();await editor.locator('.edit-quantity-row input').fill('2500');await editor.locator('.discount-input input').last().fill('10');
  const before=await editor.locator('input,textarea').evaluateAll(nodes=>nodes.map(n=>({value:n.value,checked:n.checked??null})));
  let releaseSave;const holdSave=new Promise(resolve=>{releaseSave=resolve;});let requestSeen;const seenSave=new Promise(resolve=>{requestSeen=resolve;});const failSave=async r=>{requestSeen();await holdSave;await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic interrupted save'})});};await p.route('**/api/estimates',failSave);
  await editor.getByRole('button',{name:/^Save .* estimate$/}).click();await seenSave;await p.keyboard.press('Escape');assert.equal(await editor.isVisible(),true);assert.deepEqual(await editor.locator('input,textarea').evaluateAll(nodes=>nodes.map(n=>({value:n.value,checked:n.checked??null}))),before);releaseSave();await editor.getByRole('alert').filter({hasText:'Synthetic interrupted save'}).waitFor();await p.unroute('**/api/estimates',failSave);assert.deepEqual(await editor.locator('input,textarea').evaluateAll(nodes=>nodes.map(n=>({value:n.value,checked:n.checked??null}))),before);
  const decline=d=>d.dismiss();p.once('dialog',decline);await p.keyboard.press('Escape');assert.equal(await editor.isVisible(),true);assert.deepEqual(await editor.locator('input,textarea').evaluateAll(nodes=>nodes.map(n=>({value:n.value,checked:n.checked??null}))),before);
  p.once('dialog',d=>d.accept());await p.keyboard.press('Escape');await editor.waitFor({state:'hidden'});await p.getByRole('button',{name:'New estimate',exact:true}).first().click();editor=p.getByRole('dialog',{name:'Create estimate',exact:true});assert.equal(await editor.getByPlaceholder('Full name',{exact:true}).inputValue(),'');await editor.getByPlaceholder('Full name',{exact:true}).fill('Synthetic Rapid Reopen');await p.waitForTimeout(350);assert.equal(await editor.getByPlaceholder('Full name',{exact:true}).inputValue(),'Synthetic Rapid Reopen');p.once('dialog',d=>d.accept());await p.keyboard.press('Escape');await editor.waitFor({state:'hidden'});await p.getByRole('button',{name:'Customers',exact:true}).first().click();
 });
 await check('opening external composer stays Prepared; failed and deliberate send confirmations preserve truthful state',async()=>{
  const r=await context.request.post(origin+'/api/estimates',{data:{customer:'Synthetic Messaging Owner',email:'synthetic@example.invalid',phone:'5550100999',address:'Synthetic Address',items:[{name:'Synthetic Message Service',quantity:1,unit:'job',totalCents:20000}]}});assert.equal(r.status(),201);const created=await r.json();
  const state=async()=>{const data=await (await context.request.get(origin+'/api/estimates')).json();return data.estimates.find(e=>e.id===created.id);};
  await p.getByRole('button',{name:'Estimates',exact:true}).first().click();await p.locator('.pipeline-card').filter({hasText:'Synthetic Messaging Owner'}).click();await p.getByRole('button',{name:'Send estimate',exact:true}).click();const composer=p.getByRole('dialog',{name:'Message Synthetic Messaging Owner',exact:true});
  await composer.getByRole('button',{name:'Text',exact:true}).click();await composer.getByRole('status').filter({hasText:'Prepared'}).waitFor();assert.equal((await state()).status,'draft');assert.equal((await state()).lastEstimateSentAt,null);assert.equal((await state()).lastEstimateContactAt,null);await composer.getByRole('button',{name:'Not sent — keep editing',exact:true}).click();assert.equal((await state()).status,'draft');
  await composer.getByRole('button',{name:'Text',exact:true}).click();await composer.getByRole('button',{name:'I sent the prepared message',exact:true}).waitFor();
  const fail=async route=>route.request().method()==='PATCH'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic confirmation unavailable'})}):route.continue();await p.route('**/api/customer-messages',fail);await composer.getByRole('button',{name:'I sent the prepared message',exact:true}).click();await composer.getByRole('status').filter({hasText:'Synthetic confirmation unavailable'}).waitFor();assert.equal((await state()).status,'draft');assert.equal(await composer.getByRole('button',{name:'I sent the prepared message',exact:true}).isEnabled(),true);await p.unroute('**/api/customer-messages',fail);
  await composer.getByRole('button',{name:'I sent the prepared message',exact:true}).click();await composer.getByRole('status').filter({hasText:'Delivery and read status are unknown'}).waitFor();assert.equal((await state()).status,'sent');assert.ok((await state()).lastEstimateSentAt);assert.equal((await state()).lastEstimateSentAt,(await state()).lastEstimateContactAt);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
  const history=await (await context.request.get(origin+'/api/customers')).json();const messages=history.messages??history.customerMessages;assert.equal(messages.filter(m=>m.customerId===created.customerId&&m.channel==='text_prepared').length,2);const confirmed=messages.find(m=>m.customerId===created.customerId&&m.channel==='text_confirmed');assert.ok(confirmed);const preparedId=confirmed.id.replace(':owner-confirmed','');const again=await context.request.patch(origin+'/api/customer-messages',{data:{preparedMessageId:preparedId,customerId:created.customerId,ownerConfirmedSent:true}});assert.equal(again.status(),200);assert.equal((await again.json()).message.id,confirmed.id);
  const missing=await context.request.patch(origin+'/api/customer-messages',{data:{preparedMessageId:preparedId,customerId:created.customerId}});assert.equal(missing.status(),400);const wrong=await context.request.patch(origin+'/api/customer-messages',{data:{preparedMessageId:preparedId,customerId:'different-synthetic-customer',ownerConfirmedSent:true}});assert.equal(wrong.status(),409);
  const legacy=await context.request.post(origin+'/api/customer-messages',{data:{customerId:created.customerId,channel:'text',template:'estimate',body:'Synthetic unconfirmed'}});assert.equal(legacy.status(),400);
  const email=await context.request.post(origin+'/api/customer-messages',{data:{customerId:created.customerId,estimateId:created.id,channel:'email_prepared',template:'estimate',body:'Synthetic email'}});assert.equal(email.status(),201);const emailId=(await email.json()).message.id;assert.equal((await context.request.patch(origin+'/api/customer-messages',{data:{preparedMessageId:emailId,customerId:created.customerId,ownerConfirmedSent:true}})).status(),200);
  await p.goto(origin+'/');await p.locator('.job-row').filter({hasText:'Synthetic Messaging Owner'}).waitFor();assert.equal(await p.locator('.job-row').filter({hasText:'Synthetic Messaging Owner'}).locator('.date-tile b').innerText(),new Date((await state()).createdAt).toLocaleDateString('en-US',{day:'numeric',timeZone:'America/Chicago'}));await p.getByRole('button',{name:'Customers',exact:true}).first().click();
 });
 await check('follow-up screen uses confirmed contact dates and preserves unsent legacy and billing reminders',async()=>{
  const data=await (await context.request.get(origin+'/api/estimates')).json();const saved=data.estimates.find(e=>e.customer==='Synthetic Messaging Owner');assert.ok(saved.lastEstimateSentAt);
  const now=Date.now(),ago=n=>new Date(now-n*86400000).toISOString();
  const row=(id,customer,patch={})=>({...saved,id,customer,createdAt:ago(30),lastEstimateSentAt:ago(8),lastEstimateContactAt:ago(8),...patch});
  const fixtures=[row('fresh','Synthetic Fresh Send',{lastEstimateSentAt:ago(0),lastEstimateContactAt:ago(0)}),row('contact','Synthetic Recent Contact',{lastEstimateContactAt:ago(0)}),row(saved.id,'Synthetic Due Contact',{lastEstimateSentAt:ago(2),lastEstimateContactAt:ago(2)}),row('legacy','Synthetic Legacy Send',{lastEstimateSentAt:null,lastEstimateContactAt:null}),row('draft','Synthetic Unsent Draft',{status:'draft',lastEstimateSentAt:null,lastEstimateContactAt:null}),row('billing','Synthetic Billing Exception',{paymentOverageOpen:1,lastEstimateContactAt:ago(0)})];
  const fixture=async route=>route.request().method()==='GET'?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({estimates:fixtures})}):route.continue();await p.route('**/api/estimates',fixture);await p.getByRole('button',{name:'Follow-ups',exact:true}).first().click();await p.getByText('Synthetic Due Contact',{exact:true}).waitFor();
  assert.equal(await p.getByText('Synthetic Fresh Send',{exact:true}).count(),0);assert.equal(await p.getByText('Synthetic Recent Contact',{exact:true}).count(),0);assert.match(await p.locator('.followup-card').filter({hasText:'Synthetic Due Contact'}).innerText(),/No confirmed estimate contact for at least 1 day/);assert.match(await p.locator('.followup-card').filter({hasText:'Synthetic Legacy Send'}).innerText(),/send date unconfirmed/);assert.match(await p.locator('.followup-card').filter({hasText:'Synthetic Billing Exception'}).innerText(),/Billing exception/);
  const draft=p.locator('.followup-card').filter({hasText:'Synthetic Unsent Draft'});assert.match(await draft.innerText(),/Unsent draft/);await draft.getByRole('button',{name:'Prepare message',exact:true}).click();const composer=p.getByRole('dialog',{name:'Message Synthetic Unsent Draft',exact:true});assert.match(await composer.getByLabel('Personalized message',{exact:true}).inputValue(),/estimate.*ready/i);await p.keyboard.press('Escape');const due=p.locator('.followup-card').filter({hasText:'Synthetic Due Contact'});await due.getByRole('button',{name:'Prepare message',exact:true}).click();const followup=p.getByRole('dialog',{name:'Message Synthetic Due Contact',exact:true});await followup.getByRole('button',{name:'Text',exact:true}).click();await followup.getByRole('button',{name:'I sent the prepared message',exact:true}).click();await due.waitFor({state:'detached'});assert.equal(await p.locator('.followup-card').filter({hasText:'Synthetic Billing Exception'}).count(),1);await p.unroute('**/api/estimates',fixture);const actual=await (await context.request.get(origin+'/api/estimates')).json();assert.ok(actual.estimates.find(e=>e.id===saved.id).lastEstimateContactAt>=saved.lastEstimateContactAt);await p.getByRole('button',{name:'Customers',exact:true}).first().click();
 });
 await check('candidate entry navigation returns locked and retains contacts',async()=>{await p.getByRole('link',{name:'Offline Customers · synthetic development'}).click();await p.getByRole('button',{name:'Unlock local contacts',exact:true}).waitFor();await unlock();assert.match(await p.locator('.customer-workspace').innerText(),/Synthetic Framework Offline/);});
 for(const theme of ['dark','light'])await check('actual 320px '+theme+' layout fits',async()=>{await p.setViewportSize({width:320,height:844});if(await p.locator('.fire-synthetic-preview').getAttribute('data-theme')!==theme)await p.getByRole('button',{name:'Switch to '+theme+' mode'}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);});
 await check('authenticated reviewed resolution UI saves archives verifies and recovers deliberately',async()=>{
  async function isolatedOwner(){const c=await context.browser().newContext();await c.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){remote.push(r.request().url());return r.abort();}return r.continue();});if(deployment==='doomsday')await c.addCookies(await context.cookies());else await c.setExtraHTTPHeaders({'oai-authenticated-user-id':'synthetic-framework-owner','oai-authenticated-user-email':'kylebrooks8605@gmail.com'});return c;}
  const c=await isolatedOwner();let recovery;try{
   const q=await c.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(origin+path);await q.getByLabel('New test phrase',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Create empty synthetic test vault',exact:true}).click();await q.getByLabel('New test phrase',{exact:true}).waitFor({state:'detached'});await q.getByLabel('Test recovery phrase',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Unlock local contacts',exact:true}).click();await q.waitForFunction(()=>document.querySelector('[data-local-customer-state]')?.dataset.localCustomerState==='ready');await q.getByRole('button',{name:'Add synthetic customer',exact:true}).click();await q.getByLabel('Name',{exact:true}).fill('Synthetic Reviewed Framework');await q.getByLabel('Test phrase for this local save',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Save locally',exact:true}).click();await q.getByRole('button',{name:'Edit Synthetic Reviewed Framework',exact:true}).click();await q.getByLabel('Name',{exact:true}).fill('Synthetic Original Framework Draft');
   await q.getByLabel('Test phrase for stored inspection',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Inspect stored local receipts',exact:true}).click();await q.getByRole('button',{name:'Review stored record against draft',exact:true}).click();for(const title of ['Name','Email','Phone','Address','Lead source'])await q.getByRole('button',{name:'Use stored '+title,exact:true}).click();await q.getByLabel('Test phrase for resolution recheck',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Recheck stored snapshot for proposal',exact:true}).click();await q.waitForFunction(()=>document.querySelector('[data-resolution-status]')?.textContent.includes('matches the reviewed inspection'));
   const action=q.getByRole('button',{name:'Save reviewed proposal and archive original draft',exact:true});assert.equal(await action.isDisabled(),true);await q.getByLabel('Test phrase for reviewed resolution save',{exact:true}).fill(phrase);await q.getByLabel('I approve this reviewed proposal and preservation of my original draft.',{exact:true}).check();await action.click();await q.waitForFunction(()=>document.querySelector('[data-save-status]')?.textContent.includes('Original draft and review history archived'));assert.match(await q.locator('[data-customer-id]').innerText(),/Revision 2/);
   await q.getByLabel('Test phrase for portable backup',{exact:true}).fill(phrase);const pending=q.waitForEvent('download');await q.getByRole('button',{name:'Download encrypted customer bundle',exact:true}).click();const bytes=readFileSync(await (await pending).path());await q.getByLabel('Portable encrypted JSON file',{exact:true}).setInputFiles({name:'synthetic-review.json',mimeType:'application/json',buffer:bytes});await q.getByLabel('Test phrase for portable file verification',{exact:true}).fill(phrase);await q.getByRole('button',{name:'Verify portable bundle without changes',exact:true}).click();await q.waitForFunction(()=>document.querySelector('[data-backup-status]')?.textContent.includes('1 customers, 2 receipts and 1 resolution draft archives'));
   recovery=await isolatedOwner();const r=await recovery.newPage();await r.goto(origin+path);await r.getByLabel('New test phrase',{exact:true}).waitFor();await destinationCheck(r,bytes,phrase);await r.getByLabel('Re-enter test phrase for deliberate recovery',{exact:true}).fill(phrase);await r.getByLabel('I approve recovery into this empty synthetic candidate vault.',{exact:true}).check();await r.getByRole('button',{name:'Recover verified bundle only if destination is empty',exact:true}).click();await r.waitForFunction(()=>document.querySelector('[data-destination-status]')?.textContent.includes('Recovered 1 customers and 1 resolution draft archives'));assert.equal(await r.locator('[data-customer-id]').count(),0);
  }finally{if(recovery)await recovery.close();await c.close();}
 });
 await check('no external requests or framework browser errors',async()=>{assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);});
 console.log(JSON.stringify({passed,total:passed,checks,deployment,browserVersion:context.browser().version(),actualFrameworkRuntime:true,actualAuthAdapter:true,syntheticAuthFixtures:true,disposableLocalD1:true,realGatewayTested:false,productionActivated:false}));process.exitCode=0;
}finally{if(context)await context.close();if(server){try{process.kill(-server.pid,'SIGTERM');}catch{}}if(process.env.FIRE_FRAMEWORK_LOG_PATH)writeFileSync(process.env.FIRE_FRAMEWORK_LOG_PATH,serverLog);rmSync(profile,{recursive:true,force:true});rmSync(testRoot,{recursive:true,force:true});}
