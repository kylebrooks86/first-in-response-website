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
    const tabs=$('.tabs');if(!tabs)return;
    const jobNav=$('#topJobNav'),warn=$('.warn');
    if(jobNav&&warn&&jobNav.nextElementSibling!==warn)warn.parentElement?.insertBefore(jobNav,warn);

    // LIVE baseline: Field Tools is not a top tab. It is reached from the
    // bottom Tools control only. Remove any older DR/parity-injected top-tab
    // copy so the top navigation remains SH Mix, Equipment, Chemicals,
    // Chemical Index, Job Math, Field Guide.
    $$('.tabs .tab[data-view="tools"]',tabs).forEach(b=>b.remove());
  };
  const apply=()=>ensure();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1100));else setTimeout(apply,1100);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,40));window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,40));
})();