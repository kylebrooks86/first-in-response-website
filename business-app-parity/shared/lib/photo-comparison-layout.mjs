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
