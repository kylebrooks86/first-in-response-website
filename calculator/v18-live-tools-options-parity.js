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
    ['SH / bleach','Sodium hypochlorite (SH)'],
    ['Acid / F9 BARC','Generic acid cleaner'],
    ['Ammonia cleaner','Ammonia cleaner'],
    ['Unknown product','Unknown product'],
    ['Ettore Squeegee-Off','Ettore Squeegee-Off'],
    ['Dawn dish soap','Dawn dish soap'],
    ['Elemonator','Elemonator'],
    ['Simple Green Pro HD','Simple Green Pro HD'],
    ['Krud Kutter Original','Krud Kutter Original'],
    ["LA’s Totally Awesome","LA’s Totally Awesome"],
    ['F9 BARC — porous','F9 BARC — porous'],
    ['Gutter Zap — Black Streak Gutter Cleaner','Gutter Zap — Black Streak Gutter Cleaner'],
    ['Bio-Clean Hard Water Stain Remover','Bio-Clean Hard Water Stain Remover'],
    ['OdoBan Disinfectant and Odor Eliminator','OdoBan Disinfectant and Odor Eliminator']
  ];
  const fill=(select,options,current)=>{
    if(!select)return;
    const selected=select.value||current||options[0][0];
    select.innerHTML=options.map(([value,label])=>`<option value="${value.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${label}</option>`).join('');
    select.value=options.some(([value])=>value===selected)?selected:(current||options[0][0]);
    select.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const apply=()=>{
    fill($('#stainType'),stainOptions,'algae');
    fill($('#compatA'),compatibilityOptions,'SH / bleach');
    fill($('#compatB'),compatibilityOptions,'F9 BARC — porous');
    const a=$('#compatA'),b=$('#compatB'),out=$('#compatResult');
    if(a&&b&&out&&a.value==='SH / bleach'&&b.value==='F9 BARC — porous'){
      out.innerHTML='<strong>DO NOT MIX</strong><p>Sodium hypochlorite (SH) and F9 BARC — porous must stay separate. Dangerous gas, heat, pressure or an unpredictable reaction may occur.</p>';
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1300));else setTimeout(apply,1300);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,120));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,120));
})();
