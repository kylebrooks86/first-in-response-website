(()=>{
  if(window.__fireV18LiveGuideParity)return;window.__fireV18LiveGuideParity=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const rows=[
    ['House wash','vinyl / painted siding','0.75%','1%','1.5%'],
    ['Roof wash','asphalt shingles','3%','4%','5%'],
    ['Roof wash','metal / tile','1.5%','2.5%','3.5%'],
    ['Fence wash','vinyl','0.75%','1%','1.5%'],
    ['Fence wash','wood','0.5%','0.75%','1%'],
    ['Deck','composite','0.5%','0.75%','1%'],
    ['Deck','wood','0.5%','0.75%','1%'],
    ['Concrete','pre-treatment','1.5%','2.5%','3.5%'],
    ['Concrete','post-treatment','0.75%','1%','1.5%'],
    ['Pavers / hardscape','','0.75%','1.5%','2.5%'],
    ['Brick / masonry','','0.75%','1.5%','2.5%'],
    ['Stucco / EIFS','','0.5%','0.75%','1%'],
    ['Aluminum siding / gutters','organics','0.5%','0.75%','1%'],
    ['Pool deck / patio','','0.75%','1.5%','2%'],
    ['Trash bins','','0.5%','0.75%','1%']
  ];
  const buildTable=()=>{
    const guide=$('#guide');if(!guide)return;const first=$(':scope > .card:first-child',guide);if(!first||first.dataset.liveGuide==='1')return;first.dataset.liveGuide='1';
    first.innerHTML=`<div class="kicker">Starting-strength guide</div><h2>10% SH service presets</h2><div class="fire-guide-table"><div class="fire-guide-head"><span>Surface</span><span>Light</span><span>Moderate</span><span>Heavy</span></div>${rows.map(r=>`<div class="fire-guide-row"><span class="fire-guide-surface"><strong>${r[0]}</strong>${r[1]?`<small>${r[1]}</small>`:''}</span><span><b>${r[2]}</b></span><span><b>${r[3]}</b></span><span><b>${r[4]}</b></span></div>`).join('')}</div>`;
  };
  const openLiveAccordion=()=>{
    const guide=$('#guide');if(!guide)return;const second=$(':scope > .card:nth-child(2)',guide);if(!second)return;
    const details=$$('details',second);details.forEach((d,i)=>d.open=i===0);
  };
  const apply=()=>{buildTable();openLiveAccordion()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1120));else setTimeout(apply,1120);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,50));window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,50));
})();