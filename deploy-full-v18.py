from pathlib import Path

index = Path('calculator/index.html')
text = index.read_text()
script_tag = '<script src="./full-v18.js"></script>'
if script_tag not in text:
    text = text.replace('</body>', script_tag + '</body>')
    index.write_text(text)

Path('calculator/sw.js').write_text(r'''const CACHE='fire-field-calculator-v18-full-3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./full-v18.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fire-field-calculator-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res&&res.status===200){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)))});
''')
print('Linked full-v18.js directly from calculator/index.html and refreshed offline cache')
