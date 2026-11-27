// Free-plan Worker code size guard for the exact STAGING beta module list.
// Cloudflare increased the uncompressed bundle limit to 64 MiB for all plans
// on September 4, 2026; the former 3 MiB compressed Free limit is obsolete.
// https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/
// Pure offline function: no network, credentials, uploads, deployment or disk writes.
// This checks only the bundle-size prerequisite, NOT startup, bindings or provider acceptance.
export const STAGING_FREE_WORKER_BUNDLE_MAX_BYTES = 64 * 1024 * 1024;

export function reviewStagingFreeWorkerBundleBudget(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw Error('STAGING_FREE_BUNDLE_STOP_SCOPE');
  let bytes = 0;
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.bytes) || row.bytes < 0)
      throw Error('STAGING_FREE_BUNDLE_STOP_LENGTH');
    if (row.bytes > STAGING_FREE_WORKER_BUNDLE_MAX_BYTES - bytes)
      throw Error('STAGING_FREE_BUNDLE_STOP_OVER_LIMIT');
    bytes += row.bytes;
  }
  return Object.freeze({
    moduleCount: rows.length,
    uncompressedModuleBytes: bytes,
    freeWorkerLimitBytes: STAGING_FREE_WORKER_BUNDLE_MAX_BYTES,
    sizePrerequisiteSatisfied: true,
    providerAcceptanceProven: false,
    startupValidated: false
  });
}
