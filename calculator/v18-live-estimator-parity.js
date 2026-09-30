(()=>{
  if(window.__fireV18LiveEstimatorParity)return;window.__fireV18LiveEstimatorParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const serviceIds=['svcHouse','svcGutter','svcGuard','svcBright','svcFence','svcW1','svcW2','svcF1','svcF2','svcS1','svcS2','svcDrive','svcFront','svcSide','svcRoof','svcPremiumFence','svcDeck','svcPaver','svcBrick','svcBins','svcDryer','svcDown','svcFrenchDrain','svcAC','svcRV','svcVehicle','svcFrame1','svcFrame2','svcOx','svcCobweb'];
  const emit=id=>{const el=$('#'+id);if(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
  const copyText=async(text,success='Copied')=>{try{await navigator.clipboard.writeText(text);window.toast?.(success);return true}catch{return false}};
  const shareText=async(title,text,copyMessage)=>{if(navigator.share){try{await navigator.share({title,text});return}catch(e){if(e?.name==='AbortError')return}}await copyText(text,copyMessage)};
  const hasEnteredService=()=>serviceIds.some(id=>{const n=parseFloat($('#'+id)?.value);return Number.isFinite(n)&&n>0})||((parseFloat($('#fullCustomAmt')?.value)||0)>0);
  const normalizeBlank=()=>{
    if(hasEnteredService())return;
    const lines=$('#fullServiceLines'),quote=$('#fullQuote'),crew=$('#crewSheet');
    if(lines)lines.textContent='No services entered';
    if(quote)quote.textContent='';
    if(crew)crew.textContent='';
  };
  const ensure=()=>{
    const discount=$('#fullDiscount');if(discount)discount.step='0.5';
    const override=$('#fullOverride');if(override)override.step='1';

    const quote=$('#fullQuote'),copy=$('#copyFullQuote'),save=$('#saveFullDraft');
    if(save)save.classList.add('hidden');
    if(copy){copy.textContent='Copy customer quote';copy.classList.add('primary')}
    const actions=copy?.closest('.actions');
    if(actions&&!$('#shareCustomerQuote')){
      const share=document.createElement('button');share.id='shareCustomerQuote';share.type='button';share.textContent='Share quote';
      share.addEventListener('click',()=>shareText('FIRE Estimate',quote?.textContent||'','Quote copied for sharing'));actions.appendChild(share)
    }
    if(actions&&!$('#printCustomerQuote')){
      const print=document.createElement('button');print.id='printCustomerQuote';print.type='button';print.textContent='Print / Save PDF';print.addEventListener('click',()=>window.print());actions.appendChild(print)
    }
    if(discount&&!$('#bundleDiscount10')){
      const anchor=discount.closest('.inputrow')||discount.parentElement,row=document.createElement('div');row.className='actions fire-discount-actions';
      const bundle=document.createElement('button');bundle.id='bundleDiscount10';bundle.type='button';bundle.textContent='+10% bundle';
      bundle.addEventListener('click',()=>{discount.value=String(Math.min(100,(parseFloat(discount.value)||0)+10));emit('fullDiscount')});
      const promo=document.createElement('button');promo.id='promotionDiscount15';promo.type='button';promo.textContent='+15% promotion';
      promo.addEventListener('click',()=>{discount.value=String(Math.min(100,(parseFloat(discount.value)||0)+15));emit('fullDiscount')});
      const clear=document.createElement('button');clear.id='clearDiscount';clear.type='button';clear.textContent='Clear';
      clear.addEventListener('click',()=>{discount.value='0';emit('fullDiscount')});
      row.append(bundle,promo,clear);anchor?.insertAdjacentElement('afterend',row)
    }else if(discount&&!$('#clearDiscount')){
      const anchor=discount.closest('.inputrow')||discount.parentElement,clear=document.createElement('button');clear.id='clearDiscount';clear.type='button';clear.textContent='Clear';
      clear.addEventListener('click',()=>{discount.value='0';emit('fullDiscount')});anchor?.insertAdjacentElement('afterend',clear)
    }

    const crew=$('#crewSheet');
    if(crew&&!$('#crewSheetActions')){
      const row=document.createElement('div');row.id='crewSheetActions';row.className='actions fire-crew-actions';
      const copyCrew=document.createElement('button');copyCrew.type='button';copyCrew.id='copyCrewSheet';copyCrew.textContent='Copy crew job sheet';copyCrew.addEventListener('click',()=>copyText(crew.textContent||'','Crew job sheet copied'));
      const shareCrew=document.createElement('button');shareCrew.type='button';shareCrew.id='shareCrewSheet';shareCrew.textContent='Share crew sheet';shareCrew.addEventListener('click',()=>shareText('FIRE Crew Job Sheet',crew.textContent||'','Crew sheet copied for sharing'));
      const clearEstimate=document.createElement('button');clearEstimate.type='button';clearEstimate.id='clearEstimate';clearEstimate.className='dangerbtn';clearEstimate.textContent='Clear this estimate';
      clearEstimate.addEventListener('click',()=>{
        serviceIds.forEach(id=>{const el=$('#'+id);if(el)el.value=''});
        ['fullCustomDesc','fullCustomAmt','fullNotes','estimateJobName'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});
        if(discount)discount.value='0';if(override)override.value='0';
        emit('svcHouse');emit('fullDiscount');emit('fullOverride');
        try{localStorage.removeItem('fireV18EstimateDraft');localStorage.removeItem('fireV18ParityDraft')}catch{}
        setTimeout(normalizeBlank,0);window.toast?.('Estimate cleared')
      });
      row.append(copyCrew,shareCrew,clearEstimate);crew.insertAdjacentElement('afterend',row)
    }
    normalizeBlank();
  };
  const scheduleBlank=()=>setTimeout(normalizeBlank,0);
  document.addEventListener('input',e=>{if(e.target.matches('#job input,#job textarea,#job select,#view-job input,#view-job textarea,#view-job select'))scheduleBlank()},{passive:true});
  document.addEventListener('change',e=>{if(e.target.matches('#job input,#job textarea,#job select,#view-job input,#view-job textarea,#view-job select'))scheduleBlank()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,600));else setTimeout(ensure,600);
  window.addEventListener('fire-v18-core-ready',()=>setTimeout(ensure,50));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(ensure,50));
})();