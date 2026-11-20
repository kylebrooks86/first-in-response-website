/** Consistent public payment visibility across shared estimate, invoice and pay links.
 * Source-only guard; the authoritative payment POST must enforce its own state.
 */
const payableStatuses = new Set(["approved", "scheduled", "completed"]);

export function isWithdrawnPublicEstimate(status) {
  return status === "declined" || status === "superseded";
}

export function canOfferManualPayment({status, acceptedAt, signedAt, billingVerified, balanceCents, reviewPending}) {
  return payableStatuses.has(status)
    && typeof acceptedAt === "string" && acceptedAt.trim().length > 0
    && typeof signedAt === "string" && signedAt.trim().length > 0
    && billingVerified === true
    && Number.isSafeInteger(balanceCents) && balanceCents > 0
    && reviewPending === false;
}
