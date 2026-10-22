/** Validate a persisted new-estimate receipt against the exact values the owner reviewed.
 * A successful HTTP response alone cannot certify prices or the 50% deposit;
 * any missing, rounded, or mismatching amount is an uncertain save (never retry blindly).
 */
export type ReviewedEstimateTotals = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  depositCents: number;
  bundleDiscountCents: number;
};
export function matchesReviewedEstimateReceipt(receipt: unknown, expected: ReviewedEstimateTotals): boolean {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  const fields: (keyof ReviewedEstimateTotals)[] = [
    'subtotalCents','discountCents','totalCents','depositCents','bundleDiscountCents'
  ];
  const saved = receipt as Record<string,unknown>;
  return fields.every(field =>
    Number.isSafeInteger(expected[field]) && expected[field] >= 0 &&
    typeof saved[field] === 'number' &&
    Number.isSafeInteger(saved[field]) && saved[field] === expected[field]
  );
}
