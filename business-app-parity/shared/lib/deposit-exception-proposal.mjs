/**
 * SOURCE-ONLY, preview-only owner deposit exception calculator.
 *
 * This module does NOT update D1, change a signed agreement, authorize
 * scheduling, record money, or enable any production/QA feature. The future
 * authenticated, transactional writer must independently re-check every
 * expected value and hold while inserting an append-only audit entry.
 */
const MAX_CENTS = Number.MAX_SAFE_INTEGER;
const MODES = new Set(["standard", "waive", "percentage", "fixed", "schedule-before-deposit", "restore-standard"]);
const OWNER_EMAIL = "kylebrooks8605@gmail.com";

function deny(message) { throw new Error(message); }
function cents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) deny("Invalid " + label + "; no exception was applied.");
  return value;
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) deny("Invalid " + label + "; review this estimate.");
  return value;
}
function isStringOrNull(value) { return value === null || typeof value === "string"; }

/**
 * @param {{
 *   current: {id:string, status:string, totalCents:number, depositCents:number,
 *     paidCents:number, signedAt:string|null, acceptedAt:string|null,
 *     contractVersion:string|null, invalidPaymentCount:number,
 *     pendingRefundCount:number, openCheckoutCount:number,
 *     billingExceptionCount:number, invoiceCount:number},
 *   request: {mode:string, confirmed:boolean, expectedStatus:string,
 *     expectedTotalCents:number, expectedDepositCents:number,
 *     expectedPaidCents:number, expectedSignedAt:string|null,
 *     expectedContractVersion:string|null, percentBasisPoints?:number,
 *     fixedCents?:number, reason?:string},
 *   verifiedOwnerEmail:string
 * }} input
 */
export function previewOwnerDepositException(input) {
  const {current, request, verifiedOwnerEmail} = input ?? {};
  // This identity is supplied by the server's authenticated session, NEVER
  // accepted as a field in request from the client.
  if (typeof verifiedOwnerEmail !== "string" || verifiedOwnerEmail.toLowerCase() !== OWNER_EMAIL)
    deny("Authenticated owner permission is required.");
  if (!current || !request || typeof current.id !== "string" || !current.id.trim())
    deny("An existing estimate must be verified.");
  if (request.confirmed !== true) deny("Explicit owner confirmation is required.");
  if (!MODES.has(request.mode)) deny("Unsupported deposit exception mode.");
  const allowed = new Set(["mode","confirmed","expectedStatus","expectedTotalCents","expectedDepositCents","expectedPaidCents","expectedSignedAt","expectedContractVersion","percentBasisPoints","fixedCents","reason"]);
  if (Object.keys(request).some(key => !allowed.has(key))) deny("Unsupported exception request field.");
  const total = cents(current.totalCents, "final discounted total");
  const prior = cents(current.depositCents, "stored deposit");
  const paid = cents(current.paidCents, "net principal receipts");
  if (prior > total || paid > total) deny("Inconsistent original amounts; reconcile records first.");
  if (!["draft","sent","approved","scheduled"].includes(current.status)) deny("This job cannot have deposit terms changed.");
  if (!isStringOrNull(current.signedAt) || !isStringOrNull(current.acceptedAt) || !isStringOrNull(current.contractVersion))
    deny("Agreement metadata must be verified.");
  for (const key of ["invalidPaymentCount","pendingRefundCount","openCheckoutCount","billingExceptionCount","invoiceCount"])
    count(current[key], key);
  if (current.invalidPaymentCount || current.pendingRefundCount || current.openCheckoutCount || current.billingExceptionCount || current.invoiceCount)
    deny("Active billing, checkout, refund or data exception requires reconciliation first.");
  if (request.expectedStatus !== current.status || request.expectedTotalCents !== total ||
      request.expectedDepositCents !== prior || request.expectedPaidCents !== paid ||
      request.expectedSignedAt !== current.signedAt || request.expectedContractVersion !== current.contractVersion)
    deny("Estimate, payment or agreement changed; refresh before confirming.");
  if (request.reason !== undefined && (typeof request.reason !== "string" || request.reason.length > 500))
    deny("Reason must be at most 500 characters.");
  const reason = (request.reason ?? "").trim();
  if ((request.mode === "percentage") !== Object.hasOwn(request,"percentBasisPoints") ||
      (request.mode === "fixed") !== Object.hasOwn(request,"fixedCents"))
    deny("Use only the amount input required by this exception mode.");
  const standard = Number((BigInt(total) + 1n) / 2n);
  let next = standard, scheduleBeforeCollection = false;
  if (request.mode === "waive") next = 0;
  if (request.mode === "percentage") {
    const basis = request.percentBasisPoints;
    if (!Number.isInteger(basis) || basis < 0 || basis > 10000)
      deny("Custom percentage must be between 0 and 100%, in whole basis points.");
    next = Number((BigInt(total) * BigInt(basis) + 5000n) / 10000n);
  }
  if (request.mode === "fixed") next = cents(request.fixedCents, "custom deposit dollars");
  if (request.mode === "schedule-before-deposit") {
    next = prior; // Deferred collection is NOT a waiver.
    scheduleBeforeCollection = true;
  }
  if (next > total) deny("Deposit cannot exceed the approved total.");
  const termsChanged = next !== prior || scheduleBeforeCollection;
  const hasSignedAgreement = Boolean(current.signedAt && current.acceptedAt);
  return Object.freeze({
    estimateId: current.id,
    mode: request.mode,
    actorEmail: verifiedOwnerEmail.toLowerCase(),
    reason,
    originalTotalCents: total,
    originalDepositCents: prior,
    proposedDepositCents: next,
    standardDepositCents: standard,
    existingNetPrincipalPaidCents: paid,
    remainingDepositCents: Math.max(0,next-paid),
    remainingJobPrincipalCents: total-paid,
    scheduleBeforeCollection,
    termsChanged,
    // An accepted agreement must never silently change. Integration must
    // version/reissue changed terms, obtain customer acceptance when required,
    // and re-evaluate terms atomically before any scheduling write.
    requiresSignedAgreementRevision: hasSignedAgreement && termsChanged,
    signedAtAtReview: current.signedAt,
    contractVersionAtReview: current.contractVersion,
    // Preview cannot itself grant a deposit override or schedule a job.
    previewOnly: true,
    canSchedule: false,
    canPersist: false
  });
}
