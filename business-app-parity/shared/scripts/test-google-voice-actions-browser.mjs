/** Actual contact handlers and React/Radix UI. Synthetic localhost only; no calls/texts. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),source=readFileSync('components/google-voice-text-action.tsx','utf8');
const contacts={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/customer-contact-links.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,contacts);
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
function handler({mode='text',phone='(918) 555-0102',message='  Exact saved body\nwith spacing.  ',confirm=true,copy=async()=>{},missingClipboard=false}={}){
 const states=[],refs=[],copies=[],routes=[],warnings=[],alerts=[];let si=0,ri=0;
 const context={exports:{},navigator:{clipboard:missingClipboard?undefined:{writeText:async value=>{copies.push(value);await copy(value);}}},window:{confirm:warning=>{warnings.push(warning);return confirm;},alert:message=>alerts.push(message),location:{set href(value){routes.push(value);}}},require:name=>{
  if(name==='react')return{useState(initial){const i=si++;if(!(i in states))states[i]=initial;return[states[i],value=>states[i]=value];},useRef(initial){const i=ri++;return refs[i]??(refs[i]={current:initial});}};
  if(name==='react/jsx-runtime')return require(name);
  if(name==='@/lib/customer-contact-links')return contacts.exports;
  return new Proxy({},{get:(_target,key)=>key});
 }};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,context);
 const render=()=>{si=0;ri=0;return context.exports.PersonalPhoneBackupAction({phone,mode,message,customerName:'Synthetic only'});};
 const button=()=>render().props.children[0];
 return{copies,routes,warnings,alerts,button,run:()=>button().props.onClick(),body:context.exports.personalBackupTextBody};
}
const cancelled=handler({confirm:false});await cancelled.run();check(cancelled.copies.length===0&&cancelled.routes.length===0,'Cancel never copies or opens personal Messages');
for(const options of [{copy:async()=>{throw Error('Synthetic clipboard denial');}},{missingClipboard:true}]){const f=handler(options);await f.run();check(f.routes.length===0&&f.alerts.length===1,'Clipboard failure never opens an incomplete backup message');check(!f.button().props.disabled,'Failure releases backup control for explicit retry');}
let release;const pending=handler({copy:()=>new Promise(r=>release=r)}),click=pending.button().props.onClick;
const first=click();const second=click();check(pending.warnings.length===1&&pending.copies.length===1&&pending.routes.length===0,'Duplicate callback confirms/copies once and waits before handoff');
check(pending.button().props.disabled,'Pending backup disables its action');release();await Promise.all([first,second]);
check(pending.routes.join()==='sms:+19185550102','Only one normalized personal Messages destination opens');
check(pending.copies[0]===pending.body('')+'\n\n  Exact saved body\nwith spacing.  ','Backup intro preserves every byte of the saved original body');
const call=handler({mode:'call'}),callClick=call.button().props.onClick;await Promise.all([callClick(),callClick()]);
check(call.warnings.length===1&&call.copies.length===0&&call.routes.join()==='tel:+19185550102','Duplicate Call callback opens one warned native destination');
for(const phone of ['','not a phone','9185550102?body=unwanted','9185550102;123']){const f=handler({phone});check(f.button().props.disabled,'Malformed recipient is disabled');await f.run();check(f.routes.length===0&&f.warnings.length===0,'Malformed recipient cannot launch a native app');}
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild'),postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss'),{chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const message='  Synthetic prepared service description and estimate link\nhttps://example.invalid/'+('x'.repeat(180))+'  ';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import{GoogleVoiceTextAction,GoogleVoiceCallAction,PersonalPhoneBackupAction}from'./components/google-voice-text-action';const message=${JSON.stringify(message)};window.fixtureMessage=message;createRoot(document.getElementById('app')).render(<main style={{padding:12}}><GoogleVoiceTextAction phone="(918) 555-0102" customerName="Synthetic long customer name" message={message}/><GoogleVoiceCallAction phone="(918) 555-0102" customerName="Synthetic long customer name"/><PersonalPhoneBackupAction phone="(918) 555-0102" mode="text" message={message}/><PersonalPhoneBackupAction phone="(918) 555-0102" mode="call"/></main>);`;
const bundle=(await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}})).outputFiles[0].text;
const css=(await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')})).css;
const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle);}if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css);}res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[],outside=[];
try{
 browser=await chromium.launch({executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true});page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(outside.push(route.request().url()),route.abort()));
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
 for(const width of [320,375,390,430,768,1366])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===320?568:844});await page.goto(origin);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.getByRole('button',{name:'Text Synthetic long customer name using Google Voice',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Text using Google Voice',exact:true});await dialog.waitFor();
  await dialog.getByRole('button',{name:'Copy message',exact:true}).click();await dialog.getByRole('status').filter({hasText:'Copy unavailable'}).waitFor();
  const field=dialog.getByRole('textbox',{name:'Prepared message for Google Voice',exact:true});
  check(await field.inputValue()===message,'Clipboard failure keeps exact selectable prepared message '+width+'/'+theme);
  check(await dialog.getByRole('link',{name:'Open Google Voice',exact:true}).getAttribute('href')==='https://voice.google.com/','Business action stays on supported Voice URL');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal viewport overflow '+width+'/'+theme);
  check(await dialog.locator('button:visible,a:visible').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=44;})),'Visible dialog controls fit with 44px touch targets '+width+'/'+theme);
  if(process.env.FIRE_VOICE_SCREENSHOT_DIR&&width===390){mkdirSync(process.env.FIRE_VOICE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.FIRE_VOICE_SCREENSHOT_DIR,'voice-'+theme+'.png')});}
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Call Synthetic long customer name using Google Voice',exact:true}).click();const callDialog=page.getByRole('dialog',{name:'Call using Google Voice',exact:true});await callDialog.getByRole('button',{name:'Copy number',exact:true}).click();await callDialog.getByRole('status').filter({hasText:'Copy unavailable'}).waitFor();check(true,'Missing clipboard leaves call handoff usable');await page.keyboard.press('Escape');await callDialog.waitFor({state:'hidden'});
  page.once('dialog',async d=>{check(d.message().includes('PERSONAL cellphone number'),'Backup explicitly warns about personal number');await d.dismiss();});
  await page.getByRole('button',{name:'Text (Backup) for customer using your personal number',exact:true}).click();
  check(await page.getByRole('dialog').count()===0,'Cancelled backup does not open another dialog or trigger primary action');
 }
 check(errors.length===0&&outside.length===0,'No runtime errors, external requests, real calls or texts: '+errors.join(';'));
 console.log('PASS '+checks+' actual Voice/backup handler and mobile light/dark assertions; no provider calls or device acceptance claimed.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
