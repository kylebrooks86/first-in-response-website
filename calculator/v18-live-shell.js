(()=>{
  if(window.__fireV18LiveShell)return;window.__fireV18LiveShell=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const exactBatch=[['4','4 gallons — FlowZone'],['0.09375','12 fl oz'],['0.125','16 fl oz'],['0.15625','20 fl oz'],['0.1875','24 fl oz'],['0.203125','26 fl oz'],['0.21875','28 fl oz'],['0.25','32 fl oz'],['0.3125','40 fl oz'],['0.375','48 fl oz'],['0.5','64 fl oz / ½ gal'],['0.75','3 quarts'],['1','1 gallon'],['1.5','1½ gallons'],['2','2 gallons'],['2.5','2½ gallons'],['3','3 gallons'],['5','5 gallons'],['7','7 gallons'],['10','10 gallons'],['15','15 gallons'],['20','20 gallons'],['25','25 gallons'],['30','30 gallons'],['35','35 gallons'],['50','50 gallons'],['65','65 gallons'],['75','75 gallons'],['100','100 gallons'],['125','125 gallons'],['150','150 gallons'],['200','200 gallons'],['250','250 gallons'],['custom','Custom amount']];
  const style=()=>{
    if($('#v18-live-shell-style'))return;
    const s=document.createElement('style');s.id='v18-live-shell-style';s.textContent=`
      .topbar{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:#fff!important;box-shadow:none!important}
      .version{color:#949698!important;font-weight:400!important}.version b{display:none!important}
      .stock{background:transparent!important;color:#949698!important;font-weight:400!important;padding:0!important;border-radius:0!important}
      .warn{border-radius:0!important;box-shadow:none!important}
      .card{border-radius:8px!important;box-shadow:0 4px 6px -1px rgba(0,0,0,.05),0 2px 4px -1px rgba(0,0,0,.04)!important}
      .tab{border-radius:0!important}.tab.active{font-weight:700!important}.bottom{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      #mix>.card:nth-child(3){background:#fce4ec!important;border-top:3px solid #f03c3c!important}
      .live-v18-guidance{margin:10px 0 0!important}.live-v18-ele{margin-top:12px}.live-v18-ele label{display:flex;align-items:center;gap:8px;font-weight:600;color:#343a40}.live-v18-ele input{width:auto;min-height:auto}
      body.dark .topbar{background:#121a22!important}.dark .stock,.dark .version{color:#b7c0c7!important}.dark .live-v18-ele label{color:#fff}
    `;document.head.appendChild(s)
  };
  const batchGal=()=>{const p=$('#batchPreset');if(!p)return 4;if(p.value==='custom'){const n=+$('#customBatch')?.value||0,u=$('#customUnit')?.value;return u==='floz'?n/128:u==='quart'?n/4:u==='liter'?n/3.78541:n}return +p.value||4};
  const apply=()=>{
    style();
    const ver=$('.version');if(ver)ver.innerHTML='v18';
    const stock=$('.stock');if(stock)stock.textContent='Stock SH 10%';

    const surface=$('#surface');
    if(surface){
      const card=surface.closest('.card');
      if(card&&!card.querySelector('.live-v18-guidance')){
        const p=document.createElement('p');p.className='muted live-v18-guidance';p.textContent='Start low. Check oxidation, failed paint, outlets, door seals, and delicate fixtures before applying.';card.appendChild(p)
      }
    }

    const bp=$('#batchPreset');if(bp){
      const keep=bp.value;const current=[...bp.options].map(o=>[o.value,o.textContent]);
      if(current.length!==exactBatch.length||current.some((x,i)=>x[0]!==exactBatch[i]?.[0]||x[1]!==exactBatch[i]?.[1])){
        bp.innerHTML=exactBatch.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
        if([...bp.options].some(o=>o.value===keep))bp.value=keep;
      }
    }
    const chips=$('#batchChips');if(chips&&!chips.querySelector('[data-live-custom]')){
      const b=document.createElement('button');b.type='button';b.className='chip';b.dataset.liveCustom='1';b.textContent='Custom amount';b.addEventListener('click',()=>{if(bp){bp.value='custom';bp.dispatchEvent(new Event('change',{bubbles:true}))}});chips.appendChild(b)
    }

    const rt=$('#recipeTitle');if(rt){
      const raw=rt.textContent.toLowerCase();const surfaceName=$('#surface')?.selectedOptions?.[0]?.textContent?.split(' — ')[0]?.toLowerCase()||'house wash';
      const growth=(raw.includes('heavy')?'heavy':raw.includes('light')?'light':'medium');
      rt.textContent=`${batchGal().toFixed(2)} gal ${growth} ${surfaceName}`;
    }

    const ele=$('#eleRate');if(ele){
      ele.type='number';
      const recipe=ele.closest('.card');
      if(recipe&&!recipe.querySelector('.live-v18-ele')){
        const wrap=document.createElement('div');wrap.className='live-v18-ele';wrap.innerHTML='<label><input id="liveIncludeEle" type="checkbox"> Include Elemonator</label><p class="muted" style="margin:5px 0 0"><strong>Add Elemonator</strong><br>Adjustable dosage; included within total batch volume.</p>';
        const host=ele.closest('.field')||ele.parentElement;host.insertAdjacentElement('afterend',wrap);
        const box=$('#liveIncludeEle');box.checked=(+ele.value||0)>0;box.addEventListener('change',()=>{if(box.checked){ele.value=ele.dataset.lastRate||'1'}else{if(+ele.value>0)ele.dataset.lastRate=ele.value;ele.value='0'}ele.dispatchEvent(new Event('input',{bubbles:true}))})
      }
      const recipe=ele.closest('.card');
      if(recipe&&!recipe.textContent.includes('Add water first, then SH, then bleach-stable surfactant. Pre-wet and post-rinse vegetation.')){
        const p=document.createElement('p');p.className='muted';p.textContent='Add water first, then SH, then bleach-stable surfactant. Pre-wet and post-rinse vegetation.';recipe.appendChild(p)
      }
    }

    const factory=[...$$('#equipment .muted')].find(p=>p.textContent.includes('Factory proportions are estimates'));
    if(factory)factory.textContent='Factory proportions are estimates based on a 4 GPM pressure washer at 100 PSI. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.';
    const drawCard=[...$$('#equipment .card')].find(c=>c.textContent.includes('X-Jet bucket draw test'));
    if(drawCard&&!drawCard.textContent.includes('Start with a marked pickup bucket')){
      const p=document.createElement('p');p.className='muted';p.textContent='Start with a marked pickup bucket, spray for the exact time entered, then measure how many fluid ounces disappeared. Water volume is calculated from your pressure-washer GPM × test time. Repeat once to confirm the result.';drawCard.appendChild(p)
    }

    const area=$('#area');if(area&&area.value==='2500')area.value='';
    const timerCard=[...$$('#tools .card')].find(c=>c.textContent.includes('Application Timer'));
    if(timerCard&&!timerCard.textContent.includes('A timer never replaces the product label')){
      const p=document.createElement('p');p.className='muted';p.textContent='A timer never replaces the product label. Watch the surface continuously and rinse sooner if drying or a reaction appears.';timerCard.appendChild(p)
    }

    const safety=[...$$('#guide .card')].find(c=>c.textContent.includes('Quick safety order'));
    if(safety){const ol=$('ol',safety);if(ol){const items=$$('li',ol);if(items[1])items[1].textContent='Wear eye/skin protection and keep people, pets, and plants clear.';if(![...items].some(li=>li.textContent.includes('Rinse tools and do not seal or store mixed SH long-term.'))){const li=document.createElement('li');li.textContent='Rinse tools and do not seal or store mixed SH long-term.';ol.appendChild(li)}}}

    const off=[...$$('#tools .card')].find(c=>c.textContent.includes('Version and offline update'));
    if(off&&!off.textContent.includes('The calculator does not require a sign-in. Your rates, inventory, timer and saved mixes remain on this device and are included in your backup.')){
      const p=document.createElement('p');p.className='muted';p.textContent='The calculator does not require a sign-in. Your rates, inventory, timer and saved mixes remain on this device and are included in your backup.';off.appendChild(p)
    }
    const backup=[...$$('#tools .card')].find(c=>c.textContent.includes('Backup or Restore Field Data'));
    if(backup&&!backup.textContent.includes('Back up your favorites, inventory, mix history, custom chemicals, X-Jet calibration, calculator settings, and current estimate draft.')){
      const p=document.createElement('p');p.className='muted';p.textContent='Back up your favorites, inventory, mix history, custom chemicals, X-Jet calibration, calculator settings, and current estimate draft. If you entered a customer or job name, it is included in the backup.';backup.insertBefore(p,backup.children[2]||null)
    }
  };

  apply();setTimeout(apply,250);setTimeout(apply,1000);setTimeout(apply,3000);
  window.addEventListener('fire-v18-core-ready',apply);window.addEventListener('fire-v18-parity-loaded',apply);
  const mo=new MutationObserver(()=>{clearTimeout(window.__fireV18LiveShellTimer);window.__fireV18LiveShellTimer=setTimeout(apply,80)});mo.observe(document.body,{childList:true,subtree:true});
})();