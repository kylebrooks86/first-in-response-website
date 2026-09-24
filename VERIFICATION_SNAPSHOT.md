# FIRE Independent Website — Verification Snapshot

Verified: 2026-09-24

This snapshot documents the current disaster-recovery rebuild state. It is not permission to change production DNS.

## Page coverage

- 13 public pages are represented in the sitemap.
- 13 public pages have matching production-domain canonical URLs.
- 404 page is present separately.
- Every audited HTML page has exactly one H1 and no duplicate element IDs.
- Public mirror pages remain `noindex,nofollow`.
- `robots.txt` still blocks crawling of the mirror.

## Core business logic checked

- House wash: $0.25 / sq ft
- Gutter cleaning + standard downspout flushing: $1.75 / linear ft
- Existing gutter guard removal + reinstall: $1.00 / linear ft
- Gutter brightening: $2.00 / linear ft
- Fence cleaning: $0.40 / sq ft
- Standard exterior windows: $7 first floor / $11 second floor
- French-pane exterior windows: $12 first floor / $18 second floor
- Screens: $3 first floor / $6 second floor
- Basic RV wash: $150
- Minimum job: $150
- First Responder & Military discount: 5%
- Deposit to reserve approved work: 50%

Estimator spot checks:
- 1,700 sq ft house wash = $425 before discount.
- 150 lf gutter cleaning = $262.50 before discount.
- 150 lf gutter cleaning + 150 lf existing-guard removal/reinstall = $412.50 before discount.
- $412.50 with 5% eligible discount = $391.88 after rounding to cents.

## Final verification pass

- Repository-wide stale-rate scan found no remaining $1.50/lf gutter-cleaning or $0.50/lf existing-guard rates.
- All 13 public pages and the 404 page were rendered from GitHub Pages with one H1, active noindex protection, and no desktop horizontal overflow.
- Every local page, anchor, image, and video reference resolved to a repository path.
- Homepage and secondary-page hamburger menus open and close correctly; all now update both aria-expanded and the Open/Close accessible label.
- Estimator accordions start closed and enforce one-open-at-a-time behavior.
- The estimator intentionally displays a protected ±5% preliminary range while calculating from the locked rates in BUSINESS_RULES.md.
- Rendered estimator checks: 1,700 sq ft house wash displayed $404–$446 around the $425 calculation; 150 lf gutter cleaning plus 150 lf existing-guard removal/reinstall displayed $392–$433 around $412.50; the eligible 5% discount produced a $391.88 calculation and displayed the protected $372–$411 range; a $40 raw fence calculation enforced the $150 minimum and displayed $143–$158.
- Read-only comparison with the current production homepage was used to align the mirror's section flow; no production files, settings, hosting, or DNS were changed.
- The production service-area section is represented near the bottom of the mirror with Tulsa and the same nearby communities.
- Physical iPhone and desktop owner comparison remains a required cutover gate.

## Media and interaction checks represented in source

- Exact FIRE logo
- Exact owner image
- Exact truck/equipment image
- Five primary before/after result cards
- Masonry and cobweb proof additions
- Six real On-the-Job videos
- Pointer/touch + keyboard before/after controls
- Mobile sticky Call / Text Photos / Estimate controls
- iPhone safe-area padding for the sticky header/menu and bottom action bar
- iPhone-aware SMS body formatting
- Estimator-to-SMS handoff
- Personalized-estimate-to-SMS handoff
- Accessible mobile menu and estimator accordions

## Cutover gate

Do not point `firstinresponseexteriors.com` at this repository until the temporary GitHub Pages build has been visually compared on an iPhone and desktop and the owner approves it. At cutover, follow `PRODUCTION_CUTOVER.md`; remove mirror indexing blocks only as part of that controlled process.
