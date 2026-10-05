(()=>{
  if(window.__fireLiveCustomerParity)return;window.__fireLiveCustomerParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const KEY='fireV18ParityDraft';
  const serviceIds=['svcHouse','svcGutter','svcGuard','svcBright','svcFence','svcW1','svcW2','svcF1','svcF2','svcS1','svcS2','svcDrive','svcFront','svcSide','svcRoof','svcPremiumFence','svcDeck','svcPaver','svcBrick','svcBins','svcDryer','svcDown','svcFrenchDrain','svcAC','svcRV','svcVehicle','svcFrame1','svcFrame2','svcOx','svcCobweb'];
  const draftIds=new Set(['estimateJobName','fullCustomDesc','fullCustomAmt','fullNotes','fullDiscount','fullOverride',...serviceIds]);
  const liveMap={estimateJobName:'estimateJobName',manualAddOnLabel:'fullCustomDesc',manualAddOn:'fullCustomAmt',discountPct:'fullDiscount',quotedPrice:'fullOverride',estimateNotes:'fullNotes',houseWashArea:'svcHouse',gutterFeet:'svcGutter',guardFeet:'svcGuard',brightenFeet:'svcBright',fenceArea:'svcFence',win1:'svcW1',win2:'svcW2',french1:'svcF1',french2:'svcF2',screen1:'svcS1',screen2:'svcS2',drivewayQty:'svcDrive',frontWalkQty:'svcFront',sideWalkQty:'svcSide',roofArea:'svcRoof',premiumFenceArea:'svcPremiumFence',deckArea:'svcDeck',paverArea:'svcPaver',masonryArea:'svcBrick',trashBinQty:'svcBins',dryerVentQty:'svcDryer',undergroundQty:'svcDown',frenchDrainQty:'svcFrenchDrain',acQty:'svcAC',rvQty:'svcRV',vehicleFeet:'svcVehicle',deepFrame1Qty:'svcFrame1',deepFrame2Qty:'svcFrame2',oxidationQty:'svcOx',cobwebQty:'svcCobweb'};
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=d=>{try{localStorage.setItem(KEY,JSON.stringify(d))}catch{}};
  function consumeImportedLiveDraft(){
    if(!localStorage.getItem('fireV18LiveBackupMigratedAt'))return;
    try{
      const live=JSON.parse(localStorage.getItem('fireEstimateDraft')||'{}'),fields=live?.fields||{},d=read();
      let touched=false;
      for(const [liveId,drId] of Object.entries(liveMap)){if(fields[liveId]!==undefined){d[drId]=String(fields[liveId]??'');touched=true}}
      if(touched)write(d);
    }catch{}
  }
  function priceCard(){const editor=$('#priceEditor');return editor?.closest('.card')||[...document.querySelectorAll('#job .card,#view-job .card')].find(c=>c.textContent.includes('Price the whole job'))}
  function associate(el){if(!el)return;const label=el.closest('.field')?.querySelector('label');if(label){label.setAttribute('for',el.id);el.setAttribute('aria-label',label.textContent.trim())}}
  function save(){const d=read();for(const id of draftIds){const e=$('#'+id);if(e)d[id]=e.value}write(d)}
  function restore(){const d=read();for(const [id,v] of Object.entries(d)){const e=$('#'+id);if(e&&v!==undefined&&v!==null)e.value=String(v)}}
  function refreshCalculatedState(){for(const id of ['svcHouse','fullDiscount','fullOverride']){const e=$('#'+id);if(e){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}}
  function saveFromEvent(e){if(draftIds.has(e.target?.id))save()}
  const normalizeQuote=()=>{const q=$('#fullQuote');if(!q)return;const t=q.textContent||'';if(/Prepared for:(?! Customer)/.test(t))q.textContent=t.replace(/Prepared for:[^\n]*/,'Prepared for: Customer')};
  const observeQuote=()=>{const q=$('#fullQuote');if(!q||q.dataset.fireQuoteObserved==='1')return;q.dataset.fireQuoteObserved='1';new MutationObserver(normalizeQuote).observe(q,{childList:true,characterData:true,subtree:true})};
  const currentQuote=()=>{normalizeQuote();return $('#fullQuote')?.textContent||''};
  const copyText=async text=>{try{await navigator.clipboard.writeText(text);window.toast?.('Customer quote copied')}catch{}};
  const shareText=async text=>{if(navigator.share){try{await navigator.share({title:'First In Response Exteriors estimate',text});return}catch(e){if(e?.name==='AbortError')return}}await copyText(text)};
  const printText=text=>{const w=window.open('','_blank');if(!w)return;const escaped=text.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));w.document.write(`<!doctype html><meta charset="utf-8"><title>First In Response Exteriors estimate</title><pre style="white-space:pre-wrap;font:16px/1.45 system-ui,-apple-system,sans-serif;max-width:760px;margin:40px auto">${escaped}</pre>`);w.document.close();w.focus();setTimeout(()=>w.print(),50)};
  const replaceButton=(id,bind)=>{const old=$('#'+id);if(!old)return old;if(old.dataset.fireCustomerBound==='1'){old.onclick=null;return old}const fresh=old.cloneNode(true);fresh.onclick=null;fresh.dataset.fireCustomerBound='1';old.replaceWith(fresh);bind(fresh);return fresh};
  const emit=id=>{const el=$('#'+id);if(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
  const set=id=>value=>{const e=$('#'+id);if(e)e.value=String(value)};
  function clearEstimate(){
    if(!window.confirm('Clear this estimate and job-planning measurements? Your saved pricing will stay unchanged.'))return;
    serviceIds.forEach(id=>{const el=$('#'+id);if(el)el.value='0'});
    const desc=$('#fullCustomDesc'),amt=$('#fullCustomAmt'),notes=$('#fullNotes'),name=$('#estimateJobName');
    if(desc)desc.value='Custom service';if(amt)amt.value='0';if(notes)notes.value='';if(name)name.value='';
    const discount=$('#fullDiscount'),override=$('#fullOverride');if(discount)discount.value='0';if(override)override.value='0';
    set('area')('0');set('areaLen')('0');set('areaWid')('0');set('areaSides')('1');set('areaSubtract')('0');set('calArea')('0');set('calMix')('0');
    emit('area');emit('areaLen');emit('areaWid');emit('areaSides');emit('areaSubtract');emit('calArea');emit('calMix');
    emit('svcHouse');emit('fullDiscount');emit('fullOverride');
    try{localStorage.removeItem('fireV18EstimateDraft');localStorage.removeItem(KEY)}catch{}
    window.toast?.('Estimate cleared');
  }
  function bindLiveActions(){
    observeQuote();normalizeQuote();
    const copy=replaceButton('copyFullQuote',b=>b.addEventListener('click',()=>copyText(currentQuote())));if(copy)copy.onclick=null;
    replaceButton('shareCustomerQuote',b=>b.addEventListener('click',()=>shareText(currentQuote())));
    replaceButton('printCustomerQuote',b=>b.addEventListener('click',()=>printText(currentQuote())));
    replaceButton('clearEstimate',b=>b.addEventListener('click',clearEstimate));
  }
  function apply(){
    const card=priceCard();if(!card)return;
    consumeImportedLiveDraft();
    let name=$('#estimateJobName');
    if(!name){
      const firstDetails=card.querySelector('details');const wrap=document.createElement('div');wrap.className='field live-estimate-name';wrap.innerHTML='<label for="estimateJobName">Customer / job name</label><input id="estimateJobName" type="text" placeholder="Optional — included in copied summary"><p class="muted live-draft-note">Draft saved automatically on this device</p>';
      (firstDetails||card.querySelector('#fullServiceLines')||card.querySelector('h2'))?.insertAdjacentElement(firstDetails?'beforebegin':'afterend',wrap);name=$('#estimateJobName')
    }
    const saved=read();
    const desc=$('#fullCustomDesc'),amt=$('#fullCustomAmt'),notes=$('#fullNotes');
    if(desc&&!saved.fullCustomDesc&&desc.value==='')desc.value='Custom service';
    if(amt&&!saved.fullCustomAmt&&amt.value==='')amt.value='0';
    if(desc)desc.placeholder='Example: patio furniture cleaning';
    if(notes)notes.placeholder='Optional scope, access, scheduling, or surface-condition notes';
    restore();
    for(const id of serviceIds){const el=$('#'+id);if(el&&!Object.prototype.hasOwnProperty.call(saved,id)&&el.value==='')el.value='0'}
    [name,desc,amt,notes,$('#fullDiscount'),$('#fullOverride')].filter(Boolean).forEach(associate);
    save();setTimeout(refreshCalculatedState,0);setTimeout(bindLiveActions,30)
  }
  document.addEventListener('input',e=>{saveFromEvent(e);if(e.target?.closest?.('#job,#view-job'))setTimeout(bindLiveActions,30)},true);
  document.addEventListener('change',e=>{saveFromEvent(e);if(e.target?.closest?.('#job,#view-job'))setTimeout(bindLiveActions,30)},true);
  window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
  apply();window.addEventListener('fire-v18-core-ready',()=>setTimeout(apply,80));window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,80));setTimeout(apply,500);setTimeout(apply,800);setTimeout(apply,1400);
})();