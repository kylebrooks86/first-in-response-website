/** Source-owned compiled CSS geometry smoke test for FIRE job/estimate controls.
 * Isolated synthetic HTML + localhost + Chrome; no customer records, tokens,
 * remote page access, cloud account writes, or QA deployment.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind=require('@tailwindcss/postcss');
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd();
const css=(await postcss([tailwind({base:root})]).process(
  readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')}
)).css;
const icon='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h16" stroke="currentColor" stroke-width="2"/></svg>';
const action=(tag,label)=>'<'+tag+(tag==='a'?' href="#no-navigation"':' type="button"')+'>'+icon+label+'</'+tag+'>';
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>'+
  '<div class="app-shell"><section class="estimate-detail" style="max-width:900px;width:100%;margin:auto;padding:12px">'+
  '<div class="detail-actions">'+
  action('a','Customer view')+action('button','Edit estimate')+
  action('button','Send invoice')+action('button','Request review')+
  action('button','Call')+action('button','Text')+
  '<details open class="customer-contact-backups"><summary>Personal phone backups</summary><div class="contact-backup-actions">'+
  action('button','Call (Backup)')+action('button','Text (Backup)')+'</div></details>'+
  '<div class="detail-context-tools"><strong>Job tools</strong><div class="detail-context-buttons">'+
  action('button','Job report')+action('button','Job costs')+'</div></div>'+
  action('a','View invoice')+'</div></section></div></body></html>';
const server=createServer((req,res)=>{
  if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);return;}
  res.setHeader('content-type','text/html; charset=utf-8');res.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const widths=[320,350,375,390,430,667,760,768,820,1024,1366];
let browser,checks=0;
const check=(value,why)=>{assert.ok(value,'FIRE owner action visual contract: '+why);checks++;};
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  page.setDefaultTimeout(6000);
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  for(const width of widths)for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:width===667?375:860});
    await page.goto(origin);
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    const geometry=await page.evaluate(()=>{
      const measure=selector=>[...document.querySelectorAll(selector)].map(el=>{
        const box=el.getBoundingClientRect(),svg=el.querySelector('svg')?.getBoundingClientRect();
        return {width:box.width,height:box.height,left:box.left,right:box.right,
          scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
          iconWidth:svg?.width??0,iconHeight:svg?.height??0};
      });
      return {
        main:measure('.estimate-detail .detail-actions > a, .estimate-detail .detail-actions > button'),
        backup:measure('.estimate-detail .contact-backup-actions > button'),
        jobs:measure('.estimate-detail .detail-context-buttons > button'),
        pageWidth:document.documentElement.scrollWidth
      };
    });
    const controls=[...geometry.main,...geometry.backup,...geometry.jobs];
    check(controls.length===11,'All 11 action controls present at '+width+'/'+theme);
    check(controls.every(x=>x.height>=47&&x.iconWidth>=15&&x.iconWidth<=17&&x.iconHeight>=15&&x.iconHeight<=17),
      'All control targets at least 48px with consistent 16px icons at '+width+'/'+theme+JSON.stringify(controls));
    check(controls.every(x=>x.right<=width+1&&x.left>=-1&&x.scrollWidth<=x.clientWidth+1)&&geometry.pageWidth<=width+1,
      'Action controls stay within viewport without horizontal clipping at '+width+'/'+theme+JSON.stringify(geometry));
    check(geometry.main.every(x=>Math.abs(x.height-geometry.main[0].height)<=1),
      'Primary job-detail controls have uniform heights at '+width+'/'+theme);
    check(geometry.backup.length===2&&Math.abs(geometry.backup[0].height-geometry.backup[1].height)<=1&&
      geometry.jobs.length===2&&Math.abs(geometry.jobs[0].height-geometry.jobs[1].height)<=1,
      'Backup and job tool groups match their sibling control heights at '+width+'/'+theme);
    const cols=width<=350?1:width<=980?2:4;
    const columnCount=await page.locator('.estimate-detail .detail-actions').evaluate(el=>
      getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    check(columnCount===cols,'Expected '+cols+' responsive owner action columns at '+width+'/'+theme);
  }
  check(errors.length===0,'No browser runtime errors');
  check(external.length===0,'All requests isolated to localhost');
  console.log('PASS '+checks+'/'+checks+' compiled CSS FIRE owner-job action geometry checks');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
