(()=>{
  if(window.__fireLiveInputContract)return;window.__fireLiveInputContract=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const attr=(id,values)=>{const e=$('#'+id);if(!e)return;for(const [k,v] of Object.entries(values)){if(v===null)e.removeAttribute(k);else e.setAttribute(k,String(v))}};
  const labelOf=e=>(e.closest('.field')?.querySelector('label')?.textContent||document.querySelector(`label[for="${e.id}"]`)?.textContent||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
  const numericByLabel=label=>$$('input[type="number"]').filter(e=>labelOf(e)===label);
  const attrsByLabel=(label,values)=>numericByLabel(label).forEach(e=>{for(const [k,v] of Object.entries(values)){if(v===null)e.removeAttribute(k);else e.setAttribute(k,String(v))}});
  const apply=()=>{
    attr('fireChemAmount',{min:'0.1',max:'100000',step:'0.1'});
    attr('dilFinal',{min:'0.1',step:'0.1'});
    attr('waterParts',{min:'0',step:'0.1'});
    attr('prodParts',{min:'0.1',step:'0.1'});
    attr('timerMin',{min:'0.1',max:'180',step:'0.5'});
    attr('temp',{min:'0',max:'130'});
    attr('wind',{min:'0',max:'100'});
    attr('humidity',{min:'0',max:'100'});

    // Exact live mobile numeric-input metadata/defaults verified at 390×844.
    attrsByLabel('Pressure-washer flow',{min:'1',max:'12',step:'0.1'});
    attrsByLabel('House wash area',{min:'0',step:'10'});
    numericByLabel('House wash area').forEach(e=>{if(e.value==='')e.value='0'});
    attrsByLabel('10% SH Out',{min:'0',step:'0.1'});
    attrsByLabel('Dose or water parts',{min:'0',step:'0.1'});

    const liveLabels={sh:'10% SH Out',ele:'Elemonator Out',gutter:'Gutter Zap Out',bio:'Bio-Clean Out',odo:'OdoBan Out',f9:'F9 BARC Out',ettore:'Ettore Squeegee-Off Out'};
    $$('.fire-inv-row').forEach(row=>{const input=$('input[type="number"]',row);if(input&&liveLabels[row.dataset.invKey]){input.setAttribute('aria-label',liveLabels[row.dataset.invKey]);input.setAttribute('step','0.1')}});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1700));else setTimeout(apply,1700);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,220));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,220));
})();