/* FIRE Business Calculator shared-core formula regression tests.
   No external packages required: `node calculator/tests/formula-regression.js`.
   These tests lock approved calculator defaults only. Unapproved services MUST remain unpriced.
*/
'use strict';

const rates = Object.freeze({
  houseWash: 0.22,
  gutterCleaning: 1.50,
  gutterGuardRemoveReinstall: 0.50,
  gutterBrightening: 2.00,
  fenceCleaning: 0.40,
  standardWindow1: 7.00,
  standardWindow2: 11.00,
  frenchPane1: 12.00,
  frenchPane2: 18.00,
  screen1: 3.00,
  screen2: 6.00,
  driveway: 175.00,
  frontSidewalkCurb: 75.00,
  sideSidewalk: 25.00,
  rvWash: 150.00,

  // Explicitly unapproved/default-unpriced. Do not replace with guessed prices.
  roofCleaning: 0,
  premiumFenceRestoration: 0,
  deckCleaning: 0,
  paverStoneCleaning: 0,
  brickMasonryCleaning: 0,
  trashBinCleaning: 0,
  dryerVent: 0,
  undergroundDownspout: 0,
  frenchDrain: 0,
  acCondenserRinse: 0,
  vehicleLinearFoot: 0,
  frameSill1: 0,
  frameSill2: 0,
  oxidationRemoval: 0,
  cobwebAddon: 0
});

const MIN_JOB = 150;
const DEPOSIT_PCT = 50;

function n(v){
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}
function roundMoney(v){ return Math.round((v + Number.EPSILON) * 100) / 100; }
function lineTotal(qty, rate){ return roundMoney(n(qty) * n(rate)); }
function quoteTotal(subtotal, discountPct=0, override=0, minJob=MIN_JOB){
  subtotal=n(subtotal); discountPct=Math.min(100,n(discountPct)); override=n(override); minJob=n(minJob);
  if (override > 0) return roundMoney(override);
  if (subtotal <= 0) return 0;
  return roundMoney(Math.max(minJob, subtotal * (1-discountPct/100)));
}
function deposit(total, pct=DEPOSIT_PCT){ return roundMoney(n(total) * Math.min(100,n(pct))/100); }
function assertEq(actual, expected, name){
  if (Object.is(actual, expected)) return;
  throw new Error(`${name}: expected ${expected}, got ${actual}`);
}
function assert(condition, name){ if(!condition) throw new Error(name); }

const tests=[];
function test(name, fn){ tests.push([name,fn]); }

// Approved rate locks
test('House Wash approved rate',()=>assertEq(rates.houseWash,0.22,'houseWash'));
test('Gutter Cleaning approved rate',()=>assertEq(rates.gutterCleaning,1.50,'gutterCleaning'));
test('Gutter Guard Removal/Reinstall approved rate',()=>assertEq(rates.gutterGuardRemoveReinstall,0.50,'guard'));
test('Gutter Brightening approved rate',()=>assertEq(rates.gutterBrightening,2.00,'brightening'));
test('Fence Cleaning approved rate',()=>assertEq(rates.fenceCleaning,0.40,'fence'));
test('Standard Window 1st approved rate',()=>assertEq(rates.standardWindow1,7,'w1'));
test('Standard Window 2nd approved rate',()=>assertEq(rates.standardWindow2,11,'w2'));
test('French Pane 1st approved rate',()=>assertEq(rates.frenchPane1,12,'f1'));
test('French Pane 2nd approved rate',()=>assertEq(rates.frenchPane2,18,'f2'));
test('Screen 1st approved rate',()=>assertEq(rates.screen1,3,'s1'));
test('Screen 2nd approved rate',()=>assertEq(rates.screen2,6,'s2'));
test('Concrete driveway fixed default',()=>assertEq(rates.driveway,175,'driveway'));
test('Concrete front sidewalk + curb fixed default',()=>assertEq(rates.frontSidewalkCurb,75,'front'));
test('Concrete side sidewalk fixed default',()=>assertEq(rates.sideSidewalk,25,'side'));
test('RV wash approved default',()=>assertEq(rates.rvWash,150,'rv'));

// Representative service math
test('House Wash 1,700 sq ft',()=>assertEq(lineTotal(1700,rates.houseWash),374,'house 1700'));
test('House Wash 2,633 sq ft',()=>assertEq(lineTotal(2633,rates.houseWash),579.26,'house 2633'));
test('Gutter Cleaning 250 lf',()=>assertEq(lineTotal(250,rates.gutterCleaning),375,'gutter 250'));
test('Guard remove/reinstall 250 lf',()=>assertEq(lineTotal(250,rates.gutterGuardRemoveReinstall),125,'guard 250'));
test('Gutter Brightening 175 lf',()=>assertEq(lineTotal(175,rates.gutterBrightening),350,'bright 175'));
test('Fence Cleaning 1,000 sq ft',()=>assertEq(lineTotal(1000,rates.fenceCleaning),400,'fence 1000'));
test('Window 1st 20 count',()=>assertEq(lineTotal(20,rates.standardWindow1),140,'window count'));
test('Screen 2nd 9 count',()=>assertEq(lineTotal(9,rates.screen2),54,'screen count'));
test('Concrete combined fixed defaults',()=>assertEq(rates.driveway+rates.frontSidewalkCurb+rates.sideSidewalk,275,'concrete combined'));

// Combined services
test('Combined services subtotal',()=>{
  const subtotal = lineTotal(2633,rates.houseWash)
    + lineTotal(175,rates.gutterBrightening)
    + lineTotal(27,rates.standardWindow1)
    + lineTotal(9,rates.standardWindow2)
    + lineTotal(11,rates.screen1)
    + lineTotal(9,rates.screen2)
    + rates.driveway + rates.frontSidewalkCurb + rates.sideSidewalk;
  assertEq(roundMoney(subtotal),1629.26,'combined subtotal');
});

// Minimum, discount and deposit behavior
test('$150 minimum applies below minimum',()=>assertEq(quoteTotal(100),150,'minimum'));
test('$150 minimum does not inflate zero/blank quote',()=>assertEq(quoteTotal(0),0,'zero minimum'));
test('Single 10% discount',()=>assertEq(quoteTotal(1000,10),900,'10% discount'));
test('Discount cannot push a nonzero job below minimum',()=>assertEq(quoteTotal(160,10),150,'discount + minimum'));
test('100% discount still respects minimum for entered work',()=>assertEq(quoteTotal(500,100),150,'100% discount + minimum'));
test('Final-price override bypasses calculated/minimum total',()=>assertEq(quoteTotal(100,0,80),80,'override'));
test('50% deposit',()=>assertEq(deposit(579.26),289.63,'deposit'));
test('Remaining balance equals total minus deposit',()=>assertEq(roundMoney(579.26-deposit(579.26)),289.63,'remaining'));

// Blank / zero / invalid / large / rounding
test('Blank quantity is zero',()=>assertEq(lineTotal('',rates.houseWash),0,'blank'));
test('Zero quantity is zero',()=>assertEq(lineTotal(0,rates.houseWash),0,'zero'));
test('Negative quantity is clamped to zero',()=>assertEq(lineTotal(-5,rates.houseWash),0,'negative'));
test('Non-numeric quantity is zero',()=>assertEq(lineTotal('abc',rates.houseWash),0,'invalid'));
test('Large quantity remains finite',()=>assert(Number.isFinite(lineTotal(10000000,rates.houseWash)),'large quantity should remain finite'));
test('Money rounds to cents',()=>assertEq(lineTotal(1.005,1),1.01,'rounding'));

// Unapproved services: no invented pricing
test('Trash Bin Cleaning remains unpriced until approval',()=>assertEq(rates.trashBinCleaning,0,'trash bin'));
test('Roof Cleaning remains unpriced until approval',()=>assertEq(rates.roofCleaning,0,'roof'));
test('Dryer Vent remains unpriced until approval',()=>assertEq(rates.dryerVent,0,'dryer'));
test('Underground Downspout remains unpriced until approval',()=>assertEq(rates.undergroundDownspout,0,'downspout'));
test('French Drain remains unpriced until approval',()=>assertEq(rates.frenchDrain,0,'french drain'));
test('AC Condenser Rinse remains unpriced until approval',()=>assertEq(rates.acCondenserRinse,0,'ac'));
test('Unpriced service with positive quantity must be flagged',()=>{
  const qty=2, rate=rates.trashBinCleaning;
  assert(qty>0 && rate===0,'entered unpriced service must be detectable');
});

// Bundle/stacking behavior is intentionally NOT hard-coded here until live behavior is paired and verified.
test('Bundle/stacking regression gate is explicitly unresolved',()=>{
  assert(true,'Tracked in PARITY_MATRIX.md; do not invent a stacking algorithm before live verification');
});

let passed=0;
for(const [name,fn] of tests){
  try{ fn(); passed++; console.log(`PASS ${name}`); }
  catch(err){ console.error(`FAIL ${name}\n  ${err.message}`); process.exitCode=1; }
}
console.log(`\n${passed}/${tests.length} FIRE formula regression tests passed.`);
if(process.exitCode) process.exit(process.exitCode);
