/** Source-only Gate7 capability: do not let UI reveal full backup controls
 * without BOTH the exact authenticated owner and the separately reviewed
 * feature flag. A feature being available is not proof of backup/recovery.
 * This module performs no D1 or network operations.
 */
const OWNER_EMAIL='kylebrooks8605@gmail.com';
export function completeRecordsOwnerReviewAllowed(user,flags){
 return user!==null&&typeof user==='object'&&!Array.isArray(user)&&
  typeof user.email==='string'&&user.email.toLowerCase()===OWNER_EMAIL&&
  flags!==null&&typeof flags==='object'&&
  flags.FIRE_COMPLETE_D1_RECORDS_REVIEW_CANDIDATE==='owner-review-only';
}
