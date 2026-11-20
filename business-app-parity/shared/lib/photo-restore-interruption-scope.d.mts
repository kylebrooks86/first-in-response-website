export type PhotoRestoreScopeAttempt={kind:'add'|'delete'|'restore';customerId:string};
export const PHOTO_RESTORE_ALL_CUSTOMERS:string;
export function photoMutationScope(kind:'add'|'delete'|'restore',customerId:string):string;
export function requiresAllCustomerPhotoReview(attempt:PhotoRestoreScopeAttempt|null|undefined):boolean;
export function mayReviewPhotoMutation(attempt:PhotoRestoreScopeAttempt|null|undefined,customerId:string):boolean;
