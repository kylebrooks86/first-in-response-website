/** An interrupted ZIP restore may touch MANY customer galleries. Never
 * treat the gallery that launched the restore as its complete review scope.
 * Legacy restore receipts with a single customer also require full review. */
export const PHOTO_RESTORE_ALL_CUSTOMERS='restore-all-customers';
export const photoMutationScope=(kind,customerId)=>
 kind==='restore'?PHOTO_RESTORE_ALL_CUSTOMERS:customerId;
export const requiresAllCustomerPhotoReview=attempt=>attempt?.kind==='restore';
export const mayReviewPhotoMutation=(attempt,customerId)=>
 !attempt||requiresAllCustomerPhotoReview(attempt)||attempt.customerId===customerId;
