
(function(){
  if(window.__fireBestOfBothInit)return;
  window.__fireBestOfBothInit=true;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const fireInput=(el)=>{ if(!el)return; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
  const surfaceMeta={
    house:['House Wash','siding / exterior'],
    roof:['Roof Wash','asphalt shingles'],
    fencev:['Fence Wash','vinyl fence'],
    fencew:['Fence Wash','wood fence'],
    concrete:['Concrete Pre','before pressure'],
    post:['Concrete Post','after cleaning'],
    pavers:['Pavers','test joint / surface'],
    brick:['Brick / Masonry','organic growth'],
    stucco:['Stucco / EIFS','delicate exterior'],
    bins:['Trash Bins','organic sanitation'],
    deckw:['Wood Deck','low strength / test'],
    metalroof:['Metal Roof','coating-sensitive'],
    aluminum:['Gutter Exterior','organic wash only'],
    pool:['Pool Deck / Patio','test surface'],
    deckc:['Composite Deck','low strength / test']
  };

  function setTitle(){
    document.body.classList.add('fire-bob','dark');
    const t=$('.title strong'); if(t)t.textContent='FIRE Field Calculator';
    const s=$('.title span'); if(s)s.textContent='Fast mixes. Safer jobs.';
    const stock=$('.stock'); if(stock)stock.textContent='10% SH BASE';
    const top=$('.toprow');
    if(top && !$('#bobStageBadge')){
      const badge=document.createElement('span'); badge.id='bobStageBadge'; badge.className='bob-stage-badge'; badge.textContent='STAGING';
      top.appendChild(badge);
    }
  }

  function relabelTabs(){
    const mix=$('.tab[data-view="mix"]'), chem=$('.tab[data-view="chemicals"]'), index=$('.tab[data-view="index"]'), job=$('.tab[data-view="job"]');
    if(mix)mix.textContent='SH Mix';
    if(chem)chem.textContent='Mixes';
    if(index)index.textContent='Index';
    if(job)job.textContent='Job Plan';
    const tabs=$('.tabs');
    if(tabs && mix && chem && index && job){ tabs.append(mix,chem,index,job); }
  }

  function surfaceTiles(){
    const select=$('#surface'); if(!select || $('#bobSurfaceGrid'))return;
    const grid=document.createElement('div'); grid.id='bobSurfaceGrid'; grid.className='bob-surface-grid';
    Array.from(select.options).forEach(opt=>{
      const meta=surfaceMeta[opt.value] || [opt.textContent.split('—')[0].trim(),(opt.textContent.split('—')[1]||'').trim()];
      const b=document.createElement('button'); b.type='button'; b.className='bob-surface-btn'; b.dataset.value=opt.value;
      b.innerHTML='<strong>'+meta[0]+'</strong><small>'+meta[1]+'</small>';
      b.addEventListener('click',()=>{select.value=opt.value;fireInput(select); syncSurface();});
      grid.appendChild(b);
    });
    select.parentElement.appendChild(grid);
    syncSurface();
  }
  function syncSurface(){
    const v=$('#surface')?.value;
    $$('.bob-surface-btn').forEach(b=>b.classList.toggle('active',b.dataset.value===v));
  }

  function quickBatch(){
    const seg=$('#batchChips'); if(!seg || seg.dataset.bobDone)return;
    seg.dataset.bobDone='1';
    const keep=new Set(['2','4']);
    $$('button[data-batch]',seg).forEach(b=>{ if(!keep.has(b.dataset.batch))b.style.display='none'; });
    [['5','5 gal'],['50','50 gal'],['100','100 gal']].forEach(([v,label])=>{
      const b=document.createElement('button'); b.type='button'; b.className='chip'; b.dataset.batch=v; b.textContent=label;
      b.addEventListener('click',()=>{
        const preset=$('#batchPreset'); if(preset){preset.value=v;fireInput(preset);}
        const custom=$('#customBatch'); if(custom){custom.value=v;fireInput(custom);}
        $$('button[data-batch]',seg).forEach(x=>x.classList.toggle('active',x===b));
      });
      seg.appendChild(b);
    });
    const preset=$('#batchPreset'); if(preset) preset.closest('.field').style.display='none';
  }

  function restructureMix(){
    const mix=$('#mix'); if(!mix || mix.dataset.bobDone)return;
    mix.dataset.bobDone='1';
    const cards=$(':scope > .card',mix)?$$(':scope > .card',mix):$$('#mix > .card');
    if(cards.length<3)return;
    const step1=cards[0], step2=cards[1], recipe=cards[2];
    const step1K=$('.kicker',step1), step1H=$('h2',step1);
    if(step1K)step1K.textContent='1 · PICK THE SURFACE';
    if(step1H)step1H.textContent='Service';

    const k2=$('.kicker',step2),h2=$('h2',step2);
    if(k2)k2.textContent='3 · CHOOSE BATCH';
    if(h2)h2.textContent='Container size';

    const stockField=$('#stockStrength')?.closest('.field');
    const handField=$('#shOnHand')?.closest('.field');
    if(stockField){
      const g=$('.grid',step2);
      if(g)g.appendChild(stockField);
    }
    if(handField) handField.style.display='none';

    const fine=document.createElement('div'); fine.className='card bob-finetune';
    fine.innerHTML='<div class="kicker">4 · FINE TUNE</div><h2>Target strength</h2><div class="grid"></div>';
    const fineGrid=$('.grid',fine);
    const targetField=$('#target')?.closest('.field');
    const eleField=$('#eleRate')?.closest('.field');
    if(targetField){
      const label=$('label',targetField); if(label)label.textContent='Target strength';
      const num=$('#targetNum'); if(num)num.style.display='none';
      const unit=targetField.querySelector('.unit'); if(unit)unit.style.display='none';
      const val=document.createElement('div'); val.className='bob-range-value'; val.id='bobTargetVal'; val.textContent=($('#target')?.value||'1')+'%';
      const row=targetField.querySelector('.inputrow'); if(row)row.appendChild(val);
      $('#target')?.addEventListener('input',()=>{val.textContent=$('#target').value+'%';});
      fineGrid.appendChild(targetField);
    }
    if(eleField){
      const label=$('label',eleField); if(label)label.textContent='Surfactant (optional ounces per gallon)';
      fineGrid.appendChild(eleField);
    }

    recipe.classList.add('bob-recipe');
    const rk=$('.kicker',recipe); if(rk)rk.textContent='BATCH RECIPE';
    const title=$('#recipeTitle'); if(title)title.style.display='none';
    const big=document.createElement('h2'); big.id='bobRecipeTitle'; big.textContent=($('#target')?.value||'1')+'% SH';
    const copy=document.createElement('button'); copy.type='button'; copy.className='bob-copy'; copy.textContent='Copy';
    copy.addEventListener('click',async()=>{
      const sh=$('#shAmt')?.textContent||'', water=$('#waterAmt')?.textContent||'', ele=$('#eleAmt')?.textContent||'';
      const text='FIRE Batch Recipe — '+big.textContent+'\nSH: '+sh+'\nWater: '+water+'\nSurfactant: '+ele;
      try{await navigator.clipboard.writeText(text); copy.textContent='Copied'; setTimeout(()=>copy.textContent='Copy',1200);}catch(e){}
    });
    recipe.insertBefore(copy,recipe.firstChild);
    recipe.insertBefore(big,recipe.querySelector('.grid')||recipe.firstChild.nextSibling);
    const grids=$$('.grid',recipe); grids.forEach(g=>{ if(g.contains($('#target'))||g.contains($('#stockStrength')))g.remove(); });
    const order=document.createElement('p'); order.className='bob-recipe-order'; order.id='bobRecipeOrder';
    recipe.appendChild(order);
    const updateRecipe=()=>{
      big.textContent=(parseFloat($('#target')?.value||1)).toString().replace(/\.0$/,'')+'% SH';
      const water=$('#waterAmt')?.textContent||'';
      const sh=$('#shAmt')?.textContent||'';
      const ele=$('#eleAmt')?.textContent||'';
      order.textContent='Order: '+water+' water → '+sh+' SH → '+ele+' bleach-safe surfactant. Verify the product label before use.';
    };
    ['#target','#targetNum','#eleRate','#stockStrength','#customBatch','#batchPreset'].forEach(sel=>$(sel)?.addEventListener('input',updateRecipe));
    setTimeout(updateRecipe,0);

    step2.after(fine);
    fine.after(recipe);

    const growth=$('#growthSeg')?.closest('.field');
    if(growth){
      const condition=document.createElement('div'); condition.className='card bob-condition';
      condition.innerHTML='<div class="kicker">2 · SET THE CONDITION</div><h2>Organic growth</h2>';
      condition.appendChild(growth);
      step1.after(condition);
    }
  }

  function toolsMenu(){
    if($('#bobToolsSheet'))return;
    const top=$('.toprow'); if(!top)return;
    const btn=document.createElement('button'); btn.type='button'; btn.className='bob-tools-btn'; btn.textContent='Tools';
    const sheet=document.createElement('div'); sheet.id='bobToolsSheet'; sheet.className='bob-tools-sheet';
    const items=[['equipment','Equipment / X-Jet'],['tools','Field Tools'],['guide','Safety Guide']];
    items.forEach(([view,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.addEventListener('click',()=>{const t=$('.tab[data-view="'+view+'"]'); if(t)t.click(); sheet.classList.remove('open');});
      sheet.appendChild(b);
    });
    btn.addEventListener('click',()=>sheet.classList.toggle('open'));
    top.appendChild(btn);
    $('.tabswrap')?.after(sheet);
  }

  function jobPolish(){
    const job=$('#job'); if(!job || job.dataset.bobDone)return;
    job.dataset.bobDone='1';
    const cards=$(':scope > .card',job);
    const first=cards[0], estimate=cards[1];
    if(first){
      const k=$('.kicker',first),h=$('h2',first);
      if(k)k.textContent='COVERAGE PLANNER';
      if(h)h.textContent='How much mix will the job need?';
    }
    if(estimate){
      const wrap=document.createElement('details'); wrap.className='bob-section-toggle bob-job-estimate';
      const summary=document.createElement('summary'); summary.innerHTML='<strong>Full job estimate</strong><span>Open only when you need pricing</span>';
      estimate.before(wrap); wrap.append(summary,estimate);
    }
  }

  function equipmentPolish(){
    const eq=$('#equipment'); if(!eq || eq.dataset.bobDone)return;
    eq.dataset.bobDone='1';
    const cards=$(':scope > .card',eq);
    if(cards.length<4)return;
    /* Keep the two everyday tools immediately visible: X-Jet and downstream.
       Collapse calibration and future-rig planning so the screen stays field-fast. */
    const downstream=cards[2];
    cards[0].after(downstream);
    [[cards[1],'X-Jet calibration','Measured bucket-draw test'],[cards[3],'Future 7-GPM rig','Proportioner planning']].forEach(([card,title,sub])=>{
      const wrap=document.createElement('details'); wrap.className='bob-section-toggle';
      const summary=document.createElement('summary'); summary.innerHTML='<strong>'+title+'</strong><span>'+sub+'</span>';
      card.before(wrap); wrap.append(summary,card);
    });
  }

  function chemicalPolish(){
    /* LIVE Mixes is a user-favorite section. Preserve its content and calculator behavior. */
  }

  setTitle(); relabelTabs(); toolsMenu(); jobPolish(); equipmentPolish(); chemicalPolish();
  $('#surface')?.addEventListener('change',syncSurface);
})();
