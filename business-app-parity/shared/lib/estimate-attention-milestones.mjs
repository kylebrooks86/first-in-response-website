/** Action-needed display flags only, derived from existing saved review counts.
 * An unresolved change request or financial exception is NOT a lifecycle status.
 * No D1 reads, writes, network access or payment actions.
 */
export function estimateAttentionMilestones(estimate) {
  if (!estimate || typeof estimate !== 'object') return [];
  const validCount = value => typeof value === 'number' &&
    Number.isSafeInteger(value) && value > 0;
  const flags = [];
  if (validCount(estimate.pendingChangeCount)) flags.push('changes-requested');
  if (validCount(estimate.pendingRefundCount) ||
      validCount(estimate.paymentOverageOpen)) flags.push('payment-review');
  return flags;
}
