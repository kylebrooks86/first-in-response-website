(()=>{
  if(window.__fireV18LiveNavigationParity)return;window.__fireV18LiveNavigationParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const apply=()=>{
    const tools=$('.tabs .tab[data-view="tools"]');
    if(tools)tools.remove();
    const order=['mix','equipment','chemicals','index','job','guide'];
    const tabs=$('.tabs');if(!tabs)return;
    order.forEach(view=>{const tab=$(`.tabs .tab[data-view="${view}"]`);if(tab)tabs.appendChild(tab)});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));else setTimeout(apply,0);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,0));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,0));
})();