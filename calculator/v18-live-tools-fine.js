(()=>{
  if(window.__fireV18LiveToolsFine)return;window.__fireV18LiveToolsFine=true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const card=t=>$$('#tools .card').find(c=>c.querySelector('h2')?.textContent.trim()===t);

  const exactCompatibility=()=>{
    const c=card('Chemical Compatibility Checker'),a=$('#compatA'),b=$('#compatB'),out=$('#compatResult');if(!c||!a||!b||!out)return;
    const render=()=>{
      const av=a.options[a.selectedIndex]?.textContent||'',bv=b.options[b.selectedIndex]?.textContent||'';
      if(av.includes('Sodium hypochlorite')&&bv.includes('F9 BARC')){
        out.innerHTML='<strong>DO NOT MIX</strong><p>Sodium hypochlorite (SH) and F9 BARC — porous must stay separate. Dangerous gas, heat, pressure or an unpredictable reaction may occur.</p>';
      }
    };
    if(!a.dataset.liveExactCompat){a.dataset.liveExactCompat='1';a.addEventListener('change',()=>setTimeout(render,0));b.addEventListener('change',()=>setTimeout(render,0))}
    render();setTimeout(render,80);setTimeout(render,300);
  };

  const history=()=>{
    const c=card('Batch History / Mix Log');if(!c)return;
    const log=$('#logCurrentMix',c);if(log){log.textContent='Log current SH mix';log.classList.add('fire-history-log')}
    const clear=$('#clearMixHistory',c);if(clear)clear.classList.add('fire-history-clear');
    const wrap=$('#mixHistory',c);if(wrap){const txt=wrap.textContent.trim();if(!txt||txt==='No mixes logged yet.'||txt==='No batches logged yet.')wrap.innerHTML='<div class="fire-empty-dash">No batches logged yet.</div>'}
  };

  const inventory=()=>{
    const c=card('Chemical Inventory');if(!c)return;
    ['#syncShInventory','#clearInventory'].forEach(s=>$(s,c)?.remove());
    $$('.actions',c).forEach(a=>{if(!a.classList.contains('fire-inv-actions')&&!a.querySelector('#fireUseCurrentSh')&&!a.querySelector('#fireUseSpecialty')){if(!a.children.length)a.remove()}});
    const exact='Inventory stays on this device. Amounts are planning aids—verify the container before a job.';
    const paras=$$('p.muted',c).filter(p=>p.textContent.includes('Inventory stays on this device'));
    paras.forEach((p,i)=>{if(i===0)p.textContent=exact;else p.remove()});
  };

  const customChemical=()=>{
    const c=card('Custom Chemical Builder');if(!c)return;
    const dose=$('#customChemDose',c);if(dose&&!String(dose.value).trim())dose.value='1';
    const add=$('#addCustomChem',c);if(add)add.textContent='Add to chemical calculator';
    const list=$('#customChemList',c);if(list){const txt=list.textContent.trim();if(!txt||/No custom chemicals added/i.test(txt)||/No custom products added/i.test(txt))list.innerHTML='<div class="fire-empty-dash">No custom products added yet.</div>'}
  };

  const version=()=>{
    const c=card('Version and offline update');if(!c)return;
    const h3=$('h3',c);if(h3){h3.classList.add('fire-version-inset');h3.innerHTML='<strong>FIRE Field Calculator v18</strong><span>Version 18 is installed and offline-ready.</span>'}
    const exact='The calculator does not require a sign-in. Your rates, inventory, saved mixes, calculator settings, and current estimate data remain on this device and are included in your backup.';
    const notes=$$('p',c);
    let kept=false;
    notes.forEach(p=>{
      const t=p.textContent.trim();
      if(t.includes('does not require a sign-in')){if(!kept){p.classList.add('muted');p.textContent=exact;kept=true}else p.remove()}
      else if(t.includes('Offline package ready')||t.includes('Standalone/offline files installed'))p.remove();
    });
    $('#offlineStatus',c)?.remove();
  };

  const backup=()=>{
    const c=card('Backup or Restore Field Data');if(!c)return;
    const exp=$('#exportAll',c),copy=$('#copyBackupText',c);if(exp)exp.textContent='Download backup';
    if(exp&&copy){let stack=$('.fire-backup-actions',c);if(!stack){stack=document.createElement('div');stack.className='fire-backup-actions';exp.parentElement?.insertBefore(stack,exp);stack.append(exp,copy)}else{stack.append(exp,copy)}}
  };

  const apply=()=>{exactCompatibility();history();inventory();customChemical();version();backup()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,1400));else setTimeout(apply,1400);
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,180));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,180));
})();