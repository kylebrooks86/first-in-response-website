export function propertyBackupManifest(properties:Record<string,unknown>[],links:Record<string,unknown>[]):{version:number;propertyIds:unknown[];estimateIds:unknown[]};
export function propertyBackupError(payload:Record<string,unknown>,tables:Record<string,unknown>):string|null;
export function hasPropertyBackup(payload:Record<string,unknown>,tables:Record<string,unknown>):boolean;
