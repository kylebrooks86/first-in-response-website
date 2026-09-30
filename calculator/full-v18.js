(()=>{
  if(window.__fireV18ModuleLoader)return;
  window.__fireV18ModuleLoader=true;
  const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  load('./full-v18-parity-core.js?v=1')
    .then(()=>load('./v18-behavior.js?v=4'))
    .then(()=>load('./v18-interactions.js?v=2'))
    .then(()=>load('./v18-fine-parity.js?v=7'))
    .then(()=>load('./v18-equipment-parity.js?v=1'))
    .catch(()=>console.error('FIRE v18 offline modules failed to load'));
})();