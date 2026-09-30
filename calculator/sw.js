const CACHE='fire-field-calculator-v18-full-28';
const ASSETS=['./','./index.html','./manifest.webmanifest','./full-v18.js?v=6','./full-v18-parity-core.js?v=2','./full-v18-core.js?v=2','./v18-behavior.js?v=4','./v18-interactions.js?v=2','./v18-fine-parity.js?v=7','./v18-equipment-parity.js?v=1','./v18-tools-state.js?v=1','./v18-offline-readiness.js?v=1','./v18-live-shell.js?v=2'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fire-field-calculator-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const fresh=await fetch(e.request,{cache:'no-store'});
      if(fresh&&fresh.status===200)cache.put(e.request,fresh.clone());
      return fresh;
    }catch(err){
      const hit=await caches.match(e.request);
      if(hit)return hit;
      if(e.request.mode==='navigate')return caches.match('./index.html');
      throw err;
    }
  })());
});