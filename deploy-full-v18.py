from pathlib import Path

index = Path('calculator/index.html')
text = index.read_text()
text = text.replace('<script src="./full-v18.js"></script>','<script src="./full-v18.js?v=6"></script>')
if '<script src="./full-v18.js?v=6"></script>' not in text:
    text = text.replace('</body>','<script src="./full-v18.js?v=6"></script></body>')
index.write_text(text)

ext = Path('calculator/full-v18.js')
js = ext.read_text()
marker = '// LIVE_V18_LAYOUT_PARITY'
if marker not in js:
    js += r'''

// LIVE_V18_LAYOUT_PARITY
(()=>{
  const cardByHeading=(text)=>[...document.querySelectorAll('.card')].find(c=>[...c.querySelectorAll('h2,h3')].some(h=>h.textContent.trim()===text));
  const sec=id=>document.getElementById(id);
  const move=(heading,target,beforeHeading=null)=>{
    const card=cardByHeading(heading), targetSec=sec(target); if(!card||!targetSec)return;
    if(beforeHeading){const before=cardByHeading(beforeHeading);if(before&&before.parentElement===targetSec){targetSec.insertBefore(card,before);return;}}
    targetSec.appendChild(card);
  };
  move('Mix the X-Jet pickup bucket for a target strength','equipment','X-Jet bucket draw test');
  move('Find your real injector ratio','equipment','Three-port proportioner planner');
  move('Fill-time estimate','equipment');
  move('Stain & Surface Finder','tools','Batch History / Mix Log');
  move('Chemical Compatibility Checker','tools','Batch History / Mix Log');
  move('Batch History / Mix Log','tools','Chemical Inventory');
  move('Chemical Inventory','tools','Application Timer');
  move('Application Timer','tools','Weather Adjustment Guide');
  move('Weather Adjustment Guide','tools','Custom Chemical Builder');
  move('Custom Chemical Builder','tools','Version and offline update');
  move('Version and offline update','tools','Backup or Restore Field Data');
  move('Backup or Restore Field Data','tools');
  move('Field Safety Card','tools');
  const oldEstimate=cardByHeading('Price the whole job');
  const fullEstimate=cardByHeading('Full FIRE service estimator');
  if(oldEstimate&&fullEstimate&&oldEstimate!==fullEstimate) oldEstimate.remove();
  if(fullEstimate){const h=fullEstimate.querySelector('h2');if(h)h.textContent='Price the whole job';}
  move('Area and real coverage helpers','job','Know your cost per batch');
  move('Know your cost per batch','job','Price the whole job');
  move('Price the whole job','job','Job loadout and profitability');
  move('Job loadout and profitability','job');
  const recipe=cardByHeading('4-gallon moderate house wash');
  if(recipe && ![...recipe.querySelectorAll('h2')].some(h=>h.textContent.includes('Stock-strength correction'))){
    const stockInput=document.getElementById('stockStrength');
    const grid=stockInput?.closest('.grid');
    if(grid){const h=document.createElement('h2');h.textContent='🧪 Stock-strength correction';h.style.gridColumn='1/-1';h.style.margin='6px 0 0';grid.parentElement.insertBefore(h,grid);}
  }
})();
'''

preset_marker = '// LIVE_V18_GUIDE_PRESETS'
if preset_marker not in js:
    js += r'''

// LIVE_V18_GUIDE_PRESETS
(()=>{
  const guide=document.getElementById('guide');
  if(!guide)return;
  const findCard=(heading)=>[...guide.querySelectorAll('.card')].find(c=>[...c.querySelectorAll('h2,h3')].some(h=>h.textContent.trim()===heading));
  let presets=findCard('10% SH service presets');
  if(!presets){
    presets=document.createElement('div');
    presets.className='card';
    presets.innerHTML=`<div class="kicker">Starting-strength guide</div><h2>10% SH service presets</h2><p class="muted">Starting points for 10% stock SH. Test the actual surface, start weaker when uncertain, and follow the current product label/SDS.</p><table class="rate-table"><thead><tr><th>Surface</th><th>Light</th><th>Moderate</th><th>Heavy</th></tr></thead><tbody><tr><td>House wash</td><td>0.5%</td><td>1.0%</td><td>1.5%</td></tr><tr><td>Asphalt-shingle roof</td><td>2.0%</td><td>3.0%</td><td>4.0%</td></tr><tr><td>Fence / siding organics</td><td>0.5%</td><td>1.0%</td><td>1.5%</td></tr><tr><td>Concrete pre-treatment</td><td>1.5%</td><td>2.0%</td><td>3.0%</td></tr></tbody></table>`;
  }
  const noSH=findCard('Services that should not default to SH');
  const safety=findCard('Quick safety order');
  if(noSH) guide.insertBefore(presets,noSH); else guide.insertBefore(presets,guide.firstChild);
  if(noSH && safety) guide.insertBefore(noSH,safety);
  if(safety) guide.appendChild(safety);
})();
'''
    ext.write_text(js)

Path('calculator/sw.js').write_text(r'''const CACHE='fire-field-calculator-v18-full-6';
const ASSETS=['./','./index.html','./manifest.webmanifest','./full-v18.js?v=6'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fire-field-calculator-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res&&res.status===200){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)))});
''')
print('Forced latest full v18 parity script and refreshed cache')
