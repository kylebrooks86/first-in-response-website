/** Localhost-only browser geometry regression for FIRE Edit Estimate. No owner data or deployment.
 *  Uses the existing shared CSS and models the Radix dialog's fixed 50%/negative-50% centering.
 *  Chromium is NOT an iPhone Safari acceptance test.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.FIRE_BROWSER_TEST_PLAYWRIGHT_MODULE||'playwright');
const css=readFileSync('app/globals.css','utf8').replace(/^@import[^;]+;/gm,'');
const radix=readFileSync('components/ui/dialog.tsx','utf8');
assert.ok(radix.includes('top-[50%] left-[50%]'),'Base Radix modal has 50% anchors');
assert.ok(radix.includes('translate-x-[-50%] translate-y-[-50%]'),'Base Radix modal is translated to center');
const fields=Array.from({length:16},(_,i)=>'<section class="estimate-edit-service"><strong>Service '+(i+1)+'</strong><label>Description<textarea rows="7">Removal and cleaning, including inaccessible areas only when separately listed.</textarea></label><label>Quantity<input value="100"></label><label>Rate<input value="2"></label></section>').join('');
const baseCss='html,body{margin:0} [data-slot="dialog-content"]{position:fixed;top:50%;left:50%;z-index:50;display:grid;gap:16px;width:100%;max-width:650px;translate:-50% -50%;padding:24px;border:1px solid #999;background:#101b2a} [data-slot="dialog-close"]{position:absolute;top:16px;right:16px}';
const html='<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<style>'+baseCss+'</style><style>'+css+'</style>'+
 '<main><h1>FIRE Synthetic Editor Layout Test</h1></main>'+
 '<div data-slot="dialog-content" role="dialog" aria-label="Edit estimate" class="estimate-edit-dialog">'+
 '<div class="estimate-edit-modal-header"><h2>Edit estimate</h2></div>'+
 '<div class="estimate-edit-scroll-area" role="region" aria-label="Estimate services and pricing" tabindex="0"><div class="estimate-edit-items">'+fields+'</div></div>'+
 '<div class="estimate-edit-modal-footer"><button id="save-estimate" class="brand-button" type="button">Save estimate changes</button></div>'+
 '<button type="button" data-slot="dialog-close" id="close-estimate">Close</button></div>';
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;let checks=0;
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.FIRE_BROWSER_TEST_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin='http://127.0.0.1:'+server.address().port;
 await page.goto(origin);
 for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[760,900],[768,1024],[1024,800],[667,375]]) {
   await page.setViewportSize({width,height});
   const g=await page.evaluate(()=>{
     const d=document.querySelector('.estimate-edit-dialog');
     const s=document.querySelector('.estimate-edit-scroll-area');
     const c=document.querySelector('#close-estimate');
     const f=document.querySelector('#save-estimate');
     const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
     return {modal:rect(d),close:rect(c),save:rect(f),scroll:rect(s),scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,modalTranslate:getComputedStyle(d).translate};
   });
   const inside=r=>r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=height+1;
   assert.ok(inside(g.modal),String(width)+'x'+height+' dialog must not be clipped: '+JSON.stringify(g));
   assert.ok(inside(g.close),String(width)+'x'+height+' close button must remain reachable');
   assert.ok(inside(g.save),String(width)+'x'+height+' save button must remain reachable');
   assert.ok(g.scrollHeight>g.clientHeight,String(width)+'x'+height+' editor must have internal vertical scrolling');
   const scrolled=await page.evaluate(()=>{
     const s=document.querySelector('.estimate-edit-scroll-area');s.scrollTop=s.scrollHeight;return s.scrollTop;
   });
   assert.ok(scrolled>100,String(width)+'x'+height+' scroll must reach the end of estimate fields');
   assert.ok(inside(g.save)&&inside(g.close),'Save/close must remain visible after middle form scroll');
   checks+=5;
 }
 assert.deepEqual(errors,[],'Browser runtime errors must be absent');
 console.log('PASS '+checks+' Chromium CSS geometry assertions: mobile portrait/landscape, tablet, desktop; centered modal, close, save, scroll. Synthetic localhost only. Actual iOS Safari still requires owner acceptance.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
