/** Strict private owner-only full D1 source reader; never a saved backup. */
import type {CompleteD1RecordsReview} from './protected-complete-d1-records.mjs';
export declare const MAX_COMPLETE_D1_REVIEW_HTTP_BYTES:number;
export declare function readOwnerCompleteD1ReviewResponse(response:Response):Promise<CompleteD1RecordsReview>;
