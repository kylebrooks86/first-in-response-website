(()=>{
if(window.__fireV18FineParity)return;window.__fireV18FineParity=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const style=document.createElement('style');style.textContent=`
#batchChips{gap:8px;align-items:stretch}#batchChips .chip{min-width:62px;min-height:44px;padding:10px 12px;justify-content:center}
.toprow .version{white-space:nowrap}.toprow .stock{cursor:default}
@media(max-width:560px){#batchChips{display:grid;grid-template-columns:repeat(3,minmax(62px,1fr));width:100%}#batchChips .chip{width:100%}}
`;document.head.appendChild(style);
function apply(){
  const ver=$('.version');if(ver)ver.innerHTML='v18 <b>✓</b>';
  const stock=$('.stock');if(stock)stock.textContent='Stock SH 10%';
  const install=$('#installBtn');if(install){install.classList.remove('hidden');install.textContent='Install';install.addEventListener('click',()=>{setTimeout(()=>{if(!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){const t=$('.toast');if(t){t.textContent='iPhone: Share → Add to Home Screen';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}}},150)},{capture:true})}
  const details=$$('#job details.accord');for(const d of details){if($('summary',d)?.textContent.trim()==='Edit pricing and business rules')d.open=true}
  const chips=$$('#batchChips .chip');chips.forEach(b=>b.setAttribute('aria-pressed',b.classList.contains('active')?'true':'false'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,500));else setTimeout(apply,500);
})();