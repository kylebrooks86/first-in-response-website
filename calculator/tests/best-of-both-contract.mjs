import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('calculator');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const index=read('index.html');
const bob=read('best-of-both.js');
const css=read('best-of-both.css');
const loader=read('full-v18.js');
const sw=read('sw.js');
const toolsParity=read('v18-live-tools-parity.js');
const parityCore=read('full-v18-parity-core.js');
const core=read('full-v18-core.js');
const interactions=read('v18-interactions.js');
const portableBackup=read('v18-live-portable-backup.js');
const inputContract=read('v18-live-input-contract.js');
const customerParity=read('v18-live-customer-parity.js');
const backupHydration=read('v18-live-backup-hydration.js');
const toolsState=read('v18-tools-state.js');
const planningState=read('v18-live-planning-state.js');

const fail=msg=>{console.error('BEST-OF-BOTH CONTRACT FAIL:',msg);process.exit(1)};
const ok=(cond,msg)=>{if(!cond)fail(msg)};
const count=(s,re)=>(s.match(re)||[]).length;

const presets=[
  ['House / Vinyl','house',{light:.5,moderate:1,heavy:1.5}],
  ['Bare Wood Fence','fencew',{light:.5,moderate:1,heavy:1.5}],
  ['Painted Wood / Brick / Masonry','painted',{light:.5,moderate:.5,heavy:.5}],
  ['Concrete Pre-Treat','concrete',{light:1,moderate:2,heavy:3}],
  ['Concrete Post-Treat','post',{light:.5,moderate:1,heavy:1.5}],
  ['Asphalt Roof / Black Streaks','roof',{light:3,moderate:4,heavy:5}],
  ['Bare Brick / Masonry','brick',{light:.5,moderate:1,heavy:2}],
  ['Stucco / Synthetic Stucco','stucco',{light:.5,moderate:1,heavy:1.5}],
  ['Pavers / Hardscape','pavers',{light:.5,moderate:1,heavy:2}]
];

ok(count(bob,/icon:/g)===9,'expected exactly 9 quick presets');
const normalizedBob=bob.replace(/(^|[^\d])\.(\d+)/g,(_,prefix,digits)=>prefix+'0.'+digits);
for(const [name,surface,strengths] of presets){
  ok(bob.includes(`name:'${name}'`),`missing quick preset: ${name}`);
  ok(bob.includes(`surface:'${surface}'`),`missing surface binding for ${name}`);
  const shape=`strengths:{light:${strengths.light},moderate:${strengths.moderate},heavy:${strengths.heavy}}`;
  ok(normalizedBob.includes(shape),`wrong Light/Medium/Heavy profile for ${name}`);
}
ok(!/growth:'(?:light|moderate|heavy)'/.test(bob),'quick presets must not reset the global dirtiness selector');
ok(!/\bp\.growth\b/.test(bob),'quick preset selection still references a per-preset dirtiness default');
for(const [,surface] of presets){
  ok(index.includes(`<option value="${surface}"`),`quick preset surface is missing from base surface selector: ${surface}`);
}
for(const [,surface,strengths] of presets){
  const light=String(strengths.light).replace(/^0\./,'.');
  const medium=String(strengths.moderate).replace(/^0\./,'.');
  const heavy=String(strengths.heavy).replace(/^0\./,'.');
  const mapping=`${surface}:{light:${light},moderate:${medium},heavy:${heavy}}`;
  ok(index.includes(mapping),`base surface target map differs from quick preset profile: ${surface}`);
}
ok(bob.includes("const applyPresetTarget=(p,g=currentGrowth())=>"),'shared stock-limit guard is missing from quick preset flow');
ok(bob.includes("applyPresetTarget(p,b.dataset.growth)"),'dirtiness changes bypass the stock-limit guard');
ok(bob.includes("const stockChanged=()=>setTimeout(()=>")&&bob.includes("applyPresetTarget(p,currentGrowth())"),'stock-strength changes bypass the stock-limit guard');
ok(bob.includes("const clearPresetSelection=()=>")&&bob.includes("activePreset=null;clearPresetSelection();setCustomSummary()"),'stock-limited presets can leave a stale selected checkmark');
ok(bob.includes("if(!activePreset){clearPresetSelection();setCustomSummary();return;}")&&bob.includes("activePreset=null;clearPresetSelection();setCustomSummary();"),'manual fine tuning can leave a stale selected preset checkmark');
ok(bob.includes("$('#target')?.addEventListener('input',()=>setTimeout(markCustom,0))"),'SH range slider changes do not clear stale preset state');
ok(bob.includes("preset.dataset.bobBatchBound")&&bob.includes("b.dataset.bobBatchBound"),'batch controls are not protected against duplicate late-layout event binding');
ok(bob.includes("b.classList.toggle('active',quick&&b.dataset.batch===preset.value)"),'quick batch buttons can show stale selection after dropdown or Saved mix restore');
ok(bob.includes("dataset.bobCustomDwell==='1'")&&bob.includes("opt.textContent='⏱️ Custom — '+min.value+' min'"),'manual dwell changes can leave a stale surface suggestion');
ok((bob.match(/\$\$\('#dwellQuick \[data-dwell-min\]'\)\.forEach/g)||[]).length>=4,'dwell quick controls are not using collection-safe handlers');
ok(bob.includes("preset?.addEventListener('change',()=>setTimeout(()=>"+String.fromCharCode(36,36)+"('#dwellQuick [data-dwell-min]').forEach"),'dwell suggestion dropdown does not resync quick minute buttons');
ok(toolsState.includes("wanted.startsWith('custom-')")&&toolsState.includes("o.dataset.bobCustomDwell==='1'")&&toolsState.includes("opt.textContent='⏱️ Custom — '+mins+' min'")&&toolsState.includes("opt.selected=true"),'saved custom dwell timer state cannot be reconstructed deterministically after reload');
ok(bob.includes("#job .bob-section-toggle[open] > summary strong"),'Job Plan open-state preservation is missing');
ok(bob.includes("#equipment .bob-section-toggle[open] > summary strong"),'Equipment open-state preservation is missing');
ok(bob.includes("const currentGrowth=()=>$('#growthSeg [data-growth].active')?.dataset.growth||'moderate'"),'global dirtiness source is missing');

for(const [label,value] of [['Light','light'],['Medium','moderate'],['Heavy','heavy']]){
  ok(index.includes(`data-growth="${value}">${label}</button>`),`missing visible ${label} dirtiness control`);
}
const staticIds=[...index.matchAll(/\\bid="([^"]+)"/g)].map(m=>m[1]);
const duplicateIds=[...new Set(staticIds.filter((id,i,a)=>a.indexOf(id)!==i))];
ok(duplicateIds.length===0,`duplicate static DOM ids: ${duplicateIds.join(', ')}`);
ok(!index.includes('data-growth="moderate">Moderate</button>'),'visible dirtiness label regressed from Medium to Moderate');

for(const size of ['1','2','4','5']){
  ok(index.includes(`data-batch="${size}"`),`missing quick batch size ${size} gal`);
}
ok(count(index,/data-batch="/g)===4,'only 1 / 2 / 4 / 5 gal should be visible quick batch buttons');
ok(bob.includes("More sizes / custom"),'uncommon batch sizes must remain collapsed behind More sizes / custom');

ok(index.includes('data-stock="10"')&&index.includes('data-stock="12.5"'),'10% and 12.5% stock shortcuts must remain visible');
ok(bob.includes("Other stock %"),'manual stock percentage must remain available');
ok(bob.includes("Fine-tune mix"),'manual SH / Elemonator fine tuning must remain available');
ok(bob.includes("$('#bobPresetSummary strong')?.textContent==='Custom / manual mix')fine.open=true"),'restored custom mixes can hide their fine-tune controls');
ok(bob.includes("Other / manual surface"),'manual surface fallback must remain available');
ok(bob.includes("Preset notes"),'preset guidance must remain available without permanent screen clutter');

for(const label of ['🧪 SH Mix','🧴 Mixes','🔎 Index','📐 Job Plan']){
  ok(bob.includes(label),`missing primary nav label ${label}`);
}
ok(css.includes('.tab[data-view="mix"]')&&css.includes('.tab[data-view="chemicals"]')&&css.includes('.tab[data-view="index"]')&&css.includes('.tab[data-view="job"]'),'four primary tab selectors are missing');
ok(css.includes('body.fire-bob .tab{display:none!important'), 'secondary tabs are not hidden by default');
ok(bob.includes("['equipment','⚙️ Equipment / X-Jet']")&&bob.includes("['tools','🧰 Field Tools']")&&bob.includes("['guide','🛡️ Safety Guide']"),'secondary tools are not routed through compact Tools menu');
ok(toolsParity.includes('<h2>Saved mixes</h2>'),'Field Tools saved-mix card is missing');
ok(toolsParity.includes("if(!c){")&&toolsParity.includes("c=document.createElement('div');c.className='card';"),'Saved mixes card is not created when no legacy favorite card exists');
ok(!toolsParity.includes('data-fire-fav="house"')&&!toolsParity.includes('data-fire-fav="concrete"')&&!toolsParity.includes('data-fire-fav="gutter"')&&!toolsParity.includes('data-fire-fav="odoban"'),'duplicate one-tap favorites returned to Field Tools');
ok(toolsParity.includes("stockStrength:n('stockStrength')")&&toolsParity.includes("eleRate:n('eleRate')"),'Saved mixes do not preserve stock strength and Elemonator rate');
ok(toolsParity.includes("hasPreset=[...b.options].some(o=>o.value===value)")&&toolsParity.includes("b.value='custom'"),'Saved custom batch sizes cannot be restored reliably');
ok(toolsParity.includes("if(stockStrength!=null)setVal('stockStrength',stockStrength)")&&toolsParity.includes("const restoredEle=eleRate!=null?eleRate:defaultEleRate[surface]")&&toolsParity.includes("if(restoredEle!=null)setVal('eleRate',restoredEle)"),'Saved mixes do not restore full SH recipe settings');
const restoreStockAt=toolsParity.indexOf("if(stockStrength!=null)setVal('stockStrength',stockStrength)");
const restoreTargetAt=toolsParity.indexOf("setVal('targetNum',target)");
const restoreBatchAt=toolsParity.indexOf("const b=$('#batchPreset')");
ok(restoreStockAt>=0&&restoreTargetAt>restoreStockAt&&restoreBatchAt>restoreTargetAt,'Saved mix batch refresh can run before final stock/target restoration');
ok(toolsParity.includes("const a=savedFavorites(),had=a.some(same)")&&toolsParity.includes("saveFavorites([...a.filter(x=>!same(x)),entry])"),'identical Saved mixes are not deduplicated');
ok(toolsParity.includes("const defaultEleRate={house:.3")&&toolsParity.includes("roof:1"),'legacy Saved mixes have no surfactant fallback migration');
ok(toolsParity.includes("return Array.isArray(data)?data.filter")&&toolsParity.includes("typeof x==='object'"),'Saved mixes do not reject malformed legacy storage');
ok(toolsParity.includes("const esc=s=>String(s??'').replace")&&toolsParity.includes("esc(x.name||'Saved SH mix')"),'Saved mix names are not escaped before rendering');
ok(toolsParity.includes("requestedSurface")&&toolsParity.includes("[...s.options].some(o=>o.value===requestedSurface)"),'Saved mixes do not validate restored surface values');
ok(toolsParity.includes("window.__fireSavedMixRestoreToken=restoreToken")&&toolsParity.includes("if(window.__fireSavedMixRestoreToken===restoreToken)window.__fireRestoringSavedMix=false"),'Saved mix restore token cannot protect overlapping restores');
ok(bob.includes("const restoringSavedMix=()=>window.__fireRestoringSavedMix===true")&&bob.includes("if(applyingPreset||restoringSavedMix())return")&&bob.includes("if(restoringSavedMix())return;\n      if(activePreset){"),'preset listeners can interfere with Saved mix restoration');
ok(parityCore.includes("moveOrder(tools,['Saved mixes'"),'Saved mixes is not ordered in the Field Tools workflow');
ok(!bob.includes('oldFav?.remove()'),'best-of-both late layout can delete the Saved mixes card');
ok(bob.includes("group('🧭 Jobsite reference'")&&bob.includes("group('🧪 Records & chemicals'")&&bob.includes("group('⚙️ App & data'"),'Field Tools compact helper groups are missing');
ok(bob.includes("bob-tools-group[open]")&&bob.includes("wrap.open=openTitles.has(title)"),'Field Tools group open state is not preserved');
ok(parityCore.includes("let planContainerManual=false")&&parityCore.includes("batch?.addEventListener('change',syncBatch)")&&parityCore.includes("if(planContainerManual||!plan||!batch)return"),'Job Plan container can drift from SH batch before a manual planning override');
ok(parityCore.includes("localStorage.getItem('fireV18LivePlanningState')")&&parityCore.includes("saved.planContainerManual===true"),'manual Job Plan container override does not survive reload');
ok(planningState.includes("if(e?.target?.id==='planContainer')o.planContainerManual=true"),'Job Plan persistence does not record explicit manual-container provenance');
ok(!parityCore.includes("saved.planContainer!==undefined"),'saved default Job Plan container can be falsely treated as a manual override');
ok(planningState.includes("let restoring=false,userGeneration=0")&&planningState.includes("if(generation!==userGeneration)return false")&&planningState.includes("const onUserEdit=e=>{if(restoring)return;userGeneration++"),'delayed planning restores can overwrite a real user edit');
ok(planningState.includes("const generation=userGeneration;restore(generation);setTimeout(()=>restore(generation),250);setTimeout(()=>restore(generation),900)"),'planning restore retries are not generation-guarded');
ok(bob.includes("if(guide&&safety&&safety.parentElement===tools)guide.appendChild(safety)"),'Field Safety Card is duplicated inside Field Tools instead of Safety Guide');
ok(interactions.includes("const prefixes=['fireV18','fireFieldCalculator','fireCalcTheme']"),'full offline backup no longer includes fireV18 Saved mixes storage');
ok(interactions.includes("const gal=parseFloat(d.batch)")&&interactions.includes("batch.value='custom'")&&interactions.includes("custom.value=String(gal)"),'mix history reuse cannot restore normalized or custom batch sizes');
ok(core.includes("surface:$('#surface')?.value||'house'")&&core.includes("growth:$('#growthSeg [data-growth].active')?.dataset.growth||'moderate'")&&core.includes("stockStrength:$('#stockStrength')?.value||'10'")&&core.includes("eleRate:$('#eleRate')?.value||'0'"),'new Mix History entries do not preserve the complete SH recipe');
ok(interactions.includes("if(surface&&d.surface&&[...surface.options].some")&&interactions.includes("emit('stockStrength',d.stockStrength)")&&interactions.includes("emit('eleRate',d.eleRate)"),'Mix History reuse does not restore complete SH recipe fields');
ok(interactions.includes("window.__fireRestoringSavedMix=true")&&interactions.includes("window.__fireSavedMixRestoreToken===token"),'Mix History reuse is not protected from preset listener races');
ok(interactions.includes("calc.growth==='medium'?'moderate':calc.growth"),'portable backup restore can lose the Medium dirtiness setting');
ok(portableBackup.includes("k?.startsWith('fire')"),'portable backup no longer captures Saved mixes storage');
ok(portableBackup.includes("target:val('targetNum',prior.target||'1')"),'portable backup does not preserve the fine-tuned SH target');
ok(portableBackup.includes("batchPreset=val('batchPreset'")&&portableBackup.includes("customBatch=val('customBatch'")&&portableBackup.includes("customUnit=val('customUnit'")&&portableBackup.includes("batch:String(batch)"),'portable backup does not preserve the active preset/custom batch');
ok(portableBackup.includes("fields.jobBatchSizeManual=planning.planContainerManual===true"),'portable backup does not preserve Job Plan container override provenance');
ok(interactions.includes("if(fields.jobBatchSizeManual!==undefined)planning.planContainerManual="),'portable restore does not restore Job Plan container override provenance');
ok(interactions.includes("emit('targetNum',calc.target)")&&interactions.indexOf("emit('targetNum',calc.target)")>interactions.indexOf("s.dispatchEvent(new Event('change',{bubbles:true}))"),'portable restore can overwrite a custom SH target after restoring surface/dirtiness');
ok(interactions.includes("if(preset==='custom'&&calc.customBatch!==undefined)")&&interactions.includes("emit('customBatch',calc.customBatch)")&&interactions.includes("emit('customUnit',calc.customUnit||'gal')")&&interactions.includes("batch.dispatchEvent(new Event('change',{bubbles:true}))"),'portable restore cannot reproduce the active preset/custom batch');
const backupValidateAt=interactions.indexOf("const estimate=parsePayload('fireEstimateDraft')");
const backupWriteAt=interactions.indexOf("Object.entries(data.data).forEach");
ok(backupValidateAt>=0&&backupWriteAt>backupValidateAt&&interactions.includes("const xjet=parsePayload('fireXjet')"),'portable v3 backup can write storage before core payload validation');
ok(interactions.includes("k.startsWith('fire')&&typeof v==='string'"),'portable v3 restore can write unrelated local-storage keys');
ok(interactions.includes("const withRestoreTransaction=fn=>")&&interactions.includes("restoreTxn.entries()].reverse()")&&interactions.includes("v===null?localStorage.removeItem(k):localStorage.setItem(k,v)"),'failed backup restore cannot roll touched storage back');
ok(interactions.includes("withRestoreTransaction(()=>migrateLiveV3(data))")&&interactions.includes("withRestoreTransaction(()=>entries.forEach(([k,v])=>restoreSet(k,v)))")&&interactions.includes("else if(data.version===18){withRestoreTransaction"),'not all supported backup formats use transactional restore');
ok(interactions.includes("typeof data.stores!=='object'||Array.isArray(data.stores)")&&interactions.includes("['fireV18','fireFieldCalculator','fireCalcTheme'].some(p=>k.startsWith(p))")&&interactions.includes("entries.some(([k,v])=>typeof k!=='string'||!allowed(k)||typeof v!=='string')"),'native offline backup stores are not fully validated before restore');
ok(backupHydration.includes("const pending=()=>!!localStorage.getItem(marker);"),'ordinary estimate drafts can be mistaken for pending imported backups');
ok(backupHydration.includes("if(finalPass&&localStorage.getItem(marker))")&&backupHydration.includes("localStorage.removeItem(marker)"),'calculator-only portable backups can leave a stale migration marker after final hydration');

ok(css.includes('body.fire-bob #chemicals .card')&&css.includes('body.fire-bob #index .card'),'LIVE Mixes / Index protection rules are missing');
ok(css.includes('font-size:16px!important'),'best-of-both inputs no longer protect against iPhone focus zoom');
ok(css.includes('width:44px!important;min-width:44px!important;min-height:44px!important'),'mobile Tools touch target is below the protected 44x44 size');
ok(css.includes('body.fire-bob .bob-dirtiness-field #growthSeg .chip')&&css.includes('min-height:44px!important'),'dirtiness touch targets are below the protected size');
ok(css.includes('body.fire-bob .fire-saved-fav button')&&css.includes('min-height:44px!important'),'Saved mixes buttons are not protected for iPhone touch use');
ok(css.includes('body.fire-bob .fire-saved-fav small{color:#aab3bb!important}'),'Saved mixes text can regress to low-contrast light-theme colors');
ok(inputContract.includes("$$('.fire-inv-row').forEach"),'inventory input contract is not using the collection selector');
ok(toolsParity.includes("['sh','Stock SH','gal']"),'Chemical Inventory still hard-codes 10% SH');
ok(inputContract.includes("name.textContent=stockText")&&inputContract.includes("label+' amount'")&&inputContract.includes("label+' unit'"),'SH inventory label/accessibility does not track active stock strength');
ok(!inputContract.includes("\n    $('.fire-inv-row').forEach"),'inventory input contract uses a single-element selector as a collection');
ok(!customerParity.includes("/Prepared for:(?! Customer)/"),'customer quote normalization can erase an entered customer name');
ok(customerParity.includes("Prepared for:\\s*(?=\\n|$)"),'blank customer-name fallback is missing from quote normalization');
ok(customerParity.includes("if(name)name.value='';\n    syncLegacyJobName();"),'clearing an estimate can leave the legacy customer name stale');
ok(customerParity.includes("localStorage.getItem('fireV18LivePlanningState')")&&customerParity.includes("Object.assign(planning,{area:'0',areaLen:'0',areaWid:'0',areaSides:'1',areaSubtract:'0',calArea:'0',calMix:'0'})")&&customerParity.includes("localStorage.getItem('fireV18FullState')"),'Clear Estimate can leave persisted job measurements that repopulate later');

ok(index.includes("const rates={qHouse:.22,qGutter:1.75,qGuard:1,qBright:2,qFence:.4"),'current FIRE core pricing defaults are wrong');
ok(index.includes('Gutter Cleaning & Downspout Flushing')&&index.includes('Gutter Guard Removal / Reinstall'),'current gutter service wording is missing');

const singleSelectorCollection=/\$\([^;\n]*?\)\.(forEach|map|filter|find)\b/g;
const bad=[...bob.matchAll(singleSelectorCollection)].filter(m=>bob[m.index-1]!=='$').map(m=>m[0]);
ok(bad.length===0,`single-element selector used like a collection: ${bad.join(', ')}`);

const versioned=s=>new Set([...s.matchAll(/['"`](\.\/[^'"`?]+\?v=\d+)['"`]/g)].map(m=>m[1]));
const loaderUrls=versioned(loader);
const swUrls=versioned(sw);
const entry=(index.match(/<script[^>]+src=["'](\.\/full-v18\.js\?v=\d+)["']/i)||[])[1];
const bobJs=(index.match(/<script[^>]+src=["'](\.\/best-of-both\.js\?v=\d+)["']/i)||[])[1];
const bobCss=(index.match(/<link[^>]+href=["'](\.\/best-of-both\.css\?v=\d+)["']/i)||[])[1];
ok(entry,'versioned full-v18.js entry is missing');
ok(bobJs&&bobCss,'versioned best-of-both assets are missing');
for(const url of [entry,bobJs,bobCss,...loaderUrls])ok(swUrls.has(url),`offline cache missing current asset ${url}`);

console.log(`BEST-OF-BOTH CONTRACT PASS presets=${presets.length} loaderAssets=${loaderUrls.size} cache=${(sw.match(/const CACHE=['"]([^'"]+)['"]/)||[])[1]||'unknown'}`);
