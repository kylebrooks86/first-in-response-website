
(function(){
  if(window.__fireBestOfBothInit)return;
  window.__fireBestOfBothInit=true;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const fireInput=(el)=>{ if(!el)return; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
  function setTitle(){
    document.body.classList.add('fire-bob','dark');
    const t=$('.title strong'); if(t)t.textContent='FIRE Field Calculator';
    const s=$('.title span'); if(s)s.textContent='Fast mixes. Safer jobs.';
    const stock=$('.stock'),stockVal=+($('#stockStrength')?.value||10); if(stock)stock.textContent='Stock SH '+stockVal.toFixed(stockVal%1?1:0)+'%';
    const top=$('.toprow');
    if(top && !$('#bobStageBadge')){
      const badge=document.createElement('span'); badge.id='bobStageBadge'; badge.className='bob-stage-badge'; badge.textContent='STAGING';
      top.appendChild(badge);
    }
  }

  function syncLateStockTools(){
    const v=+($('#stockStrength')?.value||10);
    const reverse=$('#xReverseStock'), prop=$('#propStock');
    if(reverse && Math.abs((+reverse.value||0)-v)>.001){reverse.value=v;fireInput(reverse);}
    if(prop && Math.abs((+prop.value||0)-v)>.001){prop.value=v;fireInput(prop);}
    const badge=$('#stockBadge')||$('.stock');
    if(badge)badge.textContent='Stock SH '+v.toFixed(v%1?1:0)+'%';
  }

  function relabelTabs(){
    const mix=$('.tab[data-view="mix"]'), chem=$('.tab[data-view="chemicals"]'), index=$('.tab[data-view="index"]'), job=$('.tab[data-view="job"]');
    if(mix){mix.textContent='🧪 SH Mix';mix.setAttribute('aria-label','SH Mix')}
    if(chem){chem.textContent='🧴 Mixes';chem.setAttribute('aria-label','Mixes')}
    if(index){index.textContent='🔎 Index';index.setAttribute('aria-label','Chemical Index')}
    if(job){job.textContent='📐 Job Plan';job.setAttribute('aria-label','Job Plan')}
    const tabs=$('.tabs');
    if(tabs && mix && chem && index && job){ tabs.append(mix,chem,index,job); }
  }

  function quickFavorites(){
    const mix=$('#mix'); if(!mix || $('#bobQuickFavorites'))return;

    const surface=$('#surface');

    const presets=[
      {icon:'🏠',name:'House / Vinyl',strengths:{light:.5,moderate:1,heavy:1.5},surface:'house',ele:.3,note:'Normal organic growth on vinyl siding, soffit/fascia, or vinyl fence.'},
      {icon:'🪵',name:'Bare Wood Fence',strengths:{light:.5,moderate:1,heavy:1.5},surface:'fencew',ele:.3,note:'Unfinished wood is sensitive. Use the dirtiness selector conservatively and test first.'},
      {icon:'🎨',name:'Painted Wood / Brick / Masonry',strengths:{light:.5,moderate:.5,heavy:.5},surface:'painted',ele:.3,note:'Sound exterior paint only. Check for chalking, peeling, oxidation, or failing coating and test first.'},
      {icon:'🧱',name:'Concrete Pre-Treat',strengths:{light:1,moderate:2,heavy:3},surface:'concrete',ele:0,eleOptional:.3,note:'No surfactant by default. If the concrete is sloped, vertical, very hot/dry, or the solution is drying/running off too quickly, add Elemonator at 0.3 oz per gallon of finished mix for extra wetting and dwell.'},
      {icon:'💦',name:'Concrete Post-Treat',strengths:{light:.5,moderate:1,heavy:1.5},surface:'post',ele:0,note:'No surfactant by default for a leave-on post-treatment.'},
      {icon:'🏚️',name:'Asphalt Roof / Black Streaks',strengths:{light:3,moderate:4,heavy:5},surface:'roof',ele:1,note:'Typical black-streak starting mix. Roof preset uses a heavier Elemonator dose for more cling. Verify the shingle manufacturer and never use high pressure.'},
      {icon:'🧱',name:'Bare Brick / Masonry',strengths:{light:.5,moderate:1,heavy:2},surface:'brick',ele:.3,note:'For ordinary organic growth on unpainted brick / masonry. Natural stone is not included.'},
      {icon:'🏡',name:'Stucco / Synthetic Stucco',strengths:{light:.5,moderate:1,heavy:1.5},surface:'stucco',ele:.3,note:'Use the dirtiness selector conservatively. Low pressure and test first.'},
      {icon:'🧱',name:'Pavers / Hardscape',strengths:{light:.5,moderate:1,heavy:2},surface:'pavers',ele:.3,note:'Routine organic-growth starting point; verify sealer / surface compatibility.'}
    ];

    const card=document.createElement('div');
    card.id='bobQuickFavorites'; card.className='card bob-quick-card';
    card.innerHTML='<div class="kicker">QUICK PRESET</div><details class="bob-preset-menu" id="bobPresetMenu"><summary id="bobPresetSummary"><span class="bob-preset-summary-icon">✨</span><span class="bob-preset-summary-copy"><strong>Choose a quick preset</strong><small>9 common SH starting mixes</small></span></summary><div class="bob-preset-options" id="bobPresetOptions"></div></details><details class="bob-preset-note" id="bobPresetNote"><summary>Preset notes</summary><div class="bob-fav-note" id="bobFavNote">Starting points only — surface condition and the current product label still control.</div></details>';

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
      if(p.ele===0 && p.eleOptional)return 'Elemonator optional · '+fmtOz(p.eleOptional*batchGallons())+' oz this batch';
      if(p.ele===0)return 'No Elemonator';
      return 'Elemonator '+fmtOz(p.ele*batchGallons())+' oz this batch';
    };
    const summary=$('#bobPresetSummary',card),menu=$('#bobPresetMenu',card),options=$('#bobPresetOptions',card),note=$('#bobFavNote',card),noteWrap=$('#bobPresetNote',card);
    const growthSeg=$('#growthSeg'),growthField=growthSeg?.closest('.field');
    if(growthSeg){
      const medium=$('[data-growth="moderate"]',growthSeg);if(medium)medium.textContent='Medium';
      if(growthField){
        growthField.classList.add('bob-dirtiness-field');
        const label=$('label',growthField);if(label)label.textContent='Dirtiness / organic growth';
        card.insertBefore(growthField,noteWrap);
      }
    }
    const surfaceField=surface?.closest('.field'),surfaceCard=surface?.closest('.card');
    let manualSurface=null,manualSurfaceSummary=null;
    if(surfaceField){
      surfaceField.classList.add('bob-surface-only-field');
      const manual=document.createElement('details');manual.className='bob-manual-surface'; manualSurface=manual;
      const manualSummary=document.createElement('summary');manualSummary.textContent='Other / manual surface'; manualSurfaceSummary=manualSummary;
      const manualBody=document.createElement('div');manualBody.className='bob-manual-surface-body';
      manualBody.appendChild(surfaceField);manual.append(manualSummary,manualBody);
      card.insertBefore(manual,noteWrap);
      if(surfaceCard && !surfaceCard.querySelector('.field'))surfaceCard.remove();
    }
    let activePreset=null,applyingPreset=false;

    const currentGrowth=()=>$('#growthSeg [data-growth].active')?.dataset.growth||'moderate';
    const presetStrength=(p,g=currentGrowth())=>p?.strengths?.[g]??0;

    const setSummary=(p)=>{
      if(!summary)return;
      const g=currentGrowth(),dirt=g==='moderate'?'Medium':g.charAt(0).toUpperCase()+g.slice(1),strength=presetStrength(p,g);
      summary.innerHTML='<span class="bob-preset-summary-icon">'+p.icon+'</span><span class="bob-preset-summary-copy"><strong>'+p.name+'</strong><small>'+dirt+' · '+strength+'% SH · '+surfactantText(p)+'</small></span>';
    };
    const setCustomSummary=()=>{
      if(!summary)return;
      const strength=+($('#targetNum')?.value||0);
      summary.innerHTML='<span class="bob-preset-summary-icon">🛠️</span><span class="bob-preset-summary-copy"><strong>Custom / manual mix</strong><small>'+strength+'% SH · fine-tune below</small></span>';
      const fine=$('#bobRecipeFineTune');if(fine)fine.open=true;
    };

    const applyPresetTarget=(p,g=currentGrowth())=>{
      const desired=presetStrength(p,g),stock=Math.max(0,+($('#stockStrength')?.value||0)),target=$('#targetNum');
      const limited=stock>0&&desired>stock;
      if(target){target.value=limited?stock:desired;fireInput(target);}
      if(limited){
        activePreset=null;setCustomSummary();if(noteWrap)noteWrap.open=true;
        if(note)note.textContent='⚠️ '+p.name+' calls for '+desired+'% SH at this dirtiness level, but your current stock is only '+stock+'%. The recipe was limited to '+stock+'%. Use stronger stock or choose a lower target.';
      }
      return {desired,stock,limited};
    };

    const selectPreset=(p)=>{
      applyingPreset=true;activePreset=p;
      if(surface){surface.value=p.surface;fireInput(surface);}
      if(p.surface&&window.__fireSetDwellForSurface)window.__fireSetDwellForSurface(p.surface);
      const result=applyPresetTarget(p);
      const ele=$('#eleRate'); if(ele){ele.value=p.ele;fireInput(ele);}
      Array.from(card.querySelectorAll('.bob-preset-option')).forEach(b=>(b.classList.toggle('selected',b._bobPreset===p),b.setAttribute('aria-pressed',String(b._bobPreset===p))));
      if(!result.limited)setSummary(p);
      applyingPreset=false;
      if(menu)menu.open=false;
      if(note&&!result.limited){
        const surf=p.ele===0&&p.eleOptional
          ?' Elemonator is optional here; the preset leaves it at 0 oz. Add '+p.eleOptional.toFixed(1)+' oz per gallon of final mixed solution only when extra wetting or dwell is useful.'
          :(p.ele===0?' No Elemonator is added by default.':' Elemonator is set to '+p.ele.toFixed(1)+' oz per gallon of final mixed solution.');
        note.textContent=p.icon+' '+p.name+': '+p.note+surf;
      }
    };

    presets.forEach((p,i)=>{
      const b=document.createElement('button');
      b.type='button'; b.className='bob-preset-option'; b.dataset.presetIndex=String(i); b._bobPreset=p; b.setAttribute('aria-pressed','false');
      const vals=[p.strengths.light,p.strengths.moderate,p.strengths.heavy],fixed=vals.every(v=>v===vals[0]),range=fixed?(vals[0]+'% SH · conservative fixed preset'):(vals.join(' / ')+'% SH · Light / Medium / Heavy');
      b.innerHTML='<span class="bob-preset-option-icon">'+p.icon+'</span><span class="bob-preset-option-copy"><strong>'+p.name+'</strong><small>'+range+'</small></span><span class="bob-preset-check" aria-hidden="true">✓</span>';
      b.addEventListener('click',()=>selectPreset(p));
      options.appendChild(b);
    });

    const refreshAmounts=()=>{
      if(activePreset){
        Array.from(card.querySelectorAll('.bob-preset-option')).forEach(b=>(b.classList.toggle('selected',b._bobPreset===activePreset),b.setAttribute('aria-pressed',String(b._bobPreset===activePreset))));
        setSummary(activePreset);
      }else{
        const g=currentGrowth(),target=+($('#targetNum')?.value||0),ele=+($('#eleRate')?.value||0);
        const current=presets.find(p=>p.surface===surface?.value && Math.abs(target-presetStrength(p,g))<.001 && Math.abs(ele-p.ele)<.001);
        if(current){activePreset=current;Array.from(card.querySelectorAll('.bob-preset-option')).forEach(b=>(b.classList.toggle('selected',b._bobPreset===current),b.setAttribute('aria-pressed',String(b._bobPreset===current))));setSummary(current);}
        else{Array.from(card.querySelectorAll('.bob-preset-option')).forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false')});setCustomSummary();}
      }
    };
    ['#batchPreset','#customBatch','#customUnit'].forEach(sel=>{
      const el=$(sel);if(el){el.addEventListener('input',refreshAmounts);el.addEventListener('change',refreshAmounts);}
    });
    Array.from(document.querySelectorAll('#growthSeg [data-growth]')).forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{
      if(activePreset&&surface?.value===activePreset.surface){
        const p=activePreset,result=applyPresetTarget(p,b.dataset.growth);
        if(!result.limited){
          setSummary(p);
          if(note&&p.surface==='painted')note.textContent='🎨 Painted exterior stays at a conservative 0.5% SH for Light, Medium, and Heavy. Inspect for chalking, peeling, oxidation, or failing coating and test first.';
        }
      }else setCustomSummary();
    },0)));
    surface?.addEventListener('change',()=>setTimeout(()=>{
      if(activePreset&&surface.value!==activePreset.surface)activePreset=null;
      if(!activePreset&&manualSurfaceSummary){
        const label=surface.selectedOptions?.[0]?.textContent||'Manual surface';
        manualSurfaceSummary.textContent='Other · '+label;
        if(document.activeElement===surface&&manualSurface)manualSurface.open=false;
      }
      refreshAmounts();
    },0));
    const markCustom=()=>{
      if(applyingPreset)return;
      if(!activePreset){setCustomSummary();return;}
      const g=currentGrowth(),target=+($('#targetNum')?.value||0),ele=+($('#eleRate')?.value||0);
      if(Math.abs(target-presetStrength(activePreset,g))>.001||Math.abs(ele-activePreset.ele)>.001){activePreset=null;setCustomSummary();}
    };
    $('#targetNum')?.addEventListener('input',markCustom);
    $('#eleRate')?.addEventListener('input',markCustom);
    $('#stockStrength')?.addEventListener('input',()=>setTimeout(()=>{markCustom();refreshAmounts()},0));
    Array.from(document.querySelectorAll('#stockQuick [data-stock]')).forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{markCustom();refreshAmounts()},0)));
    refreshAmounts();

    mix.insertBefore(card,mix.firstElementChild);
  }


  function batchPolish(){
    const preset=$('#batchPreset'),card=preset?.closest('.card');if(!preset||!card)return;
    const kicker=$('.kicker',card),heading=$('h2',card);
    if(kicker)kicker.textContent='BATCH SIZE';
    if(heading)heading.textContent='Choose batch size';

    const selectField=preset.closest('.field'),chips=$('#batchChips'),quickField=chips?.closest('.field'),custom=$('#customBatchWrap');
    if(quickField){quickField.classList.remove('span6');quickField.classList.add('span12')}
    if(selectField)selectField.classList.add('bob-batch-select-field');

    let more=$('#bobBatchMore',card);
    if(!more&&selectField){
      more=document.createElement('details');more.id='bobBatchMore';more.className='bob-batch-more';
      const summary=document.createElement('summary');
      const body=document.createElement('div');body.className='bob-batch-more-body';
      selectField.classList.remove('span6');selectField.classList.add('span12');
      body.appendChild(selectField);if(custom)body.appendChild(custom);
      more.append(summary,body);
      (quickField?.parentElement||card).appendChild(more);
    }

    const refresh=()=>{
      if(!more)return;
      const summary=$('summary',more),opt=preset.selectedOptions?.[0]?.textContent||'More sizes / custom';
      const quick=['1','2','4','5'].includes(preset.value);
      if(summary)summary.textContent=quick?'More sizes / custom':'More sizes · '+opt;
      if(preset.value==='custom')more.open=true;
      else if(document.activeElement===preset)more.open=false;
    };
    if(!preset.dataset.bobBatchBound){
      preset.dataset.bobBatchBound='1';
      preset.addEventListener('change',refresh);
    }
    Array.from(document.querySelectorAll('#batchChips [data-batch]')).forEach(b=>{
      if(b.dataset.bobBatchBound)return;
      b.dataset.bobBatchBound='1';
      b.addEventListener('click',()=>{if(custom)custom.classList.add('hidden');if(more)more.open=false;setTimeout(refresh,0)});
    });
    refresh();
  }

  function recipePolish(){
    const recipe=$('#recipeTitle')?.closest('.card');if(!recipe)return;
    [...recipe.querySelectorAll('h2')].filter(h=>h.textContent.includes('Stock-strength correction')).forEach(h=>h.remove());

    const target=$('#target')?.closest('.field'),ele=$('#eleRate')?.closest('.field'),metrics=$('.metrics',recipe);
    if(target&&ele&&!$('#bobRecipeFineTune',recipe)){
      const targetGrid=target.parentElement;
      const fine=document.createElement('details');fine.id='bobRecipeFineTune';fine.className='bob-recipe-fine';
      const summary=document.createElement('summary');summary.innerHTML='<strong>Fine-tune mix</strong><span>SH % and Elemonator</span>';
      const body=document.createElement('div');body.className='bob-recipe-fine-body grid';
      target.classList.remove('span6');target.classList.add('span6');
      ele.classList.remove('span6');ele.classList.add('span6');
      body.append(target,ele);fine.append(summary,body);
      if(metrics)metrics.insertAdjacentElement('afterend',fine);else recipe.appendChild(fine);
      if(targetGrid&&targetGrid.children.length===0)targetGrid.remove();
    }

    const stock=$('#stockStrength')?.closest('.field'),onHand=$('#shOnHand')?.closest('.field'),note=$('#stockNote');
    if(stock){
      stock.classList.remove('span6');stock.classList.add('span12');
      const label=$('label',stock);if(label)label.textContent='Stock SH strength';
      const row=$('#stockStrength')?.closest('.inputrow');
      if(row&&!$('#bobOtherStock',stock)){
        const other=document.createElement('details');other.id='bobOtherStock';other.className='bob-other-stock';
        const summary=document.createElement('summary');summary.textContent='Other stock %';
        other.append(summary,row);stock.appendChild(other);
      }
    }

    if(onHand && !$('#bobStockExtra',recipe)){
      const wrap=document.createElement('details');wrap.id='bobStockExtra';wrap.className='bob-stock-extra';
      const summary=document.createElement('summary');summary.innerHTML='<strong>Stock on hand</strong><span>Optional batch-count planning</span>';
      const body=document.createElement('div');body.className='bob-stock-extra-body';
      onHand.classList.remove('span6');onHand.classList.add('span12');
      body.appendChild(onHand);if(note)body.appendChild(note);
      wrap.append(summary,body);
      const grid=stock?.closest('.grid');
      (grid?.parentElement||recipe).appendChild(wrap);
    }
  }

  function batchMethodNote(){
    const preset=$('#batchPreset'); if(!preset || $('#bobBatchMethodNote'))return;
    const host=preset.closest('.card')||preset.parentElement;
    const note=document.createElement('div');
    note.id='bobBatchMethodNote'; note.className='bob-batch-method-note';
    const refresh=()=>{
      const v=preset.value;
      const gal=v==='custom'?null:+v;
      if(gal===5){
        note.innerHTML='<strong>🪣 5-gal mix bucket</strong><span>This SH Mix recipe is the <em>finished/direct-application</em> strength. If this bucket will feed your X-Jet or downstream injector, the injector dilutes it again. Use <button type="button" id="bobGoEquipment">Equipment / X-Jet</button> to calculate the required pickup-bucket strength from your real draw ratio.</span>';
        note.classList.add('show');
        $('#bobGoEquipment',note)?.addEventListener('click',()=>$('.tab[data-view="equipment"]')?.click());
      }else{
        note.innerHTML='<strong>💧 Batch-size note</strong><span>SH Mix calculates a finished/direct-application batch. X-Jet and downstream pickup buckets need their injector/draw dilution accounted for separately in Equipment.</span>';
        note.classList.toggle('show',v==='custom');
      }
    };
    host.appendChild(note);
    preset.addEventListener('change',refresh);
    $('#customBatch')?.addEventListener('input',refresh);
    refresh();
  }

  function toolsMenu(){
    const placeInstall=(sheet)=>{
      const install=$('#installBtn');
      if(!install||!sheet)return;
      install.classList.remove('topbtn','install');
      install.classList.add('bob-tools-install');
      install.textContent='⬇️ Install / Update App';
      if(install.parentElement!==sheet)sheet.appendChild(install);
    };

    const existing=$('#bobToolsSheet');
    if(existing){placeInstall(existing);return;}

    const top=$('.toprow'); if(!top)return;
    const btn=document.createElement('button'); btn.type='button'; btn.className='bob-tools-btn'; btn.textContent='🧰 Tools'; btn.setAttribute('aria-label','Tools');
    btn.setAttribute('aria-controls','bobToolsSheet');btn.setAttribute('aria-expanded','false');
    const sheet=document.createElement('div'); sheet.id='bobToolsSheet'; sheet.className='bob-tools-sheet';
    const close=()=>{sheet.classList.remove('open');btn.setAttribute('aria-expanded','false')};
    const items=[['equipment','⚙️ Equipment / X-Jet'],['tools','🧰 Field Tools'],['guide','🛡️ Safety Guide']];
    items.forEach(([view,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.addEventListener('click',()=>{const t=$('.tab[data-view="'+view+'"]'); if(t)t.click(); close();});
      sheet.appendChild(b);
    });
    placeInstall(sheet);
    btn.addEventListener('click',e=>{e.stopPropagation();const open=!sheet.classList.contains('open');sheet.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open))});
    sheet.addEventListener('click',e=>e.stopPropagation());
    document.addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    top.appendChild(btn);
    $('.tabswrap')?.after(sheet);
  }

  function jobPolish(){
    const job=$('#job'); if(!job)return;

    const cards=$$('#job .card');
    const byHeading=(needle)=>cards.find(card=>($('h2',card)?.textContent||'').toLowerCase().includes(needle.toLowerCase()));
    const coverage=byHeading('How much mix');
    const area=byHeading('Area and real coverage helpers');
    const cost=byHeading('Know your cost per batch');
    const estimate=byHeading('Price the whole job');
    const profit=byHeading('Job loadout and profitability');

    if(coverage){
      coverage.classList.add('bob-coverage-card');
      const k=$('.kicker',coverage),h=$('h2',coverage);
      if(k)k.textContent='📐 COVERAGE PLANNER';
      if(h)h.textContent='How much mix will the job need?';
    }

    $$('#job .bob-job-group, #job .bob-job-toggle').forEach(w=>{
      const parent=w.parentElement;
      $$(':scope > .card, :scope > .bob-group-body > .card',w).forEach(card=>parent.insertBefore(card,w));
      w.remove();
    });

    let cursor=null;
    const place=(node)=>{
      if(!node)return;
      if(cursor)cursor.after(node); else job.insertBefore(node,job.firstChild);
      cursor=node;
    };
    place(coverage);

    const one=(card,title,sub)=>{
      if(!card)return;
      const wrap=document.createElement('details');wrap.className='bob-section-toggle bob-job-toggle';
      const summary=document.createElement('summary');summary.innerHTML='<strong>'+title+'</strong><span>'+sub+'</span>';
      wrap.append(summary,card);place(wrap);
    };
    const group=(groupCards,title,sub)=>{
      const present=groupCards.filter(Boolean);if(!present.length)return;
      const wrap=document.createElement('details');wrap.className='bob-section-toggle bob-job-toggle bob-job-group';
      const summary=document.createElement('summary');summary.innerHTML='<strong>'+title+'</strong><span>'+sub+'</span>';
      const body=document.createElement('div');body.className='bob-group-body';
      present.forEach(card=>body.appendChild(card));
      wrap.append(summary,body);place(wrap);
    };

    one(area,'📏 Measure / calibrate','Area and real coverage helpers');
    one(estimate,'💵 Full job estimate','Pricing and customer totals');
    group([cost,profit],'🧪 Cost / profit','Chemical cost, inventory, labor, and field profit');
  }

  function equipmentPolish(){
    const eq=$('#equipment'); if(!eq)return;

    const cards=$$('#equipment .card');
    const byHeading=(needle)=>cards.find(card=>($('h2',card)?.textContent||'').toLowerCase().includes(needle.toLowerCase()));
    const xjetMain=byHeading('X-Jet M5DS Twist');
    const xjetCal=byHeading('X-Jet bucket draw test');
    const downstream=byHeading('Estimate strength hitting the surface');
    const proportioner=byHeading('Three-port proportioner planner');
    const reverseX=byHeading('Mix the X-Jet pickup bucket for a target strength');
    const realInjector=byHeading('Find your real injector ratio');
    const fillTime=byHeading('Fill-time estimate');


    /* Rebuild only our presentation wrappers so Equipment stays compact even
       after late v18 modules inject or rearrange cards. */
    $$('#equipment .bob-equipment-group, #equipment .bob-section-toggle').forEach(w=>{
      const parent=w.parentElement;
      $$(':scope > .card, :scope > .bob-group-body > .card',w).forEach(card=>parent.insertBefore(card,w));
      w.remove();
    });

    let cursor=null;
    const place=(node)=>{
      if(!node)return;
      if(cursor)cursor.after(node); else eq.insertBefore(node,eq.firstChild);
      cursor=node;
    };
    place(xjetMain);
    place(downstream);

    const one=(card,title,sub)=>{
      if(!card)return;
      const wrap=document.createElement('details'); wrap.className='bob-section-toggle';
      const summary=document.createElement('summary'); summary.innerHTML='<strong>'+title+'</strong><span>'+sub+'</span>';
      wrap.append(summary,card); place(wrap);
    };
    const group=(groupCards,title,sub)=>{
      const present=groupCards.filter(Boolean); if(!present.length)return;
      const wrap=document.createElement('details'); wrap.className='bob-section-toggle bob-equipment-group';
      const summary=document.createElement('summary'); summary.innerHTML='<strong>'+title+'</strong><span>'+sub+'</span>';
      const body=document.createElement('div');body.className='bob-group-body';
      present.forEach(card=>body.appendChild(card));
      wrap.append(summary,body); place(wrap);
    };

    one(reverseX,'X-Jet pickup bucket recipe','Build a pickup mix for a delivered target');
    group([xjetCal,realInjector],'Calibration tools','X-Jet and downstream draw tests');
    group([proportioner,fillTime],'Future rig planning','REMCO proportioner, tanks, and fill time');
  }

  function dwellTimerPolish(){
    const card=$('#dwellTimerCard'); if(!card || card.dataset.bobDone)return;
    card.dataset.bobDone='1';
    const min=$('#timerMin'), preset=$('#timerPreset');

    const mini=document.createElement('button');
    mini.type='button'; mini.id='bobDwellMini'; mini.className='bob-dwell-mini';
    mini.innerHTML='<span>⏱️ Dwell</span><strong id="bobDwellMiniText">'+($('#timerDisplay')?.textContent||'05:00')+'</strong>';
    mini.addEventListener('click',()=>{$('.tab[data-view="tools"]')?.click();setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'start'}),100);});
    document.body.appendChild(mini);

    const setMinutes=(n)=>{
      if(!min)return;
      min.value=Math.max(1,Math.min(120,Math.round(n)));
      fireInput(min);
      $$('#dwellQuick [data-dwell-min]').forEach(b=>b.classList.toggle('active',+b.dataset.dwellMin===+min.value));
    };

    $$('#dwellQuick [data-dwell-min]').forEach(b=>b.addEventListener('click',()=>setMinutes(+b.dataset.dwellMin)));
    $('#timerMinus')?.addEventListener('click',()=>{
      if(typeof timerEndAt!=='undefined'&&timerEndAt){timerEndAt-=60000;timerTick();return;}
      setMinutes((+min.value||1)-1);
    });
    $('#timerPlus')?.addEventListener('click',()=>{
      if(typeof timerEndAt!=='undefined'&&timerEndAt){timerEndAt+=60000;timerTick();return;}
      setMinutes((+min.value||1)+1);
    });
    min?.addEventListener('input',()=>$$('#dwellQuick [data-dwell-min]').forEach(b=>b.classList.toggle('active',+b.dataset.dwellMin===+min.value)));

    /* Keep suggested checks tied to the selected SH favorite without auto-starting. */
    const suggested={
      house:5,fencew:3,painted:3,concrete:5,roof:10,brick:5,stucco:3,pavers:5
    };
    window.__fireSetDwellForSurface=(surface)=>{
      const n=suggested[surface];
      if(!n || !preset)return;
      const match=Array.from(preset.options).find(o=>+o.value===n && o.textContent.toLowerCase().includes(
        surface==='house'?'house':
        surface==='fencew'?'wood':
        surface==='painted'?'painted':
        surface==='concrete'?'concrete':
        surface==='roof'?'roof':
        surface==='brick'?'brick':
        surface==='stucco'?'stucco':
        surface==='pavers'?'pavers':''
      ));
      if(match)preset.value=match.value;
      setMinutes(n);
    };
  }

  function toolsPolish(){
    const tools=$('#tools'); if(!tools)return;

    /* Remove any obsolete pre-best-of-both favorite card if an older module restores it. */
    const oldFav=$$(':scope > .card',tools).find(card=>($('h2',card)?.textContent||'').trim()==='Quick Mix Favorites');
    oldFav?.remove();

    const dwell=$('#dwellTimerCard');
    if(dwell && tools.firstElementChild!==dwell)tools.insertBefore(dwell,tools.firstChild);

  }

  function reapplyLateLayout(){
    relabelTabs();
    jobPolish();
    equipmentPolish();
    toolsPolish();
    batchPolish();
    recipePolish();
    syncLateStockTools();
  }

  setTitle(); relabelTabs(); quickFavorites(); batchPolish(); recipePolish(); batchMethodNote(); toolsMenu(); jobPolish(); equipmentPolish(); dwellTimerPolish(); toolsPolish(); syncLateStockTools();
  $('#stockStrength')?.addEventListener('input',syncLateStockTools);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(reapplyLateLayout,0));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(reapplyLateLayout,0));
})();
