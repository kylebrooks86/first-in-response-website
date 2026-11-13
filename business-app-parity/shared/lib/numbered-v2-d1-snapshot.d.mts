/** Core records capture only; NOT a full recovery artifact or hosted test receipt. */
export declare function captureNumberedCoreV2ReadOnly(db:D1Database):Promise<{
 format:'fire-numbered-core-records-snapshot';
 version:2;
 allTablesComplete:true;
 truncated:false;
 tables:Record<string,Array<Record<string,string|number|null>>>;
 rowCounts:Record<string,number>;
 highWater:{customer:number;job:number};
}>;
