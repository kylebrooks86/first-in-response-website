(()=>{
  if(window.__fireLiveCustomerParity)return;window.__fireLiveCustomerParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const KEY='fireV18ParityDraft';
  const draftIds=new Set(['estimateJobName','fullCustomDesc','fullCustomAmt','fullNotes']);
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
  const write=d=>{try{localStorage.setItem(KEY,JSON.stringify(d))}catch{}};
  function priceCard(){const editor=$('#priceEditor');return editor?.closest('.card')||[...document.querySelectorAll('#job .card,#view-job .card')].find(c=>c.textContent.includes('Price the whole job'))}
  function associate(el){if(!el)return;const label=el.closest('.field')?.querySelector('label');if(label){label.setAttribute('for',el.id);el.setAttribute('aria-label',label.textContent.trim())}}
  function save(){const d=read(),name=$('#estimateJobName'),desc=$('#fullCustomDesc'),amt=$('#fullCustomAmt'),notes=$('#fullNotes');if(name)d.estimateJobName=name.value;if(desc)d.fullCustomDesc=desc.value;if(amt)d.fullCustomAmt=amt.value;if(notes)d.fullNotes=notes.value;write(d)}
  function saveFromEvent(e){if(draftIds.has(e.target?.id))save()}
  function apply(){
    const card=priceCard();if(!card)return;
    let name=$('#estimateJobName');
    if(!name){
      const firstDetails=card.querySelector('details');const wrap=document.createElement('div');wrap.className='field live-estimate-name';wrap.innerHTML='<label for="estimateJobName">Customer / job name</label><input id="estimateJobName" type="text" placeholder="Optional — included in copied summary"><p class="muted live-draft-note">Draft saved automatically on this device</p>';
      (firstDetails||card.querySelector('#fullServiceLines')||card.querySelector('h2'))?.insertAdjacentElement(firstDetails?'beforebegin':'afterend',wrap);name=$('#estimateJobName')
    }
    const saved=read();if(name&&name.value===''&&saved.estimateJobName!==undefined)name.value=saved.estimateJobName;
    const desc=$('#fullCustomDesc'),amt=$('#fullCustomAmt'),notes=$('#fullNotes');
    if(desc){desc.placeholder='Example: patio furniture cleaning';if(desc.value===''&&saved.fullCustomDesc===undefined)desc.value='Custom service';else if(desc.value===''&&saved.fullCustomDesc!==undefined)desc.value=saved.fullCustomDesc}
    if(amt){if(amt.value===''&&saved.fullCustomAmt===undefined)amt.value='0';else if(amt.value===''&&saved.fullCustomAmt!==undefined)amt.value=saved.fullCustomAmt}
    if(notes){notes.placeholder='Optional scope, access, scheduling, or surface-condition notes';if(notes.value===''&&saved.fullNotes!==undefined)notes.value=saved.fullNotes}
    [name,desc,amt,notes].filter(Boolean).forEach(associate);
    save();
  }
  document.addEventListener('input',saveFromEvent,true);document.addEventListener('change',saveFromEvent,true);
  window.addEventListener('pagehide',save);window.addEventListener('beforeunload',save);
  apply();window.addEventListener('fire-v18-core-ready',()=>setTimeout(apply,80));window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(apply,80));setTimeout(apply,500);setTimeout(apply,1400);
})();