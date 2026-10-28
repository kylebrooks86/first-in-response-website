/** Real Today next-job action JSX + compiled shared CSS, run only on synthetic localhost Chromium. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8');
assert.match(source,/\{tab===\"dashboard\"&&<StrideButton top\/>\}/,'Stride belongs only in the Home topbar');
assert.equal((source.match(/<StrideButton top\/>/g)||[]).length,1,'Only one original Stride shortcut location');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const actionNodes=[];
function scan(node){
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='div'){
   const css=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text==='className');
   if(css&&ts.isStringLiteral(css.initializer)&&css.initializer.text==='dashboard-next-job-actions')actionNodes.push(node);
 }
 ts.forEachChild(node,scan);
}
scan(ast);
assert.equal(actionNodes.length,1,'Find exactly one ACTUAL Today next-job toolbar');
const actions=actionNodes[0].getText(ast);
assert.match(actions,/dashboard-next-contact-tools/,'Contact links must be grouped in the actual toolbar');
const fixture=`import React,{useState} from 'react';
import {GoogleVoiceTextAction} from './components/google-voice-text-action';
import {createRoot} from 'react-dom/client';
import {Phone,MessageSquareText,Mail,Navigation,ChevronRight,ChevronDown} from 'lucide-react';
function Button({variant,className,...props}){return <button className={className||''} {...props}/>;}
function Fixture(){
 const [flags,setFlags]=useState({phone:true,email:true,address:true});
 window.__setFlags=setFlags;
 window.__actions=[];
 const upcomingJobs=[{id:'synthetic-job',address:flags.address?'123 Synthetic Lane, Tulsa, OK':''}];
 const nextJobPhone=flags.phone?'9185550102':null;
 const canEmailNextJob=flags.email;
 const nextJobEmail=flags.email?'owner@example.invalid':'';
 const onOpenEstimate=id=>window.__actions.push('job:'+id);
 const onNavigate=tab=>window.__actions.push('nav:'+tab);
 return <main className="dashboard-view"><section className="dashboard-next-job">
 <div className="dashboard-next-job-info"><h2>Synthetic next job</h2></div>
 ${actions}
 </section></main>;
}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);}
 else if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;const failures=[],outside=[];
function check(ok,message){assert.ok(ok,message);checks++;}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>failures.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(outside.push(route.request().url()),route.abort()));
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:844});
  await page.goto(origin);await page.locator('.dashboard-next-contact-tools>summary').waitFor();
  const summary=page.locator('.dashboard-next-contact-tools>summary');
  const call=page.getByRole('link',{name:'Call next job customer'});
  const sms=page.getByRole('button',{name:'Text next job customer using Google Voice'});
  const email=page.getByRole('link',{name:'Email next job customer'});
  const dirs=page.getByRole('link',{name:'Directions to next job'});
  check(await dirs.isVisible(),width+': driving link remains one tap away');
  check(!(await call.isVisible())&&!(await sms.isVisible())&&!(await email.isVisible()),width+': contacts initially tucked away');
  await page.getByRole('button',{name:/Open next job/}).click();
  check(await page.evaluate(()=>window.__actions.includes('job:synthetic-job')),width+': existing job navigation preserved');
  await summary.click();
  check(await call.isVisible()&&await sms.isVisible()&&await email.isVisible(),width+': all contact methods restored by one tap');
  check(await call.getAttribute('href')==='tel:9185550102'&&await email.getAttribute('href')==='mailto:owner%40example.invalid',width+': call/email destinations remain unchanged');
  await sms.click();
  check(await page.getByRole('dialog',{name:'Text using Google Voice'}).isVisible(),width+': text action opens Google Voice handoff, not personal SMS');
  check(await page.getByRole('link',{name:'Open Google Voice'}).getAttribute('href')==='https://voice.google.com/',width+': only verified Google Voice website is offered');
  check(await page.getByText('9185550102',{exact:true}).isVisible(),width+': exact recipient number available for copying');
  await page.keyboard.press('Escape');
  const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,actions:[...document.querySelectorAll('.dashboard-next-job-actions button,.dashboard-next-job-actions a,.dashboard-next-contact-tools>summary')].filter(n=>n.getClientRects().length).map(n=>{const rect=n.getBoundingClientRect();return {label:n.textContent.trim(),left:rect.left,right:rect.right,height:rect.height};})}));
  check(geometry.scrollWidth<=width+1,width+': no page horizontal overflow');
  check(geometry.actions.every(box=>box.left>=-1&&box.right<=width+1&&box.height>=44),width+': all visible action boxes fit screen and 44px tap height');
  await summary.click();
  check(!(await call.isVisible()),width+': contact options close without deleting links');
  await page.getByRole('button',{name:'Full schedule',exact:true}).click();
  check(await page.evaluate(()=>window.__actions.includes('nav:schedule')),width+': full schedule access preserved');
 }
 await page.evaluate(()=>window.__setFlags({phone:false,email:true,address:true}));
 await page.waitForFunction(()=>!document.querySelector('.dashboard-next-contact-options a[href^="tel:"]'));
 check(await page.locator('.dashboard-next-contact-tools').count()===1,'Email-only customer still has contact disclosure');
 await page.locator('.dashboard-next-contact-tools>summary').click();
 check(await page.getByRole('link',{name:'Email next job customer'}).isVisible(),'Email-only link remains accessible');
 check(await page.getByRole('link',{name:'Call next job customer'}).count()===0,'Do not fabricate phone link');
 await page.evaluate(()=>window.__setFlags({phone:false,email:false,address:true}));
 await page.waitForFunction(()=>!document.querySelector('.dashboard-next-contact-tools'));
 check(await page.locator('.dashboard-next-contact-tools').count()===0,'No empty contact disclosure if neither contact method exists');
 check(await page.getByRole('link',{name:'Directions to next job'}).isVisible(),'Directions still available without contacts');
 check(failures.length===0&&outside.length===0,'No JS errors or external requests: '+failures.join(', '));
 console.log('PASS '+checks+' real Today/next-job React browser checks at 320/375/390/430/768px. Synthetic local fixture; not hosted QA or iPhone Safari.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
