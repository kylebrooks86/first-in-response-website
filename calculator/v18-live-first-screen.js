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


  const header=()=>{
    const version=$('.version'),install=$('#installBtn');
    if(version)version.innerHTML='v18 <b>✓</b>';
    if(install){
      install.setAttribute('aria-label','Install or update calculator');install.classList.remove('hidden');
      if(!install.classList.contains('bob-tools-install'))install.textContent='↓';
    }
  };

  const apply=()=>{header();normalizeRecipe();syncCustomAmount()};
  const bind=()=>{
    $('#batchPreset')?.addEventListener('change',()=>setTimeout(syncCustomAmount,0));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{apply();bind()},700));else setTimeout(()=>{apply();bind()},700);
  window.addEventListener('fire-v18-fine-parity-ready',()=>setTimeout(apply,50));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,50));
})();