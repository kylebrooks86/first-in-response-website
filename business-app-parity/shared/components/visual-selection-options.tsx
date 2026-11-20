'use client';
import {CarFront,CircleHelp,ClipboardList,CloudSun,Coins,CreditCard,Droplets,FilePenLine,Gift,House,Landmark,Leaf,MapPin,Paintbrush,Receipt,ShieldCheck,Smartphone,Truck,Users,Waves,Wind,Wrench} from 'lucide-react';
import {SelectGroup,SelectItem,SelectLabel} from './ui/select';
import {estimateServicePickerGroups} from '../lib/estimate-service-picker-options';

type SelectVisualTone='custom'|'exterior'|'drainage'|'glass'|'outdoor'|'vents'|'vehicles'|'special'|'digital'|'people'|'field'|'materials'|'operations'|'electronic'|'manual';
const groupIcons={
 custom:FilePenLine,exterior:House,drainage:Droplets,glass:Waves,outdoor:Leaf,vents:Wind,
 vehicles:Truck,special:Wrench,digital:Smartphone,people:Users,field:MapPin,
 materials:Paintbrush,operations:Coins,electronic:CreditCard,manual:Receipt,
} as const;
const options={
 source:[
  {name:'Online',tone:'digital',values:['Google','Facebook','Website']},
  {name:'Customers & Referrals',tone:'people',values:['Referral','Repeat customer']},
  {name:'Field & Other',tone:'field',values:['Door knocking','Other','Unknown']},
 ],
 expense:[
  {name:'Materials & Equipment',tone:'materials',values:['Supplies','Chemicals','Equipment']},
  {name:'Operations',tone:'operations',values:['Fuel','Labor']},
  {name:'Other',tone:'special',values:['Other']},
 ],
 payment:[
  {name:'Electronic Payments',tone:'electronic',values:['Wave','Cash App','Venmo','Card','ACH / bank']},
  {name:'Manual & Other',tone:'manual',values:['Cash','Check','Other']},
 ],
} as const;

function GroupMark({tone}:{tone:SelectVisualTone}){
 const Icon=groupIcons[tone]??CircleHelp;
 return <span className="fire-menu-symbol" data-tone={tone} aria-hidden="true"><Icon/></span>;
}
function GroupHeader({name,tone,count}:{name:string;tone:SelectVisualTone;count:number}){
 return <SelectLabel className="fire-menu-category" data-tone={tone}>
   <GroupMark tone={tone}/><strong>{name}</strong><small>{count}</small>
 </SelectLabel>;
}
/** Render the original controlled option IDs, with visual families only. */
export function CategorizedServiceOptions({catalog}:{catalog:readonly {id:string;name:string;category?:string}[]}){
 return <>{estimateServicePickerGroups(catalog).map(group=><SelectGroup key={group.key} className="fire-menu-group">
   <GroupHeader name={group.label} tone={group.tone as SelectVisualTone} count={group.items.length}/>
   {group.items.map(service=><SelectItem key={service.id} value={service.id} textValue={service.name}
      className="estimate-service-picker-item fire-visual-option" aria-label={service.name} data-tone={group.tone}>
      <span className="fire-visual-option-body">
       <GroupMark tone={group.tone as SelectVisualTone}/>
       <span className="fire-option-name">{service.name}</span>
       {service.category==='supplemental'&&<small className="fire-option-addon" aria-hidden="true">Add-on</small>}
      </span>
   </SelectItem>)}
 </SelectGroup>)}</>;
}
/** Reusable categorized long choices: no changes to the saved string values. */
export function VisualChoiceOptions({kind,values}:{kind:keyof typeof options;values:readonly string[]}){
 const allGroups=options[kind];
 const mapped=new Set<string>(allGroups.flatMap(group=>[...group.values]));
 const rendered:Array<{key:string;name:string;tone:SelectVisualTone;values:string[]}>=allGroups.map(group=>({
   key:group.name,name:group.name,tone:group.tone,
   values:values.filter(value=>(group.values as readonly string[]).includes(value)),
 })).filter(group=>group.values.length);
 const extras=values.filter(value=>!mapped.has(value));
 if(extras.length)rendered.push({key:'Other options',name:'Other Options',tone:'special',values:extras});
 return <>{rendered.map(group=><SelectGroup className="fire-menu-group" key={group.key}>
   <GroupHeader name={group.name} tone={group.tone as SelectVisualTone} count={group.values.length}/>
   {group.values.map(value=><SelectItem className="fire-visual-option" data-tone={group.tone} key={value} value={value} textValue={value} aria-label={value}>
      <span className="fire-visual-option-body"><GroupMark tone={group.tone as SelectVisualTone}/><span className="fire-option-name">{value}</span></span>
    </SelectItem>)}
 </SelectGroup>)}</>;
}
