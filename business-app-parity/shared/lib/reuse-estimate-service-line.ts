import type {EditableMoneyLine} from './editable-line-totals';

/** Reuse setup on a new quote without charging for an unfinished additional area. */
export function reuseEstimateServiceLine<T extends EditableMoneyLine & {id?:string;name:string;description:string;unit:string}>(line:T):T{
 const copiedRate=line.flatPriceCents??line.unitRateCents;
 return {...line,id:undefined,quantity:0,unitRateCents:copiedRate,flatPriceCents:undefined,preservedLineTotalCents:undefined};
}
