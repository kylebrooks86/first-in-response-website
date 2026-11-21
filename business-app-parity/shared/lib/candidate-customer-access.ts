/** Synthetic local-customer vault gate. All ordinary production targets remain disabled.
 * The hosted QA exception requires the exact, isolated synthetic QA provenance.
 */
import { resolveLocalCustomerOwnerIdentity, type LocalCustomerDeployment } from './local-customer-owner-identity';
export type HostedQAScope = { fireEnv?: string; syntheticOnly?: string; siteOrigin?: string };
export function candidateCustomerAccess(owner: { userId: string; email: string } | null,
  deployment: LocalCustomerDeployment, mode: string | undefined, runtime: string | undefined,
  qaScope?: HostedQAScope) {
  const hostedQA = deployment === 'qa' && runtime === 'production'
    && qaScope?.fireEnv === 'synthetic-qa' && qaScope?.syntheticOnly === 'enabled'
    && qaScope?.siteOrigin === 'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev';
  if (mode !== 'synthetic-only' || (runtime !== 'development' && !hostedQA)) return null;
  const identity = resolveLocalCustomerOwnerIdentity(owner, deployment);
  return identity ? { accountId: `synthetic-${identity.accountId}`, targetId: `synthetic-${identity.targetId}` } : null;
}
