/* FIRE Business Calculator live-reference contract.
   Purpose: prevent the shared staging core from drifting from the current live FIRE Field Calculator baseline.
   Static UI copy is checked against shared-core source. Dynamic examples are verified by deterministic format tests.
   This is NOT a substitute for paired visual or behavioral verification.
*/
'use strict';

const staticContract = Object.freeze({
  releaseLabel: 'v18',
  header: [
    'Field Calculator',
    'First In Response Exteriors',
    'Stock SH 10%',
    'stock-pill',
    'stockPill'
  ],
  topNavigation: ['SH Mix','Equipment','Chemicals','Chemical Index','Job Math','Field Guide'],
  bottomNavigation: ['SH Mix','Equipment','Mixes','Index','Job Math','Tools'],
  safetyBanner: 'Never mix SH with acids, ammonia, F9 BARC, or other cleaners.',
  shMix: {
    headings: ['Choose the surface','Set batch size'],
    surfaces: [
      'House wash — vinyl / painted siding','Roof wash — asphalt shingles','Roof wash — metal / tile',
      'Fence wash — vinyl','Fence wash — wood','Deck — composite','Deck — wood',
      'Concrete — pre-treatment','Concrete — post-treatment','Pavers / hardscape','Brick / masonry',
      'Stucco / EIFS','Aluminum siding / gutters — organics','Pool deck / patio','Trash bins'
    ],
    growth: ['Light','Moderate','Heavy'],
    batchPresets: [
      '4 gallons — FlowZone','12 fl oz','16 fl oz','20 fl oz','24 fl oz','26 fl oz','28 fl oz','32 fl oz',
      '40 fl oz','48 fl oz','64 fl oz / ½ gal','3 quarts','1 gallon','1½ gallons','2 gallons','2½ gallons',
      '3 gallons','5 gallons','7 gallons','10 gallons','15 gallons','20 gallons','25 gallons','30 gallons',
      '35 gallons','50 gallons','65 gallons','75 gallons','100 gallons','125 gallons','150 gallons','200 gallons',
      '250 gallons','Custom amount'
    ],
    quickBatch: ['26 oz','½ gal','1 gal','2 gal','4 gal','Custom amount'],
    customUnits: ['gal','fl oz','quart','liter'],
    guidance: 'Start low. Check oxidation, failed paint, outlets, door seals, and delicate fixtures before applying.',
    mixOrder: 'Add water first, then SH, then bleach-stable surfactant. Pre-wet and post-rinse vegetation.'
  },
  equipment: {
    headings: [
      'X-Jet M5DS Twist — 3–7 GPM','Mix the X-Jet pickup bucket for a target strength','X-Jet bucket draw test',
      'Estimate strength hitting the surface','Find your real injector ratio','Three-port proportioner planner','Fill-time estimate'
    ],
    factoryCopy: 'Factory proportions are estimates based on a 4 GPM pressure washer at 100 PSI. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.'
  },
  jobMath: {
    headings: ['How much mix should I bring?','Area and real coverage helpers','Know your cost per batch','Price the whole job','Job loadout and profitability'],
    quickNavStructure: ['topJobNav','top-job-nav','jobMixCard','jobMeasureCard','jobEstimateCard','jobLoadoutCard'],
    estimateWorkflow: ['Stackable discount total','Final-price override (0 = calculated)','Clear','Customer quote','Copy customer quote','Share quote','Print / Save PDF','Crew job sheet']
  },
  fieldTools: ['Quick Mix Favorites','Stain & Surface Finder','Chemical Compatibility Checker','Batch History / Mix Log','Chemical Inventory','Application Timer','Weather Adjustment Guide','Custom Chemical Builder','Version and offline update','Backup or Restore Field Data','Field Safety Card'],
  inventoryCopy: 'Inventory stays on this device. Amounts are planning aids—verify the container before a job.',
  timerWarning: 'A timer never replaces the product label. Watch the surface continuously and rinse sooner if drying or a reaction appears.',
  offlineCopy: 'The calculator does not require a sign-in. Your rates, inventory, timer and saved mixes remain on this device and are included in your backup.',
  backupCopy: 'Back up your favorites, inventory, mix history, custom chemicals, X-Jet calibration, calculator settings, and current estimate draft. If you entered a customer or job name, it is included in the backup.',
  safetyOrder: [
    'Read the current product label and SDS.','Wear eye/skin protection and keep people, pets, and plants clear.',
    'Add water first, then SH, then bleach-stable surfactant.','Use separate labeled sprayers for acid, alkaline, and SH products.',
    'Pre-wet and post-rinse plants; never let mix dry on a surface.','Test an inconspicuous spot and start weaker when uncertain.',
    'Rinse tools and do not seal or store mixed SH long-term.'
  ]
});

const dynamicContract = Object.freeze({
  recipeExample: '4.00 gal medium house wash',
  stockExample: 'Your 5 gallons of SH can make 12 full 4.00 gal batches (48.0 gallons of finished mix).'
});

function flatten(value,out=[]){
  if(typeof value==='string')out.push(value);
  else if(Array.isArray(value))value.forEach(v=>flatten(v,out));
  else if(value&&typeof value==='object')Object.values(value).forEach(v=>flatten(v,out));
  return out;
}
function normalizeSource(text){
  return text
    .replace(/\\u2014/gi,'—').replace(/\\u2013/gi,'–').replace(/\\u00bd/gi,'½')
    .replace(/\\u00b2/gi,'²').replace(/\\u2192/gi,'→').replace(/\\u2019/gi,'’');
}
function formatRecipe(batch,growth,surface){return `${Number(batch).toFixed(2)} gal ${growth==='moderate'?'medium':growth} ${surface}`}
function formatStockPlan(onHand,batch,target,stock){
  const sh=Number(batch)*Number(target)/Number(stock);
  const count=sh>0?Math.floor(Number(onHand)/sh):0;
  return `Your ${Number(onHand)} gallons of SH can make ${count} full ${Number(batch).toFixed(2)} gal batches (${(count*Number(batch)).toFixed(1)} gallons of finished mix).`;
}
function verifyStatic(text){
  const normalized=normalizeSource(text),missing=[];
  for(const required of flatten(staticContract))if(!normalized.includes(required))missing.push(required);
  return {ok:missing.length===0,missing};
}
function verifyDynamic(){
  const failures=[];
  const recipe=formatRecipe(4,'moderate','house wash');
  if(recipe!==dynamicContract.recipeExample)failures.push(`recipe: expected ${dynamicContract.recipeExample}, got ${recipe}`);
  const stock=formatStockPlan(5,4,1,10);
  if(stock!==dynamicContract.stockExample)failures.push(`stock plan: expected ${dynamicContract.stockExample}, got ${stock}`);
  return {ok:failures.length===0,failures};
}

if(require.main===module){
  const fs=require('fs');
  const files=process.argv.slice(2);
  if(!files.length){console.error('Usage: node calculator/tests/live-contract.js <shared-core-file> [more files...]');process.exit(2)}
  const combined=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const staticResult=verifyStatic(combined),dynamicResult=verifyDynamic();
  if(!staticResult.ok||!dynamicResult.ok){
    console.error('LIVE CONTRACT FAILED');
    for(const item of staticResult.missing)console.error('MISSING STATIC:',item);
    for(const item of dynamicResult.failures)console.error('DYNAMIC FORMAT FAILURE:',item);
    process.exit(1);
  }
  console.log(`PASS live contract: ${flatten(staticContract).length} static requirements + ${Object.keys(dynamicContract).length} dynamic format requirements.`);
}

module.exports={staticContract,dynamicContract,verifyStatic,verifyDynamic,formatRecipe,formatStockPlan};
