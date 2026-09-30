(()=>{
  if(window.__fireV18LiveEstimatorParity)return;window.__fireV18LiveEstimatorParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const serviceDefs=[
    ['svcHouse','House wash','ft²'],['svcGutter','Gutter cleaning + downspout flush','linear ft'],['svcGuard','Guard removal + reinstall','linear ft'],['svcBright','Gutter brightening','linear ft'],['svcFence','Fence cleaning','ft²'],
    ['svcW1','Standard windows — 1st floor','each'],['svcW2','Standard windows — 2nd floor','each'],['svcF1','French panes — 1st floor','each'],['svcF2','French panes — 2nd floor','each'],['svcS1','Screens — 1st floor','each'],['svcS2','Screens — 2nd floor','each'],
    ['svcDrive','Driveway','each'],['svcFront','Front sidewalk + curb','each'],['svcSide','Side sidewalk','each'],['svcRoof','Roof cleaning','ft²'],['svcPremiumFence','Premium fence restoration','ft²'],['svcDeck','Deck cleaning','ft²'],['svcPaver','Paver / stone cleaning','ft²'],['svcBrick','Brick / masonry cleaning','ft²'],
    ['svcBins','Trash bin cleaning','each'],['svcDryer','Dryer vent system','each'],['svcDown','Underground downspout line','each'],['svcFrenchDrain','French drain line','each'],['svcAC','AC condenser rinse','each'],['svcRV','RV wash','each'],['svcVehicle','Boat / trailer / UTV / work truck wash','linear ft'],['svcFrame1','1st Floor Deep Exterior Window Frame & Sill Cleaning','each'],['svcFrame2','2nd Floor Deep Exterior Window Frame & Sill Cleaning','each'],['svcOx','Window-frame oxidation removal','each'],['svcCobweb','Cobweb-removal add-on','each']
  ];
  const serviceIds=serviceDefs.map(x=>x[0]);
  const emit=id=>{const el=$('#'+id);if(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
  const number=v=>{const n=parseFloat(v);return Number.isFinite(n)?n:0};
  const money=n=>'$'+number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const readMoney=id=>number(($('#'+id)?.textContent||'').replace(/[^0-9.-]/g,''));
  const readRate=id=>{const e=$(`[data-rate-id="${id}"]`);return number(e?.value)};
  const formatQty=(qty,unit)=>{const q=Number.isInteger(qty)?qty.toLocaleString('en-US'):qty.toLocaleString('en-US',{maximumFractionDigits:2});if(unit==='ft²')return `${q} ft²`;if(unit==='linear ft')return `${q} linear ft`;return q};
  const liveDate=()=>new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  function buildCustomerQuote(){
    const lines=[];
    for(const [id,label,unit] of serviceDefs){const qty=number($('#'+id)?.value);if(qty<=0)continue;const rate=readRate(id);if(rate<=0)continue;lines.push(`${label}: ${formatQty(qty,unit)} — ${money(qty*rate)}`)}
    const custom=number($('#fullCustomAmt')?.value);if(custom>0)lines.push(`${$('#fullCustomDesc')?.value?.trim()||'Custom service'}: ${money(custom)}`);
    const subtotal=readMoney('fullSubtotal'),total=readMoney('fullTotal'),deposit=readMoney('fullDeposit');
    const who=$('#estimateJobName')?.value?.trim()||'Customer';
    const notes=$('#fullNotes')?.value?.trim();
    const out=['FIRST IN RESPONSE EXTERIORS','CUSTOMER ESTIMATE',`Prepared for: ${who}`,`Date: ${liveDate()}`,'',...lines,'',`Subtotal: ${money(subtotal)}`];
    const discount=number($('#fullDiscount')?.value);if(discount>0)out.push(`Discount: ${discount.toLocaleString('en-US',{maximumFractionDigits:2})}%`);
    out.push(`ESTIMATED TOTAL: ${money(total)}`,`50% deposit to schedule: ${money(deposit)}`,'');
    if(notes)out.push(`Notes: ${notes}`,'');
    out.push('Final scope and price are subject to site verification.');
    return out.join('\n')
  }
  function syncCustomerQuote(){const q=$('#fullQuote');if(!q)return;const has=serviceIds.some(id=>number($('#'+id)?.value)>0)||number($('#fullCustomAmt')?.value)>0;q.textContent=has?buildCustomerQuote():''}
  const copyText=async(text,success='Copied')=>{try{await navigator.clipboard.writeText(text);window.toast?.(success);return true}catch{return false}};
  const shareText=async(title,text,copyMessage)=>{if(navigator.share){try{await navigator.share({title,text});return}catch(e){if(e?.name==='AbortError')return}}await copyText(text,copyMessage)};
  const hasEnteredService=()=>serviceIds.some(id=>number($('#'+id)?.value)>0)||number($('#fullCustomAmt')?.value)>0;
  const normalizeBlank=()=>{if(hasEnteredService()){syncCustomerQuote();return}const lines=$('#fullServiceLines'),quote=$('#fullQuote'),crew=$('#crewSheet');if(lines)lines.textContent='No services entered';if(quote)quote.textContent='';if(crew)crew.textContent=''};
  function openPrintView(text){const w=window.open('','_blank');if(!w)return;const escaped=text.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));w.document.write(`<!doctype html><meta charset="utf-8"><title>First In Response Exteriors estimate</title><pre style="white-space:pre-wrap;font:16px/1.45 system-ui,-apple-system,sans-serif;max-width:760px;margin:40px auto">${escaped}</pre>`);w.document.close();w.focus();setTimeout(()=>w.print(),50)}
  const ensure=()=>{
    const discount=$('#fullDiscount');if(discount)discount.step='0.5';const override=$('#fullOverride');if(override)override.step='1';
    const quote=$('#fullQuote'),copy=$('#copyFullQuote'),save=$('#saveFullDraft');if(save)save.classList.add('hidden');if(copy){copy.textContent='Copy customer quote';copy.classList.add('primary');copy.onclick=()=>copyText(buildCustomerQuote(),'Customer quote copied')}
    const actions=copy?.closest('.actions');
    if(actions&&!$('#shareCustomerQuote')){const share=document.createElement('button');share.id='shareCustomerQuote';share.type='button';share.textContent='Share quote';share.addEventListener('click',()=>shareText('First In Response Exteriors estimate',buildCustomerQuote(),'Quote copied for sharing'));actions.appendChild(share)}
    if(actions&&!$('#printCustomerQuote')){const print=document.createElement('button');print.id='printCustomerQuote';print.type='button';print.textContent='Print / Save PDF';print.addEventListener('click',()=>openPrintView(buildCustomerQuote()));actions.appendChild(print)}
    if(discount&&!$('#bundleDiscount10')){const anchor=discount.closest('.inputrow')||discount.parentElement,row=document.createElement('div');row.className='actions fire-discount-actions';const bundle=document.createElement('button');bundle.id='bundleDiscount10';bundle.type='button';bundle.textContent='+10% bundle';bundle.addEventListener('click',()=>{discount.value=String(Math.min(100,number(discount.value)+10));emit('fullDiscount')});const promo=document.createElement('button');promo.id='promotionDiscount15';promo.type='button';promo.textContent='+15% promotion';promo.addEventListener('click',()=>{discount.value=String(Math.min(100,number(discount.value)+15));emit('fullDiscount')});const clear=document.createElement('button');clear.id='clearDiscount';clear.type='button';clear.textContent='Clear';clear.addEventListener('click',()=>{discount.value='0';emit('fullDiscount')});row.append(bundle,promo,clear);anchor?.insertAdjacentElement('afterend',row)}
    const crew=$('#crewSheet');if(crew&&!$('#crewSheetActions')){const row=document.createElement('div');row.id='crewSheetActions';row.className='actions fire-crew-actions';const copyCrew=document.createElement('button');copyCrew.type='button';copyCrew.id='copyCrewSheet';copyCrew.textContent='Copy crew job sheet';copyCrew.addEventListener('click',()=>copyText(crew.textContent||'','Crew job sheet copied'));const shareCrew=document.createElement('button');shareCrew.type='button';shareCrew.id='shareCrewSheet';shareCrew.textContent='Share crew sheet';shareCrew.addEventListener('click',()=>shareText('FIRE Crew Job Sheet',crew.textContent||'','Crew sheet copied for sharing'));const clearEstimate=document.createElement('button');clearEstimate.type='button';clearEstimate.id='clearEstimate';clearEstimate.className='dangerbtn';clearEstimate.textContent='Clear this estimate';clearEstimate.addEventListener('click',()=>{if(!window.confirm('Clear this estimate?'))return;serviceIds.forEach(id=>{const el=$('#'+id);if(el)el.value=''});['fullCustomDesc','fullCustomAmt','fullNotes','estimateJobName'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});if(discount)discount.value='0';if(override)override.value='0';emit('svcHouse');emit('fullDiscount');emit('fullOverride');try{localStorage.removeItem('fireV18EstimateDraft');localStorage.removeItem('fireV18ParityDraft')}catch{}setTimeout(normalizeBlank,0);window.toast?.('Estimate cleared')});row.append(copyCrew,shareCrew,clearEstimate);crew.insertAdjacentElement('afterend',row)}
    setTimeout(syncCustomerQuote,0);normalizeBlank();
  };
  const schedule=()=>setTimeout(()=>{normalizeBlank();syncCustomerQuote()},0);
  document.addEventListener('input',e=>{if(e.target.matches('#job input,#job textarea,#job select,#view-job input,#view-job textarea,#view-job select'))schedule()},{passive:true});document.addEventListener('change',e=>{if(e.target.matches('#job input,#job textarea,#job select,#view-job input,#view-job textarea,#view-job select'))schedule()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensure,600));else setTimeout(ensure,600);window.addEventListener('fire-v18-core-ready',()=>setTimeout(ensure,50));window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(ensure,50));
})();