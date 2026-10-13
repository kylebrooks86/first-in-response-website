/** Server gate for local development only; never enables a production runtime. */
import { resolveLocalCustomerOwnerIdentity, type LocalCustomerDeployment } from './local-customer-owner-identity';
export function candidateCustomerAccess(owner: { userId: string; email: string } | null,
  deployment: LocalCustomerDeployment, mode: string | undefined, runtime: string | undefined) {
  if (runtime !== 'development' || mode !== 'synthetic-only') return null;
  const identity = resolveLocalCustomerOwnerIdentity(owner, deployment);
  return identity ? { accountId: `synthetic-${identity.accountId}`, targetId: `synthetic-${identity.targetId}` } : null;
}
