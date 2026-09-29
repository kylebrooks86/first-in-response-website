(()=>{
if(window.__fireV18Interactions)return;window.__fireV18Interactions=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const toast=m=>{let t=$('#toast');if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1600)}};
const safeParse=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}};
const saveJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

function enhanceHistory(){
 const wrap=$('#mixHistory'),btn=$('#logCurrentMix'); if(!wrap||!btn)return;
 const render=()=>{const data=safeParse('fireV18MixHistory',[]);wrap.innerHTML=data.length?data.slice().reverse().map((x,ri)=>{const i=data.length-1-ri;return `<div class="listrow"><div class="meta"><strong>${escapeHtml(x.name||'Mix')}</strong><small>${escapeHtml(x.date||'')} · ${escapeHtml(String(x.target||''))}% SH · ${escapeHtml(String(x.batch||''))} gal</small></div><div><button class="tinybtn" data-reuse-mix="${i}" type="button">Reuse</button> <button class="tinybtn dangerbtn" data-delete-mix="${i}" type="button">Delete</button></div></div>`}).join(''):'<p class="muted">No mixes logged yet.</p>';
 $$('[data-reuse-mix]',wrap).forEach(b=>b.onclick=()=>{const d=safeParse('fireV18MixHistory',[])[+b.dataset.reuseMix];if(!d)return;const t=$('#targetNum'),batch=$('#batchPreset'),name=$('#historyName');if(t)t.value=d.target||1;if(batch&&d.batch)batch.value=d.batch;if(name)name.value=d.name||'';t?.dispatchEvent(new Event('input',{bubbles:true}));toast('Mix loaded')});
 $$('[data-delete-mix]',wrap).forEach(b=>b.onclick=()=>{const d=safeParse('fireV18MixHistory',[]);d.splice(+b.dataset.deleteMix,1);saveJSON('fireV18MixHistory',d);render();toast('Mix deleted')});
 };
 btn.addEventListener('click',()=>setTimeout(render,0));render();
}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function enhanceInventory(){
 const card=$('#inventoryNote')?.closest('.card');if(!card)return;
 if(!$('#syncShInventory')){const a=document.createElement('div');a.className='actions';a.innerHTML='<button id="syncShInventory" type="button">Use SH on-hand value</button><button id="clearInventory" type="button">Clear inventory</button>';card.appendChild(a)}
 $('#syncShInventory').onclick=()=>{const inv=$('#invSH'),src=$('#shOnHand');if(inv&&src){inv.value=src.value;inv.dispatchEvent(new Event('input',{bubbles:true}));toast('SH inventory synced')}};
 $('#clearInventory').onclick=()=>{['invSH','invEle','invOther'].forEach(id=>{const e=$('#'+id);if(e){e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}))}});toast('Inventory cleared')};
 const recalc=()=>{const sh=+($('#invSH')?.value||0),ele=+($('#invEle')?.value||0),neededMix=parseFloat(($('#mixNeeded')?.textContent||'0').replace(/[^0-9.]/g,''))||0,target=+($('#targetNum')?.value||0),stock=Math.max(.1,+($('#stockStrength')?.value||10)),eleRate=+($('#eleRate')?.value||0),needSh=neededMix*target/stock,needEle=neededMix*eleRate/128;const parts=[];parts.push(sh>=needSh?`SH: enough (${sh.toFixed(2)} gal on hand / ${needSh.toFixed(2)} gal planned)`:`SH: short by ${(needSh-sh).toFixed(2)} gal`);parts.push(ele>=needEle?`Elemonator: enough (${ele.toFixed(2)} gal on hand)`:`Elemonator: short by ${(needEle-ele).toFixed(2)} gal`);const n=$('#inventoryNote');if(n)n.innerHTML=parts.map((x,i)=>`<strong>${x}</strong>`).join('<br>')};
 ['invSH','invEle','mixNeeded','targetNum','stockStrength','eleRate'].forEach(id=>$('#'+id)?.addEventListener('input',recalc));recalc();
}

function enhanceRates(){
 const ed=$('#priceEditor');if(!ed)return;
 const details=ed.closest('details');if(details&&!$('#resetRates')){const a=document.createElement('div');a.className='actions';a.innerHTML='<button id="resetRates" type="button">Reset confirmed FIRE rates</button>';details.querySelector(':scope > div')?.appendChild(a)}
 $('#resetRates')?.addEventListener('click',()=>{localStorage.removeItem('fireV18Rates');toast('Rates reset to calculator defaults');setTimeout(()=>location.reload(),250)});
}

function fullBackup(){
 const exportBtn=$('#exportAll'),importBtn=$('#importAll'),file=$('#importFile'),status=$('#backupStatus');if(!exportBtn||!importBtn||!file)return;
 const prefix=['fireV18','fireFieldCalculator','fireCalcTheme'];
 const collect=()=>{const stores={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(prefix.some(p=>k.startsWith(p)))stores[k]=localStorage.getItem(k)}return {schema:'FIRE-Field-Calculator-v18-offline',exportedAt:new Date().toISOString(),stores}};
 exportBtn.onclick=()=>{const blob=new Blob([JSON.stringify(collect(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='FIRE_Field_Calculator_Backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);if(status)status.textContent='Backup exported successfully.';toast('Backup exported')};
 importBtn.onclick=()=>file.click();
 file.onchange=async()=>{const f=file.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(data.schema!=='FIRE-Field-Calculator-v18-offline'||!data.stores)throw new Error('bad');Object.entries(data.stores).forEach(([k,v])=>localStorage.setItem(k,v));if(status)status.textContent='Backup restored. Reloading calculator…';toast('Backup restored');setTimeout(()=>location.reload(),400)}catch{if(status)status.textContent='That backup file could not be restored.';toast('Restore failed')}finally{file.value=''}};
}

function bind(){enhanceHistory();enhanceInventory();enhanceRates();fullBackup()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,280));else setTimeout(bind,280);
})();