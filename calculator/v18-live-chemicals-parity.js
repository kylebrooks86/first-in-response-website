(()=>{
  if(window.__fireV18LiveChemicalsParity)return;window.__fireV18LiveChemicalsParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const products=[
    {id:'ettore',icon:'🪟',name:'Ettore Squeegee-Off',purpose:'Window cleaning',eyebrow:'WINDOW CLEANING',verified:true},
    {id:'dawn',icon:'💧',name:'Dawn dish soap',purpose:'Grease-cutting soap'},
    {id:'ele',icon:'🍋',name:'Elemonator',purpose:'Bleach-stable surfactant'},
    {id:'simplegreen',icon:'🟢',name:'Simple Green Pro HD',purpose:'Cleaner / degreaser'},
    {id:'krud',icon:'🧽',name:'Krud Kutter Original',purpose:'Cleaner / degreaser'},
    {id:'awesome',icon:'✨',name:'LA’s Totally Awesome',purpose:''},
    {id:'f9',icon:'🧱',name:'F9 BARC',purpose:'Rust / battery / fertilizer stain'},
    {id:'gutterzap',icon:'🏠',name:'Gutter Zap — Black Streak Gutter Cleaner',purpose:'Gutter stain / tiger-stripe remover'},
    {id:'bioclean',icon:'💎',name:'Bio-Clean Hard Water Stain Remover',purpose:'Ready-to-use mineral-deposit paste'},
    {id:'odoban',icon:'🌬️',name:'OdoBan Disinfectant and Odor Eliminator',purpose:'Odor eliminator / hard-surface disinfectant'}
  ];
  const galFrom=(n,u)=>u==='floz'?n/128:u==='quart'?n/4:u==='liter'?n/3.78541:n;
  const amountFromGal=(g,u)=>u==='floz'?g*128:u==='quart'?g*4:u==='liter'?g*3.78541:g;
  const presetOptions='<option value="1">1 gallon</option><option value="2" selected>2 gallons</option><option value="4">4 gallons</option><option value="5">5 gallons</option><option value="custom">Custom amount</option>';
  const unitOptions='<option value="gal">gal</option><option value="floz">fl oz</option><option value="quart">quart</option><option value="liter">liter</option>';
  const browserHtml=()=>`<div class="card fire-chem-browser"><div class="kicker">Separate sprayers only</div><h2>Select a product</h2><div class="fire-chem-list">${products.map((p,i)=>`<button class="fire-chem-product${i===0?' active':''}" type="button" data-fire-chem="${p.id}"><span class="fire-chem-icon">${p.icon}</span><span class="fire-chem-copy"><strong>${p.name}</strong>${p.purpose?`<small>${p.purpose}</small>`:''}</span><span class="fire-chem-arrow">›</span></button>`).join('')}</div></div>`;
  const detailHtml=()=>`<div class="card fire-chem-detail" id="fireChemDetail"><div class="kicker" id="fireChemEyebrow">WINDOW CLEANING</div><h2 id="fireChemTitle">Ettore Squeegee-Off</h2><div id="fireChemVerified"><div class="field"><label>Container preset</label><select id="fireChemPreset">${presetOptions}</select></div><div class="field" style="margin-top:12px"><label>Final amount</label><div class="inputrow"><input id="fireChemAmount" type="number" min="0.01" step="0.01" value="2"><select id="fireChemUnit" style="flex:0 0 86px">${unitOptions}</select></div></div><div class="field" style="margin-top:12px"><label>Dilution / dose</label><select id="fireChemRate"><option value="1" selected>Light — 1 oz/gal</option><option value="1.5">Standard — 1.5 oz/gal</option><option value="2">Heavy — 2 oz/gal</option></select></div><div class="metrics fire-chem-metrics"><div class="metric"><small>Ettore Squeegee-Off</small><strong id="fireChemProductOz">2.00 fl oz</strong><em id="fireChemProductGal">0.0156 gal</em></div><div class="metric"><small>Water</small><strong id="fireChemWaterGal">1.98 gal</strong><em id="fireChemWaterOz">254.0 fl oz</em></div></div><div class="fire-chem-warning">Use in a clean window bucket. Keep separate from SH and other chemicals.</div><p class="muted fire-chem-range">Official range: 1–2 fl oz per gallon of water. Squeegee before the solution dries.</p></div><div id="fireChemUnverified" class="hidden"><div class="fire-chem-warning">Use the current product label and SDS for dilution, surface compatibility, PPE, dwell time, and rinsing. No unverified dose is calculated here.</div></div></div>`;
  const setupBrowser=()=>{
    const section=$('#chemicals');if(!section||$('.fire-chem-browser',section))return;
    const oldFirst=$(':scope > .card:first-child',section);if(oldFirst)oldFirst.classList.add('legacy-chem-ui');
    oldFirst?.insertAdjacentHTML('beforebegin',browserHtml()+detailHtml());
    $$('.fire-chem-product',section).forEach(b=>b.addEventListener('click',()=>selectProduct(b.dataset.fireChem)));
    ['fireChemPreset','fireChemAmount','fireChemUnit','fireChemRate'].forEach(id=>$('#'+id)?.addEventListener('input',calcEttore));
    $('#fireChemPreset')?.addEventListener('change',()=>{const p=$('#fireChemPreset'),a=$('#fireChemAmount'),u=$('#fireChemUnit');if(p.value!=='custom'){u.value='gal';a.value=p.value;calcEttore()}});
    $('#fireChemUnit')?.addEventListener('change',()=>{const p=$('#fireChemPreset');if(p)p.value='custom';calcEttore()});
    $('#fireChemAmount')?.addEventListener('input',()=>{const p=$('#fireChemPreset');if(p)p.value='custom';calcEttore()});
    enhanceCustomDilution();calcEttore();
  };
  const selectProduct=id=>{
    const p=products.find(x=>x.id===id)||products[0];
    $$('.fire-chem-product').forEach(b=>b.classList.toggle('active',b.dataset.fireChem===p.id));
    $('#fireChemEyebrow').textContent=p.eyebrow||p.purpose.toUpperCase()||'PRODUCT DETAILS';
    $('#fireChemTitle').textContent=p.name;
    $('#fireChemVerified').classList.toggle('hidden',!p.verified);
    $('#fireChemUnverified').classList.toggle('hidden',!!p.verified);
  };
  const calcEttore=()=>{
    const n=Math.max(.01,parseFloat($('#fireChemAmount')?.value)||0),u=$('#fireChemUnit')?.value||'gal',gal=galFrom(n,u),rate=Math.max(0,parseFloat($('#fireChemRate')?.value)||0),productOz=gal*rate,waterGal=Math.max(0,gal-productOz/128);
    if($('#fireChemProductOz'))$('#fireChemProductOz').textContent=productOz.toFixed(2)+' fl oz';
    if($('#fireChemProductGal'))$('#fireChemProductGal').textContent=(productOz/128).toFixed(4)+' gal';
    if($('#fireChemWaterGal'))$('#fireChemWaterGal').textContent=waterGal.toFixed(2)+' gal';
    if($('#fireChemWaterOz'))$('#fireChemWaterOz').textContent=(waterGal*128).toFixed(1)+' fl oz';
  };
  const enhanceCustomDilution=()=>{
    const card=$$('#chemicals .card').find(c=>c.querySelector('h2')?.textContent.trim()==='Custom dilution calculator');if(!card||$('#fireDilPreset'))return;
    const grid=$('.grid',card),final=$('#dilFinal');if(!grid||!final)return;
    const field=final.closest('.field');
    const preset=document.createElement('div');preset.className='field span12 fire-dil-preset';preset.innerHTML=`<label>Container preset</label><select id="fireDilPreset">${presetOptions}</select>`;grid.insertBefore(preset,field);
    const row=final.closest('.inputrow');if(row){const oldUnit=$('.unit',row);oldUnit?.remove();const unit=document.createElement('select');unit.id='fireDilUnit';unit.style.flex='0 0 86px';unit.innerHTML=unitOptions;row.appendChild(unit)}
    const recalc=()=>{const n=Math.max(.01,parseFloat(final.value)||0),u=$('#fireDilUnit')?.value||'gal',g=galFrom(n,u),wp=Math.max(0,parseFloat($('#waterParts')?.value)||0),pp=Math.max(0,parseFloat($('#prodParts')?.value)||0),total=wp+pp,prod=total>0?g*pp/total:0,water=Math.max(0,g-prod),out=$('#dilResult');if(out)out.innerHTML=`<span class="fire-dil-product">${(prod*128).toFixed(1)} fl oz</span> product + ${water.toFixed(2)} gal water`};
    $('#fireDilPreset')?.addEventListener('change',e=>{if(e.target.value!=='custom'){final.value=e.target.value;$('#fireDilUnit').value='gal';final.dispatchEvent(new Event('input',{bubbles:true}));recalc()}});
    $('#fireDilUnit')?.addEventListener('change',()=>{$('#fireDilPreset').value='custom';recalc()});
    [final,$('#waterParts'),$('#prodParts')].forEach(el=>el?.addEventListener('input',recalc));
    recalc();
  };
  const apply=()=>setupBrowser();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,950));else setTimeout(apply,950);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,80));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,80));
})();