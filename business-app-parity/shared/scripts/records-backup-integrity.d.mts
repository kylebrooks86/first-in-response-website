export function validateRecordIdentities(tables:Record<string,unknown>):string|null;
export function validateBackupRelationships(tables:Record<string,unknown>):string|null;
export function validateRefundIntegrity(tables:Record<string,unknown>):string|null;
export function assertBackupIntegrity(tables:Record<string,unknown>):void;
