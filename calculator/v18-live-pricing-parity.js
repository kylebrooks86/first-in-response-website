(()=>{
  if(window.__fireLivePricingParity)return;window.__fireLivePricingParity=true;
  const defs=[
    ['svcHouse','price_houseWash','House wash / ft²'],
    ['svcGutter','price_gutterClean','Gutter clean / linear ft'],
    ['svcGuard','price_gutterGuards','Guard remove + reinstall / ft'],
    ['svcBright','price_gutterBrightening','Gutter brightening / ft'],
    ['svcW1','price_window1','Standard window — 1st'],
    ['svcW2','price_window2','Standard window — 2nd'],
    ['svcF1','price_french1','French pane — 1st'],
    ['svcF2','price_french2','French pane — 2nd'],
    ['svcS1','price_screen1','Screen — 1st'],
    ['svcS2','price_screen2','Screen — 2nd'],
    ['svcFrame1','price_deepFrame1','1st Floor Deep Exterior Window Frame & Sill Cleaning'],
    ['svcFrame2','price_deepFrame2','2nd Floor Deep Exterior Window Frame & Sill Cleaning'],
    ['svcOx','price_oxidation','Frame oxidation removal'],
    ['svcCobweb','price_cobweb','Cobweb-removal add-on'],
    ['svcFence','price_fence','Fence cleaning / ft²'],
    ['svcPremiumFence','price_premiumFence','Premium fence restoration / ft²'],
    ['svcRoof','price_roof','Roof cleaning / ft²'],
    ['svcDeck','price_deck','Deck cleaning / ft²'],
    ['svcPaver','price_paver','Paver / stone cleaning / ft²'],
    ['svcBrick','price_masonry','Brick / masonry cleaning / ft²'],
    ['svcDrive','price_driveway','Driveway flat rate'],
    ['svcFront','price_frontWalk','Front sidewalk + curb'],
    ['svcSide','price_sideWalk','Side sidewalk'],
    ['svcBins','price_trashBin','Trash bin / each'],
    ['svcDryer','price_dryerVent','Dryer vent system / each'],
    ['svcDown','price_undergroundDownspout','Underground downspout line'],
    ['svcFrenchDrain','price_frenchDrain','French drain line'],
    ['svcAC','price_acCondenser','AC condenser rinse'],
    ['svcRV','price_rvWash','RV wash'],
    ['svcVehicle','price_vehicleLinear','Boat / trailer / vehicle / ft']
  ];
  function apply(){
    const editor=document.querySelector('#priceEditor');if(!editor)return;
    for(const [rateId,liveId,labelText] of defs){
      const input=editor.querySelector(`[data-rate-id="${rateId}"]`);if(!input)continue;
      input.id=liveId;input.setAttribute('aria-label',labelText);
      const row=input.closest('.pricegrid');if(!row)continue;
      row.classList.add('live-price-row');row.dataset.liveRate=rateId;
      const rateField=input.closest('.field');
      const label=rateField?.querySelector('label');if(label)label.textContent=labelText;
      const name=row.querySelector('.name');if(name)name.remove();
      [...row.querySelectorAll('.field')].forEach(field=>{if(field!==rateField)field.remove()});
      editor.appendChild(row);
    }
    const min=document.querySelector('#minJob'),dep=document.querySelector('#depositPct');
    if(min){min.setAttribute('aria-label','Minimum job');min.dataset.liveId='price_minimum'}
    if(dep){dep.setAttribute('aria-label','Deposit percent');dep.dataset.liveId='price_depositPct'}
  }
  apply();window.addEventListener('fire-v18-core-ready',apply);window.addEventListener('fire-v18-parity-loaded',apply);setTimeout(apply,400);setTimeout(apply,1400);
})();