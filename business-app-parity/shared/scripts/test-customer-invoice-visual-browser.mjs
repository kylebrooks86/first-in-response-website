/** Source-owned compiled CSS geometry smoke test for FIRE customer contact and invoice controls.
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
const dashboardSource=readFileSync('app/dashboard.tsx','utf8');
assert.ok(dashboardSource.includes('<InvoiceStatusIndicator invoice={invoice}/>'),'Invoice list uses truthful, icon-labelled source status');
assert.ok(dashboardSource.includes('<AgreementStatusIndicators estimate={estimate}/>'),'Agreements source keeps signing and change requests separate');

const css=(await postcss([tailwind({base:root})]).process(
  readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')}
)).css;
const icon='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h16" stroke="currentColor" stroke-width="2"/></svg>';
const action=(tag,label)=>'<'+tag+(tag==='a'?' href="#no-navigation"':' type="button"')+'>'+icon+label+'</'+tag+'>';
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>'+
  '<div class="app-shell"><section class="customer-profile" style="max-width:900px;width:100%;margin:auto;padding:12px">'+
  '<div class="customer-contact">'+
  action('button','Call')+action('button','Text')+action('button','Email')+
  action('a','Google Maps')+action('button','Territory')+
  '<details open class="customer-contact-backups"><summary>Personal phone backups</summary><div class="contact-backup-actions">'+
  action('button','Call (Backup)')+action('button','Text (Backup)')+'</div></details>'+
  '<details class="customer-property-links"><summary>Property links</summary></details>'+
  '</div></section><article class="invoice-card" style="max-width:700px;width:100%;margin:auto;padding:12px">'+
  '<span class="invoice-icon">'+icon+'</span><div><strong>Customer / invoice</strong><small>Service record</small></div>'+
  '<span class="status-chip invoice-status-indicator review">'+icon+'Payment review</span><div class="invoice-total"><strong>$120.00</strong></div>'+
  '<div class="invoice-actions">'+action('a','Open invoice')+action('button','Record payment')+'</div></article>'+
  '<section class="contract-list" style="max-width:700px;width:100%;margin:12px auto"><button type="button">'+
  '<span class="contract-state signed">'+icon+'</span><span><strong>Signed synthetic agreement</strong><small>Service</small></span>'+
  '<span class="agreement-status-indicators"><span class="status-chip agreement-status-chip signed">'+icon+'Signed</span>'+
  '<span class="status-chip agreement-status-chip changes">'+icon+'Changes requested</span></span>'+icon+'</button></section></div></body></html>';
const server=createServer((req,res)=>{
  if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);return;}
  res.setHeader('content-type','text/html; charset=utf-8');res.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const widths=[320,350,375,390,430,667,760,768,820,1024,1366];
let browser,checks=0;
const check=(value,why)=>{assert.ok(value,'FIRE customer/invoice visual contract: '+why);checks++;};
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
        contact:measure('.customer-profile .customer-contact > a, .customer-profile .customer-contact > button'),
        backup:measure('.customer-profile .contact-backup-actions > button'),
        invoices:measure('.invoice-card .invoice-actions > a, .invoice-card .invoice-actions > button'),
        statuses:measure('.invoice-status-indicator,.agreement-status-indicators .status-chip'),
        agreementRow:measure('.contract-list > button'),
        agreementLabels:document.querySelector('.agreement-status-indicators')?.textContent,
        statusVisible:[...document.querySelectorAll('.invoice-status-indicator,.agreement-status-indicators .status-chip')].map(el=>getComputedStyle(el).display!=='none'),
        pageWidth:document.documentElement.scrollWidth
      };
    });
    const controls=[...geometry.contact,...geometry.backup,...geometry.invoices];
    check(geometry.statuses.length===3&&geometry.statusVisible.every(Boolean),
      'Invoice and two agreement facts have visible status icons/text at '+width+'/'+theme);
    check(geometry.statuses.every(s=>s.iconWidth>=13&&s.iconHeight>=13&&s.height>10&&s.left>=-1&&s.right<=width+1),
      'Invoice and agreement status pills have visible icons without clipping '+width+'/'+theme+JSON.stringify(geometry.statuses));
    check(geometry.agreementLabels?.includes('Signed')&&geometry.agreementLabels?.includes('Changes requested'),
      'Signed document and unresolved changes remain two separate facts '+width+'/'+theme);
    check(controls.length===9,'All 9 customer/contact/invoice action controls present at '+width+'/'+theme);
    check(controls.every(x=>x.height>=47&&x.iconWidth>=15&&x.iconWidth<=17&&x.iconHeight>=15&&x.iconHeight<=17),
      'Contact/invoice control targets are 48px with 16px icons at '+width+'/'+theme+JSON.stringify(controls));
    check(controls.every(x=>x.right<=width+1&&x.left>=-1&&x.scrollWidth<=x.clientWidth+1)&&geometry.pageWidth<=width+1,
      'Contact and invoice controls stay inside viewport without horizontal clipping at '+width+'/'+theme+JSON.stringify(geometry));
    check(geometry.contact.every(x=>Math.abs(x.height-geometry.contact[0].height)<=1),
      'Customer profile direct actions have uniform height at '+width+'/'+theme);
    check(geometry.backup.length===2&&Math.abs(geometry.backup[0].height-geometry.backup[1].height)<=1&&
      geometry.invoices.length===2&&Math.abs(geometry.invoices[0].height-geometry.invoices[1].height)<=1,
      'Phone backup and invoice action pairs match sibling heights at '+width+'/'+theme+JSON.stringify({backup:geometry.backup,invoices:geometry.invoices}));
    const cols=width<=350?1:width<=980?2:4;
    const columnCount=await page.locator('.customer-profile .customer-contact').evaluate(el=>
      getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    check(columnCount===cols,'Customer contact grid uses '+cols+' columns at '+width+'/'+theme);
  }
  check(errors.length===0,'No browser runtime errors');
  check(external.length===0,'All requests isolated to localhost');
  console.log('PASS '+checks+'/'+checks+' compiled CSS FIRE customer/invoice action geometry checks');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
