import { ArrowUpRight, Star } from "lucide-react";
import { FIRE_CUSTOMER_REVIEW_URL } from "../lib/customer-review-invite.mjs";

/** Public, optional, customer-initiated invitation. This never sends or logs a request. */
export function CustomerReviewInvitation() {
  return <aside className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900" aria-label="Share your experience">
    <div className="min-w-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-base font-bold">How did we do?</h2>
          <span className="inline-flex items-center gap-0.5" aria-hidden="true">
            {Array.from({length:5},(_,index)=><Star key={index} className="h-4 w-4 fill-none text-slate-400"/>)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">Thank you for choosing First In Response Exteriors. Would you share your honest experience? Your feedback helps our firefighter-owned small business.</p>
        <a href={FIRE_CUSTOMER_REVIEW_URL} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
          Leave a review <ArrowUpRight className="h-4 w-4" aria-hidden="true"/>
        </a>
        <p className="mt-2 text-xs text-slate-500">Optional · Opens our review page in a new tab.</p>
        <p className="mt-1 break-all text-xs text-slate-600">Or visit <a href={FIRE_CUSTOMER_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-slate-400 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">{FIRE_CUSTOMER_REVIEW_URL.replace(/^https?:\/\//,"")}</a></p>
      </div>
    </div>
  </aside>;
}
