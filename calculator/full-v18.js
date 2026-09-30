(()=>{
  if(window.__fireV18ModuleLoader)return;
  window.__fireV18ModuleLoader=true;

  const load=src=>new Promise(resolve=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=()=>resolve({src,ok:true});
    s.onerror=()=>{console.error('FIRE v18 module failed to load:',src);resolve({src,ok:false})};
    document.head.appendChild(s);
  });

  const waitForCore=(timeout=15000)=>new Promise(resolve=>{
    const start=Date.now();
    const ready=()=>{
      const coreLoaded=!!window.__fireFullV18;
      const estimatorReady=!!document.querySelector('#priceEditor');
      const toolsReady=!!document.querySelector('#mixHistory');
      if(coreLoaded&&estimatorReady&&toolsReady){
        window.__fireV18CoreReady=true;
        window.dispatchEvent(new CustomEvent('fire-v18-core-ready'));
        resolve(true);
        return;
      }
      if(Date.now()-start>=timeout){
        console.warn('FIRE v18 core readiness timed out; continuing parity modules anyway.');
        resolve(false);
        return;
      }
      setTimeout(ready,50);
    };
    ready();
  });

  (async()=>{
    await load('./full-v18-core.js?v=2');
    await waitForCore();
    await load('./full-v18-parity-core.js?v=2');
    await load('./v18-behavior.js?v=4');
    await load('./v18-interactions.js?v=2');
    await load('./v18-fine-parity.js?v=7');
    await load('./v18-equipment-parity.js?v=1');
    await load('./v18-tools-state.js?v=1');
    await load('./v18-offline-readiness.js?v=1');
    await load('./v18-live-shell.js?v=2');
    window.dispatchEvent(new CustomEvent('fire-v18-parity-loaded'));
  })();
})();