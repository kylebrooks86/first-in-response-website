
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
    if(mix)mix.textContent='SH Mix';
    if(chem)chem.textContent='Mixes';
    if(index)index.textContent='Index';
    if(job)job.textContent='Job Plan';
    const tabs=$('.tabs');
    if(tabs && mix && chem && index && job){ tabs.append(mix,chem,index,job); }
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

    }

    const presets=[
      {icon:'🏠',name:'House / Vinyl',pct:1,surface:'house',growth:'moderate',ele:.3,note:'Normal organic growth on vinyl siding, soffit/fascia, or vinyl fence.'},
      {icon:'🪵',name:'Bare Wood Fence',pct:.5,surface:'fencew',growth:'light',ele:.3,note:'Conservative starting mix for unfinished wood. Test first.'},
      {icon:'🧱',name:'Concrete Pre-Treat',pct:2,surface:'concrete',growth:'moderate',ele:0,eleOptional:.3,note:'No surfactant by default. If the concrete is sloped, vertical, very hot/dry, or the solution is drying/running off too quickly, add Elemonator at 0.3 oz per gallon of finished mix for extra wetting and dwell.'},
      {icon:'💦',name:'Concrete Post-Treat',pct:1,surface:'post',growth:'moderate',ele:0,note:'No surfactant by default for a leave-on post-treatment.'},
      {icon:'🏚️',name:'Asphalt Roof / Black Streaks',pct:4,surface:'roof',growth:'moderate',ele:1,note:'Typical black-streak starting mix. Roof preset uses a heavier Elemonator dose for more cling. Verify the shingle manufacturer and never use high pressure.'},
    ];
    const more=[
      {icon:'🎨',name:'Painted Wood / Brick / Masonry',pct:.5,surface:'painted',growth:'moderate',ele:.3,note:'Sound exterior paint only. Check for chalking, peeling, oxidation, or failing coating and test first.'},
      {icon:'🧱',name:'Bare Brick / Masonry',pct:1,surface:'brick',growth:'moderate',ele:.3,note:'For ordinary organic growth on unpainted brick / masonry. Natural stone is not included.'},
      {icon:'🏡',name:'Stucco / Synthetic Stucco',pct:.5,surface:'stucco',growth:'light',ele:.3,note:'Conservative starting point. Low pressure and test first.'},
      {icon:'🧱',name:'Pavers / Hardscape',pct:1,surface:'pavers',growth:'moderate',ele:.3,note:'Routine organic-growth starting point; verify sealer / surface compatibility.'},
    ];

    const card=document.createElement('div');
    card.id='bobQuickFavorites'; card.className='card bob-quick-card';
    card.innerHTML='<div class="kicker">QUICK FAVORITES</div><h2>Common SH starting mixes</h2><p class="muted bob-fav-help">Tap a favorite to load the starting mix. Your batch size stays the same and the recipe updates below.</p><div class="bob-fav-grid" id="bobFavGrid"></div><details class="bob-more-presets"><summary>➕ More presets / special surfaces</summary><div class="bob-fav-grid" id="bobMoreGrid"></div></details><div class="bob-fav-note" id="bobFavNote">Starting points only — surface condition and the current product label still control.</div>';

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
        if(surface){surface.value=p.surface;fireInput(surface);} if(p.surface&&window.__fireSetDwellForSurface)window.__fireSetDwellForSurface(p.surface);
        /* Keep the visible condition aligned with the favorite's actual starting strength. */
        const condition=$('#growthSeg [data-growth="'+(p.growth||'moderate')+'"]'); if(condition)condition.click();
        const target=$('#targetNum'); if(target){target.value=p.pct;fireInput(target);}
        const ele=$('#eleRate'); if(ele){ele.value=p.ele;fireInput(ele);}
        $$('.bob-fav-btn').forEach(x=>x.classList.toggle('active',x===b));
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
      $$('.bob-fav-btn',card).forEach(b=>{
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

  function paintedSurfaceGuard(){
    const surface=$('#surface'),target=$('#targetNum');
    if(!surface||!target)return;
    const enforce=()=>{
      if(surface.value!=='painted')return;
      /* Painted exterior is intentionally a single conservative quick-start value.
         Growth chips must not fall through to the core's unknown-surface 1% fallback. */
      if(Math.abs((+target.value||0)-0.5)>.001){
        target.value='0.5';
        fireInput(target);
      }
      const note=$('#bobFavNote');
      if(note&&!note.textContent.includes('Painted Wood / Brick / Masonry')){
        note.textContent='🎨 Painted exterior: keep the quick-start target at 0.5% SH when changing growth chips. Inspect for chalking, peeling, oxidation, or failing coating and test first; manually fine-tune only after the surface check.';
      }
    };
    surface.addEventListener('change',()=>setTimeout(enforce,0));
    $$('#growthSeg [data-growth]').forEach(b=>b.addEventListener('click',()=>setTimeout(enforce,0)));
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
    if($('#bobToolsSheet'))return;
    const top=$('.toprow'); if(!top)return;
    const btn=document.createElement('button'); btn.type='button'; btn.className='bob-tools-btn'; btn.textContent='Tools';
    btn.setAttribute('aria-controls','bobToolsSheet');btn.setAttribute('aria-expanded','false');
    const sheet=document.createElement('div'); sheet.id='bobToolsSheet'; sheet.className='bob-tools-sheet';
    const close=()=>{sheet.classList.remove('open');btn.setAttribute('aria-expanded','false')};
    const items=[['equipment','Equipment / X-Jet'],['tools','Field Tools'],['guide','Safety Guide']];
    items.forEach(([view,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.addEventListener('click',()=>{const t=$('.tab[data-view="'+view+'"]'); if(t)t.click(); close();});
      sheet.appendChild(b);
    });
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
    syncLateStockTools();
  }

  function chemicalPolish(){
    /* LIVE Mixes is a user-favorite section. Preserve its content and calculator behavior. */
  }

  setTitle(); relabelTabs(); quickFavorites(); paintedSurfaceGuard(); batchMethodNote(); toolsMenu(); jobPolish(); equipmentPolish(); dwellTimerPolish(); toolsPolish(); chemicalPolish(); syncLateStockTools();
  $('#stockStrength')?.addEventListener('input',syncLateStockTools);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(reapplyLateLayout,0));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(reapplyLateLayout,0));
})();
