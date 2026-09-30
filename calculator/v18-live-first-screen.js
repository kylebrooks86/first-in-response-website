(()=>{
  if(window.__fireV18LiveFirstScreen)return;window.__fireV18LiveFirstScreen=true;
  const $=(s,r=document)=>r.querySelector(s);
  const moveStockCard=()=>{
    const stock=$('#stockStrength');
    const recipe=$('#recipeTitle')?.closest('.card');
    if(!stock||!recipe||$('#fireStockCard'))return;
    const stockGrid=stock.closest('.grid');
    const stockNote=$('#stockNote');
    let heading=[...recipe.querySelectorAll('h2')].find(h=>h.textContent.includes('Stock-strength correction'));
    if(!heading){heading=document.createElement('h2');heading.textContent='🧪 Stock-strength correction';}
    const card=document.createElement('div');card.className='card';card.id='fireStockCard';
    card.appendChild(heading);
    if(stockGrid)card.appendChild(stockGrid);
    if(stockNote)card.appendChild(stockNote);
    recipe.insertAdjacentElement('afterend',card);
  };
  const moveElemonatorControls=()=>{
    const recipe=$('#recipeTitle')?.closest('.card');
    const ele=$('#eleRate');
    const metrics=recipe?.querySelector('.metrics');
    const toggle=$('.fire-ele-toggle',recipe||document);
    const field=ele?.closest('.field');
    if(!recipe||!ele||!metrics||!field)return;
    const grid=field.parentElement;
    const target=$('#target')?.closest('.field');
    if(target)target.classList.replace('span6','span12');
    if(toggle&&toggle.parentElement!==recipe)recipe.insertBefore(toggle,metrics.nextSibling);
    if(field.parentElement!==recipe)recipe.insertBefore(field,toggle?toggle.nextSibling:metrics.nextSibling);
    field.classList.remove('span6');field.classList.add('span12');
    if(grid&&grid.children.length===0)grid.remove();
  };
  const syncMetrics=()=>{
    const batchSel=$('#batchPreset');
    if(!batchSel)return;
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
    const install=$('#installBtn');if(install){install.textContent='↓';install.setAttribute('aria-label','Install or update calculator');install.classList.remove('hidden')}
  };
  const apply=()=>{header();moveStockCard();moveElemonatorControls();syncMetrics()};
  const bind=()=>{
    ['target','targetNum','stockStrength','shOnHand','eleRate','batchPreset','customBatch','customUnit'].forEach(id=>$('#'+id)?.addEventListener('input',()=>setTimeout(syncMetrics,0)));
    $('#batchPreset')?.addEventListener('change',()=>setTimeout(syncMetrics,0));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{apply();bind()},700));else setTimeout(()=>{apply();bind()},700);
  window.addEventListener('fire-v18-fine-parity-ready',()=>setTimeout(apply,50));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,50));
})();