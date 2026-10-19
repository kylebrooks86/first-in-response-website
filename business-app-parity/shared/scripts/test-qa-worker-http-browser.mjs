import {exerciseGlobalSearch} from './test-global-search-workflow.mjs';
import {exerciseSearchMetadata} from './test-search-metadata-workflow.mjs';
import {exercisePropertySearch} from './test-property-search-workflow.mjs';
import {exerciseDepositPolicy} from './test-deposit-policy-workflow.mjs';
import {exerciseChangeRequestHistory} from './test-change-request-history-workflow.mjs';
/** Entire BUILT QA Worker, real local workerd/D1, auth cookies and mobile UI.
 * Only a disposable loopback runtime; no remote mode, provider or deployed data.
 */
import assert from 'node:assert/strict';
import {exerciseInvoiceState} from './test-invoice-state-workflow.mjs';
import {exerciseCustomerCreateRetry} from './test-customer-create-retry-workflow.mjs';
import {exerciseManualPaymentConfirmation} from './test-manual-payment-confirmation-workflow.mjs';
import {exerciseBusinessBrand} from './test-business-brand-workflow.mjs';
import {exerciseCustomerBalances} from './test-customer-balance-workflow.mjs';
import {exerciseCompleteLedger} from './test-complete-ledger-workflow.mjs';
import {exercisePublicEstimateRetry} from './test-public-estimate-retry-workflow.mjs';
import {exerciseCustomerLookup} from './test-customer-lookup-workflow.mjs';
import {exerciseCustomerProfileControls} from './test-customer-profile-controls.mjs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {get as httpsGet} from 'node:https';
import {validateRecordIdentities,validateBackupRelationships,validateRefundIntegrity} from './records-backup-integrity.mjs';
const require=createRequire(import.meta.url);
const lookupMode=process.argv.includes('--customer-lookup'),profileMode=process.argv.includes('--customer-profile'),ledgerMode=process.argv.includes('--complete-ledger'),publicRetryMode=process.argv.includes('--public-retry');
if(!process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||!process.env.FIRE_BROWSER_TEST_EXECUTABLE)throw Error('Pinned Chromium runner required');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE);
const root=resolve(new URL('..',import.meta.url).pathname);
const built=JSON.parse(readFileSync(join(root,'dist/server/wrangler.json'),'utf8'));
assert.equal(built.name,'fire-fullapp-qa-20261016');
assert.equal(built.vars.FIRE_ENV,'synthetic-qa');assert.equal(built.vars.FIRE_QA_SYNTHETIC_ONLY,'enabled');
assert.equal(built.d1_databases.length,1);assert.equal(built.d1_databases[0].binding,'DB');
for(const key of ['r2_buckets','services','kv_namespaces','queues','hyperdrive']){
 const value=built[key];assert.ok(!value||(Array.isArray(value)?value.length===0:Object.values(value).every(x=>Array.isArray(x)&&x.length===0)),'Unexpected binding '+key);
}
assert.ok(!Object.keys(built.vars).some(key=>key.startsWith('STRIPE_')));
const temp=mkdtempSync(join(tmpdir(),'fire-local-qa-http-'));
const password='synthetic-http-'+randomUUID(),sessionSecret=randomUUID()+randomUUID();
// Runtime copy removes EVERY physical provider identifier. The original built
// manifest, bindings, secrets and databases are never edited.
const config={name:'fire-local-qa-http-fixture',main:resolve(root,'dist/server',built.main),
 // The locked local workerd binary supports dates through 2026-05-22.
 // Cap only this disposable fixture, never the production build or manifest.
 // This tests built code, not October hosted compatibility-date semantics.
 compatibility_date:'2026-05-22',compatibility_flags:built.compatibility_flags,
 no_bundle:true,rules:built.rules,vars:{...built.vars,...(process.argv.includes('--deposit-policy')?{FIRE_DEPOSIT_POLICY_CANDIDATE:'synthetic-tests-only'}:{}),...(lookupMode?{FIRE_SERVICE_LOCATIONS_CANDIDATE:'synthetic-only',FIRE_CUSTOMER_PROPERTIES_CANDIDATE:'synthetic-only',FIRE_PROPERTY_ESTIMATES_CANDIDATE:'synthetic-tests-only',FIRE_PROPERTY_RECOVERY_CANDIDATE:'synthetic-tests-only',FIRE_PROPERTY_WORKFLOW_CANDIDATE:'synthetic-tests-only'}:{})},
 assets:{directory:resolve(root,'dist/client')},
 d1_databases:[{binding:'DB',database_name:'fire-local-synthetic-db',database_id:randomUUID(),migrations_dir:join(root,'drizzle')}]};
const configPath=join(temp,'wrangler.json');writeFileSync(configPath,JSON.stringify(config));
writeFileSync(join(temp,'.dev.vars'),`FIRE_QA_PASSWORD_HASH=${createHash('sha256').update(password).digest('hex')}\nFIRE_QA_SESSION_SECRET=${sessionSecret}\n`,{mode:0o600});
const env={...process.env,CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',CI:'true'};
// Never borrow any local or CI Cloudflare authentication for a local test.
for(const key of Object.keys(env))if(/^(CLOUDFLARE_API_|CF_API_|CLOUDFLARE_ACCOUNT_ID)/.test(key))delete env[key];
const wrangler=join(root,'node_modules/wrangler/bin/wrangler.js');
let worker,browser,workerLog='',checks=0;const outside=[],clientErrors=[],blockedSyntheticMaps=[];
const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS: '+label);};
function command(args){
 assert.ok(args.includes('--local')&&!args.includes('--remote')&&!args.includes('deploy'));
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[wrangler,...args],{cwd:temp,env,stdio:['ignore','pipe','pipe']});let out='';
  child.stdout.on('data',d=>{out+=d;});child.stderr.on('data',d=>{out+=d;});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Local D1 preparation failed: '+out.slice(-1800))));
 });
}
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const origin='https://127.0.0.1:'+port;
// Execute immutable compiled modules in native workerd, without the Wrangler
// dev proxy/file watcher restarting in-flight POSTs. D1 preparation stays native.
const runnerPath=join(temp,'immutable-local-worker.mjs');
const moduleFiles=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?moduleFiles(join(directory,entry.name)):entry.name.endsWith('.js')?[join(directory,entry.name)]:[]);
const compiledModules=[{type:'ESModule',path:config.main},...moduleFiles(resolve(root,'dist/server')).filter(path=>path!==config.main).map(path=>({type:'ESModule',path}))];
writeFileSync(runnerPath,`import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),wranglerPath=${JSON.stringify(join(root,'node_modules/wrangler'))};
const {unstable_getMiniflareWorkerOptions}=require(wranglerPath);
const {Miniflare}=createRequire(require.resolve(wranglerPath))('miniflare');
const {workerOptions,externalWorkers}=unstable_getMiniflareWorkerOptions(${JSON.stringify(configPath)});
const worker=new Miniflare({host:'127.0.0.1',port:${port},https:true,cf:false,d1Persist:${JSON.stringify(join(temp,'state','v3','d1'))},workers:[{name:'fire-immutable-synthetic',...workerOptions,bindings:{...workerOptions.bindings,FIRE_QA_PASSWORD_HASH:${JSON.stringify(createHash('sha256').update(password).digest('hex'))},FIRE_QA_SESSION_SECRET:${JSON.stringify(sessionSecret)}},modules:${JSON.stringify(compiledModules)},modulesRoot:${JSON.stringify(resolve(root,'dist/server'))}},...externalWorkers]});
await worker.ready;
process.once('SIGTERM',async()=>{await worker.dispose();process.exit(0);});
`);
async function start(){
 worker=spawn(process.execPath,[runnerPath],{cwd:temp,env,stdio:['ignore','pipe','pipe']});
 worker.stdout.on('data',d=>{workerLog+=d;});worker.stderr.on('data',d=>{workerLog+=d;});
 for(let i=0;i<150;i++){
  if(worker.exitCode!==null)throw Error('Local Worker stopped: '+workerLog.slice(-1800));
  try{const status=await new Promise((resolve,reject)=>{const r=httpsGet(origin+'/login',{rejectUnauthorized:false,timeout:1500},response=>{response.resume();resolve(response.statusCode);});r.on('error',reject);r.on('timeout',()=>r.destroy(Error('Local readiness timeout')));});if(status===200)return;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error('Local Worker did not become ready: '+workerLog.slice(-1800));
}
async function stop(){if(worker&&worker.exitCode===null){const ended=new Promise(r=>worker.once('exit',r));worker.kill('SIGTERM');await ended;}worker=null;}
try{
 await command(['d1','migrations','apply','DB','--local','--persist-to',join(temp,'state'),'--config',configPath]);
 if(lookupMode){
  const file=join(temp,'synthetic-properties.sql');writeFileSync(file,['candidate-service-locations.sql','candidate-customer-properties.sql'].map(name=>readFileSync(join(root,'db',name),'utf8')).join('\n'));
  await command(['d1','execute','DB','--local','--persist-to',join(temp,'state'),'--config',configPath,'--file',file]);
 }
 await start();
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:true,timezoneId:'America/Chicago'});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){
  // Existing profile satellite embeds are optional third-party content. The
  // synthetic workflow must never dispatch them, nor permit any other host.
  if(url.origin==='https://maps.google.com'&&url.pathname==='/maps'&&((lookupMode&&['10 North Fixture Way','20 South Fixture Way'].includes(url.searchParams.get('q')))||(process.argv.includes('--global-search')&&url.searchParams.get('q')==='456 Synthetic Universal Lane')))blockedSyntheticMaps.push(url.href);
  else outside.push(url.href);
  return route.abort();
 }return route.continue();});
 const request=async(path,method='GET',data,headers={})=>{
  assert.ok(path.startsWith('/api/')&&!path.startsWith('//'));
  // Fix the synthetic client IP; local Wrangler may synthesize different
  // connecting addresses across platforms. Never rely on runner geo/IP data.
  const response=await context.request.fetch(origin+path,{method,data,headers:{'cf-connecting-ip':'192.0.2.17','x-forwarded-for':'192.0.2.17',...headers}});
  if(path==='/api/auth/login'&&response.status()===503)console.error('Local auth diagnostic:',workerLog.match(/QA sign-in protection unavailable\s+\{[\s\S]*?\}/g)?.slice(-1)??'No stage diagnostic recorded');
  return response;
 };
 check((await request('/api/customers')).status()===401,'Real built Worker rejects unauthenticated customer read');
 check((await request('/api/estimates','POST',{customer:'Synthetic forged request'},{'oai-authenticated-user-email':'kylebrooks8605@gmail.com'})).status()===401,'Real HTTP gateway-header spoof cannot authorize an estimate write');
 const login=await request('/api/auth/login','POST',{password});
 check(login.status()===200,'Actual QA login route verifies synthetic passphrase against native D1 rate limiter: HTTP '+login.status()+' '+(login.status()===200?'ok':await login.text()));
 check(/HttpOnly; Secure; SameSite=Strict/.test(login.headers()['set-cookie']),'Actual HTTP response sets isolated secure owner session cookie');
 check((await request('/api/customers')).status()===200,'Browser cookie authorizes real Worker customer API');
 const customerResponse=await request('/api/customers','POST',{name:'Synthetic HTTP Customer',address:'100 Synthetic Fixture Way',email:'fixture@example.invalid'});
 const customer=(await customerResponse.json()).customer;
 check(customerResponse.status()===201&&typeof customer?.id==='string','Customer creation persists through actual HTTP and native D1');
 const item={name:'Synthetic Gutter Service',description:'Isolated runtime fixture',quantity:1,unit:'job',totalCents:20000};
 const created=await request('/api/estimates','POST',{customerId:customer.id,customer:customer.name,items:[item]});
 const estimate=await created.json();
 check(created.status()===201&&estimate.totalCents===20000&&estimate.depositCents===10000,'Real estimate creation retains exact $200 total and $100 deposit');
 const invalid=await request('/api/estimates/'+estimate.id,'PATCH',{items:[{...item,quantity:0}]});
 check(invalid.status()===400,'Native HTTP edit rejects invalid service quantity');
 const premature=await request('/api/invoices','POST',{estimateId:estimate.id});
 check(premature.status()===409,'Actual invoice route blocks billing an incomplete job');
 const page=await context.newPage();page.on('pageerror',e=>clientErrors.push(e.message));
 await page.goto(origin+'/');
 await page.getByText('SYNTHETIC QA ONLY · NO REAL CUSTOMERS OR PAYMENTS',{exact:true}).waitFor();
 check(true,'Entire built Business App renders authenticated SSR and client hydration on iPhone viewport');
 // Open the actual dashboard workflow, without fixture replacement or mocked API.
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:/Estimates 1/}).click();
 await page.getByRole('button',{name:/Synthetic HTTP Customer.*\$200/}).click();
 await page.getByRole('button',{name:'Edit estimate',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Edit estimate',exact:true});await dialog.waitFor();
 const box=await dialog.boundingBox();
 check(box.x>=0&&box.x+box.width<=391&&box.y>=0&&box.y+box.height<=845,'Real Worker assets center actual Edit Estimate modal within iPhone viewport');
 check(await dialog.getByRole('button',{name:'Save estimate changes',exact:true}).isVisible(),'Real framework modal retains accessible Save control');
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 const detail=()=>page.getByRole('dialog',{name:'Synthetic Gutter Service',exact:true});
 const previewLink=detail().getByRole('link',{name:'Customer view',exact:true});
 const previewPath=await previewLink.getAttribute('href');
 check(previewPath===`/estimate/${estimate.shareToken}?ownerPreview=1`&&await previewLink.getAttribute('target')===null,'Owner Customer view opens explicit preview in same tab; shared customer link stays unchanged');
 let documentText='';
 const customerDocumentText=locator=>locator.evaluate(node=>[...node.children].filter(element=>!element.classList.contains('owner-preview-banner')).map(element=>element.innerText.trim()).join('\n'));
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1366,900]]){
  await page.setViewportSize({width,height});
  await detail().getByRole('link',{name:'Customer view',exact:true}).click();
  await page.waitForURL(origin+previewPath);
  const close=page.getByRole('link',{name:'Close estimate preview',exact:true});await close.waitFor();
  const previewNav=page.getByRole('complementary',{name:'Owner preview navigation'});
  const returnToFire=previewNav.getByRole('link',{name:'Return to FIRE'});
  const backBox=await returnToFire.boundingBox();
  check(await previewNav.isVisible()&&await returnToFire.getAttribute('href')===`/?openEstimate=${encodeURIComponent(estimate.id)}`&&backBox.width>=44&&backBox.height>=44,
   'Actual Customer View has a usable owner return link at '+width+'x'+height);
  const top=await close.boundingBox();
  check(top.width>=44&&top.height>=44&&top.x>=width-70&&top.x+top.width<=width&&top.y>=0,'Accessible upper-right preview X at '+width+'x'+height);
  await page.locator('.secure-note').scrollIntoViewIfNeeded();
  const bottom=await close.boundingBox();
  check(await page.evaluate(()=>window.scrollY>0)&&Math.abs(bottom.y-top.y)<1&&await close.evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('a')===node;}),'Preview X stays fixed and tappable after scrolling long estimate at '+width+'x'+height);
  check(await page.locator('.pay-summary').innerText().then(text=>text.includes('$200.00')&&text.includes('$100.00')),'Preview preserves $200 price and $100 deposit at '+width+'x'+height);
  documentText=await customerDocumentText(page.locator('.estimate-portal'));
  if(width===1366){
   await page.emulateMedia({media:'print'});
   check(!await close.isVisible()&&!await previewNav.isVisible(),'Owner preview X and navigation hidden from printing and PDF output');
   await page.emulateMedia({media:'screen'});
  }
  await close.focus();await page.keyboard.press('Enter');
  await detail().waitFor();
  check(await detail().getByText('Synthetic HTTP Customer',{exact:true}).isVisible(),'Keyboard-activated X returns to originating estimate details at '+width+'x'+height);
 }
 const previewBackup=await (await request('/api/backup')).json();
 check(previewBackup.tables.estimates[0].first_viewed_at===null&&previewBackup.tables.notifications.every(row=>row.type!=='estimate_viewed'),'Authenticated owner previews do not mark a customer visit or send a viewed notification');
 const regular=await context.newPage();await regular.goto(origin+`/estimate/${estimate.shareToken}`);
 check(await regular.getByRole('link',{name:'Close estimate preview',exact:true}).count()===0,'Ordinary standalone estimate link omits owner navigation even in an owner browser');
 check(await regular.getByRole('complementary',{name:'Owner preview navigation'}).count()===0,'Customer estimate link cannot see owner preview navigation');
 check(await customerDocumentText(regular.locator('.estimate-portal'))===documentText,'Owner preview retains identical customer agreement, pricing, deposit and approval content');
 await regular.close();
 const anonymous=await browser.newContext({ignoreHTTPSErrors:true,timezoneId:'America/Chicago'});
 const anonymousResponse=await anonymous.request.get(origin+previewPath,{headers:{'oai-authenticated-user-email':'kylebrooks8605@gmail.com'}});
 const anonymousHTML=await anonymousResponse.text();
 check(anonymousResponse.status()===200&&!anonymousHTML.includes('owner-estimate-preview-close')&&!anonymousHTML.includes('owner-preview-banner')&&!anonymousHTML.includes('openEstimate='),'Forged preview query and owner header never expose owner X or return ID to an unauthenticated customer, including after authenticated cache use');
 await anonymous.close();
 await detail().getByRole('button',{name:'Close',exact:true}).click();
 // Actual server edit, then terminate/restart the local Worker and re-read D1.
 const edited=await request('/api/estimates/'+estimate.id,'PATCH',{items:[{...item,totalCents:25000}]});
 check(edited.status()===200&&(await edited.json()).estimate?.totalCents===25000,'HTTP estimate edit atomically persists $250 total');
 const backupResponse=await request('/api/backup');const backup=await backupResponse.json();
 check(backupResponse.status()===200&&backup.tables.customers.length===1&&backup.tables.estimates.length===1,'Full records backup covers actual synthetic customer and estimate');
 check(!validateRecordIdentities(backup.tables)&&!validateBackupRelationships(backup.tables)&&!validateRefundIntegrity(backup.tables),'Actual HTTP backup passes shared identity, ownership and financial validators');
 for(const [path,body] of [['/api/payments/checkout',{estimateId:estimate.id,type:'deposit'}],['/api/payments/refund',{paymentId:'synthetic',amountCents:1}],['/api/payments/webhook',{}]]){
  const response=await request(path,'POST',body);check(response.status()===409||response.status()===503,'Actual QA Worker refuses provider operation '+path);
 }
 const failures=[];
 for(let i=0;i<5;i++)failures.push((await request('/api/auth/login','POST',{password:'synthetic-wrong-passphrase-00000000'})).status());
 check(failures.slice(0,4).every(status=>status===401)&&failures[4]===429,'Native D1 login limiter atomically blocks fifth failed attempt: '+JSON.stringify(failures));
 await stop();await start();
 check((await request('/api/auth/login','POST',{password})).status()===429,'Authentication lockout persists after local Worker restart');
 const reloaded=await request('/api/estimates');const saved=(await reloaded.json()).estimates;
 check(reloaded.status()===200&&saved.length===1&&saved[0].totalCents===25000&&saved[0].depositCents===12500,'Worker restart preserves owner cookie, customer relationship, estimate and deposit in native D1');
 await page.setViewportSize({width:390,height:844});
 await page.reload();await page.getByText('SYNTHETIC QA ONLY · NO REAL CUSTOMERS OR PAYMENTS',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:/Estimates 1/}).click();
 await page.getByRole('button',{name:/Synthetic HTTP Customer.*\$250/}).waitFor();
 check(true,'Actual Estimates screen shows saved estimate after full local Worker restart');
 if(!lookupMode){
  await page.goto(origin+'/');await page.getByRole('button',{name:'New estimate',exact:true}).click();
  const draft=page.getByRole('dialog',{name:'Create estimate',exact:true});
  await draft.getByRole('combobox',{name:'Find an existing customer'}).fill(customer.email);await draft.getByRole('option').filter({hasText:customer.email}).click();
  await draft.getByRole('button',{name:'Continue to services'}).waitFor();
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(n=>n.textContent.includes('Continue to services'));return b&&!b.disabled;});
  check(await draft.getByLabel('Email',{exact:true}).inputValue()===customer.email&&await draft.getByLabel('Estimate service address').inputValue()===customer.address,'Existing-customer lookup remains usable with property workflow disabled; saved primary address is authoritative');
  check(await draft.getByRole('region',{name:'Customer properties',exact:true}).count()===0,'Lookup does not enable gated property creation or associations');
  page.once('dialog',d=>d.accept());await draft.getByRole('button',{name:'Close',exact:true}).click();
 }
 if(process.argv.includes('--business-brand'))await exerciseBusinessBrand({page,request,origin,check});
 if(lookupMode){await exerciseCustomerLookup({page,context,browser,origin,request,check,originalEstimateId:estimate.id});await exercisePropertySearch({page,context,origin,request,check});}
 if(profileMode){await exerciseCustomerProfileControls({page,context,origin,request,check,originalEstimateId:estimate.id});await exerciseCustomerBalances({page,context,origin,request,check});}
 if(ledgerMode)await exerciseCompleteLedger({page,context,origin,request,check,originalEstimateId:estimate.id});
 if(publicRetryMode)await exercisePublicEstimateRetry({page,context,origin,request,check,originalEstimateId:estimate.id});
 if(process.argv.includes('--manual-payment-confirmation'))await exerciseManualPaymentConfirmation({page,context,origin,request,check});
 if(process.argv.includes('--customer-create-retry'))await exerciseCustomerCreateRetry({page,context,origin,request,check});
 if(process.argv.includes('--global-search'))await exerciseGlobalSearch({page,context,browser,origin,request,check});
 if(process.argv.includes('--search-metadata'))await exerciseSearchMetadata({page,context,browser,origin,request,check});
 if(process.argv.includes('--change-history'))await exerciseChangeRequestHistory({page,context,browser,origin,request,check});
 if(process.argv.includes('--invoice-state'))await exerciseInvoiceState({page,context,browser,origin,request,check,originalEstimateId:estimate.id,mutateSyntheticD1:async sql=>{await stop();await command(['d1','execute','DB','--local','--persist-to',join(temp,'state'),'--config',configPath,'--command',sql]);await start();}});
 if(process.argv.includes('--deposit-policy'))await exerciseDepositPolicy({page,browser,origin,request,check,mutateSyntheticD1:async sql=>{await stop();await command(['d1','execute','DB','--local','--persist-to',join(temp,'state'),'--config',configPath,'--command',sql]);await start();}});
 check(outside.length===0&&clientErrors.length===0,'No external network dispatched or uncaught framework client errors: '+JSON.stringify({outside,clientErrors,interceptedSyntheticMapFrames:blockedSyntheticMaps.length}));
 console.log('PASS '+checks+' built QA Worker HTTP / native D1 / Chromium checks. Local synthetic evidence only; no hosted or iOS acceptance claimed.');
}finally{if(browser)await browser.close();await stop();rmSync(temp,{recursive:true,force:true});}
