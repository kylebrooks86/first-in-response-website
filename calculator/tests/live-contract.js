/* FIRE Business Calculator live-reference contract.
   Purpose: prevent the shared staging core from drifting from the current live FIRE Field Calculator baseline.
   This is NOT a substitute for visual verification. It is a text/structure release gate.
*/
'use strict';

const contract = Object.freeze({
  product: 'FIRE Business Calculator',
  releaseLabel: 'v18',
  header: [
    'Field Calculator',
    'First In Response Exteriors',
    'Stock SH 10%',
    'stock-pill',
    'stockPill'
  ],
  topNavigation: [
    'SH Mix',
    'Equipment',
    'Chemicals',
    'Chemical Index',
    'Job Math',
    'Field Guide'
  ],
  bottomNavigation: [
    'SH Mix',
    'Equipment',
    'Mixes',
    'Index',
    'Job Math',
    'Tools'
  ],
  safetyBanner: 'Never mix SH with acids, ammonia, F9 BARC, or other cleaners.',
  shMix: {
    headings: ['Choose the surface','Set batch size'],
    growth: ['Light','Moderate','Heavy'],
    recipeExample: '4.00 gal medium house wash',
    guidance: 'Start low. Check oxidation, failed paint, outlets, door seals, and delicate fixtures before applying.',
    mixOrder: 'Add water first, then SH, then bleach-stable surfactant. Pre-wet and post-rinse vegetation.',
    stockExample: 'Your 5 gallons of SH can make 12 full 4.00 gal batches (48.0 gallons of finished mix).'
  },
  equipment: {
    headings: [
      'X-Jet M5DS Twist — 3–7 GPM',
      'Mix the X-Jet pickup bucket for a target strength',
      'X-Jet bucket draw test',
      'Estimate strength hitting the surface',
      'Find your real injector ratio',
      'Three-port proportioner planner',
      'Fill-time estimate'
    ],
    factoryCopy: 'Factory proportions are estimates based on a 4 GPM pressure washer at 100 PSI. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.'
  },
  jobMath: {
    headings: [
      'How much mix should I bring?',
      'Area and real coverage helpers',
      'Know your cost per batch',
      'Price the whole job',
      'Job loadout and profitability'
    ],
    quickNavStructure: ['topJobNav','top-job-nav','jobMixCard','jobMeasureCard','jobEstimateCard','jobLoadoutCard']
  },
  fieldTools: [
    'Quick Mix Favorites',
    'Stain & Surface Finder',
    'Chemical Compatibility Checker',
    'Batch History / Mix Log',
    'Chemical Inventory',
    'Application Timer',
    'Weather Adjustment Guide',
    'Custom Chemical Builder',
    'Version and offline update',
    'Backup or Restore Field Data',
    'Field Safety Card'
  ],
  inventoryCopy: 'Inventory stays on this device. Amounts are planning aids—verify the container before a job.',
  timerWarning: 'A timer never replaces the product label. Watch the surface continuously and rinse sooner if drying or a reaction appears.',
  offlineCopy: 'The calculator does not require a sign-in. Your rates, inventory, timer and saved mixes remain on this device and are included in your backup.',
  backupCopy: 'Back up your favorites, inventory, mix history, custom chemicals, X-Jet calibration, calculator settings, and current estimate draft. If you entered a customer or job name, it is included in the backup.',
  safetyOrder: [
    'Read the current product label and SDS.',
    'Wear eye/skin protection and keep people, pets, and plants clear.',
    'Add water first, then SH, then bleach-stable surfactant.',
    'Use separate labeled sprayers for acid, alkaline, and SH products.',
    'Pre-wet and post-rinse plants; never let mix dry on a surface.',
    'Test an inconspicuous spot and start weaker when uncertain.',
    'Rinse tools and do not seal or store mixed SH long-term.'
  ]
});

function flatten(value, out=[]){
  if(typeof value==='string') out.push(value);
  else if(Array.isArray(value)) value.forEach(v=>flatten(v,out));
  else if(value&&typeof value==='object') Object.values(value).forEach(v=>flatten(v,out));
  return out;
}

function verifyText(text){
  const missing=[];
  for(const required of flatten(contract)){
    if(!text.includes(required)) missing.push(required);
  }
  return {ok:missing.length===0,missing};
}

if(require.main===module){
  const fs=require('fs');
  const files=process.argv.slice(2);
  if(!files.length){
    console.error('Usage: node calculator/tests/live-contract.js <shared-core-file> [more files...]');
    process.exit(2);
  }
  const combined=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const result=verifyText(combined);
  if(!result.ok){
    console.error('LIVE CONTRACT FAILED');
    for(const item of result.missing) console.error('MISSING:',item);
    process.exit(1);
  }
  console.log(`PASS live contract: ${flatten(contract).length} required live-baseline strings present.`);
}

module.exports={contract,verifyText};
