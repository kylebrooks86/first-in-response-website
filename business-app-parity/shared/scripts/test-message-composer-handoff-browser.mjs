/** Actual MessageComposer + Radix, compiled CSS; no external messages or OS launches. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import ts from 'typescript';
import{FIRE_TEMPLATES as STORED_TEMPLATE_CATALOG}from'../lib/fire-templates.ts';
const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const composer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='MessageComposer');assert.ok(composer);
const categoryList=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='messageTemplateCategories'));
const categoryIcon=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='MessageTemplateCategoryIcon');
assert.ok(categoryList&&categoryIcon,'Real template-group dependencies must be in browser fixture');
const fixture=`import React,{useState,useRef,useEffect}from'react';import{createRoot}from'react-dom/client';
import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Textarea}from'./components/ui/textarea';
import{Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle}from'./components/ui/dialog';
import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem,SelectGroup,SelectLabel}from'./components/ui/select';
import{MessageSquareText,Copy,ExternalLink,Mail,Send,ClipboardList,Receipt,CalendarDays,CheckCircle2,FileText}from'lucide-react';
import{GoogleVoiceTextShortcutAction,PersonalPhoneBackupAction,GOOGLE_VOICE_URL}from'./components/google-voice-text-action';
import{usableCustomerPhone,usableCustomerEmail,customerMessageHandoffReadiness,definitiveUnwrittenMessagePreparation,customerTemplateLinkReadiness,customerAppointmentTemplateReadiness}from'./lib/customer-contact-links';import{FIRE_TEMPLATES,fillTemplate}from'./lib/fire-templates';
const money=n=>'$'+(n/100).toFixed(2),dateTime=v=>v,reviewLink='https://example.invalid/review',resolvedBillingTotalCents=e=>e.totalCents,billingBalanceCents=e=>e.totalCents;
${categoryList.getText(ast)}
${categoryIcon.getText(ast)}
${composer.getText(ast)}
const customer={id:'synthetic',name:'FIRE Synthetic Customer',email:'fixture+qa@example.invalid',phone:'9185550102',address:''};
const estimate={id:'synthetic-estimate',customerId:'synthetic',customer:customer.name,service:'House Wash',totalCents:12300,invoiceId:null,shareToken:'',invoiceShareToken:''};
const scheduledEstimate={...estimate,id:'synthetic-scheduled-estimate',status:'scheduled',address:'100 Fixture Way',scheduledAt:'2026-11-04T16:00:00Z'};
createRoot(document.getElementById('app')).render(<main><MessageComposer initialTemplate="custom" customer={customer}/><MessageComposer initialTemplate="custom" triggerLabel="Text" customer={customer}/><MessageComposer initialTemplate="custom" triggerLabel="Email" customer={customer}/><MessageComposer initialTemplate="estimate" triggerLabel="Estimate notice" customer={customer} estimate={estimate}/><MessageComposer initialTemplate="appointment" triggerLabel="Appointment unscheduled" customer={customer} estimate={estimate}/><MessageComposer initialTemplate="appointment" triggerLabel="Appointment scheduled" customer={customer} estimate={scheduledEstimate}/></main>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'composer-test.tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const styles=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let requests=[],denyHistory=false,denyPreparation=false,denyConfirmation=false,denyShare=true,shareRequests=0,denyTemplates=false,partialTemplates=false,templateRequests=0,denyCopyPreparation=false,seededPending=[];const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(styles.css);}
 if(req.url?.startsWith('/api/customer-messages')){
  res.setHeader('content-type','application/json');
  if(req.method==='GET'){
   if(denyHistory){res.statusCode=401;res.setHeader('content-type','text/html');return res.end('<h1>Unauthorized</h1>');}
   return res.end(JSON.stringify({pending:seededPending,nextCursor:null}));
  }
  if((req.method==='POST'&&denyPreparation)||(req.method==='PATCH'&&denyConfirmation)){
   res.statusCode=401;res.setHeader('content-type','text/html');return res.end('<h1>Unauthorized</h1>');
  }
  let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);requests.push(data);
  if(data.channel==='copy'&&denyCopyPreparation){res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic copy save not confirmed'}));}
  return res.end(JSON.stringify({message:{...data,body:data.body.trim(),id:'owner-message-prep:'+data.requestId,createdAt:'2026-10-30T12:00:00Z'}}));
 }
 if(req.url==='/api/estimates/synthetic-estimate/share'){
  shareRequests++;res.setHeader('content-type','application/json');
  if(denyShare){res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic link unavailable'}));}
  return res.end(JSON.stringify({shareToken:'synthetic-verified-link'}));
 }
 if(req.url==='/api/message-templates'){
  templateRequests++;res.setHeader('content-type','application/json');
  if(denyTemplates){res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic saved-template outage'}));}
  const savedCatalog=STORED_TEMPLATE_CATALOG.map(item=>item.key==='estimate'?{...item,subject:'Your estimate',body:'Hello @customer_first_name, review your estimate: @estimate_link'}:item);
  return res.end(JSON.stringify({templates:partialTemplates?savedCatalog.slice(0,1):savedCatalog}));
 }
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 res.statusCode=404;res.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;};const errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   const copies=[];
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copies.push(text);}}});
   window.__fireTestCopies=copies;
 });
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const width of [320,375,390,430])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const entry=page.getByRole('button',{name:'Message',exact:true});
  try{await entry.waitFor({state:'visible',timeout:5000});}
  catch(error){throw Error('Synthetic composer did not mount: '+errors.join('; ')+' DOM: '+(await page.locator('#app').innerHTML()).slice(0,800),{cause:error});}
  await entry.click();const dialog=page.getByRole('dialog',{name:'Message',exact:true});
  await dialog.getByLabel('Message text').fill('  Exact synthetic message\nSecond line  ');
  const before=requests.length;await dialog.getByRole('button',{name:'Text',exact:true}).click();
  const voice=dialog.getByRole('region',{name:'Google Voice text handoff'});await voice.waitFor();
  check(requests.length===before+1&&requests.at(-1).body==='Exact synthetic message\nSecond line','Whitespace-normalized text reaches actual prepared Voice UI at '+width+'/'+theme);
  check(await dialog.getByRole('button',{name:'Yes, mark sent',exact:true}).isVisible(),'Preparation requires separate owner send confirmation');
  check(!(await voice.getByRole('button',{name:'Copy message',exact:true}).isVisible()),'Voice manual options collapsed by default');
  await voice.getByText('Other sending options',{exact:true}).click();
  check(await voice.getByRole('button',{name:'Copy message',exact:true}).isVisible(),'Manual Voice options available after expansion');
  await dialog.getByRole('button',{name:'Not yet · edit',exact:true}).click();
  await dialog.getByRole('button',{name:'Email',exact:true}).click();
  const email=dialog.getByRole('link',{name:'Open email app',exact:true});await email.waitFor();
  const href=await email.getAttribute('href'),url=new URL(href);
  check(url.protocol==='mailto:'&&decodeURIComponent(url.pathname)==='fixture+qa@example.invalid'&&url.searchParams.get('body')==='Exact synthetic message\nSecond line','Explicit email link keeps exact recipient/body at '+width+'/'+theme);
  check(page.url()===origin+'/'&&requests.at(-1).channel==='email_prepared','Email preparation does not launch external app or claim sent');
  await email.scrollIntoViewIfNeeded();const box=await email.boundingBox();
  check(box.x>=0&&box.x+box.width<=width+1&&box.height>=44,'Email handoff fits 44px mobile touch target');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Composer has no horizontal page overflow');
  check(!(await dialog.getByRole('button',{name:'Copy email message',exact:true}).isVisible()),'Secondary email copy is collapsed by default');
  await dialog.getByText('Other sending options',{exact:true}).click();
  check(await dialog.getByRole('button',{name:'Copy email message',exact:true}).isVisible(),'Manual email fallback is available after expansion');
 }
 // Three previously prepared handoffs remain recoverable without filling the editor.
 seededPending=[
  {id:'pending-text',customerId:'synthetic',estimateId:null,channel:'text_prepared',template:'invoice',body:'Synthetic invoice message',createdAt:'2026-11-09T20:46:55Z'},
  {id:'pending-email-1',customerId:'synthetic',estimateId:null,channel:'email_prepared',template:'review',body:'Synthetic review request one',createdAt:'2026-10-18T00:51:01Z'},
  {id:'pending-email-2',customerId:'synthetic',estimateId:null,channel:'email_prepared',template:'review',body:'Synthetic review request two',createdAt:'2026-10-18T00:34:49Z'}
 ];
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Message',exact:true}).click();
 const draftsDialog=page.getByRole('dialog',{name:'Message',exact:true});
 const drawer=draftsDialog.locator('details.message-pending-drafts');
 await drawer.getByText('Messages to check (3)',{exact:true}).waitFor();
 check(!(await drawer.evaluate(n=>n.open)),'Saved unconfirmed drafts collapsed by default');
 check(await draftsDialog.getByLabel('Message text').isVisible(),'Collapsed history leaves the composer usable');
 check(!(await drawer.locator('button').first().isVisible()),'Draft actions hidden until expanded');
 await drawer.locator('summary').click();
 check(await drawer.locator('button').first().isVisible(),'Expanded history reveals recovery choices');
 const requestsBeforeRecover=requests.length;
 await drawer.locator('button').first().click();
 check(await draftsDialog.getByLabel('Message text').inputValue()==='Synthetic invoice message'&&
   await draftsDialog.getByRole('button',{name:'Yes, mark sent',exact:true}).isVisible(),
  'Resumed draft retains exact message and still needs explicit send confirmation');
 check(requests.length===requestsBeforeRecover,'Resuming draft never sends or saves a new message');
 seededPending=[];
 await page.goto(origin);await page.getByRole('button',{name:'Message',exact:true}).click();
 const templateDialog=page.getByRole('dialog',{name:'Message',exact:true});
 const searchDisclosure=templateDialog.locator('details.composer-template-search-disclosure');
 await searchDisclosure.locator('summary').waitFor();
 check(!(await searchDisclosure.evaluate(n=>n.open)),'Template search collapsed by default');
 await searchDisclosure.locator('summary').click();
 check(await templateDialog.getByRole('searchbox',{name:'Find a message template'}).isVisible(),
  'Optional template search can be expanded');

 // Direct customer-profile Text/Email buttons must open a usable editor, not
 // appear dead when the default Custom message is blank. No OS handoff occurs
 // until the owner chooses the prepared action separately.
 for (const mode of ['Text','Email']) {
  await page.setViewportSize({width:390,height:844});await page.goto(origin);
  await page.getByRole('button',{name:mode,exact:true}).click();
  const quick=page.getByRole('dialog',{name:'Message',exact:true});
  const prep=quick.getByRole('button',{name:mode,exact:true});
  const before=requests.length;
  check(await prep.isDisabled(),mode+' profile quick action blocks blank Custom message preparation');
  const status=await quick.getByRole('status').allTextContents();
  check(status.some(x=>x.includes('Write your message first.')),
   mode+' profile quick action explains exactly how to enable preparation');
  const message='Prepared via '+mode+' profile action';
  await quick.getByLabel('Message text').fill(message);
  check(await prep.isEnabled(),mode+' profile quick action becomes available after writing message');
  await prep.click();
  if(mode==='Text')await quick.getByRole('region',{name:'Google Voice text handoff'}).waitFor();
  else await quick.getByRole('link',{name:'Open email app',exact:true}).waitFor();
  check(requests.length===before+1&&requests.at(-1).body===message&&requests.at(-1).channel===(mode==='Text'?'text_prepared':'email_prepared'),
   mode+' profile action prepares one exact saved draft, not an actual send');
  check(await quick.getByRole('button',{name:'Yes, mark sent',exact:true}).isVisible(),
   mode+' profile handoff never marks sent automatically');
 }
 // A sent appointment confirmation must refer to a real saved date and
 // address, not the old "your scheduled time" placeholder.
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Appointment unscheduled',exact:true}).click();
 const unscheduled=page.getByRole('dialog',{name:'Message',exact:true});
 await unscheduled.getByText("Save and confirm this job's appointment date before preparing an appointment confirmation or reminder.",{exact:true}).waitFor();
 check(await unscheduled.getByRole('button',{name:'Text',exact:true}).isDisabled()&&
       await unscheduled.getByRole('button',{name:'Copy',exact:true}).isDisabled(),
  'Unscheduled estimate cannot prepare or copy a false appointment confirmation');
 const beforeAppointment=requests.length;
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Appointment scheduled',exact:true}).click();
 const scheduled=page.getByRole('dialog',{name:'Message',exact:true});
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=dialog] textarea')).some(e=>e.value.includes('2026-11-04T16:00:00Z')));
 check(await scheduled.getByRole('button',{name:'Text',exact:true}).isEnabled(),
  'Saved scheduled appointment date and address enable ordinary Text preparation');
 await scheduled.getByRole('button',{name:'Text',exact:true}).click();
 await scheduled.getByRole('region',{name:'Google Voice text handoff'}).waitFor();
 check(requests.length===beforeAppointment+1&&
       requests.at(-1).body.includes('2026-11-04T16:00:00Z')&&
       requests.at(-1).body.includes('100 Fixture Way'),
  'Prepared appointment message reflects exact saved schedule and property address, not a placeholder');
 // Copy must not put outgoing text on the clipboard until the same
 // immutable request ID is durably saved and acknowledged in FIRE.
 denyCopyPreparation=true;
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Message',exact:true}).click();
 const auditCopy=page.getByRole('dialog',{name:'Message',exact:true});
 await auditCopy.getByLabel('Message text').fill('Copy only after confirmed activity save');
 const beforeCopyPosts=requests.length;
 await auditCopy.getByRole('button',{name:'Copy',exact:true}).click();
 await auditCopy.getByText('Synthetic copy save not confirmed',{exact:true}).waitFor();
 check(requests.length===beforeCopyPosts+1&&requests.at(-1).channel==='copy',
  'One immutable copy-preparation request is attempted before clipboard handoff');
 check((await page.evaluate(()=>window.__fireTestCopies)).length===0,
  'Unconfirmed copy preparation cannot place an unrecorded outgoing message on clipboard');
 const originalCopyRequest=requests.at(-1).requestId;
 denyCopyPreparation=false;
 await auditCopy.getByRole('button',{name:'Copy',exact:true}).click();
 await auditCopy.getByText('Copied. Sending is not confirmed.',{exact:true}).waitFor();
 check(requests.at(-1).requestId===originalCopyRequest&&requests.at(-1).body==='Copy only after confirmed activity save',
  'Owner retry preserves the same immutable preparation ID and recorded body');
 check((await page.evaluate(()=>window.__fireTestCopies)).join('')==='Copy only after confirmed activity save',
  'Only a readback-verified copy preparation can write the correct text to clipboard');
 // If the saved owner templates fail to load, do not silently prepare
 // bundled/default copy. Custom composing must remain usable.
 denyTemplates=true;
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Text',exact:true}).click();
 const customOutage=page.getByRole('dialog',{name:'Message',exact:true});
 await customOutage.getByRole('button',{name:'Retry templates',exact:true}).waitFor();
 const customBefore=requests.length;
 await customOutage.getByLabel('Message text').fill('Custom during synthetic template outage');
 check(await customOutage.getByRole('button',{name:'Text',exact:true}).isEnabled(),
  'Custom text stays usable even when saved template GET fails');
 await customOutage.getByRole('button',{name:'Text',exact:true}).click();
 await customOutage.getByRole('region',{name:'Google Voice text handoff'}).waitFor();
 check(requests.length===customBefore+1&&requests.at(-1).body==='Custom during synthetic template outage',
  'Custom message still prepares exactly one owner-audited draft with no automatic send');
 // A saved Estimate ready template may not be prepared with a fallback copy
 // or blank link. Test explicit failed template load, then share-link failure,
 // then both independent owner retries.
 await page.goto(origin);
 await page.getByRole('button',{name:'Estimate notice',exact:true}).click();
 const linked=page.getByRole('dialog',{name:'Message',exact:true});
 await linked.getByRole('button',{name:'Retry templates',exact:true}).waitFor();
 check(await linked.getByRole('button',{name:'Text',exact:true}).isDisabled()&&
       await linked.getByRole('button',{name:'Copy',exact:true}).isDisabled(),
  'Unavailable saved estimate template cannot prepare Text or Copy using bundled defaults');
 const beforeTemplateRetry=templateRequests,shareBeforeTemplateRetry=shareRequests;
 denyTemplates=false;partialTemplates=true;
 await linked.getByRole('button',{name:'Retry templates',exact:true}).click();
 await linked.getByRole('button',{name:'Retry templates',exact:true}).waitFor();
 // The API may acknowledge 200 but omit part of the owner catalog; do not
 // mark that incomplete response ready or fabricate defaults for a send.
 await page.waitForFunction(n=>window.__noop===undefined&&
   document.querySelector('[role=dialog] [role=alert]')?.textContent?.includes('Saved message templates are unavailable.'),null,templateRequests);
 check(await linked.getByRole('button',{name:'Text',exact:true}).isDisabled()&&shareRequests===shareBeforeTemplateRetry,
  'Partial successful-looking catalog cannot prepare a canned message or request a customer link');
 partialTemplates=false;
 await linked.getByRole('button',{name:'Retry templates',exact:true}).click();
 await linked.getByText('Estimate link unavailable. Retry before preparing this message.',{exact:true}).waitFor();
 check(templateRequests===beforeTemplateRetry+2&&shareRequests===shareBeforeTemplateRetry+1,
  'Only complete verified owner template catalog unlocks one saved link lookup');
 check((await linked.getByLabel('Message text').inputValue()).includes('Hello FIRE'),
  'Recovered verified owner template replaces bundled content with exact saved wording');
 check(await linked.getByRole('button',{name:'Text',exact:true}).isDisabled(),
   'Share API failure prevents actual Google Voice estimate text preparation');
 check(await linked.getByRole('button',{name:'Copy',exact:true}).isDisabled(),
   'Share API failure also blocks copying a useless no-link estimate');
 const callsBefore=shareRequests;
 denyShare=false;
 await linked.getByRole('button',{name:'Retry link',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=dialog] textarea')).some(e=>e.value.includes('/estimate/synthetic-verified-link')));
 check(shareRequests===callsBefore+1,
   'Owner Retry requests the same saved customer estimate link exactly once');
 check(await linked.getByRole('button',{name:'Text',exact:true}).isEnabled(),
   'Actual verified URL restores Google Voice Text readiness');
 const beforeLinkedMessage=requests.length;
 await linked.getByRole('button',{name:'Text',exact:true}).click();
 await linked.getByRole('region',{name:'Google Voice text handoff'}).waitFor();
 check(requests.length===beforeLinkedMessage+1&&requests.at(-1).body.includes('/estimate/synthetic-verified-link'),
   'Prepared message now contains the exact saved estimate URL; no automatic send');
 // Auth can expire while a message modal is open. The explicit 401 comes
 // before any DB write, so it must not strand an immutable pending-operation
 // lock or mislabel the draft as sent. Real unknown 5xx/timeout stays locked.
 denyHistory=true;denyPreparation=true;
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 await page.getByRole('button',{name:'Message',exact:true}).click();
 const authDialog=page.getByRole('dialog',{name:'Message',exact:true});
 await authDialog.getByRole('alert').waitFor();
 check((await authDialog.getByRole('alert').innerText()).includes('Your FIRE session has expired or is unavailable')&&
   !(await authDialog.getByRole('alert').innerText()).includes('Unauthorized'),
   '401 on pending history gives safe re-sign-in guidance without raw Unauthorized');
 const beforeDenied=requests.length;
 await authDialog.getByLabel('Message text').fill('Original unsent draft');
 await authDialog.getByRole('button',{name:'Text',exact:true}).click();
 await authDialog.getByText('FIRE sign-in is unavailable. Sign in again to prepare this draft. No text or email handoff was started.',{exact:true}).waitFor();
 check(requests.length===beforeDenied&&await authDialog.getByRole('region',{name:'Google Voice text handoff'}).count()===0,
   'Explicit 401 never creates a prepared receipt or shows SMS handoff');
 denyHistory=false;denyPreparation=false;
 await authDialog.getByLabel('Message text').fill('Revised after definite auth refusal');
 await authDialog.getByRole('button',{name:'Text',exact:true}).click();
 await authDialog.getByRole('region',{name:'Google Voice text handoff'}).waitFor();
 check(requests.length===beforeDenied+1&&requests.at(-1).body==='Revised after definite auth refusal',
   'Definite 401 clears only the false pending lock so a new authorized draft may be prepared');
 denyConfirmation=true;
 await authDialog.getByRole('button',{name:'Yes, mark sent',exact:true}).click();
 await authDialog.getByText('Sign in to FIRE again before confirming. Check Google Voice or your email Sent folder first; delivery is unknown here.',{exact:true}).waitFor();
 check(await authDialog.getByRole('region',{name:'Google Voice text handoff'}).count()===1,
   '401 on confirmation preserves unconfirmed draft; never marks message as sent');
 denyConfirmation=false;
 check(errors.length===0,'No browser exceptions: '+errors.join(';'));
 console.log('PASS '+checks+' actual composer mobile/light-dark text/email handoff assertions; no external sends.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
