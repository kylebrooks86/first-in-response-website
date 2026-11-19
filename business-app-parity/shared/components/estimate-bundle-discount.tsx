'use client';
import {useEffect,useRef,useState} from 'react';
/** Never guess zero when a saved component cannot be read. A failed read blocks
 * saving, retains the draft, and requires a deliberate read-only retry. */
export function useEstimateBundleDiscount(open:boolean,id:string,totalCents:number){
 const [value,setValue]=useState(''),[ready,setReady]=useState(false),[error,setError]=useState('');const generation=useRef(0);
 const reload=async()=>{const request=++generation.current;setReady(false);setError('');try{const response=await fetch('/api/estimates/'+encodeURIComponent(id)+'/discounts',{cache:'no-store'});const data=await response.json() as {estimateId?:unknown;totalCents?:unknown;bundleDiscountCents?:unknown};if(!response.ok||data.estimateId!==id||data.totalCents!==totalCents||typeof data.bundleDiscountCents!=='number'||!Number.isSafeInteger(data.bundleDiscountCents)||data.bundleDiscountCents<0)throw Error('Saved discount components could not be verified. Refresh this estimate before saving.');if(generation.current===request){setValue(data.bundleDiscountCents?(data.bundleDiscountCents/100).toFixed(2):'');setReady(true);}}catch{if(generation.current===request)setError('Saved discount components could not be verified. Your draft is retained; retry the read before saving.');}};
 useEffect(()=>{if(open)void reload();else{setReady(false);setValue('');setError('');}return()=>{generation.current++;};},[open,id,totalCents]);
 return{value,setValue,ready,error,reload};
}
