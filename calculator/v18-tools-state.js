(()=>{
if(window.__fireV18ToolsState)return;window.__fireV18ToolsState=true;
const $=(s,r=document)=>r.querySelector(s);
const KEY='fireV18ToolsState';
const ids=['timerPreset','timerMin','temp','wind','sun','humidity'];
const safeParse=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}};
const save=()=>{const d={};for(const id of ids){const e=$('#'+id);if(e)d[id]=e.value}try{localStorage.setItem(KEY,JSON.stringify(d))}catch{}};
const restore=()=>{const d=safeParse();for(const id of ids){const e=$('#'+id);if(e&&d[id]!==undefined)e.value=String(d[id])}
 const min=$('#timerMin'),preset=$('#timerPreset');if(min)min.dispatchEvent(new Event('input',{bubbles:true}));
 if(preset&&d.timerPreset!==undefined){const wanted=String(d.timerPreset);if(wanted.startsWith('custom-')){let opt=[...preset.options].find(o=>o.dataset.bobCustomDwell==='1');if(!opt){opt=document.createElement('option');opt.dataset.bobCustomDwell='1';opt.disabled=true;preset.appendChild(opt)}const mins=String(d.timerMin??wanted.slice(7));opt.value='custom-'+mins;opt.textContent='⏱️ Custom — '+mins+' min';opt.selected=true}else if([...preset.options].some(o=>o.value===wanted))preset.value=wanted}
 for(const id of ['temp','wind','sun','humidity'])$('#'+id)?.dispatchEvent(new Event('input',{bubbles:true}));
};
function bind(){restore();for(const id of ids){const e=$('#'+id);if(!e)continue;e.addEventListener('input',save);e.addEventListener('change',save)}
 const favs=[...document.querySelectorAll('.fav')];for(const b of favs)b.addEventListener('click',()=>{try{localStorage.setItem('fireV18LastFavorite',String(b.dataset.fav||''))}catch{}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,350));else setTimeout(bind,350);
})();