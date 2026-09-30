(()=>{
  if(window.__fireLiveEstimatorFinal)return;window.__fireLiveEstimatorFinal=true;
  const $=(s,r=document)=>r.querySelector(s);
  const serviceIds=['svcHouse','svcGutter','svcGuard','svcBright','svcFence','svcW1','svcW2','svcF1','svcF2','svcS1','svcS2','svcDrive','svcFront','svcSide','svcRoof','svcPremiumFence','svcDeck','svcPaver','svcBrick','svcBins','svcDryer','svcDown','svcFrenchDrain','svcAC','svcRV','svcVehicle','svcFrame1','svcFrame2','svcOx','svcCobweb'];
  const normalizeQuote=()=>{const q=$('#fullQuote');if(!q)return;const t=q.textContent||'';if(t.includes('Prepared for:'))q.textContent=t.replace(/Prepared for:[^\n]*/,'Prepared for: Customer')};
  const quoteText=()=>{normalizeQuote();return $('#fullQuote')?.textContent||''};
  const copy=async text=>{try{await navigator.clipboard.writeText(text);window.toast?.('Customer quote copied')}catch{}};
  const share=async text=>{if(navigator.share){try{await navigator.share({title:'First In Response Exteriors estimate',text});return}catch(e){if(e?.name==='AbortError')return}}await copy(text)};
  const print=text=>{const w=window.open('','_blank');if(!w)return;const escaped=text.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));w.document.write(`<!doctype html><meta charset="utf-8"><title>First In Response Exteriors estimate</title><pre style="white-space:pre-wrap;font:16px/1.45 system-ui,-apple-system,sans-serif;max-width:760px;margin:40px auto">${escaped}</pre>`);w.document.close();w.focus();setTimeout(()=>w.print(),50)};
  const replaceButton=(id,bind)=>{const old=$('#'+id);if(!old||old.dataset.fireFinalBound==='1')return old;const fresh=old.cloneNode(true);fresh.dataset.fireFinalBound='1';old.replaceWith(fresh);bind(fresh);return fresh};
  const emit=id=>{const el=$('#'+id);if(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
  const clearEstimate=()=>{if(!window.confirm('Clear this estimate and job-planning measurements? Your saved pricing will stay unchanged.'))return;serviceIds.forEach(id=>{const el=$('#'+id);if(el)el.value=''});['fullCustomDesc','fullCustomAmt','fullNotes','estimateJobName'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});const d=$('#fullDiscount'),o=$('#fullOverride');if(d)d.value='0';if(o)o.value='0';emit('svcHouse');emit('fullDiscount');emit('fullOverride');try{localStorage.removeItem('fireV18EstimateDraft');localStorage.removeItem('fireV18ParityDraft')}catch{}window.toast?.('Estimate cleared')};
  const apply=()=>{
    normalizeQuote();
    replaceButton('copyFullQuote',b=>b.addEventListener('click',()=>copy(quoteText())));
    replaceButton('shareCustomerQuote',b=>b.addEventListener('click',()=>share(quoteText())));
    replaceButton('printCustomerQuote',b=>b.addEventListener('click',()=>print(quoteText())));
    replaceButton('clearEstimate',b=>b.addEventListener('click',clearEstimate));
  };
  document.addEventListener('input',e=>{if(e.target.closest('#job,#view-job'))setTimeout(apply,0)},{passive:true});
  document.addEventListener('change',e=>{if(e.target.closest('#job,#view-job'))setTimeout(apply,0)},{passive:true});
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,40));
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(apply,40));
  setTimeout(apply,700);setTimeout(apply,1600);
})();