const CACHE='fire-field-calculator-v18-best-of-both-212';
const ASSETS=[
  './index.html',
  './manifest.webmanifest',
  '../assets/recent-work/fire-logo-direct.png',
  './full-v18.js?v=72',
  './full-v18-core.js?v=8',
  './v18-legacy-job-detach.js?v=2',
  './full-v18-parity-core.js?v=9',
  './v18-behavior.js?v=8',
  './v18-interactions.js?v=21',
  './v18-fine-parity.js?v=13',
  './v18-equipment-parity.js?v=4',
  './v18-live-equipment-structure-parity.js?v=4',
  './v18-tools-state.js?v=2',
  './v18-exact-visual.css?v=6',
  './v18-live-jobmath-visual.css?v=2',
  './v18-live-equipment-visual.css?v=5',
  './v18-live-chemicals-parity.css?v=7',
  './v18-live-index-parity.css?v=1',
  './v18-live-guide-parity.css?v=3',
  './v18-live-tools-parity.css?v=3',
  './v18-live-tools-fine.css?v=2',
  './v18-live-pricing-parity.css?v=1',
  './v18-live-foundation.css?v=9',
  './v18-live-final-overrides.css?v=1',
  './best-of-both.css?v=25',
  './v18-live-estimator-parity.js?v=8',
  './v18-live-first-screen.js?v=6',
  './v18-live-jobmath-parity.js?v=6',
  './v18-live-jobmix-parity.js?v=1',
  './v18-live-planning-state.js?v=5',
  './v18-live-chemicals-parity.js?v=3',
  './v18-live-index-parity.js?v=2',
  './v18-live-guide-parity.js?v=4',
  './v18-live-navigation-parity.js?v=6',
  './v18-live-tools-parity.js?v=16',
  './v18-live-tools-options-parity.js?v=2',
  './v18-live-tools-fine.js?v=2',
  './v18-live-pricing-parity.js?v=2',
  './v18-live-customer-parity.js?v=15',
  './v18-live-backup-hydration.js?v=12',
  './v18-live-invalid-backup-parity.js?v=2',
  './v18-live-portable-backup.js?v=5',
  './v18-live-input-contract.js?v=9',
  './best-of-both.js?v=37'
];
// Safari rejects redirected Response objects returned by a service worker during navigation.
// Reconstruct successful responses so cached navigation documents have no redirect chain.
const cleanResponse=async response=>{
  if(!response||!response.ok)return response;
  if(!response.redirected&&response.type!=='opaqueredirect')return response;
  return new Response(await response.blob(),{status:200,headers:response.headers});
};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(ASSETS.map(async url=>{
    const response=await cleanResponse(await fetch(url,{cache:'reload'}));
    if(!response||!response.ok)throw new Error('Failed to cache '+url);
    await cache.put(url,response);
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('fire-field-calculator-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cleanResponse(cached);
    try{
      const response=await cleanResponse(await fetch(event.request));
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        event.waitUntil(cache.put(event.request,response.clone()));
      }
      return response;
    }catch(error){
      if(event.request.mode==='navigate'){
        const fallback=await caches.match('./index.html');
        if(fallback)return cleanResponse(fallback);
      }
      throw error;
    }
  })());
});
