(()=>{
  if(window.__fireV18LiveFirstScreen)return;window.__fireV18LiveFirstScreen=true;
  const $=(s,r=document)=>r.querySelector(s);

  const normalizeRecipe=()=>{
    const recipe=$('#recipeTitle')?.closest('.card');if(!recipe)return;
    const oldStock=$('#fireStockCard');
    if(oldStock){
      const stockGrid=$('#stockStrength')?.closest('.grid'),stockNote=$('#stockNote');
      const heading=[...oldStock.querySelectorAll('h2')].find(h=>h.textContent.includes('Stock-strength correction'));
      if(heading)heading.remove();
      if(stockGrid)recipe.appendChild(stockGrid);
      if(stockNote)recipe.appendChild(stockNote);
      oldStock.remove();
    }
    const heading=[...recipe.querySelectorAll('h2')].find(h=>h.textContent.includes('Stock-strength correction'));
    heading?.remove();
    const target=$('#target')?.closest('.field'),ele=$('#eleRate')?.closest('.field');
    if(target){target.classList.remove('span12');target.classList.add('span6')}
    if(ele){ele.classList.remove('span12');ele.classList.add('span6')}
    $('.fire-ele-toggle',recipe)?.remove();
    let bar=$('#fireMixGradient');
    const metrics=recipe.querySelector('.metrics');
    if(metrics&&!bar){bar=document.createElement('div');bar.id='fireMixGradient';bar.setAttribute('aria-hidden','true');metrics.insertAdjacentElement('afterend',bar)}
    const order=[...recipe.querySelectorAll('p')].find(p=>p.textContent.includes('Add water first, then SH'));
    if(order)order.classList.add('fire-mix-order');
  };

  const syncCustomAmount=()=>{
    const wrap=$('#customBatchWrap'),batch=$('#batchPreset');
    if(wrap&&batch)wrap.classList.toggle('hidden',batch.value!=='custom');
  };

  const syncMetrics=()=>{
    const batchSel=$('#batchPreset');if(!batchSel)return;
    let batch=+batchSel.value||4;
    if(batchSel.value==='custom'){
      const n=+($('#customBatch')?.value||0),u=$('#customUnit')?.value;
      batch=u==='floz'?n/128:u==='quart'?n/4:u==='liter'?n/3.78541:n;
    }
    const stock=Math.max(.1,+($('#stockStrength')?.value||10));
    const target=Math.max(0,+($('#targetNum')?.value||0));
    const eleRate=Math.max(0,+($('#eleRate')?.value||0));
    const sh=batch*target/stock,eleOz=eleRate*batch,water=Math.max(0,batch-sh-eleOz/128);
    if($('#shAmt'))$('#shAmt').textContent=(sh*128).toFixed(1)+' fl oz';
    if($('#shOz'))$('#shOz').textContent=sh.toFixed(4)+' gal';
    if($('#waterAmt'))$('#waterAmt').textContent=water.toFixed(2)+' gal';
    if($('#waterOz'))$('#waterOz').textContent=(water*128).toFixed(1)+' fl oz';
    if($('#eleAmt'))$('#eleAmt').textContent=eleOz.toFixed(1)+' fl oz';
    const eleMetric=$('#eleAmt')?.closest('.metric')?.querySelector('em');if(eleMetric)eleMetric.textContent=eleRate.toFixed(1)+' oz per batch gal';
  };

  const header=()=>{
    const row=$('.toprow'),theme=$('#themeBtn'),version=$('.version'),install=$('#installBtn');
    if(version)version.innerHTML='v18 <b>✓</b>';
    if(install){install.textContent='↓';install.setAttribute('aria-label','Install or update calculator');install.classList.remove('hidden')}
    if(row&&theme&&version&&install){row.appendChild(theme);row.appendChild(version);row.appendChild(install)}
  };

  const apply=()=>{header();normalizeRecipe();syncCustomAmount();syncMetrics()};
  const bind=()=>{
    ['target','targetNum','stockStrength','shOnHand','eleRate','customBatch','customUnit'].forEach(id=>$('#'+id)?.addEventListener('input',()=>setTimeout(syncMetrics,0)));
    $('#batchPreset')?.addEventListener('change',()=>setTimeout(()=>{syncCustomAmount();syncMetrics()},0));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{apply();bind()},700));else setTimeout(()=>{apply();bind()},700);
  window.addEventListener('fire-v18-fine-parity-ready',()=>setTimeout(apply,50));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,50));
})();