import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('calculator');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const index=read('index.html');
const bob=read('best-of-both.js');
const css=read('best-of-both.css');
const loader=read('full-v18.js');
const sw=read('sw.js');

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
const normalizedBob=bob.replace(/(^|[^\\d])\\.(\\d+)/g,(_,prefix,digits)=>prefix+'0.'+digits);
for(const [name,surface,strengths] of presets){
  ok(bob.includes(`name:'${name}'`),`missing quick preset: ${name}`);
  ok(bob.includes(`surface:'${surface}'`),`missing surface binding for ${name}`);
  const shape=`strengths:{light:${strengths.light},moderate:${strengths.moderate},heavy:${strengths.heavy}}`;
  ok(normalizedBob.includes(shape),`wrong Light/Medium/Heavy profile for ${name}`);
}
ok(!/growth:'(?:light|moderate|heavy)'/.test(bob),'quick presets must not reset the global dirtiness selector');
ok(!/\bp\.growth\b/.test(bob),'quick preset selection still references a per-preset dirtiness default');
ok(bob.includes("const currentGrowth=()=>$('#growthSeg [data-growth].active')?.dataset.growth||'moderate'"),'global dirtiness source is missing');

for(const [label,value] of [['Light','light'],['Medium','moderate'],['Heavy','heavy']]){
  ok(index.includes(`data-growth="${value}">${label}</button>`),`missing visible ${label} dirtiness control`);
}

for(const size of ['1','2','4','5']){
  ok(index.includes(`data-batch="${size}"`),`missing quick batch size ${size} gal`);
}
ok(count(index,/data-batch="/g)===4,'only 1 / 2 / 4 / 5 gal should be visible quick batch buttons');
ok(bob.includes("More sizes / custom"),'uncommon batch sizes must remain collapsed behind More sizes / custom');

ok(index.includes('data-stock="10"')&&index.includes('data-stock="12.5"'),'10% and 12.5% stock shortcuts must remain visible');
ok(bob.includes("Other stock %"),'manual stock percentage must remain available');
ok(bob.includes("Fine-tune mix"),'manual SH / Elemonator fine tuning must remain available');
ok(bob.includes("Other / manual surface"),'manual surface fallback must remain available');
ok(bob.includes("Preset notes"),'preset guidance must remain available without permanent screen clutter');

for(const label of ['🧪 SH Mix','🧴 Mixes','🔎 Index','📐 Job Plan']){
  ok(bob.includes(label),`missing primary nav label ${label}`);
}
ok(css.includes('.tab[data-view="mix"]')&&css.includes('.tab[data-view="chemicals"]')&&css.includes('.tab[data-view="index"]')&&css.includes('.tab[data-view="job"]'),'four primary tab selectors are missing');
ok(css.includes('body.fire-bob .tab{display:none!important'), 'secondary tabs are not hidden by default');
ok(bob.includes("['equipment','⚙️ Equipment / X-Jet']")&&bob.includes("['tools','🧰 Field Tools']")&&bob.includes("['guide','🛡️ Safety Guide']"),'secondary tools are not routed through compact Tools menu');

ok(css.includes('body.fire-bob #chemicals .card')&&css.includes('body.fire-bob #index .card'),'LIVE Mixes / Index protection rules are missing');

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
