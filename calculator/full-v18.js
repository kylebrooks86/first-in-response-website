(()=>{
  if(window.__fireV18ModuleLoader)return;
  window.__fireV18ModuleLoader=true;
  const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  const waitForCore=(timeout=5000)=>new Promise((resolve,reject)=>{
    const start=Date.now();
    const ready=()=>{
      const coreLoaded=!!window.__fireFullV18;
      const estimatorReady=!!document.querySelector('#priceEditor');
      const toolsReady=!!document.querySelector('#mixHistory');
      if(coreLoaded&&estimatorReady&&toolsReady){window.__fireV18CoreReady=true;window.dispatchEvent(new CustomEvent('fire-v18-core-ready'));resolve();return}
      if(Date.now()-start>=timeout){reject(new Error('FIRE v18 core UI did not become ready in time'));return}
      setTimeout(ready,50);
    };
    ready();
  });
  load('./full-v18-parity-core.js?v=1')
    .then(()=>waitForCore())
    .then(()=>load('./v18-behavior.js?v=4'))
    .then(()=>load('./v18-interactions.js?v=2'))
    .then(()=>load('./v18-fine-parity.js?v=7'))
    .then(()=>load('./v18-equipment-parity.js?v=1'))
    .then(()=>load('./v18-tools-state.js?v=1'))
    .catch(err=>console.error('FIRE v18 offline modules failed to load',err));
})();