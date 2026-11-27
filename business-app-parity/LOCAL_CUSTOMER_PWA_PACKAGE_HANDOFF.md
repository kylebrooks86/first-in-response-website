# Synthetic customer installation package checkpoint

Base: 47a78316bd3550382c385ca5e88abbd3bbbce31c. Remote checked again before saving; no newer checkpoint. No deployment or production changes.

Added a scoped standalone manifest, Apple Home Screen metadata and unchanged existing 180/512 PNG icons. Static cache now contains eight assets. Refactored the test server onto a deterministic asset builder. Exporter emits nine static files including worker, a SHA256 inventory, README and a dependency-free localhost Node server. It includes no IndexedDB records. Existing export destinations are refused; missing/altered package files fail before serving.

Run from a materialized candidate with TypeScript installed: `node scripts/export-local-customer-demo.mjs /absolute/fresh/directory`. Then run `node serve-demo.mjs 4178` from that exported directory. Preserve the port/origin for browser storage. No framework/node_modules/ChatGPT service is needed to serve the exported package, but Node and initial browser load are needed. This is a local synthetic test package, not the complete Business App or an iPhone test URL.

Verified: 159/159 native Chromium checks across three candidates; TypeScript 3/3; local builds 3/3. Package cold launch and retained encrypted edit passed with browser fully closed/reopened, server stopped and network disabled. Existing two-restart cold test, interrupted saves, worker upgrades, missing-module recovery and mobile-width screen checks passed. Matching shared source excludes existing authentication/environment adapters. Vault schema/core, production UI and deployment adapters unchanged.

See LOCAL_CUSTOMER_PWA_PACKAGE_EVIDENCE.json and LOCAL_CUSTOMER_PWA_PACKAGE_TEST_OUTPUT.json for exact evidence. SYNTHETIC_IPHONE_INSTALL_TEST_PLAN.md records actual device verification steps and prerequisites. No shareable approved HTTPS URL exists; localhost-only registration guard remains intentional. Do not deploy this package without separate approval and exact-origin review.

Official production release readiness: 3/10 (30%). iPhone Safari/Home Screen behavior, clean-device recovery, full-app offline capability and original-app scrolling benchmark remain pending. Real customer activation remains disabled. No Stripe, database migration or paid service used.

Next bounded batch: review a separate existing/free synthetic HTTPS test origin, MIME/scope/allowed-origin adapter and publication plan. Prepare a concrete owner-reviewable result before publication approval; then test the actual iPhone installed context.
