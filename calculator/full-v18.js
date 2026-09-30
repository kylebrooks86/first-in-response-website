(()=>{
  if(window.__fireV18ModuleLoader)return;
  window.__fireV18ModuleLoader=true;
  if(!document.querySelector('link[data-fire-exact-visual]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./v18-exact-visual.css?v=2';l.dataset.fireExactVisual='1';document.head.appendChild(l)}
  const load=src=>new Promise(resolve=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve(true);s.onerror=()=>{console.error('FIRE v18 module failed to load:',src);resolve(false)};document.head.appendChild(s)});
  const waitForCore=(timeout=15000)=>new Promise(resolve=>{const start=Date.now();const check=()=>{const ready=!!window.__fireFullV18&&!!document.querySelector('#priceEditor')&&!!document.querySelector('#mixHistory');if(ready){window.__fireV18CoreReady=true;window.dispatchEvent(new CustomEvent('fire-v18-core-ready'));return resolve(true)}if(Date.now()-start>=timeout){console.warn('FIRE v18 core readiness timed out; continuing shared modules for audit visibility.');return resolve(false)}setTimeout(check,50)};check()});
  (async()=>{
    await load('./full-v18-core.js?v=1');
    await waitForCore();
    await load('./full-v18-parity-core.js?v=1');
    await load('./v18-behavior.js?v=4');
    await load('./v18-interactions.js?v=2');
    await load('./v18-fine-parity.js?v=7');
    await load('./v18-equipment-parity.js?v=1');
    await load('./v18-tools-state.js?v=1');
    await load('./v18-live-estimator-parity.js?v=1');
    await load('./v18-live-first-screen.js?v=1');
    window.dispatchEvent(new CustomEvent('fire-v18-parity-loaded'));
    window.dispatchEvent(new CustomEvent('fire-v18-shared-core-ready'));
  })();
})();