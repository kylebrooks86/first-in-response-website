export declare const NEW_LIVE_CLEAN_START_FLAG: 'required';
export interface NewLiveFirstJobState {
 customers:number; estimates:number; numberedCustomers:number;
 numberedJobs:number; jobLinks:number; customerSequence:number; jobSequence:number;
 invalidCustomers:number; invalidJobLinks:number;
}
export declare function assertNewLiveFirstJobState(row:unknown):true;
export declare function verifyNewLiveFirstJobState(db:D1Database):Promise<true>;
