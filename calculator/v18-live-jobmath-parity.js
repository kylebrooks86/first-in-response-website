(()=>{
  if(window.__fireV18LiveJobMathParity)return;window.__fireV18LiveJobMathParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const num=id=>{const v=parseFloat($('#'+id)?.value);return Number.isFinite(v)?Math.max(0,v):0};
  const calculatedArea=()=>Math.max(0,num('areaLen')*num('areaWid')*Math.max(1,num('areaSides')||1)-num('areaSubtract'));
  const setInput=(id,value)=>{const el=$('#'+id);if(!el)return false;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true};
  const addMeasureShortcuts=()=>{
    const result=$('#areaHelperResult');
    const card=result?.closest('.card');
    if(!result||!card||$('#fireMeasureShortcuts'))return;
    const wrap=document.createElement('div');wrap.id='fireMeasureShortcuts';wrap.className='actions fire-measure-actions';
    const defs=[
      ['Use for mix planning','area',true],
      ['Use for house price','svcHouse',false],
      ['Use for fence price','svcFence',false]
    ];
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
  const apply=()=>{addMeasureShortcuts();labelLiveDefaults()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,900));else setTimeout(apply,900);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,60));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,60));
})();