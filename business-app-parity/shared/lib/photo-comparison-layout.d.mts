export declare const FIRE_PHOTO_COMPARISON_LAYOUT: Readonly<{
 canvasWidth:1600;canvasHeight:980;panelWidth:796;panelGap:8;panelY:70;panelHeight:810;footerY:880;
}>;
export declare function photoComparisonPlacement(sourceWidth:number,sourceHeight:number,panelX:number):Readonly<{
 x:number;y:number;width:number;height:number;panelX:number;panelY:number;panelWidth:number;panelHeight:number;
}>;
export declare function assertPhotoComparisonSameJob(
 before:Readonly<{id:string;customerId:string;jobId?:string;category:'before'|'after'|'property'}>,
 after:Readonly<{id:string;customerId:string;jobId?:string;category:'before'|'after'|'property'}>
):void;
