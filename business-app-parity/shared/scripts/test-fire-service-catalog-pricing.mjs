/** Owner's 50-entry QuoteIQ contract. No hosted database access. */
import assert from 'node:assert/strict';
import {FIRE_SERVICES} from '../lib/fire-services.ts';
const expected=[[1, "roof-wash", 35, "sq ft"], [2, "roof-debris-small", 5000, "quantity"], [3, "roof-debris-medium", 7500, "quantity"], [4, "roof-debris-heavy", 10000, "quantity"], [5, "roof-organic", 7500, "each"], [6, "roof-access", 5000, "each"], [7, "roof-complex", 5000, "each"], [8, "plant-protection", 5000, "each"], [9, "house-wash", 22, "sq ft"], [10, "trim-addon-1f", 10000, "quantity"], [11, "trim-addon-2f", 20000, "quantity"], [12, "trim-1f", 17500, "quantity"], [13, "trim-2f", 25000, "quantity"], [14, "access-surcharge", 5000, "each"], [15, "gutters", 150, "linear ft"], [16, "gutter-guards", 50, "linear ft"], [17, "gutter-brightening", 200, "linear ft"], [18, "downspout-clog", 2500, "quantity"], [19, "fence", 40, "sq ft"], [20, "premium-fence", 60, "sq ft"], [21, "concrete", 20, "sq ft"], [22, "paver", 35, "sq ft"], [23, "deck", 40, "sq ft"], [24, "patio-furniture", 2000, "quantity"], [25, "ac-rinse", 2500, "quantity"], [26, "windows", 700, "quantity"], [27, "windows-2f", 1100, "quantity"], [28, "french-windows-1f", 1200, "each"], [29, "french-windows-2f", 1800, "each"], [30, "screens-1f", 300, "each"], [31, "screens-2f", 600, "each"], [32, "window-deep-1f", 500, "quantity"], [33, "window-deep-2f", 800, "quantity"], [34, "window-oxidation-1f", 2500, "quantity"], [35, "window-oxidation-2f", 4000, "quantity"], [36, "hard-water", 2000, "each"], [37, "rust", 5000, "each"], [38, "trash-bins", 2500, "quantity"], [39, "dryer", 15000, "quantity"], [40, "dryer-exterior", 10000, "quantity"], [41, "underground-first", 22500, "quantity"], [42, "french-drain", 27500, "each"], [43, "car", 5000, "quantity"], [44, "truck-suv", 6500, "quantity"], [45, "large-truck", 7500, "quantity"], [46, "commercial-truck", 12500, "quantity"], [47, "trailer", 500, "linear ft"], [48, "boat", 600, "linear ft"], [49, "rv", 600, "linear ft"], [50, "utv", 5000, "quantity"]];
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
eq(FIRE_SERVICES.length,58,'50 QuoteIQ entries plus 8 unrelated retained services');
eq(new Set(FIRE_SERVICES.map(s=>s.id)).size,58,'Unique stable IDs');
const numbered=FIRE_SERVICES.filter(s=>s.quoteIqNumber);
eq(numbered.length,50);eq(numbered.map(s=>s.quoteIqNumber),Array.from({length:50},(_,i)=>i+1));
for(const [number,id,rate,unit] of expected){
 const service=FIRE_SERVICES.find(s=>s.id===id);assert.ok(service);checks++;
 eq(service.quoteIqNumber,number);eq(service.rate,rate,'Owner rate #'+number);eq(service.unit,unit,'Owner unit #'+number);
 eq(Number.isSafeInteger(service.rate)&&service.rate>=0,true);
}
eq(numbered.filter(s=>s.category==='base').length,34);eq(numbered.filter(s=>s.category==='supplemental').length,16);
eq(numbered.filter(s=>s.provisionalName).map(s=>s.quoteIqNumber),[46,47]);
for(const id of ['window-oxidation','underground-additional','vehicle-wash','cobweb-add-on','holiday','commercial','specialty','custom'])eq(FIRE_SERVICES.some(s=>s.id===id&&!s.quoteIqNumber),true,'Retain unrelated '+id);
for(const id of ['gutter-guards','windows','window-deep-1f','window-deep-2f','window-oxidation-1f','window-oxidation-2f','trash-bins'])eq(FIRE_SERVICES.find(s=>s.id===id).name.includes('…'),false,'Use matching existing full name '+id);
eq(FIRE_SERVICES.find(s=>s.id==='house-wash').rate*2000,44000);eq(FIRE_SERVICES.find(s=>s.id==='roof-wash').rate*2000,70000);eq(FIRE_SERVICES.find(s=>s.id==='deck').rate*200,8000);eq(FIRE_SERVICES.find(s=>s.id==='gutters').rate*100,15000);
console.log('PASS '+checks+' QuoteIQ catalog checks: every numbered price/unit, 34/16 organization, stable IDs and retained extras.');

for(const service of FIRE_SERVICES){eq(service.description.length>=160,true,'Detailed scope: '+service.id);eq(service.description.includes('Service includes only the work and areas listed in this estimate.'),false,'No generic placeholder: '+service.id);}
eq(new Set(FIRE_SERVICES.map(s=>s.description)).size,58,'Individual service descriptions');
console.log('PASS detailed scope/exclusion coverage for all 58 retained and QuoteIQ services.');
