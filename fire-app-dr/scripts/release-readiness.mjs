import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (rel) => readFile(new URL(rel, root), "utf8");
const checks = [];
const pass = (name, detail="") => checks.push({ok:true,name,detail});
const fail = (name, detail="") => checks.push({ok:false,name,detail});
const expect = (condition,name,detail="") => condition ? pass(name,detail) : fail(name,detail);

const [services, templates, estimatesApi, estimatePatch, checkout, webhook, invoicesApi, invoiceEditApi, paymentsApi, expensesApi, dashboard, home, auth, paymentMethods, estimatePortal, invoicePortal, paymentPortal, backupApi, restoreScript, validateBackupScript, notificationsApi, checkoutSessionMigration, customersApi, dashboardSummaryApi, customerMessagesApi, oneInvoiceMigration, publicAcceptApi, jobReportsApi, customerNotesApi, tasksApi, changeRequestApi, restorePhotoScript] = await Promise.all([
  read("lib/fire-services.ts"), read("lib/fire-templates.ts"), read("app/api/estimates/route.ts"),
  read("app/api/estimates/[id]/route.ts"), read("app/api/payments/checkout/route.ts"), read("app/api/payments/webhook/route.ts"),
  read("app/api/invoices/route.ts"), read("app/api/invoices/[id]/route.ts"), read("app/api/payments/route.ts"), read("app/api/expenses/route.ts"),
  read("app/dashboard.tsx"), read("app/page.tsx"), read("app/owner-auth.ts"),
  read("lib/payment-methods.ts"), read("app/estimate/[token]/page.tsx"), read("app/invoice/[token]/page.tsx"), read("app/pay/[id]/page.tsx"),
  read("app/api/backup/route.ts"), read("scripts/restore-records-backup.mjs"), read("scripts/validate-records-backup.mjs"), read("app/api/notifications/route.ts"), read("drizzle/0015_single_open_checkout.sql"), read("app/api/customers/route.ts"), read("app/api/dashboard-summary/route.ts"), read("app/api/customer-messages/route.ts"), read("drizzle/0017_one_invoice_per_estimate.sql"), read("app/api/public/estimates/[token]/accept/route.ts"), read("app/api/job-reports/route.ts"), read("app/api/customer-notes/route.ts"), read("app/api/tasks/route.ts"), read("app/api/public/estimates/[token]/change-request/route.ts"), read("scripts/restore-photo-archive.mjs")
]);

const refundApi=await read("app/api/payments/refund/route.ts");
const refundMigration=await read("drizzle/0018_payment_refunds.sql");
const refundLedgerMigration=await read("drizzle/0019_refund_ledger_unique.sql");
const lifecycleNotificationMigration=await read("drizzle/0020_notification_lifecycle_unique.sql");
const schema=await read("db/schema.ts");
const currentVersion=JSON.parse(await read("CURRENT_VERSION.json"));
const currentSharedManifest=JSON.parse(await read("SHARED_CORE_MANIFEST.json"));
const currentParityAudit=await read("CURRENT_PARITY_AUDIT.md");
const parityEvidence=JSON.parse(await read("PARITY_EVIDENCE_MANIFEST.json"));
const strictParityMatrix=await read("STRICT_PARITY_MATRIX.md");
const parityFixture=JSON.parse(await read("fixtures/strict-parity-records.json"));
const fixtureValidator=await read("scripts/validate-strict-parity-fixture.mjs");
const fixtureCleanup=await read("scripts/remove-strict-parity-fixture.mjs");
const packageValidator=await read("scripts/validate-release-package.mjs");
const releaseStatus=await read("RELEASE_STATUS.md");
const strictParityGate=await read("scripts/strict-parity-gate.mjs");
const releasePackageValidator=await read("scripts/validate-release-package.mjs");
const evidenceRegister=await read("scripts/register-parity-evidence.mjs");
const captureQueueScript=await read("scripts/build-parity-capture-queue.mjs");
const captureQueue=await read("PARITY_CAPTURE_QUEUE.md");
const independentDeployment=await read("INDEPENDENT_DEPLOYMENT.md");
const evidenceIntakeGuide=await read("EVIDENCE_INTAKE_GUIDE.md");
const evidenceCompare=await read("scripts/compare-parity-evidence.mjs");
const legacyEvidenceIntake=await read("scripts/parity-evidence-intake.mjs");
const parityRunbook=await read("PARITY_CAPTURE_RUNBOOK.md");
const evidenceFileVerifier=await read("scripts/verify-parity-evidence-files.mjs");
const independentPreflight=await read("scripts/preflight-independent.mjs");
const releaseEvidenceSeal=JSON.parse(await read("RELEASE_EVIDENCE_SEAL.json"));
const buildEvidenceSeal=await read("scripts/build-release-evidence-seal.mjs");
const validateEvidenceSeal=await read("scripts/validate-release-evidence-seal.mjs");
const releasePackagePolicy=JSON.parse(await read("RELEASE_PACKAGE_POLICY.json"));
const releasePackageBuilder=await read("scripts/build-release-package.mjs");
const parityProgressScript=await read("scripts/build-parity-progress.mjs");
const parityProgress=JSON.parse(await read("PARITY_PROGRESS.json"));
const parityComparisonQueue=await read("PARITY_COMPARISON_QUEUE.md");
const currentDocsValidator=await read("scripts/validate-current-recovery-docs.mjs");
const currentReadme=await read("README.md");
const currentGoNoGo=await read("GO_NO_GO.md");
const currentSecurityStatus=await read("SECURITY_AND_RECOVERY_STATUS.md");
const currentStagingAcceptance=await read("STAGING_ACCEPTANCE_TEST.md");

expect(currentVersion.fire_release==="v138" && currentVersion.package_version==="1.0.0-rc.138" && currentVersion.strict_parity_status==="NOT_YET_FULLY_VERIFIED", "Current-version governance matches release", "top-level recovery metadata identifies the current v138 package without claiming full parity");

expect(parityEvidence.fire_release==="v138" && parityEvidence.entry_count===parityEvidence.entries.length && parityEvidence.entries.some((entry)=>entry.id==="owner-app-refund-payment-workflow") && parityEvidence.entries.some((entry)=>entry.id==="customer-facing-ap-refund-processing-state"), "Parity evidence ledger is current and refund-aware", "the evidence manifest matches v138 and explicitly tracks the newer owner/customer refund states as parity blockers");

expect(strictParityMatrix.startsWith("# FIRE App v138") && strictParityMatrix.includes("Refund payment modal / payment-level refund workflow") && strictParityMatrix.includes("Customer refund-processing state"), "Strict parity matrix is current and refund-aware", "the current release matrix includes refund UI states instead of relying on pre-refund-era parity coverage");

expect(Array.isArray(parityFixture.tables?.payment_refunds) && parityFixture.tables.payment_refunds.some((row)=>row.status==="succeeded") && parityFixture.tables.payment_refunds.some((row)=>row.status==="pending") && parityFixture.tables.payments.some((row)=>String(row.provider_id||"").startsWith("refund:")), "Disposable parity fixture covers refund lifecycle states", "isolated staging can render both successful-refund/reopened-balance and refund-processing hold states");

expect(fixtureValidator.includes("'payment_refunds'") && fixtureValidator.includes("Fixture is missing a succeeded refund state.") && fixtureCleanup.includes("'payment_refunds'") && fixtureCleanup.includes("'payment_checkout_sessions'") && fixtureCleanup.includes("'invoice_revisions'"), "Parity fixture validation and cleanup cover current tables", "loading the newer refund/checkout/revision fixture states cannot leave parity-only records behind after capture");

expect(packageValidator.includes("'CURRENT_VERSION.json'") && packageValidator.includes("'CURRENT_PARITY_AUDIT.md'") && packageValidator.includes("'UNIFIED_RELEASE_PACKAGE.json'") && packageValidator.includes("'LIVE_MASTER_PARITY_CHECKLIST.md'"), "Release package requires current governance assets", "a recovery ZIP is incomplete unless it carries authoritative current-version, parity-audit, manifest, and capture-checklist files");

expect(releaseStatus.includes("Current release: **v138") && !releaseStatus.includes("Current release: **v57"), "Package-level release status is no longer stale", "opening the recovery ZIP now shows the actual current release rather than obsolete v57 governance metadata");

expect(currentParityAudit.includes("NOT_YET_FULLY_VERIFIED") && currentParityAudit.includes("LIVE evidence captured: **11/32**") && currentParityAudit.includes("Independent evidence captured: **0/32**") && currentParityAudit.includes("Owner Refund payment modal/workflow") && currentParityAudit.includes("Customer-facing Refund processing state"), "Current parity audit matches the real evidence counts", "governance reports 11/32 LIVE and 0/32 independent evidence while preserving unresolved refund blockers and never implying capture that does not exist");

expect(parityEvidence.fire_release==="v138" && parityEvidence.evidence_hash_algorithm==="sha256" && Number(parityEvidence.evidence_file_count)===12, "Parity evidence manifest binds captured files to SHA256", "the current evidence ledger records the hash algorithm and exact number of captured evidence files");

expect(parityEvidence.entries.flatMap((entry)=>entry.evidence||[]).every((item)=>/^[a-f0-9]{64}$/.test(String(item.sha256||"")) && Number.isSafeInteger(Number(item.bytes)) && Number(item.bytes)>0), "Captured parity evidence has hash and byte-size metadata", "every existing LIVE evidence artifact carries a deterministic SHA256 and size for tamper/missing-file detection");

expect(strictParityGate.includes("Parity checklist/evidence IDs disagree") && strictParityGate.includes("hash mismatch") && strictParityGate.includes("byte-size mismatch") && strictParityGate.includes("claims independent CAPTURED without an independent evidence file"), "Strict parity gate verifies evidence identity and bytes", "FULL_IDENTICAL cannot be justified by stale IDs, missing screenshots, incorrect side/status claims, or altered evidence bytes");

expect(strictParityGate.includes("without reciprocal shared-evidence justification") && strictParityGate.includes("shared_reason") && strictParityGate.includes("Parity checklist contains duplicate IDs"), "Strict parity gate controls shared evidence ownership and checklist IDs", "one screenshot can support multiple parity entries only when both entries explicitly and reciprocally declare the shared evidence with a written justification; checklist IDs remain unique");

expect(releasePackageValidator.includes("parity evidence hash mismatch") && releasePackageValidator.includes("missing parity evidence file") && releasePackageValidator.includes("evidence count mismatch"), "Release ZIP validator verifies embedded parity evidence", "an archive cannot pass completeness if evidence referenced by the manifest is absent, altered, or count-inconsistent");

expect(evidenceRegister.includes("DRY RUN ONLY") && evidenceRegister.includes("--apply") && evidenceRegister.includes("crypto.createHash(\"sha256\")") && evidenceRegister.includes('entry.comparison_status="PENDING"') && evidenceRegister.includes("delete entry.comparison"), "Parity evidence registration is dry-run-first and hash-bound", "capture intake computes evidence hashes, requires explicit apply, and always invalidates any prior comparison when evidence is registered or replaced");

expect(evidenceRegister.includes("Unknown parity evidence id") && evidenceRegister.includes("Unsupported evidence file type") && evidenceRegister.includes("evidence/${side}/${safeId}${ext}"), "Parity evidence registration validates state and file type", "screenshots are attached only to known parity states and copied into deterministic side/state paths");

expect(captureQueueScript.includes("Independent capture — do these first") && captureQueueScript.includes("LIVE capture still needed") && captureQueue.includes("Independent screenshots still needed: **32**") && captureQueue.includes("LIVE screenshots still needed: **21**"), "Parity capture queue is generated from missing evidence sides", "the package now carries a concrete current worklist instead of relying on manual checklist interpretation");

expect(independentDeployment.includes("release candidate v138") && independentDeployment.includes("npm run parity:evidence:register") && independentDeployment.includes("npm run parity:capture:queue"), "Independent deployment runbook uses current capture workflow", "the staging handoff no longer points at obsolete v26 instructions and includes the exact evidence-registration sequence");

expect(evidenceIntakeGuide.startsWith("# FIRE App v138") && evidenceIntakeGuide.includes("A screenshot being present is not the same as a verified match") && evidenceIntakeGuide.includes("parity:evidence:compare"), "Evidence intake guide prevents premature parity claims", "capturing/registering both sides is explicitly separated from the later hash-bound comparison/verification decision");

expect(legacyEvidenceIntake.includes("legacy parity intake command is disabled") && legacyEvidenceIntake.includes("parity:evidence:compare"), "Legacy label-based parity intake is disabled", "the old combined evidence/verdict command cannot bypass file hashing or hash-bound comparison");

expect(evidenceCompare.includes("both LIVE and independent evidence must be registered first") && evidenceCompare.includes("crypto.createHash(\"sha256\")") && evidenceCompare.includes("DRY RUN ONLY") && evidenceCompare.includes("notes.length<20"), "Parity comparison is two-sided, hash-bound, and dry-run-first", "a comparison verdict requires both real registered files, fresh hash verification, meaningful notes, and explicit apply");

expect(evidenceRegister.includes('entry.comparison_status="PENDING"') && evidenceRegister.includes("delete entry.comparison"), "Evidence replacement invalidates prior comparison", "registering or replacing either side forces a fresh comparison instead of carrying forward a stale VERIFIED_IDENTICAL result");

expect(strictParityGate.includes("comparison hashes no longer match the registered evidence") && strictParityGate.includes("comparison files no longer match the registered evidence") && strictParityGate.includes("comparison notes are missing or too short"), "Strict parity gate rejects stale/unsupported comparison records", "verified or mismatch states remain valid only while their exact file paths/hashes and documented comparison basis still match current evidence");

expect(evidenceFileVerifier.includes("Evidence SHA256 mismatch") && evidenceFileVerifier.includes("Evidence byte-size mismatch") && evidenceFileVerifier.includes("Evidence count mismatch"), "Standalone evidence-file verifier checks bytes and count", "the evidence-file command no longer treats file existence alone as sufficient proof integrity");

expect(parityRunbook.includes("32 required parity states") && parityRunbook.includes("successful partial refund") && parityRunbook.includes("pending refund") && !parityRunbook.includes("29 unresolved parity rows"), "Parity capture runbook is current and refund-aware", "capture guidance no longer reports the obsolete 29-state count and explicitly covers current refund lifecycle states");

expect(independentPreflight.includes('"scripts/register-parity-evidence.mjs"') && independentPreflight.includes('"scripts/compare-parity-evidence.mjs"') && independentPreflight.includes('"parity:evidence:compare"'), "Independent preflight requires proof tooling", "a staging recovery package cannot pass preflight without the current registration, comparison, and capture workflow");

expect(releasePackageValidator.includes("'PARITY_CAPTURE_QUEUE.md'") && releasePackageValidator.includes("'scripts/register-parity-evidence.mjs'") && releasePackageValidator.includes("'scripts/compare-parity-evidence.mjs'"), "Release ZIP requires current parity workflow assets", "a distributable recovery package cannot omit the current queue or proof commands");

expect(evidenceRegister.includes("--source-label") && evidenceRegister.includes("source_environment:side") && evidenceRegister.includes("registered_at:registeredAt"), "Evidence registration records deployment/session provenance", "new parity evidence must carry an explicit source label, side, and registration time in addition to its file hash and size");

expect(evidenceCompare.includes("live_registered_at:live.registered_at") && evidenceCompare.includes("independent_registered_at:independent.registered_at") && evidenceCompare.includes("live_source_label:live.source_label") && evidenceCompare.includes("independent_source_label:independent.source_label"), "Comparison records preserve evidence provenance", "saved verdicts record which deployment/session labels and registration timestamps were actually compared");

expect(strictParityGate.includes("comparison predates the evidence registration it claims to compare") && strictParityGate.includes("comparison source labels no longer match current evidence") && strictParityGate.includes("comparison registration timestamps no longer match current evidence"), "Strict parity enforces comparison chronology and provenance freshness", "old verdicts cannot survive newer evidence registration or silently refer to different capture sessions");

expect(parityProgressScript.includes("PARITY_PROGRESS.json") && parityProgressScript.includes("PARITY_COMPARISON_QUEUE.md") && parityProgress.total_states===32 && parityProgress.live_captured===11 && parityProgress.independent_captured===0 && parityProgress.pending===32, "Parity progress is machine-generated from the evidence ledger", "current progress counts are explicit and comparison work is separated from capture work");

expect(parityComparisonQueue.includes("Both sides captured: **0/32**") && parityComparisonQueue.includes("Ready for comparison: **0**"), "Comparison queue contains only truly comparison-ready states", "the package correctly shows no comparison-ready states before independent rendered evidence exists");

expect(independentPreflight.includes('"scripts/build-parity-progress.mjs"') && independentPreflight.includes('"PARITY_COMPARISON_QUEUE.md"') && independentPreflight.includes('"PARITY_PROGRESS.json"') && independentPreflight.includes('"parity:progress"'), "Independent preflight requires parity progress tooling", "the staging package cannot pass preflight without machine-readable parity progress and the comparison queue");

expect(releasePackageValidator.includes("'PARITY_COMPARISON_QUEUE.md'") && releasePackageValidator.includes("'PARITY_PROGRESS.json'") && releasePackageValidator.includes("'scripts/build-parity-progress.mjs'"), "Release ZIP requires parity progress artifacts", "distributed recovery packages carry the current machine-readable progress and comparison worklist");

expect(evidenceRegister.includes("function imageDimensions") && evidenceRegister.includes("pixel_width:dimensions?.width??null") && evidenceRegister.includes("pixel_height:dimensions?.height??null"), "Evidence registration records objective image dimensions", "new PNG/JPEG/VP8X WebP evidence carries pixel dimensions computed from the evidence bytes rather than operator-entered metadata");

expect(evidenceCompare.includes("Cannot mark ${id} identical: LIVE and independent screenshot dimensions differ") && evidenceCompare.includes("live_pixel_width:liveVerified.width") && evidenceCompare.includes("independent_pixel_width:independentVerified.width"), "Parity comparison blocks different-size identical verdicts", "visual evidence with different pixel dimensions must be recorded as a mismatch or recaptured at matching size");

expect(strictParityGate.includes("pixel dimensions no longer match registered metadata") && strictParityGate.includes("cannot be VERIFIED_IDENTICAL when screenshot dimensions differ") && strictParityGate.includes("comparison pixel dimensions no longer match current evidence"), "Strict parity revalidates visual dimensions and comparison freshness", "dimension metadata cannot be edited independently of the bytes and a stale same-size claim cannot survive changed evidence");

expect(evidenceFileVerifier.includes("Evidence pixel-dimension mismatch"), "Standalone evidence verifier validates image dimensions", "evidence-file verification covers objective image geometry in addition to hash and byte size");

expect(evidenceRegister.includes("--device-class") && evidenceRegister.includes("--orientation") && evidenceRegister.includes("--viewport-width") && evidenceRegister.includes("--viewport-height") && evidenceRegister.includes("--pixel-ratio"), "Evidence registration requires complete capture context", "new parity evidence cannot be registered without device class, orientation, viewport size, and pixel ratio");

expect(evidenceRegister.includes("device_class:deviceClass") && evidenceRegister.includes("viewport_width:viewportWidth") && evidenceRegister.includes("pixel_ratio:pixelRatio"), "Evidence records persist capture profile", "rendering context is stored with the evidence rather than remaining an undocumented operator assumption");

expect(evidenceCompare.includes("LIVE and independent capture profiles differ") && evidenceCompare.includes("live_capture_profile") && evidenceCompare.includes("independent_capture_profile"), "Parity comparison is capture-context aware", "an identical verdict is blocked when device/orientation/viewport/pixel-ratio context differs and saved verdicts preserve both profiles");

expect(strictParityGate.includes("cannot be VERIFIED_IDENTICAL when capture profiles differ") && strictParityGate.includes("comparison capture profile no longer matches current evidence"), "Strict parity revalidates capture-profile freshness", "a previously saved verdict cannot survive capture-profile edits or incompatible LIVE/independent rendering contexts");

expect(evidenceFileVerifier.includes("Evidence device_class invalid") && evidenceFileVerifier.includes("Evidence viewport invalid") && evidenceFileVerifier.includes("Evidence pixel ratio invalid"), "Evidence file verifier validates capture profile metadata", "proof-file verification now includes rendering-context fields in addition to bytes and dimensions");

expect(captureQueue.includes("Match LIVE profile:") && captureQueue.includes("viewport 707×1536") && captureQueue.includes("DPR 1"), "Capture queue exposes target LIVE rendering profiles", "independent capture operators receive concrete viewport/device targets for states that already have LIVE evidence");

expect(evidenceRegister.includes("--source-release") && evidenceRegister.includes("--route-family") && evidenceRegister.includes("source_release:sourceRelease") && evidenceRegister.includes("route_family:routeFamily"), "Evidence registration records deployment release and route family", "new parity evidence identifies the code release and stable route/state family that produced it");

expect(evidenceCompare.includes("independent evidence release ${independent.source_release} does not match current recovery release") && evidenceCompare.includes("LIVE and independent route families differ") && evidenceCompare.includes("live_source_release") && evidenceCompare.includes("independent_route_family"), "Parity comparison rejects stale release or wrong-route evidence", "an identical verdict requires current-release independent evidence and the same route/state family on both sides");

expect(strictParityGate.includes("cannot be VERIFIED_IDENTICAL with independent release") && strictParityGate.includes("cannot be VERIFIED_IDENTICAL when route families differ") && strictParityGate.includes("comparison source releases no longer match current evidence"), "Strict parity revalidates deployment provenance", "older independent captures or edited route/release metadata cannot survive as verified proof");

expect(evidenceFileVerifier.includes("Evidence source release invalid") && evidenceFileVerifier.includes("Evidence route family invalid"), "Evidence verifier validates deployment provenance fields", "evidence-file integrity now includes nonblank source-release and route-family metadata");

expect(captureQueue.includes("Independent source release required for identical verdict: **v138**") && captureQueue.includes("Route family: **owner-app-customer-payments-tab**"), "Capture queue exposes release and route targets", "independent capture worklists now tell the operator exactly which recovery release and stable state family must be recorded");

expect(parityEvidence.shared_core_fingerprint_sha256===currentVersion.shared_core_fingerprint_sha256 && parityEvidence.shared_core_fingerprint_sha256===currentSharedManifest.shared_core_fingerprint_sha256, "Parity evidence manifest is bound to the current shared-core fingerprint", "evidence governance cannot drift from the exact source fingerprint named by current-version and shared-core manifests");

expect(evidenceRegister.includes("--source-fingerprint") && evidenceRegister.includes("source_fingerprint_sha256:sourceFingerprint"), "Evidence registration records source fingerprint", "new parity evidence names the exact shared-core fingerprint of the build that produced it");

expect(evidenceCompare.includes("independent evidence fingerprint does not match the current recovery shared-core fingerprint") && evidenceCompare.includes("live_source_fingerprint_sha256") && evidenceCompare.includes("independent_source_fingerprint_sha256"), "Parity comparison requires current independent source fingerprint", "an older or different recovery source tree cannot be certified identical by current-release comparison tooling");

expect(strictParityGate.includes("Shared-core fingerprint chain validated across release, evidence, and comparisons") && strictParityGate.includes("cannot be VERIFIED_IDENTICAL with a different independent shared-core fingerprint"), "Strict parity validates release-to-evidence fingerprint chain", "verified proof remains valid only while the independent evidence fingerprint matches the current shared-core release");

expect(releasePackageValidator.includes("Release package shared-core fingerprint disagreement") && releasePackageValidator.includes("Release package version disagreement"), "Recovery ZIP validates authoritative release/fingerprint agreement", "a ZIP cannot pass completeness if its current-version, unified, shared, package, and evidence manifests disagree");

expect(captureQueue.includes("Required shared-core fingerprint: **") && captureQueue.includes(currentVersion.shared_core_fingerprint_sha256), "Capture queue prints exact required source fingerprint", "independent capture work has a concrete source fingerprint target rather than relying on release labels alone");

expect(releaseEvidenceSeal.schema==="fire-release-evidence-seal-v1" && releaseEvidenceSeal.fire_release==="v138" && releaseEvidenceSeal.sealed_file_count===31 && /^[a-f0-9]{64}$/.test(releaseEvidenceSeal.seal_sha256), "Release evidence seal covers authoritative governance and captured evidence", "the non-circular seal deterministically hashes the current governance bundle plus all captured evidence bytes");

expect(buildEvidenceSeal.includes("CURRENT_VERSION.json") && buildEvidenceSeal.includes("PARITY_EVIDENCE_MANIFEST.json") && buildEvidenceSeal.includes("PARITY_CAPTURE_QUEUE.md") && buildEvidenceSeal.includes("item.sha256") && buildEvidenceSeal.includes("seal_sha256"), "Release evidence seal builder hashes governance plus evidence files", "the seal is derived from file bytes and evidence hashes rather than manually entered labels");

expect(validateEvidenceSeal.includes("Sealed file hash mismatch") && validateEvidenceSeal.includes("Release evidence seal digest mismatch") && validateEvidenceSeal.includes("shared-core fingerprint mismatch"), "Release evidence seal validator fails closed on drift", "changed/missing sealed files, count changes, or shared-core mismatch invalidate the seal");

expect(strictParityGate.includes("Release evidence seal validated") && strictParityGate.includes("Release evidence seal drift"), "Strict parity requires the current evidence seal", "parity proof cannot proceed with authoritative governance/evidence files that no longer match their sealed hashes");

expect(independentPreflight.includes('"RELEASE_EVIDENCE_SEAL.json"') && independentPreflight.includes('"release:evidence-seal"') && independentPreflight.includes('"release:evidence-seal:check"'), "Independent preflight requires evidence-seal tooling", "a disaster-recovery package cannot pass staging preflight without the seal manifest and build/check commands");

expect(releasePackageValidator.includes("Release evidence seal PASS") && releasePackageValidator.includes("sealed file hash mismatch") && releasePackageValidator.includes("evidence seal release/fingerprint mismatch"), "Recovery ZIP verifies the release evidence seal internally", "package validation re-hashes every sealed file from the ZIP and checks the seal release/fingerprint binding");

expect(releasePackagePolicy.schema==="fire-release-package-policy-v1" && releasePackagePolicy.fire_release==="v138" && releasePackagePolicy.keep_current_versioned_artifacts.includes("FIRE_v138_RELEASE_STATUS_2026-10-01.md") && releasePackagePolicy.keep_current_versioned_artifacts.includes("LIVE_v138_SYNC_QUEUE.md"), "Canonical package policy identifies only current versioned artifacts", "historical release/sync files are excluded from future recovery ZIPs while the current status and cumulative sync queue remain");

expect(releasePackageBuilder.includes("exclude_top_level_versioned_patterns") && releasePackageBuilder.includes("exclude_directories") && releasePackageBuilder.includes("Canonical release package built"), "Canonical package builder enforces package hygiene", "release ZIP creation now applies an explicit policy instead of recursively archiving every historical/transient file");

expect(releasePackageValidator.includes("Release package contains stale top-level versioned artifacts") && releasePackageValidator.includes("Canonical package hygiene PASS"), "Package validator rejects historical release clutter", "a recovery ZIP cannot pass if obsolete FIRE_v*/LIVE_v* top-level artifacts leak back into the distributable");

expect(buildEvidenceSeal.includes("RELEASE_PACKAGE_POLICY.json"), "Release evidence seal covers package policy", "the package selection rules themselves are sealed against silent drift");

expect(currentDocsValidator.includes("intentional owner exception") && currentDocsValidator.includes("21 contiguous migrations: 0000 through 0020") && currentDocsValidator.includes("disabled legacy parity:evidence:intake command"), "Current recovery-doc freshness validator guards critical workflow instructions", "future releases fail if active docs regress to the old migration range, disabled evidence command, or rigid no-exception scheduling rule");

expect(currentReadme.includes("FIRE App v138") && currentReadme.includes("Intentional owner exception") && !/This package is FIRE App v27/i.test(currentReadme), "README is current and scheduling-exception aware", "the recovery entrypoint identifies v138 and preserves the approved/signed scheduling exception");

expect(currentGoNoGo.includes("FIRE App v138") && currentGoNoGo.includes("21 migrations") && !/Release candidate:\s*v14/i.test(currentGoNoGo), "GO/NO-GO gate is current", "promotion guidance no longer relies on obsolete v14 counts or old offline-build status");

expect(currentSecurityStatus.includes("21 contiguous migrations: 0000 through 0020") && currentSecurityStatus.includes("Release evidence files are SHA256/size/provenance validated") && !/0000` through `0009/i.test(currentSecurityStatus), "Security/recovery status matches current recovery architecture", "the active security guide documents all 20 migrations and current refund/evidence/recovery safeguards");

expect(independentDeployment.includes("release candidate v138") && independentDeployment.includes("refund.created") && independentDeployment.includes("--source-release v138") && independentDeployment.includes("--source-fingerprint"), "Independent deployment runbook is current through v138", "the active runbook includes refund webhooks and the current hash-bound evidence-registration flow");

expect(currentStagingAcceptance.includes("intentional owner exception") && currentStagingAcceptance.includes("owner may choose a job date and schedule the job even when the deposit has not yet been collected") && !/live-v49|v29\+/i.test(currentStagingAcceptance), "Staging acceptance preserves the scheduling exception and removes stale version labels", "acceptance testing now verifies both the standard 50% deposit and the owner's approved/signed scheduling exception");

expect(buildEvidenceSeal.includes("README.md") && buildEvidenceSeal.includes("GO_NO_GO.md") && buildEvidenceSeal.includes("SECURITY_AND_RECOVERY_STATUS.md") && buildEvidenceSeal.includes("INDEPENDENT_DEPLOYMENT.md") && buildEvidenceSeal.includes("STAGING_ACCEPTANCE_TEST.md"), "Release evidence seal covers active recovery documentation", "current-facing instructions cannot drift without invalidating the internal release seal");

expect(independentPreflight.includes('"scripts/validate-current-recovery-docs.mjs"') && independentPreflight.includes('"release:docs:check"'), "Independent preflight requires documentation freshness validation", "staging preparation cannot pass while current recovery instructions are stale");

expect(releasePackageValidator.includes("Current recovery-doc freshness PASS") && releasePackageValidator.includes("obsolete no-exception scheduling guidance"), "Recovery ZIP validates current-facing instructions internally", "the distributable independently rejects stale README/deployment/security/staging guidance");

expect(estimatePortal.includes("INSERT OR IGNORE INTO notifications") && estimatePortal.includes("WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND first_viewed_at=?)"), "Estimate first-view notification is transition-winner-only", "concurrent first loads only notify when the request's own first_viewed_at write actually won");

expect(invoicePortal.includes("INSERT OR IGNORE INTO notifications") && invoicePortal.includes("WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND first_viewed_at=?)"), "Invoice first-view notification is transition-winner-only", "concurrent invoice loads cannot create a second first-view notification after losing the conditional timestamp update");

expect(publicAcceptApi.includes("INSERT OR IGNORE INTO notifications") && publicAcceptApi.includes("WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND accepted_at=? AND signed_at=?)"), "Acceptance notification has database idempotency backstop", "customer approval remains atomic while duplicate lifecycle notification insertion is harmlessly ignored");

expect(lifecycleNotificationMigration.includes("idx_notifications_unique_lifecycle") && lifecycleNotificationMigration.includes("estimate_viewed") && lifecycleNotificationMigration.includes("invoice_viewed") && lifecycleNotificationMigration.includes("estimate_accepted") && lifecycleNotificationMigration.includes("DELETE FROM notifications"), "Lifecycle notification uniqueness migration deduplicates and locks the race", "historical duplicates are collapsed before a partial unique index enforces one lifecycle notification per estimate/type");

expect(currentSecurityStatus.includes("21 contiguous migrations: 0000 through 0020"), "Security/recovery docs include lifecycle-notification migration", "active recovery instructions now require the notification-race migration in isolated staging");

expect(restoreScript.includes("normalizeLegacyLifecycleNotifications") && restoreScript.includes("legacyLifecycleNotificationsSkipped") && restoreScript.includes("winnerByKey"), "Standalone restore normalizes pre-v137 lifecycle notification duplicates", "old backups keep the deterministic earliest lifecycle alert per type/estimate instead of failing against the new uniqueness index");

expect(backupApi.includes("normalizeLegacyLifecycleNotifications") && backupApi.includes("legacyLifecycleNotificationsSkipped"), "In-app restore normalizes pre-v137 lifecycle notification duplicates", "browser-driven recovery applies the same deterministic compatibility behavior as the standalone restore command");

expect(validateBackupScript.includes("legacyLifecycleNotificationDuplicates") && validateBackupScript.includes("earliest created_at lifecycle notification is preserved"), "Backup validation reports lifecycle-notification compatibility normalization", "pre-v137 backups remain valid but disclose how many duplicate lifecycle alerts will be collapsed during restore");

expect(restoreScript.includes("lifecycleNotificationUniquenessVerified: true") && restoreScript.includes("HAVING COUNT(*)>1 LIMIT 1") && restoreScript.includes("Restore verification failed: duplicate lifecycle notification remains"), "Standalone restore verifies lifecycle uniqueness after apply", "a restore cannot report success if duplicate lifecycle notifications still exist after writes");

expect(backupApi.includes("const recordResults=results.slice(0,verificationPlans.length)") && backupApi.includes("if(Number(recordResults[planIndex]?.meta.changes??0)===0)continue") && backupApi.includes("verifiedRecords!==insertedRecords"), "In-app restore verifies only records actually inserted", "merge-preserved target rows are not falsely compared against backup mutable fields, while every newly inserted record is re-read and field-verified");

expect(backupApi.includes("lifecycleNotificationUniquenessVerified:true") && backupApi.includes("HAVING COUNT(*)>1 LIMIT 1") && backupApi.includes("duplicate lifecycle notification remains"), "In-app restore verifies lifecycle uniqueness before success", "browser restore fails closed if the v134 lifecycle-notification invariant is not true after the batch");

expect(backupApi.includes('message: "Missing records were restored and verified.') && restoreScript.includes("fieldValuesVerified: true"), "Restore success explicitly means verified persistence", "success responses distinguish completed-and-verified recovery from merely attempted INSERT OR IGNORE statements");

expect(backupApi.includes("attemptId:crypto.randomUUID()") && backupApi.includes('restoreAudit.phase="write_apply"') && backupApi.includes('restoreAudit.phase="record_verification"') && backupApi.includes('restoreAudit.phase="invariant_verification"'), "In-app restore exposes phase-aware audit metadata", "each restore attempt has a unique audit ID and explicit validation/write/verification phase progression");

expect(backupApi.includes("restoreAudit.writesAttempted ? 500 : 400") && backupApi.includes("Inspect the restore audit before retrying"), "Post-write restore failure is retry-safe and explicit", "the API distinguishes pre-write validation failures from failures after writes and warns against blind retry");

expect(restoreScript.includes('restoreAudit.phase="write_apply"') && restoreScript.includes('restoreAudit.phase="record_verification"') && restoreScript.includes('restoreAudit.phase="invariant_verification"') && restoreScript.includes("restoreAudit"), "Standalone restore reports audit phase/progress", "managed recovery output exposes expected inserted rows, verified rows, lifecycle invariant status, and completion phase");

expect(validateBackupScript.includes("legacyLifecycleNotificationDuplicates"), "Backup compatibility reporting remains intact after audit hardening", "restore audit changes do not regress legacy notification compatibility disclosure");

const rate = (id) => {
  const rx = new RegExp(`id:\\s*["']${id}["'][\\s\\S]{0,260}?rate:\\s*(\\d+)`);
  const m = services.match(rx);
  return m ? Number(m[1]) : null;
};
expect(rate("house-wash") === 22, "House wash rate", "$0.22/sq ft");
expect(rate("gutters") === 150, "Gutter cleaning rate", "$1.50/linear ft");
expect(rate("gutter-guards") === 50, "Gutter guard R&R rate", "$0.50/linear ft");
expect(rate("gutter-brightening") === 200, "Gutter brightening rate", "$2.00/linear ft");
expect(rate("windows") === 700 && rate("windows-2f") === 1100, "Standard window rates", "$7 / $11");
expect(rate("french-windows-1f") === 1200 && rate("french-windows-2f") === 1800, "French pane rates", "$12 / $18");
expect(rate("screens-1f") === 300 && rate("screens-2f") === 600, "Screen rates", "$3 / $6");
expect(rate("trash-bins") === 2500, "Trash bin rate", "$25/bin");
expect(rate("dryer") === 0, "Dryer vent default price remains unset", "price must be entered intentionally until verified");
expect(rate("holiday") === 0, "Seasonal lighting default price remains unset", "price must be entered intentionally until verified");
expect(rate("commercial") === 0, "Commercial exterior default price remains unset", "price must be entered intentionally until verified");
expect(rate("specialty") === 0, "Specialty exterior default price remains unset", "price must be entered intentionally until verified");
expect(rate("custom") === 0, "Custom service default price remains unset", "price must be entered intentionally until verified");

expect(estimatesApi.includes('Math.max(15000,subtotal-requestedDiscount)'), "Server minimum charge enforcement", "$150 minimum applied server-side");
expect(estimatesApi.includes('item.quantity<=0'), "Server quantity validation", "zero/blank quantities rejected");
expect(estimatesApi.includes('const deposit=Math.round(total/2)'), "Server 50% deposit enforcement", "deposit derived from estimate total, not trusted from browser");
expect(!/Number\(body\.deposit\)/.test(estimatesApi), "Deposit input distrust", "browser-supplied deposit is ignored");
expect(estimatePatch.includes('Array.isArray(body.items)'), "Multi-service estimate edit support");
expect(estimatePatch.includes('const subtotal=items.reduce'), "Server subtotal recalculation", "sum derived from estimate items");
expect(estimatePatch.includes('additionalDiscountValue>maxBasisPoints') && estimatePatch.includes('additionalDiscountValue>subtotal'), "Server discount validation");
expect(estimatePatch.includes('const deposit=Math.round(total/2)'), "Edited estimate 50% deposit recalculation");
expect(estimatePatch.includes('DELETE FROM estimate_items WHERE estimate_id=?') && estimatePatch.includes('INSERT INTO estimate_items'), "Multi-service item replacement is atomic batch work");

expect(!estimatePatch.includes('full 50% reservation deposit before placing this job on the schedule') && estimatePatch.includes('The customer must approve and sign the estimate before the job can be scheduled.'), "LIVE scheduling behavior", "signed approved jobs can still be scheduled before payment, matching the intentional deposit-exception behavior");
expect(estimatePatch.includes('Choose a job date and time before marking this estimate scheduled'), "Scheduling date gate");
expect(estimatePatch.includes('Schedule the job before marking it complete'), "Completion sequence gate");
expect(estimatePatch.includes('Complete and save the service completion report before marking this job complete'), "Completion report gate");
expect(checkout.includes('remaining balance is due after the job is completed'), "Balance checkout completion gate");
expect(checkout.includes('depositCents - paidCents'), "Partial-deposit checkout math");
expect(checkout.includes('metadata[expected_amount_cents]'), "Stripe checkout amount metadata", "server-calculated amount is carried into verification");
expect(checkout.includes('Invalid payment type.'), "Stripe payment-type validation");
expect(checkout.includes('This job is complete. Pay the remaining final invoice balance instead of a reservation deposit.'), "Completed-job deposit checkout blocked", "completed jobs can only collect the final invoice balance");
expect(webhook.includes('STRIPE_WEBHOOK_SECRET'), "Stripe webhook secret requirement");
expect(webhook.includes('stripe-signature') && webhook.includes('HMAC') && webhook.includes('SHA-256'), "Stripe webhook signature verification");
expect(webhook.includes('checkout.session.completed') && webhook.includes('checkout.session.async_payment_succeeded'), "Stripe paid-session webhook events");
expect(webhook.includes('WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)'), "Stripe webhook idempotent payment insert");
expect(webhook.includes('expected_amount_cents') && webhook.includes('amount_mismatch'), "Stripe webhook amount verification");
expect(estimatePortal.includes('expected_amount_cents') && estimatePortal.includes('expectedAmount!==sessionAmount') && estimatePortal.includes('Number.isSafeInteger(sessionAmount)'), "Stripe redirect fallback amount verification");
expect(checkout.includes('payment_checkout_sessions') && checkout.includes('/expire') && checkout.includes('Payment checkout could not be safely tracked'), "Stripe checkout session tracking", "open checkout sessions are persisted and older sessions are expired before a new checkout is created");
expect(checkout.includes("expireTrackedCheckout") && checkout.includes("remote.status === \"expired\"") && checkout.includes("Re-read the authoritative remote state"), "Stripe stale-open checkout reconciliation", "a remotely expired Stripe session can repair a stale local open row instead of permanently blocking replacement checkout creation");
expect(checkoutSessionMigration.includes("CREATE UNIQUE INDEX `idx_payment_checkout_sessions_one_open_per_estimate`") && checkoutSessionMigration.includes("WHERE `status`='open'") && checkoutSessionMigration.includes("GROUP BY estimate_id"), "Single open Stripe checkout invariant", "database rejects racing second open checkout sessions after normalizing legacy duplicate tracking rows");
expect(invoiceEditApi.includes('expireOpenCheckoutSessions') && invoiceEditApi.includes('payment_checkout_sessions') && invoiceEditApi.includes('/expire'), "Invoice edit expires stale Stripe checkout", "final invoice edits cannot leave an older payable checkout session active at a stale amount");
expect(invoiceEditApi.includes('const inspect=await fetch') && invoiceEditApi.includes('remote.status!=="expired"') && invoiceEditApi.includes('stale local "open" tracking'), "Invoice edit reconciles remotely expired Stripe checkout", "a remotely expired checkout repairs stale local open tracking instead of permanently blocking a safe invoice edit");
expect(webhook.includes('overpaymentCents') && webhook.includes('payment_overage') && webhook.includes("UPDATE payment_checkout_sessions SET status='paid'"), "Stripe race overpayment reconciliation", "a rare completed-session race is recorded truthfully and alerts the owner instead of silently losing a charged payment");
expect(estimatePortal.includes('overpaymentCents') && estimatePortal.includes('payment_overage') && estimatePortal.includes("UPDATE payment_checkout_sessions SET status='paid'"), "Stripe redirect race reconciliation", "redirect fallback mirrors webhook checkout status and overpayment safeguards");
expect(estimatePortal.includes("WHERE NOT EXISTS (SELECT 1 FROM payments WHERE provider_id=?)") && estimatePortal.includes("if(!inserted.meta.changes)"), "Stripe redirect fallback idempotent insert", "concurrent/repeated success-page confirmation cannot record the same Stripe session twice");
expect(webhook.includes('obligationCents=paymentType === "deposit" ? Number(estimate.depositCents) : Number(estimate.totalCents)') && estimatePortal.includes('obligationCents=paymentType==="deposit"?Number(estimate.depositCents):Number(estimate.totalCents)'), "Stripe payment-mode overpayment boundary", "deposit races reconcile against the deposit obligation while balance races reconcile against the final invoice total");
expect(estimatePortal.includes('estimate:{id:string;customerId:string;customer:string;service:string;status:string;totalCents:number;depositCents:number}'), "Stripe return payment type contract", "customer return reconciliation explicitly carries status and depositCents so lifecycle and overpayment decisions use declared fields");
expect(invoicePortal.includes("n.type='payment_overage' AND n.resolved_at IS NULL") && invoicePortal.includes("paymentReviewPending") && invoicePortal.includes("Payment received — account review in progress") && invoicePortal.includes('Number(row.pendingRefundCount??0)>0?"Refund processing":Number(row.paymentOverageOpen??0)>0?"Payment received — account review in progress":balance===0?"Paid in full"'), "Customer invoice unresolved-overpayment paid-in-full suppression", "customer invoice does not claim paid in full while a refund or owner billing exception remains unresolved");

expect(home.includes("GROUP_CONCAT(name, ', ')") && !home.includes('LEFT JOIN estimate_items i ON i.estimate_id=e.id'), "Home recent-estimate multi-service deduplication");
expect(invoicesApi.includes("GROUP_CONCAT(name, ', ')") && !invoicesApi.includes('LEFT JOIN estimate_items i ON i.estimate_id=e.id'), "Invoice list multi-service deduplication");
expect(paymentsApi.includes("GROUP_CONCAT(name, ', ')") && !paymentsApi.includes('LEFT JOIN estimate_items i ON i.estimate_id=e.id'), "Payment history multi-service deduplication");
expect(expensesApi.includes("GROUP_CONCAT(name, ', ')") && !expensesApi.includes('LEFT JOIN estimate_items i ON i.estimate_id=e.id'), "Expense list multi-service deduplication");
expect(paymentPortal.includes('SELECT name,quantity,unit,total_cents AS totalCents FROM estimate_items') && paymentPortal.includes('items.map'), "Customer payment page shows all service lines");
expect(paymentPortal.includes('COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1),e.total_cents) AS totalCents') && paymentPortal.includes('row.status==="completed"?"balance":"deposit"'), "Standalone payment page reconciles to final invoice", "completed jobs use the edited final invoice total and never fall back to deposit mode");
expect(dashboard.includes('estimate.invoiceId&&estimate.invoiceShareToken') && dashboard.includes('> View invoice</a>'), "Completed estimate exposes direct View invoice action", "button appears only after an invoice exists and opens the private invoice page");
expect(dashboard.includes("setTemplate(initialTemplate)") && dashboard.includes('triggerLabel={estimate.invoiceId?"Send invoice":"Send estimate"}'), "Send invoice opens Invoice ready template", "message composer resets to the invoice template whenever Send invoice is opened");
expect(dashboard.includes('Next: send the invoice, record payment, and request a review.'), "Completed invoiced next-step wording matches LIVE", "recommended next step includes sending the invoice before payment/review");
expect(dashboard.includes('Next: capture before photos, complete the job report, then create the invoice.'), "Scheduled next-step wording matches LIVE");
expect(!dashboard.includes('Scheduling unlocks after the full 50% reservation deposit is recorded.') && !dashboard.includes('Deposit required'), "LIVE scheduling UI is not payment-gated", "job date remains available after approval even when Paid is $0");
expect(!dashboard.includes('job-stage-strip') && !dashboard.includes('payment-progress-card'), "No independent-only estimate helper panels", "strict LIVE parity removes backup-only job-stage and payment-progress UI");
expect(dashboard.includes('estimate.status==="approved"?"Next: choose the job date and save it."'), "Approved next step does not require deposit before scheduling", "owner can schedule approved jobs with deposit exceptions");
expect(dashboard.includes('after receiving money through Wave, Cash App, Venmo, cash, check, card, or bank transfer.'), "Customer Payments empty-state wording matches LIVE", "uses through, not in");
expect(dashboard.includes('{paymentTypeLabel(payment.type)} payment'), "Customer Payments populated method label matches LIVE capitalization");
expect(invoicePortal.includes('<small>Invoice total</small>') && invoicePortal.includes('<small>Balance due</small>') && !invoicePortal.includes('<small>Paid</small>'), "Customer invoice summary matches LIVE two-column structure", "Invoice total / Balance due only");
expect(invoicePortal.includes('Payment due on receipt') && invoicePortal.includes('Payment due ${'), "Customer invoice due-date wording matches LIVE", "supports due on receipt and dated due states");
expect(!invoicePortal.includes('Online payments are not connected yet.'), "Customer invoice omits non-LIVE disconnected-payments notice");
expect(templates.includes('The remaining balance is due upon completion. Please contact Kyle with any questions about this invoice or to arrange payment.'), "Customer invoice footer matches LIVE wording");

expect(home.includes("WHEN status IN ('approved','scheduled')"), "Dashboard due-now policy", "approved/scheduled count only deposit due");
expect(home.includes("WHEN status='completed'"), "Dashboard completed balance policy");
expect(dashboard.includes('quantity:0,unit:"unit",unitRateCents:0') && dashboard.includes('svc.unit==="job"?1:0'), "No measured-service default quantity", "new measured estimates start blank");
expect(!/useState\([^\n)]*2500/.test(dashboard), "No 2,500 sq ft state default");
expect(dashboard.includes('"Cash App","Venmo"'), "Cash App and Venmo payment methods", "manual payment dropdown includes both methods");
expect(paymentMethods.includes('DEFAULT_CASH_APP_HANDLE = "$FIREExteriors"'), "Cash App handle", "$FIREExteriors configured");
expect(paymentMethods.includes('DEFAULT_VENMO_HANDLE = "@FirstInResponseExteriors"'), "Venmo handle", "@FirstInResponseExteriors configured");
expect(estimatePortal.includes('Cash App: {handles.cashApp}') && estimatePortal.includes('Venmo: {handles.venmo}'), "Estimate payment handles", "Cash App and Venmo shown on customer estimate");
expect(invoicePortal.includes('Cash App: {handles.cashApp}') && invoicePortal.includes('Venmo: {handles.venmo}'), "Invoice payment handles", "Cash App and Venmo shown on customer invoice");
expect(paymentPortal.includes('Cash App: {handles.cashApp}') && paymentPortal.includes('Venmo: {handles.venmo}'), "Payment-page handles", "Cash App and Venmo shown on customer payment page");

expect(dashboard.includes('Edit final invoice') && dashboard.includes('Edit invoice'), "Final invoice editor", "last-minute services and discounts can be added after invoice creation");
expect(dashboard.includes('% Percentage') && dashboard.includes('$ Dollar amount'), "Discount mode switch", "estimate and invoice discounts can switch between percentage and dollar amount");
expect(invoiceEditApi.includes('totalCents<paidCents') && invoiceEditApi.includes('payments already recorded'), "Invoice payment protection", "invoice edits cannot reduce total below recorded payments");
expect(invoiceEditApi.includes('DELETE FROM invoice_items') && invoiceEditApi.includes('INSERT INTO invoice_items'), "Editable invoice line-item snapshot", "final invoice line items are edited independently from the accepted estimate");
expect(invoicePortal.includes('FROM invoice_items WHERE invoice_id=?'), "Customer invoice uses final invoice items", "customer invoice reflects last-minute invoice edits without rewriting the accepted estimate");
expect(dashboard.includes('Payment due') && dashboard.includes('Due on receipt') && dashboard.includes('Specific date'), "Editable invoice due date", "final invoice can stay due on receipt or use a specific date");
expect(invoiceEditApi.includes('rawDueAt==="receipt"') && invoiceEditApi.includes('due_at=?'), "Server-side invoice due-date update", "due-date edits are validated and persisted server-side");
expect(invoiceEditApi.includes('existing.status==="sent"||Boolean(existing.firstViewedAt)?"sent":"draft"'), "Invoice edit preserves sent/viewed state", "editing an unpaid invoice after the customer viewed it does not incorrectly revert it to Draft");
expect(invoiceEditApi.includes("INSERT INTO invoice_revisions") && invoiceEditApi.includes("JSON.stringify(currentItems.results)"), "Invoice revision snapshot", "every final-invoice edit preserves the previous totals, due date, status, and line items before replacement");
expect(invoiceEditApi.includes("FROM invoice_revisions WHERE invoice_id=?") && dashboard.includes("Invoice revision history"), "Invoice revision history is owner-visible", "recent prior invoice versions are available from the Edit invoice workflow");
expect(invoiceEditApi.includes("items_json AS itemsJson") && invoiceEditApi.includes("JSON.parse") && dashboard.includes("Open a revision to review its prior services and discount.") && dashboard.includes("revision.items.map"), "Invoice revision detail viewer", "owner can inspect prior service lines, discount details, totals, status, and due date without restoring history");
expect(invoicesApi.includes('const dueAt = null;'), "New invoices default to due on receipt", "new invoice due mode is explicit rather than tied to today's date");
expect(backupApi.includes('"invoice_revisions"') && backupApi.includes('invoiceRevisionHistory: true'), "Invoice revision history included in records backup", "disaster-recovery exports preserve prior invoice versions");
expect(restoreScript.includes('["invoice_revisions"') && restoreScript.includes('table === "invoice_items" || table === "invoice_revisions" || table === "payment_checkout_sessions"'), "Invoice revision history restore support", "new backups restore revision history while older backups without it remain compatible");
expect(validateBackupScript.includes('optionalRecoveryTables = ["invoice_items", "invoice_revisions", "payment_checkout_sessions", "payment_refunds"]'), "Backup validator understands invoice revisions", "revision, checkout, and refund history are validated when present without rejecting older compatible backups");
expect(backupApi.includes('"payment_checkout_sessions"') && backupApi.includes('paymentCheckoutSessionSafety: true'), "Stripe checkout safety included in records backup", "disaster recovery preserves open/expired/paid checkout-session state");
expect(dashboard.includes('const resolvedBillingTotalCents') && dashboard.includes('const billingBalanceCents'), "Final invoice total drives owner balances", "owner-facing balances resolve to the edited invoice total when one exists");
expect(dashboard.includes('const remainingBalance=(estimate:EstimateRow)=>amountDueNow(estimate);'), "Payments workspace uses final invoice balance", "Outstanding and Balances to collect follow the actual due-now amount: deposit before completion, final invoice balance after completion");
expect(dashboard.includes('if(estimate.invoiceId&&billingBalanceCents(estimate)>0)') && dashboard.includes('paidCents>=resolvedBillingTotalCents(estimate)'), "Follow-up and review billing reconciliation", "invoice reminders and paid/review eligibility use the final invoice total");
expect(home.includes('COALESCE((SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id LIMIT 1), total_cents)') && home.includes('AS invoiceTotalCents'), "Home dashboard uses final invoice totals", "completed-job Outstanding and recent-job detail use edited invoice totals");
expect(dashboard.includes('const billingTotal=resolvedBillingTotalCents(estimate);') && dashboard.includes('{estimate.invoiceId?"Final invoice":"Estimate"}') && dashboard.includes('money(billingTotal-total)'), "Job-cost profit uses final invoice total", "gross profit follows the edited final invoice when one exists");
expect(dashboard.includes('resolvedBillingTotalCents(estimate)<=estimate.paidCents?"Paid in full'), "Recommended next step uses final invoice balance", "owner detail cannot call an edited invoice paid in full based only on the original estimate");
expect(estimatePortal.includes('(SELECT total_cents FROM invoices inv WHERE inv.estimate_id=e.id LIMIT 1) AS invoiceTotalCents') && estimatePortal.includes('const billingTotalCents=Number(row.invoiceTotalCents??row.totalCents)') && estimatePortal.includes('const balance=billingStateSafe?Math.max(0,billingTotalCents-paidCents):0'), "Customer portal uses final invoice total", "completed-job balance display and secure payment amount follow the edited invoice total while failing closed on unsafe billing state");
expect(estimatePortal.includes('const canPayDeposit=billingStateSafe&&!paymentReviewPending&&estimateApproved&&row.status!=="completed"&&depositRemaining>0') && estimatePortal.includes('const canPayBalance=billingStateSafe&&!paymentReviewPending&&row.status==="completed"&&balance>0'), "Completed jobs collect final balance instead of deposit", "after completion the customer portal offers only the final balance when billing is safe and no exception is under review");
expect(estimatePortal.includes('{...row,totalCents:billingTotalCents,service:serviceSummary}') && estimatePortal.includes('estimate.status==="completed"||paymentType==="balance"') && estimatePortal.includes("WHEN ?>=total_cents THEN 'paid'"), "Stripe confirmation reconciles to final invoice total", "customer secure-payment confirmation uses the edited final invoice total for completed/balance billing while preserving pre-completion deposit invoice lifecycle");

expect(paymentsApi.includes('balanceCents:Math.max(0, refreshedDueLimit-nextPaid)'), "Manual payment response uses resolved amount due", "post-payment balance is recomputed from the current deposit/final-invoice obligation after the guarded insert");
expect(paymentsApi.includes("WHERE ? <= (") && paymentsApi.includes("The amount due changed while this payment was being recorded") && paymentsApi.includes("const refreshed = await env.DB.prepare"), "Manual payment insert is race-safe", "concurrent owner payment submissions cannot jointly exceed the current deposit or final-invoice obligation");
expect(estimatesApi.includes("payment_overage") && estimatesApi.includes("resolved_at IS NULL") && dashboard.includes("Overpayment needs review"), "Owner sees unresolved overpayment exception", "billing exceptions stay visible on the job until explicitly resolved");
expect(dashboard.includes('Number(estimate.paymentOverageOpen)===0&&Number(estimate.pendingRefundCount)===0&&estimate.paidCents>=resolvedBillingTotalCents(estimate)') && dashboard.includes('Billing exception: overpayment needs refund or retained-overpayment review') && dashboard.includes('Number(estimate.paymentOverageOpen)===0&&Number(estimate.pendingRefundCount)===0&&billingBalanceCents(estimate)===0&&!estimate.lastRebookMessageAt'), "Overpayment suppresses normal review workflow", "review and repeat-service marketing workflows are paused while billing exceptions, refund reconciliation, or reopened balances remain unresolved");
expect(notificationsApi.includes("reconciliationHandled?:boolean") && notificationsApi.includes("value.reconciliationHandled!==true") && dashboard.includes("reconciliationHandled:true"), "Overpayment resolution requires explicit reconciliation acknowledgment", "dedicated resolution fails closed unless the owner action confirms the refund or retained overpayment was handled");

expect(webhook.includes("either refund the excess or intentionally keep it as an overpayment on this job") && estimatePortal.includes("either refund the excess or intentionally keep it as an overpayment on this job") && !webhook.includes("appropriate refund or credit") && !estimatePortal.includes("appropriate refund or credit"), "Stripe overpayment alerts match retained-overpayment semantics", "both webhook and redirect fallback notifications describe only accounting outcomes FIRE actually supports");

expect(restorePhotoScript.includes('Photo archive contains duplicate photo IDs.') && restorePhotoScript.includes('Photo archive contains duplicate object keys.'), "Photo archive rejects duplicate identity/object keys", "a malformed archive cannot contain two photo records for the same logical ID or R2 object path");

expect(restorePhotoScript.includes('already exists with different metadata') && restorePhotoScript.includes('already belongs to target photo'), "Photo restore protects existing metadata and object ownership", "an existing photo ID must match customer/category/caption/filename/type/size/object/created identity and one R2 object key cannot silently belong to another photo record");

expect(validateBackupScript.includes('Backup customer_photos contains duplicate object key') && validateBackupScript.includes('has an unsafe or mismatched object key') && validateBackupScript.includes('references missing customer'), "Backup validator protects photo metadata graph", "records backups reject duplicate photo IDs/object keys, missing customers, unsafe object paths, bad categories/types, and invalid sizes");

expect(backupApi.includes('Records backup stopped: duplicate photo object key') && backupApi.includes('Records backup stopped: photo ${id} references missing customer') && backupApi.includes('Records backup stopped: photo ${id} has invalid metadata'), "Live backup export fails closed on photo metadata corruption", "FIRE will not export a records backup that advertises invalid photo ownership or object metadata");

expect(restoreScript.includes('target customer ${plan.identity} has different immutable identity/contact values') && restoreScript.includes('target customer note ${plan.identity} has different immutable customer/body/created values'), "Managed restore protects customer and note identity", "customer/contact identity and saved note ownership/content cannot silently diverge under an existing ID");

expect(restoreScript.includes('target customer message ${plan.identity} has different immutable relationship/content values') && restoreScript.includes('target notification ${plan.identity} has different immutable type/content/relationship values'), "Managed restore protects communication and notification identity", "customer communications and owner notifications keep their original customer/job/content identity during merge recovery");

expect(restoreScript.includes('target message template ${plan.identity} has different saved content/version values'), "Managed restore protects saved message-template identity", "an existing template key cannot silently preserve different saved copy/version data from the backup");

expect(backupApi.includes('customer ${id} already exists with different immutable identity/contact values') && backupApi.includes('customer message ${id} already exists with different immutable values') && backupApi.includes('notification ${id} already exists with different immutable values') && backupApi.includes('message template ${key} already exists with different saved content/version values'), "In-app restore protects CRM/history identity", "Business restore applies the same customer, communication, notification, and template conflict checks before writes");

expect(validateBackupScript.includes('Backup customer message ${row.id} customer does not match its estimate') && validateBackupScript.includes('Backup notification ${row.id} customer does not match its estimate') && validateBackupScript.includes('Backup task ${row.id} customer does not match its estimate'), "Backup validator enforces CRM estimate-customer consistency", "messages, notifications, and tasks with both customer and estimate references cannot point to a customer different from the estimate owner");

expect(restoreScript.includes('target estimate item ${plan.identity} has different immutable parent/service/amount values') && restoreScript.includes('target invoice item ${plan.identity} has different immutable parent/service/amount values'), "Managed restore protects line-item identity", "estimate and invoice line-item IDs cannot silently reattach to a different parent, service, quantity, unit, or amount");

expect(restoreScript.includes('target task ${plan.identity} has different immutable relationship/title/created values') && restoreScript.includes('target expense ${plan.identity} has different immutable job/category/amount/date values'), "Managed restore protects task and expense identity", "existing task/expense IDs must preserve their original job/customer ownership and immutable business details");

expect(restoreScript.includes('target job report ${plan.identity} has different immutable job/customer/checklist/status values') && restoreScript.includes('target change request ${plan.identity} has different immutable job/customer/message values'), "Managed restore protects job report and change-request identity", "service-completion evidence and customer change requests cannot silently move to another job/customer");

expect(backupApi.includes('estimate item ${id} already exists with different immutable values') && backupApi.includes('invoice item ${id} already exists with different immutable values') && backupApi.includes('job report ${id} already exists with different immutable values'), "In-app restore protects child-record financial identity", "Business restore applies the same line-item and job-report ID conflict protection before writes");

expect(validateBackupScript.includes('ensureUniqueAndParent("estimate_items"') && validateBackupScript.includes('ensureUniqueAndParent("job_reports"') && validateBackupScript.includes('customer does not match its estimate'), "Backup validator enforces child-parent relationship integrity", "backup validation rejects duplicate child IDs, missing parents, and job/change-request customer ownership that disagrees with the linked estimate");

expect(restoreScript.includes('target estimate ${plan.identity} has different immutable customer/billing/share-token values') && restoreScript.includes('target invoice ${plan.identity} has different immutable estimate/customer/billing/share-token values'), "Managed restore protects estimate and invoice financial identity", "merge recovery stops when an existing estimate or invoice ID maps to different customer, billing, or share-token values");

expect(restoreScript.includes('target checkout ${plan.identity} has different immutable estimate/type/amount values') && restoreScript.includes('target invoice revision ${plan.identity} has different immutable invoice/total/items values'), "Managed restore protects checkout and invoice-revision identity", "recovery does not silently preserve a checkout or invoice revision whose immutable billing identity differs from the backup");

expect(restoreScript.includes('already has target invoice') && restoreScript.includes('estimate share token already belongs') && restoreScript.includes('invoice share token already belongs'), "Managed restore preflights invoice/share-token uniqueness", "one-invoice-per-estimate and public share-token uniqueness are checked before restore writes");

expect(backupApi.includes('estimate ${id} already exists with different immutable financial values') && backupApi.includes('invoice ${id} already exists with different immutable financial values') && backupApi.includes('checkout ${id} already exists with different immutable financial values') && backupApi.includes('invoice revision ${id} already exists with different immutable financial values'), "In-app restore protects core financial identity", "Business restore refuses estimate, invoice, checkout, and revision ID collisions with different immutable financial state");

expect(validateBackupScript.includes('Backup contains more than one invoice for estimate') && validateBackupScript.includes('duplicate share token'), "Backup validator enforces invoice and share-token uniqueness", "malformed backups are rejected before restore when they violate one-invoice-per-estimate or public-token uniqueness invariants");

expect(restoreScript.includes("provider_id LIKE 'cs_%' OR provider_id LIKE 'refund:%'") && restoreScript.includes('strongProvider=provider.startsWith("cs_")||provider.startsWith("refund:")'), "Managed restore protects only true provider identifiers", "Stripe Checkout and FIRE refund-ledger IDs are collision-checked without incorrectly making ordinary manual payment reference text globally unique");

expect(backupApi.includes("provider_id LIKE 'cs_%' OR provider_id LIKE 'refund:%'") && backupApi.includes('strongProvider=provider.startsWith("cs_")||provider.startsWith("refund:")'), "In-app restore protects only true provider identifiers", "Cash App/Venmo/manual reference text may repeat normally while Stripe and refund provider identities remain collision-safe");

expect(restoreScript.includes('target refund ${plan.identity} has different immutable payment/estimate/amount/mode values') && restoreScript.includes('target payment ${plan.identity} has different immutable estimate/amount/provider values'), "Managed restore rejects same-ID financial identity conflicts", "merge restore does not silently preserve a different refund or payment merely because its record ID already exists");

expect(backupApi.includes('already exists with different immutable financial values') && backupApi.includes('targetRefundById') && backupApi.includes('targetPaymentById'), "In-app restore rejects same-ID financial identity conflicts", "the Business restore path fails before writes when an existing payment/refund ID maps to different immutable financial ownership or amount");

expect(restoreScript.includes('provider refund ${provider} already belongs to target refund') && restoreScript.includes('payment provider ${provider} already belongs to target payment'), "Managed restore rejects cross-ID provider collisions before writes", "a valid backup cannot merge a Stripe/refund provider identity onto a different existing database record");

expect(backupApi.includes('provider refund ${provider} already belongs to another refund') && backupApi.includes('payment provider ${provider} already belongs to another payment'), "In-app restore rejects cross-ID provider collisions before writes", "the owner restore workflow stops before database mutation when provider identity is already owned by another target record");

expect(notificationsApi.includes('Refunds must be processed from Payments → Refund on the original payment') && !notificationsApi.includes("'Refund adjustment'") && refundApi.includes("INSERT INTO payments") && refundApi.includes("'Refund'") && dashboard.includes('Keep as overpayment') && dashboard.includes('open <strong>Payments</strong> and use <strong>Refund</strong> on the original payment'), "Overpayment resolution records refund adjustments", "new refunds are handled only by the payment-level refund workflow, while retained-overpayment resolution preserves the payment ledger");

expect(webhook.includes("either refund the excess or intentionally keep it as an overpayment on this job") && estimatePortal.includes("either refund the excess or intentionally keep it as an overpayment on this job") && !webhook.includes("appropriate refund or credit") && !estimatePortal.includes("appropriate refund or credit"), "Stripe overpayment alerts match retained-overpayment semantics", "both webhook and redirect fallback notifications describe only accounting outcomes FIRE actually supports");

expect(notificationsApi.includes('resolutionMode?:"keep"|string') && notificationsApi.includes("resolution_note='kept_overpayment'") && dashboard.includes("Keep as overpayment") && dashboard.includes("If you and the customer intentionally agree to leave the extra money on this job"), "Retained overpayment is not mislabeled as customer credit", "FIRE preserves intentional excess on that job without presenting it as a reusable customer-credit ledger");

expect(refundApi.includes('verifiedRequest') && refundApi.includes('verifiedLedger') && refundApi.includes('Refund confirmation did not converge on one verified ledger entry') && webhook.includes('refund_ledger_verification_failed'), "Refund reconciliation race uses persisted ledger as authority", "owner and Stripe refund completion verify the persisted refund request and exact negative ledger row before reporting success");

expect(refundApi.includes("WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL") && refundApi.includes("<= COALESCE((SELECT inv.total_cents") && notificationsApi.includes("resolution_note='kept_overpayment'") && notificationsApi.includes("WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL"), "Completed reconciliation clears stale sibling overpayment alerts", "payment-level refunds clear all open job overpayment alerts only when the persisted paid ledger is no longer above the final bill; intentionally kept overpayment resolves the same job-level alert set");

expect(refundApi.includes("AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.estimate_id=? AND p.status='paid'),0)") && refundApi.includes("<= COALESCE((SELECT inv.total_cents") && webhook.includes("<= COALESCE((SELECT inv.total_cents"), "Partial refund cannot falsely resolve overpayment", "partial refunds may complete, but overpayment alerts stay open until the persisted net paid ledger is no longer above the final billing total");

expect(notificationsApi.includes("resolution_note AS resolutionNote") && notificationsApi.includes("resolution_note='kept_overpayment'") && refundApi.includes("UPDATE payment_refunds SET status='succeeded'") && refundApi.includes("provider_refund_id"), "Overpayment resolution outcome persisted", "retained-overpayment decisions remain durable on the alert, while refunds persist as durable payment_refund records linked to the original payment");
expect(backupApi.includes('"resolution_note"'), "Billing-exception resolution outcome included in backup/restore", "refund/retained-overpayment resolution audit state survives disaster recovery");

expect(notificationsApi.includes('target.type==="payment_overage"') && notificationsApi.includes("Overpayment exceptions must be resolved from the job billing-exception action"), "Generic notification resolution cannot bypass overpayment workflow", "payment_overage exceptions can only be cleared through the dedicated job-scoped resolution action");

expect(notificationsApi.includes('resolved_at AS resolvedAt') && notificationsApi.includes('value.id&&value.resolve') && notificationsApi.includes('resolved_at=?'), "Billing exception resolution is explicit", "reading an alert does not silently resolve an overpayment exception");
expect(notificationsApi.includes("resolveOverpayment") && notificationsApi.includes("ORDER BY created_at ASC LIMIT 1") && notificationsApi.includes("remainingOverpaymentCount") && dashboard.includes("resolveOverpayment:true") && !dashboard.includes("result.notifications?.find((item)=>item.type===\"payment_overage\""), "Overpayment resolution is not notification-window limited", "older unresolved billing exceptions remain resolvable and multiple exceptions are cleared one at a time");
expect(backupApi.includes('"resolved_at"') && restoreScript.includes('table==="notifications"&&column==="resolved_at"'), "Notification resolution survives recovery", "overpayment resolution state is preserved while older backups remain compatible");

expect(templates.includes('A 50% deposit reserves your spot'), "Estimate message deposit wording matches LIVE", "default estimate message uses reservation wording while allowing owner exceptions");
expect(templates.includes('A 50% deposit reserves your service date, and the remaining balance is due immediately upon completion.'), "Estimate footer deposit wording matches LIVE", "customer-facing footer matches captured LIVE document");
expect(!templates.includes('A 50% deposit is required to be placed on the schedule'), "Rigid schedule-lock wording removed", "templates no longer contradict owner scheduling exceptions");
expect(templates.includes('remaining balance is due upon completion of the work'), "Completion balance wording");
expect(templates.includes('Google is the most helpful'), "Review preference wording");
expect(templates.includes('Facebook and Yelp are greatly appreciated too'), "Review alternatives wording");

expect(auth.includes('fire_admin_session'), "Independent owner session cookie");
expect(auth.includes('FIRE_ADMIN_PASSWORD_HASH') && auth.includes('FIRE_SESSION_SECRET'), "Independent owner secrets");
expect(!auth.includes('appgprj_'), "No legacy hosted-project id in owner auth");

expect(paymentsApi.includes("type='payment_overage' AND resolved_at IS NULL") && paymentsApi.includes("before recording another payment"), "Manual payment blocked by unresolved billing exception", "owner-recorded payments cannot be added until the refund or credit exception is explicitly resolved");

expect(checkout.includes("type='payment_overage' AND resolved_at IS NULL") && checkout.includes("payment exception under review") && checkout.includes("before starting another card payment"), "Stripe checkout blocked by unresolved billing exception", "a flagged overpayment must be explicitly resolved before any new deposit or balance Checkout Session can be created");

expect(paymentPortal.includes("n.type='payment_overage' AND n.resolved_at IS NULL") && paymentPortal.includes("paymentReviewPending") && paymentPortal.includes("Payment received — account review in progress.") && paymentPortal.includes("paymentReviewPending?<p"), "Customer payment page unresolved-overpayment paid-in-full suppression", "payment page does not claim paid in full while an owner billing exception remains unresolved");

expect(estimatePatch.includes('const latestWorkflow=await env.DB.prepare') && estimatePatch.includes('latestWorkflow.status!==existing.status') && estimatePatch.includes('latestWorkflow.acceptedAt!==existing.acceptedAt') && estimatePatch.includes('latestWorkflow.signedAt!==existing.signedAt'), "Job workflow transitions recheck status and signed acceptance", "schedule/status changes fail closed if approval, signature, or workflow state changed after the owner opened the job update");

expect(estimatePatch.includes('const latestPaidCents=Number(latestWorkflow.paidCents)') && estimatePatch.includes('Number.isSafeInteger(latestPaidCents)'), "Job workflow transitions validate refreshed payment state", "scheduling/completion/status changes refuse to proceed on an unsafe persisted payment aggregate while preserving the owner's explicit ability to schedule an approved job without a deposit");

expect(publicAcceptApi.includes('signedName.length>120'), "Customer signature name is bounded", "estimate approval still requires a meaningful signer name but now rejects abnormally large signature-name input before persistence");

expect(publicAcceptApi.includes('subtotal_cents BETWEEN 0 AND 9007199254740991') && publicAcceptApi.includes('total_cents BETWEEN 0 AND 9007199254740991') && publicAcceptApi.includes('deposit_cents BETWEEN 0 AND 9007199254740991') && publicAcceptApi.includes('discount_cents<=subtotal_cents') && publicAcceptApi.includes('total_cents>=deposit_cents'), "Estimate acceptance validates billing integrity inside approval mutation", "customer approval cannot lock in an estimate whose persisted subtotal, discount, total, or deposit is outside exact-cent bounds or internally inconsistent");

expect(publicAcceptApi.includes('EXISTS (SELECT 1 FROM estimate_items') && publicAcceptApi.includes('NOT EXISTS (SELECT 1 FROM estimate_items') && publicAcceptApi.includes('ei.quantity<=0') && publicAcceptApi.includes('ei.total_cents>9007199254740991'), "Estimate acceptance validates service-line integrity inside approval mutation", "approval requires at least one service and rejects invalid names, quantities, negative prices, or unsafe cent values in the persisted estimate snapshot");

expect(estimatesApi.includes('item.description,item.quantity,item.unit,item.totalCents') && !estimatesApi.includes('item.description,Math.round(item.quantity),item.unit,item.totalCents'), "Estimate creation preserves valid service quantities", "positive finite service quantities are persisted exactly as validated instead of silently rounded during estimate creation");

expect(estimatePatch.includes('const latest=await env.DB.prepare') && estimatePatch.includes('This estimate became approved or financially active while you were editing it.') && estimatePatch.includes('Number.isSafeInteger(Number(latest.paidCents))'), "Estimate edit rechecks approval and payment state before mutation", "FIRE re-reads status, payments, and invoice activity immediately before replacing estimate lines so an acceptance/payment arriving during an owner edit stops the edit");

expect(estimatePatch.includes('item.description,item.quantity,item.unit,item.totalCents') && !estimatePatch.includes('item.description,Math.round(item.quantity),item.unit,item.totalCents'), "Estimate edits preserve valid service quantities", "editing a draft/sent estimate no longer rounds a valid fractional quantity only when writing it to storage");

expect(invoicesApi.includes('itemResult.results.some') && invoicesApi.includes('Number.isSafeInteger(Number(item.totalCents))') && invoicesApi.includes('Number.isSafeInteger(subtotalCents)') && invoicesApi.includes('Number.isSafeInteger(estimateTotalCents)') && invoicesApi.includes('Number.isSafeInteger(paidSnapshotCents)'), "Final invoice creation validates the completed-job billing snapshot", "legacy/restored service lines, subtotal, final total, and persisted paid sum must all be valid exact accounting values before FIRE creates a customer invoice");

expect(invoicesApi.includes('prior.customerId!==estimate.customerId') && invoicesApi.includes('raced.customerId!==estimate.customerId'), "Invoice reuse and creation-race recovery enforce customer ownership", "an existing or concurrently-created invoice is returned only when its customer still matches the completed estimate, preventing corrupted cross-customer billing from being silently reused");

expect(invoiceEditApi.includes('Number.isSafeInteger(paidCents)') && invoiceEditApi.includes("Recorded payments are outside FIRE's safe accounting range"), "Invoice editing validates persisted paid cents", "final-invoice edits fail closed when existing payment totals cannot be represented exactly instead of comparing unsafe accounting values");

expect(invoiceEditApi.includes('const latestPaidCents=Number(latestPaidRow?.paidCents??0)') && invoiceEditApi.includes('totalCents<latestPaidCents') && invoiceEditApi.includes('A payment changed while this invoice was being edited.'), "Invoice edit rechecks payments after checkout expiration", "after active Stripe sessions are closed, FIRE re-reads paid cents before replacing invoice lines so a payment arriving during the edit cannot silently leave the saved invoice below recorded payments");

expect(invoiceEditApi.includes('item.description,item.quantity,item.unit,item.totalCents') && !invoiceEditApi.includes('item.description,Math.round(item.quantity),item.unit,item.totalCents'), "Invoice edits preserve valid service quantities", "validated positive invoice quantities are persisted as entered instead of being rounded during the database write");

expect(webhook.includes('if(requestRow.mode!=="stripe")return {ok:false,reason:"refund_mode_mismatch"}') && webhook.includes('finalizeWebhookRefund') && webhook.includes('refund_mode_mismatch'), "Stripe refund events can finalize only Stripe-mode refund requests", "a signed Stripe event cannot mutate a manual refund request or write a negative payment against the wrong refund mode");

expect(customersApi.includes('AS paymentOverageOpen') && customersApi.includes('AS pendingRefundCount') && dashboard.includes('Number(invoice.pendingRefundCount)>0?"Refund processing"'), "Customer invoice history surfaces refund and overpayment review state", "customer records no longer display a normal invoice lifecycle while the linked billing record is under refund or overpayment review");

expect(estimatePortal.includes('<strong>Refund processing.</strong>') && invoicePortal.includes('Number(row.pendingRefundCount??0)>0?"Refund processing"'), "Customer portals distinguish refund processing from generic billing review", "customers get an accurate refund-processing message while payment actions remain paused");

expect(dashboardSummaryApi.includes('const summarySafe=') && dashboardSummaryApi.includes('const recentSafe=') && dashboardSummaryApi.includes('Dashboard billing totals require owner review'), "Dashboard summary fails closed on unsafe aggregate billing values", "homepage metrics are not refreshed from totals outside JavaScript exact-integer accounting range");

expect(customersApi.includes('const customerFinancialsSafe=') && customersApi.includes('const estimateFinancialsSafe=') && customersApi.includes('Customer billing totals require owner review'), "Customer aggregates fail closed on unsafe financial data", "customer lifetime and estimate/payment totals are not silently summarized when persisted values leave exact accounting range");

expect(webhook.includes('stripeCheckoutForPaymentIntent') && webhook.includes('payment_intent:paymentIntent') && webhook.includes('stripe-external:${refund.id}') && webhook.includes('original_payment_not_found'), "Direct Stripe-dashboard refunds reconcile into FIRE", "signed Stripe refund events without FIRE metadata are traced from PaymentIntent to Checkout Session and original FIRE payment before local reconciliation");

expect(webhook.includes("status IN ('pending','failed')") && webhook.includes('restored_refund_provider_mismatch'), "Restored in-flight Stripe refunds converge on later provider truth", "a signed Stripe success can repair a refund request that disaster recovery intentionally marked failed/unknown, while mismatched provider IDs are rejected");

expect(dashboard.includes('const remainingBalance=(estimate:EstimateRow)=>amountDueNow(estimate)') && dashboard.includes('if(!safeBillingState(estimate))return 0;'), "Payments screen follows actual due-now rules", "draft/sent estimates are no longer presented as collectible balances and approved/scheduled jobs expose only the deposit due while completed jobs expose final balance");

expect(dashboard.includes('billingBalanceCents(estimate)===0&&!estimate.lastRebookMessageAt'), "Repeat-service marketing waits for post-refund balance settlement", "a completed job whose refund reopened a balance does not enter win-back/rebook outreach until billing is settled again");

expect(validateBackupScript.includes('if(optionalRecoveryTables.includes(table)&&rows===undefined)continue;'), "Older compatible backups may omit refund table", "adding payment_refunds does not make pre-v111 app-export backups unrecoverable; refund history is validated when present");

expect(estimatesApi.includes('AS pendingRefundCount') && customersApi.includes('AS pendingRefundCount') && dashboardSummaryApi.includes('AS pendingRefundCount') && invoicesApi.includes('AS pendingRefundCount'), "Pending refund state is exposed across owner data APIs", "owner estimate, customer, dashboard, and invoice views can all pause collection/review actions while a refund is processing");

expect(estimatePortal.includes('Number(row.pendingRefundCount??0)>0') && invoicePortal.includes('Number(row.pendingRefundCount??0)>0') && customerMessagesApi.includes('Number(reviewState.pendingRefundCount)>0'), "Pending refunds block customer payment and review actions", "customer payment pages and review-request server gating stay paused until refund reconciliation finishes");

expect(paymentsApi.includes("A refund is currently processing for this job") && checkout.includes("A refund is currently processing for this job"), "Pending refunds block new manual and Stripe payments", "FIRE does not accept a new payment while the job ledger is being changed by an in-flight refund");

expect(invoiceEditApi.includes("A refund is currently processing for this job") && notificationsApi.includes("Wait for it to finish before resolving the overpayment"), "Pending refunds freeze invoice edits and overpayment resolution", "final invoice terms and retained-overpayment decisions cannot race an in-flight refund");

expect(dashboard.includes('Refund processing: wait for the refund to finish') && dashboard.includes('Number(estimate.pendingRefundCount)===0&&<RecordPayment') && dashboard.includes('Number(invoice.pendingRefundCount)===0&&<RecordPayment') && dashboard.includes('Number(item.pendingRefundCount)===0&&remainingBalance(item)>0'), "Owner UI visibly pauses collection during refunds", "jobs with processing refunds no longer present record-payment or balances-to-collect actions that the server would reject");

expect(notificationsApi.includes('Refunds must be processed from Payments → Refund on the original payment') && notificationsApi.includes('if(value.resolutionMode!=="keep")') && !notificationsApi.includes("'Refund adjustment'") && !notificationsApi.includes('refundAmountCents'), "Legacy bookkeeping-only overpayment refund path is removed", "crafted notification requests can no longer create local refund adjustments that bypass the payment-level Stripe/manual refund workflow");

expect(validateBackupScript.includes('Backup refund reservations exceed original payment') && validateBackupScript.includes('Backup contains orphan refund ledger row'), "Backup validator checks aggregate refund reservations and orphan ledger rows", "a backup cannot validate when pending/succeeded refunds collectively exceed the original payment or a negative refund ledger row lacks a matching succeeded refund request");

expect(restoreScript.includes('Refund reservations exceed original payment') && restoreScript.includes('Orphan refund ledger provider'), "Managed restore preflights refund graph integrity", "restore refuses malformed refund/payment relationships before generating any database writes");

expect(backupApi.includes('function validateRefundIntegrity') && backupApi.includes('Records backup stopped:') && backupApi.includes('This backup failed refund-integrity validation'), "In-app backup export and restore enforce refund integrity", "the Business backup UI refuses to export internally inconsistent refund state and refuses malformed refund backups before writing records");

expect(backupApi.includes('Refund reservations exceed original payment') && backupApi.includes('Orphan refund ledger provider'), "In-app refund integrity checks cover aggregate and orphan states", "payment-level refund reservations cannot exceed the original payment and refund ledger rows must map to succeeded refund requests");

expect(refundLedgerMigration.includes('idx_payments_unique_refund_provider') && refundLedgerMigration.includes("provider_id LIKE 'refund:%'") && refundLedgerMigration.includes('GROUP BY provider_id'), "Refund ledger has a database-level uniqueness invariant", "pre-v115 duplicate refund ledger rows are normalized and future retries cannot create two negative payment rows for the same durable refund request");

expect(refundApi.includes("WHERE EXISTS (SELECT 1 FROM payment_refunds r WHERE r.id=? AND r.status='succeeded')") && refundApi.includes('verifiedLedger') && refundApi.includes('verifiedRequest?.status!=="succeeded"'), "Owner refund finalization verifies one succeeded request and one ledger entry", "manual/owner refund reconciliation does not report success until the durable refund state and exact negative payment entry agree");

expect(webhook.includes("r.mode='stripe' AND r.status='succeeded' AND r.provider_refund_id=?") && webhook.includes('refund_ledger_verification_failed'), "Stripe refund webhook verifies durable ledger convergence", "signed Stripe refund success is not acknowledged as reconciled unless the Stripe-mode request and exact negative payment ledger entry both persist");

expect(webhook.includes("COALESCE(provider_refund_id,'')<>?") && webhook.includes("COALESCE(r.provider_refund_id,'')<>?"), "External Stripe refund reservation counts NULL provider IDs", "pending FIRE refunds without a provider refund ID are included when calculating remaining refundable value instead of being accidentally excluded by SQL NULL comparison");

expect(webhook.includes("refund_reservation_conflict") && webhook.includes("p.amount_cents-COALESCE((SELECT SUM(r.amount_cents)") && webhook.includes("NOT EXISTS (SELECT 1 FROM payment_refunds WHERE provider_refund_id=? OR id=?)"), "Direct Stripe refund import reserves refundable value in the write statement", "concurrent external refund webhooks cannot rely only on a stale pre-read when reserving remaining refundable value");

expect(invoicesApi.includes('const invoiceFinancialsSafe=') && invoicesApi.includes('Invoice billing totals require owner review'), "Invoice list fails closed on unsafe billing values", "owner invoice summaries are not rendered from malformed subtotal, discount, total, paid, or billing-exception counts");

expect(paymentsApi.includes('const paymentRowsSafe=') && paymentsApi.includes('Payment history contains accounting values that require owner review'), "Payment history fails closed on unsafe refund/payment values", "owner payment history does not summarize malformed signed amounts, refunded totals, or refundable balances");

expect(refundMigration.includes('CREATE TABLE `payment_refunds`') && refundMigration.includes('idx_payment_refunds_payment_status') && refundMigration.includes('idx_payment_refunds_provider'), "Refund requests have durable idempotency storage", "general refunds use a dedicated request ledger with payment/estimate linkage and provider-refund uniqueness instead of relying on browser state");

expect(schema.includes('export const paymentRefunds = sqliteTable("payment_refunds"'), "Refund request table is represented in the app schema", "refund recovery and future database work can use the same canonical payment-refund structure");

expect(refundApi.includes('p.amount_cents-COALESCE((SELECT SUM(r.amount_cents)') && refundApi.includes("r.status IN ('pending','succeeded')"), "Concurrent refunds reserve remaining refundable value atomically", "pending and completed refund requests both reduce the amount another refund request can reserve, preventing concurrent over-refunds of one payment");

expect(paymentsApi.includes("payment_refunds WHERE estimate_id=? AND status='pending'") && checkout.includes("payment_refunds WHERE estimate_id=? AND status='pending'"), "Pending refunds block new owner/customer payments", "while refund money is still processing, FIRE prevents another manual payment or Stripe checkout from using a stale pre-refund balance");

expect(estimatePortal.includes('pendingRefundCount') && invoicePortal.includes('pendingRefundCount') && estimatePortal.includes('paymentReviewPending=Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0') && invoicePortal.includes('paymentReviewPending = Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0'), "Customer payment portals enter billing-review state during pending refunds", "customers are not prompted for more money until an in-flight refund has settled");

expect(customerMessagesApi.includes('pendingRefundCount') && customerMessagesApi.includes('Number(reviewState.pendingRefundCount)>0'), "Review requests pause while refunds are processing", "post-job review outreach cannot launch while the paid balance may still change because a refund is pending");

expect(refundApi.includes('https://api.stripe.com/v1/refunds') && refundApi.includes('"idempotency-key":`fire-refund-${requestId}`') && refundApi.includes('metadata[fire_refund_id]'), "Stripe payments support real idempotent refunds", "FIRE submits Stripe refunds with a stable request key and refund/payment metadata rather than only writing a local negative adjustment");

expect(refundApi.includes('externalRefundConfirmed') && refundApi.includes('moneyMovedByFire:false') && refundApi.includes('send the money back first'), "Manual-method refunds require external money-return confirmation", "Cash App, Venmo, cash, check, bank, Wave, and other non-Stripe methods are never represented as electronically refunded by FIRE");

expect(refundApi.includes("INSERT INTO payments") && refundApi.includes("'Refund'") && refundApi.includes('-amount') && refundApi.includes("UPDATE invoices SET status=CASE"), "Completed refunds reconcile ledger and invoice status", "successful refunds write a negative paid ledger entry and recalculate the final invoice lifecycle against the new paid total");

expect(refundApi.includes("type='payment_overage'") && refundApi.includes("<= COALESCE((SELECT inv.total_cents"), "Refunds clear overpayment exceptions only when the excess is actually gone", "partial refunds that leave an overpayment keep the billing exception open; sufficient refunds resolve it from persisted ledger truth");

expect(webhook.includes('refund.created') && webhook.includes('refund.updated') && webhook.includes('recordRefundUpdate') && webhook.includes('refund_amount_mismatch'), "Stripe refund webhook reconciles asynchronous refund completion", "pending Stripe refunds are finalized only from signed Stripe events carrying matching FIRE request/payment metadata and exact amount");

expect(paymentsApi.includes('refundedCents') && paymentsApi.includes('refundableCents') && paymentsApi.includes('stripePayment'), "Payment history exposes per-payment refundability", "owner refund controls know what remains refundable and whether FIRE can move the money through Stripe");

expect(customersApi.includes('refundedCents') && customersApi.includes('refundableCents') && customersApi.includes('stripePayment'), "Customer payment history exposes refundability", "the same refund controls work from the customer record without a separate accounting path");

expect(dashboard.includes('function RefundPayment') && dashboard.includes('fetch("/api/payments/refund"') && dashboard.includes('Refund payment') && dashboard.includes('Record completed refund'), "Owner UI provides payment-level partial/full refunds", "refund actions are available directly from payment history with distinct Stripe and externally-completed manual flows");

expect(dashboard.includes('open <strong>Payments</strong> and use <strong>Refund</strong> on the original payment') && !dashboard.includes('Refund handled</Button>'), "Overpayment UI routes refunds through the real refund workflow", "the owner is no longer offered a bookkeeping-only refund button that could be mistaken for moving Stripe money");

expect(dashboard.includes('const safeSignedSumCents=') && dashboard.includes('customerPaidTotal=Math.max(0,safeSignedSumCents') && dashboard.includes('collected=Math.max(0,safeSignedSumCents'), "Financial history aggregates include negative refund entries safely", "customer paid totals and collected-payment metrics subtract completed refunds instead of silently ignoring negative ledger entries");

expect(backupApi.includes('"payment_refunds"') && restoreScript.includes('["payment_refunds"') && validateBackupScript.includes('"payment_refunds"'), "Refund request history is covered by disaster recovery", "records backups include refund request state and restore/validation tooling recognizes the new table");

expect(restoreScript.includes('table==="payment_refunds"&&column==="status"&&candidate.status==="pending"') && backupApi.includes('table==="payment_refunds"&&column==="status"&&candidate.status==="pending"'), "Pending refunds fail closed after restore", "disaster recovery does not assume an in-flight Stripe/manual refund is still safely resumable when remote provider state may have changed");

expect(notificationsApi.includes('const currentOverpaymentCents=paidBefore-billedTotal') && notificationsApi.includes('This job is no longer overpaid.'), "Overpayment resolution requires a current real overpayment", "a stale payment-overage notification cannot trigger a refund adjustment or retained-overpayment resolution after the job has already returned to a non-overpaid state");

expect(notificationsApi.includes("resolution_note='kept_overpayment'") && notificationsApi.includes("SUM(p.amount_cents)") && notificationsApi.includes('if(!kept.meta.changes)'), "Retained-overpayment resolution rechecks billing state in the mutation", "the keep-overpayment action resolves alerts only while the database still shows paid cents above the final billed total, closing a stale-state race");

expect(paymentsApi.includes('Number.isSafeInteger(paidCents)') && paymentsApi.includes('Number.isSafeInteger(dueLimit)') && paymentsApi.includes('Number.isSafeInteger(paidCents+amountCents)'), "Manual payment preflight protects persisted billing arithmetic", "owner-recorded payments fail closed before mutation if existing paid cents, current obligation, or aggregate paid cents cannot be represented exactly");

expect(paymentsApi.includes('9007199254740991 - ?') && paymentsApi.includes("p.status='paid') <= 9007199254740991 - ?"), "Manual payment conditional insert preserves safe aggregate cents under concurrency", "the same SQL statement that inserts an owner-recorded payment also prevents concurrent paid totals from crossing JavaScript's exact-integer boundary");

expect(paymentsApi.includes('Number.isSafeInteger(nextPaid)') && paymentsApi.includes('Number.isSafeInteger(refreshedDueLimit)'), "Manual payment reconciliation validates refreshed accounting totals", "post-write invoice/balance reconciliation only runs on exact persisted paid and obligation cents");

expect(webhook.includes('Number.isSafeInteger(sessionAmount)') && webhook.includes('sessionAmount<=0') && webhook.includes('Number.isSafeInteger(expectedAmount)'), "Stripe webhook requires exact positive integer cents", "signed Stripe payment events still must carry exact positive integer cents and matching expected-amount metadata before FIRE records money");

expect(webhook.includes('Number.isSafeInteger(existingPaid)') && webhook.includes('Number.isSafeInteger(existingPaid+sessionAmount)') && webhook.includes('reason:"unsafe_paid_total"'), "Stripe webhook preflights aggregate paid precision before mutation", "FIRE rejects a payment event before inserting it when existing plus incoming paid cents would exceed exact accounting range");

expect(webhook.includes('Number.isSafeInteger(obligationCents)') && webhook.includes('Number.isSafeInteger(nextPaid)') && webhook.includes('Number.isSafeInteger(overpaymentCents)'), "Webhook reconciliation totals stay exact", "deposit/final obligation, refreshed paid sum, and overpayment arithmetic are guarded before invoice and billing-exception reconciliation");

expect(refundApi.includes('Number.isSafeInteger(amountCents)') && refundApi.includes('Number.isSafeInteger(amount)') && notificationsApi.includes("Billing totals are outside FIRE's safe accounting range"), "Overpayment reconciliation enforces safe accounting integers", "payment-level refunds and retained-overpayment reconciliation require exactly representable cent values before FIRE mutates accounting state");

expect(checkout.includes('Number.isSafeInteger(paidCents)') && checkout.includes('Number.isSafeInteger(totalCents)') && checkout.includes('Number.isSafeInteger(depositCents)') && checkout.includes('Number.isSafeInteger(amount)') && checkout.includes('Number.isSafeInteger(currentDue)'), "Stripe checkout rejects unsafe billing arithmetic", "FIRE will not create a Stripe checkout when persisted totals, paid sums, calculated amount due, or the final race-check due amount fall outside exact integer cents");

expect(estimatePatch.includes('Number.isSafeInteger(item.totalCents)') && estimatePatch.includes('Number.isSafeInteger(subtotal)') && estimatePatch.includes('Number.isSafeInteger(additionalDiscountValue)'), "Edited estimates enforce safe integer cents", "estimate editing now matches estimate creation and final-invoice precision safeguards instead of leaving an unsafe numeric bypass");

expect(estimatePatch.includes('Number.isNaN(parsedSchedule.getTime())') && estimatePatch.includes('scheduledAt=parsedSchedule.toISOString()'), "Job schedule timestamps are validated and normalized", "malformed schedule values are rejected and valid job dates are persisted in canonical ISO form");

expect(tasksApi.includes('Number.isNaN(parsedDueAt.getTime())') && tasksApi.includes('dueAt=parsedDueAt.toISOString()'), "Task due dates are validated and normalized", "malformed task due dates cannot enter the operations queue and valid values are canonicalized");

expect(estimatesApi.includes('Number.isSafeInteger(item.totalCents)') && estimatesApi.includes('Number.isSafeInteger(subtotal)') && estimatesApi.includes('Number.isSafeInteger(additionalDiscountValue)'), "Estimate money inputs stay inside safe integer cents", "service totals, aggregate subtotal, and discount values cannot exceed JavaScript's exact integer range and silently corrupt financial math");

expect(invoiceEditApi.includes('Number.isSafeInteger(item.totalCents)') && invoiceEditApi.includes('Number.isSafeInteger(subtotalCents)') && invoiceEditApi.includes('Number.isSafeInteger(discountValue)'), "Invoice money inputs stay inside safe integer cents", "edited invoice lines, aggregate subtotal, and discounts reject values that cannot be represented exactly");

expect(paymentsApi.includes('Number.isSafeInteger(amountCents)') && expensesApi.includes('Number.isSafeInteger(amountCents)'), "Payment and expense cents require exact safe integers", "manual money records reject unsafe numeric values instead of storing rounded or imprecise cents");

expect(expensesApi.includes('Number.isNaN(parsedIncurredAt.getTime())') && expensesApi.includes('parsedIncurredAt.toISOString()'), "Expense dates are validated and normalized", "invalid dates are rejected and accepted dates are persisted in canonical ISO form for sorting/export");

expect(tasksApi.includes('let customerId=') && tasksApi.includes('customerId=linked.customerId'), "Job-linked tasks inherit the authoritative customer", "when a task is attached to a job, its customer link is derived from that estimate instead of allowing a job-linked task to persist with a missing customer relationship");

expect(jobReportsApi.includes('customer_id AS customerId,created_at AS createdAt FROM job_reports') && jobReportsApi.includes('existing.customerId!==body.customerId') && jobReportsApi.includes('existing job report is linked to a different customer'), "Existing job reports enforce customer ownership before edits", "a pre-existing or restored cross-linked report is blocked from mutation instead of silently preserving corrupted customer ownership");

expect(publicAcceptApi.includes('const [accepted]=await env.DB.batch([') && publicAcceptApi.includes("WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND accepted_at=? AND signed_at=?)"), "Estimate acceptance and owner notification commit atomically", "customer approval/signature and its owner-facing acceptance notification now succeed or roll back together, preventing a committed approval from returning a false failure because notification creation failed");

expect(customerMessagesApi.includes('SELECT id FROM customers WHERE id=? LIMIT 1') && customerMessagesApi.includes('SELECT id FROM estimates WHERE id=? AND customer_id=? LIMIT 1') && customerMessagesApi.includes('That estimate does not belong to this customer.'), "Customer communication linkage is cross-record safe", "saved communication cannot point at a missing customer or attach an estimate belonging to a different customer");

expect(webhook.includes('untracked_or_stale_checkout') && webhook.includes('FROM payment_checkout_sessions WHERE id=? LIMIT 1') && webhook.includes('tracked.estimateId !== estimateId') && webhook.includes('tracked.type !== paymentType'), "Stripe webhook requires locally tracked checkout provenance", "a paid Stripe session is accepted only when its session ID, estimate, payment type, amount, and local lifecycle state match the checkout FIRE actually created");

expect(estimatePortal.includes('FROM payment_checkout_sessions WHERE id=? LIMIT 1') && estimatePortal.includes('tracked.estimateId!==estimate.id') && estimatePortal.includes('tracked.type!==paymentType'), "Stripe success redirect requires locally tracked checkout provenance", "the customer success redirect cannot record an arbitrary paid Stripe session merely because its metadata names the estimate");

expect(estimatePortal.includes('const sessionAmount=Number(session.amount_total)') && estimatePortal.includes('Number.isSafeInteger(sessionAmount)') && estimatePortal.includes('const existingPaidRow=await env.DB.prepare') && estimatePortal.includes('Number.isSafeInteger(existingPaid+sessionAmount)') && estimatePortal.includes('Number.isSafeInteger(obligationCents)') && estimatePortal.includes('Number.isSafeInteger(nextPaid)'), "Customer-return Stripe confirmation matches exact-cent accounting safeguards", "the browser-return fallback now validates session amount, tracked checkout amount, existing paid aggregate, billing obligation, refreshed paid sum, and overpayment arithmetic before reconciliation");

expect(estimatePortal.includes('const estimateItemsSafe=items.length>0') && estimatePortal.includes('const estimateSnapshotSafe=') && estimatePortal.includes('itemSubtotalCents===Number(row.subtotalCents)') && estimatePortal.includes('Number(row.discountCents)<=itemSubtotalCents'), "Estimate portal validates persisted service and subtotal snapshot", "customer payment presentation fails closed when estimate lines, subtotal, or discount state no longer agree");

expect(estimatePortal.includes('billingStateSafe&&!paymentReviewPending&&estimateApproved&&((row.status!=="completed"&&depositRemaining>0)||(row.status==="completed"&&balance>0))'), "Estimate portal manual-payment instructions follow payment eligibility", "Cash App/Venmo instructions are hidden for unsigned jobs, paid-up jobs, unsafe billing state, and unresolved overpayment review");

expect(invoicePortal.includes('storedSubtotalCents===itemSubtotalCents') && invoicePortal.includes('storedTotalCents===expectedStoredTotal') && invoicePortal.includes('storedDiscountCents<=itemSubtotalCents'), "Invoice portal verifies line subtotal, discount, and final-total consistency", "customer billing actions fail closed if invoice lines and stored invoice financial fields no longer reconcile");

expect(dashboard.includes('return {ok:true,duplicate:Boolean(result.duplicate)}') && dashboard.includes('if(!logged.ok||logged.duplicate)return'), "Duplicate review preparation cannot launch a second text or email", "rapid retry idempotency now suppresses both duplicate CRM rows and the second SMS/mailto launch");

expect(dashboard.includes('const safeBillingState=') && dashboard.includes('const safeSumCents=') && dashboard.includes('safeBillingState(row)&&resolvedBillingTotalCents(row)>0') && dashboard.includes('safeBillingState(estimate)&&estimate.status==="completed"'), "Owner dashboard paid/review classification requires exact safe billing state", "unsafe financial values cannot classify a job as paid or eligible for a review request in owner workflows");

expect(dashboard.includes('customerPaidTotal=Math.max(0,safeSignedSumCents') && dashboard.includes('collected=Math.max(0,safeSignedSumCents') && dashboard.includes('const outstanding=safeSumCents'), "Owner financial aggregates use overflow-safe cent summation", "customer paid totals and collected payments safely include negative refund entries, while outstanding balances remain nonnegative exact-cent aggregates");

expect(templates.includes('key:"review"') && templates.includes('If you were happy with the service, I’d really appreciate a quick review.') && templates.includes('You can leave a review here: @review_link') && templates.includes('— Kyle, First In Response Exteriors'), "Default review request uses FIRE review-page template", "the built-in post-job review message is ready to send and routes the customer through the single FIRE review page");

expect(dashboard.includes('const reviewLink = "https://firstinresponseexteriors.com/review";') && dashboard.includes('"@review_link":reviewLink'), "Review-link substitution is locked to FIRE review page", "the @review_link field resolves to https://firstinresponseexteriors.com/review in prepared customer messages");

expect(invoicePortal.includes('const invoiceItemsSafe=items.length>0') && invoicePortal.includes('const invoiceItemSnapshotSafe=invoiceItemsSafe&&Number.isSafeInteger(itemSubtotalCents)') && invoicePortal.includes('const billingStateSafe=invoiceItemSnapshotSafe'), "Invoice portal validates service-line snapshot before billing actions", "customer invoice payment state now fails closed when persisted invoice items are missing, malformed, nonpositive, or contain unsafe cent totals");

expect(invoicePortal.includes('billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&<p className="pay-note"'), "Manual invoice payment instructions require completed-job state", "Cash App/Venmo final-balance instructions are not shown from a stale/corrupted invoice whose linked job is no longer completed");

expect(customerMessagesApi.includes("datetime(created_at)>=datetime('now','-30 seconds')") && customerMessagesApi.includes('if(!inserted.meta.changes)') && customerMessagesApi.includes('duplicate:true'), "Review-request logging is rapid-retry idempotent", "double taps or stale repeated review-send actions within 30 seconds reuse the recent communication record instead of creating duplicate review-request history");

expect(customerMessagesApi.includes('if(body.length>10000)'), "Saved customer messages have a bounded payload", "communication history rejects abnormally large message bodies before persistence");

expect(estimatePortal.includes('paymentReviewPending=Number(row.paymentOverageOpen??0)>0') && estimatePortal.includes('billingStateSafe') && estimatePortal.includes('!paymentReviewPending&&estimateApproved') && estimatePortal.includes('Payment received — account review in progress.'), "Estimate portal suppresses payment actions during billing exceptions", "the customer estimate/payment page now mirrors the server-side overpayment block and does not present another deposit or balance action while an unresolved payment exception exists");

expect(invoicePortal.includes('const billingStateSafe=invoiceItemSnapshotSafe&&Number.isSafeInteger(paidCents)') && invoicePortal.includes('Billing review required') && invoicePortal.includes('billingStateSafe&&balance>0&&!paymentReviewPending'), "Invoice portal fails closed on unsafe billing totals", "customer invoice balance/payment actions are hidden when persisted line items, paid cents, or billed cents fall outside FIRE's validated accounting state");

expect(customerMessagesApi.includes('const reviewBillingSafe=') && customerMessagesApi.includes('Number.isSafeInteger(reviewPaidCents)') && customerMessagesApi.includes('Number.isSafeInteger(reviewBillingTotalCents)'), "Review requests require safe settled billing totals", "a completed job cannot send a review request when its persisted paid/final-billed accounting values are malformed even if simple numeric comparison would otherwise look paid");

expect(estimatePortal.includes('robots:{index:false,follow:false,nocache:true}') && invoicePortal.includes('robots:{index:false,follow:false,nocache:true}') && paymentPortal.includes('robots:{index:false,follow:false,nocache:true}'), "Private customer portals are explicitly noindex", "estimate, invoice, and payment token pages tell search engines not to index, follow, or cache customer-specific financial pages");

expect(restoreScript.includes('const select = plan.columns.map') && restoreScript.includes('Restore verification failed: ${table}.${column}') && restoreScript.includes('fieldValuesVerified: true'), "Standalone restore verifies recovered field values", "post-restore validation re-reads every inserted column instead of treating ID existence alone as proof of a faithful restore");

expect(restoreScript.includes('"appreciation_discount", "additional_discount_type", "additional_discount_value"') && restoreScript.includes('"resolution_note"') && restoreScript.includes('if(table==="estimates"&&column==="additional_discount_type")return "percent"') && restoreScript.includes('if(table==="notifications"&&column==="resolution_note")return null'), "Standalone record restore preserves discount and billing-resolution metadata", "disaster restore now carries appreciation/additional-discount state and overpayment resolution notes instead of silently dropping those fields");

expect(backupApi.includes('candidate.status==="open")return "expired"') && restoreScript.includes('candidate.status==="open")return "expired"') && backupApi.includes('column==="expired_at"&&candidate.status==="open"') && restoreScript.includes('column==="expired_at"&&candidate.status==="open"'), "Restored Stripe checkout sessions fail closed", "both in-app and standalone restore normalize backed-up open checkout sessions to expired because remote Stripe session state cannot be trusted after recovery");

expect(validateBackupScript.includes('const criticalFields = {') && validateBackupScript.includes('additional_discount_type') && validateBackupScript.includes('resolution_note') && validateBackupScript.includes('invoice_revisions') && validateBackupScript.includes('payment_checkout_sessions'), "Backup validator checks recovery-critical fields", "current app exports are rejected before restore when critical pricing, billing-resolution, revision-history, or checkout-safety fields are missing");

expect(restorePhotoScript.includes('skip_missing_archive_object') && restorePhotoScript.includes('Photo archive manifest counts are inconsistent.') && restorePhotoScript.includes('Restored and verified') && restorePhotoScript.includes('the just-uploaded object was removed'), "Photo restore handles partial archives and verifies metadata", "known missing R2 objects no longer break the whole restore, manifest counts are validated, and uploaded objects are cleaned up if D1 metadata cannot be verified");

expect(customerNotesApi.includes('SELECT id FROM customers WHERE id=?') && customerNotesApi.includes('Customer not found.'), "Customer notes reject orphan records", "owner notes must reference a customer that still exists instead of creating detached CRM history");

expect(expensesApi.includes('const estimateId=String(body.estimateId') && expensesApi.includes('SELECT id FROM estimates WHERE id=?') && expensesApi.includes('Job not found. Refresh before attaching this expense.'), "Job expenses reject stale job links", "job-linked expenses validate the estimate before insertion so profit/cost reporting cannot accumulate orphan job costs");

expect(tasksApi.includes('SELECT customer_id AS customerId FROM estimates WHERE id=?') && tasksApi.includes('That job does not belong to the selected customer.') && tasksApi.includes('if(!updated.meta.changes)return Response.json({error:"Task not found."}'), "Tasks preserve customer/job ownership integrity", "task creation validates linked records and customer ownership; task updates report stale/deleted IDs instead of pretending success");

expect(changeRequestApi.includes('estimate.acceptedAt||!["draft","sent"].includes(estimate.status)') && changeRequestApi.includes('already moved into the job workflow'), "Public estimate changes stop after customer acceptance", "the pre-approval change-request channel cannot create stale quote-change work after the signed estimate has become an active job");

expect(estimatePatch.includes('!existing.acceptedAt||!existing.signedAt') && estimatePatch.includes('Only an approved estimate can be scheduled.'), "Scheduling requires persisted signed acceptance", "server scheduling requires both signed customer acceptance evidence and the approved lifecycle state, not status text alone");

expect(estimatePatch.includes('Customer approval must come from the signed estimate link') && estimatePatch.includes('An accepted or financially active job cannot be changed to declined') && estimatePatch.includes('cannot be moved backward') && dashboard.includes('className="status-readonly"') && !dashboard.includes('["draft","sent","approved","scheduled","completed","declined"].map((status)'), "Job lifecycle is action-driven and cannot be manually bypassed", "owner UI no longer exposes arbitrary status mutation; server rejects unsigned manual approval, decline after commitment, and backward movement after customer/financial activity");

expect(publicAcceptApi.includes("AND accepted_at IS NULL AND status IN ('draft','sent')") && publicAcceptApi.includes("if(!accepted.meta.changes)") && publicAcceptApi.includes("This estimate changed while you were approving it"), "Customer estimate acceptance is race-safe", "only a winning conditional approval writes the signature state and acceptance notification; concurrent/stale approval attempts re-read authoritative state");

expect(jobReportsApi.includes('const requiredChecks=[') && jobReportsApi.includes('requiredChecks.every((item)=>checklist[item]===true)'), "Completed job reports require the full service checklist", "the API independently verifies every required completion item instead of trusting a client-supplied completed status");

expect(jobReportsApi.includes('notes.length>5000') && jobReportsApi.includes('airflowBefore.length>100') && jobReportsApi.includes('airflowAfter.length>100'), "Job report free-text inputs are bounded", "technician notes and airflow fields are bounded before persistence to prevent malformed or oversized report data");

expect(jobReportsApi.includes("job.customerId!==body.customerId") && jobReportsApi.includes('complete&&!["scheduled","completed"].includes(job.status)') && jobReportsApi.includes("Schedule the approved job before completing its service report"), "Job report completion is bound to the correct scheduled job", "report writes validate estimate/customer ownership and cannot manufacture a completed service report for an unscheduled quote");

expect(checkout.includes("const current=await env.DB.prepare") && checkout.includes("currentDue!==amount") && checkout.includes("The amount due changed while checkout was being created") && checkout.includes("/expire"), "Stripe checkout is revalidated after remote session creation", "a newly created Stripe session is immediately expired if job status, billing exception, paid amount, or amount due changed during remote checkout creation");

expect(estimatePatch.includes('["approved","scheduled","completed"].includes(existing.status)') && estimatePatch.includes("Number(existing.paidCents)>0") && estimatePatch.includes("Number(existing.invoiceCount)>0") && estimatePatch.includes("make any final service or price changes on the invoice"), "Accepted estimate financial terms are frozen", "estimate line items/pricing cannot be rewritten after approval, payment, scheduling/completion, or invoice creation; final changes belong on the editable invoice");

expect(oneInvoiceMigration.includes("CREATE UNIQUE INDEX `idx_invoices_one_per_estimate`") && invoicesApi.includes("const raced=await env.DB.prepare") && invoicesApi.includes("existing:true"), "Invoice creation is race-safe", "database uniqueness enforces one final invoice per estimate and concurrent create requests recover the canonical invoice instead of creating duplicates");

expect(invoicePortal.includes('billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"') && invoicePortal.includes('billingStateSafe&&balance>0&&!paymentReviewPending&&row.estimateStatus==="completed"&&<p className="pay-note"'), "Customer invoice blocks payment while billing exception is open", "unresolved overpayment review suppresses both Stripe and manual-payment prompts until the owner reconciles the exception");

expect(customerMessagesApi.includes('template==="review"&&channel!=="copy"') && customerMessagesApi.includes('reviewState.status!=="completed"') && customerMessagesApi.includes("reviewPaidCents<reviewBillingTotalCents") && customerMessagesApi.includes("Number(reviewState.paymentOverageOpen)>0") && customerMessagesApi.includes("reviewBillingSafe") && dashboard.includes('if(!logged.ok||logged.duplicate)return'), "Review requests are server-gated by settled billing", "review text/email logging and launch require completed, safely represented, fully paid billing with no unresolved overpayment; rejected or duplicate logging no longer launches another send action");

expect(dashboard.includes("const finalInvoiceTotal=estimate.invoiceTotalCents") && dashboard.includes("(finalInvoiceTotal??estimate.depositCents)") && dashboard.includes("invoiceTotalCents:estimate.invoiceTotalCents"), "Owner amount-due helper follows an existing final invoice", "manual payment UI uses final invoice obligation whenever one already exists, including approved/scheduled edge states, instead of falling back to the old deposit amount");

expect(webhook.includes("UPDATE notifications SET title=?,body=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL") && estimatePortal.includes("UPDATE notifications SET title=?,body=? WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL") && webhook.includes("const overpaymentBody=") && estimatePortal.includes("const overpaymentBody="), "Open Stripe overpayment alert tracks current excess", "when another payment increases an unresolved overpayment, both Stripe completion paths refresh the canonical alert body to the current ledger excess instead of leaving a stale dollar amount");

expect(webhook.includes("const refreshedPaid=await env.DB.prepare") && estimatePortal.includes("const refreshedPaid=await env.DB.prepare") && webhook.includes("const overpaymentCents=Math.max(0,nextPaid-obligationCents)") && estimatePortal.includes("const overpaymentCents=Math.max(0,nextPaid-obligationCents)") && webhook.includes("WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL)") && estimatePortal.includes("WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE estimate_id=? AND type='payment_overage' AND resolved_at IS NULL)"), "Concurrent Stripe payments reconcile from persisted ledger", "both webhook and customer-return confirmation re-read total paid after insertion, derive current job-level excess from the ledger, and avoid blindly creating duplicate open overpayment alerts");

expect(webhook.includes('estimate.status==="completed"||paymentType==="balance"') && estimatePortal.includes('estimate.status==="completed"||paymentType==="balance"') && webhook.includes("WHEN ?>=total_cents THEN 'paid'") && estimatePortal.includes("WHEN ?>=total_cents THEN 'paid'") && paymentsApi.includes("retained-overpayment handling"), "Stripe deposits preserve invoice lifecycle before completion", "webhook and customer-return Stripe confirmation leave draft/sent invoice status unchanged for reservation deposits while completed-job/balance payments still reconcile invoice payment status");

expect(paymentsApi.includes('if(refreshed?.status==="completed")') && paymentsApi.includes("WHEN ?>=total_cents THEN 'paid'") && !paymentsApi.includes('.bind(nextPaid >= Number(refreshed?.totalCents ?? estimate.totalCents) ? "paid" : "partial", estimateId)'), "Manual deposit does not mutate invoice lifecycle", "recording an approved/scheduled reservation deposit leaves any draft/sent invoice lifecycle unchanged; invoice payment status is reconciled only for completed-job billing");

expect(refundApi.includes("verifiedRequest") && refundApi.includes("verifiedLedger") && refundApi.includes("SELECT COALESCE(SUM(amount_cents),0) AS amount FROM payments WHERE estimate_id=? AND status='paid'") && refundApi.includes("UPDATE invoices SET status=CASE") && webhook.includes("refund_ledger_verification_failed"), "Refund reconciliation converges on persisted payment state", "refund completion converges on durable request/ledger state, recalculates invoice lifecycle from the persisted ledger, and re-reads the paid total before returning success");

expect(dashboard.includes('fetch("/api/dashboard-summary",{cache:"no-store"})') && dashboard.includes('if(Array.isArray(summary.recent))setEstimateRows(summary.recent)') && dashboardSummaryApi.includes("AS outstanding") && dashboardSummaryApi.includes("ORDER BY e.created_at DESC LIMIT 8") && dashboardSummaryApi.includes("recent:recentResult.results"), "Dashboard snapshot refresh after job and billing changes", "returning to Home refreshes both owner metrics and recent estimate/job rows so final invoice, payment, schedule, and status changes cannot leave the dashboard internally inconsistent");

expect(home.includes("status IN ('approved','scheduled') AND EXISTS(SELECT 1 FROM invoices inv WHERE inv.estimate_id=estimates.id)") && home.includes("(SELECT total_cents FROM invoices inv WHERE inv.estimate_id=estimates.id LIMIT 1)-(SELECT COALESCE(SUM(amount_cents),0) FROM payments"), "Home outstanding metric follows invoiced balance", "approved/scheduled jobs use deposit balance before invoicing but switch to final invoice balance once an invoice exists");

expect(dashboard.includes('<strong>{money(resolvedBillingTotalCents(job))}</strong><ChevronRight/>'), "Upcoming job value follows final invoice", "schedule board displays the edited final billing total when an invoice exists instead of a stale estimate amount");

expect(customersApi.includes("SUM(COALESCE((SELECT inv.total_cents FROM invoices inv WHERE inv.estimate_id=ce.id LIMIT 1),ce.total_cents))"), "Customer lifetime value follows final invoices", "customer-list aggregate uses each final edited invoice total when present instead of permanently summing stale estimate totals");

expect(dashboard.includes('className="job-price">{money(resolvedBillingTotalCents(estimate))}') && dashboard.includes('const total=estimate ? money(resolvedBillingTotalCents(estimate)) : "the quoted amount"') && dashboard.includes('estimateTotal:resolvedBillingTotalCents(estimate),paidTotal:estimate.paidCents'), "Dashboard and customer follow-up use final billed value", "recent-job price and post-job customer messaging/aggregates follow the edited final invoice while estimate/agreement documents retain their original quote semantics");

expect(dashboard.includes('resolvedBillingTotalCents(estimate)>=100000') && dashboard.includes('<strong>{money(resolvedBillingTotalCents(estimate))}</strong></footer>') && dashboard.includes('<strong className="estimate-amount">{money(resolvedBillingTotalCents(estimate))}</strong>') && dashboard.includes('customerEstimates.map') && dashboard.includes('</small></div><strong>{money(resolvedBillingTotalCents(estimate))}</strong><ChevronRight />'), "Owner job summaries display final billing total", "pipeline cards, estimate list, customer record, detail header, and High value badge no longer contradict an edited final invoice");

expect(dashboard.includes('row.paidCents<resolvedBillingTotalCents(row)') && dashboard.includes('row.paidCents>=resolvedBillingTotalCents(row)') && dashboard.includes('safeSumCents(column.rows.map((row)=>safeBillingState(row)?resolvedBillingTotalCents(row):0))') && dashboard.includes('row.status!=="completed"||row.paidCents<resolvedBillingTotalCents(row)') && dashboard.includes('money(billingBalanceCents(job))'), "Owner pipeline uses final billing total", "Paid/Completed classification, exact-safe pipeline value, and Needs attention balance follow the edited final invoice instead of the stale estimate total");

expect(invoicesApi.includes("n.type='payment_overage' AND n.resolved_at IS NULL") && dashboard.includes('Number(invoice.paymentOverageOpen)>0?"Payment review"') && dashboard.includes('"Billing exception open"'), "Owner invoice overpayment state", "owner invoice views do not present an unresolved overpayment as normally paid/settled");

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
const failures = checks.filter(c=>!c.ok);
if (failures.length) {
  console.error(`\nRelease readiness failed: ${failures.length} issue(s).`);
  process.exit(1);
}

expect(restoreScript.includes('attemptId:randomUUID()') && restoreScript.includes('restoreAudit.phase="target_conflict_validation"') && restoreScript.includes('Database writes may have occurred. Inspect this restore audit before retrying.'), "Standalone restore audit failure completeness", "managed restore attempts have unique audit identity, target-conflict phase visibility, and audit-first retry guidance after attempted writes");
expect(backupApi.includes('const postWriteFailure=') && backupApi.includes('Database writes occurred. Inspect the restore audit before retrying.'), "In-app post-write verification guidance is centralized", "record and invariant verification failures return the restore audit plus explicit inspect-before-retry guidance");
console.log(`\nRelease readiness passed: ${checks.length} policy and workflow checks.`);
