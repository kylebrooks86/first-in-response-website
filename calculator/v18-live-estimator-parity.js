(()=>{
  if(window.__fireV18LiveEstimatorParity)return;window.__fireV18LiveEstimatorParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const ensure=()=>{
    const discount=$('#fullDiscount');
    if(discount){discount.step='0.5';}
    const override=$('#fullOverride');
    if(override){override.step='1';}

    const quote=$('#fullQuote');
    const copy=$('#copyFullQuote');
    const save=$('#saveFullDraft');
    if(save)save.classList.add('hidden');
    if(copy){copy.textContent='Copy customer quote';copy.classList.add('primary');}

    const actions=copy?.closest('.actions');
    if(actions&&!$('#shareCustomerQuote')){
      const share=document.createElement('button');
      share.id='shareCustomerQuote';share.type='button';share.textContent='Share quote';
      share.addEventListener('click',async()=>{
        const text=quote?.textContent||'';
        if(navigator.share){try{await navigator.share({title:'FIRE Estimate',text});return}catch(e){if(e?.name==='AbortError')return}}
        try{await navigator.clipboard.writeText(text);window.toast?.('Quote copied for sharing')}catch{window.toast?.('Share unavailable')}
      });
      actions.appendChild(share);
    }
    if(actions&&!$('#printCustomerQuote')){
      const print=document.createElement('button');
      print.id='printCustomerQuote';print.type='button';print.textContent='Print / Save PDF';
      print.addEventListener('click',()=>window.print());
      actions.appendChild(print);
    }

    if(discount&&!$('#clearDiscount')){
      const row=discount.closest('.inputrow')||discount.parentElement;
      const clear=document.createElement('button');
      clear.id='clearDiscount';clear.type='button';clear.className='chip';clear.textContent='Clear';
      clear.addEventListener('click',()=>{discount.value='0';discount.dispatchEvent(new Event('input',{bubbles:true}))});
      row?.insertAdjacentElement('afterend',clear);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,600));else setTimeout(ensure,600);
  window.addEventListener('fire-v18-core-ready',()=>setTimeout(ensure,50));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(ensure,50));
})();