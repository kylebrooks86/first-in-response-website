/** Server-side mapping only; call after the existing owner authentication guard. */
import type { LocalCustomerIdentity } from './synthetic-customer-controller';
export type LocalCustomerDeployment = 'live' | 'doomsday' | 'staging';
const OWNER_EMAIL = 'kylebrooks8605@gmail.com';
const TARGETS = { live: 'fire-live-v1', doomsday: 'fire-doomsday-v1', staging: 'fire-refund-staging-v1' } as const;

/** IDs are stable configuration, never derived from browser URLs or gateway subject IDs. */
export function resolveLocalCustomerOwnerIdentity(
  authenticatedOwner: { userId: string; email: string } | null,
  deployment: LocalCustomerDeployment,
): LocalCustomerIdentity | null {
  if (typeof window !== 'undefined') throw new Error('Owner identity mapping requires server execution.');
  if (!authenticatedOwner || typeof authenticatedOwner.email !== 'string'
    || authenticatedOwner.email.toLowerCase() !== OWNER_EMAIL
    || typeof authenticatedOwner.userId !== 'string' || !authenticatedOwner.userId.trim()
    || authenticatedOwner.userId.length > 4096
    || !Object.hasOwn(TARGETS, deployment)) return null;
  // The email is the existing owner authorization allowlist, not the vault namespace.
  // Gateway and independent-cookie owner subjects resolve to the same business account.
  return { accountId: 'fire-owner-account-v1', targetId: TARGETS[deployment] };
}
