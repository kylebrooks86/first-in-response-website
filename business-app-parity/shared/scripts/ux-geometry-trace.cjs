/* Test-runner-only passive geometry trace. Never imported by FIRE application code.
 * Collects actual DOM states exercised by existing localhost synthetic suites.
 * Diagnostics are review candidates, not automatic UX passes or product failures.
 */
const Module=require('node:module'),fs=require('node:fs'),path=require('node:path');
if(process.env.FIRE_UX_TRACE_DIR){
 const original=Module._load,patched=new WeakSet(),contexts=new WeakSet();
 const out=path.resolve(process.env.FIRE_UX_TRACE_DIR);
 fs.mkdirSync(out,{recursive:true});
 const suite=path.basename(process.argv[1]||'browser');
 const file=path.join(out,suite+'.jsonl');
 let frames=0;
 async function instrument(context){
  if(contexts.has(context))return context;contexts.add(context);
  await context.exposeBinding('__fireSyntheticUxFrame',(_source,frame)=>{
   if(frames++<300)fs.appendFileSync(file,JSON.stringify({suite,...frame})+'\n');
  });
  await context.addInitScript(()=>{
   if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))return;
   let timer,last='',frames=0,eventAt=null;
   const capture=()=>{
    timer=null;if(frames>=120||!document.body)return;
    const rect=n=>{const r=n.getBoundingClientRect();return {x:Math.round(r.x*10)/10,y:Math.round(r.y*10)/10,width:Math.round(r.width*10)/10,height:Math.round(r.height*10)/10};};
    const controls=[];
    for(const n of document.querySelectorAll('button,input,select,textarea,a[href],summary,[role="button"],[role="combobox"],[role="dialog"]')){
     const r=rect(n),style=getComputedStyle(n);
     if(!r.width||!r.height||style.visibility==='hidden'||style.display==='none'||n.type==='hidden')continue;
     const label=n.getAttribute('aria-label')||n.labels?.[0]?.textContent||n.textContent||n.getAttribute('placeholder')||'';
     const parent=n.parentElement,p=parent?rect(parent):null;
     const scroller=[];for(let a=parent;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(/auto|scroll/.test(s.overflowX)&&a.scrollWidth>a.clientWidth+1)scroller.push(a.tagName);}
     const flags=[];
     let textContrast=null;
     if(/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)&&n.value&&!n.disabled&&!['checkbox','radio','range','color'].includes(n.type)){
      const rgb=c=>{const v=c.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').map(Number);return v&&v.length>=3&&(v.length===3||v[3]===1)?v.slice(0,3):null;};
      const fg=rgb(style.color);let bg=rgb(style.backgroundColor);
      for(let a=parent;!bg&&a;a=a.parentElement)bg=rgb(getComputedStyle(a).backgroundColor);
      if(fg&&bg){const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),a=lum(fg),b=lum(bg);textContrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(textContrast<4.5)flags.push('entered-field-contrast-review');}
     }
     if(!scroller.length&&(r.x< -1||r.x+r.width>innerWidth+1))flags.push('horizontal-viewport-review');
     if(/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)&&p&&getComputedStyle(parent).display!=='inline'&&(r.x<p.x-1||r.x+r.width>p.x+p.width+1))flags.push('field-parent-width-review');
     let target=r;
     if(['checkbox','radio'].includes(n.type)&&n.labels?.[0])target=rect(n.labels[0]);
     if(innerWidth<=430&&n.getAttribute('role')!=='dialog'&&(target.height<43||target.width<43))flags.push('mobile-touch-target-review');
     controls.push({tag:n.tagName,id:n.id||null,role:n.getAttribute('role'),label:label.replace(/\s+/g,' ').trim().slice(0,120),type:n.type||null,disabled:!!n.disabled,expanded:n.getAttribute('aria-expanded'),box:r,parent:p,textContrast,flags});
    }
    const frame={viewport:{width:innerWidth,height:innerHeight,scrollY},theme:document.documentElement.dataset.theme||'unspecified',disclosures:[...document.querySelectorAll('details')].map(n=>({label:n.querySelector('summary')?.textContent?.trim().slice(0,100),open:n.open})),controls};
    const signature=JSON.stringify(frame);if(signature===last)return;last=signature;frames++;
    frame.observedEventToSnapshotMs=eventAt===null?null:Math.round(performance.now()-eventAt);
    frame.timingScope='debounced DOM observation, not input latency or physical-device performance';
    window.__fireSyntheticUxFrame(frame).catch(()=>{});
   };
   const schedule=()=>{if(!timer)timer=setTimeout(capture,90);};
   addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
    schedule();
   },{once:true});
   for(const name of ['click','change','input','toggle','resize','scroll'])addEventListener(name,()=>{eventAt=performance.now();schedule();},{capture:true,passive:true});
  });
  return context;
 }
 function patch(browser){
  if(patched.has(browser))return browser;patched.add(browser);
  const create=browser.newContext.bind(browser);
  browser.newContext=async(...args)=>instrument(await create(...args));
  return browser;
 }
 Module._load=function(name,...args){
  const result=original.call(this,name,...args);
  if(result?.chromium&&name.includes('playwright')&&!patched.has(result.chromium)){
   const c=result.chromium;patched.add(c);
   const launch=c.launch.bind(c),persistent=c.launchPersistentContext.bind(c);
   c.launch=async(...args)=>patch(await launch(...args));
   c.launchPersistentContext=async(...args)=>instrument(await persistent(...args));
  }
  return result;
 };
}
