/** FIRE real React/Radix first-and-last tap regression at narrow device widths.
 * Chrome touch emulation, original catalog, compiled Tailwind, localhost only.
 * NOT native iPhone Safari or hosted QA acceptance.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd();
const fixture="import React,{useState}from'react';\nimport{createRoot}from'react-dom/client';\nimport{FIRE_SERVICES as services}from'./lib/fire-services';\nimport{estimateServicePickerOptions}from'./lib/estimate-service-picker-options';\nimport{Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from'./components/ui/select';\nimport{DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger}from'./components/ui/dropdown-menu';\nimport{Popover,PopoverContent,PopoverTrigger}from'./components/ui/popover';\nimport{Dialog,DialogContent,DialogTitle,DialogTrigger}from'./components/ui/dialog';\nimport{Sheet,SheetContent,SheetTitle,SheetTrigger}from'./components/ui/sheet';\nfunction App(){const [selected,setSelected]=useState(''),[action,setAction]=useState(''),[theme,setTheme]=useState('light');\ndocument.documentElement.dataset.theme=theme;\nreturn <main style={{padding:12,maxWidth:520,margin:'auto'}}>\n<h1>FIRE synthetic iPhone menu test</h1>\n<button type='button' onClick={()=>setTheme(x=>x==='light'?'dark':'light')}>Theme</button>\n<section style={{marginTop:24,padding:16,minHeight:170}} aria-label='Estimate service'>\n<label htmlFor='service-choice'>Service</label>\n<Select value={selected} onValueChange={setSelected}><SelectTrigger id='service-choice' aria-label='Choose service' className='estimate-service-picker-trigger'><SelectValue placeholder='Choose a service'/></SelectTrigger>\n<SelectContent className='estimate-service-picker' position='popper' sideOffset={6} collisionPadding={16}>\n{estimateServicePickerOptions(services).map(s=><SelectItem className='estimate-service-picker-item' key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>\n<output aria-label='Selected service ID'>{selected}</output></section>\n<div style={{height:220}} aria-hidden='true'/>\n<section aria-label='Secondary actions'>\n<DropdownMenu><DropdownMenuTrigger>Actions</DropdownMenuTrigger><DropdownMenuContent>{Array.from({length:18},(_,i)=><DropdownMenuItem key={i} onSelect={()=>setAction('action '+(i+1))}>Action {i+1}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>\n<output aria-label='Selected action'>{action}</output>\n<Popover><PopoverTrigger>More details</PopoverTrigger><PopoverContent><p>Short explanatory content</p><button type='button'>Close example</button></PopoverContent></Popover>\n<Dialog><DialogTrigger>Open corner dialog</DialogTrigger><DialogContent><DialogTitle>Corner dialog</DialogTitle><p>Synthetic read-only modal</p></DialogContent></Dialog>\n<Sheet><SheetTrigger>Open corner drawer</SheetTrigger><SheetContent><SheetTitle>Corner drawer</SheetTitle><p>Synthetic read-only drawer</p></SheetContent></Sheet>\n</section></main>};createRoot(document.getElementById('app')).render(<App/>);";
const bundle=(await esbuild.build({
 stdin:{contents:fixture,resolveDir:root,loader:'tsx',sourcefile:'fire-picker-test.tsx'},
 bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',
 tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}
})).outputFiles[0].text;
const css=(await postcss([tailwind({base:root})]).process(
 readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')}
)).css;
const server=createServer((req,res)=>{
 res.setHeader('cache-control','no-store');
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle);return;}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);return;}
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const tested=[[320,568],[375,667],[390,844],[430,932],[667,375]];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({hasTouch:true});page.setDefaultTimeout(6500);
 const errors=[],outside=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort();}
  return route.continue();
 });
 for(const [width,height] of tested)for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.goto(origin);
  if(theme==='dark')await page.getByRole('button',{name:'Theme'}).click();
  const trigger=page.getByRole('combobox',{name:'Choose service'});
  await trigger.click();
  const popup=page.locator('.estimate-service-picker[data-slot="select-content"]');
  await popup.waitFor({state:'visible'});
  const layout=await popup.evaluate(n=>{
   const r=n.getBoundingClientRect(),v=n.querySelector('[data-slot="select-viewport"]'),vr=v.getBoundingClientRect();
   return{outer:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height},viewport:{top:vr.top,bottom:vr.bottom,height:vr.height,scrollHeight:v.scrollHeight,clientHeight:v.clientHeight}};
  });
  check(layout.outer.left>=-1&&layout.outer.right<=width+1&&
   layout.outer.top>=-1&&layout.outer.bottom<=height+1,
   'Picker fully on screen '+width+'/'+height+'/'+theme+JSON.stringify(layout));
  check(layout.outer.height<=height*0.5+5,
   'Service dropdown shorter than half the mobile height '+width+'/'+height+'/'+theme);
  check(layout.viewport.scrollHeight>layout.viewport.clientHeight,
   'Actual long service list scrolls within popup');
  const first=popup.getByRole('option').first();
  check((await first.innerText()).includes('Custom Service'),'Custom first in Radix list');
  await first.click();
  check(await page.locator('output[aria-label="Selected service ID"]').innerText()==='custom',
   'Tapping Custom Service changes selected value');
  await trigger.click();
  const last=popup.getByRole('option').last();
  await last.scrollIntoViewIfNeeded();
  const measureLast=()=>last.evaluate(n=>{
   const r=n.getBoundingClientRect(),e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   const viewport=n.closest('[data-slot="select-viewport"]');
   return{ok:r.width>=44&&r.height>=44&&(e===n||n.contains(e)),top:r.top,bottom:r.bottom,
    viewportScrollTop:viewport?.scrollTop,viewportScrollHeight:viewport?.scrollHeight,viewportHeight:viewport?.clientHeight};
  });
  let hit=await measureLast();
  if(!hit.ok||hit.top<0||hit.bottom>height+1){
   // Playwright's scrollIntoView can scroll the page instead of Radix's
   // nested Select viewport on short landscape Chrome. Exercise actual user
   // wheel scrolling of that viewport; do not silently waive a hidden item.
   const viewport=popup.locator('[data-slot="select-viewport"]');
   await viewport.hover();
   await page.mouse.wheel(0,4800);
   hit=await measureLast();
  }
  check(hit.ok&&hit.top>=-1&&hit.bottom<=height+1,
   'Last service must be reachable through a real scrollable dropdown '+width+'/'+height+'/'+theme+JSON.stringify(hit));
  await last.click();
  const selected=await page.locator('output[aria-label="Selected service ID"]').innerText();
  check(selected.length>0&&selected!=='custom','Last original service can be selected');
  await page.getByRole('button',{name:'Actions'}).click();
  const menu=page.locator('[data-slot="dropdown-menu-content"]').first();
  await menu.waitFor({state:'visible'});
  const lastAction=menu.getByRole('menuitem').last();
  await lastAction.scrollIntoViewIfNeeded();await lastAction.click();
  check(await page.locator('output[aria-label="Selected action"]').innerText()==='action 18',
   'Last action-menu row remains tappable at edge');
  await page.getByRole('button',{name:'More details'}).click();
  const rect=await page.locator('[data-slot="popover-content"]').boundingBox();
  check(rect&&rect.x>=-1&&rect.x+rect.width<=width+1&&rect.y>=-1&&rect.y+rect.height<=height+1,
   'Popover avoids edge clipping');
  // Real Radix content/close controls (not stubs). Small visible X must never
  // sacrifice the minimum 44px hit region or accessible Close name.
  const measureClose=async (contentSelector,closeSelector)=>{
   return page.evaluate(({contentSelector,closeSelector})=>{
    const content=document.querySelector(contentSelector),close=content?.querySelector(closeSelector);
    if(!content||!close)return null;
    const c=content.getBoundingClientRect(),b=close.getBoundingClientRect(),icon=close.querySelector('svg')?.getBoundingClientRect();
    return {width:b.width,height:b.height,iconWidth:icon?.width,iconHeight:icon?.height,top:b.top-c.top,right:c.right-b.right};
   },{contentSelector,closeSelector});
  };
  await page.getByRole('button',{name:'Open corner dialog'}).click();
  const cornerDialog=page.getByRole('dialog',{name:'Corner dialog'});
  await cornerDialog.waitFor();
  const dc=await measureClose('[data-slot="dialog-content"]','[data-slot="dialog-close"]');
  check(dc&&dc.width>=43&&dc.height>=43&&dc.iconWidth<=17&&dc.iconHeight<=17&&
   dc.iconWidth>=15&&dc.iconHeight>=15&&dc.top>=-2&&dc.top<=12&&dc.right>=-2&&dc.right<=12,
   'Dialog uses small 16px corner X inside a 44px tap area '+width+'/'+height+'/'+theme+JSON.stringify(dc));
  await cornerDialog.getByRole('button',{name:'Close'}).click();
  await cornerDialog.waitFor({state:'hidden'});
  check(!(await cornerDialog.isVisible()),'Small dialog X dismisses using real Radix close');
  await page.getByRole('button',{name:'Open corner drawer'}).click();
  const cornerDrawer=page.getByRole('dialog',{name:'Corner drawer'});
  await cornerDrawer.waitFor();
  const sc=await measureClose('[data-slot="sheet-content"]','[data-slot="sheet-close"]');
  check(sc&&sc.width>=43&&sc.height>=43&&sc.iconWidth<=17&&sc.iconHeight<=17&&
   sc.iconWidth>=15&&sc.iconHeight>=15&&sc.top>=-2&&sc.top<=12&&sc.right>=-2&&sc.right<=12,
   'Drawer uses same small 16px corner X and 44px target '+width+'/'+height+'/'+theme+JSON.stringify(sc));
  await cornerDrawer.getByRole('button',{name:'Close'}).click();
  await cornerDrawer.waitFor({state:'hidden'});
  check(!(await cornerDrawer.isVisible()),'Small drawer X dismisses using real Radix close');
 }
 check(errors.length===0,'No React/Radix runtime errors');
 check(outside.length===0,'All browser requests stay on isolated localhost');
 console.log('PASS '+checks+'/'+checks+' actual React/Radix simulated touch browser checks. Real iPhone Safari still requires owner acceptance.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
