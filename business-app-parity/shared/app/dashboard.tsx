"use client";
import {JobCloseoutHistory} from "../components/job-closeout-history";
import {businessReceiptStorage,readBusinessReceipt,reserveBusinessReceipt,releaseBusinessReceipt,type BusinessCreateKind} from "../lib/business-create-receipt";
import {taskDueBucket} from "../lib/task-due";
import {estimateAttentionItems,type AttentionEstimate,type AttentionEstimateItem} from "../lib/attention-estimates";
import {flagHasMatchingDueTask} from "../lib/attention-flag-dedupe";
import {businessTaskContext,taskLinkedFlag} from "../lib/business-task-context";
import {expenseDateInstant} from "../lib/expense-date";
import {loadCustomerCreateRequest,saveCustomerCreateRequest,clearCustomerCreateRequest,confirmedCreatedCustomer,sameCustomerCreateInput,type CreatedCustomer,type CustomerCreateInput} from "../lib/customer-create-retry";
import {completeEstimatePages} from "@/lib/estimate-pagination";
import {hasCollectibleJobValue,summarizeCustomerBalances} from "@/lib/customer-balance-summary";

import { CandidateLayoutTrace } from "../components/candidate-layout-trace";
import type {PropertyEstimateSelection} from '../lib/customer-properties';
import {CustomerLookup,validLookupCustomer,type LookupCustomer} from '../components/customer-lookup';
import {EstimateChangeHistory} from '../components/estimate-change-history';
import {OwnerDepositReview} from '../components/owner-deposit-review';
import {GlobalSearch,type SearchResult} from '../components/global-search';
import {CustomerProperties} from '../components/customer-properties';
import {OwnerJobSnapshotsProvider,useOwnerJobSnapshots,type OwnerJobSnapshotAccess} from '../components/owner-job-snapshots';
import { OwnerAccountView } from "./owner-account";
import {OfflineCustomerPhotos} from "../components/offline-customer-photos";
import {saveOfflinePhotoCustomerDirectory,loadOfflinePhotoCustomerDirectory,clearOfflinePhotoCustomerDirectory,type OfflinePhotoCustomer} from "../lib/offline-photo-customer-directory";
import {mayUseOfflinePhotoDirectory,mustClearOfflinePhotoDirectory} from "../lib/offline-photo-availability";
import { estimateFollowUpTiming, estimateReminderStage, viewedEstimateReminderCue, followupUrgency, todayActionLane, todayCustomerQueue, followupLatestContact } from "../lib/follow-up-timing";
import { messageHistoryEntries } from "../lib/message-history";
import {deriveCustomerManualFlags,REVIEW_RECEIVED_NOTE,SIGN_PICKED_UP_NOTE,signPlacedNote,reviewFollowupEligibility} from "../lib/customer-activity-flags";
import type {DashboardYardSign} from "../lib/dashboard-yard-signs";
import type {DashboardReviewCheck} from "../lib/dashboard-review-checks";
import { summarizeProcessing } from "../lib/processing-fees";
import { loadRefundRetry, saveRefundRetry, clearRefundRetry, type RefundRetryAttempt } from "../lib/refund-retry-state";
import { confirmedManualPayment,loadManualPaymentRetry, saveManualPaymentRetry, clearManualPaymentRetry, type ManualPaymentAttempt } from "../lib/manual-payment-retry-state";
import { editMoneyLine, editableLineTotalCents, restoreEditableLineMoney } from "../lib/editable-line-totals";

import {weatherIconKind,formatDailyTemperatures,weatherDayHeading,hourlyWorkCautions,dailyWorkCautions,weatherHourForJobStart,type HourlyForecastResponse} from "../lib/tulsa-weather";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  Bell,
  BarChart3,
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
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
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
  RefreshCw,
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
  TrendingUp,
  Trash2,
  PenLine,
  Upload,
  UserPlus,
  Users,
  Wind,
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
import { reviewFollowupEligible } from "@/lib/review-followup-eligibility";
import { customerJobJourney } from "@/lib/customer-job-journey";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

type EstimateItemRow = { id:string; name:string; description:string; quantity:number; unit:string; totalCents:number };
type EstimateRow = { id:string; customerId?:string; customer:string; email?:string; phone?:string; address?:string;serviceAddressSource?:string;propertyId?:string|null;propertyRevision?:number|null; service:string; serviceDescription?:string; items?:EstimateItemRow[]; subtotalCents?:number; discountCents?:number; appreciationDiscount?:number|boolean; additionalDiscountType?:"percent"|"dollar"; additionalDiscountValue?:number; status:string; totalCents:number; depositCents:number; paidCents:number; scheduledAt?:string|null; invoiceId?:string|null; invoiceShareToken?:string|null; invoiceTotalCents?:number|null; shareToken?:string|null; firstViewedAt?:string|null; acceptedAt?:string|null; signedName?:string|null; signedAt?:string|null; contractInitials?:string|null; photoRelease?:string|null; pendingChangeCount?:number; latestChangeRequest?:string|null; firstEstimateSentAt?:string|null; stage1At?:string|null; stage3At?:string|null; stage7At?:string|null; lastEstimateSentAt?:string|null; lastEstimateContactAt?:string|null; lastManualContactAt?:string|null;lastConfirmedMessageAt?:string|null;lastPreparedAt?:string|null;snoozeUntil?:string|null;lastReviewRequestAt?:string|null; lastRebookMessageAt?:string|null; paymentOverageOpen?:number; pendingRefundCount?:number; openCheckoutCount?:number; reviewReceivedAt?:string|null; reviewSnoozeUntil?:string|null; createdAt:string };
type CustomerRow = { id:string; name:string; email:string; phone:string; address:string; leadSource?:string; createdAt:string; estimateCount:number; estimateTotal:number; paidTotal:number };
type CustomerEstimate = { address?:string|null;serviceAddressSource?:string;id:string; customerId:string; service:string; serviceDescription?:string; items?:EstimateItemRow[]; subtotalCents?:number; discountCents?:number; appreciationDiscount?:number|boolean; additionalDiscountType?:"percent"|"dollar"; additionalDiscountValue?:number; status:string; totalCents:number; depositCents:number; paidCents:number; scheduledAt?:string|null; invoiceId?:string|null; invoiceShareToken?:string|null; invoiceTotalCents?:number|null; shareToken?:string|null; firstViewedAt?:string|null; acceptedAt?:string|null; signedName?:string|null; signedAt?:string|null; contractInitials?:string|null; photoRelease?:string|null; pendingChangeCount?:number; latestChangeRequest?:string|null; firstEstimateSentAt?:string|null; stage1At?:string|null; stage3At?:string|null; stage7At?:string|null; lastEstimateSentAt?:string|null; lastEstimateContactAt?:string|null; lastManualContactAt?:string|null;lastConfirmedMessageAt?:string|null;lastPreparedAt?:string|null;snoozeUntil?:string|null;lastReviewRequestAt?:string|null; lastRebookMessageAt?:string|null; paymentOverageOpen?:number; pendingRefundCount?:number; openCheckoutCount?:number; reviewReceivedAt?:string|null; reviewSnoozeUntil?:string|null; createdAt:string };
type CustomerNote = { id:string; customerId:string; body:string; createdAt:string };
type CustomerRecordFocus={id:string;customerId:string;kind:"payment"|"note"|"property"};
type YardSignPickupDraft={customerId:string;customerName:string;pickupDate:string;location:string;placedAt:string};
type ReviewCheckDraft={customerId:string;customerName:string;requestedAt:string;dueDate:string};
type InvoiceRow = { paymentReviewPending?:boolean;pendingRefundCount?:number;storedStatus?:string; estimateStatus?:string; depositCents?:number; id:string; estimateId:string; customerId:string; customer?:string; email?:string; phone?:string; address?:string; service?:string; status:string; subtotalCents?:number; discountCents?:number; discountType?:"percent"|"dollar"; discountValue?:number; totalCents:number; paidCents?:number; dueAt?:string|null; shareToken?:string|null; firstViewedAt?:string|null; paymentOverageOpen?:number; createdAt:string };
type CustomerPhoto = { id:string; customerId:string; category:"before"|"after"|"property"; caption?:string; filename:string; contentType:string; sizeBytes:number; createdAt:string };
type CustomerMessage = { id:string; customerId:string; estimateId?:string|null; channel:"contact_recorded"|"followup_snoozed"|"review_snoozed"|"review_check_snoozed"|"text"|"email"|"copy"|"text_prepared"|"email_prepared"|"text_confirmed"|"email_confirmed"|"send_cancelled"; template:string; body:string; createdAt:string };
type AppNotification = { id:string; type:string; title:string; body:string; customerId?:string|null; estimateId?:string|null; invoiceId?:string|null; readAt?:string|null; resolvedAt?:string|null; createdAt:string };
type TaskRow = { id:string; title:string; customerId?:string|null; customer?:string|null; dueAt?:string|null; status:string; notes?:string|null; createdAt:string; completedAt?:string|null };
type ExpenseRow = { id:string; estimateId?:string|null; category:string; description:string; amountCents:number; incurredAt:string; customer?:string|null; service?:string|null };
type PaymentRow = { pendingRefundId?:string|null; pendingRefundAmountCents?:number|null; refundedCents?:number; refundableCents?:number; stripePayment?:number; processingFeeCents?:number|null; grossReceivedCents?:number|null; bundledTipCents?:number|null; processingMethod?:string|null; id:string; estimateId:string; customerId?:string; customer?:string; service?:string; type:string; amountCents:number; status:string; reference?:string|null; createdAt:string };
type JobReportRow = { id:string; estimateId:string; customerId:string; checklist:string; notes?:string; airflowBefore?:string; airflowAfter?:string; status:string; createdAt:string; completedAt?:string|null };

const statusLabel = (value: string) => value.replaceAll("_"," ").replace(/^./,letter=>letter.toUpperCase());
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-US", { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit", timeZone:"America/Chicago" }) : "Not scheduled";
const paymentTypeLabel = (value?: string | null) => value ? value.charAt(0).toUpperCase()+value.slice(1) : "Payment";
const resolvedBillingTotalCents = (estimate: Pick<EstimateRow,"totalCents">&Partial<Pick<EstimateRow,"invoiceTotalCents">>) => estimate.invoiceTotalCents ?? estimate.totalCents;
const billingBalanceCents = (estimate: Pick<EstimateRow,"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"invoiceTotalCents">>) => Math.max(0,resolvedBillingTotalCents(estimate)-estimate.paidCents);
const reviewLink = "https://firstinresponseexteriors.com/review";
const amountDueNow = (estimate: Pick<EstimateRow,"status"|"totalCents"|"depositCents"|"paidCents">&Partial<Pick<EstimateRow,"invoiceTotalCents">>) => {
  const finalInvoiceTotal=estimate.invoiceTotalCents;
  const limit = estimate.status === "completed" ? (finalInvoiceTotal??estimate.totalCents) : ["approved","scheduled"].includes(estimate.status) ? estimate.depositCents : 0;
  return Math.max(0, limit - estimate.paidCents);
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

function MessageComposer({ customer, estimate, initialTemplate="estimate", triggerLabel="Message", triggerClassName, onLogged, onSent }: { customer:CustomerRow; estimate?:CustomerEstimate|EstimateRow|null; initialTemplate?:string; triggerLabel?:string; triggerClassName?:string; onLogged?:(message:CustomerMessage)=>void; onSent?:(message:CustomerMessage,estimateStatus?:string)=>void|Promise<void> }) {
  const [open,setOpen]=useState(false);
  const [template,setTemplate]=useState(initialTemplate);
  const [body,setBody]=useState("");
  const draftEdited=useRef(false);
  const [templates,setTemplates]=useState<FireTemplate[]>(FIRE_TEMPLATES);
  const [shareToken,setShareToken]=useState(estimate?.shareToken||"");
  const [invoiceShareToken,setInvoiceShareToken]=useState(estimate?.invoiceShareToken||"");
  const [siteOrigin,setSiteOrigin]=useState("");
  const [working,setWorking]=useState(false);
  const preparationLock=useRef(false);
  const uncertainPreparation=useRef<{requestId:string;signature:string}|null>(null);
  const [preparedMessage,setPreparedMessage]=useState<CustomerMessage|null>(null);
  const [pendingMessages,setPendingMessages]=useState<CustomerMessage[]>([]);
  const [pendingLoading,setPendingLoading]=useState(false);
  const [pendingError,setPendingError]=useState("");
  const [pendingNextCursor,setPendingNextCursor]=useState<string|null>(null);
  const [pendingOlderLoading,setPendingOlderLoading]=useState(false);
  const [pendingOlderError,setPendingOlderError]=useState("");
  const pendingOlderLock=useRef(false),pendingPageRequest=useRef(0);
  const [messageStatus,setMessageStatus]=useState("");
  const firstName=customer.name.trim().split(/\s+/)[0] || customer.name;
  const service=estimate?.service || "exterior cleaning service";
  const scheduled=estimate?.scheduledAt ? dateTime(estimate.scheduledAt) : "your scheduled time";
  const total=estimate ? money(resolvedBillingTotalCents(estimate)) : "the quoted amount";
  const balance=estimate ? money(billingBalanceCents(estimate)) : "the remaining balance";
  const customerLink=shareToken&&siteOrigin?`${siteOrigin}/estimate/${shareToken}`:"";
  const invoiceLink=invoiceShareToken&&siteOrigin?`${siteOrigin}/invoice/${invoiceShareToken}`:"";
  const variables:Record<string,string>={
    "@customer_first_name":firstName,"@customer_last_name":customer.name.trim().split(/\s+/).slice(1).join(" "),"@customer_name":customer.name,
    "@company_name":"First In Response Exteriors","@service_list":service,"@service_address":(estimate?.address??customer.address)||"the service address",
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
    pendingPageRequest.current++;pendingOlderLock.current=false;
    setPreparedMessage(null);setPendingMessages([]);setPendingError("");
    setPendingNextCursor(null);setPendingOlderLoading(false);setPendingOlderError("");
  },[customer.id,estimate?.id]);
  // Recover only owner-scoped unconfirmed drafts after SMS/Mail switches apps.
  // These are not proof of an actual send or delivery.
  useEffect(()=>{
    if(!open)return;
    let active=true;const request=++pendingPageRequest.current;
    pendingOlderLock.current=false;setPendingOlderLoading(false);setPendingOlderError("");
    setPendingLoading(true);setPendingError("");
    const query=new URLSearchParams({customerId:customer.id,estimateId:estimate?.id??""});
    void (async()=>{
      try{
        const response=await fetch("/api/customer-messages?"+query.toString(),{cache:"no-store"});
        const result=await response.json() as {pending?:CustomerMessage[];nextCursor?:string|null;mayHaveMore?:boolean;error?:string};
        if(!response.ok||!Array.isArray(result.pending))throw Error(result.error||"Unconfirmed messages could not be checked.");
        if(active&&request===pendingPageRequest.current){setPendingNextCursor(typeof result.nextCursor==="string"?result.nextCursor:null);setPendingMessages(result.pending.filter(item=>
          item.customerId===customer.id&&(item.estimateId??"")===(estimate?.id??"")&&
          ["text_prepared","email_prepared"].includes(item.channel)));}
      }catch(reason){if(active&&request===pendingPageRequest.current)setPendingError(reason instanceof Error?reason.message:"Unconfirmed message history is unavailable.");}
      finally{if(active)setPendingLoading(false);}
    })();
    return()=>{active=false;pendingPageRequest.current++;pendingOlderLock.current=false;};
  },[open,customer.id,estimate?.id]);
  useEffect(()=>{
    if(!open)return;
    let active=true;
    void (async()=>{try{const response=await fetch("/api/message-templates");const result=await response.json() as {templates?:FireTemplate[]};if(active&&response.ok&&result.templates)setTemplates(result.templates);}catch{}})();
    return()=>{active=false;};
  },[open]);
  useEffect(()=>{
    if(!open||!estimate||shareToken||!needsEstimateLink)return;
    let active=true;
    void (async()=>{try{const response=await fetch(`/api/estimates/${estimate.id}/share`,{method:"POST"});const result=await response.json() as {shareToken?:string};if(active&&response.ok&&result.shareToken)setShareToken(result.shareToken);}catch{}})();
    return()=>{active=false;};
  },[open,estimate,shareToken,needsEstimateLink]);
  useEffect(()=>{
    if(!open||!estimate?.invoiceId||invoiceShareToken||!needsInvoiceLink)return;
    let active=true;
    void (async()=>{try{const response=await fetch(`/api/invoices/${estimate.invoiceId}/share`,{method:"POST"});const result=await response.json() as {shareToken?:string};if(active&&response.ok&&result.shareToken)setInvoiceShareToken(result.shareToken);}catch{}})();
    return()=>{active=false;};
  },[open,estimate,invoiceShareToken,needsInvoiceLink]);
  useEffect(()=>{if(open&&!draftEdited.current)setBody(renderedBody);},[open,renderedBody]);
  const loadOlderPendingMessages=async()=>{
    const cursor=pendingNextCursor;
    if(!open||!cursor||pendingOlderLock.current||pendingOlderLoading||pendingLoading||working)return;
    pendingOlderLock.current=true;
    const page=++pendingPageRequest.current,scopeCustomer=customer.id,scopeJob=estimate?.id??"";
    setPendingOlderLoading(true);setPendingOlderError("");
    try{
      const query=new URLSearchParams({customerId:scopeCustomer,estimateId:scopeJob,cursor});
      const response=await fetch("/api/customer-messages?"+query.toString(),{cache:"no-store"});
      const result=await response.json() as {pending?:CustomerMessage[];nextCursor?:string|null;mayHaveMore?:boolean;error?:string};
      if(!response.ok||!Array.isArray(result.pending)||Boolean(result.mayHaveMore)&&typeof result.nextCursor!=="string")
        throw Error(result.error||"Older prepared messages could not be verified.");
      if(page!==pendingPageRequest.current)return;
      const verified=result.pending.filter(item=>
        item.customerId===scopeCustomer&&(item.estimateId??"")===scopeJob&&
        ["text_prepared","email_prepared"].includes(item.channel));
      if(verified.length!==result.pending.length)throw Error("Older message scope could not be verified.");
      setPendingMessages(current=>{
        const ids=new Set(current.map(item=>item.id));
        return [...current,...verified.filter(item=>{if(ids.has(item.id))return false;ids.add(item.id);return true;})];
      });
      setPendingNextCursor(typeof result.nextCursor==="string"?result.nextCursor:null);
    }catch(reason){
      if(page===pendingPageRequest.current)setPendingOlderError(reason instanceof Error?reason.message:"Older prepared messages are unavailable.");
    }finally{
      if(page===pendingPageRequest.current){pendingOlderLock.current=false;setPendingOlderLoading(false);}
    }
  };
  const chooseTemplate=(value:string)=>{
    if(value===template)return;
    if(draftEdited.current&&!window.confirm("Replace your edited message with another template?"))return;
    draftEdited.current=false;setTemplate(value);setBody("");
  };
  const log=async(channel:"text_prepared"|"email_prepared"|"copy")=>{
    if(preparationLock.current)return false;
    const payload={customerId:customer.id,estimateId:estimate?.id,channel,template,body};
    const signature=JSON.stringify(payload);
    if(uncertainPreparation.current&&uncertainPreparation.current.signature!==signature){
      setMessageStatus("A previous message preparation is unconfirmed. Restore its original text and retry the same request, or reopen saved drafts to verify it first.");
      return false;
    }
    if(!uncertainPreparation.current)uncertainPreparation.current={requestId:crypto.randomUUID(),signature};
    const operation=uncertainPreparation.current;
    preparationLock.current=true;setWorking(true);
    try{
      const response=await fetch("/api/customer-messages",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,requestId:operation.requestId})});
      const result=await response.json() as {message?:CustomerMessage;error?:string};
      const saved=result.message;
      if(!response.ok||!saved){
        setMessageStatus(result.error||"Message preparation is unconfirmed. Retry the unchanged draft using the same request.");
        return false;
      }
      if(saved.id!=="owner-message-prep:"+operation.requestId||saved.customerId!==customer.id||
        (saved.estimateId??"")!==(estimate?.id??"")||saved.channel!==channel||saved.template!==template||saved.body!==body){
        setMessageStatus("The saved message receipt does not match this preparation. Review saved drafts before trying again.");
        return false;
      }
      uncertainPreparation.current=null;
      onLogged?.(saved);
      if(channel!=="copy"){setPreparedMessage(saved);setPendingMessages(current=>[saved,...current.filter(item=>item.id!==saved.id)]);}
      setMessageStatus(channel==="copy"?"Copied; sending is not confirmed.":"Prepared — sending is not confirmed. Return here after sending to confirm.");
      return true;
    }catch{
      setMessageStatus("Message preparation may already be saved. Retry the unchanged draft with the same request or reopen saved drafts.");
      return false;
    }finally{preparationLock.current=false;setWorking(false);}
  };
  const sendText=async()=>{if(!await log("text_prepared"))return;window.location.href=`sms:${customer.phone}&body=${encodeURIComponent(body)}`;};
  const sendEmail=async()=>{if(!await log("email_prepared"))return;window.location.href=`mailto:${customer.email}?subject=${encodeURIComponent(renderedSubject)}&body=${encodeURIComponent(body)}`;};
  const confirmSent=async()=>{
    if(!preparedMessage)return;setWorking(true);setMessageStatus("");
    try{const response=await fetch("/api/customer-messages",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({preparedMessageId:preparedMessage.id,customerId:customer.id,ownerConfirmedSent:true})});const result=await response.json() as {message?:CustomerMessage;estimateStatus?:string;error?:string};if(!response.ok||!result.message)throw new Error(result.error||"Send confirmation could not be saved.");onLogged?.(result.message);setPreparedMessage(null);setPendingMessages(current=>current.filter(item=>item.id!==preparedMessage.id));setMessageStatus("Sent — confirmed by you. Delivery and read status are unknown.");if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));if(preparedMessage.template===initialTemplate)await onSent?.(result.message,result.estimateStatus);}catch(error){setMessageStatus(error instanceof Error?error.message:"Send confirmation could not be saved.");}finally{setWorking(false);}
  };
  const cancelPrepared=async()=>{
    if(!preparedMessage||working||!window.confirm("Mark this prepared message as NOT sent? It will leave your pending list but stay in the customer audit history."))return;
    const draft=preparedMessage;
    setWorking(true);setMessageStatus("");
    try{
      const response=await fetch("/api/customer-messages",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({preparedMessageId:draft.id,customerId:customer.id,ownerConfirmedNotSent:true})});
      const result=await response.json() as {message?:CustomerMessage;cancelled?:boolean;error?:string};
      if(!response.ok||result.cancelled!==true||result.message?.id!==draft.id+":owner-cancelled"||result.message.customerId!==customer.id)
        throw Error(result.error||"Could not verify that the unsent message was discarded. Refresh its saved status.");
      onLogged?.(result.message);
      setPendingMessages(current=>current.filter(item=>item.id!==draft.id));
      setPreparedMessage(null);draftEdited.current=false;setBody(renderedBody);
      setMessageStatus("Marked not sent. Removed from pending messages; original draft remains in customer history.");
      if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
    }catch(err){setMessageStatus(err instanceof Error?err.message:"Cannot confirm that the unsent draft was discarded.");}
    finally{setWorking(false);}
  };
  const copy=async()=>{try{await navigator.clipboard.writeText(body);await log("copy");}catch{setMessageStatus("Copy failed. No sending is confirmed.");}};
  return <Dialog open={open} onOpenChange={(value)=>{setOpen(value);if(value){setSiteOrigin(window.location.origin);}}}>
    <DialogTrigger asChild><Button variant="outline" className={triggerClassName}><MessageSquareText className="h-4 w-4" /> {triggerLabel}</Button></DialogTrigger>
    <DialogContent className="message-dialog sm:max-w-[620px]">
      <DialogHeader><DialogTitle>Message {customer.name}</DialogTitle></DialogHeader>
      <div className="message-builder">
        {messageStatus&&<p role="status">{messageStatus}</p>}
        {!preparedMessage&&pendingLoading&&<p role="status">Checking saved unconfirmed messages…</p>}
        {!preparedMessage&&pendingError&&<p role="alert">{pendingError} Sending is not confirmed.</p>}
        {!preparedMessage&&pendingMessages.length>0&&<section aria-label="Saved unconfirmed messages" className="rounded-lg border p-3">
          <strong>Saved messages awaiting confirmation ({pendingMessages.length})</strong>
          <p className="text-sm">After returning from Messages or Mail, resume the exact prepared message. Only confirm if you actually sent it.</p>
          <div className="flex flex-col gap-2">{pendingMessages.map(item=><Button key={item.id} variant="outline" disabled={working} onClick={()=>{
            draftEdited.current=true;setTemplate(item.template);setBody(item.body);
            setPreparedMessage(item);setMessageStatus("Recovered an unconfirmed prepared message. Check the text before confirming a send.");
          }}>Resume {item.channel==="text_prepared"?"text":"email"} · {new Date(item.createdAt).toLocaleString()} · {item.template}</Button>)}</div>
          {pendingNextCursor&&<Button variant="outline" disabled={pendingOlderLoading||working} onClick={()=>void loadOlderPendingMessages()}>{pendingOlderLoading?"Loading older drafts…":"Load older prepared messages"}</Button>}
          {pendingOlderError&&<p role="alert">{pendingOlderError} Previously loaded drafts remain available.</p>}
        </section>}
        {!preparedMessage&&pendingMessages.length===0&&pendingNextCursor&&<Button variant="outline" onClick={()=>void loadOlderPendingMessages()} disabled={pendingOlderLoading}>{pendingOlderLoading?"Loading older drafts…":"Load older prepared messages"}</Button>}
        {preparedMessage&&<div><p>After sending the prepared {preparedMessage.channel=== "text_prepared"?"text":"email"}, confirm here. Opening the other app does not send it.</p><Button variant="outline" onClick={()=>void confirmSent()} disabled={working}>I sent the prepared message</Button><Button variant="outline" disabled={working} onClick={()=>{draftEdited.current=true;setBody(preparedMessage.body);setTemplate(preparedMessage.template);setPreparedMessage(null);setMessageStatus("Sending remains unconfirmed. You can keep editing.");}}>Not sent — keep editing</Button><Button variant="outline" disabled={working} onClick={()=>void cancelPrepared()}>Discard unsent draft</Button></div>}
        <div><Label>Message type</Label><Select value={preparedMessage?.template??template} onValueChange={chooseTemplate} disabled={working||Boolean(preparedMessage)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{composerTemplates.map((item)=><SelectItem key={item.key} value={item.key}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="customerMessage">Personalized message</Label><Textarea id="customerMessage" disabled={working||Boolean(preparedMessage)} value={preparedMessage?.body??body} onChange={(event)=>{draftEdited.current=true;setBody(event.target.value);}} rows={8}/><small>Customer, service, price, date, address, and the private estimate or invoice link are filled in automatically when available. You can edit anything before sending.</small></div>
        <div className="message-actions"><Button variant="outline" onClick={()=>void copy()} disabled={working||Boolean(preparedMessage)||!body.trim()}><Copy className="h-4 w-4"/> Copy</Button>{customer.email&&activeTemplate?.channel!=="sms"&&<Button variant="outline" onClick={()=>void sendEmail()} disabled={working||Boolean(preparedMessage)||!body.trim()}><Mail className="h-4 w-4"/> Email</Button>}{customer.phone&&activeTemplate?.channel!=="email"&&<Button className="brand-button" onClick={()=>void sendText()} disabled={working||Boolean(preparedMessage)||!body.trim()}><Send className="h-4 w-4"/> Text</Button>}</div>
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
  const [beforeId,setBeforeId]=useState("");
  const [afterId,setAfterId]=useState("");
  const [comparing,setComparing]=useState(false);
  const [error,setError]=useState("");
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [uncertain,setUncertain]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const mutationLock=useRef(false);
  const refreshPhotos=async()=>{
    setRefreshing(true);setReviewed(false);
    try{
      const response=await fetch('/api/customers',{cache:'no-store'});const result=await response.json() as {photos?:CustomerPhoto[]};
      if(!response.ok||!Array.isArray(result.photos)||result.photos.some(photo=>!photo||typeof photo.id!=='string'||typeof photo.customerId!=='string'))throw Error('Photo records could not be refreshed. No photo action was retried.');
      const own=result.photos.filter(photo=>photo.customerId===customer.id);
      if(new Set(own.map(photo=>photo.id)).size!==own.length)throw Error('Photo records could not be verified.');
      setPhotos(current=>[...current.filter(photo=>photo.customerId!==customer.id),...own]);setReviewed(true);
    }catch(refreshError){setError(current=>(current?current+' ':'')+(refreshError instanceof Error?refreshError.message:'Photo records unavailable.'));}
    finally{setRefreshing(false);}
  };
  const upload=async(files:FileList|null)=>{
    if(!files?.length||mutationLock.current||uncertain||refreshing)return;
    mutationLock.current=true;
    setUploading(true);setError("");
    let safelyRejected=false;
    try{
      for(const file of Array.from(files)){
        const form=new FormData();form.append("customerId",customer.id);form.append("category",category);form.append("caption",caption);form.append("photo",file);
        const response=await fetch("/api/customer-photos",{method:"POST",body:form});
        const result=await response.json() as {photo?:CustomerPhoto;error?:string;saveUncertain?:boolean};
        if(!response.ok||!result.photo){safelyRejected=response.status>=400&&response.status<500&&!result.saveUncertain;throw new Error(result.error||'Photo upload was not confirmed.');}
        if(result.photo.customerId!==customer.id||typeof result.photo.id!=='string')throw new Error('Photo save receipt could not be verified.');
        setPhotos((current)=>[result.photo!,...current]);
      }
      setCaption("");
    }catch(uploadError){if(!safelyRejected)setUncertain(true);setError(uploadError instanceof Error?uploadError.message:'Photo upload was not confirmed.');await refreshPhotos();}
    finally{mutationLock.current=false;setUploading(false);if(cameraRef.current)cameraRef.current.value="";if(libraryRef.current)libraryRef.current.value="";}
  };
  const remove=async(photo:CustomerPhoto)=>{
    if(mutationLock.current||uncertain||refreshing||!window.confirm(`Delete this ${photo.category} photo?`))return;
    mutationLock.current=true;setDeletingId(photo.id);setError('');let safelyRejected=false;
    try{
      const response=await fetch(`/api/customer-photos/${photo.id}`,{method:'DELETE'});
      const result=await response.json() as {ok?:boolean;error?:string;deleteUncertain?:boolean;cleanupUncertain?:boolean};
      if(!response.ok||result.ok!==true){safelyRejected=response.status>=400&&response.status<500&&!result.deleteUncertain&&!result.cleanupUncertain;throw Error(result.error||'Photo deletion was not confirmed.');}
      setPhotos(current=>current.filter(item=>item.id!==photo.id));
    }catch(deleteError){if(!safelyRejected)setUncertain(true);setError(deleteError instanceof Error?deleteError.message:'Photo deletion was not confirmed.');await refreshPhotos();}
    finally{mutationLock.current=false;setDeletingId(null);}
  };
  const own=photos.filter((photo)=>photo.customerId===customer.id);
  const beforePhotos=own.filter((photo)=>photo.category==="before");
  const afterPhotos=own.filter((photo)=>photo.category==="after");
  const selectedBefore=beforePhotos.find((photo)=>photo.id===(beforeId||beforePhotos[0]?.id));
  const selectedAfter=afterPhotos.find((photo)=>photo.id===(afterId||afterPhotos[0]?.id));
  const createComparison=async()=>{
    if(!selectedBefore||!selectedAfter)return;
    setComparing(true);setError("");
    try{
      const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("A selected photo could not be loaded."));image.src=src;});
      const [before,after]=await Promise.all([load(`/api/customer-photos/${selectedBefore.id}`),load(`/api/customer-photos/${selectedAfter.id}`)]);
      const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=980;
      const context=canvas.getContext("2d");if(!context)throw new Error("Comparison image is unavailable on this device.");
      const drawCover=(image:HTMLImageElement,x:number,y:number,width:number,height:number)=>{const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);const drawWidth=image.naturalWidth*scale;const drawHeight=image.naturalHeight*scale;context.drawImage(image,x+(width-drawWidth)/2,y+(height-drawHeight)/2,drawWidth,drawHeight);};
      context.fillStyle="#0e1b2d";context.fillRect(0,0,1600,980);drawCover(before,0,0,796,870);drawCover(after,804,0,796,870);
      context.fillStyle="rgba(14,27,45,.86)";context.fillRect(0,0,796,70);context.fillRect(804,0,796,70);
      context.fillStyle="#fff";context.font="700 30px system-ui, sans-serif";context.textAlign="center";context.fillText("BEFORE",398,46);context.fillText("AFTER",1202,46);
      context.textAlign="left";context.font="700 28px system-ui, sans-serif";context.fillText("FIRST IN RESPONSE EXTERIORS",38,930);
      context.textAlign="right";context.font="500 22px system-ui, sans-serif";context.fillStyle="#c7d0dc";context.fillText(customer.name,1562,930);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((value)=>value?resolve(value):reject(new Error("Comparison image could not be created.")),"image/png"));
      const safeName=customer.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||"customer";
      const file=new File([blob],`${safeName}-before-after.png`,{type:"image/png"});
      if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`${customer.name} before and after`,files:[file]});}
      else{const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=file.name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
    }catch(compareError){if(compareError instanceof Error&&compareError.name!=="AbortError")setError(compareError.message||"Comparison image could not be created.");}
    finally{setComparing(false);}
  };
  return <div className="photo-panel">
    <div className="photo-toolbar">
      <div><Label>Photo type</Label><Select value={category} onValueChange={(value)=>setCategory(value as typeof category)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="before">Before</SelectItem><SelectItem value="after">After</SelectItem><SelectItem value="property">Property / damage</SelectItem></SelectContent></Select></div>
      <div className="photo-caption"><Label htmlFor="photoCaption">Optional note</Label><Input id="photoCaption" value={caption} onChange={(event)=>setCaption(event.target.value)} placeholder="North siding, cracked outlet cover…"/></div>
      <div className="photo-buttons"><Button className="brand-button" onClick={()=>cameraRef.current?.click()} disabled={uploading||Boolean(deletingId)||uncertain||refreshing}><Camera className="h-4 w-4"/>{uploading?"Uploading…":"Camera"}</Button><Button variant="outline" onClick={()=>libraryRef.current?.click()} disabled={uploading||Boolean(deletingId)||uncertain||refreshing}><Images className="h-4 w-4"/>Photo library</Button></div>
      <input ref={cameraRef} className="photo-input" type="file" accept="image/*" capture="environment" onChange={(event)=>void upload(event.target.files)}/>
      <input ref={libraryRef} className="photo-input" type="file" accept="image/*" multiple onChange={(event)=>void upload(event.target.files)}/>
    </div>
    {error&&<p className="save-error" role="alert">{error}</p>}
    {uncertain&&<section className="space-y-2" aria-label="Unconfirmed photo action"><p role="status">The photo action was not confirmed. Upload and delete actions are paused; no automatic retry was made.</p><Button variant="outline" disabled={refreshing||uploading||Boolean(deletingId)} onClick={()=>void refreshPhotos()}>Review stored photos</Button>{reviewed&&<><p>Stored photo records were refreshed. Image-storage cleanup may still require separate review.</p><Button variant="outline" disabled={refreshing||uploading||Boolean(deletingId)} onClick={()=>{if(window.confirm('I reviewed the refreshed photo records. Any unconfirmed image-storage cleanup will be handled separately. Enable new deliberate photo actions?')){setUncertain(false);setReviewed(false);}}}>Continue after reviewing photos</Button></>}</section>}
    {beforePhotos.length>0&&afterPhotos.length>0&&<section className="before-after-builder"><header><div><strong>Before &amp; after</strong><p>Pair two real job photos into one shareable image.</p></div><Images/></header><div><label><span>Before photo</span><Select value={selectedBefore?.id} onValueChange={setBeforeId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{beforePhotos.map((photo)=><SelectItem key={photo.id} value={photo.id}>{photo.caption||`${new Date(photo.createdAt).toLocaleDateString()} · ${photo.filename}`}</SelectItem>)}</SelectContent></Select></label><label><span>After photo</span><Select value={selectedAfter?.id} onValueChange={setAfterId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{afterPhotos.map((photo)=><SelectItem key={photo.id} value={photo.id}>{photo.caption||`${new Date(photo.createdAt).toLocaleDateString()} · ${photo.filename}`}</SelectItem>)}</SelectContent></Select></label><Button className="brand-button" onClick={()=>void createComparison()} disabled={comparing}><Download className="h-4 w-4"/>{comparing?"Creating…":"Create comparison"}</Button></div><div className="before-after-preview"><figure><img src={`/api/customer-photos/${selectedBefore?.id}`} alt="Selected before"/><figcaption>Before</figcaption></figure><figure><img src={`/api/customer-photos/${selectedAfter?.id}`} alt="Selected after"/><figcaption>After</figcaption></figure></div></section>}
    {own.length?<div className="photo-groups">{(["before","after","property"] as const).map((type)=>{const group=own.filter((photo)=>photo.category===type);if(!group.length)return null;return <section key={type}><header><strong>{type==="property"?"Property / damage":statusLabel(type)}</strong><span>{group.length}</span></header><div className="photo-grid">{group.map((photo)=><article className="photo-card" key={photo.id}><a href={`/api/customer-photos/${photo.id}`} target="_blank" rel="noreferrer"><img src={`/api/customer-photos/${photo.id}`} alt={`${statusLabel(photo.category)} photo${photo.caption?`: ${photo.caption}`:""}`} loading="lazy"/></a><div><p>{photo.caption||photo.filename}</p><small>{new Date(photo.createdAt).toLocaleDateString()}</small></div><button disabled={uploading||Boolean(deletingId)||uncertain||refreshing} onClick={()=>void remove(photo)} aria-label="Delete photo"><Trash2/></button></article>)}</div></section>})}</div>:<div className="record-empty"><Camera/><strong>No property photos yet</strong><p>Choose Before, After, or Property / damage, then use your camera or photo library.</p></div>}
  </div>;
}

type DiscountMode = "percent" | "dollar";
type EditableEstimateItem={id?:string;serviceId:string;name:string;description:string;quantity:number;unit:string;unitRateCents:number;preservedLineTotalCents?:number};

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

function NewEstimate({ onSaved, customer,disabledReason,propertySelection,onClosed }: { onSaved?: (estimate: EstimateRow) => void; customer?: CustomerRow;disabledReason?:string;propertySelection?:PropertyEstimateSelection|null;propertyWorkflowReady?:boolean;onClosed?:()=>void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedCustomer,setSelectedCustomer]=useState<LookupCustomer|null>(customer??null);
  const [customerMode,setCustomerMode]=useState<'lookup'|'existing'|'new'>(customer?'existing':'lookup');
  const [customerLoading,setCustomerLoading]=useState(false),[identityConfirmed,setIdentityConfirmed]=useState(false);
  const customerRequest=useRef(0);
  const [propertyWorkflowReady,setPropertyWorkflowReady]=useState(false);
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
  const [estimateProperty,setEstimateProperty]=useState<PropertyEstimateSelection|null>(null);
  const [propertyBlocked,setPropertyBlocked]=useState(Boolean(customer));
  const [propertyRefresh,setPropertyRefresh]=useState(0);
  const [forcePropertyReview,setForcePropertyReview]=useState(false);
  const [uncertainSave,setUncertainSave]=useState(false);
  const saveLock=useRef(false);
  const [reviewedRecords,setReviewedRecords]=useState<EstimateRow[]>([]);
  const [reviewingRecords,setReviewingRecords]=useState(false);
  const [savedReceipt,setSavedReceipt]=useState<{address:string;total:number;deposit:number}|null>(null);
  const acceptProperty=useCallback((selection:PropertyEstimateSelection|null)=>{
    if(selection&&selection.property.customerId!==selectedCustomer?.id){setEstimateProperty(null);setPropertyBlocked(true);return;}
    setEstimateProperty(selection);
  },[selectedCustomer?.id]);
  const chooseCustomer=async(input:LookupCustomer|null,initial=false)=>{
    if(saving||uncertainSave)return;
    if(!initial&&hasUnsavedChanges&&!window.confirm('Switch customer? This discards the unfinished estimate, including customer information, property choices, services, prices and discounts. Choose Cancel to keep all changes.'))return;
    const generation=++customerRequest.current;setCustomerLoading(true);setError('');
    try{
      let fresh:LookupCustomer|null=null;
      if(input){const response=await fetch('/api/customers/lookup?customerId='+encodeURIComponent(input.id),{cache:'no-store'});const data=await response.json() as {customer?:unknown;error?:string};if(!response.ok||!validLookupCustomer(data.customer)||data.customer.id!==input.id)throw Error(data.error||'Selected customer could not be verified.');fresh=data.customer;}
      if(generation!==customerRequest.current)return;
      if(!initial){setItems([{serviceId:'',name:'',description:'',quantity:0,unit:'unit',unitRateCents:0}]);setAppreciationDiscount(false);setDiscountMode('percent');setDiscountValue('');}
      setSelectedCustomer(fresh);setCustomerMode(fresh?'existing':'new');setCustomerName(fresh?.name??'');setEmail(fresh?.email??'');setPhone(fresh?.phone??'');setAddress(fresh?.address??'');
      setEstimateProperty(null);setPropertyBlocked(Boolean(fresh));setPropertyWorkflowReady(false);setForcePropertyReview(!initial);setPropertyRefresh(count=>count+1);setIdentityConfirmed(true);setStep(1);
    }catch(err){if(generation===customerRequest.current){setIdentityConfirmed(false);setError(err instanceof Error?err.message:'Customer verification failed.');}}
    finally{if(generation===customerRequest.current)setCustomerLoading(false);}
  };
  const resolvedAddress=estimateProperty&&estimateProperty.property.customerId===selectedCustomer?.id?estimateProperty.property.address+(estimateProperty.property.designation?' · '+estimateProperty.property.designation:''):address;
  const reviewStored=async()=>{setReviewingRecords(true);try{const response=await fetch('/api/customers');const data=await response.json() as {estimates?:EstimateRow[]};if(!response.ok||!Array.isArray(data.estimates))throw Error('Stored estimates could not be read.');setReviewedRecords(data.estimates.filter(row=>selectedCustomer?row.customerId===selectedCustomer.id:true));}catch(e){setError(e instanceof Error?e.message:'Stored estimates unavailable.');}finally{setReviewingRecords(false);}};
  const subtotal=items.reduce((sum,item)=>sum+editableLineTotalCents(item),0);
  const discount=discountMath(subtotal,appreciationDiscount,discountMode,Number(discountValue));
  const total=discount.total;
  const deposit=discount.deposit;
  const updateItem=(index:number,patch:Partial<EditableEstimateItem>)=>setItems((current)=>current.map((item,i)=>i===index?editMoneyLine(item,patch):item));
  const addService=()=>setItems((current)=>[...current,{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);

  const saveEstimate = async () => {
    if(saveLock.current||saving||uncertainSave)return;
    if(customerMode==='lookup'||!identityConfirmed||customerLoading){setStep(1);setError('Select a saved customer or choose Create New Customer.');return;}
    if(estimateProperty&&estimateProperty.property.customerId!==selectedCustomer?.id){setStep(1);setPropertyBlocked(true);setError('The service property does not belong to this customer. Review their properties again.');return;}
    if(selectedCustomer&&propertyBlocked){setStep(1);setError('Review and select an active service property before saving.');return;}
    if(!customerName.trim()){setStep(1);setError("Customer name is required.");return;}
    if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitRateCents)||item.unitRateCents<0)){setStep(2);setError("Every service needs a service, quantity, and valid price.");return;}
    const maxPercent=appreciationDiscount?45:50;
    if(discountMode==="percent"&&(Number(discountValue)||0)>maxPercent){setError(`Additional percentage discount cannot exceed ${maxPercent}% with the current appreciation-discount setting.`);return;}
    if(discountMode==="dollar"&&Math.round((Number(discountValue)||0)*100)>subtotal){setError("Dollar discount cannot exceed the service subtotal.");return;}
    saveLock.current=true;setSaving(true);setError("");
    let safelyRejected=false;
    try {
      const payloadItems=items.map((item)=>({name:item.name,description:item.description,quantity:item.quantity,unit:item.unit,totalCents:editableLineTotalCents(item)}));
      const response = await fetch("/api/estimates", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer?.id, customerLookupSelection:Boolean(selectedCustomer), customer: customerName.trim(), email:email.trim(), phone:phone.trim(), address:resolvedAddress.trim(), ...(propertyWorkflowReady&&estimateProperty?{propertyId:estimateProperty.property.id,propertyRevision:estimateProperty.property.revision,propertySelectionMode:estimateProperty.mode}:{}), items:payloadItems, appreciationDiscount, additionalDiscountType:discountMode, additionalDiscountValue:discountMode==="percent"?Math.round((Number(discountValue)||0)*100):Math.round((Number(discountValue)||0)*100) }),
      });
      const result = await response.json() as { id?: string; customerId?:string; shareToken?:string; subtotalCents?:number;discountCents?:number;totalCents?:number;depositCents?:number;address?:string;propertyId?:string|null;propertyRevision?:number|null;error?: string };
      if(!response.ok){
        safelyRejected=response.status>=400&&response.status<500;
        if(response.status>=500)setUncertainSave(true);
        else if(response.status===409){setStep(1);if(selectedCustomer)setIdentityConfirmed(false);setForcePropertyReview(true);setEstimateProperty(null);setPropertyBlocked(true);setPropertyRefresh(value=>value+1);}
        throw new Error(result.error||'The estimate could not be saved.');
      }
      if(typeof result.id!=='string'||!result.id||typeof result.customerId!=='string'||typeof result.address!=='string'||selectedCustomer&&result.customerId!==selectedCustomer.id||propertyWorkflowReady&&estimateProperty&&(result.propertyId!==estimateProperty.property.id||result.propertyRevision!==estimateProperty.property.revision)){setUncertainSave(true);throw new Error('Save receipt could not be verified. Review stored estimates before another attempt.');}
      const confirmedAddress=typeof result.address==='string'?result.address:resolvedAddress.trim();
      setSavedReceipt({address:confirmedAddress,total:Number(result.totalCents??total),deposit:Number(result.depositCents??deposit)});
      const createdAt = new Date().toISOString();
      onSaved?.({ id: result.id, customerId: result.customerId, customer: customerName.trim(), email:email.trim(), phone:phone.trim(), address:confirmedAddress,propertyId:result.propertyId,propertyRevision:result.propertyRevision,serviceAddressSource:result.propertyId?'captured':undefined, service: items.map((item)=>item.name).join(", "), serviceDescription:items[0]?.description||"", items:payloadItems.map((item,index)=>({...item,id:`new-${index}`})), status: "draft", subtotalCents:Number(result.subtotalCents??subtotal), discountCents:Number(result.discountCents??discount.appliedDiscount), appreciationDiscount, additionalDiscountType:discountMode, additionalDiscountValue:discountMode==="percent"?Math.round((Number(discountValue)||0)*100):Math.round((Number(discountValue)||0)*100), totalCents: Number(result.totalCents??total), depositCents: Number(result.depositCents??deposit), paidCents: 0, shareToken:result.shareToken, createdAt });
      setSaved(true);
    } catch (saveError) { if(!safelyRejected)setUncertainSave(true);setError(saveError instanceof Error ? saveError.message : "The estimate could not be saved. Please try again."); }
    finally { setSaving(false);saveLock.current=false; }
  };

  const initialItem = {serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0};
  const hasUnsavedChanges = !saved && ((selectedCustomer?.id??null)!==(customer?.id??null) || Boolean(estimateProperty&&estimateProperty.property.id!==propertySelection?.property.id) || customerName !== (customer?.name??"") || email !== (customer?.email??"")
    || phone !== (customer?.phone??"") || address !== (customer?.address??"")
    || JSON.stringify(items) !== JSON.stringify([initialItem]) || appreciationDiscount || discountMode !== "percent" || discountValue !== "");
  const reset = (value: boolean) => {
    if (!value && saving) return; // A pending response must finish before the dialog can close.
    if (!value && (hasUnsavedChanges||uncertainSave) && !window.confirm(uncertainSave?"Save was not confirmed. Closing does not cancel a possibly saved estimate. Review stored estimates before creating another. Close this draft?":"Discard this unfinished estimate? Customer details, services, quantities, prices and discounts will be lost. Choose Cancel to keep editing.")) return;
    if(value){setIdentityConfirmed(false);setForcePropertyReview(false);setEstimateProperty(null);setPropertyBlocked(Boolean(customer));setPropertyRefresh(count=>count+1);if(customer)void chooseCustomer(customer,true);else{setCustomerMode('lookup');setSelectedCustomer(null);}}
    setOpen(value);
    if (!value) {
      customerRequest.current++;setCustomerLoading(false);setIdentityConfirmed(false);setSelectedCustomer(customer??null);setCustomerMode(customer?'existing':'lookup');setPropertyWorkflowReady(false);setEstimateProperty(null);
      onClosed?.();
      // No delayed reset: reopening cannot be wiped by a timer from the prior dialog.
      setStep(1);setSaved(false);setSavedReceipt(null);setUncertainSave(false);setReviewedRecords([]);setError("");setItems([initialItem]);setAppreciationDiscount(false);setDiscountMode("percent");setDiscountValue("");
      setCustomerName(customer?.name??"");setEmail(customer?.email??"");setPhone(customer?.phone??"");setAddress(customer?.address??"");
    }
  };

  return <Dialog open={open} onOpenChange={reset}>
    <DialogTrigger asChild><Button className="brand-button" title={disabledReason}><Plus className="h-4 w-4" /> New estimate</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined} className="max-h-[92vh] overflow-y-auto border-0 p-0 sm:max-w-[620px]">
      <div className="estimate-head"><DialogHeader><DialogTitle className="text-xl">Create estimate</DialogTitle></DialogHeader><p className="mt-1 text-sm text-slate-500">Step {step} of 2 · {step===1?"Customer details":"Services and pricing"}</p><Progress value={step*50} className="mt-4 h-1.5"/></div>
      {saved?<div className="px-6 py-12 text-center"><span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-8 w-8"/></span><h2 className="text-2xl font-extrabold">Estimate ready</h2><p className="mx-auto mt-2 max-w-sm text-slate-500">{money(savedReceipt?.total??total)} total. A {money(savedReceipt?.deposit??deposit)} (50%) deposit reserves the customer&apos;s place on the schedule; the remaining balance is due when the work is completed.</p><p className="mt-3" data-saved-service-address>{savedReceipt?.address}</p><div className="mt-7 flex justify-center"><Button className="brand-button" onClick={()=>reset(false)}>Done</Button></div></div>
      :step===1?<div className="space-y-5 px-6 py-6">
        <CustomerLookup disabled={saving||uncertainSave||customerLoading} onSelect={row=>void chooseCustomer(row)} onCreate={()=>void chooseCustomer(null)}/>
        {customerLoading&&<p role="status">Checking saved customer information…</p>}
        {customerMode==='lookup'?<p>Select a matching customer explicitly, or choose + Create New Customer.</p>:<>
          <p role="status">{selectedCustomer?'Using saved customer — linked to their existing history.':'Creating a new customer with this estimate.'}</p>
          <div className="grid gap-2"><Label htmlFor="estimate-customer-name">Customer name</Label><Input id="estimate-customer-name" placeholder="Full name" value={customerName} onChange={event=>setCustomerName(event.target.value)} readOnly={Boolean(selectedCustomer)}/></div>
          <div className="grid gap-2"><Label htmlFor="estimate-customer-email">Email</Label><Input id="estimate-customer-email" type="email" placeholder="customer@email.com" value={email} onChange={event=>setEmail(event.target.value)} readOnly={Boolean(selectedCustomer)}/></div>
          <div className="grid gap-2"><Label htmlFor="estimate-customer-phone">Phone</Label><Input id="estimate-customer-phone" inputMode="tel" placeholder="(918) 555-0123" value={phone} onChange={event=>setPhone(event.target.value)} readOnly={Boolean(selectedCustomer)}/></div>
          <div className="grid gap-2"><Label htmlFor="estimate-customer-address">Service address</Label><Input id="estimate-customer-address" aria-label="Estimate service address" placeholder="Tulsa-area address" value={resolvedAddress} onChange={event=>setAddress(event.target.value)} readOnly={Boolean(selectedCustomer)}/></div>
        </>}
        {selectedCustomer&&open&&!uncertainSave&&<CustomerProperties key={selectedCustomer.id+'-'+propertyRefresh} customerId={selectedCustomer.id} onRecordsChange={setPropertyBlocked} onSelectionChange={acceptProperty} onWorkflowChange={setPropertyWorkflowReady} initialPropertyId={!forcePropertyReview&&selectedCustomer.id===customer?.id?propertySelection?.property.id:undefined} compact/>}
        {error&&<p className="save-error" role="alert">{error}</p>}
        {selectedCustomer&&!identityConfirmed&&!customerLoading&&<Button variant="outline" onClick={()=>void chooseCustomer(selectedCustomer,true)}>Refresh selected customer</Button>}
        <Button className="brand-button w-full" disabled={customerMode==='lookup'||!identityConfirmed||customerLoading||Boolean(selectedCustomer)&&propertyBlocked||uncertainSave} onClick={()=>{if(!customerName.trim()){setError('Customer name is required.');return;}setError('');setStep(2);}}>Continue to services <ChevronRight className="h-4 w-4"/></Button>
      </div>
      :<div className="space-y-5 px-6 py-6">
        <div className="estimate-edit-items">{items.map((item,index)=><section className="estimate-edit-service" key={item.id||index}><header><strong>Service {index+1}</strong>{items.length>1&&<button type="button" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove service ${index+1}`}><Trash2/></button>}</header>
          <div><Label>Service</Label><Select value={item.serviceId} onValueChange={(value)=>{const svc=services.find((entry)=>entry.id===value);if(!svc)return;updateItem(index,{serviceId:value,name:svc.name,description:svc.description,unit:svc.unit,unitRateCents:svc.rate||0,quantity:svc.unit==="job"?1:0});setError("");}}><SelectTrigger><SelectValue placeholder="Choose a service"/></SelectTrigger><SelectContent>{services.map((svc)=><SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Service description and expectations</Label><Textarea rows={7} value={item.description} onChange={(event)=>updateItem(index,{description:event.target.value})}/><p className="service-description-help">This wording appears beneath this service on the estimate and invoice.</p></div>
          <div className="edit-quantity-row"><div><Label>Quantity</Label><Input inputMode="decimal" value={item.quantity||""} onChange={(event)=>updateItem(index,{quantity:Number(event.target.value)})}/></div><span>{item.unit||"unit"}</span></div>
          <div><Label>Price per unit — adjustable for this job</Label><div className="discount-input"><span>$</span><Input inputMode="decimal" value={item.unitRateCents?String(item.unitRateCents/100):""} onChange={(event)=>updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})}/></div></div><p className="service-description-help">{item.serviceId&&services.some((svc)=>svc.id===item.serviceId)?`Starting rate: $${((services.find((svc)=>svc.id===item.serviceId)?.rate??0)/100).toFixed(2)} per ${item.unit}. `:""}Change the rate for access, buildup, difficulty, or extra labor. Your standard rate stays unchanged.</p><strong className="edit-line-total">Line total {money(editableLineTotalCents(item))}</strong>
        </section>)}</div>
        <Button variant="outline" className="w-full" onClick={addService}><Plus className="h-4 w-4"/> Add another service</Button>
        <button type="button" onClick={()=>setAppreciationDiscount((value)=>!value)} className={`discount-row ${appreciationDiscount?"selected":""}`}><span><strong>5% First Responder & Military</strong><small>Year-round appreciation discount</small></span><span className="check-box">{appreciationDiscount&&<Check className="h-4 w-4"/>}</span></button>
        <section className="edit-discount-card"><Label>Additional bundle, promotion, or family discount</Label><div className="discount-mode-row"><Button type="button" variant={discountMode==="percent"?"default":"outline"} onClick={()=>{setDiscountMode("percent");setDiscountValue("");}}>% Percentage</Button><Button type="button" variant={discountMode==="dollar"?"default":"outline"} onClick={()=>{setDiscountMode("dollar");setDiscountValue("");}}>$ Dollar amount</Button></div><div className="discount-input"><span>{discountMode==="percent"?"%":"$"}</span><Input inputMode="decimal" value={discountValue} onChange={(event)=>setDiscountValue(event.target.value)} placeholder="0"/></div><p className="service-description-help">Choose percentage or dollar amount. Percentage discounts stack with the 5% appreciation discount, up to 50% total.</p></section>
        <div className="edit-totals"><span>Service subtotal<strong>{money(subtotal)}</strong></span><span>Discount<strong>−{money(discount.appliedDiscount)}</strong></span><span>Customer total<strong>{money(total)}</strong></span><span>50% deposit to schedule<strong>{money(deposit)}</strong></span></div>
        {subtotal>0&&subtotal-discount.requestedDiscount<15000&&<p className="service-description-help">The $150 minimum job charge is applied automatically.</p>}{error&&<p className="save-error" role="alert">{error}</p>}
        <div className="flex gap-3"><Button variant="outline" onClick={()=>setStep(1)} disabled={saving}>Back</Button><Button className="brand-button flex-1" onClick={()=>void saveEstimate()} disabled={saving||uncertainSave||customerLoading||!identityConfirmed||Boolean(selectedCustomer)&&propertyBlocked}>{saving?"Saving…":`Save ${money(total)} estimate`}</Button></div>
      </div>}
      {uncertainSave&&<section className="px-6 pb-6" aria-label="Unconfirmed estimate save"><p role="status">Save was not confirmed. Another save is blocked to prevent duplicate estimates.</p><Button variant="outline" disabled={reviewingRecords} onClick={()=>void reviewStored()}>Review stored estimates</Button>{reviewedRecords.map(row=><p key={row.id}>{row.service} · {row.address} · {money(row.totalCents)} · {row.id}</p>)}</section>}
    </DialogContent>
  </Dialog>;
}

function DashboardView({userName,metrics,estimates,onSaved,onNavigate,onOpenEstimate,onOpenCustomer,onOpenCustomerActivity,onOpenTask}:{userName:string;metrics:{estimates:number;openValue:number;outstanding:number};estimates:EstimateRow[];onSaved:(estimate:EstimateRow)=>void;onNavigate:(tab:string)=>void;onOpenEstimate?:(id:string)=>void;onOpenCustomer?:(id:string)=>void;onOpenCustomerActivity?:(id:string,kind:"sign"|"review")=>void;onOpenTask?:(id:string)=>void}) {
  const now = useCurrentTime();
  const [priorityTasks,setPriorityTasks]=useState<TaskRow[]>([]);
  const [priorityTaskStatus,setPriorityTaskStatus]=useState<"loading"|"ready"|"error">("loading");
  const [taskRefresh,setTaskRefresh]=useState(0);
  useEffect(()=>{
    let cancelled=false,generation=0;const controller=new AbortController();
    const load=async()=>{
      const request=++generation;
      try{
        const response=await fetch("/api/tasks",{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("Task read unavailable");
        const data=await response.json() as {tasks?:unknown};
        if(!Array.isArray(data.tasks)||data.tasks.some((task:unknown)=>!task||typeof task!=="object"||typeof (task as TaskRow).id!=="string"||typeof (task as TaskRow).title!=="string"||!["open","completed"].includes((task as TaskRow).status)||((task as TaskRow).dueAt!=null&&(typeof (task as TaskRow).dueAt!=="string"||!Number.isFinite(Date.parse((task as TaskRow).dueAt!))))))throw new Error("Invalid task response");
        if(!cancelled&&request===generation){setPriorityTasks(data.tasks as TaskRow[]);setPriorityTaskStatus("ready");}
      }catch{if(!cancelled&&request===generation){setPriorityTasks([]);setPriorityTaskStatus("error");}}
    };
    void load();
    const refresh=()=>{if(document.visibilityState==="visible")void load();};
    window.addEventListener("focus",refresh);
    window.addEventListener("fire:attention-saved",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{cancelled=true;generation++;controller.abort();window.removeEventListener("focus",refresh);window.removeEventListener("fire:attention-saved",refresh);document.removeEventListener("visibilitychange",refresh);window.clearInterval(timer);};
  },[taskRefresh]);
  // Exactly the same owner-local due-time classification as Business → Tasks.
  const dueTasks=priorityTaskStatus==="ready"?priorityTasks.filter(task=>{const state=taskDueBucket(task,new Date(now));return state==="overdue"||state==="today";}).sort((a,b)=>Date.parse(a.dueAt!)-Date.parse(b.dueAt!)||a.id.localeCompare(b.id)):[];
  const pastDueTasks=dueTasks.filter(task=>taskDueBucket(task,new Date(now))==="overdue").length;
  const [signs,setSigns]=useState<DashboardYardSign[]>([]);
  const [signStatus,setSignStatus]=useState<"loading"|"ready"|"error">("loading");
  const [signReload,setSignReload]=useState(0);
  useEffect(()=>{
    let cancelled=false,generation=0;
    const controller=new AbortController();
    const read=async()=>{
      const request=++generation;
      try{
        const response=await fetch("/api/dashboard-yard-signs",{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("Yard sign read unavailable");
        const data=await response.json() as {signs?:unknown};
        if(!Array.isArray(data.signs)||data.signs.some((row:unknown)=>!row||typeof row!=="object"||typeof (row as DashboardYardSign).customerId!=="string"||typeof (row as DashboardYardSign).customerName!=="string"||typeof (row as DashboardYardSign).pickupDate!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test((row as DashboardYardSign).pickupDate)||typeof (row as DashboardYardSign).location!=="string"))throw new Error("Unverified yard sign response");
        if(!cancelled&&request===generation){setSigns(data.signs as DashboardYardSign[]);setSignStatus("ready");}
      }catch{if(!cancelled&&request===generation){setSigns([]);setSignStatus("error");}}
    };
    void read();
    const refresh=()=>{if(document.visibilityState==="visible")void read();};
    window.addEventListener("focus",refresh);
    window.addEventListener("fire:attention-saved",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{cancelled=true;generation++;controller.abort();window.removeEventListener("focus",refresh);window.removeEventListener("fire:attention-saved",refresh);document.removeEventListener("visibilitychange",refresh);window.clearInterval(timer);};
  },[signReload]);
  const localDay=new Date(now).toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
  const pickupDue=signs.filter(sign=>sign.pickupDate<=localDay).length;
  const [reviewChecks,setReviewChecks]=useState<DashboardReviewCheck[]>([]);
  const [reviewChecksStatus,setReviewChecksStatus]=useState<"loading"|"ready"|"error">("loading");
  const [reviewChecksReload,setReviewChecksReload]=useState(0);
  useEffect(()=>{
    let cancelled=false,generation=0;
    const controller=new AbortController();
    const loadChecks=async()=>{
      const request=++generation;
      try{
        const response=await fetch("/api/dashboard-review-checks",{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("Review checks unavailable");
        const data=await response.json() as {checks?:unknown};
        if(!Array.isArray(data.checks)||data.checks.some((row:unknown)=>!row||typeof row!=="object"||
          typeof (row as DashboardReviewCheck).customerId!=="string"||typeof (row as DashboardReviewCheck).customerName!=="string"||
          typeof (row as DashboardReviewCheck).requestedAt!=="string"||
          !Number.isFinite(Date.parse((row as DashboardReviewCheck).requestedAt))||
          !Number.isInteger((row as DashboardReviewCheck).elapsedDays)||(row as DashboardReviewCheck).elapsedDays<7))
          throw new Error("Invalid review check response");
        if(!cancelled&&request===generation){setReviewChecks(data.checks as DashboardReviewCheck[]);setReviewChecksStatus("ready");}
      }catch{if(!cancelled&&request===generation){setReviewChecks([]);setReviewChecksStatus("error");}}
    };
    void loadChecks();
    const refresh=()=>{if(document.visibilityState==="visible")void loadChecks();};
    window.addEventListener("focus",refresh);
    window.addEventListener("fire:attention-saved",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{cancelled=true;generation++;controller.abort();window.removeEventListener("focus",refresh);window.removeEventListener("fire:attention-saved",refresh);document.removeEventListener("visibilitychange",refresh);window.clearInterval(timer);};
  },[reviewChecksReload]);
  // Paid-closeout review requests and 7-day review STATUS checks are distinct.
  // A prepared text/email is not a confirmed send, and reading creates no action.
  const [paidReviewActions,setPaidReviewActions]=useState<PaymentCloseoutAction[]>([]);
  const [paidReviewStatus,setPaidReviewStatus]=useState<"loading"|"ready"|"error">("loading");
  const [paidReviewMore,setPaidReviewMore]=useState(false);
  const [paidReviewReload,setPaidReviewReload]=useState(0);
  useEffect(()=>{
    let cancelled=false,generation=0;
    const controller=new AbortController();
    const read=async()=>{
      const request=++generation;
      try{
        const response=await fetch("/api/payment-closeouts",{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw Error("Review request queue unavailable");
        const data=await response.json() as {actions?:PaymentCloseoutAction[];mayHaveMore?:boolean};
        if(!Array.isArray(data.actions)||typeof data.mayHaveMore!=="boolean"||data.actions.length>200||
          data.actions.some(row=>!row||typeof row.estimateId!=="string"||!row.estimateId||
            typeof row.customerId!=="string"||!row.customerId||
            typeof row.customerName!=="string"||!row.customerName.trim()||
            !Number.isSafeInteger(row.totalCents)||row.totalCents<=0||
            typeof row.lastPaidAt!=="string"||!Number.isFinite(Date.parse(row.lastPaidAt))||
            !["ready","prepared"].includes(row.state))||
          new Set(data.actions.map(row=>row.estimateId)).size!==data.actions.length)
            throw Error("Review request queue not verified");
        if(!cancelled&&request===generation){
          setPaidReviewActions(data.actions);setPaidReviewMore(data.mayHaveMore);
          setPaidReviewStatus("ready");
        }
      }catch{
        if(!cancelled&&request===generation){
          setPaidReviewActions([]);setPaidReviewMore(false);setPaidReviewStatus("error");
        }
      }
    };
    void read();
    const refresh=()=>{if(document.visibilityState==="visible")void read();};
    window.addEventListener("focus",refresh);
    window.addEventListener("fire:attention-saved",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{cancelled=true;generation++;controller.abort();window.clearInterval(timer);
      window.removeEventListener("focus",refresh);
      window.removeEventListener("fire:attention-saved",refresh);
      document.removeEventListener("visibilitychange",refresh);};
  },[paidReviewReload]);
  // Match Schedule: future completed/declined jobs are not upcoming appointments.
  // The first supplied record is not necessarily the next appointment.
  const upcomingJobs=estimates.filter((estimate)=>estimate.status==="scheduled"&&estimate.scheduledAt&&Number.isFinite(Date.parse(estimate.scheduledAt))&&Date.parse(estimate.scheduledAt)>=now).sort((a,b)=>Date.parse(a.scheduledAt!)-Date.parse(b.scheduledAt!));
  const upcoming=upcomingJobs.length;
  const completed = estimates.filter((estimate)=>estimate.status === "completed").length;
  const nextJob=upcomingJobs[0];
  // Native dial/compose shortcuts never submit or send through FIRE.
  // Reject malformed contact details instead of constructing ambiguous URLs.
  const rawPhone=nextJob?.phone?.trim()??"";
  const digits=/^[+0-9().\s-]+$/.test(rawPhone)?rawPhone.replace(/\D/g,""):"";
  const nextJobPhone=digits.length===10?"+1"+digits:digits.length===11&&digits.startsWith("1")?"+"+digits:null;
  const nextJobEmail=nextJob?.email?.trim()??"";
  const canEmailNextJob=/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(nextJobEmail);
  // The customer profile may hold other details, so report only fields
  // available on THIS scheduled appointment. Highlight today/tomorrow only.
  const nextJobCentralDay=nextJob?.scheduledAt?new Date(nextJob.scheduledAt).toLocaleDateString("en-CA",{timeZone:"America/Chicago"}):null;
  const tomorrowDate=new Date(localDay+"T12:00:00Z");tomorrowDate.setUTCDate(tomorrowDate.getUTCDate()+1);
  const tomorrowDay=tomorrowDate.toISOString().slice(0,10);
  const nearTermNextJob=nextJobCentralDay===localDay||nextJobCentralDay===tomorrowDay;
  const nextJobNeedsAddress=Boolean(nearTermNextJob&&nextJob&&!nextJob.address?.trim());
  const nextJobNeedsContact=Boolean(nearTermNextJob&&nextJob&&!nextJobPhone&&!canEmailNextJob);
  const nextJobNeedsPrep=nextJobNeedsAddress||nextJobNeedsContact;
  // More than the next job may need preparation. Only the currently loaded
  // scheduled appointments for today/tomorrow qualify; other screens have
  // the full record history. Do not treat bad phone/email as usable contact.
  const nearTermPrepJobs=upcomingJobs.filter(job=>{
    const day=new Date(job.scheduledAt!).toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
    if(day!==localDay&&day!==tomorrowDay)return false;
    const phone=job.phone?.trim()??"";
    const phoneDigits=/^[+0-9().\s-]+$/.test(phone)?phone.replace(/\D/g,""):"";
    const validPhone=phoneDigits.length===10||phoneDigits.length===11&&phoneDigits.startsWith("1");
    const validEmail=/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(job.email?.trim()??"");
    return !job.address?.trim()||!validPhone&&!validEmail;
  });
  // API order is not an owner priority guarantee: pick the oldest due pickup
  // and the longest outstanding confirmed review request deterministically.
  const dueSign=signStatus==="ready"?signs.filter(sign=>sign.pickupDate<=localDay)
    .sort((a,b)=>a.pickupDate.localeCompare(b.pickupDate)||a.customerId.localeCompare(b.customerId))[0]:undefined;
  const dueReviews=reviewChecksStatus==="ready"?reviewChecks.length:0;
  const oldestReviewCheck=reviewChecksStatus==="ready"?reviewChecks.slice().sort((a,b)=>b.elapsedDays-a.elapsedDays||a.requestedAt.localeCompare(b.requestedAt)||a.customerId.localeCompare(b.customerId))[0]:undefined;
  // Unconfirmed prepared messages need an owner send/receipt check before newer requests.
  const oldestPaidReview=paidReviewStatus==="ready"?paidReviewActions.slice()
    .sort((a,b)=>(a.state==="prepared"?0:1)-(b.state==="prepared"?0:1)||Date.parse(a.lastPaidAt)-Date.parse(b.lastPaidAt)||a.estimateId.localeCompare(b.estimateId))[0]:undefined;
  const preparedPaidReviewCount=paidReviewActions.filter(row=>row.state==="prepared").length;
  const unsentPaidReviewCount=paidReviewActions.length-preparedPaidReviewCount;
  const oldestUnpreparedReview=paidReviewStatus==="ready"?paidReviewActions.filter(row=>row.state!=="prepared")
    .sort((a,b)=>Date.parse(a.lastPaidAt)-Date.parse(b.lastPaidAt)||a.estimateId.localeCompare(b.estimateId))[0]:undefined;
  const priorityCount=nearTermPrepJobs.length+(signStatus==="ready"?pickupDue:0)+dueReviews+dueTasks.length+(paidReviewStatus==="ready"?paidReviewActions.length:0);
  const incompletePrioritySources=signStatus==="error"||reviewChecksStatus==="error"||priorityTaskStatus==="error"||paidReviewStatus==="error";
  return (
    <div className="dashboard-view">
      <section className="welcome-row"><div><p className="eyebrow">FIRE App</p><h1>Welcome to First In Response Exteriors</h1><p>Customers, estimates, jobs, and balances in one place.</p></div><NewEstimate onSaved={onSaved} /></section>
      {(priorityCount>0||incompletePrioritySources)&&<section className="dashboard-priority-strip" aria-label="Needs attention" role="region">
        <header><div><h2><AlertTriangle aria-hidden="true"/> Needs attention <span>{priorityCount} known check{priorityCount===1?"":"s"}</span></h2><p>Act on saved activity and visible appointments. Categories may overlap; no messages or updates happen automatically.</p></div></header>
        <div className="dashboard-priority-actions">
          {nearTermPrepJobs.length>0&&<button type="button" aria-label="Review upcoming appointment preparation" onClick={()=>onOpenEstimate?onOpenEstimate(nearTermPrepJobs[0].id):onNavigate("schedule")}><CalendarDays aria-hidden="true"/><span><strong>{nearTermPrepJobs.length} job{nearTermPrepJobs.length===1?"":"s"} need details</strong><small>Today or tomorrow · missing service address or usable contact on job</small></span><ChevronRight aria-hidden="true"/></button>}
          {dueSign&&<button type="button" aria-label="Review overdue yard sign pickup" onClick={()=>onOpenCustomerActivity?onOpenCustomerActivity(dueSign.customerId,"sign"):onOpenCustomer?onOpenCustomer(dueSign.customerId):onNavigate("customers")}><MapPin aria-hidden="true"/><span><strong>{pickupDue} yard sign pickup{pickupDue===1?"":"s"} due</strong><small>Open {dueSign.customerName} · target {dueSign.pickupDate}</small></span><ChevronRight aria-hidden="true"/></button>}
          {dueTasks.length>0&&<button type="button" className={pastDueTasks?"priority-task-overdue":""} aria-label="Review due Business tasks" onClick={()=>onOpenTask?onOpenTask(dueTasks[0].id):onNavigate("business")}><ClipboardList aria-hidden="true"/><span><strong>{dueTasks.length} Business task{dueTasks.length===1?"":"s"} due</strong><small>{pastDueTasks?pastDueTasks+" past due":"Due today"}{pastDueTasks&&dueTasks.length>pastDueTasks?" · "+(dueTasks.length-pastDueTasks)+" later today":""} · {dueTasks[0].title}</small></span><ChevronRight aria-hidden="true"/></button>}
          {oldestPaidReview&&<button type="button" aria-label="Review paid jobs awaiting review requests" onClick={()=>onOpenEstimate?onOpenEstimate(oldestPaidReview.estimateId):onNavigate("payments")}><Star aria-hidden="true"/><span><strong>{paidReviewActions.length}{paidReviewMore?"+":""} paid job{paidReviewActions.length===1&&!paidReviewMore?"":"s"} awaiting review request</strong><small>{preparedPaidReviewCount} prepared, sending unconfirmed · {unsentPaidReviewCount} not prepared{paidReviewMore?" · Counts exclude older unloaded jobs":""}</small><small>Open {oldestPaidReview.customerName} · {oldestPaidReview.state==="prepared"?"Prepared review message — confirm whether it was actually sent":preparedPaidReviewCount?preparedPaidReviewCount+" other prepared message"+(preparedPaidReviewCount===1?"":"s")+" need send verification":"no confirmed request yet"}{paidReviewMore?" · More in Payments":""}</small></span><ChevronRight aria-hidden="true"/></button>}
          {preparedPaidReviewCount>0&&oldestUnpreparedReview&&<button type="button" aria-label="Open paid job without prepared review request" onClick={()=>onOpenEstimate?onOpenEstimate(oldestUnpreparedReview.estimateId):onNavigate("payments")}><Star aria-hidden="true"/><span><strong>{unsentPaidReviewCount} paid job{unsentPaidReviewCount===1?"":"s"} need a review message prepared</strong><small>Open {oldestUnpreparedReview.customerName} · no confirmed request; prepare and verify before sending</small></span><ChevronRight aria-hidden="true"/></button>}
          {oldestReviewCheck&&<button type="button" aria-label="Review customer review-status checks" onClick={()=>onOpenCustomerActivity?onOpenCustomerActivity(oldestReviewCheck.customerId,"review"):onOpenCustomer?onOpenCustomer(oldestReviewCheck.customerId):onNavigate("customers")}><Star aria-hidden="true"/><span><strong>{dueReviews} review status check{dueReviews===1?"":"s"}</strong><small>Confirm whether reviews appeared before any follow-up</small></span><ChevronRight aria-hidden="true"/></button>}
          {priorityTaskStatus==="error"&&<button type="button" className="priority-data-error" aria-label="Retry unavailable Business tasks" onClick={()=>setTaskRefresh(n=>n+1)}><RefreshCw aria-hidden="true"/><span><strong>Business task status unavailable</strong><small>Retry — due task counts may be incomplete</small></span><ChevronRight aria-hidden="true"/></button>}
          {signStatus==="error"&&<button type="button" className="priority-data-error" aria-label="Retry unavailable yard sign status" onClick={()=>setSignReload(n=>n+1)}><RefreshCw aria-hidden="true"/><span><strong>Yard sign status unavailable</strong><small>Retry — pickup counts may be incomplete</small></span><ChevronRight aria-hidden="true"/></button>}
          {paidReviewStatus==="error"&&<button type="button" className="priority-data-error" aria-label="Retry unavailable paid-job review requests" onClick={()=>setPaidReviewReload(n=>n+1)}><RefreshCw aria-hidden="true"/><span><strong>Paid-job review requests unavailable</strong><small>Retry — completed paid jobs may need requests</small></span><ChevronRight aria-hidden="true"/></button>}
          {reviewChecksStatus==="error"&&<button type="button" className="priority-data-error" aria-label="Retry unavailable review checks" onClick={()=>setReviewChecksReload(n=>n+1)}><RefreshCw aria-hidden="true"/><span><strong>Review checks unavailable</strong><small>Retry — follow-up counts may be incomplete</small></span><ChevronRight aria-hidden="true"/></button>}
        </div>
        <div className="dashboard-priority-foot"><small>Job checks cover loaded Dashboard appointments; open Schedule for all jobs.</small><button type="button" onClick={()=>onNavigate("schedule")}>Full schedule <ChevronRight aria-hidden="true"/></button></div>
      </section>}
      <ScheduleWeather compact nextJobAt={upcomingJobs[0]?.scheduledAt}/>
      {upcomingJobs[0]&&<section className={`dashboard-next-job${nextJobNeedsPrep?" dashboard-next-job-needs-prep":""}`} aria-label="Next scheduled job">
        <div className="dashboard-next-job-info">
          <p className="eyebrow">Your next appointment</p>
          <h2>{upcomingJobs[0].customer}</h2>
          <p>{upcomingJobs[0].service} · {dateTime(upcomingJobs[0].scheduledAt!)}</p>
          <small>{upcomingJobs[0].address||"No job address saved"}</small>
          {nextJobNeedsPrep&&<div className="dashboard-next-prep" role="status" aria-label="Next job details to review"><strong><AlertTriangle aria-hidden="true"/> Check before this appointment</strong><div>{nextJobNeedsAddress&&<span>Service address not saved on job</span>}{nextJobNeedsContact&&<span>No usable phone or email on job</span>}</div><small>Open this job to verify details. The customer profile may contain more information.</small></div>}
        </div>
        <div className="dashboard-next-job-actions">
          <Button className="brand-button" onClick={()=>onOpenEstimate?onOpenEstimate(upcomingJobs[0].id):onNavigate("schedule")}>Open next job <ChevronRight className="h-4 w-4"/></Button>
          {upcomingJobs[0].address?.trim()&&<a className="dashboard-next-directions" aria-label="Directions to next job" href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=${encodeURIComponent(upcomingJobs[0].address.trim())}`} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4"/> Directions</a>}
          {nextJobPhone&&<a className="dashboard-next-directions dashboard-next-contact" aria-label="Call next job customer" href={"tel:"+nextJobPhone}><Phone className="h-4 w-4"/> Call</a>}
          {nextJobPhone&&<a className="dashboard-next-directions dashboard-next-contact" aria-label="Text next job customer" href={"sms:"+nextJobPhone}><MessageSquareText className="h-4 w-4"/> Text</a>}
          {canEmailNextJob&&<a className="dashboard-next-directions dashboard-next-contact" aria-label="Email next job customer" href={"mailto:"+encodeURIComponent(nextJobEmail)}><Mail className="h-4 w-4"/> Email</a>}
          <Button variant="outline" onClick={()=>onNavigate("schedule")}>Full schedule</Button>
        </div>
      </section>}
      <section className="metric-grid">
        <button className="metric-card accent" onClick={()=>onNavigate("payments")}><span className="metric-icon red"><CircleDollarSign /></span><p>Due now</p><strong>{money(metrics.outstanding)}</strong><small>Deposits and completed-job balances</small><ChevronRight className="metric-arrow"/></button>
        <button className="metric-card" onClick={()=>onNavigate("schedule")}><span className="metric-icon blue"><CalendarDays /></span><p>Upcoming jobs</p><strong>{upcoming}</strong><small>Open the schedule</small><ChevronRight className="metric-arrow"/></button>
        <button className="metric-card" onClick={()=>onNavigate("estimates")}><span className="metric-icon gold"><ClipboardList /></span><p>Saved estimates</p><strong>{metrics.estimates}</strong><small>{money(metrics.openValue)} potential estimate value</small><ChevronRight className="metric-arrow"/></button>
        <button className="metric-card" onClick={()=>onNavigate("estimates")}><span className="metric-icon green"><CheckCircle2 /></span><p>Completed jobs</p><strong>{completed}</strong><small>Review completed work</small><ChevronRight className="metric-arrow"/></button>
      </section>
      {(signStatus==="error"||signStatus==="ready"&&signs.length>0)&&<section className={`dashboard-sign-reminders${pickupDue?" needs-pickup":""}`} role="region" aria-label="Outstanding yard sign pickups">
        <header><div><h2><MapPin aria-hidden="true"/> Yard signs to pick up</h2>{signStatus==="ready"&&<p>{signs.length} outstanding · {pickupDue?pickupDue+" due or overdue":"No pickups due yet"}</p>}</div><button type="button" onClick={()=>setSignReload(n=>n+1)} aria-label="Refresh yard sign reminders"><RefreshCw aria-hidden="true"/> Refresh</button></header>
        {signStatus==="error"?<p role="alert">Yard sign status could not be verified. Refresh to try again; no signs are marked cleared.</p>:<div className="dashboard-sign-list">{signs.slice(0,3).map(sign=><button type="button" key={sign.customerId} onClick={()=>onOpenCustomer?onOpenCustomer(sign.customerId):onNavigate("customers")}><span><strong>{sign.customerName}</strong><small>{sign.location}</small></span><span className={sign.pickupDate<=localDay?"pickup-due":"pickup-planned"}>{sign.pickupDate<=localDay?"Pickup due":"Pickup"} · {sign.pickupDate}<ChevronRight aria-hidden="true"/></span></button>)}</div>}
        {signStatus==="ready"&&<div className="dashboard-sign-footer"><small>Owner-logged placements only · pickup is not automatically confirmed{signs.length>3?` · ${signs.length-3} more in Customers`:""}</small><button type="button" onClick={()=>onNavigate("customers")}>View all in Customers <ChevronRight aria-hidden="true"/></button></div>}
      </section>}
      {(reviewChecksStatus==="error"||reviewChecksStatus==="ready"&&reviewChecks.length>0)&&<section className="dashboard-review-reminders" role="region" aria-label="Review status checks on dashboard">
        <header><div><h2><Star aria-hidden="true"/> Review status checks</h2>{reviewChecksStatus==="ready"&&<p>{reviewChecks.length} customer{reviewChecks.length===1?"":"s"} to review · not automatic outreach</p>}</div><button type="button" aria-label="Refresh review status checks" onClick={()=>setReviewChecksReload(n=>n+1)}><RefreshCw aria-hidden="true"/> Refresh</button></header>
        {reviewChecksStatus==="error"?<p role="alert">Review check status could not be verified. Refresh to try again; no customers are marked cleared.</p>:<div className="dashboard-review-list">{reviewChecks.slice(0,3).map(row=><button type="button" key={row.customerId} onClick={()=>onOpenCustomer?onOpenCustomer(row.customerId):onNavigate("customers")}><span><strong>{row.customerName}</strong><small>Review request recorded {row.elapsedDays} days ago</small></span><span>Check status <ChevronRight aria-hidden="true"/></span></button>)}</div>}
        {reviewChecksStatus==="ready"&&<div className="dashboard-review-footer"><small>Only confirmed requests on completed work. Logged reviews are excluded.{reviewChecks.length>3?` ${reviewChecks.length-3} more in Customers.`:""}</small><button type="button" onClick={()=>onNavigate("customers")}>Review in Customers <ChevronRight aria-hidden="true"/></button></div>}
      </section>}
      <section className="attention-card">
        <div><span className="spark"><Sparkles /></span><div><strong>Keep every job moving</strong><p>Use Follow-ups for reminders and Payments to record money received through Wave, Cash App, Venmo, cash, check, card, or bank transfer.</p></div></div>
        <Button variant="outline" onClick={() => onNavigate("followups")}>Review follow-ups <ChevronRight className="h-4 w-4" /></Button>
      </section>
      <div className="content-grid">
        <section className="panel"><header><div><h2>Recent estimates</h2><p>Tap any row to continue the job</p></div><button onClick={() => onNavigate("estimates")}>View all</button></header><div className="job-list">{estimates.length?estimates.map((estimate) => <button className="job-row recent-estimate-row" key={estimate.id} onClick={()=>onOpenEstimate?onOpenEstimate(estimate.id):onNavigate("estimates")}><span className="date-tile"><b>{new Date(estimate.createdAt).toLocaleDateString("en-US",{day:"numeric",timeZone:"America/Chicago"})}</b><small>{new Date(estimate.createdAt).toLocaleString("en-US",{month:"short",timeZone:"America/Chicago"}).toUpperCase()}</small></span><div className="job-main"><strong>{estimate.customer}</strong><p>{estimate.service}</p><small className="recent-estimate-status">{statusLabel(estimate.status)}{estimate.status==="sent"&&estimate.firstViewedAt?" · Viewed":""}</small><small className="recent-estimate-dates">Created {dateTime(estimate.createdAt)}</small>{estimate.scheduledAt&&<small className="recent-estimate-appointment">Service · {dateTime(estimate.scheduledAt)}</small>}</div><strong className="job-price">{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight className="row-arrow" /></button>):<div className="real-empty"><strong>No estimates yet</strong><p>Create your first estimate to start the customer record.</p></div>}</div></section>
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
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [address,setAddress]=useState("");
  const [leadSource,setLeadSource]=useState("Referral");const [saving,setSaving]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState("");
  const [review,setReview]=useState<CreatedCustomer|null>(null);
  const requestId=useRef<string|null>(null),attempt=useRef<CustomerCreateInput|null>(null),saveLock=useRef(false),mounted=useRef(true);
  const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
  useEffect(()=>{mounted.current=true;const id=loadCustomerCreateRequest(storage());if(id){requestId.current=id;setPending(true);}return()=>{mounted.current=false;};},[]);
  const setOpenSafe=(value:boolean)=>{
    if(!value&&saveLock.current)return;
    if(value){const id=requestId.current??loadCustomerCreateRequest(storage());if(id){requestId.current=id;setPending(true);setError("An earlier customer save needs confirmation. Check it before creating another customer.");}}
    setOpen(value);
  };
  const finish=(customer:CreatedCustomer)=>{
    const id=requestId.current;if(id)clearCustomerCreateRequest(storage(),id);
    requestId.current=null;attempt.current=null;setPending(false);setReview(null);setOpen(false);
    setName("");setEmail("");setPhone("");setAddress("");setLeadSource("Referral");setError("");
    onAdded(customer);
  };
  const save=async()=>{
    if(saveLock.current)return;
    const input:CustomerCreateInput={name:name.trim(),email:email.trim(),phone:phone.trim(),address:address.trim(),leadSource};
    if(!pending&&!input.name){setError("Customer name is required.");return;}
    const id=requestId.current??crypto.randomUUID();
    if(!saveCustomerCreateRequest(storage(),id)){setError("FIRE could not preserve this save identifier, or another customer save needs review. Keep this form open and check browser storage before saving.");return;}
    requestId.current=id;saveLock.current=true;setSaving(true);setError("");setReview(null);
    const wasPending=pending;
    if(!wasPending)attempt.current=input;
    setPending(true);
    let confirmed:CreatedCustomer|null=null;
    const checkSaved=async()=>{
      const response=await fetch(`/api/customers/confirmation?requestId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const result=await response.json() as {error?:string;requestId?:string;confirmed?:boolean;customer?:unknown};
      if(!response.ok)throw new Error(result.error||"Customer save status is uncertain.");
      if(result.requestId===id&&result.confirmed===false&&result.customer===null)return null;
      const customer=confirmedCreatedCustomer(result,id);
      if(!customer)throw new Error("The saved customer receipt does not match this request. Keep the save identifier for review.");
      return customer;
    };
    try{
      if(wasPending){
        confirmed=await checkSaved();
        if(!confirmed&&!attempt.current){setPending(false);setError("No saved customer was found yet. Re-enter the details to retry using this same save identifier.");return;}
      }
      if(!confirmed){
        let message="Customer save confirmation is uncertain.",rejected=false;
        try{
          const response=await fetch("/api/customers",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:id,...attempt.current})});
          if(!response.ok){const result=await response.json() as {error?:string};message=result.error||message;rejected=[400,409].includes(response.status);}
        }catch{/* The write may have committed. Read once; never auto-repeat a POST. */}
        confirmed=await checkSaved();
        if(!confirmed){if(rejected){setPending(false);attempt.current=null;}throw new Error(message);}
      }
    }catch(saveError){setError((saveError instanceof Error?saveError.message:"Customer save status is uncertain.")+" Check this SAME save before creating another record.");}
    finally{saveLock.current=false;setSaving(false);}
    if(confirmed&&mounted.current){
      if(attempt.current&&!sameCustomerCreateInput(confirmed,attempt.current)){setReview(confirmed);setError("The saved customer now has different details. Review the current record below; FIRE has not overwritten it.");}
      else finish(confirmed);
    }
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}>
    <DialogTrigger asChild><Button className="brand-button"><UserPlus className="h-4 w-4"/>{pending?"Check previous customer save":"Add customer"}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-[520px] max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add customer</DialogTitle></DialogHeader><div className="customer-form">
        <div><Label htmlFor="newCustomerName">Customer name</Label><Input id="newCustomerName" disabled={saving||pending} placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div><Label htmlFor="newCustomerEmail">Email</Label><Input id="newCustomerEmail" disabled={saving||pending} type="email" placeholder="customer@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div><Label htmlFor="newCustomerPhone">Phone</Label><Input id="newCustomerPhone" disabled={saving||pending} inputMode="tel" placeholder="(918) 555-0123" value={phone} onChange={e=>setPhone(e.target.value)}/></div>
        <div><Label htmlFor="newCustomerAddress">Service address</Label><Input id="newCustomerAddress" disabled={saving||pending} placeholder="Tulsa-area address" value={address} onChange={e=>setAddress(e.target.value)}/></div>
        <div><Label>How they found FIRE</Label><Select disabled={saving||pending} value={leadSource} onValueChange={setLeadSource}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Referral","Google","Facebook","Website","Repeat customer","Door knocking","Other"].map(source=><SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div>
        {error&&<p className="save-error" role="alert">{error}</p>}
        {review&&<div className="record-card" role="region" aria-label="Saved customer to review"><strong>{review.name}</strong><p>{[review.email,review.phone,review.address].filter(Boolean).join(" · ")}</p><Button className="brand-button" onClick={()=>finish(review)}>Open saved customer</Button></div>}
        {!review&&<Button className="brand-button" onClick={()=>void save()} disabled={saving}>{saving?"Checking customer…":pending?attempt.current?"Check / retry same customer save":"Check previous save":"Save customer"}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}

function EditCustomer({ customer, onUpdated }: { customer: CustomerRow; onUpdated: (customer: CustomerRow) => void }) {
  const [open,setOpen]=useState(false);
  const saveLock=useRef(false);
  const currentCustomer=useRef(customer.id);currentCustomer.current=customer.id;
  useEffect(()=>{currentCustomer.current=customer.id;return()=>{currentCustomer.current="";};},[customer.id]);
  const [name,setName]=useState(customer.name);const [email,setEmail]=useState(customer.email);const [phone,setPhone]=useState(customer.phone);const [address,setAddress]=useState(customer.address);
  const [leadSource,setLeadSource]=useState(customer.leadSource||"Unknown");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const reset=()=>{setName(customer.name);setEmail(customer.email);setPhone(customer.phone);setAddress(customer.address);setLeadSource(customer.leadSource||"Unknown");setError("");};
  const save=async()=>{
    if(saveLock.current||currentCustomer.current!==customer.id)return;
    if(!name.trim()){setError("Customer name is required.");return;}
    const id=customer.id;const payload={id,name:name.trim(),email:email.trim(),phone:phone.trim(),address:address.trim(),leadSource};
    saveLock.current=true;setSaving(true);setError("");
    try{
      const response=await fetch("/api/customers",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json() as {customer?:CustomerRow;error?:string};
      if(currentCustomer.current!==id)return;
      if(!response.ok)throw new Error(result?.error||"The customer could not be updated.");
      if(!result?.customer||Object.entries(payload).some(([key,value])=>result.customer?.[key as keyof CustomerRow]!==value))throw new Error("The saved customer could not be verified. Reopen this profile to check its details before trying again.");
      onUpdated({...customer,...result.customer});
      setOpen(false);
    }catch(saveError){if(currentCustomer.current===id)setError(saveError instanceof Error?saveError.message:"The customer could not be updated.");}
    finally{saveLock.current=false;if(currentCustomer.current===id)setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={(value)=>{if(saveLock.current||currentCustomer.current!==customer.id)return;setOpen(value);if(value)reset();else setError("");}}>
    <DialogTrigger asChild><Button variant="outline"><PenLine className="h-4 w-4"/> Edit customer</Button></DialogTrigger>
    <DialogContent className="customer-edit-dialog sm:max-w-[520px] max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
      <div className="customer-form"><fieldset disabled={saving} className="contents">
        <div><Label htmlFor={`edit-customer-${customer.id}-name`}>Customer name</Label><Input id={`edit-customer-${customer.id}-name`} placeholder="Full name" value={name} onChange={(event)=>setName(event.target.value)}/></div>
        <div><Label htmlFor={`edit-customer-${customer.id}-email`}>Email</Label><Input id={`edit-customer-${customer.id}-email`} type="email" placeholder="customer@email.com" value={email} onChange={(event)=>setEmail(event.target.value)}/></div>
        <div><Label htmlFor={`edit-customer-${customer.id}-phone`}>Phone</Label><Input id={`edit-customer-${customer.id}-phone`} inputMode="tel" placeholder="(918) 555-0123" value={phone} onChange={(event)=>setPhone(event.target.value)}/></div>
        <div><Label htmlFor={`edit-customer-${customer.id}-address`}>Service address</Label><Input id={`edit-customer-${customer.id}-address`} placeholder="Tulsa-area address" value={address} onChange={(event)=>setAddress(event.target.value)}/></div>
        <div><Label htmlFor={`edit-customer-${customer.id}-source`}>How they found FIRE</Label><Select value={leadSource} onValueChange={setLeadSource}><SelectTrigger id={`edit-customer-${customer.id}-source`}><SelectValue/></SelectTrigger><SelectContent>{["Referral","Google","Facebook","Website","Repeat customer","Door knocking","Other","Unknown"].map((source)=><SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select></div>
        {error&&<p className="save-error" role="alert">{error}</p>}
        <Button className="brand-button" onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Save changes"}</Button>
      </fieldset></div>
    </DialogContent>
  </Dialog>;
}

const reportChecks=["Property condition documented","Before photos captured","Plants and fragile areas protected","Service completed as quoted","After photos captured","Customer walkthrough completed"];
function OwnerJobTools({estimate,onSaved}:{estimate:EstimateRow;onSaved:(complete:boolean)=>void}){
  const snapshots=useOwnerJobSnapshots();
  return <><JobReport estimate={estimate} onSaved={onSaved} snapshots={snapshots}/><JobCost estimate={estimate} snapshots={snapshots}/></>;
}
function JobReport({estimate,onSaved,snapshots}:{estimate:EstimateRow;onSaved?:(complete:boolean)=>void;snapshots?:OwnerJobSnapshotAccess}){
  const [open,setOpen]=useState(false);const [checks,setChecks]=useState<string[]>([]);const [notes,setNotes]=useState("");const [before,setBefore]=useState("");const [after,setAfter]=useState("");const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const saveLock=useRef(false);const loadRequest=useRef(0);const [retry,setRetry]=useState(0);const [loadError,setLoadError]=useState("");
  const [snapshotAt,setSnapshotAt]=useState<string|null>(null);const [checkedEpoch,setCheckedEpoch]=useState<number|null>(null);const readOnly=Boolean(snapshotAt)||snapshots?.online===false||Boolean(snapshots&&checkedEpoch!==snapshots.networkEpoch);
  const [loadedReportKey,setLoadedReportKey]=useState<string|null>(null);const reportKey=JSON.stringify([estimate.id,estimate.customerId]);
  const setOpenSafe=(value:boolean)=>{if(saveLock.current)return;if(!value)loadRequest.current++;setOpen(value);};
  useEffect(()=>{if(!open)return;const request=++loadRequest.current;setLoading(true);setSaved(false);setError("");setLoadError("");setSnapshotAt(null);let transportFailed=false;void (async()=>{try{
    let response:Response;try{if(snapshots?.online===false)throw new TypeError("Offline");response=await fetch(`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`,{cache:"no-store"});}catch(error){transportFailed=error instanceof TypeError;throw error;}
    if(response.status===401||response.status===403)snapshots?.records.revoke();
    if(!response.ok){snapshots?.records.forget('report',estimate.id,estimate.customerId);throw new Error("Saved report unavailable.");}
    const result=await response.json() as {reports?:JobReportRow[]};
    if(request!==loadRequest.current)return;
    if(!response.ok||!Array.isArray(result?.reports))throw new Error("Invalid saved report response.");
    const report=result.reports[0];let checklist:Record<string,boolean>={};
    if(report){
      if(typeof report!=="object"||Array.isArray(report)||report.estimateId!==estimate.id||report.customerId!==estimate.customerId||typeof report.checklist!=="string"||[report.notes,report.airflowBefore,report.airflowAfter].some(value=>value!=null&&typeof value!=="string"))throw new Error("Invalid saved report.");
      checklist=JSON.parse(report.checklist||"{}");
      if(!checklist||typeof checklist!=="object"||Array.isArray(checklist)||Object.values(checklist).some(value=>typeof value!=="boolean"))throw new Error("Invalid saved checklist.");
    }else if(result.reports.length)throw new Error("Invalid saved report.");
    setChecks(reportChecks.filter(item=>checklist[item]));setNotes(report?.notes||"");setBefore(report?.airflowBefore||"");setAfter(report?.airflowAfter||"");
    setLoadedReportKey(reportKey);setCheckedEpoch(snapshots?.networkEpoch??null);
    snapshots?.records.remember('report',estimate.id,estimate.customerId,report??null);
  }catch{if(request===loadRequest.current){
    const cached=transportFailed?snapshots?.records.read<JobReportRow|null>('report',estimate.id,estimate.customerId):null;
    if(cached){const report=cached.value,checklist=report?JSON.parse(report.checklist||"{}"):{};setChecks(reportChecks.filter(item=>checklist[item]));setNotes(report?.notes||"");setBefore(report?.airflowBefore||"");setAfter(report?.airflowAfter||"");setSnapshotAt(cached.checkedAt);setLoadedReportKey(reportKey);}
    else{if(!transportFailed)snapshots?.records.forget('report',estimate.id,estimate.customerId);setLoadError(transportFailed?"No verified report is available in this app session. Reconnect and load it before editing or saving.":"The saved report could not be loaded. Retry before editing or saving.");}
  }}finally{if(request===loadRequest.current)setLoading(false);}})();return()=>{loadRequest.current++;};},[open,estimate.id,estimate.customerId,retry]);
  const toggle=(item:string)=>{setSaved(false);setChecks((current)=>current.includes(item)?current.filter((value)=>value!==item):[...current,item]);};
  const save=async()=>{
    if(saveLock.current||saving||loading||loadError||loadedReportKey!==reportKey||readOnly||navigator.onLine===false)return;
    saveLock.current=true;snapshots?.records.forget('report',estimate.id,estimate.customerId);setSaved(false);setSaving(true);setError("");
    const checklist=Object.fromEntries(reportChecks.map((item)=>[item,checks.includes(item)]));
    const complete=checks.length===reportChecks.length;
    try{
      const response=await fetch("/api/job-reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,customerId:estimate.customerId,checklist,notes,airflowBefore:before,airflowAfter:after,status:complete?"complete":"draft"})});
      const result=await response.json() as {report?:JobReportRow;error?:string};
      if(!response.ok)throw new Error(result?.error||"The report could not be saved.");
      const report=result?.report;
      const unconfirmed="The saved report could not be confirmed. Keep your notes and reopen the report online before retrying.";
      if(!report||typeof report.id!=="string"||!report.id.trim()||report.estimateId!==estimate.id||report.customerId!==estimate.customerId||report.status!==(complete?"completed":"draft")||(report.notes??"")!==notes||(report.airflowBefore??"")!==before||(report.airflowAfter??"")!==after||typeof report.checklist!=="string")throw new Error(unconfirmed);
      let confirmed:Record<string,boolean>;
      try{confirmed=JSON.parse(report.checklist);}catch{throw new Error(unconfirmed);}
      if(!confirmed||typeof confirmed!=="object"||Array.isArray(confirmed)||Object.keys(confirmed).length!==reportChecks.length||reportChecks.some(item=>confirmed[item]!==checklist[item]))throw new Error(unconfirmed);
      setSaved(true);onSaved?.(complete);
    }catch(saveError){setError(saveError instanceof Error?saveError.message:"The report could not be saved.");}
    finally{saveLock.current=false;setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}>
    <DialogTrigger asChild><Button variant="outline"><ClipboardList className="h-4 w-4"/> Job report</Button></DialogTrigger>
    <DialogContent className="fire-job-dialog sm:max-w-[640px]">
      <DialogHeader className="fire-job-header"><DialogTitle>Service completion report</DialogTitle><p className="fire-job-context" title={`${estimate.customer} · ${estimate.service}`}>{estimate.customer} · {estimate.service}</p></DialogHeader>
      <div className="fire-job-scroll" role="region" aria-label="Job report fields" tabIndex={0}><div className="job-report">
        {readOnly&&!loading&&!loadError&&loadedReportKey===reportKey&&<p className="offline-job-status" role="status">Read-only session snapshot{snapshotAt?` · last checked ${new Date(snapshotAt).toLocaleString()}`:""}. Reconnect and reload before editing. Not saved for offline restart.<Button variant="outline" disabled={snapshots?.online===false} onClick={()=>setRetry(value=>value+1)}>Reload report online</Button></p>}
        <p>{loading||loadedReportKey!==reportKey?"Loading saved report…":"Document completed work before leaving the property. Reopening updates this same report."}</p>
        {loadError&&<p className="save-error" role="alert">{loadError}<Button variant="outline" onClick={()=>setRetry(value=>value+1)}>Retry loading report</Button></p>}
        {!loading&&!loadError&&loadedReportKey===reportKey&&<>
          <div className="report-progress" role="status">
            <strong>{checks.length} of {reportChecks.length} checklist items complete</strong>
            <span>{checks.length===reportChecks.length?"Ready to save as completed":"Incomplete checklist saves as draft"}</span>
          </div>
          <div className="checklist" role="group" aria-label="Completion checklist">{reportChecks.map((item)=><label key={item}>
            <input type="checkbox" checked={checks.includes(item)} disabled={saving||loading||readOnly}
              onChange={()=>toggle(item)}/><span>{item}</span>
          </label>)}</div>
          {estimate.service.toLowerCase().includes("dryer")&&<div className="airflow-fields">
            <label className="fire-field"><span>Airflow before (optional)</span><Input disabled={saving||readOnly} value={before} onChange={(event)=>{setBefore(event.target.value);setSaved(false);}} placeholder="Before reading"/></label>
            <label className="fire-field"><span>Airflow after (optional)</span><Input disabled={saving||readOnly} value={after} onChange={(event)=>{setAfter(event.target.value);setSaved(false);}} placeholder="After reading"/></label>
          </div>}
          <div className="fire-field"><label htmlFor={`fire-job-report-notes-${estimate.id}`}>Technician notes</label>
            <Textarea id={`fire-job-report-notes-${estimate.id}`} readOnly={saving||readOnly} value={notes}
              onChange={(event)=>{setNotes(event.target.value);setSaved(false);}}
              placeholder="Condition, work performed, exceptions, recommendations…" rows={4}/>
          </div>

        </>}
      </div></div>
      {!loading&&!loadError&&loadedReportKey===reportKey&&<div className="fire-job-footer">          <div className="fire-job-feedback">{saving&&<p role="status">Saving report. Keep this window open until confirmation.</p>}
          {saved&&<p className="save-success" role="status">Job report saved.</p>}
          {error&&<p className="save-error" role="alert">{error}</p>}
          </div><Button className="brand-button fire-job-save" onClick={()=>void save()} disabled={saving||loading||readOnly}>
            {saving?"Saving…":checks.length===reportChecks.length?"Save completed report":"Save draft report"}
          </Button>
          <p className="report-footnote">This form does not charge the customer or create an invoice.</p>
      </div>}
    </DialogContent>
  </Dialog>;
}

function JobCost({estimate,snapshots}:{estimate:EstimateRow;snapshots?:OwnerJobSnapshotAccess}){
  const [open,setOpen]=useState(false);const [rows,setRows]=useState<ExpenseRow[]>([]);const [description,setDescription]=useState("");const [amount,setAmount]=useState("");const [category,setCategory]=useState("Supplies");const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState("");const [saveSuccess,setSaveSuccess]=useState("");
  const billingTotal=resolvedBillingTotalCents(estimate);
  const loadRequest=useRef(0);const currentJob=useRef<string|null>(null);const saveLock=useRef(false);const [loading,setLoading]=useState(false);const [loadError,setLoadError]=useState("");const [loadedJob,setLoadedJob]=useState<string|null>(null);
  const [snapshotAt,setSnapshotAt]=useState<string|null>(null);const [checkedEpoch,setCheckedEpoch]=useState<number|null>(null);const readOnly=Boolean(snapshotAt)||snapshots?.online===false||Boolean(snapshots&&checkedEpoch!==snapshots.networkEpoch);
  const setOpenSafe=(value:boolean)=>{if(saveLock.current)return;if(!value){currentJob.current=null;loadRequest.current++;}else{setLoading(true);setLoadError("");}setOpen(value);};
  const load=async()=>{
    if(currentJob.current!==estimate.id)return;
    const request=++loadRequest.current;setLoading(true);setLoadError("");setSnapshotAt(null);let transportFailed=false;
    try{let response:Response;try{if(snapshots?.online===false)throw new TypeError("Offline");response=await fetch("/api/expenses",{cache:"no-store"});}catch(error){transportFailed=error instanceof TypeError;throw error;}
      if(response.status===401||response.status===403)snapshots?.records.revoke();
      if(!response.ok){snapshots?.records.forget('costs',estimate.id,estimate.customerId);throw new Error("Job costs unavailable.");}
      const result=await response.json() as {expenses?:ExpenseRow[]};
      if(request!==loadRequest.current)return;
      if(!response.ok||!Array.isArray(result?.expenses))throw new Error("Invalid expense response.");
      const next=result.expenses.map(row=>{
        const rawAmount:unknown=row?.amountCents;
        if(!row||typeof row!=="object"||Array.isArray(row)||typeof row.id!=="string"||!row.id.trim()||(row.estimateId!=null&&typeof row.estimateId!=="string")||typeof row.description!=="string"||typeof row.category!=="string"||(typeof rawAmount!=="number"&&typeof rawAmount!=="string")||(typeof rawAmount==="string"&&!rawAmount.trim()))throw new Error("Invalid expense record.");
        const amountCents=Number(rawAmount);if(!Number.isSafeInteger(amountCents)||amountCents<0)throw new Error("Invalid expense amount.");return {...row,amountCents};
      }).filter(row=>row.estimateId===estimate.id);
      if(!Number.isSafeInteger(next.reduce((sum,row)=>sum+row.amountCents,0)))throw new Error("Invalid expense total.");
      setRows(next);setLoadedJob(estimate.id);setCheckedEpoch(snapshots?.networkEpoch??null);
      snapshots?.records.remember('costs',estimate.id,estimate.customerId,next);
    }catch{if(request===loadRequest.current){const cached=transportFailed?snapshots?.records.read<ExpenseRow[]>('costs',estimate.id,estimate.customerId):null;
      if(cached){setRows(cached.value);setLoadedJob(estimate.id);setSnapshotAt(cached.checkedAt);}
      else{if(!transportFailed)snapshots?.records.forget('costs',estimate.id,estimate.customerId);setLoadError(transportFailed?"No verified costs are available in this app session. Reconnect and load them before reviewing profit or adding a cost.":"Job costs could not be loaded. Retry before reviewing profit or adding a cost.");}
    }}finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{if(!open)return;currentJob.current=estimate.id;void load();return()=>{currentJob.current=null;loadRequest.current++;};},[open,estimate.id,estimate.customerId]);const total=rows.reduce((sum,row)=>sum+row.amountCents,0);
  const add=async()=>{
    if(saveLock.current||saving||readOnly||navigator.onLine===false||currentJob.current!==estimate.id)return;
    setSaveError("");setSaveSuccess("");
    const entered=amount.trim();
    if(!description.trim()){setSaveError("Enter a description for this job cost.");return;}
    if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(entered)){
      setSaveError("Enter an amount in dollars with no more than two decimal places.");return;
    }
    const [dollars,cents=""]=entered.split(".");
    const calculated=BigInt(dollars)*BigInt(100)+BigInt(cents.padEnd(2,"0"));
    if(calculated<=BigInt(0)||calculated>BigInt(Number.MAX_SAFE_INTEGER)){
      setSaveError("Enter a valid positive expense amount.");return;
    }
    const amountCents=Number(calculated),jobId=estimate.id,customerId=estimate.customerId;
    saveLock.current=true;setSaving(true);
    try{
      const response=await fetch("/api/expenses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:jobId,category,description:description.trim(),amountCents,incurredAt:new Date().toISOString()})});
      const result=await response.json() as {expense?:ExpenseRow;error?:string};
      if(!response.ok)throw new Error(result.error||"This job cost could not be saved.");
      if(!result.expense||result.expense.estimateId!==jobId||Number(result.expense.amountCents)!==amountCents||!result.expense.id)
        throw new Error("The saved expense could not be confirmed. Review the job costs before trying again.");
      snapshots?.records.forget('costs',jobId,customerId);
      if(currentJob.current===jobId){
        setDescription("");setAmount("");setSaveSuccess("Cost recorded.");
        await load();
      }
    }catch(error){
      if(currentJob.current===jobId)setSaveError(error instanceof Error?error.message+" Refresh the list before attempting another entry.":"The result is uncertain. Refresh the list before attempting another entry.");
    }finally{saveLock.current=false;if(currentJob.current===jobId)setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}>
    <DialogTrigger asChild><Button variant="outline"><CircleDollarSign className="h-4 w-4"/> Job costs</Button></DialogTrigger>
    <DialogContent className="fire-job-dialog sm:max-w-[640px]" aria-describedby={undefined}>
      <DialogHeader className="fire-job-header"><DialogTitle>Job costs &amp; profit</DialogTitle><p className="fire-job-context" title={`${estimate.customer} · ${estimate.service}`}>{estimate.customer} · {estimate.service}</p></DialogHeader>
      <div className="fire-job-scroll" role="region" aria-label="Job cost details" tabIndex={0}><div className="job-cost">
        {readOnly&&!loading&&!loadError&&loadedJob===estimate.id&&<p className="offline-job-status" role="status">Read-only session snapshot{snapshotAt?` · last checked ${new Date(snapshotAt).toLocaleString()}`:""}. Costs and profit may have changed. Reconnect and reload before adding costs. Not saved for offline restart.<Button variant="outline" disabled={snapshots?.online===false} onClick={()=>void load()}>Reload costs online</Button></p>}
        {loading||(loadedJob!==estimate.id&&!loadError)?<p role="status">Loading job costs…</p>:loadError?<p className="save-error" role="alert">{loadError}<Button variant="outline" onClick={()=>void load()}>Retry loading costs</Button></p>:<>
          <div className="profit-summary" aria-label="Job financial summary">
            <span><small>{estimate.invoiceId?"Final invoice":"Estimate"}</small><strong>{money(billingTotal)}</strong></span>
            <span><small>Recorded costs</small><strong>{money(total)}</strong></span>
            <span><small>Estimated gross profit</small><strong>{money(billingTotal-total)}</strong></span>
          </div>
          {!readOnly&&<div className="cost-form">
            <label className="fire-field"><span>Category</span><Select value={category} onValueChange={setCategory} disabled={saving}><SelectTrigger aria-label="Expense category"><SelectValue/></SelectTrigger><SelectContent>{["Supplies","Chemicals","Equipment","Fuel","Labor","Other"].map((item)=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></label>
            <label className="fire-field cost-description"><span>What was purchased or used?</span><Input id={`job-cost-entry-${estimate.id}`} value={description} disabled={saving} maxLength={240} onChange={(event)=>{setDescription(event.target.value);setSaveError("");}} placeholder="e.g. Sodium hypochlorite"/></label>
            <label className="fire-field"><span>Amount (USD)</span><Input value={amount} disabled={saving} onChange={(event)=>{setAmount(event.target.value);setSaveError("");}} inputMode="decimal" placeholder="0.00"/></label>
            <Button className="brand-button cost-submit" onClick={()=>void add()} disabled={saving||!description.trim()||!amount.trim()}>{saving?"Saving cost…":"Add cost"}</Button>
          </div>}
          {saveError&&<p className="save-error" role="alert">{saveError}</p>}
          {saveSuccess&&!saveError&&<p className="save-success" role="status">{saveSuccess}</p>}
          <h3 id={`job-cost-records-${estimate.id}`} className="job-record-heading" tabIndex={-1}>Saved costs ({rows.length})</h3><div className="cost-list" aria-label="Recorded expenses">{rows.map((row)=><div key={row.id}><span><strong>{row.description}</strong><small>{row.category}</small></span><b>{money(row.amountCents)}</b></div>)}{!rows.length&&<p>No job costs recorded yet.</p>}</div>
        </>}
      </div></div>
      <div className="fire-job-footer fire-cost-footer">
        {!readOnly&&!loadError&&loadedJob===estimate.id&&<Button variant="outline" disabled={saving||loading} onClick={()=>{const input=document.getElementById(`job-cost-entry-${estimate.id}`);input?.scrollIntoView({block:"center"});input?.focus({preventScroll:true});}}>Cost entry</Button>}
        {!loadError&&loadedJob===estimate.id&&<Button variant="outline" disabled={loading} onClick={()=>{const heading=document.getElementById(`job-cost-records-${estimate.id}`);heading?.scrollIntoView({block:"start"});heading?.focus({preventScroll:true});}}>Saved costs</Button>}
        <Button variant="outline" className="cost-refresh" disabled={saving||loading||snapshots?.online===false} onClick={()=>void load()}>Refresh saved costs</Button>
      </div>
    </DialogContent>
  </Dialog>;
}


function RefundPayment({payment,onRefunded}:{payment:PaymentRow;onRefunded?:()=>void}){
  const refundable=Math.max(0,Number(payment.pendingRefundAmountCents??payment.refundableCents??0));
  const stripe=Boolean(Number(payment.stripePayment));
  const [open,setOpen]=useState(false);
  const [amount,setAmount]=useState("");
  const [note,setNote]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [requestId,setRequestId]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [submitted,setSubmitted]=useState(false);
  const activeRefund=useRef<RefundRetryAttempt|null>(null);
  // Safari may reject localStorage in restricted sessions. Keep the same ID at
  // least across dialog closing in memory, even when persistence is disabled.
  const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
  const openChange=(value:boolean)=>{
    setOpen(value);
    if(value){
      const pending=payment.pendingRefundId&&Number.isSafeInteger(Number(payment.pendingRefundAmountCents))&&Number(payment.pendingRefundAmountCents)>0
        ?{requestId:payment.pendingRefundId,amountCents:Number(payment.pendingRefundAmountCents)}:null;
      const previous=pending??activeRefund.current??loadRefundRetry(storage(),payment.id);
      const retry=previous&&previous.amountCents>0?previous:null;
      if(retry)activeRefund.current=retry;
      setSubmitted(Boolean(retry));
      setAmount(((retry?.amountCents??refundable)/100).toFixed(2));
      setNote("");
      setConfirmed(false);
      setRequestId(retry?.requestId??crypto.randomUUID());
      setError("");
      setMessage(retry?"Existing refund attempt found. Verify this SAME request rather than submitting a second refund.":"");
    }
  };
  const submit=async()=>{
    const amountCents=Math.round(Number(amount)*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>refundable){setError(`Enter a refund up to ${money(refundable)}.`);return;}
    if(!stripe&&!confirmed){setError("Send the refund through the original/manual payment method first, then confirm it here.");return;}
    if(!requestId){setError("Refund request identity is missing. Close and reopen this refund before submitting.");return;}
    const attempt={requestId,amountCents};
    activeRefund.current=attempt;
    // Write before any network request: Stripe may commit and lose the response.
    // Reopening or restarting then reuses the same provider idempotency key.
    saveRefundRetry(storage(),payment.id,attempt);
    setSubmitted(true);setSaving(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/payments/refund",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({paymentId:payment.id,requestId,amountCents,externalRefundConfirmed:!stripe&&confirmed,note})});
      const result=await response.json() as {ok?:boolean;pending?:boolean;mode?:string;paidCents?:number;error?:string};
      if(!response.ok&&!result.pending)throw new Error(result.error||"The refund could not be completed.");
      if(result.pending){setMessage("Stripe accepted the refund and it is still processing. Retry here to check the same request; FIRE will reconcile it when Stripe confirms completion.");return;}
      if(!result.ok)throw new Error("Refund confirmation is incomplete. Review history before attempting another refund.");
      // Only a verified completed acknowledgement clears the persisted ID.
      clearRefundRetry(storage(),payment.id);activeRefund.current=null;
      setMessage(stripe?"Stripe refund completed and FIRE billing was updated.":"Manual refund recorded and FIRE billing was updated.");
      onRefunded?.();
      window.setTimeout(()=>setOpen(false),450);
    }catch(refundError){setError((refundError instanceof Error?refundError.message:"The refund could not be completed.")+" Retry this SAME refund request; do not send the money twice.");}
    finally{setSaving(false);}
  };
  if(refundable<=0||payment.amountCents<=0)return null;
  return <Dialog open={open} onOpenChange={openChange}>
    <Button className="payment-refund-action" variant="outline" onClick={()=>openChange(true)}>{payment.pendingRefundId?"Check refund":"Refund"}</Button>
    <DialogContent className="sm:max-w-[520px] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Refund payment</DialogTitle></DialogHeader>
      <div className="payment-form">
        <p className="payment-estimate-summary"><strong>{payment.customer||"Customer"}</strong><br/><span>{money(refundable)} still refundable from this {paymentTypeLabel(payment.type)} payment.</span></p>
        <div><Label>Refund amount</Label><Input disabled={submitted} value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="0.00"/></div>
        <div><Label>Refund note</Label><Input disabled={submitted} value={note} onChange={(event)=>setNote(event.target.value)} placeholder="Reason or internal note"/></div>
        {stripe?<p className="pay-note"><strong>Stripe payment:</strong> FIRE will submit this refund to Stripe and automatically record the refund when Stripe confirms it.</p>:<label className="payment-refund-confirm"><input type="checkbox" disabled={submitted} checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)}/><span>I already returned this money to the customer outside FIRE (Cash App, Venmo, cash, check, bank, Wave, or other method).</span></label>}
        {error&&<p className="save-error">{error}</p>}
        {message&&<p className="save-success">{message}</p>}
        <Button className="brand-button" onClick={()=>void submit()} disabled={saving}>{saving?"Processing…":stripe?`Refund ${money(Math.round(Number(amount||0)*100))} through Stripe`:"Record completed refund"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function ProcessingDetails({payment}:{payment:PaymentRow}) {
  if(payment.grossReceivedCents==null||!["Cash App","Venmo"].includes(payment.processingMethod??""))return null;
  return <small className="payment-handle-note">{payment.bundledTipCents?<>Invoice payment: {money(payment.amountCents)} · Tip: {money(payment.bundledTipCents)}<br/></>:null}Customer payment: {money(payment.grossReceivedCents)}<br/>Processing fee: {payment.processingFeeCents==null?"Not recorded":`−${money(payment.processingFeeCents)}`}<br/>Net received{payment.processingFeeCents==null?" before unrecorded fees":""}: {money(payment.grossReceivedCents-(payment.processingFeeCents??0))}</small>;
}
function ProcessingReport({payments}:{payments:PaymentRow[]}) {
 const fees=payments.reduce((sum,row)=>sum+(row.processingFeeCents??0),0);
 return <details className="business-panel"><summary>Processing fees · {money(fees)} recorded</summary><p>Gross includes tips; fees are expenses. Unrecorded fees are excluded. Refunds remain separate ledger entries; original fees are retained.</p><div className="processing-report-scroll" role="region" aria-label="Processing fees by payment method" tabIndex={0}><table className="processing-report-table"><thead><tr><th scope="col">Method</th><th scope="col">Gross</th><th scope="col">Fees</th><th scope="col">Net</th></tr></thead><tbody>{["Cash App","Venmo"].map(method=>{const totals=summarizeProcessing(payments,method);return <tr key={method}><th scope="row">{method}</th><td>{money(totals.gross)}{totals.tips>0&&<small style={{display:"block"}}>Tips {money(totals.tips)}</small>}</td><td>{money(totals.fees)}</td><td>{money(totals.net)}</td></tr>;})}</tbody></table></div></details>;
}

function RecordPayment({estimate,onRecorded}:{estimate:Pick<EstimateRow,"id"|"customer"|"service"|"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"depositCents"|"status"|"invoiceTotalCents">>;onRecorded?:(paidCents:number)=>void}){
  const [tipChoice,setTipChoice]=useState<"0"|"5"|"10"|"15"|"custom">("0");
  const [fee,setFee]=useState("");const [feeMode,setFeeMode]=useState<"fee"|"net">("fee");const [feeEstimate,setFeeEstimate]=useState<number|null>(null);const [open,setOpen]=useState(false);const [amount,setAmount]=useState("");const [tip,setTip]=useState("");const [method,setMethod]=useState("Wave");const [reference,setReference]=useState("");const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const manualRequestId=useRef<string|null>(null);
  const paymentLock=useRef(false);
  const activeManual=useRef<ManualPaymentAttempt|null>(null);
  const [retryPending,setRetryPending]=useState(false);
  const [reviewedMissing,setReviewedMissing]=useState(false);
  const [retryConfirmed,setRetryConfirmed]=useState(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const storage=()=>{try{return window.localStorage;}catch{return undefined;}};
  const billingTotal=estimate.invoiceTotalCents??estimate.totalCents;
  const normalized = {status:estimate.status??"completed",totalCents:billingTotal,depositCents:estimate.depositCents??Math.round(estimate.totalCents/2),paidCents:estimate.paidCents,invoiceTotalCents:estimate.invoiceTotalCents};
  const balance=amountDueNow(normalized);
  const totalRemaining=Math.max(0,normalized.totalCents-normalized.paidCents);
  const depositRemaining=Math.max(0,normalized.depositCents-normalized.paidCents);
  const collectible=normalized.status==="completed"||["approved","scheduled"].includes(normalized.status);
  const paymentEntryLabel=retryPending?"Check payment status":!collectible?(["draft","sent","viewed"].includes(normalized.status)?"Approval required":"Payment unavailable"):balance>0?"Record payment":normalized.status==="completed"?"Record tip":normalized.depositCents===0?"No deposit required":"Deposit recorded";
  useEffect(()=>{if(!open){setRetryPending(Boolean(activeManual.current??loadManualPaymentRetry(storage(),estimate.id)));return;}
    const previous=activeManual.current??loadManualPaymentRetry(storage(),estimate.id);
    if(previous){
      activeManual.current=previous;manualRequestId.current=previous.requestId;
      setRetryPending(true);
      setAmount((previous.amountCents/100).toFixed(2));
      setTip(previous.tipCents>0?(previous.tipCents/100).toFixed(2):"");
      setTipChoice(previous.tipCents>0?"custom":"0");
      setMethod(previous.method);setReference(previous.reference);
      setFeeMode("fee");setFee(previous.processingFeeCents===null?"":(previous.processingFeeCents/100).toFixed(2));
      setError("An earlier payment attempt needs confirmation. Check its saved status before retrying the same request. Keep its original details unchanged.");
    }else{
      setRetryPending(false);setAmount(balance>0?(balance/100).toFixed(2):"");
      setTip("");setTipChoice("0");setFee("");setFeeEstimate(null);setError("");
    }
    setReviewedMissing(false);setRetryConfirmed(false);
  },[open,balance,estimate.id]);
  const feeMethod=method==="Cash App"||method==="Venmo";
  const grossCents=Math.round(Number(amount||0)*100)+Math.round(Number(tip||0)*100);
  const enteredFeeCents=fee===""?null:Math.round(Number(fee)*100);
  const processingFeeCents=enteredFeeCents==null?null:feeMode==="fee"?enteredFeeCents:grossCents-enteredFeeCents;
  const feeValid=processingFeeCents==null||Number.isSafeInteger(processingFeeCents)&&processingFeeCents>=0&&processingFeeCents<=grossCents;
  const checkStored=async(attempt:ManualPaymentAttempt)=>{
    const requestId=attempt.requestId;
    const response=await fetch(`/api/payments/confirmation?estimateId=${encodeURIComponent(estimate.id)}&requestId=${encodeURIComponent(requestId)}`,{cache:"no-store"});
    const result=await response.json() as {error?:string;confirmed?:boolean;records?:unknown[];estimateId?:string;requestId?:string};
    if(!response.ok)throw new Error(result.error||"Payment status is uncertain.");
    if(result.confirmed===false&&Array.isArray(result.records)&&result.records.length===0&&result.estimateId===estimate.id&&result.requestId===requestId)return null;
    const paid=confirmedManualPayment(result,estimate.id,attempt);
    if(paid===null)throw new Error("The saved payment receipt does not match this attempt. Keep its details and review Payment History.");
    return paid;
  };
  const finishConfirmed=(paid:number)=>{
    clearManualPaymentRetry(storage(),estimate.id);manualRequestId.current=null;activeManual.current=null;
    if(!mounted.current)return;
    setRetryPending(false);setReviewedMissing(false);setRetryConfirmed(false);setOpen(false);
    // The ledger was confirmed on this save/recovery path. Update owner
    // attention sources only now; uncertain requests must not look paid.
    if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
    onRecorded?.(paid);
  };
  const reviewPending=async()=>{
    if(paymentLock.current||!activeManual.current)return;
    paymentLock.current=true;setSaving(true);setError("");setReviewedMissing(false);setRetryConfirmed(false);
    let confirmed:number|null=null;
    try{
      confirmed=await checkStored(activeManual.current);
      if(confirmed===null&&mounted.current){setReviewedMissing(true);setError("No matching ledger receipt was found in this check. This does not prove an in-flight attempt failed. No payment was submitted. You may check again or explicitly retry the original request without changing its details.");}
    }catch(error){if(mounted.current)setError((error instanceof Error?error.message:"Payment status is uncertain.")+" No payment was submitted. Keep the original attempt and check again.");}
    finally{paymentLock.current=false;if(mounted.current)setSaving(false);}
    if(confirmed!==null)finishConfirmed(confirmed);
  };
  const save=async()=>{
    if(paymentLock.current)return;
    if(retryPending&&(!reviewedMissing||!retryConfirmed)){setError("Check the saved payment status first, then explicitly confirm a retry of the original request.");return;}
    const amountCents=Math.round(Number(amount||0)*100),tipCents=Math.round(Number(tip||0)*100);
    const maxTipCents=Math.min(normalized.totalCents,50000);
    if(!Number.isSafeInteger(amountCents)||amountCents<0||!Number.isSafeInteger(tipCents)||tipCents<0||(amountCents<=0&&tipCents<=0)){setError("Enter a payment or tip amount.");return;}
    if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0){setError("This job's tip limit cannot be represented safely.");return;}
    if(tipCents>maxTipCents){setError("Tip cannot exceed the invoice total or $500.");return;}
    if(feeMethod&&!feeValid){setError("Fee and net deposited must be between zero and the customer payment.");return;}
    const requestId=manualRequestId.current??crypto.randomUUID();
    const attempt:ManualPaymentAttempt={requestId,amountCents,tipCents,method,reference,processingFeeCents:feeMethod?processingFeeCents:null};
    if(retryPending&&activeManual.current&&JSON.stringify(activeManual.current)!==JSON.stringify(attempt)){
      setError("A previous payment is unresolved. Its amount, method and reference must remain identical. Review Payment History before creating another payment.");return;
    }
    const wasPending=Boolean(activeManual.current);
    paymentLock.current=true;
    // Save before the POST because D1 may commit and lose its acknowledgement.
    manualRequestId.current=requestId;activeManual.current=attempt;
    saveManualPaymentRetry(storage(),estimate.id,attempt);
    setRetryPending(true);setSaving(true);setError("");
    let confirmed:number|null=null;
    try{
      // An explicit retry checks first. Never automatically repeat a POST.
      if(wasPending)confirmed=await checkStored(attempt);
      if(confirmed===null){
        let postError="Payment confirmation is uncertain.";
        try{
          const response=await fetch("/api/payments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,requestId,amountCents,tipCents,method,reference,processingFeeCents:feeMethod?processingFeeCents:undefined})});
          if(!response.ok){const result=await response.json() as {error?:string;confirmed?:boolean;records?:unknown[];estimateId?:string;requestId?:string};postError=result.error||postError;}
        }catch{/* Read the ledger once even if the response was lost after commit. */}
        confirmed=await checkStored(attempt);
        if(confirmed===null)throw new Error(postError);
      }
    }catch(saveError){if(mounted.current){setReviewedMissing(false);setRetryConfirmed(false);setError((saveError instanceof Error?saveError.message:"Payment status is uncertain.")+" Not confirmed. Check this SAME attempt; do not enter another payment.");}}
    finally{paymentLock.current=false;if(mounted.current)setSaving(false);}
    if(confirmed!==null){
      // A parent refresh failure cannot turn a confirmed payment into a retry.
      finishConfirmed(confirmed);
    }
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" disabled={!retryPending&&(!collectible||balance<=0&&normalized.status!=="completed")}><CircleDollarSign className="h-4 w-4"/>{paymentEntryLabel}</Button></DialogTrigger><DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{balance<=0&&normalized.status==="completed"?"Record tip":"Record payment"}</DialogTitle></DialogHeader><div className="payment-form">
    <p className="payment-estimate-summary"><strong>{estimate.customer}</strong> · {estimate.service}<br/><span>{money(totalRemaining)} remaining</span></p>{retryPending&&<section className="pending-payment-review" role="status"><strong>Payment pending confirmation</strong><span>Request {activeManual.current?.requestId}</span><p>This attempt is not proof of payment. Displayed balances are the last loaded amounts until the ledger confirms the result. Checking status never records a payment.</p></section>}
    <div className="payment-due-options"><span><small>Deposit due</small><strong>{money(depositRemaining)}</strong></span><span><small>Full balance</small><strong>{money(totalRemaining)}</strong></span></div>
    <div><Label>Amount applied to invoice</Label><Input disabled={saving||retryPending} value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="0.00"/></div>{normalized.status==="completed"&&<section className="final-tip-selector" aria-label="Optional tip choices"><Label>Tip received (optional)</Label><p className="payment-handle-note">No tip is selected by default. Percentages use the full invoice total.</p><div className="final-tip-options">{([0,5,10,15] as const).map((percent)=><button key={percent} type="button" disabled={saving||retryPending} aria-pressed={tipChoice===String(percent)} onClick={()=>{setTipChoice(String(percent) as "0"|"5"|"10"|"15");setTip(percent===0?"":(Math.round(billingTotal*percent/100)/100).toFixed(2));}}><strong>{percent===0?"No tip":`${percent}%`}</strong><span>{money(Math.round(billingTotal*percent/100))}</span></button>)}<button type="button" disabled={saving||retryPending} aria-pressed={tipChoice==="custom"} onClick={()=>{setTipChoice("custom");setTip("");}}><strong>Custom</strong><span>Enter amount</span></button></div>{tipChoice==="custom"&&<div><Label>Custom tip amount</Label><Input aria-label="Custom tip amount" disabled={saving||retryPending} value={tip} onChange={(event)=>setTip(event.target.value)} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0.00"/></div>}<small className="payment-handle-note">Recorded separately and does not change the invoice balance.</small></section>}
    <div><Label>Payment method</Label><Select disabled={saving||retryPending} value={method} onValueChange={(value)=>{setMethod(value);setFee("");setFeeEstimate(null);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Wave","Cash App","Venmo","Cash","Check","Card","ACH / bank","Other"].map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><small className="payment-handle-note">Cash App {DEFAULT_CASH_APP_HANDLE} · Venmo {DEFAULT_VENMO_HANDLE}</small></div>
    {feeMethod&&<details><summary>Processing fee (optional)</summary><div className="payment-form"><div><Label>Customer paid (invoice + tip)</Label><Input readOnly value={(grossCents/100).toFixed(2)}/></div><div><Label>Processing fee</Label><Input disabled={saving||retryPending} inputMode="decimal" value={feeMode==="fee"?fee:processingFeeCents==null?"":(processingFeeCents/100).toFixed(2)} placeholder="Not recorded" onChange={event=>{setFeeMode("fee");setFee(event.target.value);}}/></div><div><Label>Net deposited</Label><Input disabled={saving||retryPending} inputMode="decimal" value={feeMode==="net"?fee:processingFeeCents==null?"":((grossCents-processingFeeCents)/100).toFixed(2)} placeholder={(grossCents/100).toFixed(2)} onChange={event=>{setFeeMode("net");setFee(event.target.value);}}/></div><small>Enter the actual fee or net deposit. Invoice credit stays {money(Math.round(Number(amount||0)*100))}.</small>{method==="Venmo"&&<><Button type="button" variant="outline" disabled={saving||retryPending} onClick={()=>setFeeEstimate(Math.round(grossCents*0.019)+10)}>Estimate fee</Button>{feeEstimate!=null&&<div><small>Venmo Business direct-payment estimate: 1.9% + $0.10 = {money(feeEstimate)}. Check the actual transaction; Tap to Pay and rates may differ.</small><Button type="button" variant="outline" disabled={saving||retryPending} onClick={()=>{setFeeMode("fee");setFee((feeEstimate/100).toFixed(2));setFeeEstimate(null);}}>Use this fee</Button></div>}</>}</div></details>}
    <div><Label>Reference or note</Label><Input disabled={saving||retryPending} value={reference} onChange={(event)=>setReference(event.target.value)} placeholder="Wave transaction, check number, or note"/></div>
    {error&&<p className="save-error" role="alert">{error}</p>}{retryPending?<><Button variant="outline" onClick={()=>void reviewPending()} disabled={saving}>{saving?"Checking payment…":"Check saved payment only"}</Button>{reviewedMissing&&<section className="pending-payment-review"><label><input type="checkbox" checked={retryConfirmed} disabled={saving} onChange={event=>setRetryConfirmed(event.target.checked)}/><span>I confirm retrying the original payment request with the same details and request ID.</span></label><Button className="brand-button" onClick={()=>void save()} disabled={saving||!retryConfirmed}>Retry original payment request</Button></section>}</>:<Button className="brand-button" onClick={()=>void save()} disabled={saving}>{saving?"Checking payment…":Number(amount||0)<=0&&Number(tip||0)>0?"Save tip":"Save payment"}</Button>}
  </div></DialogContent></Dialog>;
}


function EditEstimateDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(estimate:EstimateRow)=>void}){
  const [open,setOpen]=useState(false);
  const saveLock=useRef(false);
  const [items,setItems]=useState<EditableEstimateItem[]>([]);
  const [appreciationDiscount,setAppreciationDiscount]=useState(false);
  const [discountMode,setDiscountMode]=useState<DiscountMode>("percent");
  const [discountValue,setDiscountValue]=useState("");
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const hydrate=()=>{
    const source=estimate.items?.length?estimate.items:[{id:"",name:estimate.service,description:estimate.serviceDescription||serviceDescriptionFor(estimate.service),quantity:1,unit:"job",totalCents:estimate.totalCents}];
    setItems(source.map((item)=>{const svc=services.find((entry)=>entry.name===item.name);const qty=Number(item.quantity)||1;return {id:item.id||undefined,serviceId:svc?.id||"custom",name:item.name,description:item.description||serviceDescriptionFor(item.name),quantity:qty,unit:item.unit||svc?.unit||"job",...restoreEditableLineMoney(qty,Number(item.totalCents))};}));
    const appreciation=Boolean(Number(estimate.appreciationDiscount||0));setAppreciationDiscount(appreciation);
    const mode:DiscountMode=estimate.additionalDiscountType==="dollar"?"dollar":"percent";setDiscountMode(mode);
    const stored=Number(estimate.additionalDiscountValue||0);setDiscountValue(stored?mode==="percent"?(stored/100).toString():(stored/100).toFixed(2):"");setError("");
  };
  const setOpenSafe=(value:boolean)=>{if(saveLock.current)return;setOpen(value);if(value)hydrate();};
  const updateItem=(index:number,patch:Partial<EditableEstimateItem>)=>setItems((current)=>current.map((item,i)=>i===index?editMoneyLine(item,patch):item));
  const subtotal=items.reduce((sum,item)=>sum+editableLineTotalCents(item),0);
  const discount=discountMath(subtotal,appreciationDiscount,discountMode,Number(discountValue));
  const addService=()=>setItems((current)=>[...current,{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);
  const save=async()=>{
    if(saveLock.current)return;
    if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitRateCents)||item.unitRateCents<0)){setError("Every service needs a service, quantity, and valid price.");return;}
    const maxPercent=appreciationDiscount?45:50;if(discountMode==="percent"&&(Number(discountValue)||0)>maxPercent){setError(`Additional percentage discount cannot exceed ${maxPercent}% with the current appreciation-discount setting.`);return;}
    if(discountMode==="dollar"&&Math.round((Number(discountValue)||0)*100)>subtotal){setError("Dollar discount cannot exceed the service subtotal.");return;}
    saveLock.current=true;setSaving(true);setError("");try{
      const payloadItems=items.map((item)=>({id:item.id,name:item.name,description:item.description,quantity:item.quantity,unit:item.unit,totalCents:editableLineTotalCents(item)}));
      const response=await fetch(`/api/estimates/${estimate.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({items:payloadItems,appreciationDiscount,additionalDiscountType:discountMode,additionalDiscountValue:Math.round((Number(discountValue)||0)*100)})});
      const result=await response.json() as {estimate?:Partial<EstimateRow>;error?:string};if(!response.ok||!result.estimate)throw new Error(result.error||"Estimate changes could not be saved.");
      onSaved({...estimate,...result.estimate,items:payloadItems.map((item,index)=>({...item,id:item.id||`new-${index}`}))});setOpen(false);
    }catch(saveError){setError(saveError instanceof Error?saveError.message:"Estimate changes could not be saved.");}finally{saveLock.current=false;setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}><DialogTrigger asChild><button type="button"><PenLine/> Edit estimate</button></DialogTrigger><DialogContent className="estimate-edit-dialog sm:max-w-[650px]"><div className="estimate-edit-modal-header"><DialogHeader><DialogTitle>Edit estimate</DialogTitle></DialogHeader></div>
    <div className="estimate-edit-scroll-area" role="region" aria-label="Estimate services and pricing" tabIndex={0}>
    <fieldset disabled={saving} className="contents">
    <div className="estimate-edit-items">{items.map((item,index)=><section className="estimate-edit-service" key={item.id||index}><header><strong>Service {index+1}</strong><button type="button" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove service ${index+1}`}><Trash2/></button></header><div><Label>Service</Label><Select value={item.serviceId} onValueChange={(value)=>{const svc=services.find((entry)=>entry.id===value);if(!svc)return;updateItem(index,{serviceId:value,name:svc.name,description:svc.description,unit:svc.unit,unitRateCents:svc.rate||0,quantity:svc.unit==="job"?1:0});}}><SelectTrigger><SelectValue placeholder="Choose a service"/></SelectTrigger><SelectContent>{services.map((svc)=><SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Service description and expectations</Label><Textarea rows={7} value={item.description} onChange={(event)=>updateItem(index,{description:event.target.value})}/></div><div className="edit-quantity-row"><div><Label>Quantity</Label><Input inputMode="decimal" value={item.quantity||""} onChange={(event)=>updateItem(index,{quantity:Number(event.target.value)})}/></div><span>{item.unit}</span></div><div><Label>Price per unit — adjustable for this job</Label><div className="discount-input"><span>$</span><Input inputMode="decimal" value={item.unitRateCents?String(item.unitRateCents/100):""} onChange={(event)=>updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})}/></div></div><p className="service-description-help">Adjust this job-specific rate if the work or scope changes. Your starting service rate stays unchanged.</p><strong className="edit-line-total">Line total {money(editableLineTotalCents(item))}</strong>{item.preservedLineTotalCents!==undefined&&item.preservedLineTotalCents!==Math.round(item.quantity*item.unitRateCents)&&<p className="service-description-help">This saved line total is preserved exactly. Changing its service, quantity, or price will recalculate it.</p>}</section>)}</div>
    <Button variant="outline" className="w-full" onClick={addService}><Plus className="h-4 w-4"/> Add another service</Button>
    <button type="button" onClick={()=>setAppreciationDiscount((value)=>!value)} className={`discount-row ${appreciationDiscount?"selected":""}`}><span><strong>5% First Responder & Military</strong><small>Year-round appreciation discount</small></span><span className="check-box">{appreciationDiscount&&<Check className="h-4 w-4"/>}</span></button>
    <section className="edit-discount-card"><Label>Additional bundle, promotion, or family discount</Label><div className="discount-mode-row"><Button type="button" variant={discountMode==="percent"?"default":"outline"} onClick={()=>{setDiscountMode("percent");setDiscountValue("");}}>% Percentage</Button><Button type="button" variant={discountMode==="dollar"?"default":"outline"} onClick={()=>{setDiscountMode("dollar");setDiscountValue("");}}>$ Dollar amount</Button></div><div className="discount-input"><span>{discountMode==="percent"?"%":"$"}</span><Input inputMode="decimal" value={discountValue} onChange={(event)=>setDiscountValue(event.target.value)} placeholder="0"/></div><p className="service-description-help">Choose percentage or dollar amount. Percentage discounts stack with the 5% appreciation discount, up to 50% total.</p></section>
    <div className="edit-totals"><span>Service subtotal<strong>{money(subtotal)}</strong></span><span>Discount<strong>−{money(discount.appliedDiscount)}</strong></span><span>Estimate total<strong>{money(discount.total)}</strong></span><span>50% deposit<strong>{money(discount.deposit)}</strong></span></div>
    {subtotal>0&&subtotal-discount.requestedDiscount<15000&&<p className="service-description-help">The $150 minimum job charge is applied automatically.</p>}{error&&<p className="save-error" role="alert">{error}</p>}
    </fieldset>
    </div>
    <div className="estimate-edit-modal-footer"><Button className="brand-button w-full" onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Save estimate changes"}</Button></div>
  </DialogContent></Dialog>;
}


function EditInvoiceDialog({estimate,onSaved}:{estimate:EstimateRow;onSaved:(totalCents:number)=>void}){
  const [open,setOpen]=useState(false);
  const saveLock=useRef(false);
  const [items,setItems]=useState<EditableEstimateItem[]>([]);
  const [discountMode,setDiscountMode]=useState<DiscountMode>("dollar");
  const [discountValue,setDiscountValue]=useState("");
  const [dueMode,setDueMode]=useState<"receipt"|"date">("receipt");
  const [dueDate,setDueDate]=useState("");
  type InvoiceRevisionRow={id:string;subtotalCents:number;discountCents:number;discountType:DiscountMode;discountValue:number;totalCents:number;status:string;dueAt?:string|null;createdAt:string;items:EstimateItemRow[]};
  const [revisions,setRevisions]=useState<InvoiceRevisionRow[]>([]);
  const [expandedRevisionId,setExpandedRevisionId]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const loadRequest=useRef(0);
  const loadedInvoice=useRef<string|null>(null);
  const invoiceKey=JSON.stringify([estimate.id,estimate.invoiceId,estimate.customerId||null]);
  const currentInvoice=useRef(invoiceKey);currentInvoice.current=invoiceKey;
  const [loadError,setLoadError]=useState("");
  useEffect(()=>{currentInvoice.current=invoiceKey;loadedInvoice.current=null;setOpen(false);setItems([]);setRevisions([]);setLoadError("");setLoading(false);return()=>{loadRequest.current++;loadedInvoice.current=null;if(currentInvoice.current===invoiceKey)currentInvoice.current="";};},[invoiceKey]);
  const subtotal=items.reduce((sum,item)=>sum+editableLineTotalCents(item),0);
  const invoiceDiscount=(()=>{if(discountMode==="percent"){const percent=Math.min(50,Math.max(0,Number(discountValue)||0));return Math.round(subtotal*(percent/100));}return Math.min(subtotal,Math.max(0,Math.round((Number(discountValue)||0)*100)));})();
  const total=subtotal>0?Math.max(15000,subtotal-invoiceDiscount):0;
  const updateItem=(index:number,patch:Partial<EditableEstimateItem>)=>setItems((current)=>current.map((item,i)=>i===index?editMoneyLine(item,patch):item));
  const addService=()=>setItems((current)=>[...current,{serviceId:"",name:"",description:"",quantity:0,unit:"unit",unitRateCents:0}]);
  const hydrate=async()=>{
    const request=++loadRequest.current;const key=invoiceKey;
    loadedInvoice.current=null;setItems([]);setRevisions([]);setExpandedRevisionId(null);setLoadError("");
    if(!estimate.invoiceId){setLoadError("This job does not have an invoice to edit.");return;}
    setLoading(true);setError("");
    try{
      const response=await fetch(`/api/invoices/${encodeURIComponent(estimate.invoiceId)}`,{cache:"no-store"});const result=await response.json() as {invoice?:{id?:string;estimateId?:string;customerId?:string;discountType?:DiscountMode;discountValue?:number;dueAt?:string|null;createdAt?:string;items?:EstimateItemRow[];revisions?:InvoiceRevisionRow[]};error?:string};
      if(request!==loadRequest.current||currentInvoice.current!==key)return;
      if(!response.ok||!result?.invoice||result.invoice.id!==estimate.invoiceId||result.invoice.estimateId!==estimate.id||(estimate.customerId&&result.invoice.customerId!==estimate.customerId))throw new Error("Saved invoice identity could not be verified.");
      const source=result.invoice.items;
      if(!Array.isArray(source)||!source.length||source.some((item)=>!item||typeof item.name!=="string"||!item.name.trim()||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.totalCents)||item.totalCents<0))throw new Error("Saved invoice services could not be verified.");
      setItems(source.map((item)=>{const svc=services.find((entry)=>entry.name===item.name);const qty=Number(item.quantity);return {id:item.id,serviceId:svc?.id||"custom",name:item.name,description:item.description||serviceDescriptionFor(item.name),quantity:qty,unit:item.unit||svc?.unit||"job",...restoreEditableLineMoney(qty,Number(item.totalCents))};}));
      const mode=result.invoice.discountType==="percent"?"percent":"dollar";setDiscountMode(mode);const stored=Number(result.invoice.discountValue||0);setDiscountValue(stored?mode==="percent"?(stored/100).toString():(stored/100).toFixed(2):"");
      const rawDue=String(result.invoice.dueAt||"");const dueDay=rawDue?rawDue.slice(0,10):"";const createdDay=String(result.invoice.createdAt||"").slice(0,10);if(!rawDue||(createdDay&&dueDay===createdDay)){setDueMode("receipt");setDueDate("");}else{setDueMode("date");setDueDate(dueDay);}
      setRevisions((result.invoice.revisions??[]).map((revision)=>({...revision,subtotalCents:Number(revision.subtotalCents||0),totalCents:Number(revision.totalCents||0),discountCents:Number(revision.discountCents||0),discountValue:Number(revision.discountValue||0),discountType:revision.discountType==="percent"?"percent":"dollar",items:Array.isArray(revision.items)?revision.items:[]})));
      setExpandedRevisionId(null);loadedInvoice.current=key;setError("");
    }catch{if(request===loadRequest.current&&currentInvoice.current===key){loadedInvoice.current=null;setItems([]);setLoadError("The saved invoice could not be loaded. Reconnect and try again. No invoice changes were submitted.");}}finally{if(request===loadRequest.current&&currentInvoice.current===key)setLoading(false);}
  };
  const setOpenSafe=(value:boolean)=>{if(saveLock.current)return;if(!value){loadRequest.current++;loadedInvoice.current=null;setLoading(false);}setOpen(value);if(value)void hydrate();};
  const save=async()=>{
    if(saveLock.current)return;
    if(!estimate.invoiceId)return;
    if(loadedInvoice.current!==invoiceKey||currentInvoice.current!==invoiceKey){setError("Load the saved invoice before making changes.");return;}
    if(!items.length||items.some((item)=>!item.name||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitRateCents)||item.unitRateCents<0)){setError("Every invoice service needs a service, quantity, and valid price.");return;}
    if(discountMode==="percent"&&(Number(discountValue)||0)>50){setError("Percentage discount cannot exceed 50%.");return;}
    if(discountMode==="dollar"&&Math.round((Number(discountValue)||0)*100)>subtotal){setError("Dollar discount cannot exceed the invoice subtotal.");return;}
    const key=invoiceKey;saveLock.current=true;setSaving(true);setError("");
    try{
      const payloadItems=items.map((item)=>({id:item.id,name:item.name,description:item.description,quantity:item.quantity,unit:item.unit,totalCents:editableLineTotalCents(item)}));
      if(dueMode==="date"&&!dueDate){setError("Choose an invoice due date or select Due on receipt.");setSaving(false);return;}
      const response=await fetch(`/api/invoices/${estimate.invoiceId}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({items:payloadItems,discountType:discountMode,discountValue:Math.round((Number(discountValue)||0)*100),dueAt:dueMode==="receipt"?"receipt":dueDate})});
      const result=await response.json() as {invoice?:{id?:string;totalCents?:number};error?:string};
      if(currentInvoice.current!==key)return;
      if(!response.ok)throw new Error(result?.error||"Invoice changes could not be saved.");
      if(!result?.invoice||result.invoice.id!==estimate.invoiceId||!Number.isSafeInteger(result.invoice.totalCents)||Number(result.invoice.totalCents)<0)throw new Error("The save response could not be verified. Reopen this invoice to check its saved values before trying again.");
      onSaved(Number(result.invoice.totalCents));setOpen(false);
    }catch(saveError){if(currentInvoice.current===key)setError(saveError instanceof Error?saveError.message:"Invoice changes could not be saved.");}finally{saveLock.current=false;setSaving(false);}
  };
  return <Dialog open={open} onOpenChange={setOpenSafe}><DialogTrigger asChild><button type="button"><PenLine/> Edit invoice</button></DialogTrigger><DialogContent className="estimate-edit-dialog invoice-edit-fields sm:max-w-[650px]"><div className="estimate-edit-modal-header"><DialogHeader><DialogTitle>Edit final invoice</DialogTitle></DialogHeader></div>
    <div className="estimate-edit-scroll-area" role="region" aria-label="Invoice services and payment terms" tabIndex={0}>
    <fieldset disabled={saving} className="contents">
    {loading?<div className="customers-state" role="status">Loading saved invoice…</div>:loadError?<div className="customers-state"><p className="save-error" role="alert">{loadError}</p><Button variant="outline" className="min-h-11" onClick={()=>void hydrate()}>Try loading invoice again</Button></div>:loadedInvoice.current!==invoiceKey?<div className="customers-state" role="status">Loading saved invoice…</div>:<>
    <p className="service-description-help">Add last-minute services or adjust the final discount without changing the original accepted estimate. Recorded payments are preserved.</p>
    <div className="estimate-edit-items">{items.map((item,index)=><section className="estimate-edit-service" key={item.id||index}><header><strong>Service {index+1}</strong>{items.length>1&&<button type="button" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove invoice service ${index+1}`}><Trash2/></button>}</header><div><Label htmlFor={`invoice-${estimate.invoiceId}-${index}-service`}>Service</Label><Select value={item.serviceId} onValueChange={(value)=>{const svc=services.find((entry)=>entry.id===value);if(!svc)return;updateItem(index,{serviceId:value,name:svc.name,description:svc.description,unit:svc.unit,unitRateCents:svc.rate||0,quantity:svc.unit==="job"?1:0});}}><SelectTrigger id={`invoice-${estimate.invoiceId}-${index}-service`}><SelectValue placeholder="Choose a service"/></SelectTrigger><SelectContent>{services.map((svc)=><SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor={`invoice-${estimate.invoiceId}-${index}-description`}>Service description and expectations</Label><Textarea id={`invoice-${estimate.invoiceId}-${index}-description`} rows={6} value={item.description} onChange={(event)=>updateItem(index,{description:event.target.value})}/></div><div className="edit-quantity-row"><div><Label htmlFor={`invoice-${estimate.invoiceId}-${index}-quantity`}>Quantity</Label><Input id={`invoice-${estimate.invoiceId}-${index}-quantity`} inputMode="decimal" value={item.quantity||""} onChange={(event)=>updateItem(index,{quantity:Number(event.target.value)})}/></div><span>{item.unit}</span></div><div><Label htmlFor={`invoice-${estimate.invoiceId}-${index}-rate`}>Price per unit — adjustable for this invoice</Label><div className="discount-input"><span>$</span><Input id={`invoice-${estimate.invoiceId}-${index}-rate`} inputMode="decimal" value={item.unitRateCents?String(item.unitRateCents/100):""} onChange={(event)=>updateItem(index,{unitRateCents:Math.max(0,Math.round((Number(event.target.value)||0)*100))})}/></div></div><p className="service-description-help">Adjust this job-specific rate if the work or scope changes. Your starting service rate stays unchanged.</p><strong className="edit-line-total">Line total {money(editableLineTotalCents(item))}</strong>{item.preservedLineTotalCents!==undefined&&item.preservedLineTotalCents!==Math.round(item.quantity*item.unitRateCents)&&<p className="service-description-help">This saved line total is preserved exactly. Changing its service, quantity, or price will recalculate it.</p>}</section>)}</div>
    <Button variant="outline" className="w-full" onClick={addService}><Plus className="h-4 w-4"/> Add another service</Button>
    <section className="edit-discount-card"><Label id={`invoice-${estimate.invoiceId}-due-label`}>Payment due</Label><div className="discount-mode-row"><Button type="button" aria-pressed={dueMode==="receipt"} variant={dueMode==="receipt"?"default":"outline"} onClick={()=>{setDueMode("receipt");setDueDate("");}}>Due on receipt</Button><Button type="button" aria-pressed={dueMode==="date"} variant={dueMode==="date"?"default":"outline"} onClick={()=>setDueMode("date")}>Specific date</Button></div>{dueMode==="date"&&<Input aria-labelledby={`invoice-${estimate.invoiceId}-due-label`} type="date" value={dueDate} onChange={(event)=>setDueDate(event.target.value)}/>}</section>
    <section className="edit-discount-card"><Label htmlFor={`invoice-${estimate.invoiceId}-discount`}>Final invoice discount</Label><div className="discount-mode-row"><Button type="button" aria-pressed={discountMode==="percent"} variant={discountMode==="percent"?"default":"outline"} onClick={()=>{setDiscountMode("percent");setDiscountValue("");}}>% Percentage</Button><Button type="button" aria-pressed={discountMode==="dollar"} variant={discountMode==="dollar"?"default":"outline"} onClick={()=>{setDiscountMode("dollar");setDiscountValue("");}}>$ Dollar amount</Button></div><div className="discount-input"><span>{discountMode==="percent"?"%":"$"}</span><Input id={`invoice-${estimate.invoiceId}-discount`} inputMode="decimal" value={discountValue} onChange={(event)=>setDiscountValue(event.target.value)} placeholder="0"/></div></section>
    <div className="edit-totals"><span>Invoice subtotal<strong>{money(subtotal)}</strong></span><span>Discount<strong>−{money(Math.max(0,subtotal-total))}</strong></span><span>Invoice total<strong>{money(total)}</strong></span><span>Paid already<strong>{money(estimate.paidCents)}</strong></span></div>
    {subtotal>0&&subtotal-invoiceDiscount<15000&&<p className="service-description-help">The $150 minimum job charge is applied automatically.</p>}
    {revisions.length>0&&<section className="edit-discount-card"><Label>Invoice revision history</Label><p className="service-description-help">Previous invoice versions are retained automatically before each edit. Open a revision to review its prior services and discount.</p><div className="invoice-revision-list">{revisions.slice(0,5).map((revision)=>{const expanded=expandedRevisionId===revision.id;return <div className={expanded?"invoice-revision-row expanded":"invoice-revision-row"} key={revision.id}><button type="button" className="invoice-revision-summary" onClick={()=>setExpandedRevisionId(expanded?null:revision.id)} aria-expanded={expanded}><span><strong>{money(revision.totalCents)}</strong><small>{revision.status} · {dateTime(revision.createdAt)}</small></span><span className="invoice-revision-due"><small>{revision.dueAt?`Due ${new Date(revision.dueAt).toLocaleDateString()}`:"Due on receipt"}</small><ChevronRight className={expanded?"revision-chevron open":"revision-chevron"}/></span></button>{expanded&&<div className="invoice-revision-details"><div className="revision-item-list">{revision.items.map((item,index)=><div key={`${revision.id}-${item.id||index}`}><span><strong>{item.name}</strong><small>{item.description||"No description"}</small></span><small>{Number(item.quantity)||0} {item.unit} · {money(Number(item.totalCents)||0)}</small></div>)}</div><div className="revision-totals"><span>Subtotal<strong>{money(revision.subtotalCents)}</strong></span><span>Discount<strong>−{money(revision.discountCents)}</strong></span><span>Discount mode<strong>{revision.discountType==="percent"?`${(revision.discountValue/100).toFixed(2).replace(/\.00$/,'')}%`:`${money(revision.discountValue)}`}</strong></span><span>Total<strong>{money(revision.totalCents)}</strong></span></div></div>}</div>;})}</div></section>}
    </>}
    </fieldset></div>
    <div className="estimate-edit-modal-footer">{error&&<p className="save-error" role="alert">{error}</p>}{!loading&&!loadError&&loadedInvoice.current===invoiceKey&&<Button className="brand-button w-full" onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Save invoice changes"}</Button>}</div>
  </DialogContent></Dialog>;
}

function EstimateDetail({ estimate, onClose, onChanged }: { estimate: EstimateRow | null; onClose: () => void; onChanged: (estimate: EstimateRow) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [schedule, setSchedule] = useState("");
  const [reportComplete,setReportComplete]=useState(false);
  const [checkingCloseout,setCheckingCloseout]=useState(false);
  const closeoutLock=useRef(false);
  const mutationLock=useRef(false);
  const [refundAmount,setRefundAmount]=useState("");
  useEffect(() => {
    let active=true;
    setReportComplete(false);
    if (!estimate?.scheduledAt) setSchedule("");
    else { const date = new Date(estimate.scheduledAt); setSchedule(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16)); }
    if(!estimate?.id)return ()=>{active=false;};
    void (async()=>{try{const response=await fetch(`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`,{cache:"no-store"});const result=await response.json() as {reports?:JobReportRow[]};const report=Array.isArray(result?.reports)?result.reports[0]:undefined;if(active)setReportComplete(Boolean(response.ok&&report&&report.estimateId===estimate.id&&report.customerId===estimate.customerId&&report.status==="completed"));}catch{if(active)setReportComplete(false);}})();
    return ()=>{active=false;};
  }, [estimate]);
  if (!estimate) return null;
  const update = async (body: Record<string, unknown>) => {
    if(mutationLock.current)return;
    mutationLock.current=true;setSaving(true); setError("");
    try {
      const response = await fetch(`/api/estimates/${estimate.id}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
      const result = await response.json() as { estimate?: {status:string;scheduledAt?:string|null}; error?:string };
      if (!response.ok || !result.estimate) throw new Error(result.error || "The estimate could not be updated.");
      onChanged({ ...estimate, ...result.estimate });
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "The estimate could not be updated."); }
    finally { mutationLock.current=false;setSaving(false); }
  };
  const completeJob=async()=>{
    if(closeoutLock.current||mutationLock.current||saving||checkingCloseout)return;
    closeoutLock.current=true;setCheckingCloseout(true);setError("");
    try{
      const response=await fetch(`/api/job-reports?estimateId=${encodeURIComponent(estimate.id)}`,{cache:"no-store"});
      const result=await response.json() as {reports?:JobReportRow[];error?:string};
      if(!response.ok||!Array.isArray(result?.reports))throw new Error("Report verification unavailable.");
      const report=result.reports[0];
      const complete=Boolean(report&&report.estimateId===estimate.id&&report.customerId===estimate.customerId&&report.status==="completed");
      setReportComplete(complete);
      if(!complete){setError("Complete and save the service completion report for this job before marking it complete.");return;}
      await update({status:"completed"});
    }catch{
      setReportComplete(false);
      setError("The saved report could not be verified. Reconnect and reopen this job before trying again. Job status was not changed.");
    }finally{closeoutLock.current=false;setCheckingCloseout(false);}
  };
  const createInvoice = async () => {
    if(mutationLock.current||closeoutLock.current)return;
    mutationLock.current=true;setSaving(true); setError("");
    try {
      const response = await fetch("/api/invoices", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ estimateId:estimate.id }) });
      const result = await response.json() as { id?:string; shareToken?:string; error?:string };
      if (!response.ok || !result.id) throw new Error(result.error || "The invoice could not be created.");
      onChanged({ ...estimate, invoiceId:result.id, invoiceShareToken:result.shareToken, status:estimate.status === "draft" ? "approved" : estimate.status });
    } catch (invoiceError) { setError(invoiceError instanceof Error ? invoiceError.message : "The invoice could not be created."); }
    finally { mutationLock.current=false;setSaving(false); }
  };
  const encodedAddress = encodeURIComponent(estimate.address || "");
  const zillowAddress = encodeURIComponent((estimate.address || "").trim().replace(/\s+/g,"-"));
  const messageCustomer:CustomerRow={id:estimate.customerId||"",name:estimate.customer,email:estimate.email||"",phone:estimate.phone||"",address:estimate.address||"",createdAt:estimate.createdAt,estimateCount:1,estimateTotal:resolvedBillingTotalCents(estimate),paidTotal:estimate.paidCents};
  const shownDescription=estimate.serviceDescription||serviceDescriptionFor(estimate.service);
  const nextAction=Number(estimate.paymentOverageOpen)>0?"Billing exception: review the overpayment and record the refund or retained overpayment before closing out the customer record.":resolvedBillingTotalCents(estimate)<=estimate.paidCents?"Paid in full — the customer record is complete.":estimate.status==="draft"?"Next: send the estimate and service agreement.":estimate.status==="sent"?"Next: follow up until the customer approves and signs.":estimate.status==="approved"?"Next: choose the job date and save it.":estimate.status==="scheduled"?"Next: capture before photos, complete the job report, then create the invoice.":estimate.status==="completed"&&!estimate.invoiceId?"Next: create and send the final invoice.":estimate.status==="completed"?"Next: send the invoice, record payment, and request a review.":"Review the customer record and choose the next status.";
  const billingTotalCents=estimate.invoiceTotalCents??estimate.totalCents;
  const balanceCents=Math.max(0,billingTotalCents-estimate.paidCents);
  const resolveOverpayment=async(resolutionMode:"refund"|"keep")=>{if(mutationLock.current||closeoutLock.current)return;mutationLock.current=true;setSaving(true);setError("");try{const refundAmountCents=resolutionMode==="refund"?Math.round(Number(refundAmount)*100):undefined;if(resolutionMode==="refund"&&(!refundAmountCents||refundAmountCents<=0))throw new Error("Enter the actual refund amount before marking the refund handled.");const updateResponse=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,resolveOverpayment:true,reconciliationHandled:true,resolutionMode,refundAmountCents})});const result=await updateResponse.json() as {remainingOverpaymentCount?:number;paidCents?:number;error?:string};if(!updateResponse.ok)throw new Error(result.error||"The billing exception could not be resolved.");setRefundAmount("");onChanged({...estimate,paidCents:result.paidCents??estimate.paidCents,paymentOverageOpen:Number(result.remainingOverpaymentCount??Math.max(0,Number(estimate.paymentOverageOpen)-1))});}catch(resolveError){setError(resolveError instanceof Error?resolveError.message:"The billing exception could not be resolved.");}finally{mutationLock.current=false;setSaving(false);}};
  return <Dialog open onOpenChange={(value) => { if (!value&&!mutationLock.current&&!closeoutLock.current) onClose(); }}><DialogContent className="estimate-detail sm:max-w-[650px]">
    <DialogHeader><DialogTitle>{estimate.service}</DialogTitle></DialogHeader>
    <div className="detail-customer"><span className="customer-avatar">{estimate.customer.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase()}</span><div><strong>{estimate.customer}</strong><small>{estimate.address || "No service address saved"}</small></div><strong>{money(resolvedBillingTotalCents(estimate))}</strong></div>
    {estimate.serviceAddressSource==="legacy-current-unverified"&&<p>Current customer address shown; the original service address was not recorded.</p>}
    <div className="detail-scope"><strong>Service scope & expectations</strong><p>{shownDescription}</p></div>
    <div className="next-action"><Sparkles/><div><strong>Recommended next step</strong><p>{nextAction}</p></div></div>

    <div className="detail-actions">
      <EditEstimateDialog estimate={estimate} onSaved={onChanged}/>{estimate.invoiceId&&<EditInvoiceDialog estimate={estimate} onSaved={(invoiceTotalCents)=>onChanged({...estimate,invoiceTotalCents})}/>}
      {estimate.customerId&&<MessageComposer
        customer={messageCustomer}
        estimate={estimate}
        initialTemplate={estimate.invoiceId?"invoice":"estimate"}
        triggerLabel={estimate.invoiceId?"Send invoice":"Send estimate"}
        onSent={!estimate.invoiceId&&estimate.status==="draft"?(_message,status)=>onChanged({...estimate,status:status||estimate.status}):undefined}
      />}
      {estimate.customerId&&estimate.status==="scheduled"&&estimate.scheduledAt&&<MessageComposer customer={messageCustomer} estimate={estimate} initialTemplate="onMyWay" triggerLabel="On my way"/>}
      {estimate.customerId&&estimate.status==="completed"&&Number(estimate.paymentOverageOpen)===0&&estimate.paidCents>=resolvedBillingTotalCents(estimate)&&<MessageComposer customer={messageCustomer} estimate={estimate} initialTemplate="review" triggerLabel={estimate.lastReviewRequestAt?"Review requested":"Request review"} onSent={(message)=>onChanged({...estimate,lastReviewRequestAt:message.createdAt})}/>}
      {estimate.shareToken&&<a href={`/estimate/${encodeURIComponent(estimate.shareToken)}?ownerPreview=1`}><ExternalLink/> Customer view</a>}
      {estimate.invoiceId&&estimate.invoiceShareToken&&<a href={`/invoice/${encodeURIComponent(estimate.invoiceShareToken)}?ownerPreview=1&from=estimate`}><Receipt/> View invoice</a>}
      {estimate.phone && <a href={`tel:${estimate.phone}`}><Phone /> Call</a>}
      {estimate.phone && <a href={`sms:${estimate.phone}`}><Send /> Text</a>}
      {estimate.address && <a className="primary-tool" href={`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`} target="_blank" rel="noreferrer"><Navigation /> Google Maps</a>}
      <StrideButton />
      {estimate.address && <a href={`https://earth.google.com/web/search/${encodedAddress}`} target="_blank" rel="noreferrer"><Globe2 /> Google Earth</a>}
      {estimate.address && <a href={`https://www.zillow.com/homes/${zillowAddress}_rb/`} target="_blank" rel="noreferrer"><House /> Zillow</a>}
      <OwnerJobTools estimate={estimate} onSaved={setReportComplete}/><RecordPayment key={estimate.id} estimate={estimate} onRecorded={(paidCents)=>onChanged({...estimate,paidCents})}/>
    </div>
    <OwnerDepositReview key={estimate.id} estimateId={estimate.id}/>
    <EstimateChangeHistory key={estimate.id} estimateId={estimate.id} onSummary={(pending,latest)=>{if(Number(estimate.pendingChangeCount)!==pending||estimate.latestChangeRequest!==latest)onChanged({...estimate,pendingChangeCount:pending,latestChangeRequest:latest});}}/>
    {Number(estimate.paymentOverageOpen)>0&&<div className="change-alert"><CircleDollarSign/><div><strong>Overpayment needs review</strong><p>If you refunded money, enter the exact amount so FIRE can subtract it from recorded payments. If you and the customer intentionally agreed to leave the excess on this job, use Keep as overpayment. This does not create a reusable customer credit.</p><div className="billing-resolution-actions"><Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Refund amount" value={refundAmount} onChange={(event)=>setRefundAmount(event.target.value)} disabled={saving}/><Button variant="outline" onClick={()=>void resolveOverpayment("refund")} disabled={saving}>Refund handled</Button><Button variant="outline" onClick={()=>void resolveOverpayment("keep")} disabled={saving}>Keep as overpayment</Button></div></div></div>}
    {(estimate.firstViewedAt||estimate.acceptedAt||estimate.signedAt)&&<div className="customer-activity">{estimate.firstViewedAt&&<span><Eye/><small>Viewed</small><strong>{dateTime(estimate.firstViewedAt)}</strong></span>}{estimate.signedAt?<span><PenLine/><small>Agreement signed</small><strong>{estimate.signedName} · Photos: {estimate.photoRelease==="yes"?"allowed":estimate.photoRelease==="no"?"not allowed":"not recorded"} · {dateTime(estimate.signedAt)}</strong></span>:estimate.acceptedAt&&<span><CheckCircle2/><small>Approved</small><strong>{dateTime(estimate.acceptedAt)}</strong></span>}</div>}
    <div className="detail-grid">
      <div><Label>Status</Label><div className="status-readonly" aria-label={`Job status: ${statusLabel(estimate.status)}`}><strong>{statusLabel(estimate.status)}</strong><small>Status advances through sending, customer approval, scheduling, and job completion actions.</small></div></div>
      <div><Label htmlFor="scheduleDate">Job date and time (this device’s local time)</Label><Input id="scheduleDate" type="datetime-local" value={schedule} disabled={saving||checkingCloseout} onChange={(event)=>setSchedule(event.target.value)} onInput={(event)=>setSchedule((event.target as HTMLInputElement).value)} />{schedule&&<Button type="button" variant="outline" className="mt-2 min-h-11" onClick={()=>setSchedule("")} disabled={saving||checkingCloseout}>Clear date/time selection</Button>}{estimate.scheduledAt&&<small className="service-description-help">Clearing this selection does not cancel the saved appointment.</small>}</div>
    </div>
    <div className="detail-summary"><span><small>Deposit</small><strong>{money(estimate.depositCents)}</strong></span><span><small>Paid</small><strong>{money(estimate.paidCents)}</strong></span><span><small>Balance</small><strong>{money(balanceCents)}</strong></span></div>
        {(saving||checkingCloseout)&&<p className="save-message" role="status" aria-live="polite">{checkingCloseout?"Verifying saved job report…":"Saving changes…"} Keep this job open until finished.</p>}
    {error && <p className="save-error" role="alert">{error}</p>}
    <div className="detail-footer">
      <Button variant="outline" onClick={() => {if(closeoutLock.current)return;void update({ scheduledAt:schedule ? new Date(schedule).toISOString() : "" });}} disabled={saving || checkingCloseout || !schedule}><CalendarDays className="h-4 w-4" /> Save job date</Button>
      {estimate.status === "scheduled" && <Button variant="outline" onClick={() => void completeJob()} disabled={saving||checkingCloseout||!reportComplete}><CheckCircle2 className="h-4 w-4" /> {checkingCloseout?"Checking…":reportComplete?"Mark job complete":"Complete report first"}</Button>}
      <Button className="brand-button" onClick={createInvoice} disabled={saving || checkingCloseout || Boolean(estimate.invoiceId) || estimate.status !== "completed"}><Receipt className="h-4 w-4" /> {estimate.invoiceId ? "Invoice created" : estimate.status === "completed" ? "Create invoice" : "Complete job first"}</Button>
    </div>
  </DialogContent></Dialog>;
}


function CustomersView({ onEstimateSaved, searchQuery, focusCustomerId,focusSection="estimates",onFocusHandled,focusRecord,recordRequestKey=0,onRecordFocusHandled,onPreparePickupTask,onPrepareReviewTask,activityFocus,onActivityFocusHandled }: { onEstimateSaved: (estimate: EstimateRow) => void; searchQuery: string;focusCustomerId?:string|null;focusSection?:"estimates"|"invoices"|"payments"|"notes";focusRecord?:CustomerRecordFocus|null;recordRequestKey?:number;onRecordFocusHandled?:(id:string)=>void;onFocusHandled?:(id:string)=>void;onPreparePickupTask?:(draft:YardSignPickupDraft)=>void;onPrepareReviewTask?:(draft:ReviewCheckDraft)=>void;activityFocus?:{customerId:string;kind:"sign"|"review";request:number}|null;onActivityFocusHandled?:(request:number)=>void }) {
  /** Read-only customer flag presentation: owner actions are not automatically external sends. */
  function customerFlagPresentation(input:{
    estimateSent:boolean;estimateMarkedSent?:boolean;hasDraftEstimate?:boolean;invoiceCreated:boolean;invoiceSendConfirmed:boolean;
    followupContactRecorded:boolean;followupSendConfirmed:boolean;
    reviewRequestRecorded:boolean;reviewSendConfirmed:boolean;reviewReceivedAt:string|null;
    sign:{state:"out"|"picked_up";pickupDate:string|null}|null;
    reviewDue:boolean;today:string
  }){
    const needs:string[]=[];
    if(input.sign?.state==="out"&&input.sign.pickupDate&&input.sign.pickupDate<=input.today)needs.push("Yard sign pickup is due");
    if(input.reviewDue&&!input.reviewReceivedAt)needs.push("Review status needs checking");
    return {
      estimate:input.estimateSent?"Sent recorded":input.estimateMarkedSent?"Marked sent · verify":input.hasDraftEstimate?"Draft · not sent":"Not recorded",
      invoice:input.invoiceSendConfirmed?"Send confirmed":input.invoiceCreated?"Created · send not confirmed":"Not created",
      followup:input.followupSendConfirmed?"Send confirmed":input.followupContactRecorded?"Contact recorded":"Not recorded",
      reviewRequest:input.reviewSendConfirmed?"Send confirmed":input.reviewRequestRecorded?"Request recorded":"Not recorded",
      reviewReceived:input.reviewReceivedAt?"Owner logged":"Not logged",
      sign:input.sign?.state==="out"?(input.sign.pickupDate&&input.sign.pickupDate<=input.today?"Pickup due":"Placed · pickup "+(input.sign.pickupDate||"not specified")):input.sign?.state==="picked_up"?"Picked up":"Not logged",
      needs
    };
  }
  /** Chronological, read-only receipts. Never render note bodies or infer delivery from prepared messages. */
  function buildCustomerTimeline(input:{
    estimates:readonly CustomerEstimate[];invoices:readonly InvoiceRow[];
    messages:readonly {message:CustomerMessage;prepared?:CustomerMessage}[];
    notes:readonly CustomerNote[];payments:readonly PaymentRow[]
  }){
    type Section="estimates"|"invoices"|"payments"|"messages"|"notes";
    type Event={key:string;id:string;section:Section;category:"estimates"|"messages"|"billing"|"notes";title:string;detail:string;at:string;day:string;timestamp:number};
    const events:Event[]=[];
    const add=(section:Section,id:string,at:string|undefined|null,title:string,detail:string)=>{
      if(!id||!at)return;
      const timestamp=Date.parse(at);
      if(!Number.isFinite(timestamp))return;
      const category=section==="invoices"||section==="payments"?"billing":section;
      const day=new Date(timestamp).toLocaleDateString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",year:"numeric"});
      events.push({key:section+":"+id+":"+timestamp+":"+title,id,section,category,title,detail,at,day,timestamp});
    };
    for(const estimate of input.estimates){
      add("estimates",estimate.id,estimate.createdAt,"Estimate created",estimate.service||"Saved estimate");
      add("estimates",estimate.id,estimate.firstViewedAt,"Estimate link viewed","Link opened · viewer identity and intent unverified");
      if(estimate.scheduledAt&&["scheduled","completed"].includes(estimate.status))add("estimates",estimate.id,estimate.scheduledAt,"Job scheduled","Saved scheduling status · open exact job");
      add("estimates",estimate.id,estimate.acceptedAt,"Estimate accepted",estimate.service||"Saved estimate");
      add("estimates",estimate.id,estimate.signedAt,"Agreement signed",estimate.service||"Saved estimate");
      // An owner-confirmed message is a separate, stronger audit event.
      if(estimate.firstEstimateSentAt&&!input.messages.some(row=>
        row.message.estimateId===estimate.id&&row.message.template==="estimate"&&
        (row.message.channel==="text_confirmed"||row.message.channel==="email_confirmed")))
        add("estimates",estimate.id,estimate.firstEstimateSentAt,"Estimate send recorded","Saved status · delivery not verified");
      // Surface older saved follow-up milestones when no corresponding confirmed
      // send/contact receipt is available. These are history markers, not proof
      // that a text or email was delivered, and always open the saved estimate.
      for(const [template,at,title] of [
        ["followUp1",estimate.stage1At,"Day 1 follow-up milestone"],
        ["followUp3",estimate.stage3At,"Day 3 follow-up milestone"],
        ["followUp7",estimate.stage7At,"Day 7 follow-up milestone"]
      ] as const){
        const audited=input.messages.some(({message})=>message.estimateId===estimate.id&&message.template===template&&
          (message.channel==="text_confirmed"||message.channel==="email_confirmed"||message.channel==="contact_recorded"));
        if(!audited)add("estimates",estimate.id,at,title,"Saved follow-up history · delivery unverified");
      }
      if(estimate.lastManualContactAt&&!input.messages.some(({message})=>message.estimateId===estimate.id&&
        message.channel==="contact_recorded"&&message.createdAt===estimate.lastManualContactAt))
        add("estimates",estimate.id,estimate.lastManualContactAt,"Manual contact logged","Saved owner contact · delivery unverified");
      if(estimate.lastReviewRequestAt&&!input.messages.some(({message})=>message.estimateId===estimate.id&&
        message.template==="review"&&(message.channel==="text_confirmed"||message.channel==="email_confirmed")))
        add("estimates",estimate.id,estimate.lastReviewRequestAt,"Review request recorded","Saved owner request · delivery unverified");
    }
    for(const invoice of input.invoices)
      add("invoices",invoice.id,invoice.createdAt,"Invoice created","Created · send not confirmed");
    for(const payment of input.payments)
      add("payments",payment.id,payment.createdAt,"Payment entry recorded",
        (payment.type||"Payment")+" · "+(payment.status||"status unverified"));
    const subject=(template:string)=>
      template==="estimate"?"Estimate":template==="invoice"?"Invoice":
      template==="review"?"Review request":template.startsWith("followUp")?"Estimate follow-up":
      template==="invoiceReminder"||template==="overdue"?"Invoice follow-up":"Customer message";
    for(const {message} of input.messages){
      const isConfirmed=message.channel==="text_confirmed"||message.channel==="email_confirmed";
      const isPrepared=message.channel==="text_prepared"||message.channel==="email_prepared";
      const kind=subject(message.template);
      const title=message.channel==="contact_recorded"?"Customer contact recorded":
        message.channel==="followup_snoozed"?"Follow-up snoozed":
        message.channel==="send_cancelled"?kind+" draft discarded":isConfirmed?kind+" send confirmed":isPrepared?kind+" prepared":
        message.channel==="copy"?kind+" copied":"Communication record";
      const detail=message.channel==="send_cancelled"?"Owner-confirmed not sent · saved draft retained":isConfirmed?"Owner-confirmed send · delivery unverified":
        isPrepared||message.channel==="copy"?"Sending unconfirmed":
        message.channel==="contact_recorded"?"Owner logged contact":
        message.channel==="followup_snoozed"?"Follow-up deferred · owner recorded":"Legacy entry · delivery unverified";
      add("messages",message.id,message.createdAt,title,detail);
    }
    for(const note of input.notes){
      const title=note.body==="[FIRE FLAG] REVIEW_RECEIVED"?"Review received (owner logged)":
        note.body==="[FIRE FLAG] YARD_SIGN_PICKED_UP"?"Yard sign pickup logged":
        note.body.startsWith("[FIRE FLAG] YARD_SIGN_PLACED | pickup:")?"Yard sign placement logged":
        "Customer note saved";
      // Never copy arbitrary note body into a timeline (access codes, private details).
      add("notes",note.id,note.createdAt,title,"Saved note · view original in Notes");
    }
    return events.sort((a,b)=>b.timestamp-a.timestamp||a.key.localeCompare(b.key)).slice(0,100);
  }
  /** Only flags that require owner review, never automatic sends, payments or notes. */
  function buildCustomerNextActions(input:{
    sign:{state:"out"|"picked_up";pickupDate:string|null}|null;
    reviewDue:boolean;invoices:readonly InvoiceRow[];estimates:readonly CustomerEstimate[];
    messages:readonly CustomerMessage[];today:string;now:number;
  }){
    type Action={key:string;kind:"sign"|"review"|"invoice"|"estimate"|"followup"|"billing";title:string;detail:string;invoiceId?:string;estimateId?:string;priority:number};
    const actions:Action[]=[];
    if(input.sign?.state==="out"&&input.sign.pickupDate&&input.sign.pickupDate<=input.today)
      actions.push({key:"sign",kind:"sign",title:"Yard sign pickup due",detail:"Review pickup and record it when completed",priority:100});
    if(input.reviewDue)
      actions.push({key:"review",kind:"review",title:"Review status check due",detail:"Verify before logging a review or sending anything",priority:80});
    for(const estimate of input.estimates){
      if(!estimate.id||!["draft","sent"].includes(estimate.status)||estimate.invoiceId)continue;
      // An in-app send receipt is stronger than a status label; a copied or
      // prepared message never proves delivery. Avoid false follow-up urgency
      // for estimates explicitly snoozed to a future local calendar date.
      const confirmed=input.messages.some(message=>message.estimateId===estimate.id&&message.template==="estimate"&&
        (message.channel==="text_confirmed"||message.channel==="email_confirmed"));
      const savedSend=Boolean(estimate.firstEstimateSentAt||estimate.lastEstimateSentAt);
      const snoozed=Boolean(estimate.snoozeUntil&&Number.isFinite(Date.parse(estimate.snoozeUntil))&&Date.parse(estimate.snoozeUntil)>input.now);
      if(!confirmed&&!savedSend&&estimate.status==="draft")
        actions.push({key:"estimate:"+estimate.id,kind:"estimate",estimateId:estimate.id,title:"Review unsent estimate",
          detail:"Draft estimate · sending not confirmed in app",priority:55});
      else if(!confirmed&&!savedSend&&estimate.status==="sent"&&!snoozed)
        actions.push({key:"estimate:"+estimate.id,kind:"estimate",estimateId:estimate.id,title:"Verify estimate send",
          detail:"Estimate marked sent · no saved send timestamp or confirmed message",priority:50});
      // Reuse the Follow-up Action Center's timing, not another reminder system.
      // A prepared message or active snooze never becomes a due-send claim.
      if(estimate.status==="sent"&&(confirmed||savedSend)){
        const stage=estimateReminderStage(estimate,input.now);
        if(stage.reviewReason)actions.push({key:"followup:"+estimate.id,kind:"followup",estimateId:estimate.id,
          title:"Review follow-up history",detail:stage.reviewReason,priority:52});
        else if(stage.template){
          const days=stage.template==="followUp7"?7:stage.template==="followUp3"?3:1;
          const viewed=viewedEstimateReminderCue(estimate,input.now);
          actions.push({key:"followup:"+estimate.id,kind:"followup",estimateId:estimate.id,
            title:viewed?"Viewed estimate · check in":"Estimate follow-up ready",
            detail:viewed?"Link opened "+viewed.hoursSinceView+" hours ago · approval not recorded; consider a friendly follow-up":"Suggested day "+days+" · review confirmed contact before any outreach",
            priority:viewed?76:days===7?78:days===3?70:62});
        }
      }
    }
    for(const invoice of input.invoices){
      if(!invoice.id||!invoice.estimateId||["void","cancelled"].includes(invoice.status))continue;
      // Refund/payment exceptions remain reviewable even for paid invoices.
      if(invoice.paymentReviewPending||Number(invoice.paymentOverageOpen)>0||Number(invoice.pendingRefundCount)>0){
        actions.push({key:"billing:"+invoice.id,kind:"billing",invoiceId:invoice.id,title:"Review payment exception",
          detail:"Check saved payment and refund records before contacting the customer",priority:95});
        continue;
      }
      if(["paid","draft"].includes(invoice.status))continue;
      const confirmed=input.messages.some(message=>message.estimateId===invoice.estimateId&&message.template==="invoice"&&
        (message.channel==="text_confirmed"||message.channel==="email_confirmed"));
      if(!confirmed)actions.push({key:"invoice:"+invoice.id,kind:"invoice",invoiceId:invoice.id,title:"Check invoice send record",
        detail:"Created invoice · owner send not confirmed in app",priority:45});
      else if(invoice.dueAt&&Number.isFinite(Date.parse(invoice.dueAt))&&Date.parse(invoice.dueAt)<input.now&&
        Number.isSafeInteger(invoice.totalCents)&&typeof invoice.paidCents==="number"&&Number.isSafeInteger(invoice.paidCents)&&invoice.totalCents>invoice.paidCents){
        actions.push({key:"billing:"+invoice.id,kind:"billing",invoiceId:invoice.id,title:"Review past-due invoice",
          detail:"Saved due date passed · confirm balance before a reminder",priority:72});
      }
    }
    return actions.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key)).slice(0,8);
  }
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [estimates, setEstimates] = useState<CustomerEstimate[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [photos,setPhotos]=useState<CustomerPhoto[]>([]);
  const [messages,setMessages]=useState<CustomerMessage[]>([]);
  const [propertyEstimateBlocked,setPropertyEstimateBlocked]=useState(true);
  const [selectedProperty,setSelectedProperty]=useState<PropertyEstimateSelection|null>(null);
  const [propertyWorkflowReady,setPropertyWorkflowReady]=useState(false);
  const [propertyListRefresh,setPropertyListRefresh]=useState(0);
  const [payments,setPayments]=useState<PaymentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelineShown,setTimelineShown]=useState(6);
  const [journeyShown,setJourneyShown]=useState(3);
  const [timelineFilter,setTimelineFilter]=useState<"all"|"estimates"|"messages"|"billing"|"notes">("all");
  const [timelineSearch,setTimelineSearch]=useState("");
  const [timelineTarget,setTimelineTarget]=useState<{customerId:string;section:"estimates"|"invoices"|"payments"|"messages"|"notes";id:string}|null>(null);
  useEffect(()=>{setTimelineShown(6);setTimelineFilter("all");setTimelineSearch("");setTimelineTarget(null);setJourneyShown(3);},[selectedId]);
  useEffect(()=>{setPropertyEstimateBlocked(true);setSelectedProperty(null);setPropertyWorkflowReady(false);},[selectedId]);
  const [activeEstimate, setActiveEstimate] = useState<EstimateRow | null>(null);
  const [section, setSection] = useState("estimates");
  const [recordSearch,setRecordSearch]=useState("");
  useEffect(()=>{setRecordSearch("");},[selectedId,section,recordRequestKey]);
  const [noteText, setNoteText] = useState("");
  const [signPickupDate,setSignPickupDate]=useState("");
  const [signLocation,setSignLocation]=useState("");
  useEffect(()=>{setSignPickupDate("");setSignLocation("");},[selectedId]);
  const noteDrafts=useRef<Record<string,string>>({}),noteDraftCustomer=useRef<string|null>(null);
  useEffect(()=>{if(noteDraftCustomer.current)noteDrafts.current[noteDraftCustomer.current]=noteText;noteDraftCustomer.current=selectedId;setNoteText(selectedId?noteDrafts.current[selectedId]??"":"");},[selectedId]);
  const [loadedRecordKey,setLoadedRecordKey]=useState(-1);
  const [recordFocusError,setRecordFocusError]=useState("");
  useEffect(()=>{setRecordFocusError("");},[selectedId]);
  const [savingNote, setSavingNote] = useState(false);
  const [reviewCheckSnoozing,setReviewCheckSnoozing]=useState(false);
  const [reviewCheckSnoozeError,setReviewCheckSnoozeError]=useState("");
  const reviewCheckSnoozeAttempt=useRef<{customerId:string;requestedAt:string;operationId:string}|null>(null);
  const reviewCheckSnoozeLock=useRef(false);
  const noteSaveLock=useRef(false),noteSavingCustomer=useRef<string|null>(null);
  const noteSelection=useRef(selectedId);noteSelection.current=selectedId;
  const noteMounted=useRef(true),noteAccessEpoch=useRef(0);
  const [noteFeedback,setNoteFeedback]=useState<{customerId:string;kind:"error"|"success";text:string}|null>(null);
  useEffect(()=>{noteMounted.current=true;return()=>{noteMounted.current=false;};},[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshIssue,setRefreshIssue]=useState(false);
  const [offlinePhotoOnly,setOfflinePhotoOnly]=useState(false);
  const [offlinePhotoCustomers,setOfflinePhotoCustomers]=useState<OfflinePhotoCustomer[]>([]);
  const loadRequest=useRef(0);
  const load = async (quiet=false) => {
    const request=++loadRequest.current;
    if(!quiet){setLoading(true);setError("");}
    let networkFailed=false,responseStatus:number|undefined;
    try {
      let response:Response;
      try{response=await fetch("/api/customers",{cache:"no-store"});}
      catch(networkError){networkFailed=true;throw networkError;}
      responseStatus=response.status;
      if(mustClearOfflinePhotoDirectory(response.status)&&request===loadRequest.current){
        // Authentication denial takes precedence over any previously visible
        // offline fallback. Never keep stale customer names rendered.
        noteAccessEpoch.current++;setNoteFeedback(null);
        setOfflinePhotoOnly(false);setOfflinePhotoCustomers([]);
        setSelectedId(null);setCustomers([]);setEstimates([]);setInvoices([]);
        setPhotos([]);setMessages([]);setNotes([]);setPayments([]);
        // Persistent labels are removed, while local photo bytes remain intact.
        await clearOfflinePhotoCustomerDirectory().catch(()=>{});
      }
      const result = await response.json() as { customers?: CustomerRow[]; estimates?: CustomerEstimate[]; notes?:CustomerNote[]; invoices?:InvoiceRow[]; photos?:CustomerPhoto[]; messages?:CustomerMessage[]; payments?:PaymentRow[]; error?: string };
      if(request!==loadRequest.current)return;
      if (!response.ok) throw new Error(result?.error || "Customer records could not be loaded.");
      const keys=["customers","estimates","notes","invoices","photos","messages","payments"] as const;
      if(!result||keys.some((key)=>!Array.isArray(result[key])||result[key]!.some((row)=>!row||typeof row!=="object"||Array.isArray(row)||typeof row.id!=="string"||!row.id)))throw new Error("Customer records could not be read. Try again.");
      if(keys.some((key)=>new Set(result[key]!.map((row)=>row.id)).size!==result[key]!.length))throw new Error("Duplicate customer history records were returned. Refresh before using totals.");
      if(result.customers!.some((row)=>typeof row.name!=="string"))throw new Error("Customer names could not be read. Try again.");
      const asNumber=(value:unknown)=>{if((typeof value!=="number"&&typeof value!=="string")||(typeof value==="string"&&!value.trim())||!Number.isSafeInteger(Number(value)))throw new Error("Customer amounts could not be verified as exact whole cents. Refresh before using totals.");return Number(value);};
      const nextCustomers=(result.customers ?? []).map((item) => ({ ...item, estimateCount: asNumber(item.estimateCount), estimateTotal: asNumber(item.estimateTotal), paidTotal: asNumber(item.paidTotal) }));
      const nextEstimates=(result.estimates ?? []).map((item) => ({ ...item, totalCents: asNumber(item.totalCents), depositCents: asNumber(item.depositCents), paidCents: asNumber(item.paidCents) }));
      const nextNotes=result.notes ?? [];
      const nextInvoices=(result.invoices ?? []).map((item)=>({...item,totalCents:asNumber(item.totalCents)}));
      const nextPhotos=(result.photos??[]).map((item)=>({...item,sizeBytes:asNumber(item.sizeBytes)}));
      const nextMessages=result.messages??[];
      const nextPayments=(result.payments??[]).map((item)=>({...item,amountCents:asNumber(item.amountCents)}));
      setCustomers(nextCustomers);
      // Cache only authenticated customer IDs/names, never financial records.
      // Failure is visible but never prevents online customer operations.
      try{
        await saveOfflinePhotoCustomerDirectory(nextCustomers.map(item=>({id:item.id,name:item.name})));
      }catch{/* Customer directory storage may be unavailable on this device. */}
      if(request!==loadRequest.current)return;
      setOfflinePhotoOnly(false);setOfflinePhotoCustomers([]);
      setEstimates(nextEstimates);
      setNotes(nextNotes);
      setInvoices(nextInvoices);
      setPhotos(nextPhotos);
      setMessages(nextMessages);
      setPayments(nextPayments);
      setRefreshIssue(false);
      setLoadedRecordKey(recordRequestKey);
    }catch(loadError){
      if(request!==loadRequest.current)return;
      // Keep confirmed local records visible on transient refresh failures, but
      // never silently imply that dependent activity is up to date.
      // Authorization denials must still hide owner-only history entirely.
      if(quiet&&!mustClearOfflinePhotoDirectory(responseStatus??0)){setRefreshIssue(true);return;}
      if(mayUseOfflinePhotoDirectory({networkFailed,responseStatus,browserReportsOffline:navigator.onLine===false})){
        try{
          const cached=await loadOfflinePhotoCustomerDirectory();
          if(request!==loadRequest.current)return;
          if(cached.length>0){
            setOfflinePhotoCustomers(cached);setOfflinePhotoOnly(true);setError("");
            return;
          }
        }catch{/* No usable cached directory: show the original error. */}
      }
      if(request===loadRequest.current){
        setOfflinePhotoOnly(false);setOfflinePhotoCustomers([]);
        setError(loadError instanceof Error?loadError.message:"Customer records could not be loaded.");
      }
    }
    finally { if(request===loadRequest.current)setLoading(false); }
  };
  useEffect(() => { void load(); return()=>{loadRequest.current++;}; }, [recordRequestKey]);
  // All confirmed message/contact/flag changes broadcast this owner-only event.
  // Refresh the same authenticated API instead of tracking a second copy of
  // the customer's activity, invoices or review/yard-sign statuses.
  useEffect(()=>{
    const refresh=()=>{void load(true);};
    window.addEventListener("fire:attention-saved",refresh);
    return()=>window.removeEventListener("fire:attention-saved",refresh);
  },[recordRequestKey]);
  useEffect(()=>{
    if(!focusCustomerId||loading||error||offlinePhotoOnly)return;
    const customer=customers.find(row=>row.id===focusCustomerId);
    if(customer){setSelectedId(customer.id);setSection(focusSection);}
    else setError("The selected customer is unavailable. Refresh the customer list or check your connection.");
    onFocusHandled?.(focusCustomerId);
  },[focusCustomerId,loading,error,offlinePhotoOnly,customers,focusSection]);
  // A reminder targets the flag inside its actual customer, not just the Customers tab.
  // Wait until that saved profile has rendered, then move visual and keyboard focus.
  useEffect(()=>{
    if(!activityFocus||loading||error||offlinePhotoOnly||selectedId!==activityFocus.customerId)return;
    const prefix=activityFocus.kind==="sign"?"customer-sign-flag-":"customer-review-check-";
    const target=document.getElementById(prefix+selectedId)||document.getElementById("customer-flags-"+selectedId);
    if(!target)return;
    target.scrollIntoView({block:"start",behavior:"instant"});
    target.focus({preventScroll:true});
    onActivityFocusHandled?.(activityFocus.request);
  },[activityFocus,selectedId,loading,error,offlinePhotoOnly]);
  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const customerEstimates = estimates.filter((estimate) => estimate.customerId === selectedId);
  const customerNotes = notes.filter((note)=>note.customerId === selectedId);
  const manualFlags=deriveCustomerManualFlags(customerNotes);
  const flaggedSignCustomers=customers.map(customer=>({customer,...deriveCustomerManualFlags(notes.filter(note=>note.customerId===customer.id))})).filter(item=>item.sign?.state==="out");
  const tulsaToday=new Date().toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
  const stagePickupTask=(customer:CustomerRow,sign:{state:"out"|"picked_up";at:string;pickupDate:string|null;location:string}|null)=>{
    if(sign?.state!=="out"||!sign.pickupDate||!onPreparePickupTask)return;
    onPreparePickupTask({customerId:customer.id,customerName:customer.name,pickupDate:sign.pickupDate,location:sign.location||customer.address||"Location not specified",placedAt:sign.at});
  };
  const customerInvoices = invoices.filter((invoice)=>invoice.customerId === selectedId);
  const customerPhotos=photos.filter((photo)=>photo.customerId===selectedId);
  const customerMessages=messages.filter((message)=>message.customerId===selectedId);
  const historyEntries=messageHistoryEntries(customerMessages);
  const customerPayments=payments.filter((payment)=>payment.customerId===selectedId);
  const customerJourneys=customerEstimates.slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id))
    .map(estimate=>({estimate,journey:customerJobJourney(estimate,customerMessages)}));
  const timelineEntries=buildCustomerTimeline({estimates:customerEstimates,invoices:customerInvoices,
    messages:historyEntries,notes:customerNotes,payments:customerPayments});
  const safeTimelineQuery=timelineSearch.trim().toLocaleLowerCase();
  const filteredTimelineEntries=timelineEntries.filter(entry=>(timelineFilter==="all"||entry.category===timelineFilter)&&
    (!safeTimelineQuery||[entry.title,entry.detail,entry.day].join(" ").toLocaleLowerCase().includes(safeTimelineQuery)));
  const visibleTimelineEntries=filteredTimelineEntries.slice(0,timelineShown);
  const openTimelineEntry=(entry:{section:"estimates"|"invoices"|"payments"|"messages"|"notes";id:string})=>{
    if(!selected)return;
    setRecordSearch("");
    setSection(entry.section);
    setTimelineTarget({customerId:selected.id,section:entry.section,id:entry.id});
  };
  useEffect(()=>{
    if(!timelineTarget||timelineTarget.customerId!==selectedId||timelineTarget.section!==section||recordSearch)return;
    const target=document.getElementById("customer-"+timelineTarget.section.slice(0,-1)+"-"+timelineTarget.id);
    if(!target)return;
    target.scrollIntoView({block:"center",behavior:"instant"});
    target.focus({preventScroll:true});
    setTimelineTarget(null);
  },[timelineTarget,selectedId,section,recordSearch]);
  const confirmedMessage=(templates:string[])=>customerMessages.some(message=>(message.channel==="text_confirmed"||message.channel==="email_confirmed")&&templates.includes(message.template));
  const customerEstimateSent=customerEstimates.some(estimate=>Boolean(estimate.firstEstimateSentAt||estimate.lastEstimateSentAt))||confirmedMessage(["estimate"]);
  const customerEstimateMarkedSent=customerEstimates.some(estimate=>estimate.status==="sent");
  const invoiceSent=confirmedMessage(["invoice"]);
  const followupContactRecorded=customerEstimates.some(estimate=>Boolean(estimate.stage1At||estimate.stage3At||estimate.stage7At||estimate.lastManualContactAt))||
    customerMessages.some(message=>message.channel==="contact_recorded");
  const followupSendConfirmed=confirmedMessage(["followUp1","followUp3","followUp7","invoiceReminder","overdue"]);
  const reviewRequestRecorded=customerEstimates.some(estimate=>Boolean(estimate.lastReviewRequestAt));
  const reviewSendConfirmed=confirmedMessage(["review"]);
  const reviewCheck=reviewFollowupEligibility(customerEstimates,customerMessages,manualFlags.reviewReceivedAt,Date.now());
  const activitySummary=customerFlagPresentation({
    estimateSent:customerEstimateSent,estimateMarkedSent:customerEstimateMarkedSent,hasDraftEstimate:customerEstimates.some(estimate=>estimate.status==="draft"),invoiceCreated:customerInvoices.length>0,invoiceSendConfirmed:invoiceSent,
    followupContactRecorded,followupSendConfirmed,reviewRequestRecorded,reviewSendConfirmed,
    reviewReceivedAt:manualFlags.reviewReceivedAt,
    sign:manualFlags.sign,reviewDue:reviewCheck.status==="due",today:tulsaToday
  });
  const nextCustomerActions=buildCustomerNextActions({
    sign:manualFlags.sign,reviewDue:reviewCheck.status==="due",
    invoices:customerInvoices,estimates:customerEstimates,messages:customerMessages,today:tulsaToday,now:Date.now()
  });
  const openCustomerAction=(action:{kind:"sign"|"review"|"invoice"|"estimate"|"followup"|"billing";invoiceId?:string;estimateId?:string})=>{
    if(!selected)return;
    if((action.kind==="invoice"||action.kind==="billing")&&action.invoiceId){openTimelineEntry({section:"invoices",id:action.invoiceId});return;}
    if((action.kind==="estimate"||action.kind==="followup")&&action.estimateId){openTimelineEntry({section:"estimates",id:action.estimateId});return;}
    const element=document.getElementById(action.kind==="sign"?
      "customer-sign-flag-"+selected.id:"customer-review-check-"+selected.id);
    element?.scrollIntoView({block:"center",behavior:"instant"});
    element?.focus({preventScroll:true});
  };
  const dueReviewChecks=customers.map(customer=>{
    const customerNotesForReview=notes.filter(note=>note.customerId===customer.id);
    const customerReview=deriveCustomerManualFlags(customerNotesForReview);
    const state=reviewFollowupEligibility(estimates.filter(estimate=>estimate.customerId===customer.id),messages.filter(message=>message.customerId===customer.id),customerReview.reviewReceivedAt,Date.now());
    return {customer,state};
  }).filter(({state})=>state.status==="due");
  const snoozeReviewStatusCheck=async(customer:CustomerRow,requestedAt:string|null)=>{
    if(!requestedAt||reviewCheckSnoozeLock.current)return;
    const pending=reviewCheckSnoozeAttempt.current;
    if(pending&&(pending.customerId!==customer.id||pending.requestedAt!==requestedAt)){
      setReviewCheckSnoozeError("A previous review-check save is uncertain. Reopen that customer and verify the saved history before starting another.");
      return;
    }
    const attempt=pending??{customerId:customer.id,requestedAt,operationId:crypto.randomUUID()};
    reviewCheckSnoozeAttempt.current=attempt;
    reviewCheckSnoozeLock.current=true;setReviewCheckSnoozing(true);setReviewCheckSnoozeError("");
    try{
      const response=await fetch("/api/dashboard-review-checks/snooze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(attempt)});
      const body=await response.json() as {saved?:boolean;customerId?:string;snoozeUntil?:string;error?:string};
      if(!response.ok||body.saved!==true||body.customerId!==attempt.customerId||typeof body.snoozeUntil!=="string"||!Number.isFinite(Date.parse(body.snoozeUntil)))
        throw Error(body.error||"Review check deferral could not be verified.");
      reviewCheckSnoozeAttempt.current=null;
      await load(true);
      window.dispatchEvent(new Event("fire:attention-saved"));
    }catch(reason){
      setReviewCheckSnoozeError((reason instanceof Error?reason.message:"Review check deferral is uncertain.")+" No message was sent and no review was marked received. Retry the same saved action.");
    }finally{reviewCheckSnoozeLock.current=false;setReviewCheckSnoozing(false);}
  };
  const stageReviewCheck=(customer:CustomerRow,requestedAt:string|null)=>{
    if(!requestedAt||!onPrepareReviewTask)return;
    // This reminder schedules an owner check, never an automated review request.
    onPrepareReviewTask({customerId:customer.id,customerName:customer.name,requestedAt,dueDate:new Date().toLocaleDateString("en-CA",{timeZone:"America/Chicago"})});
  };
  const prepareManualFlag=(draft:string)=>{
    if(!selected||savingNote)return;
    if(noteText.trim()&&noteText.trim()!==draft&&!window.confirm("Replace your unsaved customer note draft?"))return;
    noteDrafts.current[selected.id]=draft;
    setNoteText(draft);setNoteFeedback(null);setRecordSearch("");setSection("notes");
    // The note is only prepared. Bring its existing save control into view on
    // narrow phones, without changing the owner-confirmed Add note workflow.
    if(typeof window.requestAnimationFrame==="function")window.requestAnimationFrame(()=>{
      const input=document.getElementById("customer-note-draft-"+selected.id);
      input?.scrollIntoView({block:"center",behavior:"instant"});
      input?.focus({preventScroll:true});
    });
  };
  useEffect(()=>{
    if(!focusRecord||focusRecord.kind==="property"||loading||loadedRecordKey!==recordRequestKey)return;
    if(error||offlinePhotoOnly){onRecordFocusHandled?.(focusRecord.id);return;}
    if(selectedId!==focusRecord.customerId||section!==(focusRecord.kind==="payment"?"payments":"notes"))return;
    const row=(focusRecord.kind==="payment"?payments:notes).find(item=>item.id===focusRecord.id&&item.customerId===focusRecord.customerId);
    setRecordFocusError("");
    if(row){const element=document.getElementById("customer-"+focusRecord.kind+"-"+row.id);if(!element)return;element.scrollIntoView({block:"center"});element.focus({preventScroll:true});}
    else setRecordFocusError("The selected "+(focusRecord.kind==="payment"?"payment record":"note")+" is unavailable. Refresh the customer profile or check your connection.");
    onRecordFocusHandled?.(focusRecord.id);
  },[focusRecord,loading,error,offlinePhotoOnly,selectedId,section,payments,notes,loadedRecordKey,recordRequestKey]);
  const recordQuery=focusRecord?.customerId===selectedId?"":recordSearch.trim().toLocaleLowerCase();
  const recordMatches=(values:unknown[])=>values.filter(value=>value!=null).join(" ").toLocaleLowerCase().includes(recordQuery);
  const matchingEstimates=customerEstimates.filter(row=>recordMatches([row.id,row.service,row.status,row.address,row.createdAt]));
  const matchingInvoices=customerInvoices.filter(row=>recordMatches([row.id,row.status,row.createdAt,customerEstimates.find(job=>job.id===row.estimateId)?.service]));
  const matchingPayments=customerPayments.filter(row=>recordMatches([row.id,row.type,row.reference,row.createdAt]));
  const matchingNotes=customerNotes.filter(row=>recordMatches([row.body,row.createdAt]));
  const matchingMessages=historyEntries.filter(({message})=>recordMatches([message.body,message.channel,message.template,message.createdAt]));
  const recordCounts=section==="estimates"?[matchingEstimates.length,customerEstimates.length]:section==="invoices"?[matchingInvoices.length,customerInvoices.length]:section==="payments"?[matchingPayments.length,customerPayments.length]:section==="notes"?[matchingNotes.length,customerNotes.length]:[matchingMessages.length,historyEntries.length];
  const filteredCustomers = customers.filter((customer)=>[customer.name,customer.email,customer.phone,customer.address].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  const activeCustomerEstimate=customerEstimates.find((estimate)=>estimate.status==="scheduled")??customerEstimates.find((estimate)=>["approved","sent","draft"].includes(estimate.status))??customerEstimates.find((estimate)=>estimate.status==="completed"&&estimate.paidCents<resolvedBillingTotalCents(estimate))??customerEstimates[0];
  const customerBalances=summarizeCustomerBalances(customerEstimates);
  const customerPaidTotal=customerPayments.filter((payment)=>!['Tip','Tip Refund'].includes(payment.type)).reduce((sum,payment)=>sum+payment.amountCents,0);
  const handleEstimateSaved = (estimate: EstimateRow) => { onEstimateSaved(estimate); void load(true); };
  const saveNote = async () => {
    if(!noteMounted.current||noteSaveLock.current||!selected||noteSelection.current!==selected.id||!noteText.trim())return;
    const customerId=selected.id,draft=noteText,body=draft.trim(),epoch=noteAccessEpoch.current;
    noteDrafts.current[customerId]=draft;noteSaveLock.current=true;noteSavingCustomer.current=customerId;
    setSavingNote(true);setNoteFeedback(null);
    try {
      const response=await fetch("/api/customer-notes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({customerId,body})});
      const result=await response.json() as {note?:CustomerNote;error?:string};
      if(!noteMounted.current||noteAccessEpoch.current!==epoch)return;
      const note=result?.note;
      if(!response.ok||!note||typeof note.id!=="string"||!note.id||note.customerId!==customerId||note.body!==body||typeof note.createdAt!=="string"||!Number.isFinite(Date.parse(note.createdAt)))throw new Error("Unconfirmed note save.");
      setNotes((current)=>[note,...current.filter(row=>row.id!==note.id)]);
      if(noteDrafts.current[customerId]===draft)delete noteDrafts.current[customerId];
      if(noteSelection.current===customerId)setNoteText(current=>current===draft?"":current);
      setNoteFeedback({customerId,kind:"success",text:"Note saved."});if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
    }catch{
      if(noteMounted.current&&noteAccessEpoch.current===epoch)setNoteFeedback({customerId,kind:"error",text:"Note save was not confirmed. Your draft is kept. Refresh saved notes before retrying to avoid a duplicate."});
    }finally{
      noteSaveLock.current=false;noteSavingCustomer.current=null;
      if(noteMounted.current)setSavingNote(false);
    }
  };
  // The server-backed customer workflow is intentionally NOT rendered when
  // offline. Only a previously authenticated, minimally cached photo directory
  // can be browsed, and photos remain stored locally in IndexedDB.
  if(offlinePhotoOnly){
    const selectedOffline=offlinePhotoCustomers.find(customer=>customer.id===selectedId);
    return <div className="customers-view">
      <section className="business-panel" role="status">
        <h2>Offline customer photos</h2>
        <p>The server is unreachable. FIRE is showing names last saved on this device and your on-device photos only. Estimates, invoices, payments, messaging, and editing are unavailable until you reconnect.</p>
        <Button variant="outline" onClick={()=>void load()}>Reconnect & refresh customer records</Button>
      </section>
      {selectedOffline?<><button className="back-link" onClick={()=>setSelectedId(null)}>← Offline customers</button>
        <h2>{selectedOffline.name} — on-device photos</h2>
        <OfflineCustomerPhotos key={selectedOffline.id} customerId={selectedOffline.id} customerName={selectedOffline.name} knownCustomerIds={offlinePhotoCustomers.map(item=>item.id)}/>
       </>:<div className="customer-list">{offlinePhotoCustomers.filter(customer=>customer.name.toLowerCase().includes(searchQuery.toLowerCase())).map(customer=>
        <button className="customer-list-item" type="button" key={customer.id} onClick={()=>setSelectedId(customer.id)}>{customer.name} — local photos <ChevronRight/></button>
       )}</div>}
    </div>;
  }
  if(loading||error)return <div className="customers-view">
    {selected&&<button className="back-link" onClick={()=>{setSelectedId(null);setSection("estimates");}}>← All customers</button>}
    {loading?<div className="customers-state" role="status">Loading customers…</div>:<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>}
  </div>;
  if (selected) return <div className="customers-view">
    <EstimateDetail estimate={activeEstimate} onClose={()=>setActiveEstimate(null)} onChanged={()=>{ setActiveEstimate(null); void load(); }} />
    <button className="back-link" onClick={() => { setSelectedId(null); setSection("estimates"); }}>← All customers</button>
    {refreshIssue&&<div className="customer-flag-next" role="alert"><AlertTriangle aria-hidden="true"/><span><strong>Customer activity needs refreshing</strong><small>A saved change could not be rechecked. Review current records before acting on these statuses.</small></span><Button variant="outline" onClick={()=>void load()}>Refresh customer history</Button></div>}
    <section className="customer-profile">
      {recordFocusError&&<p role="alert">{recordFocusError}</p>}
      <div className="customer-profile-head"><span className="customer-avatar">{selected.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><div><p className="eyebrow">Customer profile</p><h1>{selected.name}</h1></div><div className="profile-head-actions"><Button variant="outline" onClick={()=>{const target=document.getElementById(`customer-history-${selected.id}`);target?.scrollIntoView({block:"start"});target?.focus({preventScroll:true});}}>Customer history</Button><EditCustomer key={selected.id} customer={selected} onUpdated={(updated)=>{setCustomers((current)=>current.map((item)=>item.id===updated.id?updated:item));void load(true);}}/><MessageComposer customer={selected} estimate={customerEstimates[0]} initialTemplate="estimate" onLogged={(message)=>setMessages((current)=>[message,...current.filter(entry=>entry.id!==message.id)])}/><NewEstimate key={selected.id} onClosed={()=>setPropertyListRefresh(value=>value+1)} propertySelection={selectedProperty} propertyWorkflowReady={propertyWorkflowReady} disabledReason={propertyEstimateBlocked?'Review properties and select an active service property.':undefined} customer={selected} onSaved={handleEstimateSaved} /></div></div>
      <div className="customer-snapshot">
        <span><small>Jobs / estimates</small><strong>{customerEstimates.length}</strong></span>
        <span><small>Paid</small><strong>{money(customerPaidTotal)}</strong></span>
        <span><small>Collectible job balance</small><strong>{money(customerBalances.collectibleCents)}</strong></span><span><small>Deposit still required</small><strong>{money(customerBalances.depositRemainingCents)}</strong></span><span><small>Potential estimate value</small><strong>{money(customerBalances.potentialCents)}</strong></span>
        <span><small>Current stage</small><strong>{activeCustomerEstimate?statusLabel(activeCustomerEstimate.status):"No active job"}</strong></span>
      </div>
      <p className="customer-balance-explanation">Collectible balances include approved or scheduled jobs and issued invoices, including amounts due on completion. Draft and sent estimates remain potential work. Deposits are part of the job balance; tips are separate.</p>
      <section className="business-panel" role="region" aria-label="Customer estimate to scheduled job journey">
        <header><div><h2>Estimate → scheduled job</h2><p>Six job-specific milestones derived from saved records. Views do not prove approval, and a payment total is not a separate deposit receipt.</p></div></header>
        {customerJourneys.length?<div className="flex flex-col gap-3">
          {customerJourneys.slice(0,journeyShown).map(({estimate,journey})=><article key={estimate.id} className="rounded-xl border border-border p-3 sm:p-4" aria-label={"Job journey for "+estimate.service}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><strong className="block">{estimate.service||"Saved job"}</strong><small className="block text-muted-foreground">{journey.headline} · {new Date(estimate.createdAt).toLocaleDateString()}</small></div>
              <Button variant="outline" onClick={()=>setActiveEstimate({...estimate,customer:selected.name,email:selected.email,phone:selected.phone,address:estimate.address??undefined})}>Open exact job</Button></div>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {journey.steps.map(step=><li key={step.key} className="rounded-lg border border-border p-2">
                <span className="flex items-center gap-1 text-xs font-semibold">{step.state==="done"?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:step.state==="verify"?<AlertTriangle className="h-4 w-4 text-amber-600"/>:<Clock3 className="h-4 w-4 text-muted-foreground"/>}{step.title}</span>
                <small className="mt-1 block text-muted-foreground">{step.detail}</small>
                {step.at&&<time className="mt-1 block text-xs" dateTime={step.at}>{dateTime(step.at)}</time>}
              </li>)}
            </ol>
          </article>)}
          {customerJourneys.length>journeyShown&&<Button variant="outline" onClick={()=>setJourneyShown(n=>Math.min(n+3,customerJourneys.length))}>Show {Math.min(3,customerJourneys.length-journeyShown)} older job journeys</Button>}
        </div>:<p className="customer-timeline-empty">No estimates recorded for this customer yet.</p>}
      </section>
      <section id={`customer-flags-${selected.id}`} tabIndex={-1} className="customer-flag-panel" aria-label="Customer activity and yard sign flags">
        <div className="customer-flag-heading"><div><h2>Activity & flags</h2><p>Quick summary from saved records and your own notes. Logged contact is not proof a message was sent; review receipt is owner-reported.</p></div><ClipboardList aria-hidden="true"/></div>
        <div className="customer-flag-grid">
          <span><small>Estimate</small><strong>{activitySummary.estimate}</strong></span>
          <span><small>Invoice</small><strong>{activitySummary.invoice}</strong></span>
          <span><small>Follow-up</small><strong>{activitySummary.followup}</strong></span>
          <span><small>Review request</small><strong>{activitySummary.reviewRequest}</strong></span>
          <span><small>Review received</small><strong>{activitySummary.reviewReceived}</strong></span>
          <span id={`customer-sign-flag-${selected.id}`} tabIndex={-1} className={activitySummary.needs.includes("Yard sign pickup is due")?"customer-flag-action-needed":""}><small>Yard sign</small><strong>{activitySummary.sign}</strong></span>
        </div>
        {activitySummary.needs.length>0&&<div className="customer-flag-next" role="status" aria-label="Customer action checks"><AlertTriangle aria-hidden="true"/><span><strong>{activitySummary.needs.length} action{activitySummary.needs.length===1?"":"s"} to review</strong><small>{activitySummary.needs.join(" · ")}</small></span></div>}
        {reviewCheck.status==="due"&&<div id={`customer-review-check-${selected.id}`} tabIndex={-1} className="customer-review-check" role="region" aria-label="Review follow-up check due"><div><strong><Star aria-hidden="true"/> Review status check available</strong><p>Review request recorded {reviewCheck.elapsedDays} days ago; no review is logged. Check whether a review has appeared before contacting the customer again.</p></div><div className="flex flex-wrap gap-2">{onPrepareReviewTask&&<Button variant="outline" aria-label="Prepare review status check task" onClick={()=>stageReviewCheck(selected,reviewCheck.requestedAt)}>Create check task</Button>}<Button variant="outline" aria-label="Defer review status check seven days" disabled={reviewCheckSnoozing} onClick={()=>void snoozeReviewStatusCheck(selected,reviewCheck.requestedAt)}>{reviewCheckSnoozing?"Saving check…":"Check later · 7 days"}</Button></div>{reviewCheckSnoozeError&&<p role="alert" className="save-error">{reviewCheckSnoozeError}</p>}</div>}
        <div className="customer-flag-actions">
          {!manualFlags.reviewReceivedAt&&<Button variant="outline" aria-label="Prepare review received note" onClick={()=>prepareManualFlag(REVIEW_RECEIVED_NOTE)}>Log review received</Button>}
          {manualFlags.sign?.state==="out"?<><Button variant="outline" aria-label="Prepare yard sign pickup note" onClick={()=>prepareManualFlag(SIGN_PICKED_UP_NOTE)}>Log yard sign pickup</Button>{onPreparePickupTask&&<Button variant="outline" aria-label="Prepare yard sign pickup reminder" onClick={()=>stagePickupTask(selected,manualFlags.sign)}>Create pickup task</Button>}</>:
          <details className="customer-sign-form"><summary>Track a yard sign</summary><label>Pickup target <input type="date" aria-label="Yard sign pickup date" value={signPickupDate} onChange={event=>setSignPickupDate(event.target.value)}/></label><label>Sign location <input aria-label="Yard sign location" value={signLocation} onChange={event=>setSignLocation(event.target.value)} placeholder={selected.address||"Address / where placed"}/></label><Button variant="outline" disabled={!signPickupDate} aria-label="Prepare yard sign placed note" onClick={()=>{try{prepareManualFlag(signPlacedNote(signPickupDate,signLocation.trim()||selected.address||"Location not specified"));}catch{}}}>Prepare placement note</Button></details>}
        </div>
        {manualFlags.sign?.state==="out"&&<p className="customer-flag-sign-location">Last placement: {manualFlags.sign.location||"Location not specified"}. Pickup target: {manualFlags.sign.pickupDate}. This is an in-app tracking cue, not a push notification.</p>}
        <p className="customer-flag-help">Manual flag actions prepare a note; select <strong>Add note</strong> in Notes to save the flag. Pickup tasks open as drafts in Business and are saved only when you choose Add task. Review receipt is owner-reported, not verified against Google.</p>
      </section>
      <section className="customer-action-review" role="region" aria-label="Review next customer actions">
        <div className="customer-timeline-heading"><div><h2>Review next</h2><p>Derived from saved records · opens existing controls · no automatic actions</p></div><span>{nextCustomerActions.length} to check</span></div>
        {nextCustomerActions.length?<div className="customer-action-items">{nextCustomerActions.map(action=><button type="button" key={action.key} onClick={()=>openCustomerAction(action)} aria-label={"Open "+action.title}>
          <span className="customer-timeline-copy"><strong>{action.title}</strong><small>{action.detail}</small></span><ChevronRight aria-hidden="true"/>
        </button>)}</div>:<p className="customer-timeline-empty">No saved-record actions need review right now. This does not verify external messages, reviews, or payments.</p>}
        {nextCustomerActions.length===8&&<p className="customer-timeline-empty">Showing the first eight checks. Review the saved records below for other actions.</p>}
      </section>
      <section className="customer-timeline" role="region" aria-label="Recent customer activity">
        <div className="customer-timeline-heading"><div><h2>Recent activity</h2><p>Saved records only · newest first · no private note text shown</p></div><span>{timelineEntries.length} event{timelineEntries.length===1?"":"s"}{timelineEntries.length===100?"+":""}</span></div>
        <div className="customer-timeline-controls">
          <div className="customer-timeline-filters" role="group" aria-label="Filter customer activity">
            {([["all","All"],["estimates","Estimates"],["messages","Messages"],["billing","Billing"],["notes","Notes & flags"]] as const).map(([key,label])=><button key={key} type="button" aria-label={"Filter activity: "+label} aria-pressed={timelineFilter===key} onClick={()=>{setTimelineFilter(key);setTimelineShown(6);}}>{label}</button>)}
          </div>
          <label className="customer-timeline-search">Search activity titles <input type="search" aria-label="Search recent activity" value={timelineSearch} onChange={event=>{setTimelineSearch(event.target.value);setTimelineShown(6);}} placeholder="Example: review, invoice, Oct 20"/></label>
          <p role="status">Showing {Math.min(timelineShown,filteredTimelineEntries.length)} of {filteredTimelineEntries.length} matching events · searches labels, not private note text</p>
        </div>
        {visibleTimelineEntries.length>0?<ol className="customer-timeline-list">
          {visibleTimelineEntries.map((entry,index)=><li key={entry.key}>
            {(index===0||visibleTimelineEntries[index-1].day!==entry.day)&&<p className="customer-timeline-day">{entry.day}</p>}
            <button type="button" onClick={()=>openTimelineEntry(entry)} aria-label={"Open "+entry.title+" in "+entry.section}>
              <span className="customer-timeline-copy"><strong>{entry.title}</strong><small>{entry.detail}</small></span>
              <span className="customer-timeline-meta"><time dateTime={entry.at}>{dateTime(entry.at)}</time><ChevronRight aria-hidden="true"/></span>
            </button>
          </li>)}
        </ol>:<p className="customer-timeline-empty">{timelineEntries.length?"No matching activity. Choose All or clear the search.":"No dated activity has been recorded for this customer yet."}</p>}
        {filteredTimelineEntries.length>timelineShown&&<button type="button" className="customer-timeline-more" onClick={()=>setTimelineShown(current=>Math.min(current+6,filteredTimelineEntries.length))}>Show next {Math.min(6,filteredTimelineEntries.length-timelineShown)} events · {filteredTimelineEntries.length-timelineShown} remaining</button>}
      </section>
      {activeCustomerEstimate&&<button className="customer-next-job" onClick={()=>setActiveEstimate({...activeCustomerEstimate,customer:selected.name,email:selected.email,phone:selected.phone,address:activeCustomerEstimate.address??undefined})}><span><Sparkles/><span><small>Continue current job</small><strong>{activeCustomerEstimate.service}</strong></span></span><span>{activeCustomerEstimate.scheduledAt?dateTime(activeCustomerEstimate.scheduledAt):statusLabel(activeCustomerEstimate.status)} <ChevronRight/></span></button>}
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
      <CustomerProperties key={selected.id+'-'+propertyListRefresh} customerId={selected.id} onRecordsChange={setPropertyEstimateBlocked} onSelectionChange={setSelectedProperty} onWorkflowChange={setPropertyWorkflowReady} focusPropertyId={focusRecord?.kind==="property"&&focusRecord.customerId===selected.id?focusRecord.id:undefined} onPropertyFocusHandled={onRecordFocusHandled}/>
    </section>
    <nav className="record-tabs" id={`customer-history-${selected.id}`} aria-label="Customer record sections" tabIndex={-1}>
      <button aria-current={section === "estimates"?"page":undefined} className={section === "estimates" ? "active" : ""} onClick={() => setSection("estimates")}>Estimates <b>{customerEstimates.length}</b></button>
      <button aria-current={section === "payments"?"page":undefined} className={section === "payments" ? "active" : ""} onClick={() => setSection("payments")}>Payments</button>
      <button aria-current={section === "invoices"?"page":undefined} className={section === "invoices" ? "active" : ""} onClick={() => setSection("invoices")}>Invoices</button>
      <button aria-current={section === "photos"?"page":undefined} className={section === "photos" ? "active" : ""} onClick={() => setSection("photos")}>Photos (on-device)</button>
      <button aria-current={section === "messages"?"page":undefined} className={section === "messages" ? "active" : ""} onClick={() => setSection("messages")}>Messages <b>{historyEntries.length}</b></button>
      <button aria-current={section === "notes"?"page":undefined} className={section === "notes" ? "active" : ""} onClick={() => setSection("notes")}>Notes <b>{customerNotes.length}</b></button>
    </nav>
    {section!=="photos"&&<div className="customer-history-tools"><Label htmlFor={`customer-history-search-${selected.id}`}>Search this customer’s {section}</Label><Input id={`customer-history-search-${selected.id}`} type="search" value={recordSearch} onChange={event=>setRecordSearch(event.target.value)} placeholder="Service, status, reference, or text"/>{recordSearch&&<Button variant="outline" onClick={()=>setRecordSearch("")}>Clear history search</Button>}<p role="status">Showing {recordCounts[0]} of {recordCounts[1]} {section}. Profile balances include all saved records.</p></div>}
    <section className="customer-records">
      {section === "estimates" && (matchingEstimates.length ? matchingEstimates.map((estimate) => <button className="customer-record record-button" id={"customer-estimate-"+estimate.id} key={estimate.id} onClick={()=>setActiveEstimate({...estimate,customer:selected.name,email:selected.email,phone:selected.phone,address:estimate.address??undefined})}><div><strong>{estimate.service}</strong><small>{new Date(estimate.createdAt).toLocaleDateString()} · {statusLabel(estimate.status)}{estimate.scheduledAt ? ` · ${dateTime(estimate.scheduledAt)}` : ""}</small></div><strong>{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight /></button>) : <div className="record-empty"><ClipboardList /><strong>{customerEstimates.length?"No matching estimates":"No estimates yet"}</strong><p>{customerEstimates.length?"Clear the history search to see all saved estimates.":"Create the first estimate from this customer profile."}</p></div>)}
      {section === "payments" && (matchingPayments.length ? matchingPayments.map((payment) => <article className="customer-record customer-payment-record" key={payment.id} id={"customer-payment-"+payment.id} tabIndex={-1}><div><strong>{payment.type==="Tip"?"Tip":payment.type==="Tip Refund"?"Tip refund":`${paymentTypeLabel(payment.type)} payment`}</strong><small>{dateTime(payment.createdAt)}{payment.reference&&<span className="inline-flex max-w-full flex-wrap items-center gap-1"><span className="font-mono" title={payment.reference}> · Ref …{payment.reference.slice(-12)}</span><button type="button" aria-label="Copy full payment reference" className="rounded border px-2 py-0.5 text-xs" onClick={()=>void navigator.clipboard.writeText(payment.reference||"").catch(()=>{})}>Copy</button></span>}</small><ProcessingDetails payment={payment}/></div><strong className="customer-payment-amount">{money(payment.amountCents)}</strong><RefundPayment payment={payment} onRefunded={()=>void load()}/></article>) : <div className="record-empty"><CreditCard /><strong>{customerPayments.length?"No matching payments":"No payments recorded"}</strong><p>{customerPayments.length?"Clear the history search to see all saved payments.":"Open an estimate and choose Record payment after receiving money through Wave, Cash App, Venmo, cash, check, card, or bank transfer."}</p></div>)}
      {section === "invoices" && (matchingInvoices.length ? matchingInvoices.map((invoice)=><a className="customer-record record-button" id={"customer-invoice-"+invoice.id} tabIndex={-1} key={invoice.id} href={invoice.shareToken?`/invoice/${encodeURIComponent(invoice.shareToken)}?ownerPreview=1&from=customer`:undefined}><div><strong>Invoice #{invoice.id.slice(0,6).toUpperCase()}</strong><small>{(invoice.paymentReviewPending||Number(invoice.paymentOverageOpen)>0)?"Payment review in progress":invoice.status==="paid"?"Paid in full":`${statusLabel(invoice.status)} · Due ${invoice.dueAt?new Date(invoice.dueAt).toLocaleDateString():"on receipt"}`}</small></div><strong>{money(invoice.totalCents)}</strong><ExternalLink/></a>) : <div className="record-empty"><Receipt /><strong>{customerInvoices.length?"No matching invoices":"No invoices yet"}</strong><p>{customerInvoices.length?"Clear the history search to see all saved invoices.":"Open an estimate and tap Create invoice."}</p></div>)}
      {section === "photos"&&<OfflineCustomerPhotos key={selected.id} customerId={selected.id} customerName={selected.name} knownCustomerIds={customers.map(item=>item.id)} legacyCloudPhotoCount={customerPhotos.length}/>}
      {section === "messages"&&<section className="customer-messages-panel" aria-label="Customer messages"><div className="customer-messages-actions"><MessageComposer key={selected.id} customer={selected} estimate={customerEstimates[0]} initialTemplate="estimate" triggerLabel="+ Compose Message" triggerClassName="brand-button" onLogged={(message)=>setMessages((current)=>[message,...current.filter(entry=>entry.id!==message.id)])}/></div>{matchingMessages.length?matchingMessages.map(({message,prepared})=><article className="message-history" id={"customer-message-"+message.id} tabIndex={-1} key={message.id}><span className={`message-channel ${message.channel}`}><MessageSquareText/></span><div><strong>{message.template==="followupContact"?"Customer contact recorded":message.template==="followupSnooze"?"Estimate follow-up snoozed":message.template==="reviewCheckSnooze"?"Review status check deferred":messageLabels[message.template]||"Customer message"}</strong><p>{message.body}</p><small>{message.channel==="contact_recorded"?"Contacted · owner recorded":message.channel==="followup_snoozed"?"Follow-up snoozed until "+dateTime(message.body):message.channel==="review_check_snoozed"?"Owner deferred check until "+dateTime(message.body)+" · no message sent":message.channel.endsWith("_prepared")?"Prepared · sending unconfirmed":message.channel.endsWith("_confirmed")?"Sent · owner confirmed; delivery unknown":message.channel==="copy"?"Copied · sending unconfirmed":"Legacy interaction · sending unconfirmed"} · {dateTime(message.createdAt)}{prepared&&<> · Prepared {dateTime(prepared.createdAt)} · 2 audit events retained</>}</small></div></article>):<div className="record-empty"><MessageSquareText/><strong>{historyEntries.length?"No matching messages":"No messages prepared yet"}</strong><p>{historyEntries.length?"Clear the history search to see all saved messages.":"Compose a personalized text or email above. Prepared drafts and your send confirmations appear here."}</p></div>}</section>}
      {section === "notes" && <div className="notes-panel"><div className="note-compose"><Label className="sr-only" htmlFor={`customer-note-draft-${selected.id}`}>Customer note</Label><Input id={`customer-note-draft-${selected.id}`} value={noteText} disabled={savingNote&&noteSavingCustomer.current===selected.id} onChange={(event)=>{const value=event.target.value;noteDrafts.current[selected.id]=value;setNoteText(value);setNoteFeedback(null);}} placeholder="Gate code, pets, property details…" /><Button className="brand-button" onClick={()=>void saveNote()} disabled={savingNote || !noteText.trim()}><Plus className="h-4 w-4" /> {savingNote?"Saving note…":"Add note"}</Button></div>{noteFeedback?.customerId===selected.id&&<p className={noteFeedback.kind==="error"?"save-error":"save-success"} role={noteFeedback.kind==="error"?"alert":"status"}>{noteFeedback.text}</p>}{noteFeedback?.customerId===selected.id&&noteFeedback.kind==="error"&&<Button variant="outline" className="min-h-11" onClick={()=>void load()} disabled={savingNote}>Refresh saved notes</Button>}{matchingNotes.length ? matchingNotes.map((note)=><article className="note-row" key={note.id} id={"customer-note-"+note.id} tabIndex={-1}><StickyNote /><div><p>{note.body}</p><small>{dateTime(note.createdAt)}</small></div></article>) : <div className="record-empty"><StickyNote /><strong>{customerNotes.length?"No matching notes":"No notes yet"}</strong><p>{customerNotes.length?"Clear the history search to see all saved notes.":"Save access details and job-specific reminders here."}</p></div>}</div>}
    </section>
  </div>;
  return <div className="customers-view">
    <section className="customers-head"><div><p className="eyebrow">Customer records</p><h1>Customers</h1><p>Contact details and job history in one place.</p></div><AddCustomer onAdded={(customer) => { setCustomers((current) => [customer, ...current.filter(item=>item.id!==customer.id)]); setSelectedId(customer.id);void load(true); }} /></section>
    {dueReviewChecks.length>0&&<section className="customer-review-overview" role="region" aria-label="Review checks to consider"><div><strong>{dueReviewChecks.length} review check{dueReviewChecks.length===1?"":"s"} to consider</strong><small>Only completed work with a confirmed request over seven days ago and no review logged</small></div><div>{dueReviewChecks.slice(0,5).map(({customer,state})=><div key={customer.id} className="customer-review-entry"><button type="button" onClick={()=>setSelectedId(customer.id)}>{customer.name} · {state.elapsedDays} days since review request <ChevronRight aria-hidden="true"/></button>{onPrepareReviewTask&&<button type="button" aria-label={`Prepare review check task for ${customer.name}`} onClick={()=>stageReviewCheck(customer,state.requestedAt)}>Create task <Plus aria-hidden="true"/></button>}</div>)}</div>{dueReviewChecks.length>5&&<small>{dueReviewChecks.length-5} more customers — open their profiles to review</small>}</section>}
    {flaggedSignCustomers.length>0&&<section className="customer-sign-overview" role="region" aria-label="Outstanding yard signs"><strong>{flaggedSignCustomers.length} yard sign{flaggedSignCustomers.length===1?"":"s"} to pick up</strong><div>{flaggedSignCustomers.map(({customer,sign})=><div className="customer-sign-entry" key={customer.id}><button type="button" onClick={()=>setSelectedId(customer.id)}>{customer.name} · {sign?.pickupDate&&sign.pickupDate<=tulsaToday?"Pickup due":"Pickup "+sign?.pickupDate}<ChevronRight aria-hidden="true"/></button>{onPreparePickupTask&&<button type="button" aria-label={`Prepare pickup task for ${customer.name}`} onClick={()=>stagePickupTask(customer,sign)}>Create task <Plus aria-hidden="true"/></button>}</div>)}</div></section>}
    {loading ? <div className="customers-state">Loading customers…</div> : error ? <div className="customers-state"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></div> : filteredCustomers.length ? <section className="customer-list">{filteredCustomers.map((customer) => <button className="customer-card" key={customer.id} onClick={() => setSelectedId(customer.id)}><span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><span className="customer-main"><strong>{customer.name}</strong><small>{customer.phone || customer.email || "No contact details saved"}</small></span><span className="customer-totals"><strong>{customer.estimateCount} estimate{customer.estimateCount === 1 ? "" : "s"}</strong><small>{money(customer.estimateTotal)}</small></span><ChevronRight /></button>)}</section> : <div className="customers-state"><Users /><strong>{searchQuery ? "No matching customers" : "No customers yet"}</strong><p>{searchQuery ? "Try a name, phone number, email, or address." : "Add your first customer to start their permanent record."}</p></div>}
  </div>;
}

function EstimatesView({ onSaved, searchQuery, focusEstimateId, onFocusHandled }: { onSaved:(estimate:EstimateRow)=>void; searchQuery:string; focusEstimateId?:string|null; onFocusHandled?:(id:string)=>void }) {
  const [rows,setRows]=useState<EstimateRow[]>([]);
  const [filter,setFilter]=useState("all");
  const [historySearch,setHistorySearch]=useState(searchQuery);
  useEffect(()=>setHistorySearch(searchQuery),[searchQuery]);
  const [view,setView]=useState<"pipeline"|"list">("pipeline");
  const [selected,setSelected]=useState<EstimateRow|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [focusError,setFocusError]=useState("");
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [viewedOnly,setViewedOnly]=useState(false);
  const loadRequest=useRef(0);
  const retryAppend=useRef(false);
  const load=async(append=false)=>{
    const request=++loadRequest.current;
    retryAppend.current=append;
    setLoading(true);setError("");
    try{
      const response=await fetch(`/api/estimate-history?limit=50&q=${encodeURIComponent(historySearch)}&status=${encodeURIComponent(filter)}${append&&nextCursor?`&cursor=${encodeURIComponent(nextCursor)}`:""}`);
      const result=await response.json() as {estimates?:EstimateRow[];nextCursor?:string|null;error?:string};
      if(!response.ok)throw new Error(result?.error||"Estimates could not be loaded.");
      if(!result||!Array.isArray(result.estimates)||result.estimates.length>50||result.estimates.some(item=>!item||typeof item.id!=="string"||!item.id||typeof item.customer!=="string"||typeof item.service!=="string")||new Set(result.estimates.map(item=>item.id)).size!==result.estimates.length)throw new Error("Estimate records could not be read. Try again.");
      if(!(result.nextCursor===null||(typeof result.nextCursor==="string"&&result.nextCursor.length>0&&result.nextCursor.length<=512&&result.estimates.length>0))||(append&&result.nextCursor===nextCursor))throw new Error("Estimate paging did not advance. Try again.");
      const cents=(value:unknown)=>{if((typeof value!=="number"&&typeof value!=="string")||(typeof value==="string"&&!value.trim())||!Number.isSafeInteger(Number(value)))throw new Error("Estimate amounts could not be read. Try again.");return Number(value);};
      if(request!==loadRequest.current)return;
      const incoming=result.estimates.map((item)=>({...item,subtotalCents:cents(item.subtotalCents??item.totalCents),discountCents:cents(item.discountCents??0),totalCents:cents(item.totalCents),depositCents:cents(item.depositCents),paidCents:cents(item.paidCents),invoiceTotalCents:item.invoiceTotalCents==null?item.invoiceTotalCents:cents(item.invoiceTotalCents)}));
      setRows(current=>append?[...current,...incoming.filter(item=>!current.some(row=>row.id===item.id))]:incoming);setNextCursor(result.nextCursor??null);
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Estimates could not be loaded.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{loadRequest.current++;retryAppend.current=false;setLoading(true);setError("");setSelected(null);const timer=window.setTimeout(()=>void load(),200);return()=>{window.clearTimeout(timer);loadRequest.current++;};},[historySearch,filter]);
  useEffect(()=>{if(!focusEstimateId)return;setFocusError("");let cancelled=false;void(async()=>{try{const response=await fetch(`/api/estimate-history?focus=${encodeURIComponent(focusEstimateId)}`);const result=await response.json() as {estimates?:EstimateRow[];error?:string};if(!response.ok||!Array.isArray(result.estimates)||result.estimates.length!==1||result.estimates[0]?.id!==focusEstimateId)throw new Error(result.error||"The selected estimate could not be found.");if(!cancelled){setSelected(result.estimates[0]);onFocusHandled?.(focusEstimateId);}}catch(error){if(!cancelled){setFocusError(error instanceof Error?error.message:"The selected estimate could not be read.");onFocusHandled?.(focusEstimateId);}}})();return()=>{cancelled=true;};},[focusEstimateId]);
  const searched=rows;
  // A viewed link is only an observed event. This is an owner-side review
  // filter, not a claim that the customer dislikes the price or needs a send.
  const isViewedAwaitingDecision=(row:EstimateRow)=>{
    const opened=row.firstViewedAt?Date.parse(row.firstViewedAt):NaN;
    const accepted=row.acceptedAt?Date.parse(row.acceptedAt):NaN;
    return row.status==="sent"&&!row.invoiceId&&!Number(row.paymentOverageOpen??0)&&
      Number.isFinite(opened)&&opened<=Date.now()-86400000&&
      (!Number.isFinite(accepted)||accepted> Date.now());
  };
  const viewedQueue=searched.filter(isViewedAwaitingDecision)
    .sort((a,b)=>Date.parse(a.firstViewedAt!)-Date.parse(b.firstViewedAt!)||a.id.localeCompare(b.id));
  const shownRows=viewedOnly?viewedQueue:searched;
  const visible=shownRows.filter((row)=>filter==="all"||row.status===filter);
  const pipeline=[
    {key:"draft",label:"New quotes",rows:shownRows.filter((row)=>row.status==="draft"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"sent",label:"Follow up",rows:shownRows.filter((row)=>row.status==="sent"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"approved",label:"Approved",rows:shownRows.filter((row)=>row.status==="approved"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"scheduled",label:"Scheduled",rows:shownRows.filter((row)=>row.status==="scheduled"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"completed",label:"Completed",rows:shownRows.filter((row)=>row.status==="completed"&&row.paidCents<resolvedBillingTotalCents(row))},
    {key:"paid",label:"Paid",rows:shownRows.filter((row)=>resolvedBillingTotalCents(row)>0&&row.paidCents>=resolvedBillingTotalCents(row))},
    {key:"declined",label:"Lost",rows:shownRows.filter((row)=>row.status==="declined"&&row.paidCents<resolvedBillingTotalCents(row))},
  ];
  const changed=(estimate:EstimateRow)=>{setRows((current)=>current.some(row=>row.id===estimate.id)?current.map((row)=>row.id===estimate.id?estimate:row):[...current,estimate]);setSelected(current=>current?.id===estimate.id?estimate:current);};
  return <div className="workspace-view">
    <EstimateDetail estimate={selected} onClose={()=>setSelected(null)} onChanged={changed}/>
    <section className="workspace-head"><div><p className="eyebrow">Quote to job</p><h1>Estimates</h1><p>See every opportunity, move it forward, and know what needs attention.</p></div><div className="workspace-head-actions"><div className="view-switch" aria-label="Estimate view"><button className={view==="pipeline"?"active":""} onClick={()=>{setView("pipeline");setFilter("all");}}><SquareKanban/> Pipeline</button><button className={view==="list"?"active":""} onClick={()=>setView("list")}><List/> List</button></div><NewEstimate onSaved={(estimate)=>{onSaved(estimate);setRows((current)=>[estimate,...current]);}}/></div></section>
    {focusError&&<p role="alert" className="save-error">{focusError}</p>}
    <Input aria-label="Search estimate history" placeholder="Search estimate history" maxLength={128} value={historySearch} onChange={event=>setHistorySearch(event.target.value)}/>
    {!loading&&!error&&<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Estimate view tracking filters">
      <Button variant="outline" aria-pressed={viewedOnly} onClick={()=>{setViewedOnly(current=>!current);setFilter("all");setView("list");}}>Viewed 24h+ · awaiting decision ({viewedQueue.length} loaded)</Button>
      {viewedOnly&&<small className="text-muted-foreground" role="status">Showing saved link views at least 24 hours old with no recorded approval. Includes only loaded estimates; viewing does not prove intent or delivery.</small>}
    </div>}
    {view==="list"&&<div className="filter-row">{["all","draft","sent","approved","scheduled","completed","declined"].map((status)=><button key={status} className={filter===status?"active":""} onClick={()=>setFilter(status)}>{statusLabel(status)}</button>)}</div>}
    {loading&&!retryAppend.current?<div className="customers-state">Loading estimates…</div>:error&&!retryAppend.current?<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:view==="pipeline"?<section className="pipeline-board">{pipeline.map((column)=><section className={`pipeline-column ${column.key}`} key={column.key}><header><div><strong>{column.label}</strong><small>{money(column.rows.reduce((sum,row)=>sum+resolvedBillingTotalCents(row),0))}</small></div><b>{column.rows.length}</b></header><div>{column.rows.map((estimate)=><button className="pipeline-card" key={estimate.id} onClick={()=>{setFocusError("");setSelected(estimate);}}><span><strong>{estimate.customer}</strong>{resolvedBillingTotalCents(estimate)>=100000&&<em><Star/> High value</em>}</span><p>{estimate.service}</p>{estimate.scheduledAt&&<small><CalendarDays/> {dateTime(estimate.scheduledAt)}</small>}<footer><span>{estimate.paidCents>0?`${money(estimate.paidCents)} paid`:new Date(estimate.createdAt).toLocaleDateString()}</span><strong>{money(resolvedBillingTotalCents(estimate))}</strong></footer></button>)}{!column.rows.length&&<div className="pipeline-empty">Nothing here</div>}</div></section>)}</section>:visible.length?<section className="estimate-list">{visible.map((estimate)=><button key={estimate.id} className="estimate-card" onClick={()=>{setFocusError("");setSelected(estimate);}}><span className={`status-bar ${estimate.status}`}/><span className="estimate-person"><strong>{estimate.customer}</strong><small>{estimate.service} · {new Date(estimate.createdAt).toLocaleDateString()}</small>{viewedOnly&&<small>Link opened {dateTime(estimate.firstViewedAt!)} · approval not recorded</small>}</span><span className={`status-chip ${estimate.status}`}>{statusLabel(estimate.status)}</span>{estimate.scheduledAt&&<span className="scheduled-chip"><CalendarDays/> {dateTime(estimate.scheduledAt)}</span>}<strong className="estimate-amount">{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight/></button>)}</section>:<div className="customers-state"><ClipboardList/><strong>No matching estimates</strong><p>No matching estimates in this result page. Try another search or status.</p></div>}
    {(!loading&&!error||retryAppend.current)&&<p role="status">{rows.length} estimate records loaded. {nextCursor?"Older matching records are available.":"End of matching history."} Pipeline totals cover loaded records.</p>}{error&&retryAppend.current&&<p role="alert">{error} Previously loaded records remain available.</p>}{nextCursor&&(!error||retryAppend.current)&&<Button variant="outline" disabled={loading} onClick={()=>void load(true)}>{loading?"Loading…":error?"Retry older estimates":"Load older estimates"}</Button>}
  </div>;
}

type WeatherDay={date:string;temperatureMax:number|null;temperatureMin:number|null;rainChance:number|null;windMax:number|null};
type WeatherResponse={location:string;updatedAt:string;current:{temperature:number;description:string};daily:WeatherDay[]};
function WeatherConditionIcon({description}:{description:string}){
 const kind=weatherIconKind(description);
 const Icon=kind==="sun"?Sun:kind==="sun-cloud"?CloudSun:kind==="clear"?Moon:
  kind==="moon-cloud"?CloudMoon:kind==="rain"?CloudRain:kind==="snow"?CloudSnow:
  kind==="storm"?CloudLightning:kind==="fog"?CloudFog:kind==="wind"?Wind:Cloud;
 return <Icon aria-hidden="true" />;
}
function ScheduleWeather({nextJobAt,compact=false,requestedJobAt=null,reviewKey=0}:{nextJobAt?:string|null;compact?:boolean;requestedJobAt?:string|null;reviewKey?:number}){
 const [weather,setWeather]=useState<WeatherResponse|null>(null);const [unavailable,setUnavailable]=useState(false);
 const [weatherReload,setWeatherReload]=useState(0);const [weatherRefreshing,setWeatherRefreshing]=useState(false);
 const [selectedHourlyDate,setSelectedHourlyDate]=useState("");
 const [hourly,setHourly]=useState<HourlyForecastResponse|null>(null);
 const [hourlyLoading,setHourlyLoading]=useState(false);
 const [hourlyError,setHourlyError]=useState("");
 const [hourlyReload,setHourlyReload]=useState(0);
 useEffect(()=>{let cancelled=false;let running=false;const controller=new AbortController();
 const load=async()=>{if(running||cancelled)return;running=true;setWeatherRefreshing(true);try{const response=await fetch("/api/weather",{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error("weather");const result=await response.json() as WeatherResponse;if(!Number.isFinite(result.current?.temperature)||!result.daily?.length)throw Error("weather");if(!cancelled){setWeather(result);setUnavailable(false);}}catch{if(!cancelled)setUnavailable(true);}finally{running=false;if(!cancelled)setWeatherRefreshing(false);}};
 const resume=()=>{if(document.visibilityState==="visible")void load();};void load();const timer=window.setInterval(()=>void load(),15*60*1000);window.addEventListener("focus",resume);document.addEventListener("visibilitychange",resume);
 return()=>{cancelled=true;controller.abort();window.clearInterval(timer);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",resume);};},[weatherReload]);
 // Hourly NWS data is fetched only when the owner opens a specific day.
 // An aborted/stale request may never replace another day's results.
 useEffect(()=>{
  if(!selectedHourlyDate){setHourly(null);setHourlyError("");setHourlyLoading(false);return;}
  let active=true;const controller=new AbortController();
  setHourly(null);setHourlyError("");setHourlyLoading(true);
  const read=async()=>{
   try{
    const response=await fetch(`/api/weather/hourly?date=${encodeURIComponent(selectedHourlyDate)}`,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw Error("Hourly weather unavailable");
    const parsed=await response.json() as HourlyForecastResponse;
    if(parsed.date!==selectedHourlyDate||!Array.isArray(parsed.hours))throw Error("Hourly weather unavailable");
    if(active){setHourly(parsed);setHourlyError("");}
   }catch{
    if(active){setHourly(null);setHourlyError("Hourly details are unavailable right now. The seven-day forecast remains available.");}
   }finally{if(active)setHourlyLoading(false);}
  };
  void read();
  return()=>{active=false;controller.abort();};
 },[selectedHourlyDate,hourlyReload]);
 const lastHandledReviewKey=useRef(0);
 // Deliberate per-job review, never automatically invent a missing NWS forecast hour.
 useEffect(()=>{
  if(!reviewKey||lastHandledReviewKey.current===reviewKey||!requestedJobAt||!weather)return;
  lastHandledReviewKey.current=reviewKey;
  const date=Number.isFinite(Date.parse(requestedJobAt))?new Date(requestedJobAt).toLocaleDateString("en-CA",{timeZone:"America/Chicago"}):"";
  if(date&&weather.daily.some(day=>day.date===date)){
   setSelectedHourlyDate(date);
   setHourlyReload(n=>n+1);
  }else setSelectedHourlyDate("");
 },[requestedJobAt,reviewKey,weather]);
 if(unavailable&&!weather)return <section className="weather-strip unavailable"><CloudRain/><div><strong>Weather unavailable</strong><small>The schedule is still fully available. Check your connection and retry.</small><button type="button" className="weather-week-retry" disabled={weatherRefreshing} onClick={()=>setWeatherReload(n=>n+1)} aria-label="Retry seven-day Tulsa forecast">{weatherRefreshing?"Checking…":"Try again"}</button></div></section>;
 if(!weather)return <section className="weather-strip loading"><CloudRain/><div><strong>Loading Tulsa weather…</strong></div></section>;
 const jobDate=nextJobAt&&Number.isFinite(Date.parse(nextJobAt))?new Date(nextJobAt).toLocaleDateString("en-CA",{timeZone:"America/Chicago"}):"";
 // The NWS API already supplies up to seven Tulsa calendar days. Keep all of them
 // visible in date order even when the next appointment is later in the week.
 const days=weather.daily.slice(0,7);
 const nextJobForecast=jobDate?days.find(day=>day.date===jobDate):undefined;
 const nextJobCautions=nextJobForecast?dailyWorkCautions(nextJobForecast):[];
 const jobStartTime=nextJobAt&&Number.isFinite(Date.parse(nextJobAt))?Date.parse(nextJobAt):null;
 const jobStartHour=jobStartTime!=null&&hourly?.date===jobDate?weatherHourForJobStart(hourly.hours,nextJobAt):null;
 const freeze=days.some(day=>day.temperatureMin!=null&&day.temperatureMin<=32);const rain=days.some(day=>day.rainChance!=null&&day.rainChance>=50);const wind=days.some(day=>day.windMax!=null&&Number.isFinite(day.windMax)&&day.windMax>=20);
 const heat=days.some(day=>day.temperatureMax!=null&&Number.isFinite(day.temperatureMax)&&day.temperatureMax>=85);
 const weekWarnings=[...(rain?["Rain possible this week"]:[]),...(freeze?["Freezing temperatures possible this week"]:[]),...(wind?["Wind ≥20 mph possible this week — check spray drift"]:[]),...(heat?["Hot air possible this week — watch cleaner drying and heat exposure"]:[])];
 const degrees=(value:number|null)=>value==null?"—":`${Math.round(value)}°`;
 return <section className={`weather-strip ${compact?"home-weather":""}`}><div className={`weather-current condition-${weatherIconKind(weather.current.description)}`}><WeatherConditionIcon description={weather.current.description}/><span><small>{weather.location} · 7-day forecast</small><strong>{degrees(weather.current.temperature)} · {weather.current.description}</strong><small>Updated {new Date(weather.updatedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} Central Time</small></span></div><div className="weather-days" role="region" aria-label="Seven-day Tulsa weather forecast" tabIndex={0}>{days.map(day=><article key={day.date} data-forecast-date={day.date} aria-label={new Date(day.date+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric",timeZone:"UTC"})} className={day.date===jobDate?"job-day":""}><button type="button" className="weather-day-toggle" aria-expanded={selectedHourlyDate===day.date} aria-label={`Show hourly forecast for ${new Date(day.date+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric",timeZone:"UTC"})}`} onClick={()=>setSelectedHourlyDate(current=>current===day.date?"":day.date)}><small>{day.date===jobDate?`Next job · ${weatherDayHeading(day,new Date(weather.updatedAt).getTime())}`:weatherDayHeading(day,new Date(weather.updatedAt).getTime())}</small><strong>{formatDailyTemperatures(day)}</strong><span><CloudRain aria-hidden="true"/><span aria-label="Chance of rain">{day.rainChance==null?"—":`${Math.round(day.rainChance)}%`}</span> <Wind aria-hidden="true"/><span aria-label="Maximum wind speed">{day.windMax==null?"—":Math.round(day.windMax)} mph</span></span><span className="weather-hourly-cue">{selectedHourlyDate===day.date?"Hide hours ▲":"View hours ▼"}</span></button></article>)}</div><p className="weather-scroll-hint">Swipe or scroll through the week; tap a day for its hourly forecast →</p>{jobDate&&<div className="weather-next-job" role="region" aria-label="Next job Tulsa weather outlook"><strong>{requestedJobAt&&reviewKey?"Selected job":"Next job"} · Tulsa outlook</strong>{nextJobForecast?<><p>{new Date(jobDate+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"})} · Rain {nextJobForecast.rainChance==null?"—":`${Math.round(nextJobForecast.rainChance)}%`} · Wind {nextJobForecast.windMax==null?"—":`${Math.round(nextJobForecast.windMax)} mph`} · High {nextJobForecast.temperatureMax==null?"—":`${Math.round(nextJobForecast.temperatureMax)}°F`} · Low {nextJobForecast.temperatureMin==null?"—":`${Math.round(nextJobForecast.temperatureMin)}°F`}</p>{nextJobCautions.length>0&&<p className="weather-next-job-cautions">Review before exterior work: {nextJobCautions.join(" · ")}</p>}{jobStartTime!=null&&Number.isFinite(Date.parse(weather.updatedAt))&&jobStartTime>=Date.parse(weather.updatedAt)&&<button type="button" className="weather-job-hour-button" onClick={()=>{if(selectedHourlyDate===jobDate)setHourlyReload(n=>n+1);else setSelectedHourlyDate(jobDate);}} aria-label="Check weather at next job start time">Check weather at job start ↗</button>}{nextJobForecast.temperatureMax!=null&&nextJobForecast.temperatureMax>=85&&<p className="weather-heat-advice">Heat planning: watch for solution drying on hot siding, roofs or concrete; adjust sections and dwell time according to each cleaner’s label. Plan shade, water and cooling breaks.</p>}</>:<p>This appointment is outside the available seven-day Tulsa forecast. Recheck closer to the job.</p>}<small>Tulsa-area air-temperature forecast only — not surface temperature or heat index. Sun, humidity and exertion may increase the hazard; confirm conditions and radar at the actual property.</small></div>}{selectedHourlyDate&&days.some(day=>day.date===selectedHourlyDate)&&<div className="weather-hourly" role="region" aria-label="Hourly Tulsa weather forecast"><div className="weather-hourly-title"><strong>Hourly · {new Date(selectedHourlyDate+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",timeZone:"UTC"})}</strong><div className="weather-hourly-actions"><button type="button" disabled={hourlyLoading} onClick={()=>setHourlyReload(n=>n+1)} aria-label={hourlyError?"Retry hourly forecast":"Refresh hourly forecast"}>{hourlyLoading?"Refreshing…":hourlyError?"Try again":"Refresh hours"}</button><button type="button" onClick={()=>setSelectedHourlyDate("")} aria-label="Close hourly forecast">Close ×</button></div></div>{hourlyLoading?<p role="status">Loading hour-by-hour weather…</p>:hourlyError?<p role="alert">{hourlyError}</p>:hourly?.date===selectedHourlyDate?(hourly.hours.length?<><p className="weather-hourly-checked">Checked {new Date(hourly.updatedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} Central Time · Conditions can change quickly</p>{selectedHourlyDate===jobDate&&jobStartTime!=null&&<p className="weather-job-hour-summary" role="status">{jobStartHour?`Scheduled start (${new Date(nextJobAt!).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} Central) · ${Math.round(jobStartHour.temperature)}°F · Rain ${jobStartHour.rainChance==null?"—":`${Math.round(jobStartHour.rainChance)}%`} · Wind ${jobStartHour.windMph==null?"—":`${Math.round(jobStartHour.windMph)} mph`}`:"NWS hourly conditions for the exact job start are not available yet. Review the surrounding hours and recheck closer to the appointment."}</p>}{selectedHourlyDate===jobDate&&jobStartHour&&hourlyWorkCautions(jobStartHour).length>0&&<p className="weather-job-hour-cautions" role="alert">At the scheduled job start: {hourlyWorkCautions(jobStartHour).join(" · ")}. Check actual property conditions before working.</p>}<div className="weather-hourly-hours">{hourly.hours.map(hour=><article key={hour.startTime} className={`weather-hour ${hourlyWorkCautions(hour).length?"weather-hour-caution":""} ${jobStartHour?.startTime===hour.startTime?"weather-hour-job-time":""}`}><strong>{new Date(hour.startTime).toLocaleTimeString("en-US",{hour:"numeric",timeZone:"America/Chicago"})}{jobStartHour?.startTime===hour.startTime&&<small className="weather-job-hour-label">Job start hour</small>}</strong><span>{Math.round(hour.temperature)}°F</span><span>{hour.description}</span><span>Rain {hour.rainChance==null?"—":`${Math.round(hour.rainChance)}%`}</span><span>Wind {hour.windMph==null?"—":`${Math.round(hour.windMph)} mph`}</span>{hourlyWorkCautions(hour).length>0&&<p className="weather-hour-cautions" aria-label="Conditions to review before exterior work">{hourlyWorkCautions(hour).join(" · ")}</p>}</article>)}</div><p className="weather-hourly-note">Planning cues: rain ≥50%, wind ≥20 mph, freezing ≤32°F, hot air ≥85°F and very hot air ≥95°F. Air temperature is not a heat-index or surface reading. Direct sun, humidity and exertion can increase heat risk. Keep cleaning solutions from drying by following product labels, work smaller sections when appropriate, hydrate and take cooling breaks. Check radar and conditions at the actual job site.</p></>:<p>National Weather Service hourly details are not available for this day yet.</p>):<p>Choose a day to view its forecast.</p>}</div>}<div className={`weather-alert ${weekWarnings.length?"show":""}`}>{weekWarnings.join(" · ")}</div><div className="weather-radar-action"><a href="https://radar.weather.gov/" target="_blank" rel="noopener noreferrer" aria-label="Open live National Weather Service radar">View live radar ↗</a><small>Search Tulsa in the radar map</small></div><div className="weather-refresh-action"><button type="button" disabled={weatherRefreshing} onClick={()=>setWeatherReload(n=>n+1)} aria-label={unavailable?"Retry seven-day Tulsa forecast":"Refresh seven-day Tulsa weather forecast"}>{weatherRefreshing?"Checking week…":unavailable?"Try again":"Refresh week"}</button>{unavailable&&<p role="alert">Weather refresh failed. Showing the last successful Tulsa forecast, which may be outdated. Recheck before relying on conditions for a job.</p>}</div><a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">National Weather Service</a></section>;
}

function ScheduleView({ searchQuery }:{searchQuery:string}) {
  const [rows,setRows]=useState<EstimateRow[]>([]);
  const [selected,setSelected]=useState<EstimateRow|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [lastCheckedAt,setLastCheckedAt]=useState<string|null>(null);
  const [dayFilter,setDayFilter]=useState<"all"|"today"|"tomorrow"|"week"|"date">("all");
  const [selectedDate,setSelectedDate]=useState("");
  const [openContactJobId,setOpenContactJobId]=useState<string|null>(null);
  const [contactDraft,setContactDraft]=useState<{jobId:string;kind:"reminder"|"arrival";text:string;status:"copying"|"copied"|"manual"}|null>(null);
  const [weatherReview,setWeatherReview]=useState<{at:string;key:number}|null>(null);
  const weatherReviewCount=useRef(0);
  const weatherPanelRef=useRef<HTMLDivElement>(null);
  const reviewScheduledWeather=(scheduledAt:string)=>{
    weatherReviewCount.current++;
    setWeatherReview({at:scheduledAt,key:weatherReviewCount.current});
    weatherPanelRef.current?.scrollIntoView?.({block:"start",behavior:"smooth"});
  };
  // Drafts are local only. They never send a message or mark an appointment confirmed.
  const copyScheduledMessage=async(job:EstimateRow,kind:"reminder"|"arrival")=>{
    if(!job.scheduledAt||!Number.isFinite(Date.parse(job.scheduledAt)))return;
    const when=new Date(job.scheduledAt).toLocaleString("en-US",{weekday:"long",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago",timeZoneName:"short"});
    const customer=job.customer?.trim()||"there";
    const service=job.service?.trim()||"exterior cleaning";
    const message=kind==="reminder"
      ?`Hi ${customer}! This is First In Response Exteriors. Just confirming your ${service} appointment for ${when}. Please let us know if anything has changed or if we need special access. Thank you!`
      :`Hi ${customer}! This is First In Response Exteriors. I'm on my way for your ${service} appointment. I'll see you soon!`;
    setContactDraft({jobId:job.id,kind,text:message,status:"copying"});
    try{
      if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setContactDraft(draft=>draft?.jobId===job.id&&draft.text===message?{...draft,status:"copied"}:draft);
    }catch{
      setContactDraft(draft=>draft?.jobId===job.id&&draft.text===message?{...draft,status:"manual"}:draft);
    }
  };
  const loadRequest=useRef(0);
  const load=async()=>{
    const request=++loadRequest.current;
    setLoading(true);setError("");setSelected(null);setWeatherReview(null);setOpenContactJobId(null);setContactDraft(null);
    try{
      const response=await fetch("/api/estimate-history?limit=50",{cache:"no-store"});
      const result=await response.json() as {estimates?:EstimateRow[];error?:string};
      if(!response.ok)throw new Error(result.error||"Schedule could not be loaded.");
      if(!Array.isArray(result.estimates))throw new Error("Schedule records could not be read. Try again.");
      const complete=await completeEstimatePages<EstimateRow>(result,(url)=>fetch(url,{cache:"no-store"}),()=>request===loadRequest.current);if(!complete)return;
      if(request!==loadRequest.current)return;
      // Do not publish partial schedules, routes or currency figures from unverified reads.
      // Cents must remain exact integers; financial strings from D1 are normal, fractional
      // cents and unsafe numeric conversions are not.
      const exactCents=(raw:unknown)=>{
        if((typeof raw!=="number"&&typeof raw!=="string")||(typeof raw==="string"&&!raw.trim())||!Number.isSafeInteger(Number(raw)))
          throw new Error("Schedule amounts could not be verified. Refresh before using balances or routes.");
        return Number(raw);
      };
      const verified=complete.map((item)=>{
        if(item.scheduledAt&&(!Number.isFinite(Date.parse(item.scheduledAt))||typeof item.scheduledAt!=="string"))
          throw new Error("A job appointment date could not be verified. Refresh the schedule before using directions.");
        return {...item,
          subtotalCents:exactCents(item.subtotalCents??item.totalCents),
          discountCents:exactCents(item.discountCents??0),
          totalCents:exactCents(item.totalCents),
          depositCents:exactCents(item.depositCents),
          paidCents:exactCents(item.paidCents),
          invoiceTotalCents:item.invoiceTotalCents==null?null:exactCents(item.invoiceTotalCents)
        };
      });
      setRows(verified);
      setLastCheckedAt(new Date().toISOString());
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Schedule could not be loaded.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{void load();return()=>{loadRequest.current++;};},[]);
  const matches=(row:EstimateRow)=>[row.customer,row.service,row.address].join(" ").toLowerCase().includes(searchQuery.toLowerCase());
  const now=useCurrentTime();
  // Advisory only: a shared start minute is worth reviewing, but without
  // duration/crew data it does not prove the two jobs actually overlap.
  // Calculate across all verified records so a search cannot conceal another job.
  const bookedMinutes=new Map<number,Set<string>>();
  for(const job of rows){
    if(job.status!=="scheduled"||!job.scheduledAt||!job.id)continue;
    const start=Date.parse(job.scheduledAt);
    if(!Number.isFinite(start)||start+60_000<=now)continue;
    const minute=Math.floor(start/60_000);
    const ids=bookedMinutes.get(minute)??new Set<string>();
    ids.add(job.id);bookedMinutes.set(minute,ids);
  }
  const startConflicts=[...bookedMinutes].filter(([,ids])=>ids.size>1)
    .sort(([a],[b])=>a-b).map(([minute,ids])=>({minute,ids:[...ids]}));
  const startConflictIds=new Set(startConflicts.flatMap(conflict=>conflict.ids));
  const scheduled=rows.filter((row)=>row.scheduledAt&&matches(row)).sort((a,b)=>new Date(a.scheduledAt!).getTime()-new Date(b.scheduledAt!).getTime());
  const needsAttention=scheduled.filter((row)=>new Date(row.scheduledAt!).getTime()<now&&row.status!=="declined"&&(row.status!=="completed"||row.paidCents<resolvedBillingTotalCents(row)));
  const tulsaDay=(value:string|number)=>new Date(value).toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
  const today=tulsaDay(now),tomorrowDate=new Date(today+"T12:00:00Z");tomorrowDate.setUTCDate(tomorrowDate.getUTCDate()+1);const tomorrow=tomorrowDate.toISOString().slice(0,10);
  const weekEnd=new Date(today+"T12:00:00Z");weekEnd.setUTCDate(weekEnd.getUTCDate()+6);
  const lastWeekDay=weekEnd.toISOString().slice(0,10);
  const selectAdjacentDay=(step:-1|1)=>{
    const base=dayFilter==="date"&&selectedDate?selectedDate:today;
    const day=new Date(base+"T12:00:00Z");
    if(!Number.isFinite(day.getTime()))return;
    day.setUTCDate(day.getUTCDate()+step);
    const next=day.toISOString().slice(0,10);
    setSelectedDate(next);setDayFilter("date");setWeatherReview(null);
  };
  // A missing field is an owner checklist cue, never a claim that a customer's
  // saved profile or a job site has been independently verified.
  const safePhone=(value?:string)=>{
    const raw=value?.trim()??"";
    const digits=/^[+0-9().\s-]+$/.test(raw)?raw.replace(/\D/g,""):"";
    return digits.length===10?"+1"+digits:digits.length===11&&digits.startsWith("1")?"+"+digits:null;
  };
  const safeEmail=(value?:string)=>{
    const raw=value?.trim()??"";
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(raw)?raw:null;
  };
  const allVerifiedUpcoming=rows.filter(row=>row.status==="scheduled"&&row.scheduledAt&&Date.parse(row.scheduledAt)>=now)
    .sort((a,b)=>Date.parse(a.scheduledAt!)-Date.parse(b.scheduledAt!));
  const jobPrepIssues=allVerifiedUpcoming.map(job=>({
    job,missingAddress:!job.address?.trim(),missingContact:!safePhone(job.phone)&&!safeEmail(job.email)
  })).filter(issue=>issue.missingAddress||issue.missingContact);
  const allUpcoming=scheduled.filter((row)=>new Date(row.scheduledAt!).getTime()>=now&&row.status==="scheduled");
  const todayCount=allUpcoming.filter(row=>tulsaDay(row.scheduledAt!)===today).length;
  const tomorrowCount=allUpcoming.filter(row=>tulsaDay(row.scheduledAt!)===tomorrow).length;
  const weekCount=allUpcoming.filter(row=>tulsaDay(row.scheduledAt!)>=today&&tulsaDay(row.scheduledAt!)<=lastWeekDay).length;
  // Date-specific browsing also shows already-completed work, even for past days;
  // the normal upcoming windows remain strictly future scheduled appointments.
  const chosenDayJobs=dayFilter==="date"&&selectedDate
    ?scheduled.filter(row=>(row.status==="scheduled"||row.status==="completed")&&tulsaDay(row.scheduledAt!)===selectedDate)
    :null;
  const upcoming=chosenDayJobs??allUpcoming.filter(row=>dayFilter==="all"||
    (dayFilter==="today"?tulsaDay(row.scheduledAt!)===today:
    dayFilter==="tomorrow"?tulsaDay(row.scheduledAt!)===tomorrow:
    tulsaDay(row.scheduledAt!)>=today&&tulsaDay(row.scheduledAt!)<=lastWeekDay));
  // Keep routes on the first upcoming scheduled day even if its first job lacks
  // an address. Never silently jump to a different day's route or omit later stops.
  const routeDayCandidates=upcoming.filter(row=>row.status==="scheduled"&&row.scheduledAt&&Date.parse(row.scheduledAt)>=now);
  const routeDate=routeDayCandidates[0]?.scheduledAt?new Date(routeDayCandidates[0].scheduledAt):null;
  const routeDayJobs=routeDate?routeDayCandidates.filter(row=>tulsaDay(row.scheduledAt!)===tulsaDay(routeDate.getTime())):[];
  const routeMissingAddress=routeDayJobs.filter(row=>!row.address?.trim());
  const routeWithAddress=routeDayJobs.filter(row=>!!row.address?.trim());
  // Eight new jobs per segment is intentionally conservative for maps waypoint
  // limits; continuation routes explicitly start at the prior segment's last stop.
  const routeGroups=Array.from({length:Math.ceil(routeWithAddress.length/8)},(_,index)=>{
    const jobs=routeWithAddress.slice(index*8,(index+1)*8);
    const previous=index>0?routeWithAddress[index*8-1]:null;
    const origin=previous?`&origin=${encodeURIComponent(previous.address!.trim())}`:"";
    const url=`https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate${origin}&destination=${encodeURIComponent(jobs.at(-1)!.address!.trim())}${jobs.length>1?`&waypoints=${jobs.slice(0,-1).map(job=>encodeURIComponent(job.address!.trim())).join("%7C")}`:""}`;
    return {url,jobs,start:index*8+1,end:index*8+jobs.length};
  });
  const routeJobs=routeGroups[0]?.jobs??[];
  const routeUrl=routeGroups[0]?.url??"";
  const routeLabel=routeDate&&tulsaDay(routeDate.getTime())===today?"Route today":routeDate&&tulsaDay(routeDate.getTime())===tomorrow?"Route tomorrow":routeDate?`Route ${routeDate.toLocaleDateString("en-US",{weekday:"short",timeZone:"America/Chicago"})}`:"Route next jobs";
  return <div className="workspace-view"><EstimateDetail estimate={loading||error?null:selected} onClose={()=>setSelected(null)} onChanged={(estimate)=>{setRows((current)=>current.map((row)=>row.id===estimate.id?estimate:row));setSelected(current=>current?.id===estimate.id?estimate:current);}}/><section className="workspace-head"><div><p className="eyebrow">Jobs</p><h1>Schedule</h1><p>Upcoming work, customer details, and one-tap directions. Times shown in Tulsa (Central Time).</p>{!loading&&!error&&lastCheckedAt&&<p className="schedule-last-checked" role="status">Last checked {new Date(lastCheckedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} Central Time</p>}</div><div className="schedule-header-actions"><Button variant="outline" onClick={()=>void load()} disabled={loading} aria-label="Refresh schedule">{loading?"Refreshing…":"Refresh schedule"}</Button>{!loading&&!error&&routeUrl&&<a className="route-day-button" href={routeUrl} target="_blank" rel="noreferrer"><Navigation/> {routeLabel}<small>{routeWithAddress.length>8?`${routeJobs.length} of ${routeWithAddress.length} mapped stops`:`${routeJobs.length} stop${routeJobs.length===1?"":"s"}`}</small></a>}</div></section><div className="schedule-weather-anchor" ref={weatherPanelRef}><ScheduleWeather nextJobAt={!loading&&!error?(weatherReview?.at??upcoming.find(row=>row.status==="scheduled"&&Date.parse(row.scheduledAt!)>=now)?.scheduledAt):undefined} requestedJobAt={!loading&&!error?weatherReview?.at:null} reviewKey={!loading&&!error?weatherReview?.key:0}/></div>
    {loading?<div className="customers-state">Loading schedule…</div>:error?<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:<>
      {needsAttention.length>0&&<section className="needs-attention"><header><div><h2>Needs attention</h2><p>Past job dates that still need to be completed, rescheduled, or paid.</p></div><b>{needsAttention.length}</b></header>{needsAttention.map((job)=><button key={job.id} onClick={()=>setSelected(job)}><Clock3/><span><strong>{job.customer}</strong><small>{job.service} · was scheduled {dateTime(job.scheduledAt!)}</small><b>{money(billingBalanceCents(job))} due</b></span><ChevronRight/></button>)}</section>}
      {routeDate&&(routeGroups.length>1||routeMissingAddress.length>0)&&<section className={`schedule-route-review${routeMissingAddress.length?" schedule-route-missing":""}`} role="region" aria-label="Route coverage review"><div><strong>{routeLabel} · check stops</strong><p>{routeWithAddress.length} of {routeDayJobs.length} upcoming job{routeDayJobs.length===1?"":"s"} on this day have usable saved addresses. {routeGroups.length>1?`Open ${routeGroups.length} route segments in appointment order.`:""}</p></div>{routeMissingAddress.length>0&&<div className="schedule-route-missing-list"><strong>{routeMissingAddress.length} stop{routeMissingAddress.length===1?"":"s"} not mapped — address missing</strong>{routeMissingAddress.map(job=><button type="button" key={job.id} onClick={()=>setSelected(job)}>{job.customer} · Review address <ChevronRight aria-hidden="true"/></button>)}</div>}{routeGroups.length>1&&<div className="schedule-route-extra-links"><strong>Additional route segments</strong>{routeGroups.slice(1).map(group=><a key={group.start} href={group.url} target="_blank" rel="noopener noreferrer" aria-label={`Route stops ${group.start} to ${group.end}`}><Navigation aria-hidden="true"/> Stops {group.start}–{group.end} <small>Continue from prior stop</small></a>)}</div>}<small>Routes follow scheduled stop order, not optimized driving time. Each segment includes at most eight new addressed stops; check Maps before driving.</small></section>}
      {startConflicts.length>0&&<section className="schedule-start-conflicts" role="region" aria-label="Appointments sharing a start time"><div><strong>Check same-time appointments</strong><p>{startConflicts.length} start time{startConflicts.length===1?"":"s"} shared by multiple upcoming jobs. Review timing and travel; this is not a confirmed overlap.</p></div>{startConflicts.map(conflict=><button type="button" key={conflict.minute} onClick={()=>{setSelectedDate(tulsaDay(conflict.minute*60_000));setDayFilter("date");setWeatherReview(null);}}><span>{new Date(conflict.minute*60_000).toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} Central · {conflict.ids.length} jobs</span><span>Review day <ChevronRight aria-hidden="true"/></span></button>)}</section>}
      {jobPrepIssues.length>0&&<details className="schedule-prep-alert" aria-label="Upcoming job details to review"><summary><span><strong>Check appointment details</strong><small>{jobPrepIssues.length} upcoming job{jobPrepIssues.length===1?"":"s"} missing an address or a usable phone/email in the job record</small></span><ChevronRight aria-hidden="true"/></summary><div className="schedule-prep-items">{jobPrepIssues.map(({job,missingAddress,missingContact})=><button type="button" key={job.id} onClick={()=>setSelected(job)}><span><strong>{job.customer}</strong><small>{new Date(job.scheduledAt!).toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})} Central · {missingAddress?"Address missing":""}{missingAddress&&missingContact?" · ":""}{missingContact?"Phone/email missing":""}</small></span><span>Review <ChevronRight aria-hidden="true"/></span></button>)}</div><p>Checks use saved job details only. Review each customer profile if information is already available there.</p></details>}
      <div className="schedule-window-controls" role="group" aria-label="Schedule date range">{(["all","today","tomorrow","week"] as const).map(value=><Button key={value} variant={dayFilter===value?"default":"outline"} aria-pressed={dayFilter===value} onClick={()=>{setDayFilter(value);setWeatherReview(null);}}>{value==="all"?`All upcoming (${allUpcoming.length})`:value==="today"?`Today (${todayCount})`:value==="tomorrow"?`Tomorrow (${tomorrowCount})`:`Next 7 days (${weekCount})`}</Button>)}</div>
      <div className="schedule-date-picker" role="group" aria-label="Browse a specific schedule date">
        <label htmlFor="schedule-specific-date">Choose a work date</label>
        <div className="schedule-date-picker-actions">
          <Button variant="outline" aria-label="Previous work date" onClick={()=>selectAdjacentDay(-1)}>Previous day</Button>
          <input id="schedule-specific-date" aria-label="Choose a work date" type="date" value={dayFilter==="date"?selectedDate:""} onChange={event=>{setSelectedDate(event.target.value);setDayFilter(event.target.value?"date":"all");setWeatherReview(null);}}/>
          <Button variant="outline" aria-label="Next work date" onClick={()=>selectAdjacentDay(1)}>Next day</Button>
        </div>
        {dayFilter==="date"&&selectedDate&&<p role="status">Showing scheduled and completed jobs for {new Date(selectedDate+"T12:00:00Z").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric",timeZone:"UTC"})}. Driving routes are available only for future scheduled stops.</p>}
      </div>
      <section className="schedule-board"><header><h2>{dayFilter==="date"?"Selected day’s jobs":"Upcoming jobs"}</h2><span>{upcoming.length}</span></header>{upcoming.length?upcoming.map((job)=>{const phone=safePhone(job.phone);const email=safeEmail(job.email);const nearDay=tulsaDay(job.scheduledAt!);const nearTerm=job.status==="scheduled"&&Date.parse(job.scheduledAt!)>=now&&(nearDay===today||nearDay===tomorrow);const missingAddress=!job.address?.trim();const missingContact=!phone&&!email;return <div className={`schedule-job-shell${nearTerm&&(missingAddress||missingContact)?" schedule-job-needs-prep":""}`} key={job.id}><button className="schedule-job" onClick={()=>setSelected(job)}><span className="schedule-date"><b>{new Date(job.scheduledAt!).toLocaleDateString("en-US",{day:"numeric",timeZone:"America/Chicago"})}</b><small>{new Date(job.scheduledAt!).toLocaleString("en-US",{month:"short",timeZone:"America/Chicago"}).toUpperCase()}</small></span><span><strong>{job.customer}</strong><small>{job.service} · {new Date(job.scheduledAt!).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Chicago"})}</small><em>{job.address||"No address saved"}</em>{nearTerm&&<span className="schedule-job-inline-flags">{dayFilter!=="today"&&dayFilter!=="tomorrow"&&<small className="schedule-job-day-chip">{nearDay===today?"Today":"Tomorrow"}</small>}{missingAddress&&<small className="schedule-job-prep-chip">Review address</small>}{missingContact&&<small className="schedule-job-prep-chip">Review contact</small>}</span>}{dayFilter==="date"&&<small className="schedule-history-status">{statusLabel(job.status)}</small>}{startConflictIds.has(job.id)&&<small className="schedule-conflict-chip">Shares a start time — review</small>}</span><strong>{money(resolvedBillingTotalCents(job))}</strong><ChevronRight/></button>{job.status==="scheduled"&&Date.parse(job.scheduledAt!)>=now&&<div className="schedule-job-utilities"><button type="button" className="schedule-job-weather-action" aria-label={`Check hourly weather for ${job.customer} job`} onClick={()=>reviewScheduledWeather(job.scheduledAt!)}><CloudSun aria-hidden="true"/> Weather</button>{job.address?.trim()&&<a className="schedule-job-directions-action" aria-label={`Directions to ${job.customer} job`} href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=${encodeURIComponent(job.address.trim())}`} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden="true"/> Directions</a>}{(phone||email)&&<button type="button" className="schedule-job-contact-toggle" aria-label={`Contact ${job.customer} for scheduled job`} aria-expanded={openContactJobId===job.id} onClick={()=>{setContactDraft(null);setOpenContactJobId(current=>current===job.id?null:job.id);}}><Phone aria-hidden="true"/> Contact</button>}</div>}{openContactJobId===job.id&&(phone||email)&&<div className="schedule-job-contact-panel" role="group" aria-label={`Contact options for ${job.customer}`}>{phone&&<><a aria-label={`Call ${job.customer} about scheduled job`} href={"tel:"+phone}><Phone aria-hidden="true"/> Call</a><a aria-label={`Text ${job.customer} about scheduled job`} href={"sms:"+phone}><MessageSquareText aria-hidden="true"/> Text</a></>}{email&&<a aria-label={`Email ${job.customer} about scheduled job`} href={"mailto:"+encodeURIComponent(email)}><Mail aria-hidden="true"/> Email</a>}<div className="schedule-job-message-tools"><button type="button" aria-label={`Copy appointment reminder for ${job.customer}`} onClick={()=>void copyScheduledMessage(job,"reminder")}><Copy aria-hidden="true"/> Copy reminder</button>{nearDay===today&&<button type="button" aria-label={`Copy on-my-way message for ${job.customer}`} onClick={()=>void copyScheduledMessage(job,"arrival")}><Copy aria-hidden="true"/> Copy on my way</button>}</div>{contactDraft?.jobId===job.id&&<div className="schedule-job-message-preview"><strong role="status">{contactDraft.status==="copied"?"Message copied — paste into a text or email.":contactDraft.status==="manual"?"Clipboard unavailable — select and copy this message manually.":"Copying message…"}</strong><textarea readOnly aria-label={`Prepared message for ${job.customer}`} value={contactDraft.text} rows={3} onFocus={event=>event.currentTarget.select()}/><small>Review or edit after pasting. Nothing was sent or marked confirmed.</small></div>}<small>Contact links open your phone apps; nothing is sent automatically.</small></div>}</div>}):<div className="record-empty"><CalendarDays/><strong>{dayFilter==="all"?"No upcoming jobs":dayFilter==="today"?"No upcoming jobs today":dayFilter==="tomorrow"?"No upcoming jobs tomorrow":dayFilter==="date"?"No scheduled or completed jobs on this date":"No upcoming jobs in the next 7 days"}</strong><p>{dayFilter==="all"?"Open an approved estimate and save a job date.":"Choose All upcoming to see later appointments. Past-due work remains under Needs attention."}</p></div>}</section>
    </>}
  </div>;
}

function InvoicesView({searchQuery,focusInvoiceId,onFocusHandled}:{searchQuery:string;focusInvoiceId?:string|null;onFocusHandled?:(id:string)=>void}) {
  const [rows,setRows]=useState<InvoiceRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const loadRequest=useRef(0);
  const load=async()=>{
    const request=++loadRequest.current;
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/invoices");
      const result=await response.json() as {invoices?:InvoiceRow[];error?:string};
      if(!response.ok)throw new Error(result.error||"Invoices could not be loaded.");
      if(!Array.isArray(result.invoices))throw new Error("Invoice records could not be read. Try again.");
      if(request!==loadRequest.current)return;
      setRows(result.invoices.map((item)=>({...item,totalCents:Number(item.totalCents),paidCents:Number(item.paidCents??0)})));
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Invoices could not be loaded.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{void load();return()=>{loadRequest.current++;};},[]);
  useEffect(()=>{
    if(!focusInvoiceId||loading||error)return;
    const invoice=rows.find(row=>row.id===focusInvoiceId);
    if(!invoice){setError("The selected invoice is unavailable. Refresh the invoice list or check your connection.");onFocusHandled?.(focusInvoiceId);return;}
    const element=document.getElementById('invoice-'+invoice.id);
    if(element){element.scrollIntoView({block:"center"});element.focus({preventScroll:true});onFocusHandled?.(focusInvoiceId);}
  },[focusInvoiceId,loading,error,rows]);
  const visible=rows.filter((row)=>[row.customer,row.service,row.status].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Billing</p><h1>Invoices</h1><p>Open, send, and record payment against every invoice.</p></div></section>{loading?<div className="customers-state">Loading invoices…</div>:error?<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:visible.length?<section className="invoice-list">{visible.map((invoice)=>{const estimate={id:invoice.estimateId,customer:invoice.customer||"Customer",service:invoice.service||"Service",status:invoice.estimateStatus,depositCents:invoice.depositCents,totalCents:invoice.totalCents,paidCents:Number(invoice.paidCents??0)};return <article className="invoice-card" id={`invoice-${invoice.id}`} tabIndex={-1} key={invoice.id}><span className="invoice-icon"><Receipt/></span><div><strong>{invoice.customer}</strong><small>{invoice.service} · Invoice #{invoice.id.slice(0,6).toUpperCase()}</small></div><span className={`status-chip ${(invoice.paymentReviewPending||Number(invoice.paymentOverageOpen)>0)?"partial":invoice.status}`}>{(invoice.paymentReviewPending||Number(invoice.paymentOverageOpen)>0)?"Payment review":statusLabel(invoice.status)}</span><div className="invoice-total"><strong>{money(invoice.totalCents)}</strong><small>{(invoice.paymentReviewPending||Number(invoice.paymentOverageOpen)>0)?"Billing exception open":`${money(Math.max(0,invoice.totalCents-Number(invoice.paidCents??0)))} balance`}</small></div><div className="invoice-actions">{invoice.shareToken&&<a href={`/invoice/${encodeURIComponent(invoice.shareToken)}?ownerPreview=1&from=invoices`}><ExternalLink/>Open</a>}<RecordPayment key={estimate.id} estimate={estimate} onRecorded={()=>void load()}/></div></article>;})}</section>:<div className="customers-state"><Receipt/><strong>{rows.length?"No matching invoices":"No invoices yet"}</strong><p>{rows.length?"Try another customer, service, or status.":"Open an estimate and choose Create invoice."}</p></div>}</div>;
}

function ContractsView({searchQuery}:{searchQuery:string}){
  const [rows,setRows]=useState<EstimateRow[]>([]);const [selected,setSelected]=useState<EstimateRow|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const loadRequest=useRef(0);
  const load=async()=>{
    const request=++loadRequest.current;
    setLoading(true);setError("");setSelected(null);
    try{
      const response=await fetch("/api/estimate-history?limit=50");
      const result=await response.json() as {estimates?:EstimateRow[];error?:string};
      if(!response.ok)throw new Error(result.error||"Agreements could not be loaded.");
      if(!Array.isArray(result.estimates))throw new Error("Agreement records could not be read. Try again.");
      if(request!==loadRequest.current)return;
      const complete=await completeEstimatePages<EstimateRow>(result,fetch,()=>request===loadRequest.current);if(!complete)return;
      setRows(complete.map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents),pendingChangeCount:Number(item.pendingChangeCount??0)})));
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Agreements could not be loaded.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{void load();return()=>{loadRequest.current++;};},[]);const visible=rows.filter((row)=>[row.customer,row.service,row.signedName].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));const signed=rows.filter((row)=>row.signedAt).length;
  return <div className="workspace-view"><EstimateDetail estimate={loading||error?null:selected} onClose={()=>setSelected(null)} onChanged={()=>{setSelected(null);void load();}}/><section className="workspace-head"><div><p className="eyebrow">Contracts & e-signatures</p><h1>Agreements</h1><p>See who viewed, signed, or requested a change to each estimate.</p></div></section>{!loading&&!error&&<section className="business-metrics"><article><small>Signed agreements</small><strong>{signed}</strong></article><article><small>Awaiting signature</small><strong>{rows.filter((row)=>!row.signedAt&&!["declined","completed"].includes(row.status)).length}</strong></article><article><small>Change requests</small><strong>{rows.reduce((sum,row)=>sum+Number(row.pendingChangeCount??0),0)}</strong></article></section>}{loading?<div className="customers-state">Loading agreements…</div>:error?<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:visible.length?<section className="contract-list">{visible.map((estimate)=><button key={estimate.id} onClick={()=>setSelected(estimate)}><span className={`contract-state ${estimate.signedAt?"signed":Number(estimate.pendingChangeCount)>0?"change":"pending"}`}>{estimate.signedAt?<PenLine/>:Number(estimate.pendingChangeCount)>0?<MessageSquareText/>:<Clock3/>}</span><span><strong>{estimate.customer}</strong><small>{estimate.service} · {money(estimate.totalCents)}</small></span><span className={`status-chip ${estimate.signedAt?"approved":"draft"}`}>{estimate.signedAt?"Signed":"Awaiting signature"}</span><ChevronRight/></button>)}</section>:<div className="customers-state"><PenLine/><strong>{rows.length?"No matching agreements":"No agreements yet"}</strong><p>{rows.length?"Try another customer, service, or signer.":"Create an estimate to send the service agreement for signature."}</p></div>}</div>;
}

function FollowUpsView({searchQuery,focusEstimateId,onFocusHandled,onOpenEstimate,onOpenCustomer}:{searchQuery:string;focusEstimateId?:string|null;onFocusHandled?:(id:string)=>void;onOpenEstimate?:(id:string)=>void;onOpenCustomer?:(id:string)=>void}){
  /** Read-only presentation: prepared/recorded never means sent or delivered. */
  function contactLabel(event:{channel:string;template:string}){
    const about=event.template==="estimate"?"Estimate":event.template==="invoice"?"Invoice":
      event.template==="review"?"Review request":event.template.startsWith("followUp")?"Estimate follow-up":
      event.template==="appointmentReminder"?"Appointment reminder":"Customer communication";
    switch(event.channel){
      case "text_confirmed":return {title:about+" · owner-confirmed text",detail:"Owner confirmed send · delivery unverified"};
      case "email_confirmed":return {title:about+" · owner-confirmed email",detail:"Owner confirmed send · delivery unverified"};
      case "text_prepared":case "email_prepared":return {title:about+" prepared",detail:"Sending unconfirmed"};
      case "copy":return {title:about+" copied",detail:"Sending unconfirmed"};
      case "contact_recorded":return {title:"Contact logged",detail:"Owner recorded contact · no send claimed"};
      case "followup_snoozed":return {title:"Reminder snoozed",detail:"No customer message claimed"};
      default:return {title:"Legacy communication record",detail:"Sending and delivery unverified"};
    }
  }
  /** Read-only saved estimate milestones: a timestamp is not proof of external delivery. */
  function followupMilestones(estimate:EstimateRow){
    const events:{key:string;at:string;title:string;time:number}[]=[];
    const add=(key:string,at:string|null|undefined,title:string)=>{
      const time=at?Date.parse(at):NaN;
      if(Number.isFinite(time))events.push({key,at:at!,title,time});
    };
    add("created",estimate.createdAt,"Estimate created");
    add("viewed",estimate.firstViewedAt,"Estimate viewed · approval not implied");
    add("send-recorded",estimate.firstEstimateSentAt,"Estimate send recorded · delivery unverified");
    add("last-send",estimate.lastEstimateSentAt,"Most recent estimate send recorded · delivery unverified");
    add("contact",estimate.lastEstimateContactAt,"Estimate contact recorded");
    add("manual",estimate.lastManualContactAt,"Manual contact logged · no message send claimed");
    add("stage1",estimate.stage1At,"Day 1 follow-up stage recorded");
    add("stage3",estimate.stage3At,"Day 3 follow-up stage recorded");
    add("stage7",estimate.stage7At,"Day 7 follow-up stage recorded");
    add("snooze",estimate.snoozeUntil,"Reminder snooze-until date recorded");
    add("review",estimate.lastReviewRequestAt,"Review request status recorded");
    return events.sort((a,b)=>b.time-a.time||a.key.localeCompare(b.key)).slice(0,6);
  }
  const followupGroup=(template:string,kind:"followup"|"repeat"|"review"|"history")=>
    kind==="history"?"history":kind==="review"?"reviews":kind==="repeat"?"repeat":
    ["invoiceReminder","overdue"].includes(template)?"billing":template==="appointmentReminder"?"schedule":"quotes";
  const [rows,setRows]=useState<EstimateRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [reviewEstimate,setReviewEstimate]=useState<EstimateRow|null>(null);
  const [focusError,setFocusError]=useState<{id:string;message:string}|null>(null);
  const [actionStatus,setActionStatus]=useState("");
  const [actionError,setActionError]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const [actionFilter,setActionFilter]=useState<"all"|"viewed"|"quotes"|"billing"|"schedule"|"reviews"|"repeat"|"history">("all");
  const [highPriorityOnly,setHighPriorityOnly]=useState(false);
  const [urgencyFilter,setUrgencyFilter]=useState<"all"|"past-target"|"due"|"upcoming"|"review">("all");
  const [contactHistory,setContactHistory]=useState<{key:string;status:"loading"|"ready"|"error";events:{id:string;channel:string;template:string;createdAt:string}[];hasMore:boolean}|null>(null);
  const [focusedRecord,setFocusedRecord]=useState<EstimateRow|null>(null);
  const contactReadId=useRef(0);
  const readContactHistory=(estimate:EstimateRow,template:string)=>{
    const customerId:string=typeof estimate.customerId==="string"?estimate.customerId:"";
    if(!customerId)return;
    const key=estimate.id+":"+template,request=++contactReadId.current;
    setContactHistory({key,status:"loading",events:[],hasMore:false});
    void (async()=>{
      try{
        const url="/api/followup-contact-history?estimateId="+encodeURIComponent(estimate.id)+"&customerId="+encodeURIComponent(customerId);
        const response=await fetch(url,{cache:"no-store"});
        const data=await response.json() as {estimateId?:string;customerId?:string;events?:{id:string;channel:string;template:string;createdAt:string}[];hasMore?:boolean};
        if(!response.ok||data.estimateId!==estimate.id||data.customerId!==customerId||!Array.isArray(data.events)||
          data.events.length>12||typeof data.hasMore!=="boolean"||data.events.some(item=>!item||typeof item.id!=="string"||!item.id||
            typeof item.channel!=="string"||typeof item.template!=="string"||typeof item.createdAt!=="string"||!Number.isFinite(Date.parse(item.createdAt))))
          throw Error("History could not be verified");
        if(request===contactReadId.current)setContactHistory({key,status:"ready",events:data.events,hasMore:data.hasMore});
      }catch{if(request===contactReadId.current)setContactHistory({key,status:"error",events:[],hasMore:false});}
    })();
  };
  const toggleContactHistory=(estimate:EstimateRow,template:string)=>{
    if(contactHistory?.key===estimate.id+":"+template){contactReadId.current++;setContactHistory(null);return;}
    readContactHistory(estimate,template);
  };
  const actionPending=useRef(false);
  // Preserve one operation ID across uncertain replies, so retry cannot append a second history row.
  const actionRetry=useRef<{customerId:string;estimateId:string;action:"contacted"|"snooze";operationId:string}|null>(null);
  const loadRequest=useRef(0);
  const loadedPages=useRef(1);
  const retryAppend=useRef(false);
  const focusedLookup=useRef<{id:string;token:number}|null>(null);
  const focusedLookupSequence=useRef(0);
  const load=async(append=false,scanPages=1)=>{
    const request=++loadRequest.current;
    retryAppend.current=append;
    setLoading(true);setError("");
    try{
      // Refresh every page already loaded; publish only after the full read succeeds.
      // Each request remains bounded to 50 records. Never write or retry a send here.
      // Explicit older-record scans read no more than four 50-item cursor pages.
      // Publish only when every requested page succeeds; never save partial batches.
      const pageLimit=append?Math.max(1,Math.min(4,Math.floor(scanPages))):loadedPages.current;
      let cursor=append?nextCursor:null;
      const incoming:EstimateRow[]=[];
      let pagesRead=0;
      for(let page=0;page<pageLimit;page++){
        const response=await fetch(`/api/followups?limit=50${cursor?`&cursor=${encodeURIComponent(cursor)}`:""}`,{cache:"no-store"});
        const result=await response.json() as {estimates?:EstimateRow[];nextCursor?:string|null;error?:string};
        if(request!==loadRequest.current)return;
        if(!response.ok)throw new Error(result.error||"Customer follow-ups could not be loaded.");
        if(!Array.isArray(result.estimates)||!(result.nextCursor==null||typeof result.nextCursor==="string"))throw new Error("Follow-up records could not be read. Try again.");
        incoming.push(...result.estimates.map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents)})));
        pagesRead++;
        const following=result.nextCursor??null;
        if(following&&following===cursor)throw new Error("Follow-up paging did not advance. Try again.");
        cursor=following;
        if(!cursor)break;
      }
      if(request!==loadRequest.current)return;
      const unique=incoming.filter((item,index)=>incoming.findIndex(row=>row.id===item.id)===index);
      setRows(current=>append?[...current,...unique.filter(item=>!current.some(row=>row.id===item.id))]:unique);
      loadedPages.current=append?loadedPages.current+pagesRead:pagesRead;
      setNextCursor(cursor);
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Customer follow-ups could not be loaded.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  const recordAction=async(estimate:EstimateRow,action:"contacted"|"snooze")=>{
    if(actionPending.current)return;
    const customerId=estimate.customerId;
    if(!customerId){setActionError(true);setActionStatus("This estimate has no verified customer. Refresh its record before recording contact or snooze.");return;}
    const prior=actionRetry.current;
    if(prior&&(prior.customerId!==customerId||prior.estimateId!==estimate.id||prior.action!==action)){
      setActionError(true);
      setActionStatus("An earlier follow-up save is unconfirmed. Retry the same action safely or refresh and review saved history before choosing a different action.");
      return;
    }
    const attempt=prior??{customerId,estimateId:estimate.id,action,operationId:crypto.randomUUID()};
    actionRetry.current=attempt;
    actionPending.current=true;setActionBusy(true);setActionStatus("");setActionError(false);
    try{
      const response=await fetch("/api/followup-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(attempt)});
      const result=await response.json() as {action?:string;createdAt?:string;snoozeUntil?:string|null;error?:string};
      const createdAt=typeof result?.createdAt==="string"&&Number.isFinite(Date.parse(result.createdAt))?result.createdAt:null;
      const snoozeUntil=typeof result?.snoozeUntil==="string"&&Number.isFinite(Date.parse(result.snoozeUntil))?result.snoozeUntil:null;
      if(!response.ok||result.action!==action||!createdAt||(action==="snooze"&&(!snoozeUntil||Date.parse(snoozeUntil)<=Date.parse(createdAt))))
        throw Error(result?.error||"Action save could not be verified.");
      // The idempotent API has confirmed this exact attempt. No automatic POST retries.
      actionRetry.current=null;
      if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
      setRows(current=>current.map(row=>row.id===estimate.id?{...row,...(action==="contacted"?{lastManualContactAt:createdAt}:{snoozeUntil})}:row));
      setActionStatus(action==="contacted"?"Contact recorded. Estimate reminders paused for 24 hours; no message send is claimed.":"Estimate reminders snoozed for 7 days. Billing reminders remain active.");
      await load();
    }catch{
      setActionError(true);
      setActionStatus("Follow-up action not confirmed. Review saved history before retrying. Retrying the same action reuses its original operation ID to avoid a duplicate.");
    }finally{actionPending.current=false;setActionBusy(false);}
  };
  useEffect(()=>{void load();return()=>{loadRequest.current++;focusedLookup.current=null;};},[]);
  const now=Math.max(useCurrentTime(),Date.now());
  // A notification's exact older record is displayed separately from page scans.
  const actionRows=focusedRecord&&!rows.some(row=>row.id===focusedRecord.id)?[...rows,focusedRecord]:rows;
  const actions=actionRows.flatMap((estimate)=>{
    const {ageDays,confirmedContact}=estimateFollowUpTiming(estimate,now);
    const quoteReason=(days:number)=>estimate.status==="draft"?`Unsent draft is at least ${days} day${days===1?"":"s"} old — prepare the estimate`:confirmedContact?`No confirmed estimate contact for at least ${days} day${days===1?"":"s"}`:`Estimate has been open at least ${days} day${days===1?"":"s"}; send date unconfirmed`;
    const scheduledTime=estimate.scheduledAt?new Date(estimate.scheduledAt).getTime():0;
    const items:{estimate:EstimateRow;template:string;reason:string;priority:number;kind:"followup"|"repeat"|"review"|"history";dueAt?:string|null}[]=[];
    if(Number(estimate.paymentOverageOpen)>0||Number(estimate.pendingRefundCount)>0||Number(estimate.openCheckoutCount)>0)items.push({estimate,template:"invoiceReminder",reason:"Billing exception: open overpayment, refund or checkout needs verification before customer outreach",priority:6,kind:"history"});
    else if(estimate.invoiceId&&billingBalanceCents(estimate)>0)items.push({estimate,template:"invoiceReminder",reason:"Invoice balance needs a reminder",priority:4,kind:"followup"});
    else if(estimate.status==="scheduled"&&scheduledTime>now&&scheduledTime-now<=36*3600000)items.push({estimate,template:"appointmentReminder",reason:"Job is coming up within 36 hours",priority:5,kind:"followup"});
    else if(estimate.status==="draft"&&!estimate.invoiceId&&estimate.paidCents<resolvedBillingTotalCents(estimate)&&ageDays>=1)items.push({estimate,template:"estimate",reason:quoteReason(ageDays>=7?7:ageDays>=3?3:1),priority:1,kind:"followup"});
    else if(estimate.status==="sent"&&!estimate.invoiceId&&estimate.paidCents<resolvedBillingTotalCents(estimate)){
      const stage=estimateReminderStage(estimate,now);
      if(stage.reviewReason)items.push({estimate,template:"history",reason:stage.reviewReason,priority:2,kind:"history"});
      else if(stage.template){
         const viewed=viewedEstimateReminderCue(estimate,now);
         items.push({estimate,template:stage.template,reason:viewed?`Estimate viewed ${viewed.hoursSinceView}h ago; approval not recorded. Consider a friendly check-in — no reason for delay is assumed.`:`Confirmed estimate follow-up: ${stage.template==="followUp7"?7:stage.template==="followUp3"?3:1}-day stage`,priority:viewed?4:stage.template==="followUp7"?3:stage.template==="followUp3"?2:1,kind:"followup"});
       }
    }
    const serviceDate=estimate.scheduledAt||estimate.createdAt;
    const serviceAgeDays=Math.max(0,Math.floor((now-new Date(serviceDate).getTime())/86400000));
    if(reviewFollowupEligible({...estimate,billingTotalCents:resolvedBillingTotalCents(estimate)},serviceAgeDays,now))items.push({estimate,template:"review",reason:"Paid and complete — ask for a Google-first review",priority:4,kind:"review"});
    if(estimate.status==="completed"&&Number(estimate.paymentOverageOpen)===0&&!estimate.lastRebookMessageAt){const cadence=repeatCadenceMonths(estimate.service);const due=addMonths(serviceDate,cadence);const daysUntil=Math.ceil((due.getTime()-now)/86400000);if(daysUntil<=45)items.push({estimate,template:cadence<=6?"winBack6":"winBack11",reason:daysUntil<0?`Suggested repeat-service target was ${Math.abs(daysUntil)} days ago`:`Repeat service is suggested in ${daysUntil} days`,priority:daysUntil<0?4:2,kind:"repeat",dueAt:due.toISOString()});}
    return items;
  }).filter((item)=>item.estimate.id===focusedRecord?.id||[item.estimate.customer,item.estimate.service,item.reason].join(" ").toLowerCase().includes(searchQuery.toLowerCase())).sort((a,b)=>followupUrgency(a,now).rank-followupUrgency(b,now).rank||b.priority-a.priority||(Date.parse(a.estimate.createdAt)||0)-(Date.parse(b.estimate.createdAt)||0)||a.estimate.id.localeCompare(b.estimate.id));
  // Owner-side triage: high priority is an ordering cue, never an overdue or
  // delivery claim. Saved-record exceptions always remain reviewable.
  const isHighPriority=(item:{priority:number;kind:"followup"|"repeat"|"review"|"history";template:string;estimate:EstimateRow;dueAt?:string|null})=>item.priority>=4||item.kind==="history"||followupUrgency(item,now).bucket==="past-target"||followupUrgency(item,now).rank<=1;
  const highPriorityCount=actions.filter(isHighPriority).length;
  const bucketCount=(bucket:"past-target"|"due"|"upcoming"|"review")=>actions.filter(item=>followupUrgency(item,now).bucket===bucket).length;
  const isViewedReady=(item:{estimate:EstimateRow;template:string;kind:"followup"|"repeat"|"review"|"history"})=>
    item.kind==="followup"&&["followUp1","followUp3","followUp7"].includes(item.template)&&
    !item.estimate.invoiceId&&Number(item.estimate.paymentOverageOpen)===0&&Number(item.estimate.pendingRefundCount)===0&&Number(item.estimate.openCheckoutCount)===0&&
    viewedEstimateReminderCue(item.estimate,now)!==null;
  // A separate count for viewed-but-unverified jobs lets owners spot data that
  // needs a status check without falsely recommending another message.
  const viewedReviewCount=actionRows.filter(estimate=>estimate.status==="sent"&&!estimate.invoiceId&&
    Number(estimate.paymentOverageOpen)===0&&Number(estimate.pendingRefundCount)===0&&Number(estimate.openCheckoutCount)===0&&
    typeof estimate.firstViewedAt==="string"&&Number.isFinite(Date.parse(estimate.firstViewedAt))&&
    Date.parse(estimate.firstViewedAt)<=now-86400000&&
    !estimate.acceptedAt&&!estimate.scheduledAt&&
    !estimate.stage1At&&!estimate.stage3At&&!estimate.stage7At&&
    !estimate.lastEstimateContactAt&&!estimate.lastManualContactAt&&
    !estimate.lastConfirmedMessageAt&&
    !actions.some(item=>item.estimate.id===estimate.id&&isViewedReady(item))).length;
  const viewedReadyCount=actions.filter(isViewedReady).length;
  const visibleActions=actions.filter(item=>(actionFilter==="all"||(actionFilter==="viewed"?isViewedReady(item):followupGroup(item.template,item.kind)===actionFilter))&&(!highPriorityOnly||isHighPriority(item))&&(urgencyFilter==="all"||followupUrgency(item,now).bucket===urgencyFilter));
  // Same saved actions as the full list; one preview per verified customer, no extra API or writes.
  const todayQueue=todayCustomerQueue(visibleActions,now);
  const actionableCount=visibleActions.filter(item=>todayActionLane(item,now)!==null).length;
  const cardTarget=(id:string,template:string)=>["followUp1","followUp3","followUp7"].includes(template)?"followup-action-"+id:"followup-card-"+id+"-"+template;
  const jumpToAction=(id:string,template:string)=>{
    const node=document.getElementById(cardTarget(id,template));
    node?.scrollIntoView({block:"center",behavior:"instant"});
    node?.focus({preventScroll:true});
  };
  useEffect(()=>{
    // A superseded notification must never inject an old customer's result.
    if(focusedLookup.current&&focusedLookup.current.id!==focusEstimateId)focusedLookup.current=null;
    if(!focusEstimateId||loading||error)return;
    // Exact deep links override stale on-screen filters, without saving or sending.
    if(actionFilter!=="all"||highPriorityOnly||urgencyFilter!=="all"){setActionFilter("all");setHighPriorityOnly(false);setUrgencyFilter("all");return;}
    const target=actions.find(item=>item.estimate.id===focusEstimateId&&["followUp1","followUp3","followUp7"].includes(item.template));
    if(!target){
      if(!actionRows.some(row=>row.id===focusEstimateId)){
        if(focusedLookup.current?.id===focusEstimateId)return;
        const id=focusEstimateId,token=++focusedLookupSequence.current;
        focusedLookup.current={id,token};setFocusError(null);
        // One owner-authenticated read of this exact estimate; no cursor scan.
        void (async()=>{
          try{
            const response=await fetch("/api/followups?estimateId="+encodeURIComponent(id),{cache:"no-store"});
            const result=await response.json() as {estimateId?:string;estimates?:EstimateRow[];nextCursor?:string|null;pageSize?:number};
            if(focusedLookup.current?.id!==id||focusedLookup.current?.token!==token)return;
            if(!response.ok||result.estimateId!==id||result.pageSize!==1||result.nextCursor!==null||
               !Array.isArray(result.estimates)||result.estimates.length>1)throw Error("Unverified exact estimate response");
            const record=result.estimates[0];
            if(!record){
              setFocusError({id,message:"This saved estimate was not found for the notification. No contact or completion has been recorded."});
              onFocusHandled?.(id);return;
            }
            if(record.id!==id||typeof record.customerId!=="string"||!record.customerId||
              typeof record.createdAt!=="string"||!Number.isFinite(Date.parse(record.createdAt))||
              ![record.totalCents,record.depositCents,record.paidCents].every(value=>Number.isFinite(Number(value))))
              throw Error("Unverified saved estimate identity");
            setFocusedRecord({...record,subtotalCents:Number(record.subtotalCents??record.totalCents),
              discountCents:Number(record.discountCents??0),totalCents:Number(record.totalCents),
              depositCents:Number(record.depositCents),paidCents:Number(record.paidCents)});
          }catch{
            if(focusedLookup.current?.id!==id||focusedLookup.current?.token!==token)return;
            setFocusError({id,message:"Could not verify this older follow-up. No message was sent or action recorded. Open the saved estimate to check its status."});
            onFocusHandled?.(id);
          }
        })();
        return;
      }
      setFocusError({id:focusEstimateId,message:"This saved estimate was found, but no day 1/3/7 follow-up is currently recommended. Open its record to verify the latest status."});
      onFocusHandled?.(focusEstimateId);
      return;
    }
    const element=document.getElementById("followup-action-"+target.estimate.id);
    if(!element)return;
    setFocusError(null);
    element.scrollIntoView({block:"center",behavior:"instant"});
    element.focus({preventScroll:true});
    onFocusHandled?.(focusEstimateId);
  },[focusEstimateId,loading,error,rows,focusedRecord,searchQuery,actionFilter,highPriorityOnly,urgencyFilter]);
  // Read-only reconciliation: keep active Follow-ups aligned with confirmed
  // customer actions elsewhere. Preserve all loaded pages, never POST or
  // retry an ambiguous outbound message. The load request counter rejects
  // late stale responses, and unmount cancels the relevance of pending reads.
  useEffect(()=>{
    if(typeof window==="undefined"||typeof document==="undefined")return;
    const refresh=()=>{
      if(document.visibilityState==="visible"&&!actionPending.current)void load();
    };
    window.addEventListener("fire:attention-saved",refresh);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{
      window.removeEventListener("fire:attention-saved",refresh);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
      window.clearInterval(timer);
    };
  },[]);
  return <div className="workspace-view"><EstimateDetail estimate={reviewEstimate} onClose={()=>setReviewEstimate(null)} onChanged={value=>{setReviewEstimate(current=>current?.id===value.id?value:current);void load();}}/><section className="workspace-head"><div><p className="eyebrow">Start workflow</p><h1>Follow-ups</h1><p>Customers who need a reminder, confirmation, review request, or payment follow-up.</p></div></section>
    {focusError&&<div className="followup-focus-notice" role="status"><p>{focusError.message}</p>{onOpenEstimate&&<Button variant="outline" onClick={()=>{const id=focusError.id;setFocusError(null);onOpenEstimate(id);}}>Open saved estimate</Button>}</div>}
    {actionStatus&&<p role={actionError?"alert":"status"}>{actionStatus}</p>}
    {focusedRecord&&!rows.some(row=>row.id===focusedRecord.id)&&<p role="status" className="followup-coverage-complete">An older notification estimate is shown separately from the {rows.length} scanned records. Opening it does not verify the remaining historical pages.</p>}
    {!loading&&!error&&<div className="followup-summary"><span><Clock3/><div><strong>{actions.length}</strong><small>recommended actions</small></div></span><div className="followup-breakdown"><b>{actions.filter((item)=>item.kind==="followup").length} follow-ups</b><b>{actions.filter((item)=>item.kind==="review").length} reviews</b><b>{actions.filter((item)=>item.kind==="repeat").length} repeat jobs</b></div><p>{bucketCount("past-target")} past suggested target · {bucketCount("due")} due now · {bucketCount("upcoming")} upcoming · {bucketCount("review")} needs review. {viewedReadyCount} viewed quotes ready for a check-in · {viewedReviewCount} viewed quotes need status verification. Counts cover loaded records. Planning cues only—not verified customer deadlines. Preparing or copying isn’t sending.</p></div>}
    {!loading&&!error&&nextCursor&&<section className="followup-backlog-coverage" aria-label="Older customer record coverage">
      <div><strong>Older records still unchecked</strong><p>Today's queue and counts include only {rows.length} loaded estimates. More saved estimates remain outside this view. Check up to 200 older records per scan; no messages are sent or customer records changed.</p></div>
      <Button variant="outline" onClick={()=>void load(true,4)}>Scan next 200 older records</Button>
    </section>}
    {!loading&&!error&&!nextCursor&&rows.length>0&&<p className="followup-coverage-complete" role="status">All currently available estimate pages checked in this view. The queue and counts reflect {rows.length} loaded records as of the last read.</p>}
    {!loading&&!error&&<div className="followup-filter-panel" role="group" aria-label="Filter recommended follow-up actions">
      {([["all","All"],["viewed","Viewed 24h+"],["quotes","Estimates"],["billing","Billing"],["schedule","Appointments"],["reviews","Reviews"],["repeat","Repeat jobs"],["history","Needs review"]] as const).map(([key,label])=><button type="button" key={key} aria-label={"Filter follow-ups: "+label} aria-pressed={actionFilter===key} onClick={()=>setActionFilter(key)}>{label}{key==="viewed"?` (${viewedReadyCount})`:""}</button>)}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter follow-ups by timing">
      {([["all","All timing"],["past-target","Past target"],["due","Due now"],["upcoming","Upcoming"],["review","Needs review"]] as const).map(([bucket,label])=><button type="button" key={bucket} aria-label={"Timing: "+label} aria-pressed={urgencyFilter===bucket} onClick={()=>setUrgencyFilter(bucket)}>{label} ({bucket==="all"?actions.length:bucketCount(bucket)})</button>)}
      </div><div className="followup-priority-toggle"><button type="button" aria-label="Show high priority follow-ups" aria-pressed={highPriorityOnly} onClick={()=>setHighPriorityOnly(current=>!current)}><AlertTriangle aria-hidden="true"/> High priority only ({highPriorityCount})</button><small>Includes higher-ranked due actions and records requiring owner review; not a claim that all are overdue.</small></div>
      <p role="status">Showing {visibleActions.length} of {actions.length} recommended actions from {rows.length} scanned records{focusedRecord&&!rows.some(row=>row.id===focusedRecord.id)?" plus one exact notification estimate":""}. {viewedReadyCount} viewed estimates qualify for a 24h+ owner check-in; an opened link never implies approval or a reason for delay. Counts cover loaded records only. No message is sent by opening this view.</p>
    </div>}
    {!loading&&!error&&todayQueue.length>0&&<section className="followup-priority-jumps" aria-label="Top follow-up priorities in loaded records">
      <div><strong>Today's customer actions</strong><small>{todayQueue.length} customer{todayQueue.length===1?"":"s"} highlighted from {actionableCount} matching action{actionableCount===1?"":"s"} in loaded records · suggested timing, not contractual deadlines · opening never saves or sends</small></div>
      <div className="followup-priority-buttons">{todayQueue.map(({item,lane,additionalCustomerActions})=>{
        const {estimate,template,reason,kind}=item;
        const latest=followupLatestContact(estimate,now);
        return <div className="followup-today-item" key={estimate.id+":"+template}>
          <span className={"followup-today-lane "+(lane==="now"?"now":"verify")}>{lane==="now"?"Act now":"Verify first"}</span>
          <div className="followup-today-actions">
            <button type="button" onClick={()=>jumpToAction(estimate.id,template)} aria-label={"Jump to "+estimate.customer+" "+template+" action"}>
              <span><strong>{estimate.customer}</strong><small>{kind==="history"?"Check saved history before outreach":reason}</small><small>{latest.label}{latest.at?" · "+new Date(latest.at).toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):""}</small>{additionalCustomerActions>0&&<small>{additionalCustomerActions} more saved action{additionalCustomerActions===1?"":"s"} for this customer in full list</small>}</span><ChevronRight aria-hidden="true"/>
            </button>
            {onOpenCustomer&&estimate.customerId&&<button className="followup-today-customer" type="button" onClick={()=>onOpenCustomer(estimate.customerId!)} aria-label={"Open customer profile for "+estimate.customer}>Customer</button>}
          </div>
        </div>;
      })}</div>
      <small>Prepared/copied and manually logged contact are not proof a message was sent. Full action controls and recent history remain in the cards below.</small>
    </section>}
    {loading&&rows.length===0?<div className="customers-state">Checking customer follow-ups…</div>:error&&rows.length===0?<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:visibleActions.length?<section className="followup-list">{visibleActions.map(({estimate,template,reason,kind,dueAt})=>{const urgency=followupUrgency({estimate,template,kind,dueAt,priority:0},now);const customer:CustomerRow={id:estimate.customerId||"",name:estimate.customer,email:estimate.email||"",phone:estimate.phone||"",address:estimate.address||"",createdAt:estimate.createdAt,estimateCount:1,estimateTotal:resolvedBillingTotalCents(estimate),paidTotal:estimate.paidCents};const milestones=followupMilestones(estimate);return <article className={`followup-card ${kind}${focusEstimateId===estimate.id?" followup-card-focused":""}`} id={cardTarget(estimate.id,template)} tabIndex={-1} key={`${estimate.id}-${template}`}><span className="followup-icon">{kind==="review"?<Star/>:kind==="repeat"?<CalendarDays/>:<Clock3/>}</span><div><strong>{estimate.customer}</strong><div className="flex flex-wrap items-center gap-2 py-1"><span className={"rounded-full px-2 py-0.5 text-xs font-semibold "+(urgency.bucket==="past-target"?"bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200":urgency.bucket==="upcoming"?"bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200":"bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200")}>{urgency.label}</span></div><p>{reason}</p><small>{estimate.service} · {money(billingBalanceCents(estimate))}</small>
      {estimate.lastConfirmedMessageAt&&Number.isFinite(Date.parse(estimate.lastConfirmedMessageAt))&&<small className="block">Owner-confirmed message: {new Date(estimate.lastConfirmedMessageAt).toLocaleDateString("en-US",{timeZone:"America/Chicago"})} · delivery unverified</small>}
      {estimate.lastPreparedAt&&Number.isFinite(Date.parse(estimate.lastPreparedAt))&&<small className="block">Last prepared/copied: {new Date(estimate.lastPreparedAt).toLocaleDateString("en-US",{timeZone:"America/Chicago"})} · sending unconfirmed</small>}
      {estimate.lastManualContactAt&&Number.isFinite(Date.parse(estimate.lastManualContactAt))&&<small className="block">Contact logged: {new Date(estimate.lastManualContactAt).toLocaleDateString("en-US",{timeZone:"America/Chicago"})} · no message send claimed</small>}</div>{kind==="history"?<Button variant="outline" onClick={()=>setReviewEstimate(estimate)}>Review estimate</Button>:<MessageComposer customer={customer} estimate={estimate} initialTemplate={template} triggerLabel="Prepare message" onSent={(message,status)=>{setRows(current=>current.map(row=>row.id===estimate.id?{...row,status:status||row.status,...(message.template==="estimate"?{firstEstimateSentAt:row.firstEstimateSentAt||message.createdAt,lastEstimateSentAt:message.createdAt}:{}),...(["estimate","followUp1","followUp3","followUp7"].includes(message.template)?{lastEstimateContactAt:message.createdAt}:{}),...(message.template==="followUp1"?{stage1At:message.createdAt}:{}),...(message.template==="followUp3"?{stage3At:message.createdAt}:{}),...(message.template==="followUp7"?{stage7At:message.createdAt}:{}),...(message.template==="review"?{lastReviewRequestAt:message.createdAt}:{}),...(["winBack6","winBack11"].includes(message.template)?{lastRebookMessageAt:message.createdAt}:{})}:row));void load();}}/>}
{["followUp1","followUp3","followUp7"].includes(template)&&<div className="col-span-full flex flex-wrap gap-2"><Button variant="outline" disabled={actionBusy||loading||Boolean(actionRetry.current&&(actionRetry.current.estimateId!==estimate.id||actionRetry.current.action!=="contacted"))} onClick={()=>void recordAction(estimate,"contacted")}>Contacted</Button><Button variant="outline" disabled={actionBusy||loading||Boolean(actionRetry.current&&(actionRetry.current.estimateId!==estimate.id||actionRetry.current.action!=="snooze"))} onClick={()=>void recordAction(estimate,"snooze")}>Snooze 7 days</Button></div>}
<div className="followup-card-tools"><button type="button" aria-label={"Toggle saved contact history for "+estimate.customer+" "+template} aria-expanded={contactHistory?.key===estimate.id+":"+template} onClick={()=>toggleContactHistory(estimate,template)}><MessageSquareText aria-hidden="true"/> Recent contact</button>{milestones.length>0&&<span className="followup-latest-activity">Latest saved activity: {milestones[0].title} · {new Date(milestones[0].at).toLocaleDateString("en-US",{timeZone:"America/Chicago"})}</span>}{onOpenEstimate&&<button type="button" onClick={()=>onOpenEstimate(estimate.id)} aria-label={"Open saved estimate for "+estimate.customer}><FileText aria-hidden="true"/> Open estimate</button>}{onOpenCustomer&&customer.id&&<button type="button" onClick={()=>onOpenCustomer(customer.id)} aria-label={"Open saved customer history for "+estimate.customer}><Users aria-hidden="true"/> Customer history</button>}{customer.phone&&<a href={"tel:"+customer.phone} aria-label={"Call "+estimate.customer}><Phone aria-hidden="true"/> Call</a>}{customer.phone&&<a href={"sms:"+customer.phone} aria-label={"Open text app for "+estimate.customer}><MessageSquareText aria-hidden="true"/> Text</a>}{customer.email&&<a href={"mailto:"+customer.email} aria-label={"Open email app for "+estimate.customer}><Mail aria-hidden="true"/> Email</a>}{milestones.length>0&&<details className="followup-milestones"><summary>Saved estimate activity ({milestones.length})</summary><ol>{milestones.map(item=><li key={item.key}><strong>{item.title}</strong><time dateTime={item.at}>{new Date(item.at).toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</time></li>)}</ol><small>Owner-side saved status only. Open the estimate for more detail; a recorded timestamp does not prove delivery.</small></details>}</div>
{contactHistory?.key===estimate.id+":"+template&&<section className="followup-contact-panel" role="region" aria-label={"Saved contact history for "+estimate.customer+" "+template}>
  <strong>Saved contact history</strong><small>Exact estimate only · message bodies hidden · opening never sends</small>
  {contactHistory.status==="loading"?<p role="status">Checking saved contact…</p>:contactHistory.status==="error"?
    <div role="alert"><p>Saved contact activity couldn't be verified. Do not assume there was no contact.</p><Button variant="outline" onClick={()=>readContactHistory(estimate,template)}>Retry history</Button></div>:
    contactHistory.events.length?<ol>{contactHistory.events.map(entry=>{const label=contactLabel(entry);return <li key={entry.id}><span><strong>{label.title}</strong><small>{label.detail}</small></span><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("en-US",{timeZone:"America/Chicago",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</time></li>;})}</ol>:
    <p>No saved activity for this estimate. Full customer history may contain other contact.</p>}
  {contactHistory.status==="ready"&&contactHistory.hasMore&&<p>Showing 12 most recent saved events. Open customer history for older records.</p>}
  {contactHistory.status==="ready"&&<Button variant="outline" onClick={()=>readContactHistory(estimate,template)}>Refresh history</Button>}
</section>}
</article>;})}</section>:actions.length?<div className="customers-state"><Clock3/><strong>No matches in this filter</strong><p>Choose All to view the other {actions.length} recommended actions. Nothing has been changed or sent.</p><Button variant="outline" onClick={()=>{setActionFilter("all");setHighPriorityOnly(false);setUrgencyFilter("all");}}>Show all follow-ups</Button></div>:<div className="customers-state"><CheckCircle2/><strong>{nextCursor?"No reminders in loaded records":"You’re caught up"}</strong><p>No follow-ups are recommended in the loaded records. Check older records when available.</p></div>}
    <p role="status">{rows.length} records loaded. {nextCursor?"Older records are available.":"End of available records."}</p>{error&&rows.length>0&&<p role="alert">{error}</p>}{error&&!retryAppend.current&&rows.length>0&&<Button variant="outline" disabled={loading} onClick={()=>void load()}>Retry follow-up refresh</Button>}{nextCursor&&error&&retryAppend.current&&<Button variant="outline" disabled={loading} onClick={()=>void load(true,4)}>Retry older-record scan</Button>}
  </div>;
}

type CheckoutIssue={id:string;estimateId:string;customer:string;type:string;amountCents:number;createdAt:string};
function ReconcileCheckout({issue,onResolved}:{issue:CheckoutIssue;onResolved:()=>void}){
  const [sessionId,setSessionId]=useState(issue.id.startsWith("cs_")?issue.id:"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const verify=async()=>{
    if(busy)return;
    setBusy(true);setMessage("");setError("");
    try{
      const response=await fetch("/api/payments/checkout/reconcile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reservationId:issue.id,sessionId:sessionId.trim()})});
      const result=await response.json() as {resolved?:boolean;message?:string;error?:string};
      if(!response.ok&&!result.message)throw Error(result.error||"Stripe checkout verification failed.");
      if(result.resolved){setMessage(result.message||"Checkout reconciled.");onResolved();}
      else setMessage(result.message||"Checkout remains under review.");
    }catch(err){setError(err instanceof Error?err.message:"Stripe checkout verification failed.");}
    finally{setBusy(false);}
  };
  return <div className="flex flex-col gap-2"><Label>Stripe Checkout Session ID</Label><Input value={sessionId} readOnly={issue.id.startsWith("cs_")} onChange={event=>setSessionId(event.target.value)} placeholder="cs_test_… or cs_live_…" autoComplete="off"/><Button variant="outline" disabled={busy||!sessionId.trim()} onClick={()=>void verify()}>{busy?"Verifying…":"Verify in Stripe & reconcile"}</Button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="save-error">{error}</p>}</div>;
}

type PaymentCloseoutAction={estimateId:string;customerId:string;customerName:string;totalCents:number;lastPaidAt:string;state:"ready"|"prepared";reviewPreparedAt:string|null};
function PaymentsView({searchQuery,onOpenCustomerReview,onOpenEstimate}:{searchQuery:string;onOpenCustomerReview?:(id:string)=>void;onOpenEstimate?:(id:string)=>void}){
  const [estimates,setEstimates]=useState<EstimateRow[]>([]);const [payments,setPayments]=useState<PaymentRow[]>([]);const [checkoutIssues,setCheckoutIssues]=useState<CheckoutIssue[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [reviewCloseouts,setReviewCloseouts]=useState<PaymentCloseoutAction[]>([]);
  const [reviewCloseoutError,setReviewCloseoutError]=useState("");
  const [reviewMoreAvailable,setReviewMoreAvailable]=useState(false);
  const [reviewNextCursor,setReviewNextCursor]=useState<string|null>(null);
  const [reviewOlderError,setReviewOlderError]=useState("");
  const [reviewOlderLoading,setReviewOlderLoading]=useState(false);
  const [reviewSnoozingId,setReviewSnoozingId]=useState<string|null>(null);
  const [reviewSnoozeError,setReviewSnoozeError]=useState("");
  const reviewSnoozeOps=useRef<Record<string,string>>({});
  const reviewSnoozeLock=useRef(false);
  const [showAllReviewCloseouts,setShowAllReviewCloseouts]=useState(false);
  const [reviewCloseoutFilter,setReviewCloseoutFilter]=useState<"all"|"prepared"|"unprepared">("all");
  const [reviewCloseoutOrder,setReviewCloseoutOrder]=useState<"priority"|"newest"|"customer">("priority");
  const [reviewCloseoutSearch,setReviewCloseoutSearch]=useState("");
  const reviewOlderLock=useRef(false),reviewPageRequest=useRef(0);
  const loadRequest=useRef(0);
  const [closeoutStage,setCloseoutStage]=useState<"requests"|"progress">("requests");
  const reviewLoadedPages=useRef(1),reviewLoading=useRef(false),closeoutStageRef=useRef(closeoutStage);closeoutStageRef.current=closeoutStage;
  const load=async()=>{
    const request=++loadRequest.current;
    reviewPageRequest.current++;reviewOlderLock.current=false;
    setReviewOlderLoading(false);setReviewOlderError("");
    reviewLoading.current=true;setLoading(true);setError("");
    try{
      const [estimateResponse,paymentResponse,reviewRead]=await Promise.all([
        fetch("/api/estimate-history?limit=50"),fetch("/api/payments"),
        fetch("/api/payment-closeouts",{cache:"no-store"}).then(async response=>{
          const result=await response.json() as {actions?:PaymentCloseoutAction[];mayHaveMore?:boolean;nextCursor?:string|null;error?:string};
          const valid=(page:typeof result)=>Array.isArray(page.actions)&&page.actions.length<=200&&typeof page.mayHaveMore==="boolean"&&
            (page.nextCursor==null||typeof page.nextCursor==="string")&&page.actions.every(item=>item&&typeof item.estimateId==="string"&&!!item.estimateId&&typeof item.customerId==="string"&&!!item.customerId&&typeof item.customerName==="string"&&Number.isSafeInteger(item.totalCents)&&item.totalCents>0&&Number.isFinite(Date.parse(item.lastPaidAt))&&["ready","prepared"].includes(item.state)&&(item.reviewPreparedAt===null||typeof item.reviewPreparedAt==="string"&&Number.isFinite(Date.parse(item.reviewPreparedAt)))&&(item.state!=="prepared"||item.reviewPreparedAt!==null));
          if(!response.ok||!valid(result))throw Error(result.error||"Review follow-up queue could not be checked.");
          const actions=[...result.actions!],seenCursors=new Set<string>();let cursor=result.nextCursor??null,more=result.mayHaveMore!;
          for(let page=1;page<reviewLoadedPages.current&&cursor;page++){
            if(seenCursors.has(cursor))throw Error("Review follow-up paging did not advance.");seenCursors.add(cursor);
            const extra=await fetch("/api/payment-closeouts?cursor="+encodeURIComponent(cursor),{cache:"no-store"});const data=await extra.json() as typeof result;
            if(request!==loadRequest.current)throw Error("Superseded review refresh");
            if(!extra.ok||!valid(data)||data.nextCursor===cursor)throw Error(data.error||"Loaded review follow-ups could not be refreshed.");
            actions.push(...data.actions!);cursor=data.nextCursor??null;more=data.mayHaveMore!;
          }
          return {actions:[...new Map(actions.map(item=>[item.estimateId,item])).values()],mayHaveMore:more,nextCursor:cursor};
        }).catch((reason:unknown)=>({error:reason instanceof Error?reason.message:"Review follow-up queue is unavailable."}))
      ]);
      const estimateResult=await estimateResponse.json() as {estimates?:EstimateRow[];error?:string};
      const paymentResult=await paymentResponse.json() as {payments?:PaymentRow[];checkoutIssues?:CheckoutIssue[];error?:string};
      if(!estimateResponse.ok)throw new Error(estimateResult.error||"Job balances could not be loaded.");
      if(!paymentResponse.ok)throw new Error(paymentResult.error||"Payment history could not be loaded.");
      if(!Array.isArray(estimateResult.estimates)||!Array.isArray(paymentResult.payments))throw new Error("Payment records could not be read. Try again.");
      const complete=await completeEstimatePages<EstimateRow>(estimateResult,fetch,()=>request===loadRequest.current);if(!complete)return;
      const nextEstimates=complete.map((item)=>({...item,subtotalCents:Number(item.subtotalCents??item.totalCents),discountCents:Number(item.discountCents??0),totalCents:Number(item.totalCents),depositCents:Number(item.depositCents),paidCents:Number(item.paidCents)}));
      if(nextEstimates.some(item=>[item.totalCents,item.depositCents,item.paidCents,...(item.invoiceTotalCents==null?[]:[Number(item.invoiceTotalCents)])].some(value=>!Number.isSafeInteger(value)||value<0)||item.depositCents>item.totalCents))throw Error("Job balances contain accounting values that require owner review.");
      if(Object.values(summarizeCustomerBalances(nextEstimates)).some(value=>!Number.isSafeInteger(value)))throw Error("Complete job totals exceed FIRE's safe accounting range. Review records before recording payment.");
      const nextPayments=paymentResult.payments.map((item)=>({...item,amountCents:Number(item.amountCents)}));
      if(request!==loadRequest.current)return;
      setEstimates(nextEstimates);setPayments(nextPayments);setCheckoutIssues(Array.isArray(paymentResult.checkoutIssues)?paymentResult.checkoutIssues:[]);
      if("error" in reviewRead){
        setReviewCloseouts([]);setReviewMoreAvailable(false);setReviewNextCursor(null);setReviewCloseoutError(reviewRead.error);
      }else{
        setReviewCloseouts(reviewRead.actions);setReviewMoreAvailable(reviewRead.mayHaveMore);setReviewNextCursor(reviewRead.nextCursor);setReviewCloseoutError("");
      }
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Payment records could not be loaded.");}
    finally{if(request===loadRequest.current){reviewLoading.current=false;setLoading(false);}}
  };
  const loadOlderReviewCloseouts=async()=>{
    const cursor=reviewNextCursor;
    if(!cursor||reviewOlderLock.current||loading||error)return;
    reviewOlderLock.current=true;
    const page=++reviewPageRequest.current,mainRequest=loadRequest.current;
    setReviewOlderLoading(true);setReviewOlderError("");
    try{
      const response=await fetch("/api/payment-closeouts?cursor="+encodeURIComponent(cursor),{cache:"no-store"});
      const result=await response.json() as {actions?:PaymentCloseoutAction[];mayHaveMore?:boolean;nextCursor?:string|null;error?:string};
      if(!response.ok||!Array.isArray(result.actions))throw Error(result.error||"Older review follow-ups could not be loaded.");
      if(page!==reviewPageRequest.current||mainRequest!==loadRequest.current)return;
      setReviewCloseouts(current=>{
        const seen=new Set(current.map(item=>item.estimateId));
        return [...current,...result.actions!.filter(item=>{if(seen.has(item.estimateId))return false;seen.add(item.estimateId);return true;})];
      });
      setReviewMoreAvailable(Boolean(result.mayHaveMore));
      setReviewNextCursor(typeof result.nextCursor==="string"?result.nextCursor:null);
      reviewLoadedPages.current++;setShowAllReviewCloseouts(true);
    }catch(loadError){
      if(page===reviewPageRequest.current&&mainRequest===loadRequest.current)setReviewOlderError(loadError instanceof Error?loadError.message:"Older review follow-ups could not be loaded.");
    }finally{
      if(page===reviewPageRequest.current&&mainRequest===loadRequest.current){
        reviewOlderLock.current=false;setReviewOlderLoading(false);
      }
    }
  };
  useEffect(()=>{void load();const cleanup=()=>{loadRequest.current++;reviewPageRequest.current++;reviewOlderLock.current=false;};
    if(typeof window==="undefined"||typeof document==="undefined")return cleanup;
    const refresh=()=>{if(document.visibilityState==="visible"&&!reviewSnoozeLock.current&&!reviewOlderLock.current&&!reviewLoading.current&&closeoutStageRef.current==="requests")void load();};
    window.addEventListener("fire:attention-saved",refresh);window.addEventListener("focus",refresh);window.addEventListener("online",refresh);document.addEventListener("visibilitychange",refresh);const timer=window.setInterval(refresh,60000);
    return()=>{cleanup();window.clearInterval(timer);window.removeEventListener("fire:attention-saved",refresh);window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  const snoozeReviewCloseout=async(item:PaymentCloseoutAction)=>{
    if(reviewSnoozeLock.current||reviewSnoozingId||loading||error)return;
    reviewSnoozeLock.current=true;setReviewSnoozingId(item.estimateId);setReviewSnoozeError("");
    const operationId=reviewSnoozeOps.current[item.estimateId]??crypto.randomUUID();
    reviewSnoozeOps.current[item.estimateId]=operationId;
    try{
      const response=await fetch("/api/payment-closeouts/snooze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        estimateId:item.estimateId,customerId:item.customerId,operationId
      })});
      const result=await response.json() as {saved?:boolean;estimateId?:string;customerId?:string;snoozeUntil?:string;error?:string};
      if(!response.ok||result.saved!==true||result.estimateId!==item.estimateId||result.customerId!==item.customerId||
        !result.snoozeUntil||!Number.isFinite(Date.parse(result.snoozeUntil)))
        throw Error(result.error||"Snooze status is unconfirmed. Keep this job on your review list and retry.");
      delete reviewSnoozeOps.current[item.estimateId];
      setReviewCloseouts(current=>current.filter(row=>row.estimateId!==item.estimateId));
      window.dispatchEvent(new Event("fire:attention-saved"));
    }catch(reason){
      setReviewSnoozeError(reason instanceof Error?reason.message:"Review snooze status is uncertain. Retry with the same request.");
    }finally{reviewSnoozeLock.current=false;setReviewSnoozingId(null);}
  };
  const remainingBalance=(estimate:EstimateRow)=>billingBalanceCents(estimate);
  const matchingReviewCloseouts=reviewCloseouts.filter(item=>item.customerName.toLowerCase().includes(searchQuery.toLowerCase())&&
    [item.customerName,item.estimateId,item.customerId].join(" ").toLowerCase().includes(reviewCloseoutSearch.trim().toLowerCase())&&
    (reviewCloseoutFilter==="all"||(reviewCloseoutFilter==="prepared"?item.state==="prepared":item.state!=="prepared")));
  // Prepared drafts require owner verification first; within each state, handle the oldest payment first.
  const prioritizedReviewCloseouts=matchingReviewCloseouts.slice().sort((a,b)=>reviewCloseoutOrder==="customer"?
    a.customerName.localeCompare(b.customerName)||a.estimateId.localeCompare(b.estimateId):reviewCloseoutOrder==="newest"?
    Date.parse(b.lastPaidAt)-Date.parse(a.lastPaidAt)||a.estimateId.localeCompare(b.estimateId):
    (a.state==="prepared"?0:1)-(b.state==="prepared"?0:1)||Date.parse(a.lastPaidAt)-Date.parse(b.lastPaidAt)||a.estimateId.localeCompare(b.estimateId));
  const shownReviewCloseouts=showAllReviewCloseouts?prioritizedReviewCloseouts:prioritizedReviewCloseouts.slice(0,5);
  const preparedReviewVisible=matchingReviewCloseouts.filter(item=>item.state==="prepared").length;
  const unpreparedReviewVisible=matchingReviewCloseouts.length-preparedReviewVisible;
  const open=estimates.filter((item)=>hasCollectibleJobValue(item)&&remainingBalance(item)>0&&[item.customer,item.service,item.status].join(" ").toLowerCase().includes(searchQuery.toLowerCase()));
  const receivedPayments=payments.filter((item)=>item.status==="paid");
  const balanceSummary=summarizeCustomerBalances(estimates);const collected=receivedPayments.filter(item=>!["Tip","Tip Refund"].includes(item.type)).reduce((sum,item)=>sum+item.amountCents,0);const netTips=receivedPayments.filter((item)=>item.type==="Tip"||item.type==="Tip Refund").reduce((sum,item)=>sum+item.amountCents,0);const outstanding=balanceSummary.collectibleCents;
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Money received</p><h1>Payments</h1><p>Track Wave, Cash App, Venmo, cash, check, card, and bank payments without waiting for a processor connection.</p></div></section>{!loading&&!error&&checkoutIssues.length>0&&<section className="business-panel" role="alert" aria-label="Stripe checkouts needing review"><header><div><h2>Card checkouts needing review ({checkoutIssues.length})</h2><p>These jobs have an open or unresolved Stripe checkout. Verify payment or expiration with Stripe before recording another payment. Existing session IDs are prefilled; interrupted setup requires the ID from Stripe. No unverified lock is cleared.</p></div></header><div className="balance-list">{checkoutIssues.map(issue=><article key={issue.id}><div><strong>{issue.customer}</strong><small>{issue.type} · {new Date(issue.createdAt).toLocaleString()}</small><small>Job: {issue.estimateId}</small></div><strong>{money(Number(issue.amountCents))}</strong><ReconcileCheckout issue={issue} onResolved={()=>void load()}/></article>)}</div><Button variant="outline" onClick={()=>void load()}>Refresh checkout alerts</Button></section>}{!loading&&!error&&<section className="business-panel" aria-label="Paid jobs ready for review follow-up">
  <header><div><h2>Job Closeout Center</h2><p>Paid jobs · review follow-up. Track requests, review status checks, and received reviews. Nothing is sent automatically.</p></div>
    {closeoutStage==="requests"&&<Button variant="outline" onClick={()=>void load()}>Refresh review queue</Button>}
  </header>
  <div className="closeout-stage-controls" role="group" aria-label="Job closeout stage"><Button variant={closeoutStage==="requests"?"default":"outline"} aria-pressed={closeoutStage==="requests"} onClick={()=>setCloseoutStage("requests")}>Needs request</Button><Button variant={closeoutStage==="progress"?"default":"outline"} aria-pressed={closeoutStage==="progress"} onClick={()=>setCloseoutStage("progress")}>Review progress</Button></div>
  {closeoutStage==="progress"?<JobCloseoutHistory searchQuery={searchQuery} onOpenCustomer={id=>onOpenCustomerReview?onOpenCustomerReview(id):window.location.assign('/?openCustomer='+encodeURIComponent(id))} onOpenEstimate={id=>onOpenEstimate?onOpenEstimate(id):window.location.assign('/?openEstimate='+encodeURIComponent(id))}/>:<>
  <label className="flex flex-col gap-1 text-sm font-semibold">Find a paid job or customer
    <input className="min-h-11 rounded-lg border px-3 py-2" type="search" value={reviewCloseoutSearch} onChange={event=>{setReviewCloseoutSearch(event.target.value);setShowAllReviewCloseouts(false);}} placeholder="Customer name or job ID" aria-label="Search paid review follow-ups"/>
  </label>
  {(reviewCloseoutSearch||reviewCloseoutFilter!=="all"||reviewCloseoutOrder!=="priority")&&<Button variant="outline" onClick={()=>{setReviewCloseoutSearch("");setReviewCloseoutFilter("all");setReviewCloseoutOrder("priority");setShowAllReviewCloseouts(false);}}>Clear review search and filters</Button>}
  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter paid review requests">
    {([["all","All"],["prepared","Prepared · verify send"],["unprepared","Not prepared"]] as const).map(([key,label])=><Button key={key} variant={reviewCloseoutFilter===key?"default":"outline"} aria-pressed={reviewCloseoutFilter===key} onClick={()=>{setReviewCloseoutFilter(key);setShowAllReviewCloseouts(false);}}>{label} ({key==="all"?reviewCloseouts.length:reviewCloseouts.filter(item=>key==="prepared"?item.state==="prepared":item.state!=="prepared").length})</Button>)}
  </div>
  <div className="flex flex-wrap gap-2" role="group" aria-label="Sort paid review requests">
    {([["priority","Needs action first"],["newest","Newest paid"],["customer","Customer A–Z"]] as const).map(([key,label])=><Button key={key} variant={reviewCloseoutOrder===key?"default":"outline"} aria-pressed={reviewCloseoutOrder===key} onClick={()=>{setReviewCloseoutOrder(key);setShowAllReviewCloseouts(false);}}>{label}</Button>)}
  </div>
  {!reviewCloseoutError&&<p className="pay-note" role="status">{matchingReviewCloseouts.length} matching loaded job{matchingReviewCloseouts.length===1?"":"s"} · {preparedReviewVisible} prepared, awaiting send verification · {unpreparedReviewVisible} not prepared{reviewMoreAvailable?" · Older jobs may remain unloaded":""}. Prepared drafts are not proof of delivery.</p>}
  {reviewCloseoutError?<p role="alert" className="save-error">{reviewCloseoutError} Other payment records remain available.</p>:
  matchingReviewCloseouts.length?<div className="balance-list">{shownReviewCloseouts.map(item=><article key={item.estimateId}>
    <div><strong>{item.customerName}</strong><small>{money(item.totalCents)} paid in full · {new Date(item.lastPaidAt).toLocaleDateString()}</small>
      <small>{item.state==="prepared"?"Review message prepared · sending not confirmed":"Review request not yet confirmed"}</small></div>
    <div className="flex flex-wrap items-center gap-2">
      <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-current px-3 py-2 text-sm font-semibold" href={`/?openEstimate=${encodeURIComponent(item.estimateId)}`} onClick={event=>{if(onOpenEstimate){event.preventDefault();onOpenEstimate(item.estimateId);}}}><ExternalLink className="h-4 w-4"/> Open job · request review</a>
      <Button variant="outline" disabled={Boolean(reviewSnoozingId)} onClick={()=>void snoozeReviewCloseout(item)}>{reviewSnoozingId===item.estimateId?"Saving snooze…":"Snooze 7 days"}</Button>
    </div>
  </article>)}</div>:<p className="record-empty">{reviewCloseouts.length?"No paid review requests match the current search and status filter. Clear the search or choose All to see other loaded requests.":"No verified paid jobs awaiting review requests in the loaded results."}</p>}
  {matchingReviewCloseouts.length>5&&<Button variant="outline" onClick={()=>setShowAllReviewCloseouts(value=>!value)}>{showAllReviewCloseouts?"Show fewer":`Show all ${matchingReviewCloseouts.length} ready jobs`}</Button>}
  {reviewMoreAvailable&&reviewNextCursor&&<Button variant="outline" disabled={reviewOlderLoading} onClick={()=>void loadOlderReviewCloseouts()}>{reviewOlderLoading?"Loading older jobs…":"Load older paid jobs"}</Button>}
  {reviewOlderError&&<p role="alert" className="save-error">{reviewOlderError} Previously loaded jobs are still available.</p>}
  {reviewSnoozeError&&<p role="alert" className="save-error">{reviewSnoozeError} No customer message was sent.</p>}
  {reviewMoreAvailable&&!reviewNextCursor&&<p className="pay-note">Older review records require an additional verification. Refresh this list or inspect the original job.</p>}
  </>}
</section>}{!loading&&!error&&<section className="business-metrics"><article><small>Principal paid (net refunds)</small><strong>{money(collected)}</strong></article><article><small>Collectible job balance</small><strong>{money(outstanding)}</strong></article><article><small>Jobs with collectible balance</small><strong>{open.length}</strong></article><article><small>Deposit still required</small><strong>{money(balanceSummary.depositRemainingCents)}</strong></article><article><small>Potential estimate value</small><strong>{money(balanceSummary.potentialCents)}</strong></article><article><small>Net tips</small><strong>{money(netTips)}</strong></article></section>}{!loading&&!error&&<ProcessingReport payments={receivedPayments}/>}{loading?<div className="customers-state">Loading balances…</div>:error?<div className="customers-state" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:<div className="payment-layout"><section className="business-panel"><header><div><h2>Collectible job balances</h2><p>Approved or scheduled jobs and issued invoices, including amounts due on completion. Unapproved quotes remain potential work. Record payment uses the amount currently due.</p></div></header><div className="balance-list">{open.length?open.map((estimate)=><article key={estimate.id}><div><strong>{estimate.customer}</strong><small>{estimate.service} · {statusLabel(estimate.status)}</small></div><span><strong>{money(remainingBalance(estimate))}</strong><small>full remaining balance</small></span><RecordPayment key={estimate.id} estimate={estimate} onRecorded={()=>void load()}/></article>):<div className="record-empty"><CheckCircle2/><strong>All caught up</strong><p>No unpaid job balances.</p></div>}</div></section><section className="business-panel"><header><div><h2>Payment history</h2><p>Every recorded transaction, newest first.</p></div></header><div className="payment-history">{payments.length?payments.map((payment)=><article key={payment.id}><span className="payment-method"><CircleDollarSign/></span><div><strong>{payment.customer||"Customer"}</strong><small>{payment.type} · {statusLabel(payment.status)} · {payment.service||"Service"} · {new Date(payment.createdAt).toLocaleDateString()}</small>{payment.reference&&<span className="inline-flex max-w-full flex-wrap items-center gap-1"><em title={payment.reference}>Ref …{payment.reference.slice(-12)}</em><button type="button" aria-label="Copy full payment reference" className="rounded border px-2 py-0.5 text-xs" onClick={()=>void navigator.clipboard.writeText(payment.reference||"").catch(()=>{})}>Copy</button></span>}{payment.status==="paid"&&<ProcessingDetails payment={payment}/>}</div><strong className="payment-history-amount">{money(payment.amountCents)}</strong>{payment.status==="paid"&&<RefundPayment payment={payment} onRefunded={()=>void load()}/>}</article>):<div className="record-empty"><CreditCard/><strong>No payments recorded</strong><p>Use Record payment on an estimate or open balance.</p></div>}</div></section></div>}</div>;
}

function BusinessView({initialPickupDraft,onPickupDraftConsumed,initialReviewDraft,onReviewDraftConsumed,focusTaskId,focusTaskCustomerId,focusTaskActivity,onFocusTaskHandled,onOpenCustomer,onOpenCustomerActivity}:{initialPickupDraft?:YardSignPickupDraft|null;onPickupDraftConsumed?:()=>void;initialReviewDraft?:ReviewCheckDraft|null;onReviewDraftConsumed?:()=>void;focusTaskId?:string|null;focusTaskCustomerId?:string|null;focusTaskActivity?:"sign"|"review"|null;onFocusTaskHandled?:()=>void;onOpenCustomer?:(customerId:string)=>void;onOpenCustomerActivity?:(customerId:string,kind:"sign"|"review")=>void}={}){
  const [tasks,setTasks]=useState<TaskRow[]>([]);const [expenses,setExpenses]=useState<ExpenseRow[]>([]);const [customers,setCustomers]=useState<CustomerRow[]>([]);const [estimates,setEstimates]=useState<CustomerEstimate[]>([]);
  // Only prefill. The existing guarded Add task flow remains the sole writer.
  const [pickupTarget]=useState(initialPickupDraft??null);
  const [reviewTarget]=useState(initialReviewDraft??null);
  const pickupMarker=pickupTarget?`FIRE yard sign placement: ${pickupTarget.placedAt}`:"";
  const reviewMarker=reviewTarget?`FIRE review request: ${reviewTarget.requestedAt}`:"";
  const [title,setTitle]=useState(pickupTarget?"Pick up yard sign":reviewTarget?"Check customer review status":"");
  const [dueAt,setDueAt]=useState(pickupTarget?pickupTarget.pickupDate+"T12:00":reviewTarget?reviewTarget.dueDate+"T12:00":"");
  const [taskNotes,setTaskNotes]=useState(pickupTarget?`Location: ${pickupTarget.location}. Pickup target: ${pickupTarget.pickupDate}. ${pickupMarker}`:reviewTarget?`Review request recorded: ${reviewTarget.requestedAt}. Check for a posted review before deciding whether a personal follow-up is appropriate. Do not send duplicate requests. ${reviewMarker}`:"");
  const [taskCustomer,setTaskCustomer]=useState(pickupTarget?.customerId??reviewTarget?.customerId??"none");
  useEffect(()=>{if(pickupTarget)onPickupDraftConsumed?.();if(reviewTarget)onReviewDraftConsumed?.();},[]);const [description,setDescription]=useState("");const [amount,setAmount]=useState("");const [expenseDate,setExpenseDate]=useState("");const [category,setCategory]=useState("Supplies");const [expenseEstimate,setExpenseEstimate]=useState("none");
  const [taskSaving,setTaskSaving]=useState(false);const [expenseSaving,setExpenseSaving]=useState(false);const [taskToggling,setTaskToggling]=useState<string|null>(null);const [businessMessage,setBusinessMessage]=useState("");
  const taskFocusHandled=useRef<string|null>(null);
  const [highlightTaskId,setHighlightTaskId]=useState(focusTaskId??null);
  const [contextTaskId,setContextTaskId]=useState<string|null>(focusTaskId??null);
  const [taskFocusNotice,setTaskFocusNotice]=useState<{id:string;status:"missing"|"changed"|"restored";customerId:string|null;activity:"sign"|"review"|null}|null>(null);
  const [taskSearch,setTaskSearch]=useState("");const [taskFilter,setTaskFilter]=useState<"all"|"open"|"completed"|"overdue"|"today">("all");
  const [expenseSearch,setExpenseSearch]=useState("");const [expenseLimit,setExpenseLimit]=useState(12);
  const taskCreateLock=useRef(false),expenseCreateLock=useRef(false);
  const taskStatusLock=useRef(false),taskStatusRefreshLock=useRef(false);
  const [taskStatusUncertain,setTaskStatusUncertain]=useState(false);
  const [taskStatusMessage,setTaskStatusMessage]=useState("");
  const taskCreateAttempt=useRef<{requestId:string;fingerprint:string}|null>(null);
  const expenseCreateAttempt=useRef<{requestId:string;fingerprint:string;incurredAt:string}|null>(null);
  const [taskRecoveryId,setTaskRecoveryId]=useState<string|null>(null),[expenseRecoveryId,setExpenseRecoveryId]=useState<string|null>(null);
  const [receiptError,setReceiptError]=useState(""),[discardReceipt,setDiscardReceipt]=useState<BusinessCreateKind|null>(null);
  const [pendingBackup,setPendingBackup]=useState<Record<string,unknown>|null>(null);const [restoreMessage,setRestoreMessage]=useState("");const [restoreBusy,setRestoreBusy]=useState(false);const restoreInput=useRef<HTMLInputElement>(null);
  const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState("");const loadRequest=useRef(0);
  // A Dashboard shortcut may select a saved task, but never toggles completion.
  // Wait for authoritative task records before scrolling, and do this once.
  useEffect(()=>{
    if(!focusTaskId){taskFocusHandled.current=null;return;}
    if(taskFocusHandled.current===focusTaskId||loading||loadError)return;
    const task=tasks.find(row=>row.id===focusTaskId);
    if(!task){
      // A successful owner read proves absence from the list, not deletion.
      setTaskFocusNotice({id:focusTaskId,status:"missing",customerId:typeof focusTaskCustomerId==="string"&&focusTaskCustomerId?focusTaskCustomerId:null,activity:focusTaskActivity??null});
      setContextTaskId(null);setHighlightTaskId(null);
      taskFocusHandled.current=focusTaskId;onFocusTaskHandled?.();return;
    }
    setTaskFocusNotice(task.status!=="open"||!["today","overdue"].includes(taskDueBucket(task,new Date()))?
      {id:task.id,status:"changed",customerId:task.customerId??null,activity:taskLinkedFlag(task)?.kind??null}:null);
    setTaskSearch("");setTaskFilter("all");setContextTaskId(task.id);setHighlightTaskId(task.id);
    const target=document.getElementById("business-task-"+task.id);
    if(target){
      taskFocusHandled.current=focusTaskId;
      target.scrollIntoView({block:"center",behavior:"auto"});
      target.focus({preventScroll:true});
      onFocusTaskHandled?.();
    }
  },[focusTaskId,focusTaskCustomerId,focusTaskActivity,loading,loadError,tasks,onFocusTaskHandled]);

  const reconcileReceipts=(savedTasks:TaskRow[],savedExpenses:ExpenseRow[])=>{
    const storage=businessReceiptStorage();
    const taskReceipt=readBusinessReceipt(storage,"task"),expenseReceipt=readBusinessReceipt(storage,"expense");
    if(!taskReceipt.usable||!expenseReceipt.usable){
      setReceiptError("Browser recovery storage is unavailable or damaged. New task and expense submissions are blocked to prevent duplicates after a restart.");
      return;
    }
    setReceiptError("");
    for(const [kind,receipt,exists] of [
      ["task",taskReceipt,savedTasks.some(row=>row.id===taskReceipt.requestId)],
      ["expense",expenseReceipt,savedExpenses.some(row=>row.id===expenseReceipt.requestId)]
    ] as const){
      if(receipt.requestId&&exists&&releaseBusinessReceipt(storage,kind,receipt.requestId)){
        if(kind==="task"){setTaskRecoveryId(null);taskCreateAttempt.current=null;}
        else{setExpenseRecoveryId(null);expenseCreateAttempt.current=null;}
        setBusinessMessage(kind==="task"?"Previous task save verified in saved records.":"Previous expense save verified in saved records.");
      }else if(kind==="task")setTaskRecoveryId(receipt.requestId);
      else setExpenseRecoveryId(receipt.requestId);
    }
  };
  const load=async()=>{
    const request=++loadRequest.current;setLoading(true);setLoadError("");
    try{
      const responses=await Promise.all([fetch("/api/tasks",{cache:"no-store"}),fetch("/api/expenses",{cache:"no-store"}),fetch("/api/customers",{cache:"no-store"})]);
      const [taskResult,expenseResult,customerResult]=await Promise.all(responses.map(response=>response.json())) as [{tasks?:TaskRow[];error?:string},{expenses?:ExpenseRow[];error?:string},{customers?:CustomerRow[];estimates?:CustomerEstimate[];error?:string}];
      for(const [index,label] of ["Tasks","Expenses","Customers"].entries())if(!responses[index].ok)throw new Error([taskResult,expenseResult,customerResult][index]?.error||`${label} could not be loaded.`);
      if(!Array.isArray(taskResult.tasks)||!Array.isArray(expenseResult.expenses)||!Array.isArray(customerResult.customers)||!Array.isArray(customerResult.estimates))throw new Error("Business records could not be read. Try again.");
      if([taskResult.tasks,expenseResult.expenses,customerResult.customers,customerResult.estimates].some(rows=>rows.some(row=>!row||typeof row!=="object"||Array.isArray(row))))throw new Error("Business records could not be read. Try again.");
      if(taskResult.tasks.some(row=>typeof row.id!=="string"||typeof row.title!=="string"||!["open","completed"].includes(row.status))||customerResult.customers.some(row=>typeof row.id!=="string"||typeof row.name!=="string")||customerResult.estimates.some(row=>typeof row.id!=="string"))throw new Error("Business records could not be read. Try again.");
      if(expenseResult.expenses.some(row=>(typeof row.amountCents!=="number"&&typeof row.amountCents!=="string")||(typeof row.amountCents==="string"&&!String(row.amountCents).trim())||typeof row.incurredAt!=="string"))throw new Error("Expense records need review before totals can be shown.");
      const nextExpenses=expenseResult.expenses.map(row=>({...row,amountCents:Number(row.amountCents)}));
      if(nextExpenses.some(row=>!Number.isSafeInteger(row.amountCents)||row.amountCents<0||!Number.isFinite(Date.parse(row.incurredAt))))throw new Error("Expense records need review before totals can be shown.");
      if(request!==loadRequest.current)return;
      setTasks(taskResult.tasks);setExpenses(nextExpenses);setCustomers(customerResult.customers);setEstimates(customerResult.estimates);
      // Reconcile every visible notification-task explanation after each complete,
      // successful owner read. A previously recovered task may disappear again,
      // become completed, or become due; never keep a stale "found" message.
      if(taskFocusNotice){
        const savedTask=taskResult.tasks.find(row=>row.id===taskFocusNotice.id);
        const dueNow=Boolean(savedTask?.status==="open"&&["today","overdue"].includes(taskDueBucket(savedTask,new Date())));
        const currentStatus=!savedTask?"missing":dueNow?"restored":"changed";
        setTaskFocusNotice({id:taskFocusNotice.id,status:currentStatus,
          customerId:savedTask?(savedTask.customerId??null):taskFocusNotice.customerId,
          activity:savedTask?(taskLinkedFlag(savedTask)?.kind??null):taskFocusNotice.activity});
        if(savedTask){
          setTaskSearch("");setTaskFilter("all");setContextTaskId(savedTask.id);setHighlightTaskId(savedTask.id);
        }else{
          setContextTaskId(null);setHighlightTaskId(null);
        }
      }
      reconcileReceipts(taskResult.tasks,nextExpenses);
    }catch(error){if(request===loadRequest.current)setLoadError(error instanceof Error?error.message:"Business records could not be loaded.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{
    const storage=businessReceiptStorage();
    const taskReceipt=readBusinessReceipt(storage,"task"),expenseReceipt=readBusinessReceipt(storage,"expense");
    setTaskRecoveryId(taskReceipt.requestId);setExpenseRecoveryId(expenseReceipt.requestId);
    if(!taskReceipt.usable||!expenseReceipt.usable)setReceiptError("Browser recovery storage is unavailable or damaged. New task and expense submissions are blocked.");
    void load();
    return()=>{loadRequest.current++;};
  },[]);
  const matchedPickupTask=pickupTarget?tasks.find(task=>task.customerId===pickupTarget.customerId&&task.notes?.includes(pickupMarker)):undefined;
  const duplicatePickupDraft=Boolean(matchedPickupTask&&taskCustomer===pickupTarget?.customerId&&title.trim()==="Pick up yard sign"&&taskNotes.includes(pickupMarker));
  const matchedReviewTask=reviewTarget?tasks.find(task=>task.customerId===reviewTarget.customerId&&task.notes?.includes(reviewMarker)):undefined;
  const duplicateReviewDraft=Boolean(matchedReviewTask&&taskCustomer===reviewTarget?.customerId&&taskNotes.includes(reviewMarker));
  const addTask=async()=>{
    if(duplicatePickupDraft||duplicateReviewDraft){setBusinessMessage("A reminder for this same event is already saved. Review the existing task below.");return;}
    if(taskCreateLock.current)return;
    const submittedTitle=title.trim(),customerId=taskCustomer==="none"?null:taskCustomer;
    if(!submittedTitle){setBusinessMessage("Enter a task or reminder first.");return;}
    const parsedDueAt=dueAt?new Date(dueAt):null;
    if(parsedDueAt&&!Number.isFinite(parsedDueAt.getTime())){setBusinessMessage("Choose a valid task due date.");return;}
    const fields={title:submittedTitle,dueAt:parsedDueAt?.toISOString()??null,notes:taskNotes,customerId};
    const fingerprint=JSON.stringify(fields);
    const previous=taskCreateAttempt.current;
    if(previous&&previous.fingerprint!==fingerprint){setBusinessMessage("A previous task save may have succeeded. Restore its original details and retry, or refresh the saved tasks before starting a different task.");return;}
    const storage=businessReceiptStorage(),receipt=readBusinessReceipt(storage,"task");
    if(!receipt.usable){setBusinessMessage("Task not submitted. Browser recovery storage is unavailable; no request was sent.");return;}
    if(receipt.requestId&&(!previous||previous.requestId!==receipt.requestId)){setTaskRecoveryId(receipt.requestId);setBusinessMessage("An earlier task save is unresolved. Check saved records and review its pending ID before creating another task.");return;}
    const attempt=previous??{requestId:crypto.randomUUID(),fingerprint};
    if(!reserveBusinessReceipt(storage,"task",attempt.requestId)){setBusinessMessage("Task not submitted. The recovery request ID could not be saved.");return;}
    taskCreateAttempt.current=attempt;setTaskRecoveryId(attempt.requestId);
    taskCreateLock.current=true;setTaskSaving(true);setBusinessMessage("");
    try{
      const response=await fetch("/api/tasks",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...fields,requestId:attempt.requestId})});
      const result=await response.json() as {task?:TaskRow;requestId?:string;confirmed?:boolean;error?:string};
      if(!response.ok)throw new Error(result?.error||"Task save was rejected.");
      const task=result?.task;
      if(result?.confirmed!==true||result.requestId!==attempt.requestId||!task||task.id!==attempt.requestId||task.title!==submittedTitle||task.customerId!==customerId||task.status!=="open")throw new Error("The saved task response could not be verified.");
      taskCreateAttempt.current=null;
      if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
      if(releaseBusinessReceipt(storage,"task",attempt.requestId))setTaskRecoveryId(null);
      setTitle("");setDueAt("");setTaskNotes("");setTaskCustomer("none");setBusinessMessage("Task added.");
      await load();
    }catch(error){
      setBusinessMessage(`Task save not confirmed: ${error instanceof Error?error.message:"Connection unavailable."} Your draft is kept. Retry unchanged details to reuse the same request ID, or check saved tasks first.`);
    }finally{taskCreateLock.current=false;setTaskSaving(false);}
  };
  const toggleTask=async(task:TaskRow)=>{
    if(taskStatusLock.current||taskStatusRefreshLock.current||taskStatusUncertain)return;
    if(task.status!=="open"&&task.status!=="completed"){setTaskStatusMessage("Task status is invalid. Refresh saved tasks before making changes.");setTaskStatusUncertain(true);return;}
    taskStatusLock.current=true;setTaskToggling(task.id);setTaskStatusMessage("");
    const nextStatus=task.status==="open"?"completed":"open";
    try{
      const response=await fetch("/api/tasks",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:task.id,status:nextStatus,expectedStatus:task.status})});
      const result=await response.json() as {ok?:boolean;status?:string;completedAt?:string|null;error?:string};
      if(!response.ok||result?.ok!==true||result.status!==nextStatus||(nextStatus==="completed"&&(typeof result.completedAt!=="string"||!Number.isFinite(Date.parse(result.completedAt))))||(nextStatus==="open"&&result.completedAt!==null))throw new Error(result?.error||"The task update was not confirmed.");
      setTasks(current=>current.map(item=>item.id===task.id?{...item,status:nextStatus,completedAt:result.completedAt}:item));
      if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
      setTaskStatusMessage("Task status confirmed.");
    }catch{
      setTaskStatusUncertain(true);
      setTaskStatusMessage("Task status not confirmed. It may have saved. Refresh saved tasks before updating any task again.");
    }finally{taskStatusLock.current=false;setTaskToggling(null);}
  };
  const refreshTaskStatuses=async()=>{
    if(taskStatusLock.current||taskStatusRefreshLock.current)return;
    taskStatusRefreshLock.current=true;setTaskStatusMessage("");
    // A full Business GET started earlier must not replace this newer server-confirmed list.
    loadRequest.current++;
    try{
      const response=await fetch("/api/tasks",{cache:"no-store"});
      const result=await response.json() as {tasks?:TaskRow[];error?:string};
      if(!response.ok||!Array.isArray(result.tasks)||result.tasks.some(row=>!row||typeof row.id!=="string"||!row.id||typeof row.title!=="string"||(row.status!=="open"&&row.status!=="completed")||(row.status==="completed"&&(!row.completedAt||!Number.isFinite(Date.parse(row.completedAt))))))throw new Error("Task statuses could not be verified.");
      setTasks(result.tasks);
      if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
      setTaskStatusUncertain(false);
      setTaskStatusMessage("Task statuses refreshed from saved records.");
    }catch{
      setTaskStatusUncertain(true);
      setTaskStatusMessage("Task status refresh failed. No additional task changes are allowed until the saved list can be verified.");
    }finally{taskStatusRefreshLock.current=false;}
  };
  const addExpense=async()=>{
    if(expenseCreateLock.current)return;
    const submittedDescription=description.trim(),estimateId=expenseEstimate==="none"?null:expenseEstimate;
    // Money is exact to cents. Never silently round a third decimal place or accept exponent notation.
    const amountParts=/^(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(amount.trim());
    const dollars=amountParts?Number(amountParts[1]??"0"):NaN;
    const cents=amountParts?Number((amountParts[2]??amountParts[3]??"").padEnd(2,"0")):NaN;
    const amountCents=Number.isSafeInteger(dollars)&&dollars>=0&&dollars<=Math.floor(Number.MAX_SAFE_INTEGER/100)
      ?dollars*100+cents:NaN;
    if(!submittedDescription){setBusinessMessage("Enter what the expense was for.");return;}
    if(!Number.isSafeInteger(amountCents)||amountCents<=0){setBusinessMessage("Enter a positive dollar amount with no more than two decimal places.");return;}
    const selectedDate=expenseDate.trim();
    const chosenIncurredAt=selectedDate?expenseDateInstant(selectedDate):null;
    if(selectedDate&&!chosenIncurredAt){setBusinessMessage("Choose a valid expense purchase date.");return;}
    const fields={category,description:submittedDescription,amountCents,estimateId};
    const fingerprint=JSON.stringify({...fields,chosenIncurredAt});
    const previous=expenseCreateAttempt.current;
    if(previous&&previous.fingerprint!==fingerprint){setBusinessMessage("A previous expense save may have succeeded. Restore its original details and retry, or refresh saved expenses before entering a different expense.");return;}
    const storage=businessReceiptStorage(),receipt=readBusinessReceipt(storage,"expense");
    if(!receipt.usable){setBusinessMessage("Expense not submitted. Browser recovery storage is unavailable; no request was sent.");return;}
    if(receipt.requestId&&(!previous||previous.requestId!==receipt.requestId)){setExpenseRecoveryId(receipt.requestId);setBusinessMessage("An earlier expense save is unresolved. Check saved records and review its pending ID before creating another expense.");return;}
    const attempt=previous??{requestId:crypto.randomUUID(),fingerprint,incurredAt:chosenIncurredAt??new Date().toISOString()};
    if(!reserveBusinessReceipt(storage,"expense",attempt.requestId)){setBusinessMessage("Expense not submitted. The recovery request ID could not be saved.");return;}
    expenseCreateAttempt.current=attempt;setExpenseRecoveryId(attempt.requestId);
    expenseCreateLock.current=true;setExpenseSaving(true);setBusinessMessage("");
    try{
      const response=await fetch("/api/expenses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...fields,incurredAt:attempt.incurredAt,requestId:attempt.requestId})});
      const result=await response.json() as {expense?:ExpenseRow;requestId?:string;confirmed?:boolean;error?:string};
      if(!response.ok)throw new Error(result?.error||"Expense save was rejected.");
      const saved=result?.expense;
      if(result?.confirmed!==true||result.requestId!==attempt.requestId||!saved||saved.id!==attempt.requestId||saved.description!==submittedDescription||saved.category!==category||saved.estimateId!==estimateId||saved.amountCents!==amountCents||saved.incurredAt!==attempt.incurredAt)throw new Error("The saved expense response could not be verified.");
      expenseCreateAttempt.current=null;
      if(releaseBusinessReceipt(storage,"expense",attempt.requestId))setExpenseRecoveryId(null);
      setDescription("");setAmount("");setExpenseDate("");setExpenseEstimate("none");setBusinessMessage("Expense recorded.");
      await load();
    }catch(error){
      setBusinessMessage(`Expense save not confirmed: ${error instanceof Error?error.message:"Connection unavailable."} Your draft is kept. Retry unchanged details to reuse the same request ID, or check saved expenses first.`);
    }finally{expenseCreateLock.current=false;setExpenseSaving(false);}
  };
  const chooseBackup=async(file:File)=>{setRestoreMessage("");try{if(file.size>5_000_000)throw new Error("That backup is larger than 5 MB.");const parsed=JSON.parse(await file.text()) as Record<string,unknown>;const normal=parsed?.format==="fire-app-records-backup"&&parsed?.version===1;const snapshot=parsed?.backup_format==="FIRE App live database snapshot"&&parsed?.format_version===1&&typeof parsed?.verification==="object"&&parsed?.verification!==null&&(parsed.verification as Record<string,unknown>).all_tables_complete===true&&(parsed.verification as Record<string,unknown>).truncated===false;if(!normal&&!snapshot)throw new Error("This is not a valid or complete FIRE App records backup.");setPendingBackup(parsed);}catch(error){setRestoreMessage(error instanceof Error?error.message:"The backup could not be opened.");}finally{if(restoreInput.current)restoreInput.current.value="";}};
  const restoreBackup=async()=>{if(!pendingBackup)return;setRestoreBusy(true);setRestoreMessage("");try{const response=await fetch("/api/backup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pendingBackup)});const result=await response.json() as {restored?:number;duplicatesPreserved?:number;photoMetadataSkipped?:number;error?:string};if(!response.ok)throw new Error(result.error||"The backup could not be restored.");setPendingBackup(null);setRestoreMessage(`${result.restored??0} missing records restored; ${result.duplicatesPreserved??0} existing records preserved.${result.photoMetadataSkipped?` ${result.photoMetadataSkipped} photo references skipped because photo files require a separate archive.`:""}`);void load();}catch(error){setRestoreMessage(error instanceof Error?error.message:"The backup could not be restored.");}finally{setRestoreBusy(false);}};
  const taskQuery=taskSearch.trim().toLocaleLowerCase(),expenseQuery=expenseSearch.trim().toLocaleLowerCase();
  const taskNow=new Date(),dueCounts={overdue:0,today:0};
  for(const task of tasks){const bucket=taskDueBucket(task,taskNow);if(bucket==="overdue")dueCounts.overdue++;if(bucket==="today")dueCounts.today++;}
  const visibleTasks=tasks.filter(task=>(taskFilter==="all"||(["overdue","today"].includes(taskFilter)?taskDueBucket(task,taskNow)===taskFilter:task.status===taskFilter))&&[task.title,task.notes,task.customer].filter(Boolean).join(" ").toLocaleLowerCase().includes(taskQuery));
  const matchingExpenses=expenses.filter(row=>[row.description,row.category,row.customer,row.service].filter(Boolean).join(" ").toLocaleLowerCase().includes(expenseQuery));
  const jumpTo=(id:string)=>{const section=document.getElementById(id);if(section){section.scrollIntoView({block:"start",behavior:"auto"});section.focus({preventScroll:true});}};
  const currentDate=new Date();
  const monthExpenses=expenses.filter((row)=>{const date=new Date(row.incurredAt);return date.getMonth()===currentDate.getMonth()&&date.getFullYear()===currentDate.getFullYear();}).reduce((sum,row)=>sum+row.amountCents,0);
  return <div className="workspace-view"><section className="workspace-head"><div><p className="eyebrow">Owner operations</p><h1>Business</h1><p>Tasks, expenses, and job profitability in one simple place.</p></div><div className="workspace-head-actions"><a className="export-button" href="/api/backup"><Download/> Full records backup</a><a className="export-button" href="/api/backup/photos"><Images/> Photo archive</a><a className="export-button" href="/api/backup/photos/storage"><Images/> Complete photo storage backup</a><button type="button" className="export-button" disabled={restoreBusy} onClick={()=>restoreInput.current?.click()}><Upload/> Restore missing records</button><input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={(event)=>{const file=event.target.files?.[0];if(file)void chooseBackup(file);}}/><a className="export-button" href="/api/expenses?format=csv"><Download/> Export for Wave</a></div></section>{restoreMessage&&<p className="save-message" role="status">{restoreMessage}</p>}{businessMessage&&<p className={businessMessage.includes("added")||businessMessage.includes("recorded")||businessMessage.includes("verified")?"save-success":"save-error"} role="status">{businessMessage}</p>}
    {receiptError&&<p className="save-error" role="alert">{receiptError}</p>}
    {(taskRecoveryId||expenseRecoveryId)&&<section className="business-panel" role="status" aria-label="Pending save recovery">
      <h2>Review an interrupted Business save</h2>
      <p>A previous {taskRecoveryId?"task":"expense"} save may have completed without a confirmed response. Only its opaque request ID was stored on this device—no notes, customer details, or expense amounts.</p>
      <p>Check saved records first. If the record exists, FIRE automatically clears its pending receipt. If it remains unconfirmed, another new submission might duplicate the original.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading||taskSaving||expenseSaving}>Check saved records</Button>
        {taskRecoveryId&&<Button variant="outline" onClick={()=>setDiscardReceipt("task")} disabled={taskSaving}>Review task reset</Button>}
        {expenseRecoveryId&&<Button variant="outline" onClick={()=>setDiscardReceipt("expense")} disabled={expenseSaving}>Review expense reset</Button>}
      </div>
    </section>}{loading?<div className="customers-state">Loading business records…</div>:loadError?<div className="customers-state" role="alert"><p>{loadError}</p>{focusTaskId&&<p>This notification's task could not be verified. It has not been completed, changed, or dismissed. Retry reading saved Business records.</p>}<Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:<>{taskFocusNotice&&<section className="business-task-recovery" role="status" aria-label="Notification task recovery"><strong>{taskFocusNotice.status==="missing"?"Notification task not found in latest saved records":taskFocusNotice.status==="restored"?"Notification task found after recheck":"Notification task status has changed"}</strong><p>{taskFocusNotice.status==="missing"?"The task ID was not in the latest verified Business list. This does not prove it was deleted. Review its customer's saved activity or recheck; no task status or customer contact was changed.":taskFocusNotice.status==="restored"?"The task is present in the refreshed list. Review its saved details before acting.":"The saved task is no longer an open task due now. Review the current saved status before taking action; no contact or completion was recorded."}</p><div className="business-task-recovery-actions"><Button variant="outline" onClick={()=>void load()} disabled={loading||Boolean(taskToggling)}>Recheck saved tasks</Button>{taskFocusNotice.status==="restored"&&<Button variant="outline" onClick={()=>{setTaskSearch("");setTaskFilter("all");setContextTaskId(taskFocusNotice.id);setHighlightTaskId(taskFocusNotice.id);}}>Review recovered task</Button>}{(()=>{const customer=taskFocusNotice.customerId?customers.find(row=>row.id===taskFocusNotice.customerId):null;return customer?<>{onOpenCustomer&&<Button variant="outline" onClick={()=>onOpenCustomer(customer.id)}>Open verified customer profile</Button>}{taskFocusNotice.activity&&onOpenCustomerActivity&&<Button variant="outline" onClick={()=>onOpenCustomerActivity(customer.id,taskFocusNotice.activity!)}>Check saved {taskFocusNotice.activity==="sign"?"yard-sign":"review"} flag</Button>}</>:<small>Linked customer not verified in the loaded owner records. Open Customers to search manually.</small>;})()}</div></section>}<nav className="business-section-links" aria-label="Business sections"><Button variant="outline" onClick={()=>jumpTo("business-tasks-heading")}>Tasks and reminders</Button><Button variant="outline" onClick={()=>jumpTo("business-expenses-heading")}>Expenses</Button></nav><section className="business-metrics business-operations-metrics"><article><small>Open tasks</small><strong>{tasks.filter((task)=>task.status==="open").length}</strong></article><article><small>Past-due tasks</small><strong>{dueCounts.overdue}</strong></article><article><small>Due today (remaining)</small><strong>{dueCounts.today}</strong></article><article><small>This month&apos;s expenses</small><strong>{money(monthExpenses)}</strong></article><article><small>Recorded expenses</small><strong>{expenses.length}</strong></article></section><div className="business-grid"><section className="business-panel"><header><div><h2 id="business-tasks-heading" tabIndex={-1}>Tasks and reminders</h2><p>Keep follow-ups and field work from slipping.</p></div></header>{reviewTarget&&<div className="business-pickup-draft" role="status"><strong><Star aria-hidden="true"/> Review status check draft</strong><p>{duplicateReviewDraft?"A task for this review request is already saved. Avoid creating a duplicate.":"Review the customer and due date, then choose Add task. No customer message is prepared or sent."}</p><small>First check whether a review is posted or already logged. This is an owner reminder, not an automatic second review request.</small></div>}{pickupTarget&&<div className="business-pickup-draft" role="status"><strong><MapPin aria-hidden="true"/> Yard sign pickup reminder</strong><p>{duplicatePickupDraft?"This placement already has a saved task. Avoid creating a duplicate.":"Review customer, pickup date/time and location, then choose Add task. No task has been created yet."}</p><small>Pickup time defaults to noon on this device; adjust as needed. Mark the physical sign picked up separately in the customer's Activity & flags.</small></div>}<div className="business-form"><div className="business-field"><Label htmlFor="business-task-title">Task or reminder</Label><Input id="business-task-title" disabled={taskSaving} value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Task, call, or reminder"/></div><div className="business-field"><Label id="business-task-customer-label" htmlFor="business-task-customer">Customer</Label><Select value={taskCustomer} disabled={taskSaving} onValueChange={setTaskCustomer}><SelectTrigger id="business-task-customer" aria-labelledby="business-task-customer-label"><SelectValue placeholder="Link a customer"/></SelectTrigger><SelectContent><SelectItem value="none">General business task</SelectItem>{customers.map((customer)=><SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent></Select></div><div className="business-field"><Label htmlFor="business-task-due">Due date and time (optional)</Label><Input id="business-task-due" disabled={taskSaving} type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></div><div className="business-field"><Label htmlFor="business-task-notes">Notes (optional)</Label><Textarea id="business-task-notes" disabled={taskSaving} value={taskNotes} onChange={(event)=>setTaskNotes(event.target.value)} placeholder="Optional notes" rows={2}/></div><Button className="brand-button" onClick={()=>void addTask()} disabled={taskSaving||loading||Boolean(loadError)||duplicatePickupDraft||duplicateReviewDraft}><Plus className="h-4 w-4"/> {taskSaving?"Adding…":"Add task"}</Button></div>{taskStatusMessage&&<p className={taskStatusUncertain?"save-error":"save-message"} role={taskStatusUncertain?"alert":"status"}>{taskStatusMessage}</p>}{taskStatusUncertain&&<Button variant="outline" onClick={()=>void refreshTaskStatuses()} disabled={Boolean(taskToggling)}>Refresh task statuses</Button>}<div className="business-record-tools"><Label htmlFor="business-task-search">Find a task</Label><Input id="business-task-search" type="search" value={taskSearch} onChange={event=>setTaskSearch(event.target.value)} placeholder="Search task, customer, or notes"/><div className="business-task-filters" role="group" aria-label="Task filters">{(["all","open","completed","overdue","today"] as const).map(value=><Button key={value} variant={taskFilter===value?"default":"outline"} aria-pressed={taskFilter===value} onClick={()=>setTaskFilter(value)}>{value==="all"?"All":value==="open"?"Open":value==="completed"?"Completed":value==="overdue"?"Past due":"Due today"} ({value==="all"?tasks.length:value==="overdue"||value==="today"?dueCounts[value]:tasks.filter(task=>task.status===value).length})</Button>)}</div><p role="status">Showing {visibleTasks.length} of {tasks.length} tasks.</p>{(taskQuery||taskFilter!=="all")&&<Button variant="outline" onClick={()=>{setTaskSearch("");setTaskFilter("all");}}>Clear task filters</Button>}</div><div className="task-list">{visibleTasks.map(task=>{
 const context=businessTaskContext(task,customers,estimates);
 const expanded=contextTaskId===task.id;
 return <div key={task.id} className={"business-task-item"+(highlightTaskId===task.id?" task-dashboard-focus":"")}>
 <div className="business-task-row">
 <button type="button" className={"business-task-toggle "+task.status} aria-label={`Toggle completion for ${task.title}`} aria-pressed={task.status==="completed"} aria-busy={taskToggling===task.id} onClick={()=>void toggleTask(task)} disabled={Boolean(taskToggling)||taskStatusUncertain}><span className="task-check">{task.status==="completed"&&<Check/>}</span><span><strong>{task.title}</strong><small>{task.customer?`${task.customer} · `:""}{task.dueAt?dateTime(task.dueAt):"No due date"}{task.notes?` · ${task.notes}`:""}</small>{taskDueBucket(task,taskNow)==="overdue"&&<span className="business-due-chip overdue">Past due</span>}{taskDueBucket(task,taskNow)==="today"&&<span className="business-due-chip today">Due today</span>}</span></button>
 <button type="button" id={"business-task-"+task.id} className="business-task-details-button" aria-expanded={expanded} aria-controls={"business-task-context-"+task.id} aria-label={`Review details for ${task.title}`} onClick={()=>setContextTaskId(current=>current===task.id?null:task.id)}><FileText aria-hidden="true"/><span>{expanded?"Hide details":"Review details"}</span></button>
 </div>
 {expanded&&<section id={"business-task-context-"+task.id} className="business-task-context" role="region" aria-label={`Task context for ${task.title}`}>
 <div className="business-task-context-heading"><strong>{task.title}</strong><span>{task.status==="completed"?"Task saved as completed":taskDueBucket(task,taskNow)==="overdue"?"Task past due":taskDueBucket(task,taskNow)==="today"?"Task due today":"Saved business task"}</span></div>
 <p>{task.dueAt?"Due "+dateTime(task.dueAt):"No task due date recorded"} · Viewing does not complete, contact, or save anything.</p>
 {context.customer?<><div className="business-task-customer-summary"><strong>{context.customer.name}</strong>{context.customer.address&&<small>{context.customer.address}</small>}{context.customer.phone&&<small>{context.customer.phone}</small>}<small>{context.estimateCount} saved estimate{context.estimateCount===1?"":"s"} · {context.scheduledCount} scheduled · {context.completedCount} completed</small></div>
 {context.flag?<><p>{context.flag.kind==="sign"?"Linked yard-sign placement":"Linked review request"} · saved task marker {context.flag.recordedAt}. Verify the actual flag and its current status in Customer Activity &amp; Flags. A completed task alone does not confirm a pickup or posted review.</p>
 {onOpenCustomerActivity&&<button type="button" className="business-task-context-link" onClick={()=>onOpenCustomerActivity(context.customer!.id,context.flag!.kind)}><Users aria-hidden="true"/> {context.flag.kind==="sign"?"Open exact yard-sign flag":"Open exact review flag"} <ChevronRight aria-hidden="true"/></button>}</>:
 <p>No matching yard-sign or review-event marker is recorded for this task. Review the saved customer profile for broader history.</p>}
 {onOpenCustomer&&<button type="button" className="business-task-context-link" onClick={()=>onOpenCustomer(context.customer!.id)}><Users aria-hidden="true"/> Open customer profile <ChevronRight aria-hidden="true"/></button>}
 </>:task.customerId?<p role="status">The linked customer could not be verified in the loaded customer list. No customer flag was assumed.</p>:<p>General business task · no linked customer.</p>}
 </section>}
 </div>;
 })}{!visibleTasks.length&&<p className="business-record-empty">{tasks.length?"No tasks match these filters. Clear filters to see all saved tasks.":"No tasks yet."}</p>}</div></section><section className="business-panel"><header><div><h2 id="business-expenses-heading" tabIndex={-1}>Expenses</h2><p>Track costs and export them for Wave.</p></div></header><div className="business-form"><div className="business-field"><Label id="business-expense-category-label" htmlFor="business-expense-category">Expense category</Label><Select value={category} disabled={expenseSaving} onValueChange={setCategory}><SelectTrigger id="business-expense-category" aria-labelledby="business-expense-category-label"><SelectValue/></SelectTrigger><SelectContent>{["Supplies","Chemicals","Equipment","Fuel","Insurance","Marketing","Labor","Other"].map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="business-field"><Label id="business-expense-job-label" htmlFor="business-expense-job">Job</Label><Select value={expenseEstimate} disabled={expenseSaving} onValueChange={setExpenseEstimate}><SelectTrigger id="business-expense-job" aria-labelledby="business-expense-job-label"><SelectValue placeholder="Link a job"/></SelectTrigger><SelectContent><SelectItem value="none">General business expense</SelectItem>{estimates.map((estimate)=>{const customer=customers.find((item)=>item.id===estimate.customerId);return <SelectItem key={estimate.id} value={estimate.id}>{customer?.name||"Customer"} · {estimate.service}</SelectItem>;})}</SelectContent></Select></div><div className="business-field"><Label htmlFor="business-expense-description">Expense description</Label><Input id="business-expense-description" disabled={expenseSaving} value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="What was the expense?"/></div><div className="business-field"><Label htmlFor="business-expense-amount">Amount ($)</Label><Input id="business-expense-amount" disabled={expenseSaving} value={amount} onChange={(event)=>setAmount(event.target.value)} inputMode="decimal" placeholder="$ Amount"/></div><div className="business-field"><Label htmlFor="business-expense-date">Purchase date (optional)</Label><Input id="business-expense-date" type="date" disabled={expenseSaving} value={expenseDate} onChange={(event)=>setExpenseDate(event.target.value)}/><small>Leave blank to record the current date and time.</small></div><Button className="brand-button" onClick={()=>void addExpense()} disabled={expenseSaving}><Plus className="h-4 w-4"/> {expenseSaving?"Adding…":"Add expense"}</Button></div><div className="business-record-tools"><Label htmlFor="business-expense-search">Find an expense</Label><Input id="business-expense-search" type="search" value={expenseSearch} onChange={event=>{setExpenseSearch(event.target.value);setExpenseLimit(12);}} placeholder="Search expense, category, customer, or job"/>{expenseQuery&&<Button variant="outline" onClick={()=>{setExpenseSearch("");setExpenseLimit(12);}}>Clear expense search</Button>}<p role="status">Showing {Math.min(expenseLimit,matchingExpenses.length)} of {matchingExpenses.length}{expenseQuery?" matching":""} expenses. {expenseQuery?`${expenses.length} saved in total.`:""}</p></div><div className="expense-list">{matchingExpenses.slice(0,expenseLimit).map((row)=><div key={row.id}><span><strong>{row.description}</strong><small>{row.category}{row.customer?` · ${row.customer}`:""} · {new Date(row.incurredAt).toLocaleDateString()}</small></span><b>{money(row.amountCents)}</b></div>)}{!matchingExpenses.length&&<p className="business-record-empty">{expenses.length?"No expenses match this search. Clear the search to see all saved expenses.":"No expenses recorded yet."}</p>}</div>{matchingExpenses.length>expenseLimit&&<div className="business-record-more"><Button variant="outline" onClick={()=>setExpenseLimit(current=>Math.min(current+12,matchingExpenses.length))}>Show {Math.min(12,matchingExpenses.length-expenseLimit)} more expenses</Button></div>}</section></div></>}<AlertDialog open={Boolean(pendingBackup)} onOpenChange={(open)=>{if(!open&&!restoreBusy)setPendingBackup(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore missing FIRE App records?</AlertDialogTitle><AlertDialogDescription>The app will add records that are missing from this backup. It will not delete or overwrite records already in the app. Customer photo files are not included and will be skipped.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={restoreBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={restoreBusy} onClick={(event)=>{event.preventDefault();void restoreBackup();}}>{restoreBusy?"Restoring…":"Restore missing records"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog open={Boolean(discardReceipt)} onOpenChange={(open)=>{if(!open)setDiscardReceipt(null);}}>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Abandon the pending {discardReceipt==="task"?"task":"expense"} request ID?</AlertDialogTitle>
    <AlertDialogDescription>Only do this after checking saved Business records. The earlier save could still have succeeded; clearing its receipt allows a new submission that might create a duplicate. No saved record will be deleted.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>Keep recovery ID</AlertDialogCancel>
    <AlertDialogAction onClick={(event)=>{event.preventDefault();if(!discardReceipt)return;
      const storage=businessReceiptStorage(),receipt=readBusinessReceipt(storage,discardReceipt);
      if(receipt.requestId&&releaseBusinessReceipt(storage,discardReceipt,receipt.requestId)){
        if(discardReceipt==="task"){taskCreateAttempt.current=null;setTaskRecoveryId(null);}else{expenseCreateAttempt.current=null;setExpenseRecoveryId(null);}
        setBusinessMessage("Recovery ID abandoned by owner. Verify the earlier save did not create a record before submitting again.");
      }else setReceiptError("Recovery ID could not be cleared safely. No new request was authorized.");
      setDiscardReceipt(null);
    }}>I reviewed the list — abandon ID</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog></div>;
}

type InsightRange="30"|"ytd"|"lifetime";
function InsightsView(){
  const [range,setRange]=useState<InsightRange>("30");
  const [customers,setCustomers]=useState<CustomerRow[]>([]);const [estimates,setEstimates]=useState<CustomerEstimate[]>([]);const [invoices,setInvoices]=useState<InvoiceRow[]>([]);const [payments,setPayments]=useState<PaymentRow[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const loadRequest=useRef(0);
  const load=async()=>{
    const request=++loadRequest.current;setLoading(true);setError("");
    try{
      const response=await fetch("/api/customers",{cache:"no-store"});
      const result=await response.json() as {customers?:CustomerRow[];estimates?:CustomerEstimate[];invoices?:InvoiceRow[];payments?:PaymentRow[];error?:string};
      if(request!==loadRequest.current)return;
      if(!response.ok)throw new Error(result?.error||"Insights are temporarily unavailable.");
      const collections=[result?.customers,result?.estimates,result?.invoices,result?.payments];
      if(collections.some(rows=>!Array.isArray(rows)||rows.some(row=>!row||typeof row!=="object"||Array.isArray(row)||typeof row.id!=="string"||!row.id)||new Set(rows.map(row=>row.id)).size!==rows.length))throw new Error("Insight records could not be read. Reconnect and try again; totals are unavailable.");
      const validDate=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
      const cents=(value:unknown)=>{if((typeof value!=="number"&&typeof value!=="string")||(typeof value==="string"&&!value.trim())||!Number.isSafeInteger(Number(value)))throw new Error("Insight amounts need review before totals can be shown.");return Number(value);};
      if(result.customers!.some(row=>typeof row.name!=="string"||!validDate(row.createdAt)||(row.leadSource!=null&&typeof row.leadSource!=="string"))||result.estimates!.some(row=>!validDate(row.createdAt)||typeof row.status!=="string"||typeof row.service!=="string"||!Array.isArray(row.items)||row.items.some(item=>!item||typeof item.name!=="string"))||result.invoices!.some(row=>typeof row.estimateId!=="string")||result.payments!.some(row=>!validDate(row.createdAt)||typeof row.estimateId!=="string"||typeof row.type!=="string"))throw new Error("Insight records need review before totals can be shown.");
      const nextEstimates=result.estimates!.map(row=>({...row,totalCents:cents(row.totalCents),invoiceTotalCents:row.invoiceTotalCents==null?null:cents(row.invoiceTotalCents),paidCents:cents(row.paidCents),items:row.items!.map(item=>({...item,totalCents:cents(item.totalCents)}))}));
      const nextInvoices=result.invoices!.map(row=>({...row,totalCents:cents(row.totalCents)}));
      const nextPayments=result.payments!.map(row=>({...row,amountCents:cents(row.amountCents)}));
      // Bound absolute sums as well as individual cents before existing metrics run.
      for(const values of [nextEstimates.flatMap(row=>[row.totalCents,row.invoiceTotalCents??0,...row.items.map(item=>item.totalCents)]),nextInvoices.map(row=>row.totalCents),nextPayments.map(row=>row.amountCents)]){let total=0;for(const value of values){total+=Math.abs(value);if(!Number.isSafeInteger(total))throw new Error("Insight totals exceed the safe accounting range. Review records before using these totals.");}}
      setCustomers(result.customers!);setEstimates(nextEstimates);setInvoices(nextInvoices);setPayments(nextPayments);
    }catch(loadError){if(request===loadRequest.current)setError(loadError instanceof Error?loadError.message:"Insights are temporarily unavailable.");}
    finally{if(request===loadRequest.current)setLoading(false);}
  };
  useEffect(()=>{void load();return()=>{loadRequest.current++;};},[]);
  const start=useMemo(()=>{const now=new Date();if(range==="30")return new Date(now.getTime()-30*86400000);if(range==="ytd")return new Date(now.getFullYear(),0,1);return null;},[range]);
  const inRange=(value:string)=>!start||new Date(value)>=start;
  const rangedEstimates=estimates.filter((row)=>inRange(row.createdAt));const rangedCustomers=customers.filter((row)=>inRange(row.createdAt));const rangedPayments=payments.filter((row)=>inRange(row.createdAt));
  const completed=rangedEstimates.filter((row)=>row.status==="completed");const decided=rangedEstimates.filter((row)=>["sent","approved","scheduled","completed","declined"].includes(row.status));const won=decided.filter((row)=>["approved","scheduled","completed"].includes(row.status));const closeRate=decided.length?Math.round(won.length/decided.length*100):0;
  const completedValue=completed.reduce((sum,row)=>sum+resolvedBillingTotalCents(row),0);const averageJob=completed.length?Math.round(completedValue/completed.length):0;const collected=rangedPayments.reduce((sum,row)=>sum+row.amountCents,0);
  const paymentsByEstimate=new Map<string,number>();for(const payment of payments.filter((row)=>row.type!=='Tip'&&row.type!=='Tip Refund'))paymentsByEstimate.set(payment.estimateId,(paymentsByEstimate.get(payment.estimateId)??0)+payment.amountCents);
  const unpaid=invoices.reduce((sum,invoice)=>sum+Math.max(0,invoice.totalCents-(paymentsByEstimate.get(invoice.estimateId)??0)),0);
  const serviceTotals=new Map<string,number>();for(const estimate of completed){const items=estimate.items?.length?estimate.items:[{id:estimate.id,name:estimate.service||"Custom service",description:"",quantity:1,unit:"job",totalCents:resolvedBillingTotalCents(estimate)}];for(const item of items)serviceTotals.set(item.name,(serviceTotals.get(item.name)??0)+Number(item.totalCents));}
  const services=[...serviceTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);const maxService=Math.max(1,...services.map(([,value])=>value));
  const sourceTotals=new Map<string,number>();for(const customer of rangedCustomers){const source=customer.leadSource?.trim()||"Unknown";sourceTotals.set(source,(sourceTotals.get(source)??0)+1);}const sources=[...sourceTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);const maxSource=Math.max(1,...sources.map(([,value])=>value));
  return <div className="workspace-view insights-view"><section className="workspace-head"><div><p className="eyebrow">Business performance</p><h1>Insights</h1><p>A focused view of sales, leads, close rate, job value, and unpaid balances.</p></div><div className="insight-range" aria-label="Insights date range">{(["30","ytd","lifetime"] as const).map((value)=><button key={value} className={range===value?"active":""} onClick={()=>setRange(value)}>{value==="30"?"30 days":value==="ytd"?"Year to date":"Lifetime"}</button>)}</div></section>
    {loading?<div className="customers-state">Loading insights…</div>:error?<div className="customers-state" role="alert"><BarChart3/><strong>Insights unavailable</strong><p>{error}</p><Button variant="outline" className="min-h-11" onClick={()=>void load()}>Try again</Button></div>:<><section className="insight-kpis"><article><span><TrendingUp/></span><small>Close rate</small><strong>{closeRate}%</strong><p>{won.length} of {decided.length} decided estimates</p></article><article><span><CircleDollarSign/></span><small>Collected</small><strong>{money(collected)}</strong><p>Payments in selected period</p></article><article><span><BriefcaseBusiness/></span><small>Average completed job</small><strong>{money(averageJob)}</strong><p>{completed.length} completed job{completed.length===1?"":"s"}</p></article><article><span><Receipt/></span><small>Unpaid invoice balance</small><strong>{money(unpaid)}</strong><p>Current all-time amount</p></article></section><div className="insight-grid"><section className="insight-panel"><header><div><h2>Completed work by service</h2><p>Service-line value for completed jobs in this period.</p></div><BarChart3/></header>{services.length?<div className="insight-bars">{services.map(([name,value])=><article key={name}><div><strong>{name}</strong><span>{money(value)}</span></div><i><b style={{width:`${Math.max(4,value/maxService*100)}%`}}/></i></article>)}</div>:<div className="insight-empty">No completed jobs in this period.</div>}</section><section className="insight-panel"><header><div><h2>Leads by source</h2><p>How new customers found FIRE in this period.</p></div><Users/></header>{sources.length?<div className="insight-bars sources">{sources.map(([name,value])=><article key={name}><div><strong>{name}</strong><span>{value} lead{value===1?"":"s"}</span></div><i><b style={{width:`${Math.max(4,value/maxSource*100)}%`}}/></i></article>)}</div>:<div className="insight-empty">No new customer sources in this period.</div>}</section></div></>}
  </div>;
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

type NotificationAttentionItem=AttentionEstimateItem|{key:string;kind:"task"|"sign"|"review"|"closeout";title:string;detail:string;estimateId?:string;taskId?:string;customerId?:string;customerActivity?:"sign"|"review";urgent:boolean;priority:number;sortAt?:number};
/** Live attention remains separate from persisted activity notifications.
 * Clicking navigates to the actual task/customer; reading never resolves it.
 */
function NotificationAttention({onNavigate,onClose,onSummary,refreshKey=0}:{onNavigate:(tab:string,estimateId?:string|null,invoiceId?:string|null,customerId?:string|null,taskId?:string|null,customerActivity?:"sign"|"review")=>void;onClose:()=>void;onSummary?:(summary:{status:"ready"|"loading"|"error";count:number})=>void;refreshKey?:number}){
 const [rows,setRows]=useState<NotificationAttentionItem[]>([]);
 const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
 const [reload,setReload]=useState(0);
 const [shown,setShown]=useState(8);
 const [view,setView]=useState<"all"|"priority">("all");
 const [hasOlder,setHasOlder]=useState(false);
 const [hasMoreReviewCloseouts,setHasMoreReviewCloseouts]=useState(false);
 const [reviewPageDepth,setReviewPageDepth]=useState(1);
 const [checkedReviewCount,setCheckedReviewCount]=useState(0);
 const [checkedEstimateCount,setCheckedEstimateCount]=useState(0);
 // First 50, then 200 older per owner tap; cap at 450 records inside the bell.
 const [followupPageDepth,setFollowupPageDepth]=useState(1);
 useEffect(()=>{
   let stopped=false,requestId=0;
   const controller=new AbortController();
   setStatus("loading");
   const read=async()=>{
     // Focus, visibility and 60-second reads may overlap; only the newest result
     // may replace the currently verified reminder collection.
     const thisRequest=++requestId;
     try{
       const urls=["/api/tasks","/api/dashboard-yard-signs","/api/dashboard-review-checks","/api/followups?limit=50","/api/payment-closeouts"];
       const responses=await Promise.all(urls.map(url=>fetch(url,{cache:"no-store",signal:controller.signal})));
       if(responses.some(r=>!r.ok))throw Error("Attention read unavailable");
       const [taskData,signData,reviewData,followupData,closeoutData]=await Promise.all(responses.map(r=>r.json())) as [{tasks?:TaskRow[]},{signs?:DashboardYardSign[]},{checks?:DashboardReviewCheck[]},{estimates?:AttentionEstimate[];nextCursor?:string|null},{actions?:PaymentCloseoutAction[];mayHaveMore?:boolean;nextCursor?:string|null}];
       if(!Array.isArray(taskData.tasks)||!Array.isArray(signData.signs)||!Array.isArray(reviewData.checks)||!Array.isArray(followupData.estimates)||!(followupData.nextCursor==null||typeof followupData.nextCursor==="string")||!Array.isArray(closeoutData.actions)||typeof closeoutData.mayHaveMore!=="boolean"||!(closeoutData.nextCursor==null||typeof closeoutData.nextCursor==="string"))throw Error("Unverified attention response");
        const malformedTask=taskData.tasks.some(t=>!t||typeof t.id!=="string"||!t.id||
         typeof t.title!=="string"||!["open","completed"].includes(t.status)||
         (t.dueAt!=null&&(typeof t.dueAt!=="string"||!Number.isFinite(Date.parse(t.dueAt)))));
        const malformedSign=signData.signs.some(s=>!s||typeof s.customerId!=="string"||!s.customerId||
         typeof s.customerName!=="string"||typeof s.pickupDate!=="string"||
         !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s.pickupDate));
        const malformedReview=reviewData.checks.some(c=>!c||typeof c.customerId!=="string"||!c.customerId||
         typeof c.customerName!=="string"||!Number.isFinite(Date.parse(c.requestedAt))||
         !Number.isFinite(c.elapsedDays));
        const malformedFollowup=followupData.estimates.some(e=>!e||typeof e.id!=="string"||!e.id||
         typeof e.customer!=="string"||typeof e.status!=="string"||typeof e.createdAt!=="string");
        const malformedCloseout=closeoutData.actions.length>200||closeoutData.actions.some(c=>!c||
         typeof c.estimateId!=="string"||!c.estimateId||typeof c.customerId!=="string"||!c.customerId||
         typeof c.customerName!=="string"||!c.customerName.trim()||
         !["ready","prepared"].includes(c.state)||!Number.isSafeInteger(c.totalCents)||c.totalCents<=0||
         typeof c.lastPaidAt!=="string"||!Number.isFinite(Date.parse(c.lastPaidAt)));
        if(malformedTask||malformedSign||malformedReview||malformedFollowup||malformedCloseout)
          throw Error("Malformed attention records");
       // Re-read a bounded number of cursor pages as a single atomic owner snapshot.
       // Any failed/invalid page makes the whole attention read unavailable, never "all clear".
       const checked:[AttentionEstimate[],string|null,number]=[[...followupData.estimates],followupData.nextCursor??null,1];
       const cursors=new Set<string>();
       while(checked[1]&&checked[2]<followupPageDepth){
         const cursor=checked[1];
         if(!cursor||cursors.has(cursor)||cursor.length>512)throw Error("Follow-up cursor did not advance");
         cursors.add(cursor);
         const extraResponse=await fetch("/api/followups?limit=50&cursor="+encodeURIComponent(cursor),{cache:"no-store",signal:controller.signal});
         if(!extraResponse.ok)throw Error("Older follow-up page unavailable");
         const extra=await extraResponse.json() as {estimates?:AttentionEstimate[];nextCursor?:string|null};
         if(!Array.isArray(extra.estimates)||!(extra.nextCursor==null||typeof extra.nextCursor==="string")||
            extra.estimates.some(e=>!e||typeof e.id!=="string"||!e.id||typeof e.customer!=="string"||typeof e.status!=="string"||typeof e.createdAt!=="string")||
            (extra.nextCursor!=null&&(extra.nextCursor===cursor||cursors.has(extra.nextCursor))))throw Error("Older follow-up page not verified");
         checked[0].push(...extra.estimates);checked[1]=extra.nextCursor??null;checked[2]++;
       }
       // Read-only, owner-invoked keyset expansion. No partial result is
       // published if an older page is malformed or unavailable.
       const reviewRows=[...closeoutData.actions],seenReviews=new Set(reviewRows.map(x=>x.estimateId));
       const seenReviewCursors=new Set<string>();
       let reviewCursor=closeoutData.nextCursor??null,reviewMore=closeoutData.mayHaveMore,reviewPages=1;
       while(reviewMore&&reviewCursor&&reviewPages<reviewPageDepth){
         if(reviewCursor.length>210||seenReviewCursors.has(reviewCursor))throw Error("Review cursor did not advance");
         const cursor=reviewCursor;seenReviewCursors.add(cursor);
         const moreResponse=await fetch("/api/payment-closeouts?cursor="+encodeURIComponent(cursor),{cache:"no-store",signal:controller.signal});
         if(!moreResponse.ok)throw Error("Older paid-job review page unavailable");
         const extra=await moreResponse.json() as {actions?:PaymentCloseoutAction[];mayHaveMore?:boolean;nextCursor?:string|null};
         if(!Array.isArray(extra.actions)||extra.actions.length>200||typeof extra.mayHaveMore!=="boolean"||
           !(extra.nextCursor==null||typeof extra.nextCursor==="string")||
           extra.actions.some(x=>!x||typeof x.estimateId!=="string"||!x.estimateId||
             typeof x.customerId!=="string"||!x.customerId||typeof x.customerName!=="string"||!x.customerName.trim()||
             !["ready","prepared"].includes(x.state)||!Number.isSafeInteger(x.totalCents)||x.totalCents<=0||
             typeof x.lastPaidAt!=="string"||!Number.isFinite(Date.parse(x.lastPaidAt))||
             seenReviews.has(x.estimateId))||
           (extra.nextCursor!=null&&(extra.nextCursor===cursor||seenReviewCursors.has(extra.nextCursor))))
             throw Error("Older review page not verified");
         extra.actions.forEach(x=>{seenReviews.add(x.estimateId);reviewRows.push(x);});
         reviewMore=extra.mayHaveMore;reviewCursor=extra.nextCursor??null;reviewPages++;
       }
       const seenEstimates=new Set<string>();
       const verifiedEstimates=checked[0].filter(e=>{if(seenEstimates.has(e.id))return false;seenEstimates.add(e.id);return true;});
       const now=new Date(),localDay=now.toLocaleDateString("en-CA",{timeZone:"America/Chicago"});
       const dueTasks:NotificationAttentionItem[]=taskData.tasks.filter(t=>["today","overdue"].includes(taskDueBucket(t,now))).map(t=>({key:"task:"+t.id,kind:"task",taskId:t.id,customerId:typeof t.customerId==="string"&&t.customerId?t.customerId:undefined,customerActivity:taskLinkedFlag(t)?.kind,title:t.title,detail:taskDueBucket(t,now)==="overdue"?"Business task overdue":"Business task due today",urgent:true,priority:taskDueBucket(t,now)==="overdue"?110:85,sortAt:Date.parse(t.dueAt!)}));
       const verifiedTasks=taskData.tasks??[];
       const dueTaskIds=new Set(verifiedTasks.filter(task=>["today","overdue"].includes(taskDueBucket(task,now))).map(task=>task.id));
       const dueSigns:NotificationAttentionItem[]=signData.signs.filter(s=>s.pickupDate<=localDay&&
         !flagHasMatchingDueTask(verifiedTasks,dueTaskIds,s.customerId,"sign",s.placedAt)).map(s=>({key:"sign:"+s.customerId,kind:"sign",customerId:s.customerId,title:s.customerName,detail:(s.pickupDate<localDay?"Yard sign pickup overdue · ":"Yard sign pickup due today · ")+s.pickupDate,urgent:true,priority:s.pickupDate<localDay?105:75,sortAt:Date.parse(s.pickupDate+"T12:00:00Z")}));
       const dueReviews:NotificationAttentionItem[]=reviewData.checks.filter(c=>
         !flagHasMatchingDueTask(verifiedTasks,dueTaskIds,c.customerId,"review",c.requestedAt)).map(c=>({key:"review:"+c.customerId,kind:"review",customerId:c.customerId,title:c.customerName,detail:"Check review status · "+c.elapsedDays+" days since request",urgent:false,priority:40,sortAt:Date.parse(c.requestedAt)}));
       // Read-only post-payment reminders; never claim messages were sent.
       const closeoutItems:NotificationAttentionItem[]=reviewRows.map(c=>({
         key:"closeout:"+c.estimateId,kind:"closeout",estimateId:c.estimateId,customerId:c.customerId,
         title:c.customerName,detail:c.state==="prepared"?"Review request prepared · sending not confirmed":"Paid in full · request an honest review",
         urgent:false,priority:c.state==="prepared"?35:55,sortAt:Date.parse(c.lastPaidAt)
       }));
       // Review-request reminders come from the canonical, verified closeout ledger,
       // not the older partial estimate scan: no duplicate or premature nudge.
       const estimateChecks=estimateAttentionItems(verifiedEstimates,now.getTime()).filter(item=>item.kind!=="review-request");
       if(!stopped&&thisRequest===requestId){const timeOf=(item:NotificationAttentionItem)=>item.sortAt??Number.MAX_SAFE_INTEGER;
         const next=[...dueTasks,...dueSigns,...closeoutItems,...dueReviews,...estimateChecks].sort((a,b)=>b.priority-a.priority||timeOf(a)-timeOf(b)||a.key.localeCompare(b.key));
         setRows(next);setHasOlder(Boolean(checked[1]));setHasMoreReviewCloseouts(reviewMore);setCheckedReviewCount(reviewRows.length);setCheckedEstimateCount(verifiedEstimates.length);setShown(8);setStatus("ready");onSummary?.({status:"ready",count:next.length});}
     }catch{if(!stopped&&thisRequest===requestId){setRows([]);setHasOlder(false);setHasMoreReviewCloseouts(false);setCheckedReviewCount(0);setStatus("error");onSummary?.({status:"error",count:0});}}
   };
   void read();
   const refresh=()=>{if(document.visibilityState==="visible")void read();};
   window.addEventListener("focus",refresh);
   window.addEventListener("fire:attention-saved",refresh);
   // Installed iPhone Home Screen apps can resume via visibilitychange without focus.
   document.addEventListener("visibilitychange",refresh);
   const timer=window.setInterval(refresh,60000);
   return()=>{stopped=true;requestId++;controller.abort();window.removeEventListener("focus",refresh);window.removeEventListener("fire:attention-saved",refresh);document.removeEventListener("visibilitychange",refresh);window.clearInterval(timer);};
 },[reload,refreshKey,followupPageDepth,reviewPageDepth]);
 const priorityCount=rows.filter(item=>item.urgent).length;
 const visibleRows=view==="priority"?rows.filter(item=>item.urgent):rows;
 const kindLabel=(kind:NotificationAttentionItem["kind"])=>kind==="task"?"task":kind==="sign"?"yard sign":kind==="review"?"review check":kind==="closeout"?"review request":kind==="followup"?"follow-up":kind==="review-request"?"review request":kind;
 return <section className="notification-attention" aria-label="Needs attention">
   <header><strong><AlertTriangle aria-hidden="true"/> Needs attention{status==="ready"&&rows.length>0?` · ${rows.length}`:""}</strong><button type="button" aria-label="Refresh attention items" onClick={()=>{setStatus("loading");onSummary?.({status:"loading",count:0});setReload(n=>n+1);}}><RefreshCw aria-hidden="true"/> Refresh</button></header>
   {status==="ready"&&rows.length>0&&<div className="notification-attention-filters" role="group" aria-label="Filter business reminders"><button type="button" aria-pressed={view==="all"} onClick={()=>{setView("all");setShown(8);}}>All · {rows.length}</button><button type="button" aria-pressed={view==="priority"} onClick={()=>{setView("priority");setShown(8);}}>Priority · {priorityCount}</button></div>}
   {status==="loading"?<p role="status">Checking saved tasks, signs, review requests, and follow-ups…</p>:status==="error"?<p role="alert">Attention items couldn't be verified. Refresh to try again; don't assume they are cleared.</p>:visibleRows.length?<div className="notification-attention-list">{visibleRows.slice(0,shown).map(item=><button key={item.key} type="button" className={item.urgent?"urgent":""} aria-label={`Open ${kindLabel(item.kind)}: ${item.title}`} onClick={()=>{onClose();if("taskId" in item&&item.taskId)onNavigate("business",null,null,("customerId" in item?item.customerId:null)??null,item.taskId,("customerActivity" in item?item.customerActivity:undefined));else if("invoiceId" in item&&item.invoiceId)onNavigate("invoices",null,item.invoiceId);else if("estimateId" in item&&item.estimateId)onNavigate(item.kind==="followup"?"followups":"estimates",item.estimateId);else if("customerId" in item&&item.customerId)onNavigate("customers",null,null,item.customerId,null,item.kind==="sign"?"sign":item.kind==="review"?"review":undefined);}}><span>{item.kind==="task"?<ClipboardList aria-hidden="true"/>:item.kind==="sign"?<MapPin aria-hidden="true"/>:item.kind==="invoice"?<Receipt aria-hidden="true"/>:item.kind==="appointment"?<CalendarDays aria-hidden="true"/>:item.kind==="followup"||item.kind==="draft"?<Clock3 aria-hidden="true"/>:<Star aria-hidden="true"/>}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight aria-hidden="true"/></button>)}</div>:<p>{view==="priority"&&rows.length?"No priority reminders in checked records. Choose All to see routine follow-ups.":"No due items in checked records. Older estimates may still need review."}</p>}
   {status==="ready"&&visibleRows.length>shown&&<button type="button" className="notification-attention-more" onClick={()=>setShown(n=>n+8)}>Show next {Math.min(8,visibleRows.length-shown)} reminders · {visibleRows.length-shown} remaining</button>}
   {status==="ready"&&hasOlder&&<div className="notification-attention-coverage" role="status"><small>{checkedEstimateCount} estimates checked. Older estimates remain outside these reminder counts.</small>{followupPageDepth<9?<button type="button" className="notification-attention-more" onClick={()=>{setFollowupPageDepth(n=>Math.min(9,n+4));setStatus("loading");}}>Check up to 200 older estimates</button>:<small>Bell scan limit reached. Open Follow-ups to check remaining older records.</small>}</div>}
   {status==="ready"&&!hasOlder&&<small>All available estimate pages checked in this view as of the last successful read ({checkedEstimateCount} records).</small>}
   {status==="ready"&&hasMoreReviewCloseouts&&<div className="notification-attention-coverage" role="status"><small>{checkedReviewCount} eligible paid jobs verified. Older review requests are still outside this bell count.</small>{reviewPageDepth<10?<button type="button" className="notification-attention-more" onClick={()=>{setReviewPageDepth(n=>Math.min(10,n+1));setStatus("loading");}}>Check 200 older paid jobs</button>:<button type="button" className="notification-attention-more" onClick={()=>{onClose();onNavigate("payments");}}>Open Payments to load remaining jobs</button>}</div>}
   {status==="ready"&&<small>Matching open due tasks consolidate duplicate sign and review reminders. Open the exact task to review its linked customer event; completed tasks never mark a sign picked up or review received.</small>}
   <small>Live reminders are separate from unread activity. Nothing is sent or changed automatically.</small>
 </section>;
}

function NotificationBell({onNavigate}:{onNavigate:(tab:string,estimateId?:string|null,invoiceId?:string|null,customerId?:string|null,taskId?:string|null,customerActivity?:"sign"|"review")=>void}){
  const [items,setItems]=useState<AppNotification[]>([]);
  const [unread,setUnread]=useState(0);
  const [attentionSummary,setAttentionSummary]=useState<{status:"loading"|"ready"|"error";count:number}>({status:"loading",count:0});
  const [attentionRefreshKey,setAttentionRefreshKey]=useState(0);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const mutationLock=useRef(false),loadRequest=useRef(0);
  const load=async()=>{
    if(mutationLock.current)return;
    const request=++loadRequest.current;
    try{
      const response=await fetch("/api/notifications",{cache:"no-store"});
      const result=await response.json() as {notifications?:AppNotification[];unread?:number;error?:string};
      if(request!==loadRequest.current||mutationLock.current)return;
      if(!response.ok)throw Error(result?.error||"Notifications could not be refreshed.");
      if(!Array.isArray(result?.notifications)||result.notifications.some(item=>!item||typeof item.id!=="string"||!item.id||typeof item.title!=="string"||typeof item.body!=="string"||typeof item.createdAt!=="string")||!Number.isSafeInteger(result.unread)||Number(result.unread)<0||Number(result.unread)>result.notifications.length)throw Error("Notification records could not be verified.");
      setItems(result.notifications);setUnread(Number(result.unread));
      // A failed write remains visible until the owner deliberately retries it.
      setError(current=>current.startsWith("Notification update not confirmed")?current:"");
    }catch{
      if(request===loadRequest.current&&!mutationLock.current)setError("Notifications could not be refreshed. Check your connection and try again.");
    }
  };
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);return()=>{loadRequest.current++;window.clearInterval(timer);};},[]);
  const updateRead=async(change:{id?:string;all?:boolean})=>{
    if(mutationLock.current)return;
    mutationLock.current=true;loadRequest.current++;setBusy(true);setError("");
    let confirmed=false;
    try{
      const response=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(change)});
      const result=await response.json() as {ok?:boolean;readAt?:string;error?:string};
      if(!response.ok||result?.ok!==true||typeof result.readAt!=="string"||!Number.isFinite(Date.parse(result.readAt)))throw Error("Update unconfirmed.");
      if(change.all){
        setItems(current=>current.map(item=>({...item,readAt:item.readAt||result.readAt!})));setUnread(0);
      }else if(change.id){
        const previouslyUnread=items.some(item=>item.id===change.id&&!item.readAt);
        setItems(current=>current.map(item=>item.id===change.id?{...item,readAt:item.readAt||result.readAt!}:item));
        if(previouslyUnread)setUnread(current=>Math.max(0,current-1));
      }
      confirmed=true;
    }catch{
      setError("Notification update not confirmed. It may have saved; refresh the list before retrying.");
    }finally{
      mutationLock.current=false;setBusy(false);
      if(confirmed)void load();
    }
  };
  const icon=(type:string)=>type==="estimate_change_requested"?<MessageSquareText/>:type==="estimate_viewed"?<Eye/>:type==="invoice_viewed"?<Receipt/>:type==="estimate_accepted"?<CheckCircle2/>:<CircleDollarSign/>;
  const attentionCount=attentionSummary.status==="ready"?attentionSummary.count:0;
  const attentionDescription=attentionCount?`${attentionCount} business reminders need attention`:attentionSummary.status==="error"?"Business reminders could not be verified":undefined;
  return <Popover open={open} onOpenChange={(value)=>{setOpen(value);if(value){setAttentionSummary({status:"loading",count:0});setAttentionRefreshKey(n=>n+1);void load();}}}><PopoverTrigger asChild><button className="notification-button" aria-label={unread?`${unread} unread notifications`:"Notifications"} aria-description={attentionDescription} title={attentionDescription}><Bell/>{unread>0&&<b>{unread>9?"9+":unread}</b>}{unread===0&&attentionCount>0&&<span aria-hidden="true" className="notification-attention-dot"/>}{unread===0&&attentionSummary.status==="error"&&<span aria-hidden="true" className="notification-attention-dot unavailable"/>}</button></PopoverTrigger><PopoverContent forceMount className="notification-popover" align="end">
    <header><div><strong>Notifications</strong><small>{unread?`${unread} unread activity`:attentionSummary.status==="error"?"Reminders unavailable":attentionCount?`${attentionCount} business reminder${attentionCount===1?"":"s"}`:attentionSummary.status==="loading"?"Checking business reminders…":"No outstanding reminders in checked records"}</small></div>{unread>0&&<button disabled={busy} onClick={()=>void updateRead({all:true})}>Mark all read</button>}</header>
    {error&&<p className="save-error" role="alert">{error}</p>}
    {busy&&<p role="status" aria-live="polite">Confirming notification update…</p>}
    <NotificationAttention onNavigate={onNavigate} onClose={()=>setOpen(false)} onSummary={setAttentionSummary} refreshKey={attentionRefreshKey}/>
    <div className="notification-activity-title">Recent activity · {items.length}</div>
    <div className="notification-list">{items.length?items.map((item)=><button key={item.id} className={item.readAt?"":"unread"} onClick={()=>{if(!item.readAt)void updateRead({id:item.id});setOpen(false);onNavigate(item.type.startsWith("invoice_")&&item.invoiceId?"invoices":item.estimateId?"estimates":"customers",item.estimateId,item.type.startsWith("invoice_")?item.invoiceId:null,item.customerId);}}><span className={`notification-icon ${item.type}`}>{icon(item.type)}</span><span><strong>{item.title}</strong><p>{item.body}</p><small>{dateTime(item.createdAt)}</small></span></button>):<div className="notification-empty"><Bell/><strong>No notifications yet</strong><p>Customer views, approvals, and confirmed payments will appear here.</p></div>}</div>
  </PopoverContent></Popover>;
}

export function Dashboard({userName,metrics,estimates,environment="LIVE",localCustomersCandidate=false}:{localCustomersCandidate?:boolean;environment?:"LIVE"|"DOOMSDAY"|"STAGING"|"QA";userName:string;metrics:{estimates:number;openValue:number;outstanding:number};estimates:EstimateRow[]}) {
  const [tab, setTab] = useState("dashboard");
  const [interactive, setInteractive] = useState(false);
  useEffect(() => { setInteractive(true); }, []);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [globalQuery,setGlobalQuery]=useState("");
  const [theme,setTheme]=useState<"light"|"dark">("light");
  const [estimateRefreshKey,setEstimateRefreshKey]=useState(0);
  const [focusEstimateId,setFocusEstimateId]=useState<string|null>(null);
  const [focusCustomerId,setFocusCustomerId]=useState<string|null>(null);
  const [customerActivityFocus,setCustomerActivityFocus]=useState<{customerId:string;kind:"sign"|"review";request:number}|null>(null);
  const customerActivityRequest=useRef(0);
  const [focusCustomerSection,setFocusCustomerSection]=useState<"estimates"|"invoices"|"payments"|"notes">("estimates");
  const [focusCustomerRecord,setFocusCustomerRecord]=useState<CustomerRecordFocus|null>(null);
  const [pickupTaskDraft,setPickupTaskDraft]=useState<YardSignPickupDraft|null>(null);
  const [reviewTaskDraft,setReviewTaskDraft]=useState<ReviewCheckDraft|null>(null);
  const [focusBusinessTaskId,setFocusBusinessTaskId]=useState<string|null>(null);
  const [focusBusinessTaskHint,setFocusBusinessTaskHint]=useState<{customerId:string|null;activity:"sign"|"review"|null}>({customerId:null,activity:null});
  const [focusFollowupEstimateId,setFocusFollowupEstimateId]=useState<string|null>(null);
  const [customerRecordRequestKey,setCustomerRecordRequestKey]=useState(0);
  const [focusInvoiceId,setFocusInvoiceId]=useState<string|null>(null);
  const [estimateRows, setEstimateRows] = useState(estimates);
  const [liveMetrics, setLiveMetrics] = useState(metrics);
  const previousTab = useRef("dashboard");
  const currentTab = useRef("dashboard");
  useLayoutEffect(() => {
    if (tab === currentTab.current) return;
    previousTab.current = currentTab.current;
    currentTab.current = tab;
    // Reset the document after the new section commits, before it paints.
    // Same-section edits, retries, menus and modal updates keep their position.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [tab]);
  const goHome = () => { setTab("dashboard"); setMobileMenu(false); };
  const goBack = () => { const target = previousTab.current || "dashboard"; setTab(target); setMobileMenu(false); };
  const nav = useMemo(() => [
    ["dashboard", "Dashboard", House], ["contracts", "Contracts", PenLine], ["customers", "Customers", Users], ["estimates", "Estimates", ClipboardList], ["followups", "Follow-ups", Clock3], ["schedule", "Schedule", CalendarDays], ["invoices", "Invoices", Receipt], ["insights", "Insights", BarChart3], ["business", "Business", BriefcaseBusiness], ["payments", "Payments", CreditCard], ["settings", "Templates", Settings],
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
    let cancelled=false,generation=0;
    const refresh=()=>{
      if(document.visibilityState!=="visible")return;
      const request=++generation;
      void fetch("/api/dashboard-summary",{cache:"no-store"}).then(async(response)=>{
        if(!response.ok)return;
        const summary=await response.json() as {estimates:number;openValue:number;outstanding:number;recent?:EstimateRow[]};
        if(!cancelled&&request===generation){
          setLiveMetrics({estimates:Number(summary.estimates),openValue:Number(summary.openValue),outstanding:Number(summary.outstanding)});
          if(Array.isArray(summary.recent))setEstimateRows(summary.recent);
        }
      }).catch(()=>{});
    };
    refresh();window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    const timer=window.setInterval(refresh,60000);
    return()=>{cancelled=true;generation++;window.clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[tab,estimateRefreshKey]);
  useEffect(()=>{
    const url=new URL(window.location.href);
    const estimateId=url.searchParams.get("openEstimate"),customerId=url.searchParams.get("openCustomer"),invoiceId=url.searchParams.get("openInvoice");
    const section=url.searchParams.get("customerSection")==="invoices"?"invoices":"estimates";
    if(!estimateId&&!customerId&&!invoiceId)return;
    for(const key of ["openEstimate","openCustomer","openInvoice","customerSection"])url.searchParams.delete(key);
    window.history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
    const timer=window.setTimeout(()=>{
      setSearchQuery("");
      if(estimateId){setFocusEstimateId(estimateId);setEstimateRefreshKey(value=>value+1);setTab("estimates");}
      else if(customerId){setFocusCustomerId(customerId);setFocusCustomerSection(section);setTab("customers");}
      else if(invoiceId){setFocusInvoiceId(invoiceId);setTab("invoices");}
    },0);
    return()=>window.clearTimeout(timer);
  },[]);
  const openSearchResult=(row:SearchResult)=>{
    setSearchQuery("");setGlobalQuery("");setMobileMenu(false);
    setFocusCustomerRecord(null);
    if((row.kind==="payment"||row.kind==="note"||row.kind==="property")&&row.customerId){setFocusCustomerRecord({id:row.id,customerId:row.customerId,kind:row.kind});setCustomerRecordRequestKey(value=>value+1);setFocusCustomerSection(row.kind==="payment"?"payments":row.kind==="note"?"notes":"estimates");setFocusCustomerId(row.customerId);setTab("customers");}
    else if(row.kind==="customer"){setFocusCustomerSection("estimates");setFocusCustomerId(row.id);setTab("customers");}
    else if(row.kind==="invoice"){setFocusInvoiceId(row.id);setTab("invoices");}
    else{setFocusEstimateId(row.id);setEstimateRefreshKey(value=>value+1);setTab("estimates");}
  };
  const handleSaved = (estimate: EstimateRow) => {
    if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof Event==="function")window.dispatchEvent(new Event("fire:attention-saved"));
    setEstimateRows((current) => [estimate, ...current]);
    setLiveMetrics((current) => ({ estimates: current.estimates + 1, openValue: current.openValue + estimate.totalCents, outstanding: current.outstanding }));
  };
  return (
    <OwnerJobSnapshotsProvider key={environment}><main className="app-shell" data-app-ready={interactive}>
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand"><FireMark /><div><strong>FIRE</strong><small>Business App</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X /></button></div>
        <div className="mobile-menu-search"><GlobalSearch query={globalQuery} onQuery={setGlobalQuery} onSelect={openSearchResult} disabled={!interactive} active={mobileMenu} menu/></div>
        <nav>{nav.map(([id, label, Icon]) => <button key={id} disabled={!interactive} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setMobileMenu(false); }}><Icon /><span>{label}</span>{id === "estimates" && liveMetrics.estimates > 0 && <b>{liveMetrics.estimates}</b>}</button>)}</nav>
        <button type="button" disabled={!interactive} className="sidebar-foot" onClick={() => { setTab("owner-account"); setMobileMenu(false); }} aria-label="Open owner account"><div className="owner-avatar">FIRE</div><div><strong>First In Response Exteriors</strong><small>Owner · Account</small></div><ChevronRight /></button>
      </aside>
      <section className="main-area">
        <header className={`topbar `}><div className="mobile-brand"><FireMark small /><strong>FIRE</strong></div><div className="mobile-primary-actions"><button disabled={!interactive} className="mobile-back-button" onClick={goBack} aria-label="Back" title="Back"><ArrowLeft /></button><button disabled={!interactive} className={`mobile-home-button ${tab==="dashboard"?"active":""}`} onClick={goHome} aria-label="Home" title="Home"><House /></button><button disabled={!interactive} className="mobile-theme-button" onClick={toggleTheme} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`} title={`Switch to ${theme==="dark"?"light":"dark"} mode`}>{theme==="dark"?<Sun/>:<Moon/>}</button><button disabled={!interactive} className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu" title="Menu"><Menu /></button></div><GlobalSearch query={globalQuery} onQuery={setGlobalQuery} onSelect={openSearchResult} active={!mobileMenu} disabled={!interactive}/><div className="top-actions"><button disabled={!interactive} type="button" className="payments-quick-action" onClick={()=>setTab("payments")} aria-label="Record payments" title="Record payments"><span aria-hidden="true">$</span></button><StrideButton top/><NotificationBell onNavigate={(next,estimateId,invoiceId,customerId,taskId,customerActivity)=>{setSearchQuery("");setGlobalQuery("");setCustomerActivityFocus(customerId&&customerActivity?{customerId,kind:customerActivity,request:++customerActivityRequest.current}:null);if(taskId){setPickupTaskDraft(null);setReviewTaskDraft(null);setFocusBusinessTaskHint({customerId:customerId??null,activity:customerActivity??null});setFocusBusinessTaskId(taskId);setTab("business");}else if(invoiceId){setFocusInvoiceId(invoiceId);setTab("invoices");}else if(next==="followups"&&estimateId){setFocusFollowupEstimateId(estimateId);setTab("followups");}else if(estimateId){setFocusEstimateId(estimateId);setEstimateRefreshKey(value=>value+1);setTab("estimates");}else if(customerId){setFocusCustomerSection("estimates");setFocusCustomerId(customerId);setTab("customers");}else{if(next==="estimates")setEstimateRefreshKey(value=>value+1);setTab(next);}}}/><button disabled={!interactive} className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`} title={`Switch to ${theme==="dark"?"light":"dark"} mode`}>{theme==="dark"?<Sun/>:<Moon/>}<span>{theme==="dark"?"Light":"Dark"}</span></button><button disabled={!interactive} className="avatar-button" onClick={() => setTab("owner-account")} aria-label="Open owner account">FIRE</button></div></header>
        {process.env.NODE_ENV === "development" && localCustomersCandidate && <CandidateLayoutTrace/>}
        {!interactive && <p role="status" className="app-loading-status">Loading app…</p>}
        {tab === "customers" && localCustomersCandidate && <a className="brand-button" href="/development/local-customers">Offline Customers · synthetic development</a>}
        {tab === "dashboard" ? <DashboardView userName={userName} metrics={liveMetrics} estimates={estimateRows} onSaved={handleSaved} onNavigate={setTab} onOpenEstimate={id=>{setSearchQuery("");setGlobalQuery("");setFocusEstimateId(id);setEstimateRefreshKey(value=>value+1);setTab("estimates");}} onOpenCustomer={id=>{setSearchQuery("");setGlobalQuery("");setFocusCustomerId(id);setFocusCustomerSection("estimates");setTab("customers");}} onOpenCustomerActivity={(id,kind)=>{setSearchQuery("");setGlobalQuery("");setCustomerActivityFocus({customerId:id,kind,request:++customerActivityRequest.current});setFocusCustomerSection("estimates");setFocusCustomerId(id);setTab("customers");}} onOpenTask={id=>{setPickupTaskDraft(null);setReviewTaskDraft(null);setFocusBusinessTaskHint({customerId:null,activity:null});setFocusBusinessTaskId(id);setTab("business");}} /> : tab === "contracts" ? <ContractsView searchQuery={searchQuery}/> : tab === "customers" ? <CustomersView onEstimateSaved={handleSaved} searchQuery={searchQuery} focusCustomerId={focusCustomerId} focusSection={focusCustomerSection} focusRecord={focusCustomerRecord} recordRequestKey={customerRecordRequestKey} activityFocus={customerActivityFocus} onActivityFocusHandled={request=>setCustomerActivityFocus(current=>current?.request===request?null:current)} onRecordFocusHandled={id=>setFocusCustomerRecord(current=>current?.id===id?null:current)} onPreparePickupTask={draft=>{setReviewTaskDraft(null);setPickupTaskDraft(draft);setTab("business");}} onPrepareReviewTask={draft=>{setPickupTaskDraft(null);setReviewTaskDraft(draft);setTab("business");}} onFocusHandled={id=>setFocusCustomerId(current=>current===id?null:current)}/> : tab === "estimates" ? <EstimatesView key={estimateRefreshKey} onSaved={handleSaved} searchQuery={searchQuery} focusEstimateId={focusEstimateId} onFocusHandled={id=>setFocusEstimateId(current=>current===id?null:current)}/> : tab === "followups" ? <FollowUpsView searchQuery={searchQuery} focusEstimateId={focusFollowupEstimateId} onFocusHandled={id=>setFocusFollowupEstimateId(current=>current===id?null:current)} onOpenEstimate={id=>{setFocusFollowupEstimateId(null);setFocusEstimateId(id);setEstimateRefreshKey(value=>value+1);setTab("estimates");}} onOpenCustomer={id=>{setSearchQuery("");setGlobalQuery("");setFocusCustomerId(id);setFocusCustomerSection("estimates");setTab("customers");}}/> : tab === "schedule" ? <ScheduleView searchQuery={searchQuery}/> : tab === "invoices" ? <InvoicesView searchQuery={searchQuery} focusInvoiceId={focusInvoiceId} onFocusHandled={id=>setFocusInvoiceId(current=>current===id?null:current)}/> : tab === "insights" ? <InsightsView/> : tab === "business" ? <BusinessView initialPickupDraft={pickupTaskDraft} onPickupDraftConsumed={()=>setPickupTaskDraft(null)} initialReviewDraft={reviewTaskDraft} onReviewDraftConsumed={()=>setReviewTaskDraft(null)} focusTaskId={focusBusinessTaskId} focusTaskCustomerId={focusBusinessTaskHint.customerId} focusTaskActivity={focusBusinessTaskHint.activity} onFocusTaskHandled={()=>setFocusBusinessTaskId(null)} onOpenCustomer={id=>{setSearchQuery("");setGlobalQuery("");setCustomerActivityFocus(null);setFocusCustomerId(id);setFocusCustomerSection("estimates");setTab("customers");}} onOpenCustomerActivity={(id,kind)=>{setSearchQuery("");setGlobalQuery("");setCustomerActivityFocus({customerId:id,kind,request:++customerActivityRequest.current});setFocusCustomerId(id);setFocusCustomerSection("estimates");setTab("customers");}}/> : tab === "payments" ? <PaymentsView searchQuery={searchQuery} onOpenEstimate={id=>{setSearchQuery("");setGlobalQuery("");setFocusEstimateId(id);setEstimateRefreshKey(value=>value+1);setTab("estimates");}} onOpenCustomerReview={id=>{setSearchQuery("");setGlobalQuery("");setCustomerActivityFocus({customerId:id,kind:"review",request:++customerActivityRequest.current});setFocusCustomerId(id);setFocusCustomerSection("estimates");setTab("customers");}}/> : tab === "settings" ? <SettingsView/> : tab === "owner-account" ? <OwnerAccountView environment={environment} theme={theme} onToggleTheme={toggleTheme}/> : <EmptyView tab={tab} onSaved={handleSaved} />}
      </section>
      {mobileMenu && <button aria-label="Close menu overlay" className="menu-scrim" onClick={() => setMobileMenu(false)} />}
      <nav className="bottom-nav">{nav.filter(([id])=>["dashboard","contracts","customers","estimates","schedule"].includes(id)).map(([id, label, Icon]) => <button key={id} disabled={!interactive} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon /><span>{id==="dashboard"?"Home":label}</span></button>)}</nav>
    </main></OwnerJobSnapshotsProvider>
  );
}
