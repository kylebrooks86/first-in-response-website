(()=>{
  if(window.__fireV18LiveNavigationParity)return;window.__fireV18LiveNavigationParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const activeView=()=>$('.view.active')?.id||location.hash.replace(/^#/,'')||'mix';
  const syncJobNav=()=>{
    const jobNav=$('#topJobNav');if(!jobNav)return;
    jobNav.style.setProperty('display',activeView()==='job'?'flex':'none','important');
  };
  const ensureHeaderParity=()=>{
    let style=$('#fireLiveHeaderParityStyle');
    if(style)return;
    style=document.createElement('style');
    style.id='fireLiveHeaderParityStyle';
    style.textContent='br.fire-live-warning-break{display:none!important}@media(max-width:760px){.topbar .title strong{font-size:16px!important}.warn{padding-left:16px!important;padding-right:16px!important;font-size:13.12px!important;line-height:1.45!important;font-weight:400!important}.page{padding-bottom:0!important}br.fire-live-warning-break{display:block!important}}';
    document.head.appendChild(style);
  };
  const activate=view=>{
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===view));
    $$('.tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $$('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    try{history.replaceState(null,'','#'+view)}catch{}
    syncJobNav();
  };
  const ensure=()=>{
    ensureHeaderParity();
    const tabs=$('.tabs'),guide=$('.tabs .tab[data-view="guide"]');if(!tabs||!guide)return;
    const jobNav=$('#topJobNav'),warn=$('.warn');
    if(warn&&!warn.dataset.liveWarningWrap){warn.dataset.liveWarningWrap='1';warn.innerHTML=warn.innerHTML.replace('Use separate labeled','Use separate<br class="fire-live-warning-break">labeled')}
    if(jobNav&&warn&&jobNav.nextElementSibling!==warn)warn.parentElement?.insertBefore(jobNav,warn);
    let tools=$('.tabs .tab[data-view="tools"]');
    if(!tools){tools=document.createElement('button');tools.type='button';tools.className='tab';tools.dataset.view='tools';tools.textContent='Field Tools';tabs.insertBefore(tools,guide)}
    tools.style.setProperty('display','inline-flex','important');
    if(!tools.dataset.liveNavBound){tools.dataset.liveNavBound='1';tools.addEventListener('click',()=>activate('tools'))}
    if(!document.documentElement.dataset.liveJobNavBound){
      document.documentElement.dataset.liveJobNavBound='1';
      [tabs,$('.bottom')].filter(Boolean).forEach(host=>host.addEventListener('click',()=>setTimeout(syncJobNav,0)));
      window.addEventListener('hashchange',()=>setTimeout(syncJobNav,0));
    }
    syncJobNav();
  };
  const apply=()=>ensure();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1100));else setTimeout(apply,1100);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,40));window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,40));
})();