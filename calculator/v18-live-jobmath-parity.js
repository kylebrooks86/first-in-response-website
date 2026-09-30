(()=>{
  if(window.__fireV18LiveJobMathParity)return;window.__fireV18LiveJobMathParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const num=id=>{const v=parseFloat($('#'+id)?.value);return Number.isFinite(v)?Math.max(0,v):0};
  const calculatedArea=()=>Math.max(0,num('areaLen')*num('areaWid')*Math.max(1,num('areaSides')||1)-num('areaSubtract'));
  const setInput=(id,value)=>{const el=$('#'+id);if(!el)return false;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true};
  const plannedMix=()=>{
    const area=num('area'),coverage=Math.max(1,num('coverage')||1),reserve=num('reserve');
    const gallons=area/coverage*(1+reserve/100);
    const stock=Math.max(.1,num('stockStrength')||10),target=num('targetNum'),eleRate=num('eleRate');
    return {gallons,shGal:gallons*target/stock,eleOz:gallons*eleRate};
  };
  const addMeasureShortcuts=()=>{
    const result=$('#areaHelperResult');
    const card=result?.closest('.card');
    if(!result||!card||$('#fireMeasureShortcuts'))return;
    const wrap=document.createElement('div');wrap.id='fireMeasureShortcuts';wrap.className='actions fire-measure-actions';
    const defs=[['Use for mix planning','area',true],['Use for house price','svcHouse',false],['Use for fence price','svcFence',false]];
    defs.forEach(([label,target,primary])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;if(primary)b.classList.add('primary');
      b.addEventListener('click',()=>{const area=Math.round(calculatedArea());if(setInput(target,area)){window.toast?.(`${label}: ${area.toLocaleString()} ft²`)}});
      wrap.appendChild(b);
    });
    result.insertAdjacentElement('afterend',wrap);
  };
  const labelLiveDefaults=()=>{
    const card=$('#jobMixCard');
    if(card){
      const area=$('#area');if(area){const label=area.closest('.field')?.querySelector('label');if(label)label.textContent='Measured area'}
      const cov=$('#coverage');if(cov){const label=cov.closest('.field')?.querySelector('label');if(label)label.textContent='Coverage per gallon'}
      const reserve=$('#reserve');if(reserve){const label=reserve.closest('.field')?.querySelector('label');if(label)label.textContent='Overspray / reserve'}
      const container=$('#planContainer');if(container){const label=container.closest('.field')?.querySelector('label');if(label)label.textContent='Sprayer / container size'}
    }
  };
  const seedFreshInventory=()=>{
    if(localStorage.getItem('fireV18FullState'))return;
    if($('#invSH')&&$('#invSH').value==='5')$('#invSH').value='0';
    if($('#invEle')&&$('#invEle').value==='1')$('#invEle').value='0';
  };
  const decoratePlannedChemicalCost=()=>{
    const p=$('#plannedChemCost');if(!p)return;
    p.classList.remove('muted');p.classList.add('fire-planned-chem-cost');
  };
  const ensureLoadout=()=>{
    const card=$('#jobLoadoutCard')||[...document.querySelectorAll('#job .card')].find(c=>c.querySelector('h2')?.textContent.trim()==='Job loadout and profitability');
    if(!card)return;
    const h3=[...card.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Enter your inventory');
    let status=$('#loadoutStatus');
    if(!status){status=document.createElement('div');status.id='loadoutStatus';status.className='fire-loadout-status';(h3||card.querySelector('.grid')||card.firstChild).before(status)}
    let btn=$('#deductJobLoadout');
    if(!btn){const row=document.createElement('div');row.className='actions fire-loadout-actions';btn=document.createElement('button');btn.id='deductJobLoadout';btn.type='button';btn.textContent='Deduct planned job chemicals';row.appendChild(btn);status.insertAdjacentElement('afterend',row)}
    const render=()=>{
      const plan=plannedMix(),onSh=num('invSH'),onEleOz=num('invEle')*128;
      const needShOz=plan.shGal*128,needEleOz=plan.eleOz;
      const shortSh=Math.max(0,needShOz-onSh*128),shortEle=Math.max(0,needEleOz-onEleOz);
      const isShort=shortSh>.049||shortEle>.049;
      status.className='fire-loadout-status '+(isShort?'is-short':'is-ready');
      if(isShort){
        status.innerHTML=`<strong>Loadout is short</strong><p>SH: ${(onSh*128).toFixed(1)} fl oz on hand / ${needShOz.toFixed(1)} fl oz needed — need ${shortSh.toFixed(1)} fl oz more. Elemonator: ${onEleOz.toFixed(1)} oz on hand / ${needEleOz.toFixed(1)} oz needed — need ${shortEle.toFixed(1)} oz more.</p>`;
      }else{
        status.innerHTML=`<strong>Loadout is ready</strong><p>Planned job chemicals are covered by the inventory currently on this device.</p>`;
      }
      btn.disabled=plan.gallons<=0;
    };
    if(!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>{const plan=plannedMix();setInput('invSH',Math.max(0,num('invSH')-plan.shGal).toFixed(4));setInput('invEle',Math.max(0,num('invEle')-plan.eleOz/128).toFixed(4));render();window.toast?.('Planned job chemicals deducted')})}
    ['area','coverage','reserve','stockStrength','targetNum','eleRate','invSH','invEle'].forEach(id=>{const el=$('#'+id);if(el&&!el.dataset.loadoutBound){el.dataset.loadoutBound='1';el.addEventListener('input',render);el.addEventListener('change',render)}});
    render();
  };
  const apply=()=>{seedFreshInventory();addMeasureShortcuts();labelLiveDefaults();decoratePlannedChemicalCost();ensureLoadout()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,900));else setTimeout(apply,900);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,60));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,60));
})();