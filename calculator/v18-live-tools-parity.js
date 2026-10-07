(()=>{
  if(window.__fireV18LiveToolsParity)return;window.__fireV18LiveToolsParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const toast=m=>window.toast?.(m);
  const cardByHeading=t=>$$('#tools .card').find(c=>c.querySelector('h2')?.textContent.trim()===t);
  const n=id=>{const v=parseFloat($('#'+id)?.value);return Number.isFinite(v)?Math.max(0,v):0};
  const batchGal=()=>{const p=$('#batchPreset');if(!p)return 4;if(p.value==='custom'){const x=n('customBatch'),u=$('#customUnit')?.value;return u==='floz'?x/128:u==='quart'?x/4:u==='liter'?x/3.78541:x}return +p.value||4};
  const setVal=(id,v)=>{const e=$('#'+id);if(!e)return;e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))};
  const selectView=view=>{const tab=$(`.tabs .tab[data-view="${view}"]`);tab?.click()};

  const favoritesKey='fireV18SavedFavorites';
  const defaultEleRate={house:.3,fencev:.3,fencew:.3,deckc:.3,deckw:.3,painted:.3,concrete:0,post:0,pavers:.3,brick:.3,stucco:.3,roof:1,metalroof:.3,aluminum:.3};
  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const savedFavorites=()=>{
    try{
      const data=JSON.parse(localStorage.getItem(favoritesKey)||'[]');
      return Array.isArray(data)?data.filter(x=>x&&typeof x==='object').slice(-20):[];
    }catch{return[]}
  };
  const saveFavorites=a=>{try{localStorage.setItem(favoritesKey,JSON.stringify(Array.isArray(a)?a.slice(-20):[]))}catch{}};
  const applyShFavorite=(raw={})=>{
    window.__fireRestoringSavedMix=true;
    const s=$('#surface');
    const requestedSurface=typeof raw.surface==='string'?raw.surface:'house';
    const surface=s&&[...s.options].some(o=>o.value===requestedSurface)?requestedSurface:'house';
    const growth=['light','moderate','heavy'].includes(raw.growth)?raw.growth:'moderate';
    const batch=Number.isFinite(+raw.batch)&&+raw.batch>0?+raw.batch:4;
    const target=Number.isFinite(+raw.target)&&+raw.target>=0?+raw.target:1;
    const stockStrength=Number.isFinite(+raw.stockStrength)&&+raw.stockStrength>0?+raw.stockStrength:null;
    const eleRate=Number.isFinite(+raw.eleRate)&&+raw.eleRate>=0?+raw.eleRate:null;
    if(s){s.value=surface;s.dispatchEvent(new Event('change',{bubbles:true}))}
    const g=$(`#growthSeg [data-growth="${growth}"]`);g?.click();

    /*
      Restore recipe-critical controls before batch. best-of-both's batch refresh
      can re-detect a matching preset, so letting the batch event fire last keeps
      stale preset state from overwriting a custom Saved mix during restore.
    */
    if(stockStrength!=null)setVal('stockStrength',stockStrength);
    const restoredEle=eleRate!=null?eleRate:defaultEleRate[surface];
    if(restoredEle!=null)setVal('eleRate',restoredEle);
    setVal('targetNum',target);

    const b=$('#batchPreset');
    if(b){
      const value=String(batch),hasPreset=[...b.options].some(o=>o.value===value);
      if(hasPreset)b.value=value;
      else{
        b.value='custom';
        setVal('customBatch',batch);
        const unit=$('#customUnit');if(unit){unit.value='gal';unit.dispatchEvent(new Event('change',{bubbles:true}))}
      }
      b.dispatchEvent(new Event('change',{bubbles:true}));
    }
    selectView('mix');
    setTimeout(()=>{window.__fireRestoringSavedMix=false},0);
  };
  const renderSavedFavorites=wrap=>{
    const list=$('#fireSavedFavorites',wrap);if(!list)return;const data=savedFavorites();
    if(!data.length){list.innerHTML='<div class="fire-empty-dash">Your saved mixes will appear here.</div>';return}
    list.innerHTML=data.map((x,i)=>{
      const batch=Number.isFinite(+x.batch)?Math.max(0,+x.batch):0,target=Number.isFinite(+x.target)?Math.max(0,+x.target):0;
      const stock=Number.isFinite(+x.stockStrength)&&+x.stockStrength>0?' · '+Number(x.stockStrength).toFixed(Number(x.stockStrength)%1?1:0)+'% stock':'';
      return `<div class="fire-saved-fav"><div><strong>${esc(x.name||'Saved SH mix')}</strong><small>${batch.toFixed(2)} gal · ${target.toFixed(2)}% SH${stock}</small></div><div><button type="button" data-fire-reuse-fav="${i}">Reuse</button><button type="button" data-fire-delete-fav="${i}">Delete</button></div></div>`;
    }).join('');
    $$('[data-fire-reuse-fav]',list).forEach(b=>b.onclick=()=>{const x=savedFavorites()[+b.dataset.fireReuseFav];if(x)applyShFavorite(x)});
    $$('[data-fire-delete-fav]',list).forEach(b=>b.onclick=()=>{const a=savedFavorites();a.splice(+b.dataset.fireDeleteFav,1);saveFavorites(a);renderSavedFavorites(wrap)});
  };
  const favorites=()=>{
    let c=cardByHeading('Quick Mix Favorites')||cardByHeading('Saved mixes');
    if(!c){
      const tools=$('#tools');if(!tools)return;
      c=document.createElement('div');c.className='card';
      const dwell=$('#dwellTimerCard');
      if(dwell&&dwell.parentElement===tools)dwell.insertAdjacentElement('afterend',c);
      else tools.insertBefore(c,tools.firstElementChild);
    }
    if(c.dataset.liveToolsDone)return;
    c.dataset.liveToolsDone='1';
    c.innerHTML=`<div class="kicker">SAVED MIXES</div><h2>Saved mixes</h2>
      <p class="muted">Save a mix you actually use, then reuse or delete it here. Common SH starting points stay in the Quick Preset control on SH Mix.</p>
      <div class="actions"><button class="primary" id="fireSaveCurrentSh" type="button">Save current SH mix</button></div>
      <div id="fireSavedFavorites"></div>`;
    $('#fireSaveCurrentSh',c).onclick=()=>{
      const entry={
        name:$('#recipeTitle')?.textContent||'Saved SH mix',
        surface:$('#surface')?.value||'house',
        growth:$('#growthSeg .chip.active')?.dataset.growth||'moderate',
        batch:batchGal(),
        target:n('targetNum'),
        stockStrength:n('stockStrength'),
        eleRate:n('eleRate')
      };
      const same=(x)=>x&&x.surface===entry.surface&&x.growth===entry.growth
        &&Math.abs((+x.batch||0)-entry.batch)<.001&&Math.abs((+x.target||0)-entry.target)<.001
        &&Math.abs((+x.stockStrength||0)-entry.stockStrength)<.001&&Math.abs((+x.eleRate||0)-entry.eleRate)<.001;
      const a=savedFavorites(),had=a.some(same);
      saveFavorites([...a.filter(x=>!same(x)),entry]);
      renderSavedFavorites(c);
      toast(had?'Saved mix refreshed':'Current SH mix saved');
    };
    renderSavedFavorites(c);
  };

  const stainFinder=()=>{
    const c=cardByHeading('Stain & Surface Finder');if(!c)return;
    const s=$('#stainType');if(s){const first=s.options[0];if(first)first.textContent='Green algae / mildew / moss'}
    const out=$('#stainResult');if(out&&s?.value==='algae'){out.innerHTML='<strong>Best starting point: Sodium hypochlorite (SH)</strong><p><b>General exterior:</b> Organic growth responds to the surface-specific SH strength calculator. Confirm the surface is SH-compatible, protect plants and metals, and start weak.</p><p class="dangerText"><b>Avoid:</b> Do not substitute acid, rust remover or aggressive pressure.</p>'}
  };

  const compatibility=()=>{
    const c=cardByHeading('Chemical Compatibility Checker');if(!c)return;
    const a=$('#compatA'),b=$('#compatB');
    if(a){[...a.options].forEach(o=>{if(o.textContent==='SH / bleach')o.textContent='Sodium hypochlorite (SH)';if(o.textContent==='Acid / F9 BARC')o.textContent='F9 BARC — porous'})}
    if(b){[...b.options].forEach(o=>{if(o.textContent==='SH / bleach')o.textContent='Sodium hypochlorite (SH)';if(o.textContent==='Acid / F9 BARC')o.textContent='F9 BARC — porous'})}
    const out=$('#compatResult');if(out&&a?.value==='SH / bleach'&&b?.value==='Acid / F9 BARC')out.innerHTML='<strong>DO NOT MIX</strong><p>Sodium hypochlorite (SH) and F9 BARC — porous must stay separate. Dangerous gas, heat, pressure or an unpredictable reaction may occur.</p>';
  };

  const history=()=>{
    const c=cardByHeading('Batch History / Mix Log');if(!c)return;const log=$('#logCurrentMix');if(log){log.textContent='Log current SH mix';log.classList.add('primary')}
    if(!$('#clearMixHistory',c)){const b=document.createElement('button');b.id='clearMixHistory';b.type='button';b.textContent='Clear history';b.className='fire-danger-outline';log?.insertAdjacentElement('afterend',b);b.onclick=()=>{localStorage.removeItem('fireV18MixHistory');const wrap=$('#mixHistory');if(wrap)wrap.innerHTML='<p class="muted">No batches logged yet.</p>';toast('Mix history cleared')}}
    const wrap=$('#mixHistory');if(wrap&&!wrap.textContent.trim())wrap.innerHTML='<p class="muted">No batches logged yet.</p>';
  };

  const inventoryKey='fireV18SpecialtyInventory';
  const defaultInv={sh:{amount:0,unit:'gal'},ele:{amount:0,unit:'floz'},gutter:{amount:0,unit:'gal'},bio:{amount:0,unit:'floz'},odo:{amount:0,unit:'gal'},f9:{amount:0,unit:'gal'},ettore:{amount:0,unit:'floz'}};
  const readInv=()=>{try{return {...defaultInv,...JSON.parse(localStorage.getItem(inventoryKey)||'{}')}}catch{return structuredClone(defaultInv)}};
  const writeInv=o=>{try{localStorage.setItem(inventoryKey,JSON.stringify(o))}catch{}};
  const unitToGal=(amount,unit)=>unit==='floz'?amount/128:amount;
  const renderInventory=()=>{
    const c=cardByHeading('Chemical Inventory');if(!c)return;
    if(!$('#fireInventoryRows',c)){
      const oldGrid=$('.grid',c),note=$('#inventoryNote'),oldActions=$('.actions',c);oldGrid?.classList.add('hidden');note?.classList.add('hidden');oldActions?.classList.add('hidden');
      const rows=document.createElement('div');rows.id='fireInventoryRows';rows.innerHTML=`${[
        ['sh','Stock SH','gal'],['ele','Elemonator','floz'],['gutter','Gutter Zap','gal'],['bio','Bio-Clean','floz'],['odo','OdoBan','gal'],['f9','F9 BARC','gal'],['ettore','Ettore Squeegee-Off','floz']
      ].map(([k,label,u])=>`<div class="fire-inv-row" data-inv-key="${k}"><div class="fire-inv-label"><strong>${label}</strong><span class="fire-inv-badge">Out</span></div><input type="number" min="0" step=".1" value="0" aria-label="${label} amount"><select aria-label="${label} unit"><option value="gal"${u==='gal'?' selected':''}>gal</option><option value="floz"${u==='floz'?' selected':''}>fl oz</option></select></div>`).join('')}<div class="actions fire-inv-actions"><button id="fireUseCurrentSh" type="button">Use current SH batch</button><button id="fireUseSpecialty" type="button">Use selected specialty mix</button></div><p class="muted">Inventory stays on this device. Amounts are planning aids—verify the container before a job.</p>`;
      c.insertBefore(rows,c.querySelector('.muted:last-child')||null);
      const stored=readInv();$$('.fire-inv-row',rows).forEach(r=>{const k=r.dataset.invKey,x=stored[k]||defaultInv[k],inp=$('input',r),sel=$('select',r);inp.value=String(x.amount||0);sel.value=x.unit||defaultInv[k].unit;const sync=()=>{const d=readInv();d[k]={amount:Math.max(0,+inp.value||0),unit:sel.value};writeInv(d);syncCoreInventory(d);updateBadges()};inp.addEventListener('input',sync);sel.addEventListener('change',sync)});
      $('#fireUseCurrentSh',rows).onclick=()=>{const d=readInv(),gal=batchGal(),stock=Math.max(.1,n('stockStrength')||10),target=n('targetNum'),ele=n('eleRate');d.sh={amount:gal*target/stock,unit:'gal'};d.ele={amount:gal*ele,unit:'floz'};writeInv(d);hydrateInventory();toast('Current SH batch loaded into inventory')};
      $('#fireUseSpecialty',rows).onclick=()=>{let x={};try{x=JSON.parse(localStorage.getItem('fireV18SelectedSpecialtyMix')||'{}')}catch{};if(!x.product){toast('Select a specialty mix first');return}const d=readInv();const key=x.product.includes('Gutter Zap')?'gutter':x.product.includes('OdoBan')?'odo':x.product.includes('Bio-Clean')?'bio':x.product.includes('F9')?'f9':x.product.includes('Ettore')?'ettore':null;if(!key){toast('Selected specialty mix is not in inventory');return}d[key]={amount:+x.amount||0,unit:x.unit==='fl oz'?'floz':x.unit||defaultInv[key].unit};writeInv(d);hydrateInventory();toast('Selected specialty mix loaded into inventory')};
    }
    hydrateInventory();
  };
  const syncCoreInventory=d=>{const sh=d.sh||defaultInv.sh,ele=d.ele||defaultInv.ele;if($('#invSH'))setVal('invSH',unitToGal(+sh.amount||0,sh.unit));if($('#invEle'))setVal('invEle',unitToGal(+ele.amount||0,ele.unit))};
  const updateBadges=()=>$$('.fire-inv-row').forEach(r=>{const amount=+($('input',r)?.value||0),badge=$('.fire-inv-badge',r);if(badge){badge.textContent=amount>0?'On hand':'Out';badge.classList.toggle('has-stock',amount>0)}});
  const hydrateInventory=()=>{const d=readInv();$$('.fire-inv-row').forEach(r=>{const x=d[r.dataset.invKey]||defaultInv[r.dataset.invKey],inp=$('input',r),sel=$('select',r);if(inp)inp.value=String(x.amount||0);if(sel)sel.value=x.unit||'gal'});syncCoreInventory(d);updateBadges()};

  const timerWeather=()=>{
    const stop=$('#timerStop');if(stop)stop.textContent='Pause';
    const key='fireV18ToolsState';let state={};try{state=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
    const auto=!Object.keys(state).length||(String(state.temp||'80')==='80'&&String(state.wind||'5')==='5'&&String(state.sun||'Shade / overcast')==='Shade / overcast'&&String(state.humidity||'50')==='50');
    if(auto&&!localStorage.getItem('fireLiveToolsDefaultsApplied')){setVal('temp',75);setVal('wind',5);const sun=$('#sun');if(sun){sun.value='Mixed';sun.dispatchEvent(new Event('change',{bubbles:true}))}setVal('humidity',50);localStorage.setItem('fireLiveToolsDefaultsApplied','1')}
    const note=$('#weatherNote');if(note&&n('temp')===75&&n('wind')===5&&$('#sun')?.value==='Mixed'){note.innerHTML='<strong>Normal field caution</strong><p>Conditions appear moderate, but keep watching wind shifts and surface drying.</p><p><b>Never raise chemical strength solely because of weather.</b></p>'}
  };

  const customBuilder=()=>{const c=cardByHeading('Custom Chemical Builder');if(!c)return;const name=$('#customChemName'),purpose=$('#customChemPurpose'),notes=$('#customChemNotes');if(name)name.placeholder='Example: vehicle soap';if(purpose)purpose.placeholder='Degreaser, soap, brightener…';if(notes)notes.placeholder='Copy the important label warning';const list=$('#customChemList');if(list&&!list.textContent.trim())list.innerHTML='<div class="fire-empty-dash">No custom products added yet.</div>'};

  const versionCard=()=>{const c=cardByHeading('Version and offline update');if(!c)return;const h3=$('h3',c);if(h3){h3.innerHTML='FIRE Field Calculator v18<div class="muted">Version 18 is installed and offline-ready.</div>'}const status=$('#offlineStatus');if(status)status.classList.add('hidden');if(!$('#fireCheckUpdate',c)){const b=document.createElement('button');b.id='fireCheckUpdate';b.className='primary';b.type='button';b.textContent='Check for app update';h3?.insertAdjacentElement('afterend',b);b.onclick=async()=>{try{const reg=await navigator.serviceWorker?.getRegistration();await reg?.update();toast('Update check complete')}catch{toast('Update check unavailable')}}}
    const p=$$('p.muted',c).find(x=>x.textContent.includes('does not require a sign-in'));if(p)p.textContent='The calculator does not require a sign-in. Your rates, inventory, saved mixes, calculator settings, and current estimate data remain on this device and are included in your backup.';
  };

  const backupCard=()=>{const c=cardByHeading('Backup or Restore Field Data');if(!c)return;const exp=$('#exportAll'),imp=$('#importAll'),file=$('#importFile');if(exp)exp.textContent='Download backup';if(imp)imp.classList.add('hidden');if(file){file.classList.remove('hidden');file.style.display='block';if(!$('#fireRestoreLabel',c)){const lab=document.createElement('label');lab.id='fireRestoreLabel';lab.textContent='Restore from a FIRE calculator backup';file.insertAdjacentElement('beforebegin',lab)}}if(!$('#copyBackupText',c)){const b=document.createElement('button');b.id='copyBackupText';b.type='button';b.textContent='Copy backup text';exp?.insertAdjacentElement('afterend',b);b.onclick=async()=>{const stores={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('fire'))stores[k]=localStorage.getItem(k)}const text=JSON.stringify({schema:'FIRE-Field-Calculator-v18-offline',version:18,exportedAt:new Date().toISOString(),stores},null,2);try{await navigator.clipboard.writeText(text);toast('Backup text copied')}catch{toast('Copy unavailable')}}}
  };

  const safety=()=>{const c=cardByHeading('Field Safety Card');if(!c||c.dataset.liveSafetyDone)return;c.dataset.liveSafetyDone='1';c.innerHTML=`<div class="kicker">OFFLINE REFERENCE</div><h2>Field Safety Card</h2><div class="fire-safety-list">
    <div><span>🧤</span><section><strong>PPE first</strong><p>Use the eye, skin, respiratory and footwear protection required by the label and SDS.</p></section></div>
    <div><span>🚫</span><section><strong>Never mix unknown products</strong><p>Keep SH, acids, ammonia and specialty cleaners separated in labeled sprayers.</p></section></div>
    <div><span>🌿</span><section><strong>Control overspray and runoff</strong><p>Move people and pets, protect plants and metals, and follow local wastewater requirements.</p></section></div>
    <div><span>🚿</span><section><strong>Exposure response</strong><p>Stop work, move to fresh air and rinse exposed skin or eyes with clean water. Follow the product label/SDS; call 911 for a serious reaction.</p></section></div>
    <div><span>📄</span><section><strong>The label controls</strong><p>This calculator is a planning aid. The current container label and SDS override every preset in the app.</p></section></div>
  </div>`};

  const apply=()=>{favorites();stainFinder();compatibility();history();renderInventory();timerWeather();customBuilder();versionCard();backupCard();safety()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1200));else setTimeout(apply,1200);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,80));window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,80));
})();