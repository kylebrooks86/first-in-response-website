"use client";
import { summarizeProcessing } from "../lib/processing-fees";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ArrowLeft,
  BriefcaseBusiness,
  Clock3,
  Camera,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  CheckCircle2,
  Gauge,
  Globe2,
  House,
  Images,
  Eye,
  FileText,
  Mail,
  MapPin,
  Navigation,
  Menu,
  MessageSquareText,
  Moon,
  Phone,
  Plus,
  Receipt,
  Search,
  Save,
  Send,
  Settings,
  SquareKanban,
  List,
  Star,
  Sparkles,
  StickyNote,
  Sun,
  Trash2,
  PenLine,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FIRE_TEMPLATES, fillTemplate, type FireTemplate } from "@/lib/fire-templates";
import { FIRE_SERVICES as services, serviceDescriptionFor } from "@/lib/fire-services";
import { DEFAULT_CASH_APP_HANDLE, DEFAULT_VENMO_HANDLE } from "@/lib/payment-methods";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

type EstimateItemRow = { id:string; name:string; description:string; quantity:number; unit:string; totalCents:number };
type EstimateRow = { id:string; customerId?:string; customer:string; email?:string; phone?:string; address?:string; service:string; serviceDescription?:string; items?:EstimateItemRow[]; subtotalCents?:number; discountCents?:number; appreciationDiscount?:number|boolean; additionalDiscountType?:"percent"|"dollar"; additionalDiscountValue?:number; status:string; totalCents:number; depositCents:number; paidCents:number; scheduledAt?:string|null; invoiceId?:string|null; invoiceShareToken?:string|null; invoiceTotalCents?:number|null; shareToken?:string|null; firstViewedAt?:string|null; acceptedAt?:string|null; signedName?:string|null; signedAt?:string|null; contractInitials?:string|null; photoRelease?:string|null; pendingChangeCount?:number; latestChangeRequest?:string|null; lastReviewRequestAt?:string|null; lastRebookMessageAt?:string|null; paymentOverageOpen?:number; pendingRefundCount?:number; createdAt:string };
type CustomerRow = { id:string; name:string; email:string; phone:string; address:string; leadSource?:string; createdAt:string; estimateCount:number; estimateTotal:number; paidTotal:number };
type CustomerEstimate = { id:string; customerId:string; service:string; serviceDescription?:string; items?:EstimateItemRow[]; subtotalCents?:number; discountCents?:number; appreciationDiscount?:number|boolean; additionalDiscountType?:"percent"|"dollar"; additionalDiscountValue?:number; status:string; totalCents:number; depositCents:number; paidCents:number; scheduledAt?:string|null; invoiceId?:string|null; invoiceShareToken?:string|null; invoiceTotalCents?:number|null; shareToken?:string|null; firstViewedAt?:string|null; acceptedAt?:string|null; signedName?:string|null; signedAt?:string|null; contractInitials?:string|null; photoRelease?:string|null; pendingChangeCount?:number; latestChangeRequest?:string|null; lastReviewRequestAt?:string|null; lastRebookMessageAt?:string|null; paymentOverageOpen?:number; pendingRefundCount?:number; createdAt:string };
type CustomerNote = { id:string; customerId:string; body:string; createdAt:string };
type InvoiceRow = { id:string; estimateId:string; customerId:string; customer?:string; email?:string; phone?:string; address?:string; service?:string; status:string; subtotalCents?:number; discountCents?:number; discountType?:"percent"|"dollar"; discountValue?:number; totalCents:number; paidCents?:number; dueAt?:string|null; shareToken?:string|null; firstViewedAt?:string|null; paymentOverageOpen?:number; pendingRefundCount?:number; createdAt:string };
type CustomerPhoto = { id:string; customerId:string; category:"before"|"after"|"property"; caption?:string; filename:string; contentType:string; sizeBytes:number; createdAt:string };
type CustomerMessage = { id:string; customerId:string; estimateId?:string|null; channel:"text"|"email"|"copy"; template:string; body:string; createdAt:string };
type AppNotification = { id:string; type:string; title:string; body:string; customerId?:string|null; estimateId?:string|null; readAt?:string|null; resolvedAt?:string|null; createdAt:string };
type TaskRow = { id:string; title:string; customerId?:string|null; customer?:string|null; dueAt?:string|null; status:string; notes?:string|null; createdAt:string; completedAt?:string|null };
type ExpenseRow = { id:string; estimateId?:string|null; category:string; description:string; amountCents:number; incurredAt:string; customer?:string|null; service?:string|null };
type PaymentRow = { processingFeeCents?:number|null; grossReceivedCents?:number|null; bundledTipCents?:number|null; processingMethod?:string|null; id:string; estimateId:string; customerId?:string; customer?:string; service?:string; type:string; amountCents:number; status:string; reference?:string|null; refundedCents?:number; refundableCents?:number; stripePayment?:number; createdAt:string };
type JobReportRow = { id:string; estimateId:string; customerId:string; checklist:string; notes?:string; airflowBefore?:string; airflowAfter?:string; status:string; createdAt:string; completedAt?:string|null };

const statusLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-US", { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit" }) : "Not scheduled";
const paymentTypeLabel = (value?: string | null) => value ? value.charAt(0).toUpperCase()+value.slice(1) : "Payment";
const resolvedBillingTotalCents = (estimate: Pick<EstimateRow,"totalCents">&Partial<Pick<EstimateRow,"invoiceTotalCents">>) => estimate.invoiceTotalCents ?? estimate.totalCents;
const exactCents=(value:unknown)=>Number.isSafeInteger(Number(value))&&Number(value)>=0;
const safeBillingState=(estimate: Pick<EstimateRow,"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"invoiceTotalCents"|"depositCents">>)=>{
  const total=resolvedBillingTotalCents(estimate);
  return exactCents(total)&&exactCents(estimate.paidCents)&&(estimate.depositCents===undefined||exactCents(estimate.depositCents));
};
const billingBalanceCents = (estimate: Pick<EstimateRow,"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"invoiceTotalCents"|"depositCents">>) => safeBillingState(estimate)?Math.max(0,resolvedBillingTotalCents(estimate)-estimate.paidCents):0;
const exactSignedCents=(value:unknown)=>Number.isSafeInteger(Number(value));
const safeSumCents=(values:number[])=>values.reduce((sum,value)=>Number.isSafeInteger(sum)&&exactCents(value)&&Number.isSafeInteger(sum+value)?sum+value:sum,0);
const safeSignedSumCents=(values:number[])=>values.reduce((sum,value)=>Number.isSafeInteger(sum)&&exactSignedCents(value)&&Number.isSafeInteger(sum+value)?sum+value:sum,0);
const reviewLink = "https://firstinresponseexteriors.com/review";
const amountDueNow = (estimate: Pick<EstimateRow,"status"|"totalCents"|"depositCents"|"paidCents">&Partial<Pick<EstimateRow,"invoiceTotalCents">>) => {
  if(!safeBillingState(estimate))return 0;
  const finalInvoiceTotal=estimate.invoiceTotalCents;
  const limit = estimate.status === "completed" ? (finalInvoiceTotal??estimate.totalCents) : ["approved","scheduled"].includes(estimate.status) ? (finalInvoiceTotal??estimate.depositCents) : 0;
  return exactCents(limit)?Math.max(0, limit - estimate.paidCents):0;
};


function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function repeatCadenceMonths(service:string){
  const value=service.toLowerCase();
  if(value.includes("trash")||value.includes("bin"))return 3;
  if(value.includes("commercial")||value.includes("window"))return 6;
  if(value.includes("roof"))return 24;
  return 12;
}

function addMonths(value:string,months:number){const date=new Date(value);date.setMonth(date.getMonth()+months);return date;}

function FireMark({ small = false }: { small?: boolean }) {
  return <img className={`fire-logo ${small ? "small" : ""}`} src="/fire-app-logo.png" alt="" aria-hidden="true" />;
}

function StrideButton({ top = false }: { top?: boolean }) {
  const [showSetup, setShowSetup] = useState(false);
  const shortcutUrl = "shortcuts://run-shortcut?name=Open%20Stride";
  const openShortcut = () => { window.location.href = shortcutUrl; };
  const openStride = () => {
    if (window.localStorage.getItem("fire-stride-shortcut-ready") === "yes") openShortcut();
    else setShowSetup(true);
  };
  const testShortcut = () => {
    window.localStorage.setItem("fire-stride-shortcut-ready", "yes");
    setShowSetup(false);
    openShortcut();
  };
  return <>
    <button type="button" className={top ? "top-stride-button" : undefined} onClick={openStride} aria-label="Open Stride" title="Open Stride"><Gauge /> <span>{top ? "Stride" : "Open Stride"}</span></button>
    <Dialog open={showSetup} onOpenChange={setShowSetup}>
      <DialogContent className="stride-setup sm:max-w-[480px]">
        <DialogHeader><DialogTitle>Connect Stride once</DialogTitle></DialogHeader>
        <p>Stride does not provide a direct app link, but an iPhone Shortcut can open the installed app from FIRE.</p>
        <ol>
          <li>Tap <strong>Open Shortcuts</strong>, then tap <strong>+</strong>.</li>
          <li>Add the <strong>Open App</strong> action and choose <strong>Stride</strong>.</li>
          <li>Name the shortcut exactly <strong>Open Stride</strong>, then tap <strong>Done</strong>.</li>
          <li>Return here and tap <strong>I made it — test now</strong>.</li>
        </ol>
        <div className="stride-setup-actions">
          <Button type="button" variant="outline" onClick={() => { window.location.href = "shortcuts://"; }}><Settings className="h-4 w-4" /> Open Shortcuts</Button>
          <Button type="button" className="brand-button" onClick={testShortcut}><Gauge className="h-4 w-4" /> I made it — test now</Button>
        </div>
        <a className="stride-store-link" href="https://apps.apple.com/us/app/stride-mileage-tax-tracker/id1041591359" target="_blank" rel="noreferrer">Need Stride? Get or update it in the App Store <ExternalLink /></a>
        <small>After this one-time setup, the FIRE button opens Stride directly. You will still tap “Track Miles” inside Stride.</small>
      </DialogContent>
    </Dialog>
  </>;
}

function PropertyPreview({ address }: { address: string }) {
  const encodedAddress = encodeURIComponent(address);
  const satelliteUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=k&z=19&output=embed`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const googleEarthUrl = `https://earth.google.com/web/search/${encodedAddress}`;

  return <section className="property-preview" aria-label="Property preview">
    <header>
      <div><span className="property-preview-icon"><House /></span><div><strong>Property preview</strong><small>{address}</small></div></div>
      <span className="property-preview-label">Satellite</span>
    </header>
    <div className="property-map-frame">
      <iframe
        key={address}
        src={satelliteUrl}
        title={`Satellite view of ${address}`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
    <footer>
      <a className="primary-tool" href={googleMapsUrl} target="_blank" rel="noreferrer"><Eye /> Street View</a>
      <a href={googleEarthUrl} target="_blank" rel="noreferrer"><Globe2 /> Google Earth</a>
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving&dir_action=navigate`} target="_blank" rel="noreferrer"><Navigation /> Navigate</a>
    </footer>
    <p>Street View availability and image dates depend on Google’s coverage for this address.</p>
  </section>;
}

const messageLabels: Record<string,string> = Object.fromEntries(FIRE_TEMPLATES.map((item)=>[item.key,item.name]));

function MessageComposer({ customer, estimate, initialTemplate="estimate", triggerLabel="Message", onLogged, onSent }: { customer:CustomerRow; estimate?:CustomerEstimate|EstimateRow|null; initialTemplate?:string; triggerLabel?:string; onLogged?:(message:CustomerMessage)=>void; onSent?:()=>void|Promise<void> }) {
  const [open,setOpen]=useState(false);
  const [template,setTemplate]=useState(initialTemplate);
  const [body,setBody]=useState("");
  const [templates,setTemplates]=useState<FireTemplate[]>(FIRE_TEMPLATES);
  const [shareToken,setShareToken]=useState(estimate?.shareToken||"");
  const [invoiceShareToken,setInvoiceShareToken]=useState(estimate?.invoiceShareToken||"");
  const [siteOrigin,setSiteOrigin]=useState("");
  const [working,setWorking]=useState(false);
  const firstName=customer.name.trim().split(/\s+/)[0] || customer.name;
  const service=estimate?.service || "exterior cleaning service";
  const scheduled=estimate?.scheduledAt ? dateTime(estimate.scheduledAt) : "your scheduled time";
  const total=estimate ? money(resolvedBillingTotalCents(estimate)) : "the quoted amount";
  const balance=estimate ? money(billingBalanceCents(estimate)) : "the remaining balance";
  const customerLink=shareToken&&siteOrigin?`${siteOrigin}/estimate/${shareToken}`:"";
  const invoiceLink=invoiceShareToken&&siteOrigin?`${siteOrigin}/invoice/${invoiceShareToken}`:"";
  const variables:Record<string,string>={
    "@customer_first_name":firstName,"@customer_last_name":customer.name.trim().split(/\s+/).slice(1).join(" "),"@customer_name":customer.name,
    "@company_name":"First In Response Exteriors","@service_list":service,"@service_address":customer.address||"the service address",
    "@estimate_total":total,"@estimate_link":customerLink,"@invoice_total":balance,"@invoice_link":invoiceLink,
    "@schedule_date":scheduled,"@callback_number":"reply to this message","@form_link":"your customer report link","@review_link":reviewLink,
  };
  const activeTemplate=templates.find((item)=>item.key===template)??templates[0];
  const renderedBody=fillTemplate(activeTemplate?.body??"",variables).replace(/\s{2,}/g," ").trim();
  const renderedSubject=fillTemplate(activeTemplate?.subject||"A message from First In Response Exteriors",variables);
  const composerTemplates=templates.filter((item)=>item.channel!=="document");
  const needsInvoiceLink=["invoice","invoiceReminder","overdue"].includes(template);
  const needsEstimateLink=["estimate","followUp1","followUp3","followUp7"].includes(template);
  useEffect(()=>{
    if(!open)return;
    void (async()=>{try{const response=await fetch("/api/message-templates");const result=await response.json() as {templates?:FireTemplate[]};if(response.ok&&result.templates)setTemplates(result.templates);}catch{}})();
  },[open]);
  useEffect(()=>{
    if(!open||!estimate||shareToken||!needsEstimateLink)return;
    void (async()=>{try{const response=await fetch(`/api/estimates/${estimate.id}/share`,{method:"POST"});const result=await response.json() as {shareToken?:string};if(response.ok&&result.shareToken)setShareToken(result.shareToken);}catch{}})();
  },[open,estimate,shareToken,needsEstimateLink]);
  useEffect(()=>{
    if(!open||!estimate?.invoiceId||invoiceShareToken||!needsInvoiceLink)return;
    void (async()=>{try{const response=await fetch(`/api/invoices/${estimate.invoiceId}/share`,{method:"POST"});const result=await response.json() as {shareToken?:string};if(response.ok&&result.shareToken)setInvoiceShareToken(result.shareToken);}catch{}})();
  },[open,estimate,invoiceShareToken,needsInvoiceLink]);
  useEffect(()=>{if(open)setBody(renderedBody);},[open,renderedBody]);
  const log=async(channel:"text"|"email"|"copy")=>{
    setWorking(true);
    try{
      const response=await fetch("/api/customer-messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({customerId:customer.id,estimateId:estimate?.id,channel,template,body})});
      const result=await response.json() as {message?:CustomerMessage;duplicate?:boolean;error?:string};
      if(!response.ok||!result.message)return {ok:false,duplicate:false};
      onLogged?.(result.message);return {ok:true,duplicate:Boolean(result.duplicate)};
    }catch{return {ok:false,duplicate:false};}finally{setWorking(false);}
  };
  const sendText=async()=>{const logged=await log("text");if(!logged.ok||logged.duplicate)return;await onSent?.();window.location.href=`sms:${customer.phone}&body=${encodeURIComponent(body)}`;};
  const sendEmail=async()=>{const logged=await log("email");if(!logged.ok||logged.duplicate)return;await onSent?.();window.location.href=`mailto:${customer.email}?subject=${encodeURIComponent(renderedSubject)}&body=${encodeURIComponent(body)}`;};
  const copy=async()=>{await navigator.clipboard.writeText(body);await log("copy");setOpen(false);};
  return <Dialog open={open} onOpenChange={(value)=>{setOpen(value);if(value){setTemplate(initialTemplate);setSiteOrigin(window.location.origin);}}}>
    <DialogTrigger asChild><Button variant="outline"><MessageSquareText className="h-4 w-4" /> {triggerLabel}</Button></DialogTrigger>
    <DialogContent className="message-dialog sm:max-w-[620px]">
      <DialogHeader><DialogTitle>Message {customer.name}</DialogTitle></DialogHeader>
      <div className="message-builder">
        <div><Label>Message type</Label><Select value={template} onValueChange={setTemplate}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{composerTemplates.map((item)=><SelectItem key={item.key} value={item.key}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="customerMessage">Personalized message</Label><Textarea id="customerMessage" value={body} onChange={(event)=>setBody(event.target.value)} rows={8}/><small>Customer, service, price, date, address, and the private estimate or invoice link are filled in automatically when available. You can edit anything before sending.</small></div>
        <div className="message-actions"><Button variant="outline" onClick={()=>void copy()} disabled={working||!body.trim()}><Copy className="h-4 w-4"/> Copy</Button>{customer.email&&activeTemplate?.channel!=="sms"&&<Button variant="outline" onClick={()=>void sendEmail()} disabled={working||!body.trim()}><Mail className="h-4 w-4"/> Email</Button>}{customer.phone&&activeTemplate?.channel!=="email"&&<Button className="brand-button" onClick={()=>void sendText()} disabled={working||!body.trim()}><Send className="h-4 w-4"/> Text</Button>}</div>
      </div>
    </DialogContent>
  </Dialog>;
}

function CustomerPhotos({customer,photos,setPhotos}:{customer:CustomerRow;photos:CustomerPhoto[];setPhotos:React.Dispatch<React.SetStateAction<CustomerPhoto[]>>}){
  const cameraRef=useRef<HTMLInputElement>(null);
  const libraryRef=useRef<HTMLInputElement>(null);
  const [category,setCategory]=useState<"before"|"after"|"property">("before");
  const [caption,setCaption]=useState("");
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");
  const upload=async(files:FileList|null)=>{
    if(!files?.length)return;
    setUploading(true);setError("");
    try{
      for(const file of Array.from(files)){
        const form=new FormData();form.append("customerId",customer.id);form.append("category",category);form.append("caption",caption);form.append("photo",file);
        const response=await fetch("/api/customer-photos",{method:"POST",body:form});
        const result=await response.json() as {photo?:CustomerPhoto;error?:string};
        if(!response.ok||!result.photo)throw new Error(result.error||"Photo upload failed.");
        setPhotos((current)=>[result.photo!,...current]);
      }
      setCaption("");
    }catch(uploadError){setError(uploadError instanceof Error?uploadError.message:"Photo upload failed.");}
    finally{setUploading(false);if(cameraRef.current)cameraRef.current.value="";if(libraryRef.current)libraryRef.current.value="";}
  };
  const remove=async(photo:CustomerPhoto)=>{
    if(!window.confirm(`Delete this ${photo.category} photo?`))return;
    const response=await fetch(`/api/customer-photos/${photo.id}`,{method:"DELETE"});
    if(response.ok)setPhotos((current)=>current.filter((item)=>item.id!==photo.id));
  };
  const own=photos.filter((photo)=>photo.customerId===customer.id);
  return <div className="photo-panel">
    <div className="photo-toolbar">
      <div><Label>Photo type</Label><Select value={category} onValueChange={(value)=>setCategory(value as typeof category)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="before">Before</SelectItem><SelectItem value="after">After</SelectItem><SelectItem value="property">Property / damage</SelectItem></SelectContent></Select></div>
      <div className="photo-caption"><Label htmlFor="photoCaption">Optional note</Label><Input id="photoCaption" value={caption} onChange={(event)=>setCaption(event.target.value)} placeholder="North siding, cracked outlet cover…"/></div>
      <div className="photo-buttons"><Button className="brand-button" onClick={()=>cameraRef.current?.click()} disabled={uploading}><Camera className="h-4 w-4"/>{uploading?"Uploading…":"Camera"}</Button><Button variant="outline" onClick={()=>libraryRef.current?.click()} disabled={uploading}><Images className="h-4 w-4"/>Photo library</Button></div>
      <input ref={cameraRef} className="photo-input" type="file" accept="image/*" capture="environment" onChange={(event)=>void upload(event.target.files)}/>
      <input ref={libraryRef} className="photo-input" type="file" accept="image/*" multiple onChange={(event)=>void upload(event.target.files)}/>
    </div>
    {error&&<p className="save-error" role="alert">{error}</p>}
    {own.length?<div className="photo-groups">{(["before","after","property"] as const).map((type)=>{const group=own.filter((photo)=>photo.category===type);if(!group.length)return null;return <section key={type}><header><strong>{type==="property"?"Property / damage":statusLabel(type)}</strong><span>{group.length}</span></header><div className="photo-grid">{group.map((photo)=><article className="photo-card" key={photo.id}><a href={`/api/customer-photos/${photo.id}`} target="_blank" rel="noreferrer"><img src={`/api/customer-photos/${photo.id}`} alt={`${statusLabel(photo.category)} photo${photo.caption?`: ${photo.caption}`:""}`} loading="lazy"/></a><div><p>{photo.caption||photo.filename}</p><small>{new Date(photo.createdAt).toLocaleDateString()}</small></div><button onClick={()=>void remove(photo)} aria-label="Delete photo"><Trash2/></button></article>)}</div></section>})}</div>:<div className="record-empty"><Camera/><strong>No property photos yet</strong><p>Choose Before, After, or Property / damage, then use your camera or photo library.</p></div>}
  </div>;
}

type DiscountMode = "percent" | "dollar";
type EditableEstimateItem={id?:string;serviceId:string;name:string;description:string;quantity:number;unit:string;unitRateCents:number};

function discountMath(subtotal:number, appreciation:boolean, mode:DiscountMode, rawValue:number){
  const appreciationCents=appreciation?Math.round(subtotal*0.05):0;
  let additionalCents=0;
  if(mode==="percent") {
    const maxPercent=appreciation?45:50;
    const percent=Math.min(maxPercent,Math.max(0,Number(rawValue)||0));
    additionalCents=Math.round(subtotal*(percent/100));
  } else {
    additionalCents=Math.min(subtotal,Math.max(0,Math.round((Number(rawValue)||0)*100)));
  }
  const requestedDiscount=Math.min(subtotal,appreciationCents+additionalCents);
  const total=subtotal>0?Math.max(15000,subtotal-requestedDiscount):0;
  const appliedDiscount=Math.max(0,subtotal-total);
  return {appreciationCents,additionalCents,requestedDiscount,total,appliedDiscount,deposit:Math.round(total/2)};
}

function NewEstimate({ onSaved, customer }: { onSaved?: (estimate: EstimateRow) => void; customer?: CustomerRow }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [customerName,setCustomerName]=useState(customer?.name??"");
  const [email,setEmail]=useState(customer?.email??"");
  const [phone,setPhone]=useState(customer?.phone??"");
  const [address,setAddress]=useState(customer?.address??"");
  const [items,setItems]=useState<EditableEstimateItem[]>([{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);
  const [appreciationDiscount,setAppreciationDiscount]=useState(false);
  const [discountMode,setDiscountMode]=useState<DiscountMode>("percent");
  const [discountValue,setDiscountValue]=useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const subtotal=items.reduce((sum,item)=>sum+Math.round((Number(item.quantity)||0)*(Number(item.unitRateCents)||0)),0);
  const discount=discountMath(subtotal,appreciationDiscount,discountMode,Number(discountValue));
  const total=discount.total;
  const deposit=discount.deposit;
  const updateItem=(index:number,patch:Partial<EditableEstimateItem>)=>setItems((current)=>current.map((item,i)=>i===index?{...item,...patch}:item));
  const addService=()=>setItems((current)=>[...current,{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);

  const saveEstimate = async () => {
    if(!customerName.trim()){setStep(1);setError("Customer name is required.");return;}
    if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitRateCents)||item.unitRateCents<0)){setStep(2);setError("Every service needs a service, quantity, and valid price.");return;}
    const maxPercent=appreciationDiscount?45:50;
    if(discountMode==="percent"&&(Number(discountValue)||0)>maxPercent){setError(`Additional percentage discount cannot exceed ${maxPercent}% with the current appreciation-discount setting.`);return;}
    if(discountMode==="dollar"&&Math.round((Number(discountValue)||0)*100)>subtotal){setError("Dollar discount cannot exceed the service subtotal.");return;}
    setSaving(true);setError("");
    try {
      const payloadItems=items.map((item)=>({name:item.name,description:item.description,quantity:item.quantity,unit:item.unit,totalCents:Math.round(item.quantity*item.unitRateCents)}));
      const response = await fetch("/api/estimates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: customer?.id, customer: customerName.trim(), email:email.trim(), phone:phone.trim(), address:address.trim(), items:payloadItems, appreciationDiscount, additionalDiscountType:discountMode, additionalDiscountValue:discountMode==="percent"?Math.round((Number(discountValue)||0)*100):Math.round((Number(discountValue)||0)*100) }),
      });
      const result = await response.json() as { id?: string; customerId?:string; shareToken?:string; subtotalCents?:number;discountCents?:number;totalCents?:number;depositCents?:number;error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "The estimate could not be saved.");
      const createdAt = new Date().toISOString();
      onSaved?.({ id: result.id, customerId: result.customerId||customer?.id, customer: customerName.trim(), email:email.trim(), phone:phone.trim(), address:address.trim(), service: items.map((item)=>item.name).join(", "), serviceDescription:items[0]?.description||"", items:payloadItems.map((item,index)=>({...item,id:`new-${index}`})), status: "draft", subtotalCents:Number(result.subtotalCents??subtotal), discountCents:Number(result.discountCents??discount.appliedDiscount), appreciationDiscount, additionalDiscountType:discountMode, additionalDiscountValue:discountMode==="percent"?Math.round((Number(discountValue)||0)*100):Math.round((Number(discountValue)||0)*100), totalCents: Number(result.totalCents??total), depositCents: Number(result.depositCents??deposit), paidCents: 0, shareToken:result.shareToken, createdAt });
      setSaved(true);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "The estimate could not be saved. Please try again."); }
    finally { setSaving(false); }
  };

  const reset = (value: boolean) => {
    setOpen(value);
    if (!value) setTimeout(() => { setStep(1);setSaved(false);setError("");setItems([{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);setAppreciationDiscount(false);setDiscountMode("percent");setDiscountValue("");if(!customer){setCustomerName("");setEmail("");setPhone("");setAddress("");} }, 250);
  };

  return <Dialog open={open} onOpenChange={reset}>
    <DialogTrigger asChild><Button className="brand-button"><Plus className="h-4 w-4" /> New estimate</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto border-0 p-0 sm:max-w-[620px]">
      <div className="estimate-head"><DialogHeader><DialogTitle className="text-xl">Create estimate</DialogTitle></DialogHeader><p className="mt-1 text-sm text-slate-500">Step {step} of 2 · {step===1?"Customer details":"Services and pricing"}</p><Progress value={step*50} className="mt-4 h-1.5"/></div>
      {saved?<div className="px-6 py-12 text-center"><span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-8 w-8"/></span><h2 className="text-2xl font-extrabold">Estimate ready</h2><p className="mx-auto mt-2 max-w-sm text-slate-500">{money(total)} total. A {money(deposit)} (50%) deposit reserves the customer&apos;s place on the schedule; the remaining balance is due when the work is completed.</p><div className="mt-7 flex justify-center"><Button className="brand-button" onClick={()=>reset(false)}>Done</Button></div></div>
      :step===1?<div className="space-y-5 px-6 py-6"><div className="grid gap-2"><Label>Customer name</Label><Input placeholder="Full name" value={customerName} onChange={(event)=>setCustomerName(event.target.value)} readOnly={Boolean(customer)}/></div><div className="grid gap-2"><Label>Email</Label><Input type="email" placeholder="customer@email.com" value={email} onChange={(event)=>setEmail(event.target.value)} readOnly={Boolean(customer)}/></div><div className="grid gap-2"><Label>Phone</Label><Input inputMode="tel" placeholder="(918) 555-0123" value={phone} onChange={(event)=>setPhone(event.target.value)} readOnly={Boolean(customer)}/></div><div className="grid gap-2"><Label>Service address</Label><Input placeholder="Tulsa-area address" value={address} onChange={(event)=>setAddress(event.target.value)} readOnly={Boolean(customer)}/></div>{error&&<p className="save-error" role="alert">{error}</p>}<Button className="brand-button w-full" onClick={()=>{if(!customerName.trim()){setError("Customer name is required.");return;}setError("");setStep(2);}}>Continue to services <ChevronRight className="h-4 w-4"/></Button></div>
      :<div className="space-y-5 px-6 py-6">
        <div className="estimate-edit-items">{items.map((item,index)=><section className="estimate-edit-service" key={item.id||index}><header><strong>Service {index+1}</strong>{items.length>1&&<button type="button" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove service ${index+1}`}><Trash2/></button>}</header>
          <div><Label>Service</Label><Select value={item.serviceId} onValueChange={(value)=>{const svc=services.find((entry)=>entry.id===value);if(!svc)return;updateItem(index,{serviceId:value,name:svc.name,description:svc.description,unit:svc.unit,unitRateCents:svc.rate||0,quantity:svc.unit==="job"?1:0});setError("");}}><SelectTrigger><SelectValue placeholder="Choose a service"/></SelectTrigger><SelectContent>{services.map((svc)=><SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Service description and expectations</Label><Textarea rows={7} value={item.description} onChange={(event)=>updateItem(index,{description:event.target.value})}/><p className="service-description-help">This wording appears beneath this service on the estimate and invoice.</p></div>
          <div className="edit-quantity-row"><div><Label>Quantity</Label><Input inputMode="decimal" value={item.quantity||""} onChange={(event)=>updateItem(index,{quantity:Number(event.target.value)})}/></div><span>{item.unit||"unit"}</span></div>
          <div><Label>Price per unit</Label><div className="discount-input"><span>$</span><Input inputMode="decimal" value={item.unitRateCents?String(item.unitRateCents/100):""} onChange={(event)=>updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})}/></div></div><strong className="edit-line-total">Line total {money(Math.round(item.quantity*item.unitRateCents))}</strong>
        </section>)}</div>
        <Button variant="outline" className="w-full" onClick={addService}><Plus className="h-4 w-4"/> Add another service</Button>
        <button type="button" onClick={()=>setAppreciationDiscount((value)=>!value)} className={`discount-row ${appreciationDiscount?"selected":""}`}><span><strong>5% First Responder & Military</strong><small>Year-round appreciation discount</small></span><span className="check-box">{appreciationDiscount&&<Check className="h-4 w-4"/>}</span></button>
        <section className="edit-discount-card"><Label>Additional bundle, promotion, or family discount</Label><div className="discount-mode-row"><Button type="button" variant={discountMode==="percent"?"default":"outline"} onClick={()=>{setDiscountMode("percent");setDiscountValue("");}}>% Percentage</Button><Button type="button" variant={discountMode==="dollar"?"default":"outline"} onClick={()=>{setDiscountMode("dollar");setDiscountValue("");}}>$ Dollar amount</Button></div><div className="discount-input"><span>{discountMode==="percent"?"%":"$"}</span><Input inputMode="decimal" value={discountValue} onChange={(event)=>setDiscountValue(event.target.value)} placeholder="0"/></div><p className="service-description-help">Choose percentage or dollar amount. Percentage discounts stack with the 5% appreciation discount, up to 50% total.</p></section>
        <div className="edit-totals"><span>Service subtotal<strong>{money(subtotal)}</strong></span><span>Discount<strong>−{money(discount.appliedDiscount)}</strong></span><span>Customer total<strong>{money(total)}</strong></span><span>50% deposit to schedule<strong>{money(deposit)}</strong></span></div>
        {subtotal>0&&subtotal-discount.requestedDiscount<15000&&<p className="service-description-help">The $150 minimum job charge is applied automatically.</p>}{error&&<p className="save-error" role="alert">{error}</p>}
        <div className="flex gap-3"><Button variant="outline" onClick={()=>setStep(1)} disabled={saving}>Back</Button><Button className="brand-button flex-1" onClick={()=>void saveEstimate()} disabled={saving}>{saving?"Saving…":`Save ${money(total)} estimate`}</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}

function DashboardView({userName,metrics,estimates,onSaved,onNavigate}:{userName:string;metrics:{estimates:number;openValue:number;outstanding:number};estimates:EstimateRow[];onSaved:(estimate:EstimateRow)=>void;onNavigate:(tab:string)=>void}) {
  const now = useCurrentTime();
  const upcoming = estimates.filter((estimate)=>estimate.scheduledAt && new Date(estimate.scheduledAt).getTime() >= now).length;
  const completed = estimates.filter((estimate)=>estimate.status === "completed").length;
  return (
    <div className="dashboard-view">
      <section className="welcome-row"><div><p className="eyebrow">FIRE App</p><h1>Welcome, {userName}</h1><p>Customers, estimates, jobs, and balances in one place.</p></div><NewEstimate onSaved={onSaved} /></section>
      <section className="metric-grid">
        <button className="metric-card accent" onClick={()=>onNavigate("payments")}><span className="metric-icon red"><CircleDollarSign /></span><p>Outstanding</p><strong>{money(metrics.outstanding)}</strong><small>View unpaid balances</small><ChevronRight className="metric-arrow"/></button>
        <button className="metric-card" onClick={()=>onNavigate("schedule")}><span className="metric-icon blue"><CalendarDays /></span><p>Upcoming jobs</p><strong>{upcoming}</strong><small>Open the schedule</small><ChevronRight className="metric-arrow"/></button>
        <button className="metric-card" onClick={()=>onNavigate("estimates")}><span className="metric-icon gold"><ClipboardList /></span><p>Saved estimates</p><strong>{metrics.estimates}</strong><small>{money(metrics.openValue)} open value</small><ChevronRight className="metric-arrow"/></button>
        <button className="metric-card" onClick={()=>onNavigate("estimates")}><span className="metric-icon green"><CheckCircle2 /></span><p>Completed jobs</p><strong>{completed}</strong><small>Review completed work</small><ChevronRight className="metric-arrow"/></button>
      </section>
      <section className="attention-card">
        <div><span className="spark"><Sparkles /></span><div><strong>Keep every job moving</strong><p>Use Follow-ups for reminders and Payments to record money received through Wave, Cash App, Venmo, cash, check, card, or bank transfer.</p></div></div>
        <Button variant="outline" onClick={() => onNavigate("followups")}>Review follow-ups <ChevronRight className="h-4 w-4" /></Button>
      </section>
      <div className="content-grid">
        <section className="panel"><header><div><h2>Recent estimates</h2><p>Tap any row to continue the job</p></div><button onClick={() => onNavigate("estimates")}>View all</button></header><div className="job-list">{estimates.length?estimates.map((estimate) => <button className="job-row" key={estimate.id} onClick={()=>onNavigate("estimates")}><span className="date-tile"><b>{new Date(estimate.createdAt).getDate()}</b><small>{new Date(estimate.createdAt).toLocaleString("en-US",{month:"short"}).toUpperCase()}</small></span><div className="job-main"><strong>{estimate.customer}</strong><p>{estimate.service}</p></div><span className="status-pill">{estimate.status}</span><strong className="job-price">{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight className="row-arrow" /></button>):<div className="real-empty"><strong>No estimates yet</strong><p>Create your first estimate to start the customer record.</p></div>}</div></section>
        <section className="panel quick-actions-panel"><header><div><h2>Quick actions</h2><p>Common field shortcuts</p></div></header><div className="quick-actions-grid">
          <button onClick={()=>onNavigate("customers")}><span className="quick-icon red"><Users/></span><span><strong>Customers</strong><small>Profiles, photos, and history</small></span><ChevronRight/></button>
          <button onClick={()=>onNavigate("schedule")}><span className="quick-icon blue"><CalendarDays/></span><span><strong>Schedule</strong><small>Jobs and driving plan</small></span><ChevronRight/></button>
          <button onClick={()=>onNavigate("followups")}><span className="quick-icon gold"><Clock3/></span><span><strong>Follow-ups</strong><small>Reminders and customer contact</small></span><ChevronRight/></button>
          <button onClick={()=>onNavigate("payments")}><span className="quick-icon green"><CircleDollarSign/></span><span><strong>Payments</strong><small>Deposits and balances</small></span><ChevronRight/></button>
        </div></section>
      </div>
    </div>
  );
}

function AddCustomer({ onAdded }: { onAdded: (customer: CustomerRow) => void }) {
  const [open, setOpen] = useState(false);
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [address,setAddress]=useState("");
  const [leadSource,setLeadSource]=useState("Referral");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (!name.trim()) { setError("Customer name is required."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name:name.trim(), email:email.trim(), phone:phone.trim(), address:address.trim(), leadSource }) });
      const result = await response.json() as { customer?: CustomerRow; error?: string };
      if (!response.ok || !result.customer) throw new Error(result.error || "The customer could not be saved.");
      onAdded(result.customer);
      setName("");setEmail("");setPhone("");setAddress("");
      setOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The customer could not be saved.");
    } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setError(""); }}>
    <DialogTrigger asChild><Button className="brand-button"><UserPlus className="h-4 w-4" /> Add customer</Button></DialogTrigger>
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader>
      <div className="customer-form">
        <div><Label>Customer name</Label><Input placeholder="Full name" value={name} onChange={(event)=>setName(event.target.value)} /></div>
        <div><Label>Email</Label><Input type="email" placeholder="customer@email.com" value={email} onChange={(event)=>setEmail(event.target.value)} /></div>
        <div><Label>Phone</Label><Input inputMode="tel" placeholder="(918) 555-0123" value={phone} onChange={(event)=>setPhone(event.target.value)} /></div>
        <div><Label>Service address</Label><Input placeholder="Tulsa-area address" value={address} onChange={(event)=>setAddress(event.target.value)} /></div>
        <div><Label>How they found FIRE</Label><Select value={leadSource} onValueChange={setLeadSource}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Referral","Google","Facebook","Website","Repeat customer","Door knocking","Other"].map((source)=><SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div>
        {error && <p className="save-error" role="alert">{error}</p>}
        <Button className="brand-button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save customer"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

const reportChecks=["Property condition documented","Before photos captured","Plants and fragile areas protected","Service completed as quoted","After photos captured","Customer walkthrough completed"];
function JobReport({estimate,onSaved}:{estimate:EstimateRow;onSaved?:(complete:boolean)=>void}){
  const [open,setOpen]=useState(false);const [checks,setChecks]=useState<string[]>([]);const [notes,setNotes]=useState("");const [before,setBefore]=useState("");const [after,setAfter]=useState("");const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{if(!open)return;setLoading(true);setSaved(false);setError("");void (async()=>{try{const response=await fetch(`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`);const result=await response.json() as {reports?:JobReportRow[]};const report=result.reports?.[0];if(report){let checklist:Record<string,boolean>={};try{checklist=JSON.parse(report.checklist||"{}");}catch{}setChecks(reportChecks.filter((item)=>checklist[item]));setNotes(report.notes||"");setBefore(report.airflowBefore||"");setAfter(report.airflowAfter||"");}}catch{setError("The saved report could not be loaded.");}finally{setLoading(false);}})();},[open,estimate.id]);
  const toggle=(item:string)=>setChecks((current)=>current.includes(item)?current.filter((value)=>value!==item):[...current,item]);
  const save=async()=>{setSaving(true);setError("");try{const response=await fetch("/api/job-reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,customerId:estimate.customerId,checklist:Object.fromEntries(reportChecks.map((item)=>[item,checks.includes(item)])),notes,airflowBefore:before,airflowAfter:after,status:checks.length===reportChecks.length?"complete":"draft"})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"The report could not be saved.");setSaved(true);onSaved?.(checks.length===reportChecks.length);}catch(saveError){setError(saveError instanceof Error?saveError.message:"The report could not be saved.");}finally{setSaving(false);}};
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><ClipboardList className="h-4 w-4"/> Job report</Button></DialogTrigger><DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Service completion report</DialogTitle></DialogHeader><div className="job-report"><p>{loading?"Loading saved report…":"Document the property and completed work before leaving the job. Reopening this form updates the same report."}</p><div className="checklist">{reportChecks.map((item)=><label key={item}><input type="checkbox" checked={checks.includes(item)} onChange={()=>toggle(item)} disabled={loading}/><span>{item}</span></label>)}</div>{estimate.service.toLowerCase().includes("dryer")&&<div className="airflow-fields"><div><Label>Airflow before</Label><Input value={before} onChange={(event)=>setBefore(event.target.value)} placeholder="Optional reading"/></div><div><Label>Airflow after</Label><Input value={after} onChange={(event)=>setAfter(event.target.value)} placeholder="Optional reading"/></div></div>}<div><Label>Technician notes</Label><Textarea value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="Condition, work performed, exceptions, recommendations…" rows={4}/></div>{saved&&<p className="save-success">Job report saved.</p>}{error&&<p className="save-error">{error}</p>}<Button className="brand-button" onClick={()=>void save()} disabled={saving||loading}>{saving?"Saving…":"Save job report"}</Button></div></DialogContent></Dialog>;
}

function JobCost({estimate}:{estimate:EstimateRow}){
  const [open,setOpen]=useState(false);const [rows,setRows]=useState<ExpenseRow[]>([]);const [description,setDescription]=useState("");const [amount,setAmount]=useState("");const [category,setCategory]=useState("Supplies");
  const billingTotal=resolvedBillingTotalCents(estimate);
  const load=async()=>{const response=await fetch("/api/expenses");const result=await response.json() as {expenses?:ExpenseRow[]};if(response.ok)setRows((result.expenses??[]).filter((row)=>row.estimateId===estimate.id).map((row)=>({...row,amountCents:Number(row.amountCents)})));};
  useEffect(()=>{if(!open)return;void (async()=>{const response=await fetch("/api/expenses");const result=await response.json() as {expenses?:ExpenseRow[]};if(response.ok)setRows((result.expenses??[]).filter((row)=>row.estimateId===estimate.id).map((row)=>({...row,amountCents:Number(row.amountCents)})));})();},[open,estimate.id]);const total=rows.reduce((sum,row)=>sum+row.amountCents,0);
  const add=async()=>{const amountCents=Math.round(Number(amount)*100);if(!description.trim()||amountCents<=0)return;const response=await fetch("/api/expenses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,category,description,amountCents,incurredAt:new Date().toISOString()})});if(response.ok){setDescription("");setAmount("");void load();}};
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><CircleDollarSign className="h-4 w-4"/> Job costs</Button></DialogTrigger><DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Job costs and profit</DialogTitle></DialogHeader><div className="job-cost"><div className="profit-summary"><span><small>{estimate.invoiceId?"Final invoice":"Estimate"}</small><strong>{money(billingTotal)}</strong></span><span><small>Costs</small><strong>{money(total)}</strong></span><span><small>Estimated gross profit</small><strong>{money(billingTotal-total)}</strong></span></div><div className="cost-form"><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Supplies","Chemicals","Equipment","Fuel","Labor","Other"].map((item)=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select><Input value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="Expense description"/><Input value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="$ Amount"/><Button className="brand-button" onClick={()=>void add()}>Add cost</Button></div><div className="cost-list">{rows.map((row)=><div key={row.id}><span><strong>{row.description}</strong><small>{row.category}</small></span><b>{money(row.amountCents)}</b></div>)}{!rows.length&&<p>No job costs recorded yet.</p>}</div></div></DialogContent></Dialog>;
}


function ProcessingDetails({payment}:{payment:PaymentRow}) {
  if(payment.grossReceivedCents==null||!["Cash App","Venmo"].includes(payment.processingMethod??""))return null;
  return <small className="payment-handle-note">{payment.bundledTipCents?<>Invoice payment: {money(payment.amountCents)} · Tip: {money(payment.bundledTipCents)}<br/></>:null}Customer payment: {money(payment.grossReceivedCents)}<br/>Processing fee: {payment.processingFeeCents==null?"Not recorded":`−${money(payment.processingFeeCents)}`}<br/>Net received{payment.processingFeeCents==null?" before unrecorded fees":""}: {money(payment.grossReceivedCents-(payment.processingFeeCents??0))}</small>;
}
function ProcessingReport({payments}:{payments:PaymentRow[]}) {
 const fees=payments.reduce((sum,row)=>sum+(row.processingFeeCents??0),0);
 return <details className="business-panel"><summary>Processing fees · {money(fees)} recorded</summary><p>Gross includes tips; fees are expenses. Unrecorded fees are excluded. Refunds remain separate ledger entries; original fees are retained.</p><table style={{width:"100%"}}><thead><tr><th>Method</th><th>Gross</th><th>Fees</th><th>Net</th></tr></thead><tbody>{["Cash App","Venmo"].map(method=>{const totals=summarizeProcessing(payments,method);return <tr key={method}><th>{method}</th><td>{money(totals.gross)}{totals.tips>0&&<small style={{display:"block"}}>Tips {money(totals.tips)}</small>}</td><td>{money(totals.fees)}</td><td>{money(totals.net)}</td></tr>;})}</tbody></table></details>;
}

function RecordPayment({estimate,onRecorded}:{estimate:Pick<EstimateRow,"id"|"customer"|"service"|"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"depositCents"|"status"|"invoiceTotalCents">>;onRecorded?:(paidCents:number)=>void}){
  const [fee,setFee]=useState("");const [feeMode,setFeeMode]=useState<"fee"|"net">("fee");const [feeEstimate,setFeeEstimate]=useState<number|null>(null);const [open,setOpen]=useState(false);const [amount,setAmount]=useState("");const [tip,setTip]=useState("");const [method,setMethod]=useState("Wave");const [reference,setReference]=useState("");const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const billingTotal=estimate.invoiceTotalCents??estimate.totalCents;
  const normalized = {status:estimate.status??"completed",totalCents:billingTotal,depositCents:estimate.depositCents??Math.round(estimate.totalCents/2),paidCents:estimate.paidCents,invoiceTotalCents:estimate.invoiceTotalCents};
  const balance=amountDueNow(normalized);
  const totalRemaining=Math.max(0,normalized.totalCents-normalized.paidCents);
  const depositRemaining=Math.max(0,normalized.depositCents-normalized.paidCents);
  useEffect(()=>{if(open){setAmount(balance>0?(balance/100).toFixed(2):"");setTip("");setFee("");setFeeEstimate(null);setError("");}},[open,balance]);
  const feeMethod=method==="Cash App"||method==="Venmo";
  const grossCents=Math.round(Number(amount||0)*100)+Math.round(Number(tip||0)*100);
  const enteredFeeCents=fee===""?null:Math.round(Number(fee)*100);
  const processingFeeCents=enteredFeeCents==null?null:feeMode==="fee"?enteredFeeCents:grossCents-enteredFeeCents;
  const feeValid=processingFeeCents==null||Number.isSafeInteger(processingFeeCents)&&processingFeeCents>=0&&processingFeeCents<=grossCents;
  const save=async()=>{const amountCents=Math.round(Number(amount||0)*100);const tipCents=Math.round(Number(tip||0)*100);const maxTipCents=Math.min(normalized.totalCents,50000);if((!Number.isSafeInteger(amountCents)||amountCents<0)||(!Number.isSafeInteger(tipCents)||tipCents<0)||(amountCents<=0&&tipCents<=0)){setError("Enter a payment or tip amount.");return;}if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0){setError("This job's tip limit cannot be represented safely.");return;}if(tipCents>maxTipCents){setError("Tip cannot exceed the invoice total or $500.");return;}if(feeMethod&&!feeValid){setError("Fee and net deposited must be between zero and the customer payment.");return;}setSaving(true);setError("");try{const response=await fetch("/api/payments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,amountCents,tipCents,method,reference,processingFeeCents:feeMethod?processingFeeCents:undefined})});const result=await response.json() as {paidCents?:number;error?:string};if(!response.ok||result.paidCents===undefined)throw new Error(result.error||"The payment could not be recorded.");onRecorded?.(Number(result.paidCents));setOpen(false);}catch(saveError){setError(saveError instanceof Error?saveError.message:"The payment could not be recorded.");}finally{setSaving(false);}};
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" disabled={balance<=0&&normalized.status!=="completed"}><CircleDollarSign className="h-4 w-4"/>{balance<=0?(normalized.status==="completed"?"Record tip":"Deposit recorded"):"Record payment"}</Button></DialogTrigger><DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{balance<=0&&normalized.status==="completed"?"Record tip":"Record payment"}</DialogTitle></DialogHeader><div className="payment-form">
    <p className="payment-estimate-summary"><strong>{estimate.customer}</strong> · {estimate.service}<br/><span>{money(totalRemaining)} remaining</span></p>
    <div className="payment-due-options"><span><small>Deposit due</small><strong>{money(depositRemaining)}</strong></span><span><small>Full balance</small><strong>{money(totalRemaining)}</strong></span></div>
    <div><Label>Amount applied to invoice</Label><Input value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="0.00"/></div>{normalized.status==="completed"&&<div><Label>Tip received (optional)</Label><Input value={tip} onChange={(event)=>setTip(event.target.value)} inputMode="decimal" placeholder="0.00"/><small className="payment-handle-note">Recorded separately and does not change the invoice balance.</small></div>}
    <div><Label>Payment method</Label><Select value={method} onValueChange={(value)=>{setMethod(value);setFee("");setFeeEstimate(null);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Wave","Cash App","Venmo","Cash","Check","Card","ACH / bank","Other"].map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><small className="payment-handle-note">Cash App {DEFAULT_CASH_APP_HANDLE} · Venmo {DEFAULT_VENMO_HANDLE}</small></div>
    {feeMethod&&<details><summary>Processing fee (optional)</summary><div className="payment-form"><div><Label>Customer paid (invoice + tip)</Label><Input readOnly value={(grossCents/100).toFixed(2)}/></div><div><Label>Processing fee</Label><Input inputMode="decimal" value={feeMode==="fee"?fee:processingFeeCents==null?"":(processingFeeCents/100).toFixed(2)} placeholder="Not recorded" onChange={event=>{setFeeMode("fee");setFee(event.target.value);}}/></div><div><Label>Net deposited</Label><Input inputMode="decimal" value={feeMode==="net"?fee:processingFeeCents==null?"":((grossCents-processingFeeCents)/100).toFixed(2)} placeholder={(grossCents/100).toFixed(2)} onChange={event=>{setFeeMode("net");setFee(event.target.value);}}/></div><small>Enter the actual fee or net deposit. Invoice credit stays {money(Math.round(Number(amount||0)*100))}.</small>{method==="Venmo"&&<><Button type="button" variant="outline" onClick={()=>setFeeEstimate(Math.round(grossCents*0.019)+10)}>Estimate fee</Button>{feeEstimate!=null&&<div><small>Venmo Business direct-payment estimate: 1.9% + $0.10 = {money(feeEstimate)}. Check the actual transaction; Tap to Pay and rates may differ.</small><Button type="button" variant="outline" onClick={()=>{setFeeMode("fee");setFee((feeEstimate/100).toFixed(2));setFeeEstimate(null);}}>Use this fee</Button></div>}</>}</div></details>}
    <div><Label>Reference or note</Label><Input value={reference} onChange={(event)=>setReference(event.target.value)} placeholder="Wave transaction, check number, or note"/></div>
    {error&&<p className="save-error">{error}</p>}<Button className="brand-button" onClick={()=>void save()} disabled={saving}>{saving?"Saving…":Number(amount||0)<=0&&Number(tip||0)>0?"Save tip":"Save payment"}</Button>
  </div></DialogContent></Dialog>;
}



function RefundPayment({payment,onRefunded}:{payment:PaymentRow;onRefunded?:()=>void}){
  const refundable=Math.max(0,Number(payment.refundableCents??0));
  const stripe=Boolean(Number(payment.stripePayment));
  const [open,setOpen]=useState(false);
  const [amount,setAmount]=useState("");
  const [note,setNote]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [requestId,setRequestId]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const openChange=(value:boolean)=>{
    setOpen(value);
    if(value){
      setAmount((refundable/100).toFixed(2));
      setNote("");
      setConfirmed(false);
      setRequestId(crypto.randomUUID());
      setError("");
      setMessage("");
    }
  };
  const submit=async()=>{
    const amountCents=Math.round(Number(amount)*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>refundable){setError(`Enter a refund up to ${money(refundable)}.`);return;}
    if(!stripe&&!confirmed){setError("Send the refund through the original/manual payment method first, then confirm it here.");return;}
    setSaving(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/payments/refund",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({paymentId:payment.id,requestId,amountCents,externalRefundConfirmed:!stripe&&confirmed,note})});
      const result=await response.json() as {ok?:boolean;pending?:boolean;mode?:string;paidCents?:number;error?:string};
      if(!response.ok&&!result.pending)throw new Error(result.error||"The refund could not be completed.");
      if(result.pending){setMessage("Stripe accepted the refund and it is still processing. FIRE will reconcile it when Stripe confirms completion.");return;}
      setMessage(stripe?"Stripe refund completed and FIRE billing was updated.":"Manual refund recorded and FIRE billing was updated.");
      onRefunded?.();
      window.setTimeout(()=>setOpen(false),450);
    }catch(refundError){setError(refundError instanceof Error?refundError.message:"The refund could not be completed.");}
    finally{setSaving(false);}
  };
  if(refundable<=0||payment.amountCents<=0)return null;
  return <Dialog open={open} onOpenChange={openChange}>
    <DialogTrigger asChild><Button variant="outline">Refund</Button></DialogTrigger>
    <DialogContent className="sm:max-w-[520px]"><DialogHeader><DialogTitle>Refund payment</DialogTitle></DialogHeader>
      <div className="payment-form">
        <p className="payment-estimate-summary"><strong>{payment.customer||"Customer"}</strong><br/><span>{money(refundable)} still refundable from this {paymentTypeLabel(payment.type)} payment.</span></p>
        <div><Label>Refund amount</Label><Input value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="0.00"/></div>
        <div><Label>Refund note</Label><Input value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Reason or internal note"/></div>
        {stripe?<p className="pay-note"><strong>Stripe payment:</strong> FIRE will submit this refund to Stripe and automatically record the refund when Stripe confirms it.</p>:<label className="payment-refund-confirm"><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)}/><span>I already returned this money to the customer outside FIRE (Cash App, Venmo, cash, check, bank, Wave, or other method).</span></label>}
        {error&&<p className="save-error">{error}</p>}
        {message&&<p className="save-success">{message}</p>}
        <Button className="brand-button" onClick={()=>void submit()} disabled={saving}>{saving?"Processing…":stripe?`Refund ${money(Math.round(Number(amount||0)*100))} through Stripe`:"Record completed refund"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function EditEstimateDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(estimate:EstimateRow)=>void}){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<EditableEstimateItem[]>([]);
  const [appreciationDiscount,setAppreciationDiscount]=useState(false);
  const [discountMode,setDiscountMode]=useState<DiscountMode>("percent");
  const [discountValue,setDiscountValue]=useState("");
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const hydrate=()=>{
    const source=estimate.items?.length?estimate.items:[{id:"",name:estimate.service,description:estimate.serviceDescription||serviceDescriptionFor(estimate.service),quantity:1,unit:"job",totalCents:estimate.totalCents}];
    setItems(source.map((item)=>{const svc=services.find((entry)=>entry.name===item.name);const qty=Math.max(1,Number(item.quantity)||1);return {id:item.id||undefined,serviceId:svc?.id||"custom",name:item.name,description:item.description||serviceDescriptionFor(item.name),quantity:qty,unit:item.unit||svc?.unit||"job",unitRateCents:qty?Math.round(Number(item.totalCents)/qty):Number(svc?.rate||0)};}));
    const appreciation=Boolean(Number(estimate.appreciationDiscount||0));setAppreciationDiscount(appreciation);
    const mode:DiscountMode=estimate.additionalDiscountType==="dollar"?"dollar":"percent";setDiscountMode(mode);
    const stored=Number(estimate.additionalDiscountValue||0);setDiscountValue(stored?mode==="percent"?(stored/100).toString():(stored/100).toFixed(2):"");setError("");
  };
  const setOpenSafe=(value:boolean)=>{setOpen(value);if(value)hydrate();};
  const updateItem=(index:number,patch:Partial<EditableEstimateItem>)=>setItems((current)=>current.map((item,i)=>i===index?{...item,...patch}:item));
  const subtotal=items.reduce((sum,item)=>sum+Math.round((Number(item.quantity)||0)*(Number(item.unitRateCents)||0)),0);
  const discount=discountMath(subtotal,appreciationDiscount,discountMode,Number(discountValue));
  const addService=()=>setItems((current)=>[...current,{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);
  const save=async()=>{
    if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitRateCents)||item.unitRateCents<0)){setError("Every service needs a service, quantity, and valid price.");return;}
    const maxPercent=appreciationDiscount?45:50;if(discountMode==="percent"&&(Number(discountValue)||0)>maxPercent){setError(`Additional percentage discount cannot exceed ${maxPercent}% with the current appreciation-discount setting.`);return;}
    if(discountMode==="dollar"&&Math.round((Number(discountValue)||0)*100)>subtotal){setError("Dollar discount cannot exceed the service subtotal.");return;}
    setSaving(true);setError("");try{
      const payloadItems=items.map((item)=>({id:item.id,name:item.name,description:item.description,quantity:item.quantity,unit:item.unit,totalCents:Math.round(item.quantity*item.unitRateCents)}));
      const response=await fetch(`/api/estimates/${estimate.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({items:payloadItems,appreciationDiscount,additionalDiscountType:discountMode,additionalDiscountValue:Math.round((Number(discountValue)||0)*100)})});
      const result=await response.json() as {estimate?:Partial<EstimateRow>;error?:string};if(!response.ok||!result.estimate)throw new Error(result.error||"Estimate changes could not be saved.");
      onSaved({...estimate,...result.estimate,items:payloadItems.map((item,index)=>({...item,id:item.id||`new-${index}`}))});setOpen(false);
    }catch(saveError){setError(saveError instanceof Error?saveError.message:"Estimate changes could not be saved.");}finally{setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}><DialogTrigger asChild><button type="button"><PenLine/> Edit estimate</button></DialogTrigger><DialogContent className="estimate-edit-dialog sm:max-w-[650px]"><DialogHeader><DialogTitle>Edit estimate</DialogTitle></DialogHeader>
    <div className="estimate-edit-items">{items.map((item,index)=><section className="estimate-edit-service" key={item.id||index}><header><strong>Service {index+1}</strong><button type="button" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove service ${index+1}`}><Trash2/></button></header><div><Label>Service</Label><Select value={item.serviceId} onValueChange={(value)=>{const svc=services.find((entry)=>entry.id===value);if(!svc)return;updateItem(index,{serviceId:value,name:svc.name,description:svc.description,unit:svc.unit,unitRateCents:svc.rate||0,quantity:svc.unit==="job"?1:0});}}><SelectTrigger><SelectValue placeholder="Choose a service"/></SelectTrigger><SelectContent>{services.map((svc)=><SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Service description and expectations</Label><Textarea rows={7} value={item.description} onChange={(event)=>updateItem(index,{description:event.target.value})}/></div><div className="edit-quantity-row"><div><Label>Quantity</Label><Input inputMode="decimal" value={item.quantity||""} onChange={(event)=>updateItem(index,{quantity:Number(event.target.value)})}/></div><span>{item.unit}</span></div><div><Label>Price per unit</Label><div className="discount-input"><span>$</span><Input inputMode="decimal" value={item.unitRateCents?String(item.unitRateCents/100):""} onChange={(event)=>updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})}/></div></div><strong className="edit-line-total">Line total {money(Math.round(item.quantity*item.unitRateCents))}</strong></section>)}</div>
    <Button variant="outline" className="w-full" onClick={addService}><Plus className="h-4 w-4"/> Add another service</Button>
    <button type="button" onClick={()=>setAppreciationDiscount((value)=>!value)} className={`discount-row ${appreciationDiscount?"selected":""}`}><span><strong>5% First Responder & Military</strong><small>Year-round appreciation discount</small></span><span className="check-box">{appreciationDiscount&&<Check className="h-4 w-4"/>}</span></button>
    <section className="edit-discount-card"><Label>Additional bundle, promotion, or family discount</Label><div className="discount-mode-row"><Button type="button" variant={discountMode==="percent"?"default":"outline"} onClick={()=>{setDiscountMode("percent");setDiscountValue("");}}>% Percentage</Button><Button type="button" variant={discountMode==="dollar"?"default":"outline"} onClick={()=>{setDiscountMode("dollar");setDiscountValue("");}}>$ Dollar amount</Button></div><div className="discount-input"><span>{discountMode==="percent"?"%":"$"}</span><Input inputMode="decimal" value={discountValue} onChange={(event)=>setDiscountValue(event.target.value)} placeholder="0"/></div><p className="service-description-help">Choose percentage or dollar amount. Percentage discounts stack with the 5% appreciation discount, up to 50% total.</p></section>
    <div className="edit-totals"><span>Service subtotal<strong>{money(subtotal)}</strong></span><span>Discount<strong>−{money(discount.appliedDiscount)}</strong></span><span>Estimate total<strong>{money(discount.total)}</strong></span><span>50% deposit<strong>{money(discount.deposit)}</strong></span></div>
    {subtotal>0&&subtotal-discount.requestedDiscount<15000&&<p className="service-description-help">The $150 minimum job charge is applied automatically.</p>}{error&&<p className="save-error" role="alert">{error}</p>}<Button className="brand-button w-full" onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Save estimate changes"}</Button>
  </DialogContent></Dialog>;
}


function EditInvoiceDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(totalCents:number,paidCents:number,billingExceptionOpen:boolean)=>void}){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState<EditableEstimateItem[]>([]);
  const [discountMode,setDiscountMode]=useState<DiscountMode>("dollar");
  const [discountValue,setDiscountValue]=useState("");
  const [dueMode,setDueMode]=useState<"receipt"|"date">("receipt");
  const [dueDate,setDueDate]=useState("");
  type InvoiceRevisionRow={id:string;subtotalCents:number;discountCents:number;discountType:DiscountMode;discountValue:number;totalCents:number;status:string;dueAt?:string|null;createdAt:string;items:EstimateItemRow[]};
  const [revisions,setRevisions]=useState<InvoiceRevisionRow[]>([]);
  const [expandedRevisionId,setExpandedRevisionId]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const subtotal=items.reduce((sum,item)=>sum+Math.round((Number(item.quantity)||0)*(Number(item.unitRateCents)||0)),0);
  const invoiceDiscount=(()=>{if(discountMode==="percent"){const percent=Math.min(50,Math.max(0,Number(discountValue)||0));return Math.round(subtotal*(percent/100));}return Math.min(subtotal,Math.max(0,Math.round((Number(discountValue)||0)*100)));})();
  const total=subtotal>0?Math.max(15000,subtotal-invoiceDiscount):0;
  const updateItem=(index:number,patch:Partial<EditableEstimateItem>)=>setItems((current)=>current.map((item,i)=>i===index?{...item,...patch}:item));
  const addService=()=>setItems((current)=>[...current,{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);
  const hydrate=async()=>{
    if(!estimate.invoiceId)return;
    setLoading(true);setError("");
    try{
      const response=await fetch(`/api/invoices/${estimate.invoiceId}`);const result=await response.json() as {invoice?:{discountType?:DiscountMode;discountValue?:number;dueAt?:string|null;createdAt?:string;items?:EstimateItemRow[];revisions?:InvoiceRevisionRow[]};error?:string};
      if(!response.ok||!result.invoice)throw new Error(result.error||"Invoice could not be loaded.");
      const source=result.invoice.items??[];
      setItems(source.map((item)=>{const svc=services.find((entry)=>entry.name===item.name);const qty=Math.max(1,Number(item.quantity)||1);return {id:item.id,serviceId:svc?.id||"custom",name:item.name,description:item.description||serviceDescriptionFor(item.name),quantity:qty,unit:item.unit||svc?.unit||"job",unitRateCents:qty?Math.round(Number(item.totalCents)/qty):Number(svc?.rate||0)};}));
      const mode=result.invoice.discountType==="percent"?"percent":"dollar";setDiscountMode(mode);const stored=Number(result.invoice.discountValue||0);setDiscountValue(stored?mode==="percent"?(stored/100).toString():(stored/100).toFixed(2):"");
      const rawDue=String(result.invoice.dueAt||"");const dueDay=rawDue?rawDue.slice(0,10):"";const createdDay=String(result.invoice.createdAt||"").slice(0,10);if(!rawDue||(createdDay&&dueDay===createdDay)){setDueMode("receipt");setDueDate("");}else{setDueMode("date");setDueDate(dueDay);}
      setRevisions((result.invoice.revisions??[]).map((revision)=>({...revision,subtotalCents:Number(revision.subtotalCents||0),totalCents:Number(revision.totalCents||0),discountCents:Number(revision.discountCents||0),discountValue:Number(revision.discountValue||0),discountType:revision.discountType==="percent"?"percent":"dollar",items:Array.isArray(revision.items)?revision.items:[]})));
      setExpandedRevisionId(null);
    }catch(loadError){setError(loadError instanceof Error?loadError.message:"Invoice could not be loaded.");}finally{setLoading(false);}
  };
  const setOpenSafe=(value:boolean)=>{setOpen(value);if(value)void hydrate();};
  const save=async()=>{
    if(!estimate.invoiceId)return;
    if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitRateCents)||item.unitRateCents<0)){setError("Every invoice service needs a service, quantity, and valid price.");return;}
    if(discountMode==="percent"&&(Number(discountValue)||0)>50){setError("Percentage discount cannot exceed 50%.");return;}
    if(discountMode==="dollar"&&Math.round((Number(discountValue)||0)*100)>subtotal){setError("Dollar discount cannot exceed the invoice subtotal.");return;}
    setSaving(true);setError("");
    try{
      const payloadItems=items.map((item)=>({id:item.id,name:item.name,description:item.description,quantity:item.quantity,unit:item.unit,totalCents:Math.round(item.quantity*item.unitRateCents)}));
      if(dueMode==="date"&&!dueDate){setError("Choose an invoice due date or select Due on receipt.");setSaving(false);return;}
      const response=await fetch(`/api/invoices/${estimate.invoiceId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({items:payloadItems,discountType:discountMode,discountValue:Math.round((Number(discountValue)||0)*100),dueAt:dueMode==="receipt"?"receipt":dueDate})});
      const result=await response.json() as {invoice?:{totalCents?:number};paidCents?:number;billingExceptionOpen?:boolean;error?:string};if(!response.ok||!result.invoice)throw new Error(result.error||"Invoice changes could not be saved.");
      onSaved(Number(result.invoice.totalCents??total),Number(result.paidCents??estimate.paidCents),Boolean(result.billingExceptionOpen));setOpen(false);
    }catch(saveError){setError(saveError instanceof Error?saveError.message:"Invoice changes could not be saved.");}finally{setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}><DialogTrigger asChild><button type="button"><PenLine/> Edit invoice</button></DialogTrigger><DialogContent className="estimate-edit-dialog sm:max-w-[650px]"><DialogHeader><DialogTitle>Edit final invoice</DialogTitle></DialogHeader>
    {loading?<div className="customers-state">Loading invoice…</div>:<>
    <p className="service-description-help">Add last-minute services or adjust the final discount without changing the original accepted estimate. Recorded payments are preserved.</p>
    <div className="estimate-edit-items">{items.map((item,index)=><section className="estimate-edit-service" key={item.id||index}><header><strong>Service {index+1}</strong>{items.length>1&&<button type="button" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove invoice service ${index+1}`}><Trash2/></button>}</header><div><Label>Service</Label><Select value={item.serviceId} onValueChange={(value)=>{const svc=services.find((entry)=>entry.id===value);if(!svc)return;updateItem(index,{serviceId:value,name:svc.name,description:svc.description,unit:svc.unit,unitRateCents:svc.rate||0,quantity:svc.unit==="job"?1:0});}}><SelectTrigger><SelectValue placeholder="Choose a service"/></SelectTrigger><SelectContent>{services.map((svc)=><SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Service description and expectations</Label><Textarea rows={6} value={item.description} onChange={(event)=>updateItem(index,{description:event.target.value})}/></div><div className="edit-quantity-row"><div><Label>Quantity</Label><Input inputMode="decimal" value={item.quantity||""} onChange={(event)=>updateItem(index,{quantity:Number(event.target.value)})}/></div><span>{item.unit}</span></div><div><Label>Price per unit</Label><div className="discount-input"><span>$</span><Input inputMode="decimal" value={item.unitRateCents?String(item.unitRateCents/100):""} onChange={(event)=>updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})}/></div></div><strong className="edit-line-total">Line total {money(Math.round(item.quantity*item.unitRateCents))}</strong></section>)}</div>
    <Button variant="outline" className="w-full" onClick={addService}><Plus className="h-4 w-4"/> Add another service</Button>
    <section className="edit-discount-card"><Label>Payment due</Label><div className="discount-mode-row"><Button type="button" variant={dueMode==="receipt"?"default":"outline"} onClick={()=>{setDueMode("receipt");setDueDate("");}}>Due on receipt</Button><Button type="button" variant={dueMode==="date"?"default":"outline"} onClick={()=>setDueMode("date")}>Specific date</Button></div>{dueMode==="date"&&<Input type="date" value={dueDate} onChange={(event)=>setDueDate(event.target.value)}/>}</section>
    <section className="edit-discount-card"><Label>Final invoice discount</Label><div className="discount-mode-row"><Button type="button" variant={discountMode==="percent"?"default":"outline"} onClick={()=>{setDiscountMode("percent");setDiscountValue("");}}>% Percentage</Button><Button type="button" variant={discountMode==="dollar"?"default":"outline"} onClick={()=>{setDiscountMode("dollar");setDiscountValue("");}}>$ Dollar amount</Button></div><div className="discount-input"><span>{discountMode==="percent"?"%":"$"}</span><Input inputMode="decimal" value={discountValue} onChange={(event)=>setDiscountValue(event.target.value)} placeholder="0"/></div></section>
    <div className="edit-totals"><span>Invoice subtotal<strong>{money(subtotal)}</strong></span><span>Discount<strong>−{money(Math.max(0,subtotal-total))}</strong></span><span>Invoice total<strong>{money(total)}</strong></span><span>Paid already<strong>{money(estimate.paidCents)}</strong></span></div>
    {subtotal>0&&subtotal-invoiceDiscount<15000&&<p className="service-description-help">The $150 minimum job charge is applied automatically.</p>}
    {revisions.length>0&&<section className="edit-discount-card"><Label>Invoice revision history</Label><p className="service-description-help">Previous invoice versions are retained automatically before each edit. Open a revision to review its prior services and discount.</p><div className="invoice-revision-list">{revisions.slice(0,5).map((revision)=>{const expanded=expandedRevisionId===revision.id;return <div className={expanded?"invoice-revision-row expanded":"invoice-revision-row"} key={revision.id}><button type="button" className="invoice-revision-summary" onClick={()=>setExpandedRevisionId(expanded?null:revision.id)} aria-expanded={expanded}><span><strong>{money(revision.totalCents)}</strong><small>{revision.status} · {dateTime(revision.createdAt)}</small></span><span className="invoice-revision-due"><small>{revision.dueAt?`Due ${new Date(revision.dueAt).toLocaleDateString()}`:"Due on receipt"}</small><ChevronRight className={expanded?"revision-chevron open":"revision-chevron"}/></span></button>{expanded&&<div className="invoice-revision-details"><div className="revision-item-list">{revision.items.map((item,index)=><div key={`${revision.id}-${item.id||index}`}><span><strong>{item.name}</strong><small>{item.description||"No description"}</small></span><small>{Number(item.quantity)||0} {item.unit} · {money(Number(item.totalCents)||0)}</small></div>)}</div><div className="revision-totals"><span>Subtotal<strong>{money(revision.subtotalCents)}</strong></span><span>Discount<strong>−{money(revision.discountCents)}</strong></span><span>Discount mode<strong>{revision.discountType==="percent"?`${(revision.discountValue/100).toFixed(2).replace(/\.00$/,'')}%`:`${money(revision.discountValue)}`}</strong></span><span>Total<strong>{money(revision.totalCents)}</strong></span></div></div>}</div>;})}</div></section>}
    {error&&<p className="save-error" role="alert">{error}</p>}<Button className="brand-button w-full" onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Save invoice changes"}</Button></>}
  </DialogContent></Dialog>;
}

function EstimateDetail({ estimate, onClose, onChanged }: { estimate: EstimateRow | null; onClose: () => void; onChanged: (estimate: EstimateRow) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState("");
  const [reportComplete,setReportComplete]=useState(false);
  const [checkingCloseout,setCheckingCloseout]=useState(false);

  useEffect(() => {
    if (!estimate?.scheduledAt) setSchedule("");
    else { const date = new Date(estimate.scheduledAt); setSchedule(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16)); }
    if(!estimate?.id){setReportComplete(false);return;}
    void (async()=>{try{const response=await fetch(`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`);const result=await response.json() as {reports?:JobReportRow[]};setReportComplete(result.reports?.[0]?.status==="completed");}catch{setReportComplete(false);}})();
  }, [estimate]);
  if (!estimate) return null;
  const update = async (body: Record<string, unknown>) => {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/estimates/${estimate.id}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
      const result = await response.json() as { estimate?: {status:string;scheduledAt?:string|null}; error?:string };
      if (!response.ok || !result.estimate) throw new Error(result.error || "The estimate could not be updated.");
      onChanged({ ...estimate, ...result.estimate, ...(body.resolveChangeRequests===true?{pendingChangeCount:0,latestChangeRequest:null}:{}) });
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "The estimate could not be updated."); }
    finally { setSaving(false); }
  };
  const completeJob=async()=>{
    setCheckingCloseout(true);setError("");
    try{
      const response=await fetch(`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`);
      const result=await response.json() as {reports?:JobReportRow[];error?:string};
      const complete=result.reports?.[0]?.status==="completed";
      setReportComplete(complete);
      if(!response.ok||!complete){setError("Complete and save the service completion report before marking this job complete.");return;}
      await update({status:"completed"});
    }finally{setCheckingCloseout(false);}
  };
  const createInvoice = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/invoices", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ estimateId:estimate.id }) });
      const result = await response.json() as { id?:string; shareToken?:string; error?:string };
      if (!response.ok || !result.id) throw new Error(result.error || "The invoice could not be created.");
      onChanged({ ...estimate, invoiceId:result.id, invoiceShareToken:result.shareToken, status:estimate.status === "draft" ? "approved" : estimate.status });
    } catch (invoiceError) { setError(invoiceError instanceof Error ? invoiceError.message : "The invoice could not be created."); }
    finally { setSaving(false); }
  };
  const encodedAddress = encodeURIComponent(estimate.address || "");
  const zillowAddress = encodeURIComponent((estimate.address || "").trim().replace(/\s+/g,"-"));
  const messageCustomer:CustomerRow={id:estimate.customerId||"",name:estimate.customer,email:estimate.email||"",phone:estimate.phone||"",address:estimate.address||"",createdAt:estimate.createdAt,estimateCount:1,estimateTotal:resolvedBillingTotalCents(estimate),paidTotal:estimate.paidCents};
  const shownDescription=estimate.serviceDescription||serviceDescriptionFor(estimate.service);
  const nextAction=!safeBillingState(estimate)?"Billing review required: this job has accounting values outside FIRE's exact safe range.":Number(estimate.pendingRefundCount)>0?"Refund processing: wait for the refund to finish before collecting more money or requesting a review.":Number(estimate.paymentOverageOpen)>0?"Billing exception: review the overpayment and record the refund or retained overpayment before closing out the customer record.":resolvedBillingTotalCents(estimate)<=estimate.paidCents?"Paid in full — the customer record is complete.":estimate.status==="draft"?"Next: send the estimate and service agreement.":estimate.status==="sent"?"Next: follow up until the customer approves and signs.":estimate.status==="approved"?"Next: choose the job date and save it.":estimate.status==="scheduled"?"Next: capture before photos, complete the job report, then create the invoice.":estimate.status==="completed"&&!estimate.invoiceId?"Next: create and send the final invoice.":estimate.status==="completed"?"Next: send the invoice, record payment, and request a review.":"Review the customer record and choose the next status.";
  const billingTotalCents=estimate.invoiceTotalCents??estimate.totalCents;
  const balanceCents=safeBillingState(estimate)?Math.max(0,billingTotalCents-estimate.paidCents):0;
  const resolveOverpayment=async()=>{setSaving(true);setError("");try{const updateResponse=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,resolveOverpayment:true,reconciliationHandled:true,resolutionMode:"keep"})});const result=await updateResponse.json() as {remainingOverpaymentCount?:number;paidCents?:number;error?:string};if(!updateResponse.ok)throw new Error(result.error||"The billing exception could not be resolved.");onChanged({...estimate,paidCents:result.paidCents??estimate.paidCents,paymentOverageOpen:Number(result.remainingOverpaymentCount??Math.max(0,Number(estimate.paymentOverageOpen)-1))});}catch(resolveError){setError(resolveError instanceof Error?resolveError.message:"The billing exception could not be resolved.");}finally{setSaving(false);}};
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="estimate-detail sm:max-w-[650px]">
    <DialogHeader><DialogTitle>{estimate.service}</DialogTitle></DialogHeader>
    <div className="detail-customer"><span className="customer-avatar">{estimate.customer.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()}</span><div><strong>{estimate.customer}</strong><small>{estimate.address || "No service address saved"}</small></div><strong>{money(resolvedBillingTotalCents(estimate))}</strong></div>
    <div className="detail-scope"><strong>Service scope & expectations</strong><p>{shownDescription}</p></div>
    <div className="next-action"><Sparkles/><div><strong>Recommended next step</strong><p>{nextAction}</p></div></div>

    <div className="detail-actions">
      <EditEstimateDialog estimate={estimate} onSaved={onChanged}/>{estimate.invoiceId&&<EditInvoiceDialog estimate={estimate} onSaved={(invoiceTotalCents,paidCents,billingExceptionOpen)=>onChanged({...estimate,invoiceTotalCents,paidCents,paymentOverageOpen:billingExceptionOpen?1:0})}/>}
      {estimate.customerId&&<MessageComposer
        customer={messageCustomer}
        estimate={estimate}
        initialTemplate={estimate.invoiceId?"invoice":"estimate"}
        triggerLabel={estimate.invoiceId?"Send invoice":"Send estimate"}
        onSent={!estimate.invoiceId&&estimate.status==="draft"?()=>update({status:"sent"}):undefined}
      />}
      {estimate.customerId&&estimate.status==="scheduled"&&estimate.scheduledAt&&<MessageComposer customer={messageCustomer} estimate={estimate} initialTemplate="onMyWay" triggerLabel="On my way"/>}
      {estimate.customerId&&safeBillingState(estimate)&&estimate.status==="completed"&&Number(estimate.paymentOverageOpen)===0&&Number(estimate.pendingRefundCount)===0&&estimate.paidCents>=resolvedBillingTotalCents(estimate)&&<MessageComposer customer={messageCustomer} estimate={estimate} initialTemplate="review" triggerLabel={estimate.lastReviewRequestAt?"Review requested":"Request review"} onSent={()=>onChanged({...estimate,lastReviewRequestAt:new Date().toISOString()})}/>}
      {estimate.shareToken&&<a href={`/estimate/${estimate.shareToken}`} target="_blank" rel="noreferrer"><ExternalLink/> Customer view</a>}
      {estimate.invoiceId&&estimate.invoiceShareToken&&<a href={`/invoice/${estimate.invoiceShareToken}`} target="_blank" rel="noreferrer"><Receipt/> View invoice</a>}
      {estimate.phone && <a href={`tel:${estimate.phone}`}><Phone /> Call</a>}
      {estimate.phone && <a href={`sms:${estimate.phone}`}><Send /> Text</a>}
      {estimate.address && <a className="primary-tool" href={`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`} target="_blank" rel="noreferrer"><Navigation /> Google Maps</a>}
      <StrideButton />
      {estimate.address && <a href={`https://earth.google.com/web/search/${encodedAddress}`} target="_blank" rel="noreferrer"><Globe2 /> Google Earth</a>}
      {estimate.address && <a href={`https://www.zillow.com/homes/${zillowAddress}_rb/`} target="_blank" rel="noreferrer"><House /> Zillow</a>}
      <JobReport estimate={estimate} onSaved={setReportComplete}/><JobCost estimate={estimate}/>{Number(estimate.pendingRefundCount)===0&&<RecordPayment estimate={estimate} onRecorded={(paidCents)=>onChanged({...estimate,paidCents})}/>}
    </div>
    {Number(estimate.pendingChangeCount)>0&&<div className="change-alert"><MessageSquareText/><div><strong>Customer requested a change</strong><p>{estimate.latestChangeRequest}</p><Button variant="outline" onClick={()=>void update({resolveChangeRequests:true})} disabled={saving}>Mark resolved</Button></div></div>}
    {Number(estimate.pendingRefundCount)>0&&<div className="change-alert"><CircleDollarSign/><div><strong>Refund processing</strong><p>A refund is still processing for this job. FIRE is temporarily blocking new payments and review requests until the refund finishes and the balance is reconciled.</p></div></div>}
    {Number(estimate.paymentOverageOpen)>0&&<div className="change-alert"><CircleDollarSign/><div><strong>Overpayment needs review</strong><p>To return money, open <strong>Payments</strong> and use <strong>Refund</strong> on the original payment. Stripe refunds are sent through Stripe; manual-method refunds are recorded only after you confirm the money was returned outside FIRE. This alert clears automatically when the refund removes the excess. If you and the customer intentionally agree to leave the extra money on this job, use Keep as overpayment.</p><div className="billing-resolution-actions"><Button variant="outline" onClick={()=>void resolveOverpayment()} disabled={saving}>Keep as overpayment</Button></div></div></div>}
    {(estimate.firstViewedAt||estimate.acceptedAt||estimate.signedAt)&&<div className="customer-activity">{estimate.firstViewedAt&&<span><Eye/><small>Viewed</small><strong>{dateTime(estimate.firstViewedAt)}</strong></span>}{estimate.signedAt?<span><PenLine/><small>Agreement signed</small><strong>{estimate.signedName} · Photos: {estimate.photoRelease==="yes"?"allowed":estimate.photoRelease==="no"?"not allowed":"not recorded"} · {dateTime(estimate.signedAt)}</strong></span>:estimate.acceptedAt&&<span><CheckCircle2/><small>Approved</small><strong>{dateTime(estimate.acceptedAt)}</strong></span>}</div>}
    <div className="detail-grid">
      <div><Label>Status</Label><div className="status-readonly" aria-label={`Job status: ${statusLabel(estimate.status)}`}><strong>{statusLabel(estimate.status)}</strong><small>Status advances through sending, customer approval, scheduling, and job completion actions.</small></div></div>
      <div><Label htmlFor="scheduleDate">Job date and time</Label><Input id="scheduleDate" type="datetime-local" value={schedule} onChange={(event)=>setSchedule(event.target.value)} onInput={(event)=>setSchedule((event.target as HTMLInputElement).value)} /></div>
    </div>
    <div className="detail-summary"><span><small>Deposit</small><strong>{money(estimate.depositCents)}</strong></span><span><small>Paid</small><strong>{money(estimate.paidCents)}</strong></span><span><small>Balance</small><strong>{money(balanceCents)}</strong></span></div>
        {error && <p className="save-error" role="alert">{error}</p>}
    <div className="detail-footer">
      <Button variant="outline" onClick={() => void update({ scheduledAt:schedule ? new Date(schedule).toISOString() : "" })} disabled={saving || !schedule}><CalendarDays className="h-4 w-4" /> Save job date</Button>
      {estimate.status === "scheduled" && <Button variant="outline" onClick={() => void completeJob()} disabled={saving||checkingCloseout||!reportComplete}><CheckCircle2 className="h-4 w-4" /> {checkingCloseout?"Checking…":reportComplete?"Mark job complete":"Complete report first"}</Button>}
      <Button className="brand-button" onClick={createInvoice} disabled={saving || Boolean(estimate.invoiceId) || estimate.status !== "completed"}><Receipt className="h-4 w-4" /> {estimate.invoiceId ? "Invoice created" : estimate.status === "completed" ? "Create invoice" : "Complete job first"}</Button>
    </div>
  </DialogContent></Dialog>;
}

function CustomersView({ onEstimateSaved, searchQuery }: { onEstimateSaved: (estimate: EstimateRow) => void; searchQuery: string }) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [estimates, setEstimates] = useState<CustomerEstimate[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [photos,setPhotos]=useState<CustomerPhoto[]>([]);
  const [messages,setMessages]=useState<CustomerMessage[]>([]);
  const [payments,setPayments]=useState<PaymentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeEstimate, setActiveEstimate] = useState<EstimateRow | null>(null);
  const [section, setSection] = useState("estimates");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/customers");
      const result = await response.json() as { customers?: CustomerRow[]; estimates?: CustomerEstimate[]; notes?:CustomerNote[]; invoices?:InvoiceRow[]; photos?:CustomerPhoto[]; messages?:CustomerMessage[]; payments?:PaymentRow[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Customer records could not be loaded.");
      setCustomers((result.customers ?? []).map((item) => ({ ...item, estimateCount: Number(item.estimateCount), estimateTotal: Number(item.estimateTotal), paidTotal: Number(item.paidTotal) })));
      setEstimates((result.estimates ?? []).map((item) => ({ ...item, totalCents: Number(item.totalCents), depositCents: Number(item.depositCents), paidCents: Number(item.paidCents) })));
      setNotes(result.notes ?? []);
      setInvoices((result.invoices ?? []).map((item)=>({...item,totalCents:Number(item.totalCents)})));
      setPhotos((result.photos??[]).map((item)=>({...item,sizeBytes:Number(item.sizeBytes)})));
      setMessages(result.messages??[]);
      setPayments((result.payments??[]).map((item)=>({...item,amountCents:Number(item.amountCents),refundedCents:Number(item.refundedCents??0),refundableCents:Number(item.refundableCents??0),stripePayment:Number(item.stripePayment??0)})));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Customer records could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const customerEstimates = estimates.filter((estimate) => estimate.customerId === selectedId);
  const customerNotes = notes.filter((note)=>note.customerId === selectedId);
  const customerInvoices = invoices.filter((invoice)=>invoice.customerId === selectedId);
  const customerPhotos=photos.filter((photo)=>photo.customerId===selectedId);
  const customerMessages=messages.filter((message)=>message.customerId===selectedId);
  const customerPayments=payments.filter((payment)=>payment.customerId===selectedId);
  const filteredCustomers = customers.filter((customer)=>[customer.name,customer.email,customer.phone,customer.address].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  const activeCustomerEstimate=customerEstimates.find((estimate)=>estimate.status==="scheduled")??customerEstimates.find((estimate)=>["approved","sent","draft"].includes(estimate.status))??customerEstimates.find((estimate)=>estimate.status==="completed"&&estimate.paidCents<resolvedBillingTotalCents(estimate))??customerEstimates[0];
  const customerOpenBalance=safeSumCents(customerEstimates.map((estimate)=>billingBalanceCents(estimate)));
  const customerPaidTotal=Math.max(0,safeSignedSumCents(customerPayments.map((payment)=>payment.amountCents)));
  const handleEstimateSaved = (estimate: EstimateRow) => { onEstimateSaved(estimate); void load(); };
  const saveNote = async () => {
    if (!selected || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const response = await fetch("/api/customer-notes", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({customerId:selected.id,body:noteText}) });
      const result = await response.json() as {note?:CustomerNote};
      if (response.ok && result.note) { setNotes((current)=>[result.note!,...current]); setNoteText(""); }
    } finally { setSavingNote(false); }
  };
  if (selected) return <div className="customers-view">
    <EstimateDetail estimate={activeEstimate} onClose={()=>setActiveEstimate(null)} onChanged={()=>{ setActiveEstimate(null); void load(); }} />
    <button className="back-link" onClick={() => { setSelectedId(null); setSection("estimates"); }}>← All customers</button>
    <section className="customer-profile">
      <div className="customer-profile-head"><span className="customer-avatar">{selected.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><div><p className="eyebrow">Customer profile</p><h1>{selected.name}</h1></div><div className="profile-head-actions"><MessageComposer customer={selected} estimate={customerEstimates[0]} initialTemplate="estimate" onLogged={(message)=>setMessages((current)=>[message,...current])}/><NewEstimate customer={selected} onSaved={handleEstimateSaved} /></div></div>
      <div className="customer-snapshot">
        <span><small>Jobs / estimates</small><strong>{customerEstimates.length}</strong></span>
        <span><small>Paid</small><strong>{money(customerPaidTotal)}</strong></span>
        <span><small>Open balance</small><strong>{money(customerOpenBalance)}</strong></span>
        <span><small>Current stage</small><strong>{activeCustomerEstimate?statusLabel(activeCustomerEstimate.status):"No active job"}</strong></span>
      </div>
      {activeCustomerEstimate&&<button className="customer-next-job" onClick={()=>setActiveEstimate({...activeCustomerEstimate,customer:selected.name,email:selected.email,phone:selected.phone,address:selected.address})}><span><Sparkles/><span><small>Continue current job</small><strong>{activeCustomerEstimate.service}</strong></span></span><span>{activeCustomerEstimate.scheduledAt?dateTime(activeCustomerEstimate.scheduledAt):statusLabel(activeCustomerEstimate.status)} <ChevronRight/></span></button>}
      <div className="customer-contact">
        {selected.phone ? <a href={`tel:${selected.phone}`}><Phone />Call</a> : <span><Phone />No phone</span>}
        {selected.phone && <a href={`sms:${selected.phone}`}><Send />Text</a>}
        {selected.email ? <a href={`mailto:${selected.email}`}><Mail />Email</a> : <span><Mail />No email</span>}
        {selected.address ? <a className="primary-tool" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.address)}&travelmode=driving`} target="_blank" rel="noreferrer"><Navigation />Google Maps</a> : <span><MapPin />No address</span>}
        <StrideButton />
        {selected.address && <a href={`https://earth.google.com/web/search/${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer"><Globe2 />Google Earth</a>}
        {selected.address && <a href={`https://www.zillow.com/homes/${encodeURIComponent(selected.address.trim().replace(/\s+/g,"-"))}_rb/`} target="_blank" rel="noreferrer"><House />Zillow</a>}
      </div>
      {selected.address && <PropertyPreview address={selected.address} />}
    </section>
    <nav className="record-tabs">
      <button className={section === "estimates" ? "active" : ""} onClick={() => setSection("estimates")}>Estimates <b>{customerEstimates.length}</b></button>
      <button className={section === "payments" ? "active" : ""} onClick={() => setSection("payments")}>Payments</button>
      <button className={section === "invoices" ? "active" : ""} onClick={() => setSection("invoices")}>Invoices</button>
      <button className={section === "photos" ? "active" : ""} onClick={() => setSection("photos")}>Photos <b>{customerPhotos.length}</b></button>
      <button className={section === "messages" ? "active" : ""} onClick={() => setSection("messages")}>Messages <b>{customerMessages.length}</b></button>
      <button className={section === "notes" ? "active" : ""} onClick={() => setSection("notes")}>Notes <b>{customerNotes.length}</b></button>
    </nav>
    <section className="customer-records">
      {section === "estimates" && (customerEstimates.length ? customerEstimates.map((estimate) => <button className="customer-record record-button" key={estimate.id} onClick={()=>setActiveEstimate({...estimate,customer:selected.name,email:selected.email,phone:selected.phone,address:selected.address})}><div><strong>{estimate.service}</strong><small>{new Date(estimate.createdAt).toLocaleDateString()} · {statusLabel(estimate.status)}{estimate.scheduledAt ? ` · ${dateTime(estimate.scheduledAt)}` : ""}</small></div><strong>{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight /></button>) : <div className="record-empty"><ClipboardList /><strong>No estimates yet</strong><p>Create the first estimate from this customer profile.</p></div>)}
      {section === "payments" && (customerPayments.length ? customerPayments.map((payment) => <article className="customer-record" key={payment.id}><div><strong>{payment.amountCents<0?"Refund":`${paymentTypeLabel(payment.type)} payment`}</strong><small>{dateTime(payment.createdAt)}{payment.refundedCents?` · ${money(payment.refundedCents)} refunded`:""}{payment.amountCents>0&&payment.reference?` · ${payment.reference}`:""}</small></div><strong>{money(payment.amountCents)}</strong>{payment.amountCents>0&&<RefundPayment payment={{...payment,customer:selected.name}} onRefunded={()=>void load()}/>}</article>) : <div className="record-empty"><CreditCard /><strong>No payments recorded</strong><p>Open an estimate and choose Record payment after receiving money through Wave, Cash App, Venmo, cash, check, card, or bank transfer.</p></div>)}
      {section === "invoices" && (customerInvoices.length ? customerInvoices.map((invoice)=><a className="customer-record record-button" key={invoice.id} href={invoice.shareToken?`/invoice/${invoice.shareToken}`:undefined} target="_blank" rel="noreferrer"><div><strong>Invoice #{invoice.id.slice(0,6).toUpperCase()}</strong><small>{Number(invoice.pendingRefundCount)>0?"Refund processing":Number(invoice.paymentOverageOpen)>0?"Payment review in progress":statusLabel(invoice.status)} · Due {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : "on receipt"}</small></div><strong>{money(invoice.totalCents)}</strong><ExternalLink/></a>) : <div className="record-empty"><Receipt /><strong>No invoices yet</strong><p>Open an estimate and tap Create invoice.</p></div>)}
      {section === "photos"&&<CustomerPhotos customer={selected} photos={photos} setPhotos={setPhotos}/>}
      {section === "messages"&&(customerMessages.length?customerMessages.map((message)=><article className="message-history" key={message.id}><span className={`message-channel ${message.channel}`}><MessageSquareText/></span><div><strong>{messageLabels[message.template]||"Customer message"}</strong><p>{message.body}</p><small>{statusLabel(message.channel)} · {dateTime(message.createdAt)}</small></div></article>):<div className="record-empty"><MessageSquareText/><strong>No messages prepared yet</strong><p>Use the Message button to create a personalized text or email.</p></div>)}
      {section === "notes" && <div className="notes-panel"><div className="note-compose"><Input value={noteText} onChange={(event)=>setNoteText(event.target.value)} placeholder="Gate code, pets, property details…" /><Button className="brand-button" onClick={()=>void saveNote()} disabled={savingNote || !noteText.trim()}><Plus className="h-4 w-4" /> Add note</Button></div>{customerNotes.length ? customerNotes.map((note)=><article className="note-row" key={note.id}><StickyNote /><div><p>{note.body}</p><small>{dateTime(note.createdAt)}</small></div></article>) : <div className="record-empty"><StickyNote /><strong>No notes yet</strong><p>Save access details and job-specific reminders here.</p></div>}</div>}
    </section>
  </div>;
  return <div className="customers-view">
    <section className="customers-head"><div><p className="eyebrow">Customer records</p><h1>Customers</h1><p>Contact details and job history in one place.</p></div><AddCustomer onAdded={(customer) => { setCustomers((current) => [customer, ...current]); setSelectedId(customer.id); }} /></section>
    {loading ? <div className="customers-state">Loading customers…</div> : error ? <div className="customers-state"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div> : filteredCustomers.length ? <section className="customer-list">{filteredCustomers.map((customer) => <button className="customer-card" key={customer.id} onClick={() => setSelectedId(customer.id)}><span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><span className="customer-main"><strong>{customer.name}</strong><small>{customer.phone || customer.email || "No contact details saved"}</small></span><span className="customer-totals"><strong>{customer.estimateCount} estimate{customer.estimateCount === 1 ? "" : "s"}</strong><small>{money(customer.estimateTotal)}</small></span><ChevronRight /></button>)}</section> : <div className="customers-state"><Users /><strong>{searchQuery ? "No matching customers" : "No customers yet"}</strong><p>{searchQuery ? "Try a name, phone number, email, or address." : "Add your first customer to start their permanent record."}</p></div>}
  </div>;
}

function EstimatesView({ onSaved, searchQuery }: { onSaved:(estimate:EstimateRow)=>void; searchQuery:string }) {
  const [rows,setRows]=useState<EstimateRow[]>([]);
  const [filter,setFilter]=useState("all");
  const [view,setView]=useState<"pipeline"|"list">("pipeline");
  const [selected,setSelected]=useState<EstimateRow|null>(null);
  const [loading,setLoading]=useState(true);
  const load=async()=>{ setLoading(true); try { const response=await fetch("/api/estimates"); const result=await response.json() as {estimates?:EstimateRow[]}; setRows((result.estimates??[]).map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents)}))); } finally { setLoading(false); } };
  useEffect(()=>{void load();},[]);
  const searched=rows.filter((row)=>[row.customer,row.service,row.address,row.phone].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  const visible=searched.filter((row)=>filter==="all"||row.status===filter);
  const pipeline=[
    {key:"draft",label:"New quotes",rows:searched.filter((row)=>row.status==="draft"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"sent",label:"Follow up",rows:searched.filter((row)=>row.status==="sent"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"approved",label:"Approved",rows:searched.filter((row)=>row.status==="approved"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"scheduled",label:"Scheduled",rows:searched.filter((row)=>row.status==="scheduled"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"completed",label:"Completed",rows:searched.filter((row)=>row.status==="completed"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"paid",label:"Paid",rows:searched.filter((row)=>safeBillingState(row)&&resolvedBillingTotalCents(row)>0&&row.paidCents>=resolvedBillingTotalCents(row))},
    {key:"declined",label:"Lost",rows:searched.filter((row)=>row.status==="declined"&&row.paidCents<resolvedBillingTotalCents(row))},
  ];
  const changed=(estimate:EstimateRow)=>{setRows((current)=>current.map((row)=>row.id===estimate.id?estimate:row));setSelected(estimate);};
  return <div className="workspace-view">
    <EstimateDetail estimate={selected} onClose={()=>setSelected(null)} onChanged={changed}/>
    <section className="workspace-head"><div><p className="eyebrow">Quote to job</p><h1>Estimates</h1><p>See every opportunity, move it forward, and know what needs attention.</p></div><div className="workspace-head-actions"><div className="view-switch" aria-label="Estimate view"><button className={view==="pipeline"?"active":""} onClick={()=>setView("pipeline")}><SquareKanban/> Pipeline</button><button className={view==="list"?"active":""} onClick={()=>setView("list")}><List/> List</button></div><NewEstimate onSaved={(estimate)=>{onSaved(estimate);setRows((current)=>[estimate,...current]);}}/></div></section>
    {view==="list"&&<div className="filter-row">{["all","draft","sent","approved","scheduled","completed","declined"].map((status)=><button key={status} className={filter===status?"active":""} onClick={()=>setFilter(status)}>{statusLabel(status)}</button>)}</div>}
    {loading?<div className="customers-state">Loading estimates…</div>:view==="pipeline"?<section className="pipeline-board">{pipeline.map((column)=><section className={`pipeline-column ${column.key}`} key={column.key}><header><div><strong>{column.label}</strong><small>{money(safeSumCents(column.rows.map((row)=>safeBillingState(row)?resolvedBillingTotalCents(row):0)))}</small></div><b>{column.rows.length}</b></header><div>{column.rows.map((estimate)=><button className="pipeline-card" key={estimate.id} onClick={()=>setSelected(estimate)}><span><strong>{estimate.customer}</strong>{resolvedBillingTotalCents(estimate)>=100000&&<em><Star/> High value</em>}</span><p>{estimate.service}</p>{estimate.scheduledAt&&<small><CalendarDays/> {dateTime(estimate.scheduledAt)}</small>}<footer><span>{safeBillingState(estimate)&&estimate.paidCents>0?`${money(estimate.paidCents)} paid`:new Date(estimate.createdAt).toLocaleDateString()}</span><strong>{money(resolvedBillingTotalCents(estimate))}</strong></footer></button>)}{!column.rows.length&&<div className="pipeline-empty">Nothing here</div>}</div></section>)}</section>:visible.length?<section className="estimate-list">{visible.map((estimate)=><button key={estimate.id} className="estimate-card" onClick={()=>setSelected(estimate)}><span className={`status-bar ${estimate.status}`}/><span className="estimate-person"><strong>{estimate.customer}</strong><small>{estimate.service} · {new Date(estimate.createdAt).toLocaleDateString()}</small></span><span className={`status-chip ${estimate.status}`}>{statusLabel(estimate.status)}</span>{estimate.scheduledAt&&<span className="scheduled-chip"><CalendarDays/> {dateTime(estimate.scheduledAt)}</span>}<strong className="estimate-amount">{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight/></button>)}</section>:<div className="customers-state"><ClipboardList/><strong>No matching estimates</strong><p>Create an estimate or choose another status.</p></div>}
  </div>;
}

function ScheduleView({ searchQuery }:{searchQuery:string}) {
  const [rows,setRows]=useState<EstimateRow[]>([]);
  const [selected,setSelected]=useState<EstimateRow|null>(null);
  const [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);try{const response=await fetch("/api/estimates");const result=await response.json() as {estimates?:EstimateRow[]};setRows((result.estimates??[]).map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents)})));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const matches=(row:EstimateRow)=>[row.customer,row.service,row.address].join(" ").toLowerCase().includes(searchQuery.toLowerCase());
  const now=useCurrentTime();
  const scheduled=rows.filter((row)=>row.scheduledAt&&matches(row)).sort((a,b)=>new Date(a.scheduledAt!).getTime()-new Date(b.scheduledAt!).getTime());
  const needsAttention=scheduled.filter((row)=>new Date(row.scheduledAt!).getTime()<now&&row.status!=="declined"&&(row.status!=="completed"||row.paidCents<resolvedBillingTotalCents(row)));
  const upcoming=scheduled.filter((row)=>new Date(row.scheduledAt!).getTime()>=now&&row.status==="scheduled");
  const upcomingWithAddress=upcoming.filter((row)=>row.address);
  const routeDate=upcomingWithAddress[0]?.scheduledAt?new Date(upcomingWithAddress[0].scheduledAt):null;
  const routeJobs=routeDate?upcomingWithAddress.filter((row)=>{const date=new Date(row.scheduledAt!);return date.getFullYear()===routeDate.getFullYear()&&date.getMonth()===routeDate.getMonth()&&date.getDate()===routeDate.getDate();}).slice(0,8):[];
  const routeUrl=routeJobs.length?`https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=${encodeURIComponent(routeJobs.at(-1)!.address||"")}${routeJobs.length>1?`&waypoints=${routeJobs.slice(0,-1).map((job)=>encodeURIComponent(job.address||"")).join("%7C")}`:""}`:"";
  const routeLabel=routeDate&&routeDate.toDateString()===new Date().toDateString()?"Route today":routeDate?`Route ${routeDate.toLocaleDateString("en-US",{weekday:"short"})}`:"Route next jobs";
  return <div className="workspace-view"><EstimateDetail estimate={selected} onClose={()=>setSelected(null)} onChanged={(estimate)=>{setRows((current)=>current.map((row)=>row.id===estimate.id?estimate:row));setSelected(estimate);}}/><section className="workspace-head"><div><p className="eyebrow">Jobs</p><h1>Schedule</h1><p>Upcoming work, customer details, and one-tap directions.</p></div>{routeUrl&&<a className="route-day-button" href={routeUrl} target="_blank" rel="noreferrer"><Navigation/> {routeLabel}<small>{routeJobs.length} stop{routeJobs.length===1?"":"s"}</small></a>}</section>
    {loading?<div className="customers-state">Loading schedule…</div>:<>
      {needsAttention.length>0&&<section className="needs-attention"><header><div><h2>Needs attention</h2><p>Past job dates that still need to be completed, rescheduled, or paid.</p></div><b>{needsAttention.length}</b></header>{needsAttention.map((job)=><button key={job.id} onClick={()=>setSelected(job)}><Clock3/><span><strong>{job.customer}</strong><small>{job.service} · was scheduled {dateTime(job.scheduledAt!)}</small><b>{money(billingBalanceCents(job))} due</b></span><ChevronRight/></button>)}</section>}
      <section className="schedule-board"><header><h2>Upcoming jobs</h2><span>{upcoming.length}</span></header>{upcoming.length?upcoming.map((job)=><button className="schedule-job" key={job.id} onClick={()=>setSelected(job)}><span className="schedule-date"><b>{new Date(job.scheduledAt!).getDate()}</b><small>{new Date(job.scheduledAt!).toLocaleString("en-US",{month:"short"}).toUpperCase()}</small></span><span><strong>{job.customer}</strong><small>{job.service} · {new Date(job.scheduledAt!).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</small><em>{job.address||"No address saved"}</em></span><strong>{money(resolvedBillingTotalCents(job))}</strong><ChevronRight/></button>):<div className="record-empty"><CalendarDays/><strong>No upcoming jobs</strong><p>Open an approved estimate and save a job date.</p></div>}</section>
    </>}
  </div>;
}

function InvoicesView({searchQuery}:{searchQuery:string}) {
  const [rows,setRows]=useState<InvoiceRow[]>([]);
  const [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);try{const response=await fetch("/api/invoices");const result=await response.json() as {invoices?:InvoiceRow[]};setRows((result.invoices??[]).map((item)=>({...item,totalCents:Number(item.totalCents),paidCents:Number(item.paidCents??0)})));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const visible=rows.filter((row)=>[row.customer,row.service,row.status].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Billing</p><h1>Invoices</h1><p>Open, send, and record payment against every invoice.</p></div></section>{loading?<div className="customers-state">Loading invoices…</div>:visible.length?<section className="invoice-list">{visible.map((invoice)=>{const estimate={id:invoice.estimateId,customer:invoice.customer||"Customer",service:invoice.service||"Service",totalCents:invoice.totalCents,paidCents:Number(invoice.paidCents??0)};return <article className="invoice-card" key={invoice.id}><span className="invoice-icon"><Receipt/></span><div><strong>{invoice.customer}</strong><small>{invoice.service} · Invoice #{invoice.id.slice(0,6).toUpperCase()}</small></div><span className={`status-chip ${Number(invoice.paymentOverageOpen)>0?"partial":invoice.status}`}>{Number(invoice.pendingRefundCount)>0?"Refund processing":Number(invoice.paymentOverageOpen)>0?"Payment review":statusLabel(invoice.status)}</span><div className="invoice-total"><strong>{money(invoice.totalCents)}</strong><small>{Number(invoice.pendingRefundCount)>0?"Refund pending":Number(invoice.paymentOverageOpen)>0?"Billing exception open":`${money(Math.max(0,invoice.totalCents-Number(invoice.paidCents??0)))} balance`}</small></div><div className="invoice-actions">{invoice.shareToken&&<a href={`/invoice/${invoice.shareToken}`} target="_blank" rel="noreferrer"><ExternalLink/>Open</a>}{Number(invoice.pendingRefundCount)===0&&<RecordPayment estimate={estimate} onRecorded={()=>void load()}/>}</div></article>;})}</section>:<div className="customers-state"><Receipt/><strong>No invoices yet</strong><p>Open an estimate and choose Create invoice.</p></div>}</div>;
}

function ContractsView({searchQuery}:{searchQuery:string}){
  const [rows,setRows]=useState<EstimateRow[]>([]);const [selected,setSelected]=useState<EstimateRow|null>(null);const [loading,setLoading]=useState(true);
  const load=async()=>{try{const response=await fetch("/api/estimates");const result=await response.json() as {estimates?:EstimateRow[]};setRows((result.estimates??[]).map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents),pendingChangeCount:Number(item.pendingChangeCount??0)})));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);const visible=rows.filter((row)=>[row.customer,row.service,row.signedName].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));const signed=rows.filter((row)=>row.signedAt).length;
  return <div className="workspace-view"><EstimateDetail estimate={selected} onClose={()=>setSelected(null)} onChanged={()=>{setSelected(null);void load();}}/><section className="workspace-head"><div><p className="eyebrow">Contracts & e-signatures</p><h1>Agreements</h1><p>See who viewed, signed, or requested a change to each estimate.</p></div></section><section className="business-metrics"><article><small>Signed agreements</small><strong>{signed}</strong></article><article><small>Awaiting signature</small><strong>{rows.filter((row)=>!row.signedAt&&!["declined","completed"].includes(row.status)).length}</strong></article><article><small>Change requests</small><strong>{rows.reduce((sum,row)=>sum+Number(row.pendingChangeCount??0),0)}</strong></article></section>{loading?<div className="customers-state">Loading agreements…</div>:visible.length?<section className="contract-list">{visible.map((estimate)=><button key={estimate.id} onClick={()=>setSelected(estimate)}><span className={`contract-state ${estimate.signedAt?"signed":Number(estimate.pendingChangeCount)>0?"change":"pending"}`}>{estimate.signedAt?<PenLine/>:Number(estimate.pendingChangeCount)>0?<MessageSquareText/>:<Clock3/>}</span><span><strong>{estimate.customer}</strong><small>{estimate.service} · {money(estimate.totalCents)}</small></span><span className={`status-chip ${estimate.signedAt?"approved":"draft"}`}>{estimate.signedAt?"Signed":"Awaiting signature"}</span><ChevronRight/></button>)}</section>:<div className="customers-state"><PenLine/><strong>No agreements yet</strong><p>Create an estimate to send the service agreement for signature.</p></div>}</div>;
}

function FollowUpsView({searchQuery}:{searchQuery:string}){
  const [rows,setRows]=useState<EstimateRow[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{void (async()=>{try{const response=await fetch("/api/estimates");const result=await response.json() as {estimates?:EstimateRow[]};setRows((result.estimates??[]).map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents)})));}finally{setLoading(false);}})();},[]);
  const now=useCurrentTime();
  const actions=rows.flatMap((estimate)=>{
    const ageDays=Math.max(0,Math.floor((now-new Date(estimate.createdAt).getTime())/86400000));
    const scheduledTime=estimate.scheduledAt?new Date(estimate.scheduledAt).getTime():0;
    const items:{estimate:EstimateRow;template:string;reason:string;priority:number;kind:"followup"|"repeat"|"review"}[]=[];
    if(Number(estimate.pendingRefundCount)>0)items.push({estimate,template:"invoiceReminder",reason:"Refund is still processing — wait for reconciliation before collecting or reviewing",priority:7,kind:"followup"});
    else if(Number(estimate.paymentOverageOpen)>0)items.push({estimate,template:"invoiceReminder",reason:"Billing exception: overpayment needs refund or retained-overpayment review",priority:6,kind:"followup"});
    else if(estimate.invoiceId&&billingBalanceCents(estimate)>0)items.push({estimate,template:"invoiceReminder",reason:"Invoice balance needs a reminder",priority:4,kind:"followup"});
    else if(estimate.status==="scheduled"&&scheduledTime>now&&scheduledTime-now<=36*3600000)items.push({estimate,template:"appointmentReminder",reason:"Job is coming up within 36 hours",priority:5,kind:"followup"});
    else if(["draft","sent"].includes(estimate.status)&&ageDays>=7)items.push({estimate,template:"followUp7",reason:"Estimate has been open at least 7 days",priority:3,kind:"followup"});
    else if(["draft","sent"].includes(estimate.status)&&ageDays>=3)items.push({estimate,template:"followUp3",reason:"Estimate has been open at least 3 days",priority:2,kind:"followup"});
    else if(["draft","sent"].includes(estimate.status)&&ageDays>=1)items.push({estimate,template:"followUp1",reason:"Estimate has been open at least 1 day",priority:1,kind:"followup"});
    const serviceDate=estimate.scheduledAt||estimate.createdAt;
    const serviceAgeDays=Math.max(0,Math.floor((now-new Date(serviceDate).getTime())/86400000));
    if(safeBillingState(estimate)&&estimate.status==="completed"&&Number(estimate.paymentOverageOpen)===0&&Number(estimate.pendingRefundCount)===0&&estimate.paidCents>=resolvedBillingTotalCents(estimate)&&serviceAgeDays<=30&&!estimate.lastReviewRequestAt)items.push({estimate,template:"review",reason:"Paid and complete — ask for a Google-first review",priority:4,kind:"review"});
    if(estimate.status==="completed"&&Number(estimate.paymentOverageOpen)===0&&Number(estimate.pendingRefundCount)===0&&billingBalanceCents(estimate)===0&&!estimate.lastRebookMessageAt){const cadence=repeatCadenceMonths(estimate.service);const due=addMonths(serviceDate,cadence);const daysUntil=Math.ceil((due.getTime()-now)/86400000);if(daysUntil<=45)items.push({estimate,template:cadence<=6?"winBack6":"winBack11",reason:daysUntil<0?`Repeat service is ${Math.abs(daysUntil)} days overdue`:`Repeat service is due in ${daysUntil} days`,priority:daysUntil<0?4:2,kind:"repeat"});}
    return items;
  }).filter((item)=>[item.estimate.customer,item.estimate.service,item.reason].join(" ").toLowerCase().includes(searchQuery.toLowerCase())).sort((a,b)=>b.priority-a.priority);
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Start workflow</p><h1>Follow-ups</h1><p>Customers who need a reminder, confirmation, review request, or payment follow-up.</p></div></section>
    <div className="followup-summary"><span><Clock3/><div><strong>{actions.length}</strong><small>recommended actions</small></div></span><div className="followup-breakdown"><b>{actions.filter((item)=>item.kind==="followup").length} follow-ups</b><b>{actions.filter((item)=>item.kind==="review").length} reviews</b><b>{actions.filter((item)=>item.kind==="repeat").length} repeat jobs</b></div><p>Messages open prefilled and editable. Your phone still lets you review and tap Send.</p></div>
    {loading?<div className="customers-state">Checking customer follow-ups…</div>:actions.length?<section className="followup-list">{actions.map(({estimate,template,reason,kind})=>{const customer:CustomerRow={id:estimate.customerId||"",name:estimate.customer,email:estimate.email||"",phone:estimate.phone||"",address:estimate.address||"",createdAt:estimate.createdAt,estimateCount:1,estimateTotal:resolvedBillingTotalCents(estimate),paidTotal:estimate.paidCents};return <article className={`followup-card ${kind}`} key={`${estimate.id}-${template}`}><span className="followup-icon">{kind==="review"?<Star/>:kind==="repeat"?<CalendarDays/>:<Clock3/>}</span><div><strong>{estimate.customer}</strong><p>{reason}</p><small>{estimate.service} · {money(billingBalanceCents(estimate))}</small></div><MessageComposer customer={customer} estimate={estimate} initialTemplate={template} triggerLabel="Prepare message"/></article>;})}</section>:<div className="customers-state"><CheckCircle2/><strong>You’re caught up</strong><p>No customer follow-ups are recommended right now.</p></div>}
  </div>;
}

function PaymentsView({searchQuery}:{searchQuery:string}){
  const [estimates,setEstimates]=useState<EstimateRow[]>([]);const [payments,setPayments]=useState<PaymentRow[]>([]);const [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);try{const [estimateResponse,paymentResponse]=await Promise.all([fetch("/api/estimates"),fetch("/api/payments")]);const estimateResult=await estimateResponse.json() as {estimates?:EstimateRow[]};const paymentResult=await paymentResponse.json() as {payments?:PaymentRow[]};setEstimates((estimateResult.estimates??[]).map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents)})));setPayments((paymentResult.payments??[]).map((item)=>({...item,amountCents:Number(item.amountCents),refundedCents:Number(item.refundedCents??0),refundableCents:Number(item.refundableCents??0),stripePayment:Number(item.stripePayment??0)})));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  const remainingBalance=(estimate:EstimateRow)=>amountDueNow(estimate);
  const open=estimates.filter((item)=>Number(item.pendingRefundCount)===0&&remainingBalance(item)>0&&[item.customer,item.service,item.status].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  const collected=Math.max(0,safeSignedSumCents(payments.map((item)=>item.amountCents)));const tipRevenue=Math.max(0,safeSignedSumCents(payments.filter((item)=>item.type==="Tip"||item.type==="Tip Refund").map((item)=>item.amountCents)));const outstanding=safeSumCents(estimates.map((item)=>remainingBalance(item)));
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Money received</p><h1>Payments</h1><p>Track Wave, Cash App, Venmo, cash, check, card, and bank payments without waiting for a processor connection.</p></div></section><section className="business-metrics"><article><small>Total recorded</small><strong>{money(collected)}</strong></article><article><small>Tip revenue</small><strong>{money(tipRevenue)}</strong></article><article><small>Outstanding</small><strong>{money(outstanding)}</strong></article><article><small>Open balances</small><strong>{open.length}</strong></article></section><ProcessingReport payments={payments}/>{loading?<div className="customers-state">Loading balances…</div>:<div className="payment-layout"><section className="business-panel"><header><div><h2>Balances to collect</h2><p>Record money after it reaches Wave, Cash App, Venmo, or your account.</p></div></header><div className="balance-list">{open.length?open.map((estimate)=><article key={estimate.id}><div><strong>{estimate.customer}</strong><small>{estimate.service} · {statusLabel(estimate.status)}</small></div><span><strong>{money(remainingBalance(estimate))}</strong><small>remaining</small></span><RecordPayment estimate={estimate} onRecorded={()=>void load()}/></article>):<div className="record-empty"><CheckCircle2/><strong>All caught up</strong><p>No outstanding customer balances.</p></div>}</div></section><section className="business-panel"><header><div><h2>Payment history</h2><p>Every recorded transaction, newest first.</p></div></header><div className="payment-history">{payments.length?payments.map((payment)=><article key={payment.id}><span className="payment-method"><CircleDollarSign/></span><div><strong>{payment.customer||"Customer"}</strong><small>{payment.type} · {payment.service||"Service"} · {new Date(payment.createdAt).toLocaleDateString()}</small>{payment.refundedCents?` · ${money(payment.refundedCents)} refunded`:""}{payment.amountCents>0&&payment.reference&&<em>{payment.reference}</em>}<ProcessingDetails payment={payment}/></div><strong>{money(payment.amountCents)}</strong>{payment.amountCents>0&&<RefundPayment payment={payment} onRefunded={()=>void load()}/>}</article>):<div className="record-empty"><CreditCard/><strong>No payments recorded</strong><p>Use Record payment on an estimate or open balance.</p></div>}</div></section></div>}</div>;
}

function BusinessView(){
  const [tasks,setTasks]=useState<TaskRow[]>([]);const [expenses,setExpenses]=useState<ExpenseRow[]>([]);const [customers,setCustomers]=useState<CustomerRow[]>([]);const [estimates,setEstimates]=useState<CustomerEstimate[]>([]);const [title,setTitle]=useState("");const [dueAt,setDueAt]=useState("");const [taskNotes,setTaskNotes]=useState("");const [taskCustomer,setTaskCustomer]=useState("none");const [description,setDescription]=useState("");const [amount,setAmount]=useState("");const [category,setCategory]=useState("Supplies");const [expenseEstimate,setExpenseEstimate]=useState("none");
  const [taskSaving,setTaskSaving]=useState(false);const [expenseSaving,setExpenseSaving]=useState(false);const [taskToggling,setTaskToggling]=useState<string|null>(null);const [businessMessage,setBusinessMessage]=useState("");
  const [pendingBackup,setPendingBackup]=useState<Record<string,unknown>|null>(null);const [restoreMessage,setRestoreMessage]=useState("");const [restoreBusy,setRestoreBusy]=useState(false);const restoreInput=useRef<HTMLInputElement>(null);
  const load=async()=>{const [taskResponse,expenseResponse,customerResponse]=await Promise.all([fetch("/api/tasks"),fetch("/api/expenses"),fetch("/api/customers")]);const taskResult=await taskResponse.json() as {tasks?:TaskRow[]};const expenseResult=await expenseResponse.json() as {expenses?:ExpenseRow[]};const customerResult=await customerResponse.json() as {customers?:CustomerRow[];estimates?:CustomerEstimate[]};setTasks(taskResult.tasks??[]);setExpenses((expenseResult.expenses??[]).map((row)=>({...row,amountCents:Number(row.amountCents)})));setCustomers(customerResult.customers??[]);setEstimates(customerResult.estimates??[]);};
  useEffect(()=>{void load();},[]);
  const addTask=async()=>{if(taskSaving)return;if(!title.trim()){setBusinessMessage("Enter a task or reminder first.");return;}setTaskSaving(true);setBusinessMessage("");try{const response=await fetch("/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title,dueAt:dueAt?new Date(dueAt).toISOString():null,notes:taskNotes,customerId:taskCustomer==="none"?null:taskCustomer})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"The task could not be saved.");setTitle("");setDueAt("");setTaskNotes("");setTaskCustomer("none");setBusinessMessage("Task added.");await load();}catch(error){setBusinessMessage(error instanceof Error?error.message:"The task could not be saved.");}finally{setTaskSaving(false);}};
  const toggleTask=async(task:TaskRow)=>{if(taskToggling)return;setTaskToggling(task.id);setBusinessMessage("");const nextStatus=task.status==="open"?"completed":"open";setTasks((current)=>current.map((item)=>item.id===task.id?{...item,status:nextStatus}:item));try{const response=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,status:nextStatus})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"The task could not be updated.");}catch(error){setTasks((current)=>current.map((item)=>item.id===task.id?{...item,status:task.status}:item));setBusinessMessage(error instanceof Error?error.message:"The task could not be updated.");}finally{setTaskToggling(null);}};
  const addExpense=async()=>{if(expenseSaving)return;const amountCents=Math.round(Number(amount)*100);if(!description.trim()){setBusinessMessage("Enter what the expense was for.");return;}if(amountCents<=0){setBusinessMessage("Enter a valid expense amount.");return;}setExpenseSaving(true);setBusinessMessage("");try{const response=await fetch("/api/expenses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,description,amountCents,incurredAt:new Date().toISOString(),estimateId:expenseEstimate==="none"?null:expenseEstimate})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"The expense could not be saved.");setDescription("");setAmount("");setExpenseEstimate("none");setBusinessMessage("Expense recorded.");await load();}catch(error){setBusinessMessage(error instanceof Error?error.message:"The expense could not be saved.");}finally{setExpenseSaving(false);}};
  const chooseBackup=async(file:File)=>{setRestoreMessage("");try{if(file.size>5_000_000)throw new Error("That backup is larger than 5 MB.");const parsed=JSON.parse(await file.text()) as Record<string,unknown>;const normal=parsed?.format==="fire-app-records-backup"&&parsed?.version===1;const snapshot=parsed?.backup_format==="FIRE App live database snapshot"&&parsed?.format_version===1&&typeof parsed?.verification==="object"&&parsed?.verification!==null&&(parsed.verification as Record<string,unknown>).all_tables_complete===true&&(parsed.verification as Record<string,unknown>).truncated===false;if(!normal&&!snapshot)throw new Error("This is not a valid or complete FIRE App records backup.");setPendingBackup(parsed);}catch(error){setRestoreMessage(error instanceof Error?error.message:"The backup could not be opened.");}finally{if(restoreInput.current)restoreInput.current.value="";}};
  const restoreBackup=async()=>{if(!pendingBackup)return;setRestoreBusy(true);setRestoreMessage("");try{const response=await fetch("/api/backup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pendingBackup)});const result=await response.json() as {restored?:number;duplicatesPreserved?:number;photoMetadataSkipped?:number;error?:string};if(!response.ok)throw new Error(result.error||"The backup could not be restored.");setPendingBackup(null);setRestoreMessage(`${result.restored??0} missing records restored; ${result.duplicatesPreserved??0} existing records preserved.${result.photoMetadataSkipped?` ${result.photoMetadataSkipped} photo references skipped because photo files require a separate archive.`:""}`);void load();}catch(error){setRestoreMessage(error instanceof Error?error.message:"The backup could not be restored.");}finally{setRestoreBusy(false);}};
  const monthExpenses=expenses.filter((row)=>new Date(row.incurredAt).getMonth()===new Date().getMonth()).reduce((sum,row)=>sum+row.amountCents,0);
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Owner operations</p><h1>Business</h1><p>Tasks, expenses, and job profitability in one simple place.</p></div><div className="workspace-head-actions"><a className="export-button" href="/api/backup"><Download/> Full records backup</a><a className="export-button" href="/api/backup/photos"><Images/> Photo archive</a><button type="button" className="export-button" disabled={restoreBusy} onClick={()=>restoreInput.current?.click()}><Upload/> Restore missing records</button><input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(event)=>{const file=event.target.files?.[0];if(file)void chooseBackup(file);}}/><a className="export-button" href="/api/expenses?format=csv"><Download/> Export for Wave</a></div></section>{restoreMessage&&<p className="save-message" role="status">{restoreMessage}</p>}{businessMessage&&<p className={businessMessage.includes("added")||businessMessage.includes("recorded")?"save-success":"save-error"} role="status">{businessMessage}</p>}<section className="business-metrics"><article><small>Open tasks</small><strong>{tasks.filter((task)=>task.status==="open").length}</strong></article><article><small>This month&apos;s expenses</small><strong>{money(monthExpenses)}</strong></article><article><small>Recorded expenses</small><strong>{expenses.length}</strong></article></section><div className="business-grid"><section className="business-panel"><header><div><h2>Tasks and reminders</h2><p>Keep follow-ups and field work from slipping.</p></div></header><div className="business-form"><Input value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Task, call, or reminder"/><Select value={taskCustomer} onValueChange={setTaskCustomer}><SelectTrigger><SelectValue placeholder="Link a customer"/></SelectTrigger><SelectContent><SelectItem value="none">General business task</SelectItem>{customers.map((customer)=><SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select><Input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/><Textarea value={taskNotes} onChange={(event)=>setTaskNotes(event.target.value)} placeholder="Optional notes" rows={2}/><Button className="brand-button" onClick={()=>void addTask()} disabled={taskSaving}><Plus className="h-4 w-4"/> {taskSaving?"Adding…":"Add task"}</Button></div><div className="task-list">{tasks.map((task)=><button key={task.id} className={task.status} onClick={()=>void toggleTask(task)} disabled={taskToggling===task.id}><span className="task-check">{task.status==="completed"&&<Check/>}</span><span><strong>{task.title}</strong><small>{task.customer?`${task.customer} · `:""}{task.dueAt?dateTime(task.dueAt):"No due date"}{task.notes?` · ${task.notes}`:""}</small></span></button>)}{!tasks.length&&<p>No tasks yet.</p>}</div></section><section className="business-panel"><header><div><h2>Expenses</h2><p>Track costs and export them for Wave.</p></div></header><div className="business-form"><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Supplies","Chemicals","Equipment","Fuel","Insurance","Marketing","Labor","Other"].map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={expenseEstimate} onValueChange={setExpenseEstimate}><SelectTrigger><SelectValue placeholder="Link a job"/></SelectTrigger><SelectContent><SelectItem value="none">General business expense</SelectItem>{estimates.map((estimate)=>{const customer=customers.find((item)=>item.id===estimate.customerId);return <SelectItem key={estimate.id} value={estimate.id}>{customer?.name||"Customer"} · {estimate.service}</SelectItem>;})}</SelectContent></Select><Input value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="What was the expense?"/><Input value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="$ Amount"/><Button className="brand-button" onClick={()=>void addExpense()} disabled={expenseSaving}><Plus className="h-4 w-4"/> {expenseSaving?"Adding…":"Add expense"}</Button></div><div className="expense-list">{expenses.slice(0,12).map((row)=><div key={row.id}><span><strong>{row.description}</strong><small>{row.category}{row.customer?` · ${row.customer}`:""} · {new Date(row.incurredAt).toLocaleDateString()}</small></span><b>{money(row.amountCents)}</b></div>)}{!expenses.length&&<p>No expenses recorded yet.</p>}</div></section></div><AlertDialog open={Boolean(pendingBackup)} onOpenChange={(open)=>{if(!open&&!restoreBusy)setPendingBackup(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore missing FIRE App records?</AlertDialogTitle><AlertDialogDescription>The app will add records that are missing from this backup. It will not delete or overwrite records already in the app. Customer photo files are not included and will be skipped.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={restoreBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={restoreBusy} onClick={(event)=>{event.preventDefault();void restoreBackup();}}>{restoreBusy?"Restoring…":"Restore missing records"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}

function SettingsView(){
  const [templates,setTemplates]=useState<FireTemplate[]>(FIRE_TEMPLATES);
  const [selectedKey,setSelectedKey]=useState("estimate");
  const [draft,setDraft]=useState<FireTemplate>(FIRE_TEMPLATES[0]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{void (async()=>{const response=await fetch("/api/message-templates");const result=await response.json() as {templates?:FireTemplate[]};if(response.ok&&result.templates){setTemplates(result.templates);const chosen=result.templates.find((item)=>item.key==="estimate")??result.templates[0];setDraft(chosen);}})();},[]);
  const savedTemplate=templates.find((item)=>item.key===draft.key);
  const hasUnsavedTemplateChanges=Boolean(savedTemplate&&(savedTemplate.subject!==draft.subject||savedTemplate.body!==draft.body));
  const choose=(item:FireTemplate)=>{if(hasUnsavedTemplateChanges&&!window.confirm("Discard your unsaved template changes?"))return;setSelectedKey(item.key);setDraft(item);setMessage("");};
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(!hasUnsavedTemplateChanges)return;event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[hasUnsavedTemplateChanges]);
  const save=async(reset=false)=>{if(reset&&!window.confirm("Restore the original FIRE template and replace your current edits?"))return;setSaving(true);setMessage("");try{const response=await fetch("/api/message-templates",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(reset?{key:draft.key,reset:true}:{key:draft.key,subject:draft.subject,body:draft.body})});const result=await response.json() as {template?:FireTemplate;error?:string};if(!response.ok||!result.template)throw new Error(result.error||"Template could not be saved.");setTemplates((current)=>current.map((item)=>item.key===draft.key?result.template!:item));setDraft(result.template);setMessage(reset?"Default restored.":"Template saved.");}catch(error){setMessage(error instanceof Error?error.message:"Template could not be saved.");}finally{setSaving(false);}};
  const tags=["@customer_first_name","@customer_name","@service_list","@service_address","@estimate_total","@estimate_link","@invoice_total","@invoice_link","@schedule_date","@form_link","@review_link"];
  return <div className="workspace-view settings-view"><section className="workspace-head"><div><p className="eyebrow">Communication center</p><h1>Message templates</h1><p>Edit every customer message once, then use it from estimates, invoices, customer profiles, and follow-ups.</p></div></section>
    <div className="template-layout"><aside className="template-list">{(["Estimates","Invoices","Scheduling","After service","Documents"] as const).map((category)=><section key={category}><h2>{category}</h2>{templates.filter((item)=>item.category===category).map((item)=><button key={item.key} className={selectedKey===item.key?"active":""} onClick={()=>choose(item)}><span>{item.channel==="document"?<FileText/>:<MessageSquareText/>}</span><div><strong>{item.name}</strong><small>{item.channel==="both"?"Text + email":statusLabel(item.channel)}</small></div><ChevronRight/></button>)}</section>)}</aside>
      <section className="template-editor"><header><div><p className="eyebrow">{draft.category}</p><h2>{draft.name}</h2></div><span className="template-channel">{draft.channel==="both"?"Text + email":statusLabel(draft.channel)}</span></header>
        {draft.channel!=="sms"&&draft.channel!=="document"&&<div><Label htmlFor="templateSubject">Email subject</Label><Input id="templateSubject" value={draft.subject} onChange={(event)=>setDraft({...draft,subject:event.target.value})}/></div>}
        <div><Label htmlFor="templateBody">{draft.channel==="document"?"Service agreement text":"Message"}</Label><Textarea id="templateBody" rows={11} value={draft.body} onChange={(event)=>setDraft({...draft,body:event.target.value})}/><small>{draft.channel==="document"?"This is the full agreement customers review before signing once.":"Personalized fields are filled automatically when you prepare the message."}</small></div>
        {draft.channel!=="document"&&<div className="merge-tags"><Label>Insert a personalized field</Label><div>{tags.map((tag)=><button key={tag} onClick={()=>setDraft({...draft,body:`${draft.body}${draft.body.endsWith(" ")?"":" "}${tag}`})}>{tag}</button>)}</div></div>}
        {message&&<p className={message.includes("saved")||message.includes("restored")?"save-success":"save-error"}>{message}</p>}
        <footer><Button variant="outline" onClick={()=>void save(true)} disabled={saving}>Restore default</Button><Button className="brand-button" onClick={()=>void save()} disabled={saving||!draft.body.trim()||!hasUnsavedTemplateChanges}><Save className="h-4 w-4"/>{saving?"Saving…":"Save template"}</Button></footer>
      </section>
    </div>
  </div>;
}

function EmptyView({ tab, onSaved }: { tab: string; onSaved: (estimate: EstimateRow) => void }) {
  const content: Record<string, { title: string; text: string; icon: React.ReactNode }> = {
    estimates: { title: "Estimates", text: "Create, send, approve, and track every estimate in one place.", icon: <ClipboardList /> },
    customers: { title: "Customers", text: "Customer details, addresses, notes, and complete job history.", icon: <Users /> },
    schedule: { title: "Schedule", text: "Plan jobs and keep upcoming work visible from your phone.", icon: <CalendarDays /> },
    payments: { title: "Payments", text: "Collect deposits and final balances. Connect Stripe before accepting live payments.", icon: <CreditCard /> },
  };
  const view = content[tab];
  return <section className="empty-view"><span>{view.icon}</span><h1>{view.title}</h1><p>{view.text}</p>{tab === "estimates" && <NewEstimate onSaved={onSaved} />}{tab === "payments" && <Button disabled>Stripe connection coming later</Button>}</section>;
}

function NotificationBell({onNavigate}:{onNavigate:(tab:string)=>void}){
  const [items,setItems]=useState<AppNotification[]>([]);
  const [unread,setUnread]=useState(0);
  const [open,setOpen]=useState(false);
  const load=async()=>{try{const response=await fetch("/api/notifications");const result=await response.json() as {notifications?:AppNotification[];unread?:number};if(response.ok){setItems(result.notifications??[]);setUnread(Number(result.unread??0));}}catch{}};
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer);},[]);
  const mark=async(id:string)=>{setItems((current)=>current.map((item)=>item.id===id?{...item,readAt:new Date().toISOString()}:item));setUnread((current)=>Math.max(0,current-1));await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id})});};
  const markAll=async()=>{const now=new Date().toISOString();setItems((current)=>current.map((item)=>({...item,readAt:item.readAt||now})));setUnread(0);await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({all:true})});};
  const icon=(type:string)=>type==="estimate_change_requested"?<MessageSquareText/>:type==="estimate_viewed"?<Eye/>:type==="invoice_viewed"?<Receipt/>:type==="estimate_accepted"?<CheckCircle2/>:<CircleDollarSign/>;
  return <Popover open={open} onOpenChange={(value)=>{setOpen(value);if(value)void load();}}><PopoverTrigger asChild><button className="notification-button" aria-label={unread?`${unread} unread notifications`:"Notifications"}><Bell/>{unread>0&&<b>{unread>9?"9+":unread}</b>}</button></PopoverTrigger><PopoverContent className="notification-popover" align="end">
    <header><div><strong>Notifications</strong><small>{unread?`${unread} unread`:"You’re all caught up"}</small></div>{unread>0&&<button onClick={()=>void markAll()}>Mark all read</button>}</header>
    <div className="notification-list">{items.length?items.map((item)=><button key={item.id} className={item.readAt?"":"unread"} onClick={()=>{if(!item.readAt)void mark(item.id);setOpen(false);onNavigate(item.type==="invoice_viewed"?"invoices":"estimates");}}><span className={`notification-icon ${item.type}`}>{icon(item.type)}</span><span><strong>{item.title}</strong><p>{item.body}</p><small>{dateTime(item.createdAt)}</small></span></button>):<div className="notification-empty"><Bell/><strong>No notifications yet</strong><p>Customer views, approvals, and confirmed payments will appear here.</p></div>}</div>
  </PopoverContent></Popover>;
}

export function Dashboard({userName,metrics,estimates}:{userName:string;metrics:{estimates:number;openValue:number;outstanding:number};estimates:EstimateRow[]}) {
  const [tab, setTab] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [theme,setTheme]=useState<"light"|"dark">("light");
  const [estimateRefreshKey,setEstimateRefreshKey]=useState(0);
  const [estimateRows, setEstimateRows] = useState(estimates);
  const [liveMetrics, setLiveMetrics] = useState(metrics);
  const previousTab = useRef("dashboard");
  const currentTab = useRef("dashboard");
  useEffect(() => { if (tab !== currentTab.current) { previousTab.current = currentTab.current; currentTab.current = tab; } }, [tab]);
  const goHome = () => { setTab("dashboard"); setMobileMenu(false); };
  const goBack = () => { const target = previousTab.current || "dashboard"; setTab(target); setMobileMenu(false); };
  const nav = useMemo(() => [
    ["dashboard", "Dashboard", House], ["contracts", "Contracts", PenLine], ["customers", "Customers", Users], ["estimates", "Estimates", ClipboardList], ["followups", "Follow-ups", Clock3], ["schedule", "Schedule", CalendarDays], ["invoices", "Invoices", Receipt], ["business", "Business", BriefcaseBusiness], ["payments", "Payments", CreditCard], ["settings", "Templates", Settings],
  ] as const, []);
  useEffect(()=>{
    const saved=window.localStorage.getItem("fire-theme");
    const next=saved==="dark"||saved==="light"?saved:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
    setTheme(next);
    document.documentElement.dataset.theme=next;
  },[]);
  const toggleTheme=()=>{
    const next=theme==="dark"?"light":"dark";
    setTheme(next);
    document.documentElement.dataset.theme=next;
    window.localStorage.setItem("fire-theme",next);
  };
  useEffect(()=>{
    if(tab!=="dashboard")return;
    let cancelled=false;
    void fetch("/api/dashboard-summary",{cache:"no-store"}).then(async(response)=>{
      if(!response.ok)return;
      const summary=await response.json() as {estimates:number;openValue:number;outstanding:number;recent?:EstimateRow[]};
      if(!cancelled){
        setLiveMetrics({estimates:Number(summary.estimates),openValue:Number(summary.openValue),outstanding:Number(summary.outstanding)});
        if(Array.isArray(summary.recent))setEstimateRows(summary.recent);
      }
    }).catch(()=>{});
    return()=>{cancelled=true;};
  },[tab,estimateRefreshKey]);
  const handleSaved = (estimate: EstimateRow) => {
    setEstimateRows((current) => [estimate, ...current]);
    setLiveMetrics((current) => {
      const nextOpen=Number.isSafeInteger(current.openValue+estimate.totalCents)?current.openValue+estimate.totalCents:current.openValue;
      return {estimates:current.estimates+1,openValue:nextOpen,outstanding:current.outstanding};
    });
  };
  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand"><FireMark /><div><strong>FIRE</strong><small>Business App</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X /></button></div>
        <label className="mobile-menu-search"><Search/><input value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"){setTab("customers");setMobileMenu(false);}}} placeholder="Search customers or jobs" aria-label="Search customers or jobs"/>{searchQuery&&<button type="button" onClick={()=>setSearchQuery("")} aria-label="Clear search"><X/></button>}</label>
        <nav>{nav.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setMobileMenu(false); }}><Icon /><span>{label}</span>{id === "estimates" && liveMetrics.estimates > 0 && <b>{liveMetrics.estimates}</b>}</button>)}</nav>
        <div className="sidebar-foot"><div className="owner-avatar">KB</div><div><strong>Kyle Brooks</strong><small>Owner</small></div><ChevronRight /></div>
      </aside>
      <section className="main-area">
        <header className={`topbar ${["estimates","schedule"].includes(tab)?"compact-mobile":""}`}><div className="mobile-brand"><FireMark small /><strong>FIRE</strong></div><div className="mobile-primary-actions"><button className="mobile-back-button" onClick={goBack} aria-label="Back" title="Back"><ArrowLeft /></button><button className={`mobile-home-button ${tab==="dashboard"?"active":""}`} onClick={goHome} aria-label="Home" title="Home"><House /></button><button className="mobile-theme-button" onClick={toggleTheme} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`} title={`Switch to ${theme==="dark"?"light":"dark"} mode`}>{theme==="dark"?<Sun/>:<Moon/>}</button><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu" title="Menu"><Menu /></button></div>{!["estimates","schedule"].includes(tab)&&<label className="search-box"><Search /><input value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} onFocus={()=>{if(tab==="dashboard")setTab("customers");}} placeholder="Search customers, jobs, or addresses" aria-label="Search customers, jobs, or addresses"/></label>}<div className="top-actions"><button className="payment-state" onClick={()=>setTab("payments")}><i /> Record payments</button><StrideButton top/><NotificationBell onNavigate={(next)=>{if(next==="estimates")setEstimateRefreshKey((value)=>value+1);setTab(next);}}/><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`} title={`Switch to ${theme==="dark"?"light":"dark"} mode`}>{theme==="dark"?<Sun/>:<Moon/>}<span>{theme==="dark"?"Light":"Dark"}</span></button><button className="avatar-button" onClick={() => setTab("settings")} aria-label="Open settings">KB</button></div></header>
        {tab === "dashboard" ? <DashboardView userName={userName} metrics={liveMetrics} estimates={estimateRows} onSaved={handleSaved} onNavigate={setTab} /> : tab === "contracts" ? <ContractsView searchQuery={searchQuery}/> : tab === "customers" ? <CustomersView onEstimateSaved={handleSaved} searchQuery={searchQuery} /> : tab === "estimates" ? <EstimatesView key={estimateRefreshKey} onSaved={handleSaved} searchQuery={searchQuery}/> : tab === "followups" ? <FollowUpsView searchQuery={searchQuery}/> : tab === "schedule" ? <ScheduleView searchQuery={searchQuery}/> : tab === "invoices" ? <InvoicesView searchQuery={searchQuery}/> : tab === "business" ? <BusinessView/> : tab === "payments" ? <PaymentsView searchQuery={searchQuery}/> : tab === "settings" ? <SettingsView/> : <EmptyView tab={tab} onSaved={handleSaved} />}
      </section>
      {mobileMenu && <button aria-label="Close menu overlay" className="menu-scrim" onClick={() => setMobileMenu(false)} />}
      <nav className="bottom-nav">{nav.filter(([id])=>["dashboard","contracts","customers","estimates","schedule"].includes(id)).map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon /><span>{id==="dashboard"?"Home":label}</span></button>)}</nav>
    </main>
  );
}
