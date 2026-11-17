/** Exact FIRE shareable before/after panel geometry.
 * Displays every pixel of each original image: containment, not cropping.
 * No image bytes or customer data ever leave the local canvas.
 */
export const FIRE_PHOTO_COMPARISON_LAYOUT=Object.freeze({
 canvasWidth:1600,canvasHeight:980,
 panelWidth:796,panelGap:8,
 panelY:70,panelHeight:810,footerY:880
});
export function photoComparisonPlacement(sourceWidth,sourceHeight,panelX){
 const p=FIRE_PHOTO_COMPARISON_LAYOUT;
 if(![0,p.panelWidth+p.panelGap].includes(panelX)||
    !Number.isFinite(sourceWidth)||!Number.isFinite(sourceHeight)||
    sourceWidth<=0||sourceHeight<=0)
  throw Error('FIRE before/after image dimensions are unavailable.');
 const ratio=Math.min(p.panelWidth/sourceWidth,p.panelHeight/sourceHeight);
 const width=sourceWidth*ratio,height=sourceHeight*ratio;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
  throw Error('FIRE before/after image geometry cannot be displayed.');
 return Object.freeze({
  x:panelX+(p.panelWidth-width)/2,y:p.panelY+(p.panelHeight-height)/2,
  width,height,panelX,panelY:p.panelY,panelWidth:p.panelWidth,panelHeight:p.panelHeight
 });
}

/** Before/after graphics may use older unlinked customer photos, but must
 * never silently combine originals from two different numbered jobs. A
 * job-linked image and a legacy customer-only image also lack a verified
 * common job identity and must be reviewed rather than auto-paired.
 * This is a local display guard only; photo originals remain untouched.
 */
export function assertPhotoComparisonSameJob(before,after){
 if(!before||!after||before.id===after.id||
    before.category!=='before'||after.category!=='after'||
    typeof before.customerId!=='string'||before.customerId!==after.customerId)
  throw Error('Choose distinct BEFORE and AFTER originals for the same saved customer.');
 if(before.jobId!==after.jobId)
  throw Error('These photos are linked to different jobs or only one has a verified job. Choose photos for the same job, or use two unlinked customer photos.');
}

/** Only show AFTER originals that the owner may legitimately compare to a
 * selected BEFORE original. Keep legacy unlinked customer-only pairs usable;
 * never present another customer's image or a differently linked job as a
 * suggested comparison. This filter is NOT a substitute for the export guard.
 */
export function eligiblePhotoComparisonAfter(before,after){
 return Boolean(before&&after&&before.category==='before'&&after.category==='after'&&
  before.id!==after.id&&before.customerId===after.customerId&&
  before.jobId===after.jobId);
}
