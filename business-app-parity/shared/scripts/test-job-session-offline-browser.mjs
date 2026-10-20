/** Actual report/cost dialogs with real owner-session provider. No remote data. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {resolve,join} from 'node:path';
const require=createRequire(import.meta.url),esbuild=require('../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync('app/dashboard.tsx','utf8'),start=source.indexOf('const reportChecks='),end=source.indexOf('function RefundPayment(',start);assert.ok(start>0&&end>start);
const fixture=`import React,{useState,useEffect,useRef}from'react';import{createRoot}from'react-dom/client';import{ClipboardList,CircleDollarSign}from'lucide-react';
import{Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle}from'./components/ui/dialog';import{Button}from'./components/ui/button';import{Input}from'./components/ui/input';import{Textarea}from'./components/ui/textarea';import{Label}from'./components/ui/label';import{Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from'./components/ui/select';
import{OwnerJobSnapshotsProvider,useOwnerJobSnapshots,createOwnerJobSnapshots}from'./components/owner-job-snapshots';
const money=c=>'$'+(c/100).toFixed(2),resolvedBillingTotalCents=e=>e.totalCents;
${source.slice(start,end)}
const base={id:'job-a',customerId:'customer-a',customer:'Synthetic Job Customer',service:'Dryer vent',status:'scheduled',totalCents:20000,paidCents:0};
function Screen(){const[shown,setShown]=useState(true),[job,setJob]=useState(base);window.sessionAccess=useOwnerJobSnapshots();window.setSyntheticJob=setJob;window.newSnapshotCache=createOwnerJobSnapshots;
return <><button onClick={()=>setShown(!shown)}>Toggle job screen</button>{shown&&<OwnerJobTools estimate={job} onSaved={()=>{window.completed=true}}/>}</>}
function Fixture(){return <OwnerJobSnapshotsProvider><Screen/></OwnerJobSnapshotsProvider>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
const bundle=await esbuild.build({stdin:{contents:fixture,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',jsx:'automatic',tsconfig:resolve('tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
const css=await postcss([tailwind({base:process.cwd()})]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});
if(process.argv.includes('--compile-only')){assert.ok(bundle.outputFiles[0].text.length>1000&&css.css.includes('.fire-job-footer'));console.log('PASS: actual Job Report/Cost browser fixture compiles; browser not executed.');process.exit(0);}
let mode='ok',version=1,reads=0,writes=0;
let longCosts=false,reportPostMode='fail',releaseReport=null;
const report=()=>({id:'report-a',estimateId:'job-a',customerId:mode==='mismatch'?'customer-b':'customer-a',checklist:'{"Before photos captured":true}',notes:'Synthetic saved report '+version,airflowBefore:'1',airflowAfter:'2',status:'draft'});
const server=createServer((req,res)=>{
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].text);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css.css);}
 if(req.url?.startsWith('/api/')){
  res.setHeader('content-type','application/json');
  if(req.method==='POST'){writes++;if(req.url==='/api/job-reports'&&reportPostMode==='hold'){let raw='';req.on('data',d=>raw+=d);req.on('end',()=>{const body=JSON.parse(raw);releaseReport=()=>{res.statusCode=201;res.end(JSON.stringify({report:{id:'synthetic-saved-report',estimateId:body.estimateId,customerId:body.customerId,checklist:JSON.stringify(body.checklist),notes:body.notes,airflowBefore:body.airflowBefore,airflowAfter:body.airflowAfter,status:body.status==='complete'?'completed':'draft'}}));};});return;}res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic uncertain save; reload before retrying.'}));}
  reads++;res.statusCode=mode==='denied'?401:mode==='missing'?404:mode==='server'?503:200;
  return res.end(JSON.stringify(req.url.startsWith('/api/job-reports')?{reports:mode==='empty'?[]:[report()]}:{expenses:longCosts?Array.from({length:25},(_,i)=>({id:'long-cost-'+i,estimateId:'job-a',description:'Synthetic cost '+i+(i===0?' '+('LongCost'.repeat(35)):''),category:'Chemicals',amountCents:100})):[{id:'cost-a',estimateId:'job-a',description:'Synthetic chemicals '+version,category:'Chemicals',amountCents:1500},{id:'cost-b',estimateId:'job-b',description:'Other customer private cost',category:'Supplies',amountCents:9999}]}));
 }
 res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="app"></div><script type="module" src="/bundle.js"></script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;let browser,count=0;const errors=[],outside=[];
const check=(ok,label)=>{assert.ok(ok,label);count++;};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(outside.push(r.request().url()),r.abort()));
 const open=async kind=>{
  await page.getByRole('button',{name:kind==='report'?'Job report':'Job costs',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:kind==='report'?'Service completion report':'Job costs & profit'}).waitFor();
  return dialog;
 };
 const close=async()=>{
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  // Radix keeps closing content mounted during its exit animation. Do not open
  // the next modal until this one has actually disappeared.
  await dialog.waitFor({state:'hidden'});
 };
 const disconnect=async()=>{await context.setOffline(true);await page.waitForFunction(()=>window.sessionAccess.online===false);};
 const reconnect=async()=>{await context.setOffline(false);await page.waitForFunction(()=>window.sessionAccess.online===true);};
 for(const width of [320,390,768,1366])for(const theme of ['light','dark']){
  mode='ok';version=1;await page.setViewportSize({width,height:900});await page.goto(origin);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  let dialog=await open('report');await dialog.locator('textarea').waitFor();check(await dialog.locator('textarea').inputValue()==='Synthetic saved report 1','Verified online report loaded');await close();
  dialog=await open('costs');await dialog.getByText('Synthetic chemicals 1',{exact:true}).waitFor();check((await dialog.innerText()).includes('$185.00')&&!(await dialog.innerText()).includes('Other customer'),'Verified costs/profit filtered to exact job');await close();
  await page.getByRole('button',{name:'Toggle job screen'}).click();await page.getByRole('button',{name:'Toggle job screen'}).click();
  const previousReads=reads,previousWrites=writes;await disconnect();
  dialog=await open('report');await dialog.locator('.offline-job-status').waitFor();
  check(await dialog.locator('textarea').inputValue()==='Synthetic saved report 1','Report survives dialog/screen unmount then offline reopen');
  check(await dialog.locator('textarea').getAttribute('readonly')!==null&&await dialog.getByRole('button',{name:/^Save (?:draft|completed) report$/}).isDisabled(),'Offline report cannot edit/save');
  check(await dialog.locator('.offline-job-status').innerText().then(t=>t.includes('last checked')&&t.includes('Not saved for offline restart')),'Snapshot freshness and restart limits explicit');
  const rect=await dialog.boundingBox();check(rect.x>=-1&&rect.x+rect.width<=width+1,`${width}/${theme}: offline dialog fits viewport`);await close();
  dialog=await open('costs');await dialog.locator('.offline-job-status').waitFor();check((await dialog.innerText()).includes('Synthetic chemicals 1'),'Offline costs readable');
  check(await dialog.locator('.cost-form').count()===0,'No offline expense submission controls');await close();
  check(reads===previousReads&&writes===previousWrites,'Disconnect reads never reach server or enqueue a write');
  version=2;await reconnect();dialog=await open('report');await dialog.locator('textarea').waitFor();check(await dialog.locator('textarea').inputValue()==='Synthetic saved report 2','Reconnect fresh GET replaces old report');await close();
  dialog=await open('costs');await dialog.getByText('Synthetic chemicals 2',{exact:true}).waitFor();await disconnect();
  check(await dialog.locator('.cost-form').count()===0,'Going offline while dialog open immediately disables writes');
  await reconnect();check(await dialog.locator('.cost-form').count()===0,'Reconnect alone cannot re-enable writes without a fresh verified GET');await dialog.getByRole('button',{name:'Reload costs online',exact:true}).click();await dialog.locator('.cost-form').waitFor();check(await dialog.locator('.offline-job-status').count()===0,'Explicit successful reload restores online editing');await close();
 }
 // Short owner-phone layouts: the title, Close and footer controls stay out of the scrolling body.
 const stable=dialog=>dialog.evaluate(n=>Promise.all(n.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
 const reachable=async(dialog,selector,label)=>{const box=await dialog.locator(selector).boundingBox(),viewport=page.viewportSize();check(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,label+' stays within viewport');};
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}])for(const theme of ['light','dark']){
  mode='ok';longCosts=true;reportPostMode='fail';await page.setViewportSize(size);await page.goto(origin);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  let dialog=await open('costs');await dialog.getByRole('heading',{name:'Saved costs (25)',exact:true}).waitFor();await stable(dialog);check((await dialog.locator('.fire-job-context').innerText()).includes('Synthetic Job Customer'),'Cost dialog identifies its customer/job');
  await dialog.getByLabel('What was purchased or used?',{exact:true}).fill('Retained cost draft');await dialog.getByLabel('Amount (USD)',{exact:true}).fill('9.87');const oldWrites=writes;await dialog.getByRole('button',{name:'Add cost',exact:true}).click();await dialog.getByRole('alert').waitFor();check(await dialog.getByLabel('Amount (USD)',{exact:true}).inputValue()==='9.87','Interrupted cost save retains amount');
  const beforeReads=reads;await dialog.getByRole('button',{name:'Refresh saved costs',exact:true}).click();await dialog.getByRole('heading',{name:'Saved costs (25)',exact:true}).waitFor();check(reads===beforeReads+1&&writes===oldWrites+1,'Cost recovery performs one GET and never repeats POST');check(await dialog.getByLabel('What was purchased or used?',{exact:true}).inputValue()==='Retained cost draft','Read-only cost refresh retains draft');
  await dialog.getByRole('button',{name:'Saved costs',exact:true}).click();check(await page.evaluate(()=>document.activeElement.id)==='job-cost-records-job-a','Saved costs shortcut transfers keyboard focus');await dialog.locator('.fire-job-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);check(await dialog.getByText('Synthetic cost 24',{exact:true}).isVisible(),'Oldest cost remains in scrollable history');await reachable(dialog,'[data-slot=dialog-close]','Cost Close');await reachable(dialog,'.fire-job-header','Cost title');await reachable(dialog,'.fire-job-footer','Cost footer');
  const beforeJumpWrites=writes;await dialog.getByRole('button',{name:'Cost entry',exact:true}).click();check(await page.evaluate(()=>document.activeElement.id)==='job-cost-entry-job-a','Cost entry shortcut focuses the draft input');check(writes===beforeJumpWrites,'Cost navigation never submits');const width=await dialog.locator('.fire-job-scroll').evaluate(n=>({actual:n.scrollWidth,width:n.clientWidth}));check(width.actual<=width.width,'Long cost descriptions do not create horizontal scrolling');
  if(process.env.FIRE_JOB_UI_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_JOB_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.FIRE_JOB_UI_SCREENSHOT_DIR,`costs-${size.width}x${size.height}-${theme}.png`)});}await close();
  dialog=await open('report');
  try{await dialog.getByLabel('Technician notes',{exact:true}).waitFor();}
  catch(error){
    console.error('SYNTHETIC_REPORT_LOAD_DIAGNOSTIC',JSON.stringify({
      size,theme,mode,version,reads,writes,
      dialogText:(await dialog.innerText()).slice(0,3500),
      online:await page.evaluate(()=>window.sessionAccess.online),
      textareas:await dialog.locator('textarea').evaluateAll(nodes=>nodes.map(n=>({
        outerHTML:n.outerHTML.slice(0,700),
        labels:Array.from(n.labels??[]).map(label=>label.textContent?.trim()),
        rect:{width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height},
        display:getComputedStyle(n).display,visibility:getComputedStyle(n).visibility
      }))),
      labelMatches:await dialog.getByLabel('Technician notes',{exact:true}).count(),
      errors:errors.slice(-5)
    }));
    if(process.env.FIRE_JOB_UI_SCREENSHOT_DIR){mkdirSync(process.env.FIRE_JOB_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.FIRE_JOB_UI_SCREENSHOT_DIR,`report-failure-${size.width}x${size.height}-${theme}.png`)});}
    throw error;
  }
  await stable(dialog);check((await dialog.locator('.fire-job-context').innerText()).includes('Synthetic Job Customer'),'Report dialog identifies its customer/job');await dialog.getByLabel('Technician notes',{exact:true}).fill('Synthetic report draft');await dialog.locator('.fire-job-scroll').focus();await page.keyboard.press('End');await dialog.locator('.fire-job-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);await reachable(dialog,'[data-slot=dialog-close]','Report Close');await reachable(dialog,'.fire-job-header','Report title');await reachable(dialog,'.fire-job-footer','Report save footer');
  reportPostMode='hold';releaseReport=null;const beforeSave=writes;await dialog.getByRole('button',{name:'Save draft report',exact:true}).evaluate(n=>{n.click();n.click();});const deadline=Date.now()+5000;while(!releaseReport){if(Date.now()>deadline)throw Error('Report POST not submitted');await new Promise(r=>setTimeout(r,10));}check(writes===beforeSave+1,'Fixed report save still locks rapid taps');await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.keyboard.press('Escape');check(await dialog.isVisible(),'Pending report cannot be dismissed');releaseReport();await dialog.getByText('Job report saved.',{exact:true}).waitFor();await reachable(dialog,'.fire-job-save','Confirmed report save');check(await dialog.getByLabel('Technician notes',{exact:true}).inputValue()==='Synthetic report draft','Confirmed save preserves visible report content');
  if(process.env.FIRE_JOB_UI_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.FIRE_JOB_UI_SCREENSHOT_DIR,`report-${size.width}x${size.height}-${theme}.png`)});await close();
 }
 longCosts=false;reportPostMode='fail';
 // Cache records never cross customer associations or owner-session lifetimes.
 await page.evaluate(()=>window.setSyntheticJob({id:'job-a',customerId:'customer-b',service:'Dryer',status:'scheduled',totalCents:20000}));await disconnect();
 let dialog=await open('report');await dialog.getByRole('alert').waitFor();check((await dialog.innerText()).includes('No verified report'),'Different customer cannot read same-job cached report');await close();
 await reconnect();await page.reload();await page.getByRole('button',{name:'Job report',exact:true}).waitFor();await disconnect();
 dialog=await open('report');await dialog.getByRole('alert').waitFor();check(await dialog.locator('textarea').count()===0,'Reload discards session snapshot and never invents blank report');await close();
 await reconnect();mode='ok';dialog=await open('report');await dialog.locator('textarea').waitFor();await close();dialog=await open('costs');await dialog.getByText('Synthetic chemicals 2',{exact:true}).waitFor();await close();
 mode='denied';dialog=await open('report');await dialog.getByRole('alert').waitFor();check(await dialog.locator('textarea').count()===0,'401 never falls back to private data');await close();await disconnect();
 dialog=await open('costs');await dialog.getByRole('alert').waitFor();check(await dialog.locator('.profit-summary').count()===0,'401 revokes all job snapshots');await close();
 for(const failure of ['mismatch','missing','server']){
  await reconnect();mode='ok';await page.reload();dialog=await open('report');await dialog.locator('textarea').waitFor();await close();
  mode=failure;dialog=await open('report');await dialog.getByRole('alert').waitFor();await close();await disconnect();
  dialog=await open('report');await dialog.getByRole('alert').waitFor();check(await dialog.locator('textarea').count()===0,`${failure}: rejected read invalidates stale report`);await close();
 }
 await reconnect();mode='ok';await page.reload();dialog=await open('report');await dialog.locator('textarea').waitFor();await dialog.getByRole('button',{name:/^Save (?:draft|completed) report$/}).click();await dialog.getByText('Synthetic uncertain save; reload before retrying.',{exact:true}).waitFor();await close();await disconnect();
 dialog=await open('report');await dialog.getByRole('alert').waitFor();check(await dialog.locator('textarea').count()===0,'Uncertain write cannot resurrect pre-save snapshot');await close();await reconnect();
 check(await page.evaluate(async()=>localStorage.length===0&&sessionStorage.length===0&&(await indexedDB.databases()).length===0),'No records, keys or plaintext written to browser persistence');
 check(await page.evaluate(()=>{const a=window.newSnapshotCache(),b=window.newSnapshotCache(),value={notes:'private'};a.remember('report','j','c',value);value.notes='changed';const first=a.read('report','j','c');first.value.notes='changed again';return a.read('report','j','c').value.notes==='private'&&b.read('report','j','c')===null&&a.read('report','j','other')===null;}),'Snapshot copies cannot mutate cache or cross provider/customer boundaries');
 check(await page.evaluate(()=>{const a=window.newSnapshotCache();a.remember('report','j',undefined,{notes:'private'});if(a.read('report','j',undefined)!==null)return false;for(let i=0;i<101;i++)a.remember('report','j'+i,'c',{});if(a.read('report','j0','c')!==null)return false;a.remember('report','huge','c',{notes:'x'.repeat(300000)});if(a.read('report','huge','c')!==null)return false;a.revoke();a.remember('report','new','c',{});return a.read('report','j100','c')===null&&a.read('report','new','c')===null;}),'Missing identity, bounded memory and irreversible auth revocation fail closed');
 check(outside.length===0&&errors.length===0,`No outside requests/browser errors: ${errors}`);
 console.log(`PASS ${count} real-dialog offline session assertions. Verified reads only; no encrypted persistent cache, offline restart, sync or hosted/iOS acceptance claimed.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
