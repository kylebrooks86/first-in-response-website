(()=>{
  if(window.__fireV18ParityLoader)return;
  window.__fireV18ParityLoader=true;
  const loadCore=()=>new Promise((resolve,reject)=>{
    if(window.__fireFullV18){resolve();return;}
    const s=document.createElement('script');
    s.src='./full-v18-core.js?v=1';
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
  const q=(sel,root=document)=>root.querySelector(sel);
  const qa=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const cardBy=(section,title)=>qa(':scope > .card',section).find(c=>q('h2',c)?.textContent.trim()===title);
  const addStyle=()=>{
    if(document.getElementById('v18-parity-style'))return;
    const st=document.createElement('style');st.id='v18-parity-style';st.textContent=`
      #job>.legacy-estimate,#chemicals>.legacy-chemical-card{display:none!important}
      #equipment>.card,#chemicals>.card,#index>.card,#job>.card,#tools>.card,#guide>.card{margin-top:16px;margin-bottom:16px}
      .stock-correction-title{margin-top:22px!important}
      .live-fill-plan{margin-top:12px}
    `;document.head.appendChild(st);
  };
  const headingBefore=(container,target,title,cls='')=>{
    if(!container||[...container.querySelectorAll('h2')].some(h=>h.textContent.trim()===title))return;
    const h=document.createElement('h2');h.textContent=title;if(cls)h.className=cls;target.before(h);
  };
  const moveOrder=(section,titles)=>titles.forEach(t=>{const c=cardBy(section,t);if(c)section.appendChild(c)});
  const upgradeCoverage=()=>{
    const job=q('#job'),card=job&&cardBy(job,'How much mix should I bring?');if(!card)return;
    const grid=q('.grid',card),metrics=q('.metrics',card);if(!grid||!metrics)return;
    if(!q('#planContainer'))grid.insertAdjacentHTML('beforeend',`<div class="field span4"><label>Sprayer / container size</label><select id="planContainer"><option value="4">4 gal — FlowZone</option><option value="2">2 gal</option><option value="1">1 gal</option><option value="5">5 gal</option><option value="10">10 gal</option></select></div>`);
    const metric=(label,id,value,em)=>`<div class="metric"><small>${label}</small><strong id="${id}">${value}</strong><em>${em}</em></div>`;
    if(!q('#planSh'))metrics.insertAdjacentHTML('beforeend',metric('Total stock SH','planSh','0.00 gal','current strength')+metric('Total water','planWater','0.00 gal','planned solution')+metric('Total Elemonator','planEle','0.0 fl oz','current rate'));
    if(!q('#fillPlan'))card.insertAdjacentHTML('beforeend','<div id="fillPlan" class="note live-fill-plan">Fill plan will appear here.</div>');
    const set=(id,t)=>{const e=q('#'+id);if(e)e.textContent=t};
    const n=(id,d=0)=>{const e=q('#'+id),v=e?parseFloat(e.value):NaN;return Number.isFinite(v)?v:d};
    const calc=()=>{
      const area=Math.max(0,n('area')),cov=Math.max(1,n('coverage',1)),reserve=Math.max(0,n('reserve')),needed=area/cov*(1+reserve/100),cap=Math.max(.01,n('planContainer',4));
      const stock=Math.max(.1,n('stockStrength',10)),target=Math.max(0,n('targetNum',1)),eleRate=Math.max(0,n('eleRate',1));
      const sh=target>stock?0:needed*target/stock,eleOz=needed*eleRate,water=Math.max(0,needed-sh-eleOz/128),fills=Math.ceil(needed/cap);
      set('mixNeeded',needed.toFixed(2)+' gal');set('fills',String(fills));set('planSh',sh.toFixed(2)+' gal');set('planWater',water.toFixed(2)+' gal');set('planEle',eleOz.toFixed(1)+' fl oz');
      const full=Math.floor(needed/cap),rem=needed-full*cap;let txt='Enter measured area and coverage to build a fill plan.';
      if(needed>0){txt=rem<.01?`${full} full ${cap}-gal fill${full===1?'':'s'}.`:`${full?full+' full '+cap+'-gal fill'+(full===1?'':'s')+'. ':''}Final fill: ${rem.toFixed(2)} gal.`}
      set('fillPlan',txt);
    };
    ['area','coverage','reserve','planContainer','stockStrength','targetNum','eleRate'].forEach(id=>q('#'+id)?.addEventListener('input',calc));calc();
  };
  const apply=()=>{
    addStyle();
    const mix=q('#mix'),equipment=q('#equipment'),chemicals=q('#chemicals'),index=q('#index'),job=q('#job'),tools=q('#tools'),guide=q('#guide');
    if(mix){
      const recipe=qa(':scope > .card',mix)[2],stock=q('#stockStrength',recipe||document);if(recipe&&stock){const g=stock.closest('.grid');if(g)headingBefore(recipe,g,'🧪 Stock-strength correction','stock-correction-title')}
    }
    if(equipment)moveOrder(equipment,['X-Jet M5DS Twist — 3–7 GPM','Mix the X-Jet pickup bucket for a target strength','X-Jet bucket draw test','Estimate strength hitting the surface','Find your real injector ratio','Three-port proportioner planner','Fill-time estimate']);
    if(chemicals){
      const c=cardBy(chemicals,'Chemical container presets');if(c)c.classList.add('legacy-chemical-card');
      const first=cardBy(chemicals,'Select a product');if(first){const g=q('.grid',first);if(g)headingBefore(first,g,'Ettore Squeegee-Off')}
    }
    if(index&&tools){['Stain & Surface Finder','Chemical Compatibility Checker'].forEach(t=>{const c=cardBy(index,t);if(c)tools.appendChild(c)})}
    if(guide&&tools){const safety=cardBy(guide,'Field Safety Card');if(safety){if(![...safety.querySelectorAll('h3')].some(h=>h.textContent.includes('Exposure response')))safety.insertAdjacentHTML('beforeend','<h3>🚿 Exposure response</h3><p>Stop work, move to fresh air and rinse exposed skin or eyes with clean water. Follow the product label/SDS; call 911 for a serious reaction.</p>');tools.appendChild(safety)}}
    if(tools)moveOrder(tools,['Quick Mix Favorites','Stain & Surface Finder','Chemical Compatibility Checker','Batch History / Mix Log','Chemical Inventory','Application Timer','Weather Adjustment Guide','Custom Chemical Builder','Version and offline update','Backup or Restore Field Data','Field Safety Card']);
    if(guide)moveOrder(guide,['10% SH service presets','Services that should not default to SH','Quick safety order']);
    if(job){
      const old=qa(':scope > .card',job).find(c=>q('h2',c)?.textContent.trim()==='Price the whole job');
      const full=cardBy(job,'Full FIRE service estimator');
      if(old)old.classList.add('legacy-estimate');
      if(full){q('h2',full).textContent='Price the whole job'}
      moveOrder(job,['How much mix should I bring?','Area and real coverage helpers','Know your cost per batch','Price the whole job','Job loadout and profitability']);
      if(old)job.appendChild(old);
    }
    upgradeCoverage();
  };
  loadCore().then(()=>{requestAnimationFrame(()=>requestAnimationFrame(apply))}).catch(()=>{console.error('FIRE v18 core failed to load')});
})();