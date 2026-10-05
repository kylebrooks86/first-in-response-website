(()=>{
  if(window.__fireV18LiveNavigationParity)return;window.__fireV18LiveNavigationParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const activate=view=>{
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===view));
    $$('.tabs .tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $$('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    try{history.replaceState(null,'','#'+view)}catch{}
  };
  const ensure=()=>{
    const tabs=$('.tabs'),guide=$('.tabs .tab[data-view="guide"]');if(!tabs||!guide)return;
    const jobNav=$('#topJobNav'),warn=$('.warn');
    if(jobNav&&warn&&jobNav.nextElementSibling!==warn)warn.parentElement?.insertBefore(jobNav,warn);
    let tools=$('.tabs .tab[data-view="tools"]');
    if(!tools){tools=document.createElement('button');tools.type='button';tools.className='tab';tools.dataset.view='tools';tools.textContent='Field Tools';tabs.insertBefore(tools,guide)}
    tools.style.setProperty('display','inline-flex','important');
    if(!tools.dataset.liveNavBound){tools.dataset.liveNavBound='1';tools.addEventListener('click',()=>activate('tools'))}
  };
  const apply=()=>ensure();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1100));else setTimeout(apply,1100);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,40));window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,40));
})();