/** Synthetic QA fixture only. These values describe simulated checks, never real work.
 * Keep every completion invariant enforced by the runtime API; never fabricate a
 * walkthrough when a customer is absent. No customer-facing messages are sent.
 */
export function syntheticCompleteJobReport(estimateId,customerId,notes='Synthetic fixture: customer absent; simulated steps documented for local QA only.'){
 return {estimateId,customerId,complete:true,notes,checklist:{
  'Property condition documented':true,
  'Before photos captured':true,
  'Plants and fragile areas protected':true,
  'Service completed as quoted':true,
  'After photos captured':true,
  'Customer walkthrough completed':false,
  'Customer absent — completion documented for follow-up':true
 }};
}
