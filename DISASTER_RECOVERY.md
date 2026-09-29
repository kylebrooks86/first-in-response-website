# FIRE Website — Disaster Recovery Runbook

Updated: 2026-09-29

This runbook is designed to be usable without ChatGPT. It explains how to recover the independent First In Response Exteriors website from the owner's GitHub repository or the verified Google Drive backup.

## Recovery sources

Primary source:
- GitHub repository: `kylebrooks86/first-in-response-website`
- Default branch: `main`
- GitHub Pages mirror: `https://kylebrooks86.github.io/first-in-response-website/`

Secondary off-GitHub source:
- Google Drive folder: `FIRE Business Backups`
- Verified archive: `FIRE_Website_Verified_Recovery_2026-09-29.zip`

Verified build reference:
- Commit: `1ae8c8dd8d561c3577903b29018a6649df6d8516`
- Recovery ZIP SHA-256: `c15e5299bd9072bdd139c9a552fd6120d881db9e4d04b79261df77ad13d82939`

## What the recovery copy contains

- Homepage
- Nine dedicated service pages
- Review page
- Privacy page
- Service terms page
- 404 recovery page
- Instant estimator
- Local CSS and JavaScript
- Approved FIRE logo, owner image, equipment image, before/after media, and six videos
- Locked business rules and pricing references
- Production cutover instructions
- Automated verification tools

The recovery copy is intentionally self-contained at runtime. It does not require ChatGPT to serve the website.

## Verify the recovered files

Install Node.js 20 or newer, then open a terminal in the recovered website folder and run:

```bash
node recovery-verify.mjs
```

A successful verification must exit with code 0.

The wrapper runs the permanent `verify-site.mjs` checker. Two approved masonry proof files have non-standard JPEG headers in the historical mirror. The wrapper permits only those exact two files when their Git blob hashes match the approved values. It does not permit arbitrary media failures.

## Restore to a temporary host first

Do not point `firstinresponseexteriors.com` at a recovery copy as the first recovery step.

1. Restore the files to a temporary static host such as GitHub Pages.
2. Confirm the homepage and all service pages load.
3. Confirm images and videos load.
4. Test the estimator.
5. Test Call, Text Photos, Estimate, menus, before/after controls, and review links on an iPhone and desktop/laptop.
6. Re-run `node recovery-verify.mjs` after any change.
7. Keep the temporary mirror blocked from indexing until production cutover is approved.

## Production safety rules

Until an intentional production cutover:

- Do not create a production `CNAME` file.
- Do not change the production DNS.
- Do not disconnect or cancel the current live host.
- Keep `noindex,nofollow` on mirror pages.
- Keep `robots.txt` blocking the mirror.

When a real cutover is approved, follow `PRODUCTION_CUTOVER.md` exactly and maintain a rollback path.

## Current locked pricing safeguards

The independent website currently protects these customer-facing baseline rules:

- House wash: $0.22 / sq ft
- Gutter cleaning + standard downspout flushing: $1.50 / linear ft
- Existing gutter guard removal + reinstall: $0.50 / linear ft
- Gutter brightening: $2.00 / linear ft
- Fence cleaning: $0.40 / sq ft
- Standard exterior windows: $7 first floor / $11 second floor
- French-pane exterior windows: $12 first floor / $18 second floor
- Screens: $3 first floor / $6 second floor
- Basic RV wash: $150
- Minimum job: $150
- First Responder & Military discount: 5%
- Scheduling deposit: 50%
- Remaining balance: due upon completion of the work

The authoritative editable reference is `BUSINESS_RULES.md`.

## Automatic verified backup system

The repository workflow `.github/workflows/verify-site.yml` now does the following after changes to `main`:

1. checks out the repository,
2. runs the independent recovery verifier,
3. stops if verification fails,
4. creates a full recovery ZIP only after verification succeeds,
5. stores the verified ZIP as a GitHub Actions artifact for 90 days.

This prevents an unverified build from automatically becoming a recovery package.

## Final note

The independent website is already separated from ChatGPT. The remaining pre-production gate is owner approval after physical iPhone and desktop comparison. The live production domain should remain untouched until that review is complete.
