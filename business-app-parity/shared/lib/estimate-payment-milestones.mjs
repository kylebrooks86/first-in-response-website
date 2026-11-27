/** Visual payment milestones from SAVED net paid cents, never from checkout intent.
 * This module does not query D1, Stripe, a browser, or alter a payment.
 * "Paid in full" means the stored paid amount exactly equals the CURRENT
 * saved estimate/invoice total, not that card settlement was independently checked.
 */
export function estimatePaymentMilestone(row) {
  if (!row || !['approved','scheduled','completed','paid'].includes(row.status)) return null;
  const exact = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  const billed = row.invoiceTotalCents == null ? row.totalCents : row.invoiceTotalCents;
  const deposit = row.depositCents;
  const paid = row.paidCents;
  if (![billed, deposit, paid, row.totalCents].every(exact) || billed <= 0 ||
      deposit > row.totalCents) return null;
  // Payment reconciliation or a refund can change the displayed net balance.
  // Avoid a settled-looking badge while the saved record flags unresolved work.
  for (const flag of ['paymentOverageOpen','pendingRefundCount','openCheckoutCount']) {
    const count = row[flag];
    if (count != null && (!exact(count) || count > 0)) return null;
  }
  // Overpayments require separate review; never collapse them into "paid in full".
  if (paid === billed) return 'paid-in-full';
  if (deposit > 0 && paid >= deposit && paid < billed) return 'deposit-paid';
  return null;
}
