/** Test original FIRE sidebar React JSX + original nav data and compiled CSS in Chrome. */
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
const declaration=source.match(/const nav = useMemo\(\(\) => \[[\s\S]*?\] as const, \[\]\);/)?.[0];
assert.ok(declaration,'Must derive navigation destinations from actual app source');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let navJsx=[];
function find(node){
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='nav'){
  const attr=node.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text==='aria-label');
  if(attr&&ts.isStringLiteral(attr.initializer)&&attr.initializer.text==='All business sections')navJsx.push(node.getText(ast));
 }
 ts.forEachChild(node,find);
}
find(ast);assert.equal(navJsx.length,1,'Must exercise original app sidebar nav JSX');
assert.match(navJsx[0],/sidebar-more-nav/);
assert.match(navJsx[0],/nav\.slice\(7\)/);
assert.match(navJsx[0],/nav\.slice\(0,7\)/);
const fixture=[
 "import React,{useEffect,useMemo,useState}from'react';import{createRoot}from'react-dom/client';",
 "import{House,Users,ClipboardList,CalendarDays,Clock3,Receipt,CreditCard,MapPin,BriefcaseBusiness,BarChart3,Settings,ChevronDown}from'lucide-react';",
 "function App(){const [tab,setTab]=useState('dashboard'),[moreNavOpen,setMoreNavOpen]=useState(false),[mobileMenu,setMobileMenu]=useState(true);",
 declaration,
 " const interactive=true,liveMetrics={estimates:3};",
 " useEffect(()=>{if(nav.slice(7).some(([id])=>id===tab))setMoreNavOpen(true)},[tab,nav]);",
 " useEffect(()=>{window.__navTab=tab;window.__jumpTab=setTab;window.__mobileMenu=mobileMenu;window.__reopenMenu=()=>setMobileMenu(true)},[tab,mobileMenu]);",
 " return <main className='app-shell'><aside className={'sidebar '+(mobileMenu?'mobile-open':'')}>",
 navJsx[0],
 " </aside></main>}",
 "createRoot(document.getElementById('app')).render(<App/>);"
].join('\n');
const bundle=await esbuild.build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);}
 else if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css.css);}
 else if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');}
 else{res.statusCode=404;res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
let browser,count=0;const errors=[],outside=[];
function check(value,msg){assert.ok(value,msg);count++;}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(outside.push(r.request().url()),r.abort()));
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:844});await page.goto(origin);
  const nav=page.getByRole('navigation',{name:'All business sections'});
  const more=nav.locator('details.sidebar-more-nav');
  await more.waitFor();
  check(await more.evaluate(el=>!el.open),width+': extras start collapsed');
  check(await nav.locator('button:visible').count()===7,width+': seven everyday destinations, no other clutter');
  check(await nav.getByRole('button',{name:'Customers'}).isVisible()&&await nav.getByRole('button',{name:'Payments'}).isVisible(),width+': ordinary navigation remains accessible');
  check(!(await nav.getByRole('button',{name:'Business',exact:true}).isVisible()),width+': business advanced tool initially hidden');
  const toggle=more.locator('summary');
  await toggle.focus();await page.keyboard.press('Enter');
  check(await more.evaluate(el=>el.open),width+': Enter opens more tools');
  check(await nav.getByRole('button',{name:'Door knocking'}).isVisible()&&await nav.getByRole('button',{name:'Business',exact:true}).isVisible()&&await nav.getByRole('button',{name:'Insights'}).isVisible()&&await nav.getByRole('button',{name:'Settings'}).isVisible(),width+': every original advanced section still available');
  await nav.getByRole('button',{name:'Business',exact:true}).click();
  check(await page.evaluate(()=>window.__navTab==='business'&&window.__mobileMenu===false),width+': business tab activates and closes mobile menu');
  await page.evaluate(()=>window.__reopenMenu());
  await nav.getByRole('button',{name:'Dashboard',exact:true}).click();
  await page.evaluate(()=>window.__reopenMenu());
  await toggle.click();
  check(!(await more.evaluate(el=>el.open)),width+': owner can collapse advanced drawer');
  await page.evaluate(()=>window.__jumpTab('insights'));
  await page.waitForFunction(()=>document.querySelector('.sidebar-more-nav')?.open);
  check(await nav.getByRole('button',{name:'Insights'}).getAttribute('class').then(s=>s.includes('active')),width+': direct shortcut to Insights reopens current menu section');
  await page.evaluate(()=>window.__jumpTab('settings'));
  check(await nav.getByRole('button',{name:'Settings'}).getAttribute('class').then(s=>s.includes('active')),width+': direct notification to Settings remains located in the menu');
  check(await toggle.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.left>=-1&&r.right<=innerWidth+1}),width+': keyboard disclosure has a phone-sized target');
  const fit=await nav.evaluate(el=>el.scrollWidth<=el.clientWidth+1);
  check(fit,width+': navigation contents have no horizontal overflow');
 }
 check(errors.length===0&&outside.length===0,'No runtime errors or unexpected network: '+errors.join(';'));
 console.log('PASS '+count+' actual FIRE navigation JSX mobile Chromium checks. Local synthetic data, no hosted writes.');
}finally{await browser?.close();await new Promise(done=>server.close(done));}
