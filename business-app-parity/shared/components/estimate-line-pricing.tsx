'use client';
import {useEffect,useState} from 'react';
import {priceCents} from '../lib/service-pricing';
import {editableLineTotalCents,type EditableMoneyLine} from '../lib/editable-line-totals';
import {Button} from './ui/button';import {Input} from './ui/input';import {Label} from './ui/label';
export function EstimateLinePricing({item,standardRate,standardUnit,onChange,label}:{item:EditableMoneyLine;standardRate?:number;standardUnit?:string;onChange:(patch:Partial<EditableMoneyLine>)=>void;label:string}){
 const flat=item.flatPriceCents!==undefined,value=flat?item.flatPriceCents!:item.unitRateCents;
 const [text,setText]=useState(Number.isFinite(value)?(value/100).toString():'');
 useEffect(()=>{if(priceCents(text)!==value&&Number.isFinite(value))setText((value/100).toString());},[value,flat]);
 const invalid=priceCents(text)===null;
 return <div className="line-pricing"><div className="line-pricing-actions" role="group" aria-label={label+' pricing method'}><Button type="button" variant={!flat?'default':'outline'} aria-pressed={!flat} onClick={()=>onChange({flatPriceCents:undefined,unitRateCents:item.unitRateCents})}>Per unit</Button><Button type="button" variant={flat?'default':'outline'} aria-pressed={flat} onClick={()=>onChange({flatPriceCents:editableLineTotalCents(item)})}>Flat service price</Button>{standardRate!==undefined&&<Button type="button" variant="outline" onClick={()=>onChange({flatPriceCents:undefined,unitRateCents:standardRate,...(standardUnit?{unit:standardUnit}:{})})}>Reset to standard</Button>}</div><Label htmlFor={label+'-price'}>{flat?'Total price for this service':'Price per unit — adjustable for this job'}</Label><Input id={label+'-price'} inputMode="decimal" value={text} aria-invalid={invalid} onChange={event=>{const raw=event.target.value;setText(raw);const cents=priceCents(raw);onChange(flat?{flatPriceCents:cents??NaN}:{unitRateCents:cents??NaN,flatPriceCents:undefined});}}/>{invalid&&<p role="alert">Enter a nonnegative dollar amount with up to two decimal places.</p>}<p className="service-description-help">{standardRate!==undefined?`Current standard: $${(standardRate/100).toFixed(2)} per ${standardUnit??item.unit}. `:''}This changes only this estimate. Standard prices are managed in Settings.</p></div>;
}
