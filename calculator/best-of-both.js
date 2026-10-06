
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

  function quickFavorites(){
    const mix=$('#mix'); if(!mix || $('#bobQuickFavorites'))return;

    /* Direct-application Elemonator guidance from the current Pressure Tek usage guide
       is 0.3 fl oz per mixed gallon. Flatwork post-treatment intentionally defaults
       to no surfactant; concrete pre-treatment leaves it optional rather than forced. */
    const surface=$('#surface');
    if(surface && !surface.querySelector('option[value="painted"]')){
      const opt=document.createElement('option');
      opt.value='painted';
      opt.textContent='Painted exterior — wood / brick / masonry';
      surface.appendChild(opt);
      try{ if(typeof surfaceTargets!=='undefined') surfaceTargets.painted={light:.25,moderate:.5,heavy:1}; }catch(e){}
    }

    const presets=[
      {icon:'🏠',name:'House / Vinyl',pct:1,surface:'house',ele:.3,note:'Normal organic growth on vinyl siding, soffit/fascia, or vinyl fence.'},
      {icon:'🪵',name:'Bare Wood Fence',pct:.5,surface:'fencew',ele:.3,note:'Conservative starting mix for unfinished wood. Test first.'},
      {icon:'🎨',name:'Painted Wood / Brick / Masonry',pct:.5,surface:'painted',ele:.3,note:'Sound exterior paint only. Check for chalking, peeling, oxidation, or failing coating and test first.'},
      {icon:'🧱',name:'Concrete Pre-Treat',pct:2,surface:'concrete',ele:0,eleOptional:.3,note:'Surfactant is optional here; add only when extra wetting / cling helps.'},
      {icon:'💦',name:'Concrete Post-Treat',pct:1,surface:'post',ele:0,note:'No surfactant by default for a leave-on post-treatment.'},
      {icon:'🏚️',name:'Asphalt Roof / Black Streaks',pct:4,surface:'roof',ele:.3,note:'Typical black-streak starting mix. Verify the shingle manufacturer and never use high pressure.'},
      {icon:'🧱',name:'Bare Brick / Masonry',pct:1,surface:'brick',ele:.3,note:'For ordinary organic growth on unpainted brick / masonry. Natural stone is not included.'}
    ];
    const more=[
      {icon:'🏡',name:'Stucco / Synthetic Stucco',pct:.5,surface:'stucco',ele:.3,note:'Conservative starting point. Low pressure and test first.'},
      {icon:'🧱',name:'Pavers / Hardscape',pct:1,surface:'pavers',ele:.3,note:'Routine organic-growth starting point; verify sealer / surface compatibility.'},
      {icon:'🪨',name:'Natural Stone — Identify / Test First',pct:null,surface:null,ele:null,note:'Do not use one universal SH strength. Identify the stone and any sealer before choosing a mix.'},
      {icon:'🌊',name:'Pool Deck — Choose Surface First',pct:null,surface:null,ele:null,note:'Pool deck describes the location, not the material. Identify concrete, paver, coated surface, or stone first.'}
    ];

    const card=document.createElement('div');
    card.id='bobQuickFavorites'; card.className='card bob-quick-card';
    card.innerHTML='<div class="kicker">QUICK FAVORITES</div><h2>Common SH starting mixes</h2><p class="muted bob-fav-help">Tap a favorite to load the surface, Moderate condition, target SH strength, and the appropriate Elemonator rate. Your currently selected batch size stays in place, and the recipe calculates the actual Elemonator ounces for that batch. You can fine-tune anything afterward.</p><div class="bob-fav-grid" id="bobFavGrid"></div><details class="bob-more-presets"><summary>➕ More presets / special surfaces</summary><div class="bob-fav-grid" id="bobMoreGrid"></div></details><div class="bob-fav-note" id="bobFavNote">Starting points only — surface condition and the current product label still control.</div>';

    const batchGallons=()=>{
      const preset=$('#batchPreset');
      if(!preset)return 4;
      if(preset.value!=='custom')return Math.max(0,+preset.value||0);
      const amt=Math.max(0,+$('#customBatch')?.value||0),unit=$('#customUnit')?.value||'gal';
      if(unit==='floz')return amt/128;
      if(unit==='quart')return amt/4;
      if(unit==='liter')return amt/3.785411784;
      return amt;
    };
    const fmtOz=(n)=>n<1?n.toFixed(2):n.toFixed(1);
    const surfactantText=(p)=>{
      if(p.ele==null)return 'Elemonator: choose after surface ID';
      if(p.ele===0 && p.eleOptional){
        const total=p.eleOptional*batchGallons();
        return 'Elemonator: optional · '+fmtOz(total)+' oz for this batch';
      }
      if(p.ele===0)return 'Elemonator: none';
      const total=p.ele*batchGallons();
      return 'Elemonator: '+fmtOz(total)+' oz for this batch ('+p.ele.toFixed(1)+' oz/gal)';
    };

    const makeButton=(p)=>{
      const b=document.createElement('button'); b.type='button'; b.className='bob-fav-btn'; b._bobPreset=p;
      const strength=p.pct==null?'Test first':(p.pct+'% SH');
      b.innerHTML='<span class="bob-fav-icon">'+p.icon+'</span><span class="bob-fav-copy"><strong>'+p.name+'</strong><small>'+strength+' · '+surfactantText(p)+'</small></span>';
      if(p.pct==null)b.classList.add('bob-fav-info');
      b.addEventListener('click',()=>{
        const note=$('#bobFavNote');
        if(p.pct==null){
          if(note)note.textContent=p.icon+' '+p.name+': '+p.note;
          return;
        }
        if(surface){surface.value=p.surface;fireInput(surface);}
        /* Standardize favorites on the existing Moderate condition behavior. */
        const mod=$('#growthSeg [data-growth="moderate"]'); if(mod)mod.click();
        const target=$('#targetNum'); if(target){target.value=p.pct;fireInput(target);}
        const ele=$('#eleRate'); if(ele){ele.value=p.ele;fireInput(ele);}
        $('.bob-fav-btn').forEach(x=>x.classList.toggle('active',x===b));
        if(note){
          const surf=p.ele===0&&p.eleOptional
            ?' Elemonator is optional here; the preset leaves it at 0 oz. For extra wetting/cling, the direct-application guide rate is '+p.eleOptional.toFixed(1)+' oz per gallon of final mixed solution.'
            :(p.ele===0?' No Elemonator is added by default.':' Elemonator loaded at '+p.ele.toFixed(1)+' oz per gallon of final mixed solution. The recipe below calculates the total ounces from your selected batch size.');
          note.textContent=p.icon+' '+p.name+': '+p.note+surf;
        }
      });
      return b;
    };
    presets.forEach(p=>$('#bobFavGrid',card).appendChild(makeButton(p)));
    more.forEach(p=>$('#bobMoreGrid',card).appendChild(makeButton(p)));

    const refreshFavoriteAmounts=()=>{
      $('.bob-fav-btn',card).forEach(b=>{
        const p=b._bobPreset,small=$('small',b);
        if(!p||!small)return;
        const strength=p.pct==null?'Test first':(p.pct+'% SH');
        small.textContent=strength+' · '+surfactantText(p);
      });
    };
    ['#batchPreset','#customBatch','#customUnit'].forEach(sel=>{
      const el=$(sel); if(el){el.addEventListener('input',refreshFavoriteAmounts);el.addEventListener('change',refreshFavoriteAmounts);}
    });
    refreshFavoriteAmounts();

    /* Insert favorites without altering the LIVE Mixes / Index layouts. */
    mix.insertBefore(card,mix.firstElementChild);
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

  setTitle(); relabelTabs(); quickFavorites(); toolsMenu(); jobPolish(); equipmentPolish(); chemicalPolish();
  $('#surface')?.addEventListener('change',syncSurface);
})();
