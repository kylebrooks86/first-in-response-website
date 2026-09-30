(()=>{
if(window.__fireV18FineParity)return;window.__fireV18FineParity=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const style=document.createElement('style');style.textContent=`
#batchChips{gap:8px;align-items:stretch}#batchChips .chip{min-width:62px;min-height:44px;padding:10px 12px;justify-content:center}
.toprow .version{white-space:nowrap}.toprow .stock{cursor:default;background:transparent!important;color:#6c757d!important;padding:0!important;border-radius:0!important;font-weight:400!important}
@media(max-width:560px){#batchChips{display:grid;grid-template-columns:repeat(3,minmax(62px,1fr));width:100%}#batchChips .chip{width:100%}}
`;document.head.appendChild(style);
function apply(){
  const ver=$('.version');if(ver){ver.textContent='v18';ver.style.color='#949698'}
  const stock=$('.stock');if(stock)stock.textContent='Stock SH 10%';
  const install=$('#installBtn');if(install){install.classList.remove('hidden');install.textContent='Install';install.addEventListener('click',()=>{setTimeout(()=>{if(!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){const t=$('.toast');if(t){t.textContent='iPhone: Share → Add to Home Screen';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}}},150)},{capture:true})}
  const details=$$('#job details.accord');for(const d of details){if($('summary',d)?.textContent.trim()==='Edit pricing and business rules')d.open=true}
  const ele=$('#eleRate');if(ele){ele.type='number';ele.removeAttribute('list')}
  const chips=$$('#batchChips .chip');chips.forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('active')?'true':'false'));

  // Exact wording parity confirmed from the current live v18 calculator.
  const factory=$$('p,.muted').find(e=>e.textContent.trim()==='Factory proportions are estimates. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.');
  if(factory)factory.textContent='Factory proportions are estimates based on a 4 GPM pressure washer at 100 PSI. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.';

  // Restore the final field-safety checklist line present in the live v18 calculator.
  const lists=$$('#guide ul,#guide ol');
  for(const list of lists){
    const txt=list.textContent||'';
    if(txt.includes('Test an inconspicuous spot and start weaker when uncertain.')&&!txt.includes('Rinse tools and do not seal or store mixed SH long-term.')){
      const li=document.createElement('li');li.textContent='Rinse tools and do not seal or store mixed SH long-term.';list.appendChild(li);break;
    }
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,500));else setTimeout(apply,500);
})();