// Local-only comparison of actual built Worker applications using disposable D1.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
assert.ok(process.argv.length===5||process.argv.length===6,'Usage: node compare QA STAGING EDGE [sealed-current-STAGING-package]');
const [qa,staging,edge,pack]=process.argv.slice(2).map(x=>resolve(x));
const report=mkdtempSync(join(tmpdir(),'FIRE-parity-report-'));
if(pack){
 const receipt=readFileSync(join(pack,'staging-noassets-dark-source-receipt.json'));
 assert.equal(createHash('sha256').update(receipt).digest('hex'),'f811cc2d7e4b1c37e21d7d28d6aba31215897ac89f5a2e756fbf9e258c1d525a','Wrong sealed deployed package receipt');
 const parsed=JSON.parse(receipt);
 for(const row of parsed.savedInventory){const b=readFileSync(join(pack,row.path));assert.equal(b.length,row.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256,'Sealed package changed')}
 assert.deepEqual(filesIn(pack).sort(),[...parsed.savedInventory.map(x=>x.path),'staging-noassets-dark-source-receipt.json'].sort());
}
function filesIn(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesIn(join(root,e.name)).map(p=>e.name+'/'+p):e.isFile()?[e.name]:['UNEXPECTED'])}
console.log('Synthetic screenshots and report: '+report);
const req=createRequire(join(qa,'package.json'));
const {chromium}=req('playwright');
const {Miniflare}=createRequire(req.resolve('wrangler/package.json'))('miniflare');
const tmp=mkdtempSync(join(tmpdir(),'fire-parity-'));
const secret=randomUUID()+randomUUID();
const workers=[];
let browser;
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
async function boot(root,isQA,packed=false){
 const config=JSON.parse(readFileSync(join(root,'dist/server/wrangler.json'),'utf8'));
 assert.equal(config.name,isQA?'fire-fullapp-qa-20261016':'fire-app-independent-staging');
 assert.equal(config.vars.FIRE_ENV,isQA?'synthetic-qa':'staging');
 assert.ok(isQA||config.vars.FIRE_STRIPE_MODE==='disabled');
 const id=randomUUID(),state=join(tmp,isQA?'qa':'staging'),dbName='fixture-'+id;
 const wrangler=req.resolve('wrangler/bin/wrangler.js');
 const fixture=join(tmp,id+'.json');
 writeFileSync(fixture,JSON.stringify({name:'fire-local-fixture',compatibility_date:'2026-05-22',d1_databases:[{binding:'DB',database_name:dbName,database_id:id,migrations_dir:join(root,'drizzle')}]}));
 const env={...process.env,CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',CI:'true'};
 for(const k of Object.keys(env))if(/^(CLOUDFLARE_API_|CF_API_|CLOUDFLARE_ACCOUNT_ID)/.test(k))delete env[k];
 const run=spawnSync(process.execPath,[wrangler,'d1','migrations','apply','DB','--local','--persist-to',state,'--config',fixture],{env,encoding:'utf8'});
 assert.equal(run.status,0,'Local disposable D1 migration failed');
 const server=packed?join(pack,'server'):join(root,'dist/server'),main=resolve(server,packed?'fire-staging-noassets-entry.mjs':config.main);
 const {unstable_getMiniflareWorkerOptions}=req('wrangler');
 const cfg=join(tmp,id+'-runtime.json');
 writeFileSync(cfg,JSON.stringify({name:'fire-local-fixture',main,compatibility_date:'2026-05-22',compatibility_flags:config.compatibility_flags,no_bundle:true,rules:config.rules,vars:packed?{...config.vars,FIRE_STAGING_PRIVATE_ACTIVATION:'owner-approved'}:config.vars,...(packed?{}:{assets:{directory:join(root,'dist/client')}}),d1_databases:[{binding:'DB',database_name:dbName,database_id:id}]}));
 const {workerOptions,externalWorkers}=unstable_getMiniflareWorkerOptions(cfg);
 const mf=new Miniflare({host:'127.0.0.1',port:0,https:true,cf:false,d1Persist:join(state,'v3','d1'),workers:[{...workerOptions,name:'fire-local-fixture',bindings:{...workerOptions.bindings,[isQA?'FIRE_QA_SESSION_SECRET':'FIRE_SESSION_SECRET']:secret},modulesRoot:server,modules:[{type:'ESModule',path:main},...files(server).filter(p=>/\.(?:js|mjs|bin)$/.test(p)&&p!==main).map(path=>({type:path.endsWith('.bin')?'Data':'ESModule',path}))]},...externalWorkers]});
 workers.push(mf);return (await mf.ready).origin;
}
const sections=[
 ['Home','Dashboard','.dashboard-view',true],
 ['Customers','Customers','.customers-view',true],
 ['Estimates','Estimates','.workspace-view',true],
 ['Schedule','Schedule','.schedule-view',true],
 ['Follow-ups','Follow-ups','.followups-view',true],
 ['Invoices','Invoices','.invoices-view',false],
 ['Payments','Payments','.payments-view',false],
 ['Business','Business','.workspace-view',false],
 ['Insights','Insights','.insights-view',false],
 ['Settings','Settings','.settings-view',false]
];
const evidence=[];
async function capture(origin,target,width,theme){
 const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},deviceScaleFactor:1,timezoneId:'America/Chicago',colorScheme:theme,serviceWorkers:'block'});
 const failures=[],errors=[],captures={};
 try{
  await ctx.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.origin!==origin)return r.abort();
   // No real weather or maps provider activity; identical unavailable weather.
   if(u.pathname.startsWith('/api/weather'))return r.fulfill({status:503,json:{error:'Synthetic comparison: weather unavailable'}});
   return r.continue();
  });
  const payload='v1.'+(Math.floor(Date.now()/1000)+600);
  await ctx.addCookies([{name:target==='QA'?'fire_qa_session':'fire_admin_session',value:payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url'),url:origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.name));
  page.on('response',r=>{if(/\/_next\/static\//.test(r.url())&&r.status()>=400)failures.push(r.status()+' '+new URL(r.url()).pathname)});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('.app-shell[data-app-ready="true"]').waitFor({timeout:30000});
  await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
  // Preserve actual QA-only synthetic banner in raw screenshot. For app
  // comparisons exclude ONLY that mandatory environment warning.
  await page.screenshot({path:join(report,target+'-'+width+'-'+theme+'-raw-home.png'),animations:'disabled',fullPage:true});
  // The sibling selector survives display:none; also remove the QA-only
  // 20px sticky-header offset for the normalized comparison (not hosted CSS).
  await page.addStyleTag({content:'.qa-test-banner{display:none!important}.qa-test-banner + .app-shell .topbar{top:0!important}'});
  for(const [id,label,selector,bottom] of sections){
   if(id!=='Home'){
    if(width<=760&&bottom)await page.locator('.bottom-nav button').filter({hasText:label}).first().click();
    else{
     if(width<=760)await page.getByRole('button',{name:'Open menu',exact:true}).click();
     if(['Business','Insights','Settings'].includes(id)){
      const group=page.locator('.sidebar details.sidebar-more-nav');
      if(!await group.evaluate(n=>n.open))await group.locator('summary').click();
     }
     await page.locator('.sidebar nav button').filter({hasText:label}).first().click();
    }
    await page.locator('.sidebar nav button[aria-current="page"]').filter({hasText:label}).waitFor({state:'attached',timeout:12000});
   }
   await page.locator(selector).first().waitFor({state:'visible',timeout:12000});
   await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});
   await page.waitForTimeout(700);
   const png=await page.screenshot({path:join(report,target+'-'+width+'-'+theme+'-'+id+'.png'),animations:'disabled',fullPage:true});
   const state=await page.evaluate(()=>({nav:[...document.querySelectorAll('.sidebar nav button')].map(n=>n.textContent.trim()),overflow:document.documentElement.scrollWidth-innerWidth,theme:document.documentElement.dataset.theme}));
   captures[id]={png,state};
  }
  evidence.push({target,width,theme,failures,errors,sections:Object.keys(captures)});
  return captures;
 }finally{await ctx.close()}
}
async function comparePixels(page,a,b){
 return page.evaluate(async({a,b})=>{
  const img=async s=>{const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();return i};
  const [x,y]=await Promise.all([img(a),img(b)]);
  const w=Math.max(x.width,y.width),h=Math.max(x.height,y.height);
  function pixels(i){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(i,0,0);return g.getImageData(0,0,w,h).data}
  const p=pixels(x),q=pixels(y);let different=0;
  for(let k=0;k<p.length;k+=4)if(p[k]!==q[k]||p[k+1]!==q[k+1]||p[k+2]!==q[k+2]||p[k+3]!==q[k+3])different++;
  return {qaSize:[x.width,x.height],otherSize:[y.width,y.height],differentPixels:different,totalPixels:w*h};
 },{a:a.toString('base64'),b:b.toString('base64')});
}
const comparisons=[];
try{
 const targets=[['QA',await boot(qa,true)],['STAGING',await boot(staging,false)]];
 if(pack)targets.push(['PACKAGED-STAGING',await boot(staging,false,true)]);
 browser=await chromium.launch({executablePath:edge,headless:true});
 const diffPage=await browser.newPage();
 for(const width of [390,1366])for(const theme of ['light','dark']){
  const sets=[];
  for(const [target,origin] of targets)sets.push(await capture(origin,target,width,theme));
  for(let i=1;i<sets.length;i++)for(const [id] of sections){
   const a=sets[0][id],b=sets[i][id],pixels=await comparePixels(diffPage,a.png,b.png);
   const row={target:targets[i][0],width,theme,section:id,...pixels,sameNavigation:JSON.stringify(a.state.nav)===JSON.stringify(b.state.nav),qaOverflow:a.state.overflow,otherOverflow:b.state.overflow};
   comparisons.push(row);
   console.log(row.target+' '+width+' '+theme+' '+id+': '+row.differentPixels+'/'+row.totalPixels+' different pixels');
  }
 }
 console.log('PIXEL_COMPARISON_COMPLETE; NO HOSTED CHANGES; REVIEW DIFFERENCES');
}finally{
 writeFileSync(join(report,'report.json'),JSON.stringify({comparisons,evidence,packagedVersionIncluded:Boolean(pack)},null,2));
 console.log('REPORT='+join(report,'report.json'));
 await browser?.close();for(const w of workers.reverse())await w.dispose();rmSync(tmp,{recursive:true,force:true})
}
