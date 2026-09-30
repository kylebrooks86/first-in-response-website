(()=>{
if(window.__fireV18Behavior)return;window.__fireV18Behavior=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const card=(sec,title)=>sec&&$$(':scope > .card',sec).find(c=>$('h2',c)?.textContent.trim()===title);
const money=n=>'$'+(Number(n)||0).toFixed(2);
const textHas=(root,t)=>root&&root.textContent.includes(t);
const ensureExactCopy=()=>{
  const job=$('#job'),tools=$('#tools');
  const price=card(job,'Price the whole job');
  if(price){
    const name=$('#jobName',price)||$('#jobName');
    if(name&&!name.parentElement.querySelector('.draft-note'))name.insertAdjacentHTML('afterend','<p class="muted draft-note" style="margin:6px 0 0">Draft saves automatically on this device</p>');
    if(!textHas(price,'Discount buttons add together')){
      const notes=$('#quoteNotes',price)||$('textarea',price);
      if(notes)notes.insertAdjacentHTML('afterend','<p class="muted">Discount buttons add together so approved promotions and bundle discounts can stack.</p>');
    }
    if(!textHas(price,'Customer quote')){
      const summary=document.createElement('div');summary.className='quote-parity';summary.innerHTML='<h3>Customer quote</h3><p class="muted">Clean customer copy—internal chemical recipes, inventory, and profit stay private.</p><div id="customerQuoteParity" class="quoteBox">Add services to build the customer quote.</div><h3>Crew job sheet</h3><p class="muted">Internal service totals and planned chemical mix for you or your crew.</p><div id="crewSheetParity" class="quoteBox">Add services to build the crew job sheet.</div>';
      price.appendChild(summary);
    }
  }
  const profit=card(job,'Job loadout and profitability');
  if(profit&&!textHas(profit,'Enter your inventory'))profit.insertAdjacentHTML('afterbegin','<h3>Enter your inventory</h3><p class="muted">Open Tools → Chemical Inventory to compare the planned job against what is on the truck.</p>');
  const version=card(tools,'Version and offline update');
  if(version){
    const h=$('h3',version);if(!h){const el=document.createElement('h3');el.textContent='FIRE Field Calculator v18';$('h2',version)?.after(el)}
    if(!$('#offlineParityStatus',version))version.insertAdjacentHTML('beforeend','<p id="offlineParityStatus" class="muted">Checking offline status…</p><p class="muted">The calculator does not require a sign-in. Your rates, inventory, timer and saved mixes remain on this device and are included in your backup.</p>');
  }
  const backup=card(tools,'Backup or Restore Field Data');
  if(backup&&!textHas(backup,'If you entered a customer or job name'))backup.insertAdjacentHTML('afterbegin','<p class="muted">Back up your favorites, inventory, mix history, custom chemicals, X-Jet calibration, calculator settings, and current estimate draft. If you entered a customer or job name, it is included in the backup.</p>');
};
const qv=id=>{const e=$('#'+id),n=parseFloat(e?.value);return Number.isFinite(n)?n:0};
const serviceIds=['svcHouse','svcGutter','svcGuard','svcBright','svcFence','svcWin1','svcWin2','svcFrench1','svcFrench2','svcScreen1','svcScreen2','svcDrive','svcFrontWalk','svcSideWalk','svcRoof','svcPremiumFence','svcDeck','svcPaver','svcBrick','svcBins','svcDryer','svcUnderground','svcFrenchDrain','svcAC','svcRV','svcVehicle','svcFrame1','svcFrame2','svcOxidation','svcCobweb'];
const rateDefaults={svcHouse:.22,svcGutter:1.5,svcGuard:.5,svcBright:2,svcFence:.4,svcWin1:7,svcWin2:11,svcFrench1:12,svcFrench2:18,svcScreen1:3,svcScreen2:6};
const serviceNames={svcHouse:'House wash',svcGutter:'Gutter cleaning + downspout flush',svcGuard:'Guard removal + reinstall',svcBright:'Gutter brightening',svcFence:'Fence cleaning',svcWin1:'Standard windows — 1st floor',svcWin2:'Standard windows — 2nd floor',svcFrench1:'French panes — 1st floor',svcFrench2:'French panes — 2nd floor',svcScreen1:'Screens — 1st floor',svcScreen2:'Screens — 2nd floor'};
const updateSummaries=()=>{
  const customer=$('#customerQuoteParity'),crew=$('#crewSheetParity');if(!customer&&!crew)return;
  const lines=[];let subtotal=0;
  serviceIds.forEach(id=>{const qty=qv(id);if(!qty)return;let rate=rateDefaults[id]||0;const rateInput=$(`[data-rate-for="${id}"]`);if(rateInput)rate=parseFloat(rateInput.value)||rate;const total=qty*rate;if(total>0){subtotal+=total;lines.push(`${serviceNames[id]||id.replace(/^svc/,'')}: ${money(total)}`)}});
  const custom=qv('customAmt');if(custom){subtotal+=custom;lines.push(`${$('#customDesc')?.value?.trim()||'Custom service'}: ${money(custom)}`)}
  const discount=Math.max(0,Math.min(100,qv('discount'))),override=qv('override');let total=subtotal*(1-discount/100);if(override>0)total=override;if(total>0&&total<150)total=150;const deposit=total*.5;
  const name=$('#jobName')?.value?.trim()||'Customer';
  if(customer)customer.textContent=lines.length?`${name}\n${lines.join('\n')}\n\nTotal: ${money(total)}\n50% deposit to get on the schedule: ${money(deposit)}\nRemaining balance due upon completion: ${money(total-deposit)}`:'Add services to build the customer quote.';
  if(crew)crew.textContent=lines.length?`${name} — Crew Job Sheet\n${lines.join('\n')}\n\nPlanned total: ${money(total)}\nCurrent SH target: ${qv('targetNum').toFixed(2)}%\nPlanned mix: ${($('#mixNeeded')?.textContent||'—')}`:'Add services to build the crew job sheet.';
};
const draftIds=['jobName','quoteNotes','discount','override','customDesc','customAmt',...serviceIds];
const autosave=()=>{
  const data={};draftIds.forEach(id=>{const e=$('#'+id);if(e)data[id]=e.value});try{localStorage.setItem('fireV18ParityDraft',JSON.stringify(data))}catch{}
};
const restore=()=>{try{const d=JSON.parse(localStorage.getItem('fireV18ParityDraft')||'{}');Object.entries(d).forEach(([id,v])=>{const e=$('#'+id);if(e&&v!==undefined&&v!==null)e.value=String(v)})}catch{}};
const offlineStatus=async()=>{const e=$('#offlineParityStatus');if(!e)return;let ready=false;try{if('serviceWorker'in navigator){await navigator.serviceWorker.ready;const keys=await caches.keys();ready=keys.some(k=>k.startsWith('fire-field-calculator-v18'))}}catch{}e.textContent=ready?'Offline package ready on this device.':'Open once online to finish caching the offline package.';e.className=ready?'statusgood':'statuswarn'};
const loadInteractions=()=>{if(document.querySelector('script[data-v18-interactions]'))return;const s=document.createElement('script');s.src='./v18-interactions.js?v=1';s.dataset.v18Interactions='1';document.head.appendChild(s)};
const syncAfterRestore=()=>{restore();updateSummaries();['input','change'].forEach(type=>{document.querySelectorAll('#job input,#job select,#job textarea').forEach(e=>e.dispatchEvent(new Event(type,{bubbles:true})))})};
const bind=()=>{
  ensureExactCopy();restore();updateSummaries();offlineStatus();loadInteractions();
  setTimeout(syncAfterRestore,500);setTimeout(syncAfterRestore,1200);
  document.addEventListener('input',e=>{if(e.target.matches('input,select,textarea')){autosave();updateSummaries()}},{passive:true});
  document.addEventListener('change',e=>{if(e.target.matches('input,select,textarea')){autosave();updateSummaries()}},{passive:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,120));else setTimeout(bind,120);
})();