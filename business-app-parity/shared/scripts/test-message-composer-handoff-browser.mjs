/** Actual MessageComposer + Radix, compiled CSS; no external messages or OS launches. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const composer=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='MessageComposer');assert.ok(composer);
const fixture=`import React,{useState,useRef,useEffect}from'react';import{createRoot}from'react-dom/client';
import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Textarea}from'./components/ui/textarea';
import{Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle}from'./components/ui/dialog';
import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from'./components/ui/select';
import{MessageSquareText,Copy,ExternalLink,Mail,Send}from'lucide-react';
import{GoogleVoiceTextShortcutAction,PersonalPhoneBackupAction,GOOGLE_VOICE_URL}from'./components/google-voice-text-action';
import{usableCustomerEmail}from'./lib/customer-contact-links';import{FIRE_TEMPLATES,fillTemplate}from'./lib/fire-templates';
const money=n=>'$'+(n/100).toFixed(2),dateTime=v=>v,reviewLink='https://example.invalid/review',resolvedBillingTotalCents=e=>e.totalCents,billingBalanceCents=e=>e.totalCents;
${composer.getText(ast)}
createRoot(document.getElementById('app')).render(<MessageComposer initialTemplate="custom" customer={{id:'synthetic',name:'FIRE Synthetic Customer',email:'fixture+qa@example.invalid',phone:'9185550102',address:''}}/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'composer-test.tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const styles=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let requests=[];const server=createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(styles.css);}
 if(req.url?.startsWith('/api/customer-messages')){
  res.setHeader('content-type','application/json');if(req.method==='GET')return res.end(JSON.stringify({pending:[],nextCursor:null}));
  let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);requests.push(data);
  return res.end(JSON.stringify({message:{...data,body:data.body.trim(),id:'owner-message-prep:'+data.requestId,createdAt:'2026-10-30T12:00:00Z'}}));
 }
 if(req.url==='/api/message-templates'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({templates:[]}));}
 if(req.url==='/'){res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 res.statusCode=404;res.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;};const errors=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const width of [320,375,390,430])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:844});await page.goto(origin);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.getByRole('button',{name:'Message',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Message',exact:true});
  await dialog.getByLabel('Message text').fill('  Exact synthetic message\nSecond line  ');
  const before=requests.length;await dialog.getByRole('button',{name:'Text',exact:true}).click();
  const voice=dialog.getByRole('region',{name:'Google Voice text handoff'});await voice.waitFor();
  check(requests.length===before+1&&requests.at(-1).body==='Exact synthetic message\nSecond line','Whitespace-normalized text reaches actual prepared Voice UI at '+width+'/'+theme);
  check(await dialog.getByRole('button',{name:'I sent the prepared message',exact:true}).isVisible(),'Preparation requires separate owner send confirmation');
  await dialog.getByRole('button',{name:'Not sent — keep editing',exact:true}).click();
  await dialog.getByRole('button',{name:'Email',exact:true}).click();
  const email=dialog.getByRole('link',{name:'Open email app',exact:true});await email.waitFor();
  const href=await email.getAttribute('href'),url=new URL(href);
  check(url.protocol==='mailto:'&&decodeURIComponent(url.pathname)==='fixture+qa@example.invalid'&&url.searchParams.get('body')==='Exact synthetic message\nSecond line','Explicit email link keeps exact recipient/body at '+width+'/'+theme);
  check(page.url()===origin+'/'&&requests.at(-1).channel==='email_prepared','Email preparation does not launch external app or claim sent');
  await email.scrollIntoViewIfNeeded();const box=await email.boundingBox();
  check(box.x>=0&&box.x+box.width<=width+1&&box.height>=44,'Email handoff fits 44px mobile touch target');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Composer has no horizontal page overflow');
  check(await dialog.getByRole('button',{name:'Copy email message',exact:true}).isVisible(),'Manual email fallback remains available');
 }
 check(errors.length===0,'No browser exceptions: '+errors.join(';'));
 console.log('PASS '+checks+' actual composer mobile/light-dark text/email handoff assertions; no external sends.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
