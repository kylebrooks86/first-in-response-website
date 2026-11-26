// Local-only comparison of actual built Worker applications using disposable D1.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [qa,staging,edge]=process.argv.slice(2).map(x=>resolve(x));
assert.ok(qa&&staging&&edge);
const req=createRequire(join(qa,'package.json'));
const {chromium}=req('playwright');
const {Miniflare}=createRequire(req.resolve('wrangler/package.json'))('miniflare');
const tmp=mkdtempSync(join(tmpdir(),'fire-parity-'));
const secret=randomUUID()+randomUUID();
const workers=[];
let browser;
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
async function boot(root,isQA){
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
 const server=join(root,'dist/server'),main=resolve(server,config.main);
 const {unstable_getMiniflareWorkerOptions}=req('wrangler');
 const cfg=join(tmp,id+'-runtime.json');
 writeFileSync(cfg,JSON.stringify({name:'fire-local-fixture',main,compatibility_date:'2026-05-22',compatibility_flags:config.compatibility_flags,no_bundle:true,rules:config.rules,vars:config.vars,assets:{directory:join(root,'dist/client')},d1_databases:[{binding:'DB',database_name:dbName,database_id:id}]}));
 const {workerOptions,externalWorkers}=unstable_getMiniflareWorkerOptions(cfg);
 const mf=new Miniflare({host:'127.0.0.1',port:0,https:true,cf:false,d1Persist:join(state,'v3','d1'),workers:[{...workerOptions,name:'fire-local-fixture',bindings:{...workerOptions.bindings,[isQA?'FIRE_QA_SESSION_SECRET':'FIRE_SESSION_SECRET']:secret},modulesRoot:server,modules:[{type:'ESModule',path:main},...files(server).filter(p=>p.endsWith('.js')&&p!==main).map(path=>({type:'ESModule',path}))]},...externalWorkers]});
 workers.push(mf);return (await mf.ready).origin;
}
try{
 const origins=[await boot(qa,true),await boot(staging,false)];
 browser=await chromium.launch({executablePath:edge,headless:true});
 for(const width of [390,1366]){
  const results=[];
  for(let i=0;i<2;i++){
   const origin=origins[i],ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:844},timezoneId:'America/Chicago',serviceWorkers:'block'});
   const failures=[],errors=[];
   await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const payload='v1.'+(Math.floor(Date.now()/1000)+600);
   await ctx.addCookies([{name:i===0?'fire_qa_session':'fire_admin_session',value:payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url'),url:origin,httpOnly:true,secure:true,sameSite:'Strict'}]);
   const page=await ctx.newPage();
   page.on('pageerror',e=>errors.push(e.name));
   page.on('response',r=>{if(/\/_next\/static\//.test(r.url())&&r.status()>=400)failures.push(r.status()+' '+new URL(r.url()).pathname)});
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.locator('.metric-card').first().waitFor({timeout:30000});
   const metrics=await page.evaluate(()=>({nav:[...document.querySelectorAll('.sidebar nav button,.bottom-nav button')].map(n=>n.textContent.trim()),cards:[...document.querySelectorAll('.metric-card')].map(n=>{const s=getComputedStyle(n);return {width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,background:s.backgroundColor,font:s.fontFamily,color:s.color}}),css:[...document.querySelectorAll('link[rel=stylesheet]')].map(n=>new URL(n.href).pathname),theme:document.documentElement.dataset.theme??null}));
   const css=[];for(const path of metrics.css){const r=await ctx.request.get(origin+path);css.push({path,status:r.status(),type:r.headers()['content-type'],sha256:sha(await r.body())})}
   results.push({target:i===0?'QA':'STAGING',metrics,css,failures,errors});
   await ctx.close();
  }
  console.log(JSON.stringify({width,results},null,2));
 }
 console.log('LOCAL_COMPARISON_COMPLETE; NO HOSTED CHANGES; REVIEW DIFFERENCES');
}finally{await browser?.close();for(const w of workers.reverse())await w.dispose();rmSync(tmp,{recursive:true,force:true})}
