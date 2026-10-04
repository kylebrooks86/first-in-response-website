(()=>{
  if(window.__fireV18LiveToolsOptionsParity)return;window.__fireV18LiveToolsOptionsParity=true;
  const $=s=>document.querySelector(s);
  const stainOptions=[
    ['algae','Green algae / mildew / moss'],
    ['tiger','Gutter tiger stripes / black streaks'],
    ['rust','Rust / fertilizer / battery staining'],
    ['grease','Oil / grease / traffic grime'],
    ['mineral','Hard-water spots / calcium / mineral scale'],
    ['odor','Smoke / musty / pet odor'],
    ['efflorescence','White masonry haze / efflorescence'],
    ['oxidation','Chalky paint / aluminum oxidation'],
    ['dirt','Loose dirt / cobwebs / general soil']
  ];
  const compatibilityOptions=[
    ['sh','Sodium hypochlorite (SH)'],
    ['acid','Generic acid cleaner'],
    ['ammonia','Ammonia cleaner'],
    ['unknown','Unknown product'],
    ['ettore','Ettore Squeegee-Off'],
    ['dawn','Dawn dish soap'],
    ['ele','Elemonator'],
    ['simplegreen','Simple Green Pro HD'],
    ['krud','Krud Kutter Original'],
    ['awesome',"LA’s Totally Awesome"],
    ['f9porous','F9 BARC — porous'],
    ['gutterzap','Gutter Zap — Black Streak Gutter Cleaner'],
    ['bioclean','Bio-Clean Hard Water Stain Remover'],
    ['odoban','OdoBan Disinfectant and Odor Eliminator']
  ];
  const fill=(select,options,current)=>{
    if(!select)return;
    const selected=select.value||current||options[0][0];
    select.innerHTML=options.map(([value,label])=>`<option value="${value.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${label}</option>`).join('');
    select.value=options.some(([value])=>value===selected)?selected:(current||options[0][0]);
  };
  const updateCompatibility=()=>{
    const a=$('#compatA'),b=$('#compatB'),out=$('#compatResult');if(!a||!b||!out)return;
    const av=a.value,bv=b.value,pair=new Set([av,bv]);
    out.className='note';
    if(av===bv){out.innerHTML='<strong>Use caution</strong><br>Choose two different products to check compatibility.';return}
    if(pair.has('sh')&&pair.has('f9porous')){out.className='note dangerText';out.innerHTML='<strong>DO NOT MIX</strong><p>Sodium hypochlorite (SH) and F9 BARC — porous must stay separate. Dangerous gas, heat, pressure or an unpredictable reaction may occur.</p>';return}
    if(pair.has('sh')&&(pair.has('acid')||pair.has('ammonia'))){out.className='note dangerText';out.innerHTML='<strong>Do not mix</strong><br>DANGER: Do not mix these products. SH with acids or ammonia can release dangerous gases. Keep separate and thoroughly rinse equipment.';return}
    out.innerHTML='<strong>Use caution</strong><br>Do not combine products unless the current labels/SDS explicitly allow it. Separate sprayers are preferred.';
  };
  const apply=()=>{
    fill($('#stainType'),stainOptions,'algae');
    fill($('#compatA'),compatibilityOptions,'sh');
    fill($('#compatB'),compatibilityOptions,'f9porous');
    const a=$('#compatA'),b=$('#compatB');
    if(a&&!a.dataset.liveCompatBound){a.dataset.liveCompatBound='1';a.addEventListener('input',updateCompatibility);a.addEventListener('change',updateCompatibility)}
    if(b&&!b.dataset.liveCompatBound){b.dataset.liveCompatBound='1';b.addEventListener('input',updateCompatibility);b.addEventListener('change',updateCompatibility)}
    a?.dispatchEvent(new Event('change',{bubbles:true}));b?.dispatchEvent(new Event('change',{bubbles:true}));updateCompatibility();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1300));else setTimeout(apply,1300);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,120));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,120));
})();
