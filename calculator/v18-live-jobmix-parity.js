(()=>{
  if(window.__fireV18LiveJobMixParity)return;window.__fireV18LiveJobMixParity=true;
  const $=(s,r=document)=>r.querySelector(s);
  const n=(id,d=0)=>{const e=$('#'+id),v=e?parseFloat(e.value):NaN;return Number.isFinite(v)?v:d};
  const containerOptions=[
    ['0.09375','12 fl oz'],['0.125','16 fl oz'],['0.15625','20 fl oz'],['0.1875','24 fl oz'],['0.203125','26 fl oz'],['0.21875','28 fl oz'],['0.25','32 fl oz'],['0.3125','40 fl oz'],['0.375','48 fl oz'],['0.5','64 fl oz / ½ gal'],['0.75','3 quarts'],['1','1 gallon'],['1.5','1½ gallons'],['2','2 gallons'],['2.5','2½ gallons'],['3','3 gallons'],['4','4 gallons — FlowZone'],['5','5 gallons'],['7','7 gallons'],['10','10 gallons'],['15','15 gallons'],['20','20 gallons'],['25','25 gallons'],['30','30 gallons'],['35','35 gallons'],['50','50 gallons'],['65','65 gallons'],['75','75 gallons'],['100','100 gallons'],['125','125 gallons'],['150','150 gallons'],['200','200 gallons'],['250','250 gallons']
  ];
  const recipeFor=gal=>{
    const stock=Math.max(.1,n('stockStrength',10)),target=Math.max(0,n('targetNum',1)),eleRate=Math.max(0,n('eleRate',1));
    const shGal=target>stock?0:gal*target/stock,eleOz=gal*eleRate,water=Math.max(0,gal-shGal-eleOz/128);
    return `${(shGal*128).toFixed(1)} fl oz stock SH + ${water.toFixed(2)} gal water + ${eleOz.toFixed(1)} fl oz Elemonator`;
  };
  const render=()=>{
    const card=$('#jobMixCard')||[...document.querySelectorAll('#job>.card')].find(c=>c.querySelector('h2')?.textContent.trim()==='How much mix should I bring?');
    if(!card)return;
    const select=$('#planContainer');
    if(select&&!select.dataset.liveOptions){
      const current=select.value||'4';
      select.innerHTML=containerOptions.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
      select.value=containerOptions.some(([v])=>v===current)?current:'4';
      select.dataset.liveOptions='1';
    }
    const fill=$('#fillPlan');if(!fill)return;
    let heading=$('#fireExactFillHeading');if(!heading){heading=document.createElement('h3');heading.id='fireExactFillHeading';heading.textContent='Exact fill plan';fill.before(heading)}
    let note=$('#fireCoverageRealityNote');if(!note){note=document.createElement('p');note.id='fireCoverageRealityNote';note.className='muted';note.textContent='Coverage varies sharply with surface porosity, technique, wind, and equipment. Replace the default with your own measured production rate after each job.';fill.insertAdjacentElement('afterend',note)}
    const area=Math.max(0,n('area')),coverage=Math.max(1,n('coverage',1)),reserve=Math.max(0,n('reserve')),needed=area/coverage*(1+reserve/100),cap=Math.max(.01,n('planContainer',4));
    if(needed<=0){fill.textContent='Enter measured area and coverage to build a fill plan.';return}
    const full=Math.floor((needed+1e-9)/cap),rem=Math.max(0,needed-full*cap);
    const parts=[];
    if(full>0)parts.push(`${full} full ${cap.toFixed(2)} gal fill${full===1?'':'s'} (${recipeFor(cap)})`);
    if(rem>.009)parts.push(`Final partial fill: ${rem.toFixed(2)} gal (${recipeFor(rem)}).`);
    else if(parts.length)parts[parts.length-1]+='.';
    fill.textContent=parts.join(' ');
  };
  const bind=()=>{
    render();
    ['area','coverage','reserve','planContainer','stockStrength','targetNum','eleRate'].forEach(id=>{const e=$('#'+id);if(e&&!e.dataset.liveFillBound){e.dataset.liveFillBound='1';e.addEventListener('input',()=>setTimeout(render,0));e.addEventListener('change',()=>setTimeout(render,0))}});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,1000));else setTimeout(bind,1000);
  window.addEventListener('fire-v18-shared-core-ready',()=>setTimeout(bind,80));
  window.addEventListener('fire-v18-parity-loaded',()=>setTimeout(bind,80));
})();