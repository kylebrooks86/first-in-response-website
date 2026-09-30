(()=>{
  if(window.__fireLiveCustomerParity)return;window.__fireLiveCustomerParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const KEY='fireV18ParityDraft';
  const serviceIds=['svcHouse','svcGutter','svcGuard','svcBright','svcFence','svcW1','svcW2','svcF1','svcF2','svcS1','svcS2','svcDrive','svcFront','svcSide','svcRoof','svcPremiumFence','svcDeck','svcPaver','svcBrick','svcBins','svcDryer','svcDown','svcFrenchDrain','svcAC','svcRV','svcVehicle','svcFrame1','svcFrame2','svcOx','svcCobweb'];
  const draftIds=new Set(['estimateJobName','fullCustomDesc','fullCustomAmt','fullNotes','fullDiscount','fullOverride',...serviceIds]);
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=d=>{try{localStorage.setItem(KEY,JSON.stringify(d))}catch{}};
  function priceCard(){const editor=$('#priceEditor');return editor?.closest('.card')||[...document.querySelectorAll('#job .card,#view-job .card')].find(c=>c.textContent.includes('Price the whole job'))}
  function associate(el){if(!el)return;const label=el.closest('.field')?.querySelector('label');if(label){label.setAttribute('for',el.id);el.setAttribute('aria-label',label.textContent.trim())}}
  function save(){const d=read();for(const id of draftIds){const e=$('#'+id);if(e)d[id]=e.value}write(d)}
  function restore(){const d=read();for(const [id,v] of Object.entries(d)){const e=$('#'+id);if(e&&v!==undefined&&v!==null)e.value=String(v)}}
  function refreshCalculatedState(){for(const id of ['svcHouse','fullDiscount','fullOverride']){const e=$('#'+id);if(e){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}}
  function saveFromEvent(e){if(draftIds.has(e.target?.id))save()}
  function apply(){
    const card=priceCard();if(!card)return;
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
    [name,desc,amt,notes,$('#fullDiscount'),$('#fullOverride')].filter(Boolean).forEach(associate);
    save();setTimeout(refreshCalculatedState,0)
  }
  document.addEventListener('input',saveFromEvent,true);document.addEventListener('change',saveFromEvent,true);
  window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
  apply();window.addEventListener('fire-v18-core-ready',()=>setTimeout(apply,80));window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,80));setTimeout(apply,500);setTimeout(apply,1400);
})();