(()=>{
if(window.__fireV18FineParity)return;window.__fireV18FineParity=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const style=document.createElement('style');style.textContent=`
#batchChips{gap:8px;align-items:stretch}#batchChips .chip{min-width:62px;min-height:44px;padding:10px 12px;justify-content:center}
.toprow .version{white-space:nowrap}.toprow .stock{cursor:default;background:transparent!important;color:#6c757d!important;padding:0!important;border-radius:0!important;font-weight:400!important}
.fire-ele-toggle{display:flex;align-items:center;gap:10px;margin-top:10px}.fire-ele-toggle input{width:20px;height:20px;min-height:20px}.fire-ele-copy{font-size:13px;color:#6c757d;line-height:1.4}
.fire-surface-guidance{margin-top:12px}
@media(max-width:560px){#batchChips{display:grid;grid-template-columns:repeat(3,minmax(62px,1fr));width:100%}#batchChips .chip{width:100%}}
`;document.head.appendChild(style);
function apply(){
  const ver=$('.version');if(ver){ver.textContent='v18';ver.style.color='#949698'}
  const stock=$('.stock');if(stock)stock.textContent='Stock SH 10%';
  const install=$('#installBtn');if(install){install.classList.remove('hidden');install.textContent='Install';install.addEventListener('click',()=>{setTimeout(()=>{if(!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){const t=$('.toast');if(t){t.textContent='iPhone: Share → Add to Home Screen';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}}},150)},{capture:true})}
  const details=$$('#job details.accord');for(const d of details){if($('summary',d)?.textContent.trim()==='Edit pricing and business rules')d.open=true}
  const ele=$('#eleRate');if(ele){ele.type='number';ele.removeAttribute('list')}
  const chips=$$('#batchChips .chip');chips.forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('active')?'true':'false'));

  const surfaceCard=$('#surface')?.closest('.card');
  if(surfaceCard&&!surfaceCard.textContent.includes('Start low. Check oxidation, failed paint, outlets, door seals, and delicate fixtures before applying.')){const p=document.createElement('p');p.className='muted fire-surface-guidance';p.textContent='Start low. Check oxidation, failed paint, outlets, door seals, and delicate fixtures before applying.';surfaceCard.appendChild(p)}

  const factory=$$('p,.muted').find(e=>e.textContent.trim()==='Factory proportions are estimates. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.');
  if(factory)factory.textContent='Factory proportions are estimates based on a 4 GPM pressure washer at 100 PSI. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.';

  const xHead=$$('h2').find(h=>h.textContent.trim()==='X-Jet bucket draw test');
  if(xHead){const card=xHead.closest('.card');if(card&&!card.textContent.includes('Start with a marked pickup bucket')){const p=document.createElement('p');p.className='muted';p.textContent='Start with a marked pickup bucket, spray for the exact time entered, then measure how many fluid ounces disappeared. Water volume is calculated from your pressure-washer GPM × test time. Repeat once to confirm the result.';card.appendChild(p)}}

  const chemSelect=$('#chemicals .card:first-child select');
  if(chemSelect){const current=chemSelect.value;const products=['Ettore Squeegee-Off','Dawn','Elemonator','Simple Green Pro HD','Krud Kutter','LA’s Totally Awesome','F9 BARC','Gutter Zap','Bio-Clean','OdoBan'];const existing=[...chemSelect.options].map(o=>o.textContent.trim());if(products.some((p,i)=>existing[i]!==p)||existing.length!==products.length){chemSelect.innerHTML='';for(const name of products){const o=document.createElement('option');o.textContent=name;o.value=name;chemSelect.appendChild(o)}if(products.includes(current))chemSelect.value=current}}

  const batch=$('#batchPreset');
  if(batch){const current=batch.value||'4';const presets=[['4','4 gallons — FlowZone'],['0.09375','12 fl oz'],['0.125','16 fl oz'],['0.15625','20 fl oz'],['0.1875','24 fl oz'],['0.203125','26 fl oz'],['0.21875','28 fl oz'],['0.25','32 fl oz'],['0.3125','40 fl oz'],['0.375','48 fl oz'],['0.5','64 fl oz / ½ gal'],['0.75','3 quarts'],['1','1 gallon'],['1.5','1½ gallons'],['2','2 gallons'],['2.5','2½ gallons'],['3','3 gallons'],['5','5 gallons'],['7','7 gallons'],['10','10 gallons'],['15','15 gallons'],['20','20 gallons'],['25','25 gallons'],['30','30 gallons'],['35','35 gallons'],['50','50 gallons'],['65','65 gallons'],['75','75 gallons'],['100','100 gallons'],['125','125 gallons'],['150','150 gallons'],['200','200 gallons'],['250','250 gallons'],['custom','Custom amount']];const labels=[...batch.options].map(o=>o.textContent.trim());if(labels.length!==presets.length||presets.some((p,i)=>labels[i]!==p[1])){batch.innerHTML='';for(const [value,label] of presets){const o=document.createElement('option');o.value=value;o.textContent=label;batch.appendChild(o)}batch.value=presets.some(p=>p[0]===current)?current:'4'}}

  const chipWrap=$('#batchChips');
  if(chipWrap&&!chipWrap.querySelector('[data-batch="custom"]')){const b=document.createElement('button');b.className='chip';b.type='button';b.dataset.batch='custom';b.textContent='Custom amount';b.addEventListener('click',()=>{if(batch){batch.value='custom';batch.dispatchEvent(new Event('change',{bubbles:true}))}$$('#batchChips .chip').forEach(x=>x.classList.toggle('active',x===b));b.setAttribute('aria-pressed','true')});chipWrap.appendChild(b)}

  const recipe=$('#recipeTitle');const normalizeRecipe=()=>{if(recipe&&recipe.textContent.includes('moderate'))recipe.textContent=recipe.textContent.replace(/moderate/g,'medium')};normalizeRecipe();if(recipe&&!recipe.dataset.fireParityObserver){recipe.dataset.fireParityObserver='1';new MutationObserver(normalizeRecipe).observe(recipe,{childList:true,subtree:true,characterData:true})}

  if(ele&&!$('#includeElemonator')){const field=ele.closest('.field');if(field){const wrap=document.createElement('div');wrap.className='fire-ele-toggle';wrap.innerHTML='<input id="includeElemonator" type="checkbox" checked><div><strong>Add Elemonator</strong><div class="fire-ele-copy">Adjustable dosage; included within total batch volume.</div></div>';field.appendChild(wrap);const box=$('#includeElemonator');let saved=ele.value||'1';box.addEventListener('change',()=>{if(box.checked){ele.value=saved||'1'}else{saved=ele.value||saved||'1';ele.value='0'}ele.dispatchEvent(new Event('input',{bubbles:true}))});ele.addEventListener('input',()=>{if(box.checked&&+ele.value>0)saved=ele.value})}}

  const stockNote=$('#stockNote');
  const syncStockNote=()=>{if(!stockNote)return;const on=+($('#shOnHand')?.value||0),stockVal=Math.max(.1,+($('#stockStrength')?.value||10)),target=Math.max(0,+($('#targetNum')?.value||0));let batchGal=4;if(batch){if(batch.value==='custom'){const n=+($('#customBatch')?.value||0),u=$('#customUnit')?.value;batchGal=u==='floz'?n/128:u==='quart'?n/4:u==='liter'?n/3.78541:n}else batchGal=+batch.value||4}const sh=target/stockVal*batchGal,batches=sh>0?Math.floor(on/sh):0,total=batches*batchGal;stockNote.textContent=`Your ${on} gallons of SH can make ${batches} full ${batchGal.toFixed(2)} gal batches (${total.toFixed(1)} gallons of finished mix).`};
  syncStockNote();
  ['shOnHand','stockStrength','targetNum','batchPreset','customBatch','customUnit'].forEach(id=>$('#'+id)?.addEventListener('input',()=>setTimeout(syncStockNote,0)));batch?.addEventListener('change',()=>setTimeout(syncStockNote,0));

  const area=$('#area');if(area&&area.value==='2500')area.value='';

  const lists=$$('#guide ul,#guide ol');for(const list of lists){const txt=list.textContent||'';if(txt.includes('Test an inconspicuous spot and start weaker when uncertain.')&&!txt.includes('Rinse tools and do not seal or store mixed SH long-term.')){const li=document.createElement('li');li.textContent='Rinse tools and do not seal or store mixed SH long-term.';list.appendChild(li);break}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,500));else setTimeout(apply,500);
})();