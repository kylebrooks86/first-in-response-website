/** Actual EditEstimateDialog, Radix portal, inputs/selects and compiled Tailwind CSS.
 * Local synthetic nested-dialog fixture only; no hosted data or native iOS keyboard.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),root=process.cwd();
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8');
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const editor=section('function EditEstimateDialog(','function EditInvoiceDialog(');
const discount=section('function discountMath(','function NewEstimate(');
const fixture=`import React,{useState,useRef}from'react';import{createRoot}from'react-dom/client';
import{PenLine,Trash2,Plus,Check}from'lucide-react';
import{Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle}from'./components/ui/dialog';
import{Button}from'./components/ui/button';import{Label}from'./components/ui/label';import{Input}from'./components/ui/input';import{Textarea}from'./components/ui/textarea';
import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from'./components/ui/select';
import{FIRE_SERVICES as services,serviceDescriptionFor}from'./lib/fire-services';
import{editMoneyLine,editableLineTotalCents,restoreEditableLineMoney}from'./lib/editable-line-totals';
const money=cents=>'$'+(cents/100).toFixed(2);
${discount}\n${editor}
const estimate={id:'synthetic-editor-only',service:services[0].name,totalCents:20000,paidCents:0,items:Array.from({length:16},(_,i)=>({id:'item-'+i,name:services[0].name,description:'Synthetic long description '+i+' '+('Cleaning and flushing; excluded repairs and inaccessible areas. '.repeat(6)),quantity:1,unit:'job',totalCents:1250}))};
function Fixture(){const[theme,setTheme]=useState('dark');window.setTheme=setTheme;document.documentElement.dataset.theme=theme;
return <Dialog defaultOpen><DialogContent className="estimate-detail sm:max-w-[650px]"><DialogTitle>Synthetic $200 estimate</DialogTitle><div style={{height:120}}>Existing synthetic estimate details</div><EditEstimateDialog estimate={estimate} onSaved={value=>window.savedEstimate=value}/></DialogContent></Dialog>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'editor-fixture.tsx'},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
let compiled;
if(process.argv.includes('--built-css')){
 const directory='dist/client/_next/static/css';
 const styles=readdirSync(directory).filter(n=>n.endsWith('.css')).map(n=>readFileSync(resolve(directory,n),'utf8')).filter(s=>s.includes('.estimate-edit-dialog'));
 assert.equal(styles.length,1,'Exactly one actual production editor stylesheet');compiled={css:styles[0]};
}else compiled=await postcss([tailwind({base:root})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
let patches=0,saveStatus=503;
const server=createServer((req,res)=>{res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(compiled.css);}
 else if(req.url==='/api/estimates/synthetic-editor-only'&&req.method==='PATCH'){patches++;let body='';req.on('data',c=>body+=c);req.on('end',()=>{const data=JSON.parse(body);assert.equal(data.items.reduce((sum,i)=>sum+i.totalCents,0),20000);res.writeHead(saveStatus,{'content-type':'application/json'});res.end(JSON.stringify(saveStatus===200?{estimate:{totalCents:20000}}:{error:'Synthetic save unavailable; draft retained'}));});}
 else if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;let browser,checks=0;const errors=[],outside=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){outside.push(r.request().url());return r.abort();}return r.continue();});
 const check=(ok,label)=>{assert.ok(ok,label);checks++;}; page.setDefaultTimeout(5000);
 for(const [width,height]of [[320,568],[375,667],[390,844],[430,932],[760,900],[768,1024],[1024,800],[667,375]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.goto(origin);await page.evaluate(t=>window.setTheme(t),theme);
  const trigger=page.getByRole('button',{name:'Edit estimate',exact:true});await trigger.click({timeout:5000});
  const dialog=page.locator('.estimate-edit-dialog'),scroll=dialog.locator('.estimate-edit-scroll-area'),close=dialog.getByRole('button',{name:'Close',exact:true}),save=dialog.getByRole('button',{name:'Save estimate changes'});
  await save.waitFor();await page.waitForTimeout(250);
  const geometry=await dialog.evaluate(n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,translate:getComputedStyle(n).translate,transform:getComputedStyle(n).transform};});
  check(geometry.left>=-1&&geometry.right<=width+1&&geometry.top>=-1&&geometry.bottom<=height+1,`${width}/${height}/${theme}: actual Radix bounds ${JSON.stringify(geometry)}`);
  check(Math.abs((geometry.left+geometry.right)/2-width/2)<2,'Horizontally centered actual portal');
  const hit=async locator=>locator.evaluate(n=>{const r=n.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return n===e||n.contains(e);});
  check(await hit(close)&&await hit(save),'Close and Save are visible and hit-testable');
  check(await scroll.evaluate(n=>n.scrollHeight>n.clientHeight),'Long actual form has bounded internal scrolling');
  await scroll.evaluate(n=>n.scrollTop=n.scrollHeight);check(await scroll.evaluate(n=>n.scrollTop>100),'Long form can reach totals/end');
  check(await hit(close)&&await hit(save),'Close and Save remain reachable after form scroll');
  const textarea=dialog.locator('textarea').last();await textarea.focus();await textarea.fill('Synthetic edited draft preserved');
  check(await textarea.inputValue()==='Synthetic edited draft preserved','Editing focused input retains draft');
  await page.keyboard.press('Tab');check(await dialog.evaluate(n=>n.contains(document.activeElement)),'Keyboard stays in nested modal');
  await scroll.focus();await page.keyboard.press('Home');await page.keyboard.press('End');check(await scroll.evaluate(n=>n.scrollTop>0),'Keyboard scroll reaches lower form');
  await close.click();await dialog.waitFor({state:'detached'});check(await page.getByRole('heading',{name:'Synthetic $200 estimate'}).isVisible(),'X returns to original estimate without save');
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.getByRole('button',{name:'Edit estimate',exact:true}).click();
 const dialog=page.locator('.estimate-edit-dialog'),save=dialog.getByRole('button',{name:'Save estimate changes'});
 await dialog.locator('textarea').first().fill('Synthetic keyboard resize draft');
 for(const height of [420,300,844]){
  await page.setViewportSize({width:390,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const bounds=await dialog.boundingBox();check(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=391&&bounds.y+bounds.height<=height+1,'Reduced-height '+height+' keeps modal inside viewport: '+JSON.stringify(bounds));
  check(await dialog.locator('textarea').first().inputValue()==='Synthetic keyboard resize draft','Resize preserves focused draft');
 }
 await save.click();await dialog.getByRole('alert').waitFor();check(await dialog.getByRole('alert').innerText()==='Synthetic save unavailable; draft retained','Failed save keeps editor and error');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});check(await page.getByRole('heading',{name:'Synthetic $200 estimate'}).isVisible(),'Escape closes only nested editor');
 await page.getByRole('button',{name:'Edit estimate',exact:true}).click();saveStatus=200;await save.click();await dialog.waitFor({state:'detached'});check(await page.evaluate(()=>window.savedEstimate?.totalCents)===20000,'Successful synthetic save preserves $200 total');
 check(patches===2,'Only explicit synthetic save actions submit, once each');check(!outside.length&&!errors.length,'No remote requests/runtime errors');
 console.log(JSON.stringify({passed:checks,actualEditor:true,actualRadix:true,compiledTailwind:true,productionMinifiedCSS:process.argv.includes('--built-css'),nativeIOSKeyboardTested:false,hostedDataTouched:false}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
