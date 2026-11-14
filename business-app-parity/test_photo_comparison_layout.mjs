/** Exact before/after geometry and actual UI integration, synthetic only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {photoComparisonPlacement,FIRE_PHOTO_COMPARISON_LAYOUT as L}
 from './shared/lib/photo-comparison-layout.mjs';
const equal=(a,b,msg)=>assert.equal(a,b,msg);
let checked=0;
function validate(sw,sh,panelX){
 const p=photoComparisonPlacement(sw,sh,panelX),eps=1e-7;
 assert.ok(p.x>=panelX-eps&&p.y>=L.panelY-eps,'No image can spill left/up beyond its own photo panel');
 assert.ok(p.x+p.width<=panelX+L.panelWidth+eps,'No image can overwrite the other before/after panel');
 assert.ok(p.y+p.height<=L.footerY+eps,'Photo never overwrites business footer');
 assert.ok(Math.abs(p.width/p.height-sw/sh)<1e-7,'Preserve original image aspect ratio');
 assert.ok(Math.abs(p.width-L.panelWidth)<eps||Math.abs(p.height-L.panelHeight)<eps,
  'Fit largest entire original photo without cropping');
 assert.equal(p.panelX,panelX);
 checked+=6;return p;
}
equal(L.canvasWidth,1600);equal(L.canvasHeight,980);
equal(L.panelWidth*2+L.panelGap,L.canvasWidth,'No panel overlap or gap miscalculation');
equal(L.panelY+L.panelHeight,L.footerY,'Header, photo and footer cannot overlap');
checked+=4;
const before=validate(4000,3000,0),after=validate(4000,3000,804);
assert.ok(before.x>=0&&before.x+before.width<=796,'wide BEFORE stays inside before panel');
assert.ok(after.x>=804&&after.x+after.width<=1600,'wide AFTER stays inside after panel');
checked+=2;
for(const [sw,sh] of [[3000,4000],[4000,3000],[1600,900],[900,1600],[1000,1000],[1,1],[15000,2200],[2200,15000]])
 for(const x of [0,804])validate(sw,sh,x);
for(const args of [[0,200,0],[-1,100,0],[1,0,804],[NaN,200,0],[Infinity,1,0],[1,1,4],[1,1,796]]){
 assert.throws(()=>photoComparisonPlacement(...args),/dimensions|geometry/);checked++;
}
const view=readFileSync(new URL('./shared/components/offline-customer-photos.tsx',import.meta.url),'utf8');
assert.ok(view.includes('photoComparisonPlacement(img.naturalWidth,img.naturalHeight,x)')&&
 view.includes('context.rect(place.panelX,place.panelY,place.panelWidth,place.panelHeight)')&&
 view.includes('context.clip();context.drawImage(img,place.x,place.y,place.width,place.height)')&&
 view.includes('context.restore();')&&
 !view.includes('const ratio=Math.max(796/img.naturalWidth'),
 'Actual QA-master canvas composes full uncropped images with independent clip/restore');
checked++;
console.log('PASS '+checked+'/'+checked+' FIRE before/after full-frame image geometry, panel isolation, original aspect ratio, invalid source and actual app canvas integration; zero provider calls.');
